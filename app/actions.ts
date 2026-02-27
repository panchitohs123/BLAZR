"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { CartItem } from "@/lib/types"

// ─── Orders ────────────────────────────────────────────────────

export async function createOrder(formData: {
    customerName: string
    customerPhone: string
    fulfillmentType: "delivery" | "pickup"
    addressText: string
    notes: string
    paymentMethod: "mercadopago" | "cash"
    sucursalId: string
    items: CartItem[]
    subtotal: number
    deliveryFee: number
    total: number
}) {
    const supabase = await createClient()

    const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
            customer_name: formData.customerName,
            customer_phone: formData.customerPhone,
            fulfillment_type: formData.fulfillmentType,
            address_text: formData.addressText,
            notes: formData.notes,
            payment_method: formData.paymentMethod,
            sucursal_id: formData.sucursalId || null,
            subtotal: formData.subtotal,
            delivery_fee: formData.deliveryFee,
            total: formData.total,
            status: "new",
        })
        .select("id, public_tracking_token, order_number")
        .single()

    if (orderError) {
        return { error: orderError.message }
    }

    // Insert order items
    const orderItems = formData.items.map((item) => ({
        order_id: order.id,
        producto_id: item.productId || null,
        nombre_snapshot: item.name,
        precio_unit: item.price,
        qty: item.quantity,
        modifiers_json: item.modifiers,
        total: (item.price + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.quantity,
    }))

    const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems)

    if (itemsError) {
        return { error: itemsError.message }
    }

    revalidatePath("/admin/orders")
    revalidatePath("/admin")

    return {
        orderId: order.id,
        trackingToken: order.public_tracking_token,
        orderNumber: order.order_number,
    }
}

export async function updateOrderStatus(
    orderId: string,
    newStatus: string
) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath("/admin/orders")
    revalidatePath("/admin")
    return { success: true }
}

// ─── Products ──────────────────────────────────────────────────

export async function createProduct(data: {
    nombre: string
    descripcion?: string
    precio: number
    imageUrl?: string
    images?: string[]
    categoriaId: string
    activo?: boolean
    modifierGroupIds?: string[]
}) {
    const supabase = await createClient()

    const { data: product, error } = await supabase
        .from("productos")
        .insert({
            nombre: data.nombre,
            descripcion: data.descripcion || "",
            precio: data.precio,
            image_url: data.imageUrl || (data.images && data.images.length > 0 ? data.images[0] : ""),
            images: data.images || [],
            categoria_id: data.categoriaId,
            activo: data.activo ?? true,
        })
        .select("id")
        .single()

    if (error) return { error: error.message }

    // Insert modifier group links
    if (data.modifierGroupIds && data.modifierGroupIds.length > 0) {
        const links = data.modifierGroupIds.map((gid) => ({
            producto_id: product.id,
            group_id: gid,
        }))
        await supabase.from("producto_modifier_groups").insert(links)
    }

    revalidatePath("/admin/products")
    return { success: true, id: product.id }
}

export async function updateProduct(
    id: string,
    data: {
        nombre?: string
        descripcion?: string
        precio?: number
        imageUrl?: string
        images?: string[]
        categoriaId?: string
        activo?: boolean
        modifierGroupIds?: string[]
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion
    if (data.precio !== undefined) updateData.precio = data.precio
    if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl
    if (data.images !== undefined) updateData.images = data.images
    if (data.categoriaId !== undefined) updateData.categoria_id = data.categoriaId
    if (data.activo !== undefined) updateData.activo = data.activo

    if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
            .from("productos")
            .update(updateData)
            .eq("id", id)

        if (error) return { error: error.message }
    }

    if (data.modifierGroupIds !== undefined) {
        await supabase.from("producto_modifier_groups").delete().eq("producto_id", id)

        if (data.modifierGroupIds.length > 0) {
            const links = data.modifierGroupIds.map((gid) => ({
                producto_id: id,
                group_id: gid,
            }))
            const { error: linkErr } = await supabase.from("producto_modifier_groups").insert(links)
            if (linkErr) return { error: linkErr.message }
        }
    }

    revalidatePath("/admin/products")
    return { success: true }
}

export async function toggleProductActive(id: string) {
    const supabase = await createClient()

    // Get current state
    const { data: product } = await supabase
        .from("productos")
        .select("activo")
        .eq("id", id)
        .single()

    if (!product) return { error: "Product not found" }

    const { error } = await supabase
        .from("productos")
        .update({ activo: !product.activo })
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/products")
    return { success: true }
}

// ─── Categories ────────────────────────────────────────────────

