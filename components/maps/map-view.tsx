"use client"

import { useState, useCallback } from "react"
import {
    Map,
    useMap,
    AdvancedMarker,
    Pin,
    MapControl,
    ControlPosition,
} from "@vis.gl/react-google-maps"
import { Polygon } from "./polygon"

export interface MapMarker {
    id: string
    lat: number
    lng: number
    title?: string
    icon?: "branch" | "driver" | "customer" | "default"
    color?: string
    onClick?: () => void
}

export interface MapZone {
    id: string
    coordinates: { lat: number; lng: number }[]
    color?: string
    fillOpacity?: number
    onClick?: () => void
}

interface MapViewProps {
    center?: { lat: number; lng: number }
    zoom?: number
    markers?: MapMarker[]
    zones?: MapZone[]
    onMapClick?: (lat: number, lng: number) => void
    onMapLoad?: (map: google.maps.Map) => void
    height?: string
    className?: string
    showCurrentLocation?: boolean
}

const defaultCenter = { lat: -34.6037, lng: -58.3816 } // Buenos Aires

function CurrentLocationButton() {
    const map = useMap()

    const handleClick = useCallback(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords
                    map?.panTo({ lat: latitude, lng: longitude })
                    map?.setZoom(16)
                },
                (error) => {
                    console.error("Error getting location:", error)
                }
            )
        }
    }, [map])

    return (
        <button
            onClick={handleClick}
            className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            title="Ir a mi ubicación"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
        </button>
    )
}

export function MapView({
    center = defaultCenter,
    zoom = 13,
    markers = [],
    zones = [],
    onMapClick,
    onMapLoad,
    height = "400px",
    className = "",
    showCurrentLocation = true,
}: MapViewProps) {
    const [selectedMarker, setSelectedMarker] = useState<string | null>(null)

    const handleMapClick = useCallback(
        (e: google.maps.MapMouseEvent) => {
            if (e.latLng && onMapClick) {
                onMapClick(e.latLng.lat(), e.latLng.lng())
            }
        },
        [onMapClick]
    )

    const getPinConfig = (marker: MapMarker) => {
        switch (marker.icon) {
            case "branch":
                return {
                    background: marker.color || "#3b82f6",
                    borderColor: "#1d4ed8",
                    glyphColor: "#ffffff",
                }
            case "driver":
                return {
                    background: marker.color || "#22c55e",
                    borderColor: "#15803d",
                    glyphColor: "#ffffff",
                }
            case "customer":
                return {
                    background: marker.color || "#ef4444",
                    borderColor: "#b91c1c",
                    glyphColor: "#ffffff",
                }
            default:
                return {
                    background: marker.color || "#3b82f6",
                    borderColor: "#1d4ed8",
                    glyphColor: "#ffffff",
                }
        }
    }

    return (
        <div style={{ height }} className={`rounded-xl overflow-hidden ${className}`}>
            <Map
                defaultCenter={center}
                defaultZoom={zoom}
                gestureHandling="greedy"
                disableDefaultUI={false}
                mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
                onClick={handleMapClick}
                onLoad={onMapLoad}
            >
                {/* Render zones */}
                {zones.map((zone) => (
                    <Polygon
                        key={zone.id}
                        paths={zone.coordinates}
                        strokeColor={zone.color || "#3b82f6"}
                        fillColor={zone.color || "#3b82f6"}
                        fillOpacity={zone.fillOpacity ?? 0.2}
                        strokeWeight={2}
                        clickable={!!zone.onClick}
                        onClick={zone.onClick}
                    />
                ))}

                {/* Render markers */}
                {markers.map((marker) => (
                    <AdvancedMarker
                        key={marker.id}
                        position={{ lat: marker.lat, lng: marker.lng }}
                        title={marker.title}
                        onClick={() => {
                            setSelectedMarker(marker.id)
                            marker.onClick?.()
                        }}
                    >
                        <Pin {...getPinConfig(marker)} />
                    </AdvancedMarker>
                ))}

                {/* Current location button */}
                {showCurrentLocation && (
                    <MapControl position={ControlPosition.RIGHT_BOTTOM}>
                        <div className="mb-4 mr-4">
                            <CurrentLocationButton />
                        </div>
                    </MapControl>
                )}
            </Map>
        </div>
    )
}
