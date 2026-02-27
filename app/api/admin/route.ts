import { NextRequest, NextResponse } from "next/server"
import { getCategories, getAllProducts, getModifierGroups, getBranches, getOrders } from "@/lib/supabase/queries"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")

    try {
        switch (type) {
            case "categories":
                return NextResponse.json(await getCategories())
            case "products":
                return NextResponse.json(await getAllProducts())
            case "modifiers":
                return NextResponse.json(await getModifierGroups())
            case "branches":
                return NextResponse.json(await getBranches())
            case "orders":
                return NextResponse.json(await getOrders())
            default:
                return NextResponse.json({ error: "Invalid type" }, { status: 400 })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
