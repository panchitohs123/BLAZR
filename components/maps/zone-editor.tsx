"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Map, useMap, AdvancedMarker, Pin } from "@vis.gl/react-google-maps"
import { Polygon } from "./polygon"
import { Button } from "@/components/ui/button"
import { Undo, Trash2, Check, MapPin } from "lucide-react"

interface ZoneEditorProps {
    initialCoordinates?: { lat: number; lng: number }[]
    center?: { lat: number; lng: number }
    branchMarker?: { lat: number; lng: number; title?: string }
    zoneColor?: string
    onChange: (coordinates: { lat: number; lng: number }[]) => void
    height?: string
    readOnly?: boolean
}

const defaultCenter = { lat: -34.6037, lng: -58.3816 }
const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"]

// Marcador tradicional que funciona sin Map ID
function TraditionalMarker({
    map,
    position,
    color = "#3b82f6",
    scale = 1,
    title,
}: {
    map: google.maps.Map
    position: google.maps.LatLngLiteral
    color?: string
    scale?: number
    title?: string
}) {
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

    useEffect(() => {
        const pinElement = document.createElement("div")
        pinElement.innerHTML = `
            <svg width="${32 * scale}" height="${40 * scale}" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/>
                <circle cx="16" cy="16" r="8" fill="white"/>
            </svg>
        `
        pinElement.style.cursor = "pointer"

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position,
            title,
            content: pinElement,
        })

        markerRef.current = marker

        return () => {
            marker.map = null
        }
    }, [map, position, color, scale, title])

    return null
}

export function ZoneEditor({
    initialCoordinates = [],
    center = defaultCenter,
    branchMarker,
    zoneColor = "#3b82f6",
    onChange,
    height = "500px",
    readOnly = false,
}: ZoneEditorProps) {
    const map = useMap()
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }[]>(initialCoordinates)
    const [isDrawing, setIsDrawing] = useState(false)
    const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
    const hasMapId = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID

    // Sync with initial coordinates
    useEffect(() => {
        if (initialCoordinates.length > 0 && coordinates.length === 0) {
            setCoordinates(initialCoordinates)
        }
    }, [initialCoordinates])

    // Notify parent of changes
    useEffect(() => {
        onChange(coordinates)
    }, [coordinates, onChange])

    const handleMapClick = useCallback(
        (e: google.maps.MapMouseEvent) => {
            if (readOnly || !e.latLng) return

            const newPoint = {
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
            }

            setCoordinates((prev) => [...prev, newPoint])
        },
        [readOnly]
    )

    const handleUndo = useCallback(() => {
        setCoordinates((prev) => prev.slice(0, -1))
    }, [])

    const handleClear = useCallback(() => {
        if (confirm("¿Eliminar todos los puntos de la zona?")) {
            setCoordinates([])
        }
    }, [])

    const handleFinish = useCallback(() => {
        if (coordinates.length < 3) {
            alert("La zona debe tener al menos 3 puntos")
            return
        }
        setIsDrawing(false)
    }, [coordinates])

    const handleMapLoad = useCallback((map: google.maps.Map) => {
        setMapInstance(map)
    }, [])

    return (
        <div className="space-y-4">
            <div className="relative">
                <div style={{ height }} className="rounded-xl overflow-hidden border border-border">
                    <Map
                        defaultCenter={center}
                        defaultZoom={14}
                        gestureHandling="greedy"
                        disableDefaultUI={false}
                        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || undefined}
                        onClick={handleMapClick}
                        onLoad={handleMapLoad}
                    >
                        {/* Draw polygon */}
                        {coordinates.length >= 3 && (
                            <Polygon
                                paths={coordinates}
                                strokeColor={zoneColor}
                                fillColor={zoneColor}
                                fillOpacity={0.25}
                                strokeWeight={2}
                            />
                        )}

                        {/* Draw line for incomplete polygon */}
                        {coordinates.length >= 2 && coordinates.length < 3 && (
                            <Polygon
                                paths={coordinates}
                                strokeColor={zoneColor}
                                fillColor={zoneColor}
                                fillOpacity={0.1}
                                strokeWeight={2}
                            />
                        )}

                        {/* Markers for each point */}
                        {!readOnly &&
                            hasMapId &&
                            coordinates.map((coord, index) => (
                                <AdvancedMarker
                                    key={index}
                                    position={coord}
                                    title={`Punto ${index + 1}`}
                                >
                                    <Pin
                                        background={zoneColor}
                                        borderColor={zoneColor}
                                        glyphColor="#ffffff"
                                        scale={0.8}
                                    />
                                </AdvancedMarker>
                            ))}

                        {/* Traditional markers when no Map ID */}
                        {!readOnly &&
                            !hasMapId &&
                            mapInstance &&
                            coordinates.map((coord, index) => (
                                <TraditionalMarker
                                    key={index}
                                    map={mapInstance}
                                    position={coord}
                                    color={zoneColor}
                                    scale={0.8}
                                    title={`Punto ${index + 1}`}
                                />
                            ))}

                        {/* Branch marker */}
                        {branchMarker && hasMapId && (
                            <AdvancedMarker
                                position={{ lat: branchMarker.lat, lng: branchMarker.lng }}
                                title={branchMarker.title || "Sucursal"}
                            >
                                <Pin
                                    background="#1f2937"
                                    borderColor="#000000"
                                    glyphColor="#ffffff"
                                    scale={1.2}
                                />
                            </AdvancedMarker>
                        )}

                        {/* Branch marker traditional */}
                        {branchMarker && !hasMapId && mapInstance && (
                            <TraditionalMarker
                                map={mapInstance}
                                position={{ lat: branchMarker.lat, lng: branchMarker.lng }}
                                color="#1f2937"
                                scale={1.2}
                                title={branchMarker.title || "Sucursal"}
                            />
                        )}
                    </Map>
                </div>

                {/* Instructions overlay */}
                {!readOnly && coordinates.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-background/90 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg border border-border">
                            <div className="flex items-center gap-3">
                                <MapPin className="h-5 w-5 text-primary" />
                                <p className="text-sm text-foreground">
                                    Haz clic en el mapa para dibujar la zona de delivery
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            {!readOnly && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUndo}
                            disabled={coordinates.length === 0}
                            className="rounded-xl"
                        >
                            <Undo className="h-4 w-4 mr-1" />
                            Deshacer
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClear}
                            disabled={coordinates.length === 0}
                            className="rounded-xl text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Limpiar
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {coordinates.length} puntos
                        </span>
                        {coordinates.length >= 3 && (
                            <Button
                                size="sm"
                                onClick={handleFinish}
                                className="rounded-xl"
                            >
                                <Check className="h-4 w-4 mr-1" />
                                Completar
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Color picker for zone */}
            {!readOnly && (
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Color:</span>
                    <div className="flex gap-2">
                        {COLORS.map((color) => (
                            <button
                                key={color}
                                onClick={() => onChange(coordinates)}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                                    zoneColor === color
                                        ? "border-foreground scale-110"
                                        : "border-transparent"
                                }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
