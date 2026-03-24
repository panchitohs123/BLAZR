"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Map, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps"
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

// Marcador tradicional que funciona sin Map ID
function TraditionalMarker({
    map,
    position,
    color = "#22c55e",
    hasOrder = false,
    isSelected = false,
    onClick,
}: {
    map: google.maps.Map
    position: google.maps.LatLngLiteral
    color?: string
    hasOrder?: boolean
    isSelected?: boolean
    onClick?: () => void
}) {
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

    useEffect(() => {
        if (!google.maps.marker?.AdvancedMarkerElement) return

        const container = document.createElement("div")
        container.style.position = "relative"
        container.style.display = "flex"
        container.style.alignItems = "center"
        container.style.justifyContent = "center"
        container.style.transform = isSelected ? "scale(1.25)" : "scale(1)"
        container.style.transition = "transform 0.2s"
        container.style.cursor = onClick ? "pointer" : "default"

        // Main marker
        const markerHtml = `
            <div style="
                width: 40px;
                height: 40px;
                background-color: ${color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                position: relative;
                z-index: 2;
            ">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="5.5" cy="17.5" r="3.5"/>
                    <circle cx="18.5" cy="17.5" r="3.5"/>
                    <path d="M15 6a1 1 0 100-2 1 1 0 000 2zm-3 11.5V14l-3-3 4-3 2 3h2"/>
                </svg>
            </div>
            ${hasOrder ? `
            <div style="
                position: absolute;
                top: -4px;
                right: -4px;
                width: 20px;
                height: 20px;
                background-color: #ef4444;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                z-index: 3;
            ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                    <path d="m3.3 7 8.7 5 8.7-5"/>
                    <path d="M12 22V12"/>
                </svg>
            </div>
            ` : ""}
            ${hasOrder ? `
            <div style="
                position: absolute;
                inset: -8px;
                background-color: ${color}30;
                border-radius: 50%;
                animation: pulse 2s infinite;
                z-index: 1;
            "></div>
            ` : ""}
        `

        // Add keyframes for pulse
        const style = document.createElement("style")
        style.textContent = `
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.5); opacity: 0; }
            }
        `
        document.head.appendChild(style)

        container.innerHTML = markerHtml

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position,
            content: container,
        })

        if (onClick) {
            marker.addListener("click", onClick)
        }

        markerRef.current = marker

        return () => {
            marker.map = null
            document.head.removeChild(style)
        }
    }, [map, position, color, hasOrder, isSelected, onClick])

    return null
}

export function DriversOverviewMap({ height = "500px" }: DriversOverviewMapProps) {
    const [drivers, setDrivers] = useState<DriverWithLocation[]>([])
    const [selectedDriver, setSelectedDriver] = useState<DriverWithLocation | null>(null)
    const [loading, setLoading] = useState(true)
    const map = useMap()
    const hasMapId = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID

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

    const mapsAvailable = typeof google !== "undefined" && !!google.maps

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
                        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || undefined}
                    >
                        {/* Markers with Map ID */}
                        {mapsAvailable && hasMapId &&
                            driversWithLocation.map((driver) => (
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

                        {/* Markers without Map ID */}
                        {mapsAvailable && !hasMapId &&
                            map &&
                            driversWithLocation.map((driver) => (
                                <TraditionalMarker
                                    key={driver.id}
                                    map={map}
                                    position={{
                                        lat: driver.currentLocation!.lat,
                                        lng: driver.currentLocation!.lng,
                                    }}
                                    color={
                                        driver.activeOrder
                                            ? "#3b82f6"
                                            : driver.isAvailable
                                            ? "#22c55e"
                                            : "#6b7280"
                                    }
                                    hasOrder={!!driver.activeOrder}
                                    isSelected={selectedDriver?.id === driver.id}
                                    onClick={() => setSelectedDriver(driver)}
                                />
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
