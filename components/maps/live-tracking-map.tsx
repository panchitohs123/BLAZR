"use client"

import { useEffect, useState, useCallback } from "react"
import { Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Polygon } from "./polygon"
import { Bike, MapPin, Clock, Navigation } from "lucide-react"

interface LiveTrackingMapProps {
    orderId: string
    driverId?: string
    destination: { lat: number; lng: number; address: string }
    branchLocation?: { lat: number; lng: number }
    height?: string
}

interface DriverLocation {
    lat: number
    lng: number
    updatedAt: string
}

const defaultCenter = { lat: -34.6037, lng: -58.3816 }

// Calcular distancia entre dos puntos (Haversine formula)
function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371 // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// Estimar tiempo de llegada (asumiendo velocidad promedio de 15 km/h en moto)
function estimateTime(distanceKm: number): number {
    const speedKmh = 15 // velocidad promedio repartidor
    return Math.round((distanceKm / speedKmh) * 60) // en minutos
}

export function LiveTrackingMap({
    orderId,
    driverId,
    destination,
    branchLocation,
    height = "350px",
}: LiveTrackingMapProps) {
    const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [distance, setDistance] = useState<number | null>(null)
    const [eta, setEta] = useState<number | null>(null)

    // Subscribe to driver location updates
    useEffect(() => {
        if (!driverId) return

        const supabase = createClient()

        // Initial fetch
        const fetchDriverLocation = async () => {
            const { data } = await supabase
                .from("drivers")
                .select("current_location")
                .eq("id", driverId)
                .single()

            if (data?.current_location) {
                const loc = data.current_location as any
                const location = {
                    lat: parseFloat(loc.lat),
                    lng: parseFloat(loc.lng),
                    updatedAt: loc.updated_at,
                }
                setDriverLocation(location)
                setLastUpdated(new Date(loc.updated_at))

                // Calculate distance and ETA
                const dist = calculateDistance(
                    location.lat,
                    location.lng,
                    destination.lat,
                    destination.lng
                )
                setDistance(dist)
                setEta(estimateTime(dist))
            }
        }

        fetchDriverLocation()

        // Subscribe to realtime updates
        const channel = supabase
            .channel(`driver-location-${driverId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "drivers",
                    filter: `id=eq.${driverId}`,
                },
                (payload) => {
                    const loc = (payload.new as any).current_location
                    if (loc) {
                        const location = {
                            lat: parseFloat(loc.lat),
                            lng: parseFloat(loc.lng),
                            updatedAt: loc.updated_at,
                        }
                        setDriverLocation(location)
                        setLastUpdated(new Date())

                        // Recalculate distance and ETA
                        const dist = calculateDistance(
                            location.lat,
                            location.lng,
                            destination.lat,
                            destination.lng
                        )
                        setDistance(dist)
                        setEta(estimateTime(dist))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [driverId, destination])

    // Calculate center between driver and destination
    const center = driverLocation
        ? {
              lat: (driverLocation.lat + destination.lat) / 2,
              lng: (driverLocation.lng + destination.lng) / 2,
          }
        : destination

    return (
        <div className="space-y-4">
            {/* Stats cards */}
            {driverLocation && (
                <div className="grid grid-cols-2 gap-3">
                    <Card className="rounded-xl">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Navigation className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Distancia</p>
                                <p className="font-bold text-lg">
                                    {distance !== null ? `${distance.toFixed(1)} km` : "--"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Llegada estimada</p>
                                <p className="font-bold text-lg">
                                    {eta !== null ? `~${eta} min` : "--"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Map */}
            <div style={{ height }} className="rounded-xl overflow-hidden border border-border">
                <Map
                    defaultCenter={center}
                    defaultZoom={14}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
                >
                    {/* Driver marker */}
                    {driverLocation && (
                        <AdvancedMarker
                            position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
                            title="Repartidor"
                        >
                            <div className="relative">
                                <div className="absolute -inset-2 bg-green-500/30 rounded-full animate-ping" />
                                <div className="relative h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-2 border-white">
                                    <Bike className="h-5 w-5 text-white" />
                                </div>
                            </div>
                        </AdvancedMarker>
                    )}

                    {/* Destination marker */}
                    <AdvancedMarker
                        position={{ lat: destination.lat, lng: destination.lng }}
                        title="Tu ubicación"
                    >
                        <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg border-2 border-white">
                            <MapPin className="h-5 w-5 text-white" />
                        </div>
                    </AdvancedMarker>

                    {/* Branch marker */}
                    {branchLocation && (
                        <AdvancedMarker
                            position={{ lat: branchLocation.lat, lng: branchLocation.lng }}
                            title="Restaurante"
                        >
                            <Pin
                                background="#1f2937"
                                borderColor="#000000"
                                glyphColor="#ffffff"
                                scale={1.2}
                            />
                        </AdvancedMarker>
                    )}
                </Map>
            </div>

            {/* Last updated */}
            {lastUpdated && (
                <p className="text-xs text-muted-foreground text-center">
                    Última actualización: {lastUpdated.toLocaleTimeString()}
                </p>
            )}

            {!driverLocation && driverId && (
                <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                        Esperando ubicación del repartidor...
                    </p>
                </div>
            )}
        </div>
    )
}
