"use client"

import { useEffect, useState, useCallback } from "react"
import { Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Navigation, Clock, Bike, MapPin } from "lucide-react"

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

// Marcador tradicional que funciona sin Map ID
function TraditionalMarker({
    map,
    position,
    color = "#22c55e",
    children,
    title,
    scale = 1,
}: {
    map: google.maps.Map
    position: google.maps.LatLngLiteral
    color?: string
    children?: React.ReactNode
    title?: string
    scale?: number
}) {
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

    useEffect(() => {
        const container = document.createElement("div")
        container.style.position = "relative"
        container.style.display = "flex"
        container.style.alignItems = "center"
        container.style.justifyContent = "center"

        if (children) {
            // Si hay children (componente React), renderizarlos
            container.innerHTML = `
                <div style="
                    width: ${40 * scale}px;
                    height: ${40 * scale}px;
                    background-color: ${color};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                ">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                </div>
            `
        } else {
            // Marcador simple
            container.innerHTML = `
                <svg width="${32 * scale}" height="${40 * scale}" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/>
                    <circle cx="16" cy="16" r="8" fill="white"/>
                </svg>
            `
        }

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position,
            title,
            content: container,
        })

        markerRef.current = marker

        return () => {
            marker.map = null
        }
    }, [map, position, color, children, title, scale])

    return null
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
    const [map, setMap] = useState<google.maps.Map | null>(null)
    const hasMapId = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID

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

    const handleMapLoad = useCallback((mapInstance: google.maps.Map) => {
        setMap(mapInstance)
    }, [])

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
                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || undefined}
                    onLoad={handleMapLoad}
                >
                    {/* Driver marker with Map ID */}
                    {driverLocation && hasMapId && (
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

                    {/* Driver marker without Map ID */}
                    {driverLocation && !hasMapId && map && (
                        <TraditionalMarker
                            map={map}
                            position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
                            color="#22c55e"
                            title="Repartidor"
                            scale={1}
                        >
                            <Bike className="h-5 w-5 text-white" />
                        </TraditionalMarker>
                    )}

                    {/* Destination marker with Map ID */}
                    {hasMapId && (
                        <AdvancedMarker
                            position={{ lat: destination.lat, lng: destination.lng }}
                            title="Tu ubicación"
                        >
                            <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg border-2 border-white">
                                <MapPin className="h-5 w-5 text-white" />
                            </div>
                        </AdvancedMarker>
                    )}

                    {/* Destination marker without Map ID */}
                    {!hasMapId && map && (
                        <TraditionalMarker
                            map={map}
                            position={{ lat: destination.lat, lng: destination.lng }}
                            color="#ef4444"
                            title="Tu ubicación"
                            scale={1}
                        />
                    )}

                    {/* Branch marker with Map ID */}
                    {branchLocation && hasMapId && (
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

                    {/* Branch marker without Map ID */}
                    {branchLocation && !hasMapId && map && (
                        <TraditionalMarker
                            map={map}
                            position={{ lat: branchLocation.lat, lng: branchLocation.lng }}
                            color="#1f2937"
                            title="Restaurante"
                            scale={1.2}
                        />
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
