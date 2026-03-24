"use client"

import { useEffect, useState } from "react"
import { Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps"
import { createClient } from "@/lib/supabase/client"
import type { Driver } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bike, Package, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface DriversOverviewMapProps {
    height?: string
}

interface DriverWithLocation extends Driver {
    activeOrder?: {
        id: string
        orderNumber: number
        address: string
        status: string
    }
}

const defaultCenter = { lat: -34.6037, lng: -58.3816 }

export function DriversOverviewMap({ height = "500px" }: DriversOverviewMapProps) {
    const [drivers, setDrivers] = useState<DriverWithLocation[]>([])
    const [selectedDriver, setSelectedDriver] = useState<DriverWithLocation | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()

        const fetchDrivers = async () => {
            const { data: driversData } = await supabase
                .from("drivers")
                .select("*")
                .eq("is_active", true)

            if (!driversData) {
                setLoading(false)
                return
            }

            // Fetch active orders for each driver
            const driversWithOrders = await Promise.all(
                driversData.map(async (driver) => {
                    const { data: orders } = await supabase
                        .from("orders")
                        .select("id, order_number, address_text, status")
                        .eq("driver_id", driver.id)
                        .in("status", ["ready", "delivering"])
                        .order("driver_assigned_at", { ascending: false })
                        .limit(1)

                    return {
                        ...driver,
                        currentLocation: driver.current_location
                            ? {
                                  lat: driver.current_location.lat,
                                  lng: driver.current_location.lng,
                                  updatedAt: driver.current_location.updated_at,
                              }
                            : undefined,
                        activeOrder: orders?.[0]
                            ? {
                                  id: orders[0].id,
                                  orderNumber: orders[0].order_number,
                                  address: orders[0].address_text,
                                  status: orders[0].status,
                              }
                            : undefined,
                    }
                })
            )

            setDrivers(driversWithOrders)
            setLoading(false)
        }

        fetchDrivers()

        // Subscribe to driver location updates
        const channel = supabase
            .channel("drivers-overview")
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "drivers",
                },
                (payload) => {
                    const updatedDriver = payload.new as any
                    setDrivers((prev) =>
                        prev.map((d) =>
                            d.id === updatedDriver.id
                                ? {
                                      ...d,
                                      currentLocation: updatedDriver.current_location
                                          ? {
                                                lat: updatedDriver.current_location.lat,
                                                lng: updatedDriver.current_location.lng,
                                                updatedAt:
                                                    updatedDriver.current_location.updated_at,
                                            }
                                          : d.currentLocation,
                                      isAvailable: updatedDriver.is_available,
                                  }
                                : d
                        )
                    )
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                },
                () => {
                    // Refetch to get updated order assignments
                    fetchDrivers()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Filter drivers with location
    const driversWithLocation = drivers.filter((d) => d.currentLocation)

    // Calculate center based on drivers or use default
    const center =
        driversWithLocation.length > 0
            ? {
                  lat:
                      driversWithLocation.reduce((sum, d) => sum + d.currentLocation!.lat, 0) /
                      driversWithLocation.length,
                  lng:
                      driversWithLocation.reduce((sum, d) => sum + d.currentLocation!.lng, 0) /
                      driversWithLocation.length,
              }
            : defaultCenter

    if (loading) {
        return (
            <div
                style={{ height }}
                className="rounded-xl border border-border bg-muted flex items-center justify-center"
            >
                <p className="text-muted-foreground">Cargando repartidores...</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold">{drivers.length}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-green-600">
                            {drivers.filter((d) => d.isAvailable).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Disponibles</p>
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-blue-600">
                            {drivers.filter((d) => d.activeOrder).length}
                        </p>
                        <p className="text-xs text-muted-foreground">En entrega</p>
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-gray-500">
                            {drivers.filter((d) => !d.currentLocation).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Sin ubicación</p>
                    </CardContent>
                </Card>
            </div>

            {/* Map */}
            <div className="relative">
                <div style={{ height }} className="rounded-xl overflow-hidden border border-border">
                    <Map
                        defaultCenter={center}
                        defaultZoom={13}
                        gestureHandling="greedy"
                        disableDefaultUI={false}
                        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
                    >
                        {driversWithLocation.map((driver) => (
                            <AdvancedMarker
                                key={driver.id}
                                position={{
                                    lat: driver.currentLocation!.lat,
                                    lng: driver.currentLocation!.lng,
                                }}
                                title={driver.name}
                                onClick={() => setSelectedDriver(driver)}
                            >
                                <div
                                    className={`relative ${
                                        selectedDriver?.id === driver.id ? "z-10" : ""
                                    }`}
                                >
                                    {driver.activeOrder && (
                                        <div className="absolute -inset-2 bg-blue-500/30 rounded-full animate-pulse" />
                                    )}
                                    <div
                                        className={`relative h-10 w-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-transform ${
                                            driver.activeOrder
                                                ? "bg-blue-500"
                                                : driver.isAvailable
                                                ? "bg-green-500"
                                                : "bg-gray-500"
                                        } ${selectedDriver?.id === driver.id ? "scale-125" : ""}`}
                                    >
                                        <Bike className="h-5 w-5 text-white" />
                                    </div>
                                    {driver.activeOrder && (
                                        <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold border-2 border-white">
                                            <Package className="h-3 w-3" />
                                        </div>
                                    )}
                                </div>
                            </AdvancedMarker>
                        ))}
                    </Map>
                </div>

                {/* Driver info panel */}
                {selectedDriver && (
                    <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-border">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-lg">{selectedDriver.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedDriver.phone}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge
                                        variant={
                                            selectedDriver.isAvailable ? "default" : "secondary"
                                        }
                                    >
                                        {selectedDriver.isAvailable
                                            ? "Disponible"
                                            : "No disponible"}
                                    </Badge>
                                    {selectedDriver.activeOrder && (
                                        <Badge variant="outline" className="bg-blue-50">
                                            <Package className="h-3 w-3 mr-1" />
                                            Pedido #{selectedDriver.activeOrder.orderNumber}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDriver(null)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                ✕
                            </button>
                        </div>

                        {selectedDriver.activeOrder && (
                            <div className="mt-3 pt-3 border-t border-border">
                                <p className="text-sm font-medium">Entregando a:</p>
                                <p className="text-sm text-muted-foreground">
                                    {selectedDriver.activeOrder.address || "Retiro en local"}
                                </p>
                            </div>
                        )}

                        {selectedDriver.currentLocation?.updatedAt && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                Actualizado{" "}
                                {formatDistanceToNow(
                                    new Date(selectedDriver.currentLocation.updatedAt),
                                    {
                                        addSuffix: true,
                                        locale: es,
                                    }
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
