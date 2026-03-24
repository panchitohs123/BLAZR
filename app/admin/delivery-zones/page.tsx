"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { Plus, MapPin, Trash2, Edit2, DollarSign, Clock, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    createDeliveryZone,
    updateDeliveryZone,
    deleteDeliveryZone,
} from "@/app/actions"
import type { DeliveryZone, Branch } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { GoogleMapsProvider, ZoneEditor } from "@/components/maps"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function DeliveryZonesPage() {
    const { data: zones, mutate } = useSWR<DeliveryZone[]>(
        "/api/admin?type=delivery-zones",
        fetcher
    )
    const { data: branches } = useSWR<Branch[]>("/api/admin?type=branches", fetcher)
    const [isOpen, setIsOpen] = useState(false)
    const [isViewOpen, setIsViewOpen] = useState(false)
    const [editing, setEditing] = useState<DeliveryZone | null>(null)
    const [viewing, setViewing] = useState<DeliveryZone | null>(null)

    const [name, setName] = useState("")
    const [branchId, setBranchId] = useState("")
    const [deliveryFee, setDeliveryFee] = useState("")
    const [minOrderAmount, setMinOrderAmount] = useState("")
    const [estimatedTime, setEstimatedTime] = useState("")
    const [color, setColor] = useState("#3b82f6")
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }[]>([])

    const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"]

    const resetForm = () => {
        setName("")
        setBranchId(branches?.[0]?.id || "")
        setDeliveryFee("")
        setMinOrderAmount("")
        setEstimatedTime("")
        setColor("#3b82f6")
        setCoordinates([])
        setEditing(null)
    }

    const openNew = () => {
        resetForm()
        setIsOpen(true)
    }

    const openEdit = (zone: DeliveryZone) => {
        setEditing(zone)
        setName(zone.name)
        setBranchId(zone.branchId)
        setDeliveryFee(zone.deliveryFee.toString())
        setMinOrderAmount(zone.minOrderAmount?.toString() || "")
        setEstimatedTime(zone.estimatedTimeMin?.toString() || "")
        setColor(zone.color)
        setCoordinates(zone.coordinates || [])
        setIsOpen(true)
    }

    const openView = (zone: DeliveryZone) => {
        setViewing(zone)
        setIsViewOpen(true)
    }

    const handleSave = async () => {
        if (coordinates.length < 3) {
            toast.error("La zona debe tener al menos 3 puntos")
            return
        }

        const data = {
            branchId,
            name,
            color,
            coordinates,
            deliveryFee: parseFloat(deliveryFee) || 0,
            minOrderAmount: parseFloat(minOrderAmount) || 0,
            estimatedTimeMin: estimatedTime ? parseInt(estimatedTime) : undefined,
        }

        const result = editing
            ? await updateDeliveryZone(editing.id, { ...data, isActive: editing.isActive })
            : await createDeliveryZone(data)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(editing ? "Zona actualizada" : "Zona creada")
            mutate()
            setIsOpen(false)
            resetForm()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta zona?")) return
        const result = await deleteDeliveryZone(id)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Zona eliminada")
            mutate()
        }
    }

    const handleToggle = async (zone: DeliveryZone) => {
        const result = await updateDeliveryZone(zone.id, { isActive: !zone.isActive })
        if (result.error) {
            toast.error(result.error)
        } else {
            mutate()
        }
    }

    const getBranchLocation = (branchId: string) => {
        const branch = branches?.find((b) => b.id === branchId)
        // Mock coordinates for demo - in production these would come from the database
        return { lat: -34.6037, lng: -58.3816, title: branch?.name || "Sucursal" }
    }

    return (
        <GoogleMapsProvider>
            <div className="flex flex-col gap-6 max-w-6xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h1
                            className="text-2xl font-bold text-foreground"
                            style={{ fontFamily: "var(--font-heading)" }}
                        >
                            Zonas de Delivery
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configura áreas de cobertura y costos
                        </p>
                    </div>
                    <Button onClick={openNew} className="rounded-xl">
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Zona
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {zones?.map((zone) => (
                        <Card
                            key={zone.id}
                            className={cn(
                                "rounded-2xl overflow-hidden",
                                !zone.isActive && "opacity-60"
                            )}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-10 w-10 rounded-xl flex items-center justify-center"
                                            style={{ backgroundColor: `${zone.color}20` }}
                                        >
                                            <MapPin
                                                className="h-5 w-5"
                                                style={{ color: zone.color }}
                                            />
                                        </span>
                                        <div>
                                            <CardTitle className="text-lg">{zone.name}</CardTitle>
                                            <p className="text-xs text-muted-foreground">
                                                {branches?.find((b) => b.id === zone.branchId)
                                                    ?.name || "Sucursal"}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={zone.isActive ? "default" : "secondary"}>
                                        {zone.isActive ? "Activa" : "Inactiva"}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-bold text-xl">
                                            ${zone.deliveryFee.toFixed(2)}
                                        </span>
                                    </div>
                                    {zone.estimatedTimeMin && (
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            ~{zone.estimatedTimeMin} min
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="text-xs">
                                        {zone.coordinates?.length || 0} puntos del polígono
                                    </span>
                                </div>

                                {zone.minOrderAmount > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Envío gratis en pedidos desde ${zone.minOrderAmount}
                                    </p>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 rounded-lg"
                                        onClick={() => openView(zone)}
                                    >
                                        <Eye className="h-3.5 w-3.5 mr-1" />
                                        Ver
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 rounded-lg"
                                        onClick={() => openEdit(zone)}
                                    >
                                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                                        Editar
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg"
                                        onClick={() => handleToggle(zone)}
                                    >
                                        {zone.isActive ? "Desactivar" : "Activar"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg text-destructive"
                                        onClick={() => handleDelete(zone.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Create / Edit Dialog */}
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent className="sm:max-w-4xl rounded-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? "Editar Zona" : "Nueva Zona de Delivery"}
                            </DialogTitle>
                            <DialogDescription>
                                Dibuja el área de cobertura en el mapa haciendo clic para agregar
                                puntos
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                            {/* Form */}
                            <div className="space-y-4">
                                <div>
                                    <Label>Nombre</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Centro"
                                        className="rounded-xl mt-1.5"
                                    />
                                </div>
                                <div>
                                    <Label>Sucursal</Label>
                                    <select
                                        value={branchId}
                                        onChange={(e) => setBranchId(e.target.value)}
                                        className="w-full mt-1.5 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        {branches?.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Costo de envío</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={deliveryFee}
                                            onChange={(e) => setDeliveryFee(e.target.value)}
                                            className="rounded-xl mt-1.5"
                                        />
                                    </div>
                                    <div>
                                        <Label>Mínimo gratis (opc)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={minOrderAmount}
                                            onChange={(e) => setMinOrderAmount(e.target.value)}
                                            className="rounded-xl mt-1.5"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Tiempo estimado (min, opc)</Label>
                                    <Input
                                        type="number"
                                        value={estimatedTime}
                                        onChange={(e) => setEstimatedTime(e.target.value)}
                                        className="rounded-xl mt-1.5"
                                    />
                                </div>
                                <div>
                                    <Label>Color</Label>
                                    <div className="flex gap-2 mt-1.5">
                                        {COLORS.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setColor(c)}
                                                className={cn(
                                                    "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                                                    color === c
                                                        ? "border-foreground scale-110"
                                                        : "border-transparent"
                                                )}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Map Editor */}
                            <div>
                                <Label className="mb-2 block">Área de cobertura</Label>
                                <ZoneEditor
                                    initialCoordinates={coordinates}
                                    center={getBranchLocation(branchId)}
                                    branchMarker={getBranchLocation(branchId)}
                                    zoneColor={color}
                                    onChange={setCoordinates}
                                    height="400px"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl"
                                onClick={() => setIsOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 rounded-xl"
                                onClick={handleSave}
                                disabled={
                                    !name ||
                                    !branchId ||
                                    coordinates.length < 3
                                }
                            >
                                Guardar
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* View Dialog */}
                <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                    <DialogContent className="sm:max-w-3xl rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>{viewing?.name}</DialogTitle>
                            <DialogDescription>
                                {branches?.find((b) => b.id === viewing?.branchId)?.name}
                            </DialogDescription>
                        </DialogHeader>

                        {viewing && (
                            <div className="space-y-4 pt-4">
                                <ZoneEditor
                                    initialCoordinates={viewing.coordinates || []}
                                    center={getBranchLocation(viewing.branchId)}
                                    branchMarker={getBranchLocation(viewing.branchId)}
                                    zoneColor={viewing.color}
                                    onChange={() => {}}
                                    height="400px"
                                    readOnly
                                />

                                <div className="grid grid-cols-3 gap-4">
                                    <Card className="rounded-xl">
                                        <CardContent className="p-4 text-center">
                                            <p className="text-2xl font-bold">
                                                ${viewing.deliveryFee.toFixed(2)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Costo de envío
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card className="rounded-xl">
                                        <CardContent className="p-4 text-center">
                                            <p className="text-2xl font-bold">
                                                ${viewing.minOrderAmount || 0}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Mínimo gratis
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card className="rounded-xl">
                                        <CardContent className="p-4 text-center">
                                            <p className="text-2xl font-bold">
                                                {viewing.estimatedTimeMin || "--"} min
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Tiempo estimado
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </GoogleMapsProvider>
    )
}
