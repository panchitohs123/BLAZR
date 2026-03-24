"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { updateDriverLocation } from "@/app/actions"

interface UseDriverLocationOptions {
    driverId: string | null
    enabled?: boolean
    interval?: number // ms
    onError?: (error: GeolocationPositionError) => void
}

export function useDriverLocation({
    driverId,
    enabled = true,
    interval = 10000, // 10 seconds default
    onError,
}: UseDriverLocationOptions) {
    const [isTracking, setIsTracking] = useState(false)
    const [lastLocation, setLastLocation] = useState<{
        lat: number
        lng: number
        timestamp: Date
    } | null>(null)
    const [error, setError] = useState<GeolocationPositionError | null>(null)
    
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const watchIdRef = useRef<number | null>(null)

    const sendLocation = useCallback(
        async (position: GeolocationPosition) => {
            if (!driverId) return

            const { latitude, longitude, accuracy } = position.coords

            try {
                const result = await updateDriverLocation(driverId, latitude, longitude)
                
                if (!result.error) {
                    setLastLocation({
                        lat: latitude,
                        lng: longitude,
                        timestamp: new Date(),
                    })
                    setError(null)
                }
            } catch (err) {
                console.error("Error sending location:", err)
            }
        },
        [driverId]
    )

    const handleError = useCallback(
        (err: GeolocationPositionError) => {
            setError(err)
            onError?.(err)
            
            switch (err.code) {
                case err.PERMISSION_DENIED:
                    console.error("Location permission denied")
                    break
                case err.POSITION_UNAVAILABLE:
                    console.error("Location unavailable")
                    break
                case err.TIMEOUT:
                    console.error("Location timeout")
                    break
            }
        },
        [onError]
    )

    const startTracking = useCallback(() => {
        if (!navigator.geolocation || !driverId) {
            console.error("Geolocation not supported or no driver ID")
            return
        }

        setIsTracking(true)

        // Get initial position
        navigator.geolocation.getCurrentPosition(sendLocation, handleError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
        })

        // Start watching position for continuous updates
        watchIdRef.current = navigator.geolocation.watchPosition(
            sendLocation,
            handleError,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000,
            }
        )

        // Backup interval to ensure updates even if watchPosition is slow
        intervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(sendLocation, handleError, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000,
            })
        }, interval)
    }, [driverId, interval, sendLocation, handleError])

    const stopTracking = useCallback(() => {
        setIsTracking(false)

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
        }

        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }, [])

    useEffect(() => {
        if (enabled && driverId) {
            startTracking()
        } else {
            stopTracking()
        }

        return () => {
            stopTracking()
        }
    }, [enabled, driverId, startTracking, stopTracking])

    return {
        isTracking,
        lastLocation,
        error,
        startTracking,
        stopTracking,
    }
}