export async function createCategory(data: {
    nombre: string
    slug: string
    orden?: number
}) {
    const supabase = await createClient()

    const { error } = await supabase.from("categorias").insert({
        nombre: data.nombre,
        slug: data.slug,
        orden: data.orden || 0,
    })

    if (error) return { error: error.message }

    revalidatePath("/admin/categories")
    revalidatePath("/admin/products")
    return { success: true }
}

export async function updateCategory(
    id: string,
    data: {
        nombre?: string
        slug?: string
        orden?: number
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.orden !== undefined) updateData.orden = data.orden

    const { error } = await supabase
        .from("categorias")
        .update(updateData)
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/categories")
    revalidatePath("/admin/products")
    return { success: true }
}

export async function deleteCategory(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("categorias")
        .delete()
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/categories")
    revalidatePath("/admin/products")
    return { success: true }
}

// ─── Modifier Groups ──────────────────────────────────────────

export async function createModifierGroup(data: {
    nombre: string
    required: boolean
    minSel?: number
    maxSel: number
    orden?: number
    options: { nombre: string; precioExtra: number; orden?: number }[]
    productoIds?: string[]
}) {
    const supabase = await createClient()

    const { data: group, error: gErr } = await supabase
        .from("modifier_groups")
        .insert({
            nombre: data.nombre,
            required: data.required,
            min_sel: data.minSel || 0,
            max_sel: data.maxSel,
            orden: data.orden || 0,
        })
        .select("id")
        .single()

    if (gErr) return { error: gErr.message }

    // Insert options
    if (data.options.length > 0) {
        const opts = data.options.map((o, i) => ({
            group_id: group.id,
            nombre: o.nombre,
            precio_extra: o.precioExtra,
            orden: o.orden ?? i,
        }))
        await supabase.from("modifier_options").insert(opts)
    }

    // Link to products
    if (data.productoIds && data.productoIds.length > 0) {
        const links = data.productoIds.map((pid) => ({
            producto_id: pid,
            group_id: group.id,
        }))
        await supabase.from("producto_modifier_groups").insert(links)
    }

    revalidatePath("/admin/modifiers")
    return { success: true, id: group.id }
}

export async function updateModifierGroup(
    id: string,
    data: {
        nombre?: string
        required?: boolean
        minSel?: number
        maxSel?: number
        options?: { id?: string; nombre: string; precioExtra: number; orden?: number }[]
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.required !== undefined) updateData.required = data.required
    if (data.minSel !== undefined) updateData.min_sel = data.minSel
    if (data.maxSel !== undefined) updateData.max_sel = data.maxSel

    if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
            .from("modifier_groups")
            .update(updateData)
            .eq("id", id)
        if (error) return { error: error.message }
    }

    // Replace options: delete existing, insert new
    if (data.options) {
        await supabase.from("modifier_options").delete().eq("group_id", id)
        if (data.options.length > 0) {
            const opts = data.options.map((o, i) => ({
                group_id: id,
                nombre: o.nombre,
                precio_extra: o.precioExtra,
                orden: o.orden ?? i,
            }))
            await supabase.from("modifier_options").insert(opts)
        }
    }

    revalidatePath("/admin/modifiers")
    return { success: true }
}

// ─── Branches ──────────────────────────────────────────────────

export async function createBranch(data: {
    nombre: string
    direccion?: string
    zonasDelivery?: string[]
    isOpen?: boolean
}) {
    const supabase = await createClient()

    const { error } = await supabase.from("sucursales").insert({
        nombre: data.nombre,
        direccion: data.direccion || "",
        zonas_delivery: data.zonasDelivery || [],
        is_open: data.isOpen ?? true,
    })

    if (error) return { error: error.message }

    revalidatePath("/admin/branches")
    return { success: true }
}

export async function updateBranch(
    id: string,
    data: {
        nombre?: string
        direccion?: string
        zonasDelivery?: string[]
        isOpen?: boolean
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.direccion !== undefined) updateData.direccion = data.direccion
    if (data.zonasDelivery !== undefined) updateData.zonas_delivery = data.zonasDelivery
    if (data.isOpen !== undefined) updateData.is_open = data.isOpen

    const { error } = await supabase
        .from("sucursales")
        .update(updateData)
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/branches")
    return { success: true }
}

export async function toggleBranchOpen(id: string) {
    const supabase = await createClient()

    const { data: branch } = await supabase
        .from("sucursales")
        .select("is_open")
        .eq("id", id)
        .single()

    if (!branch) return { error: "Branch not found" }

    const { error } = await supabase
        .from("sucursales")
        .update({ is_open: !branch.is_open })
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/branches")
    return { success: true }
}
