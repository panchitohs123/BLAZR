"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogIn, Loader2, Bike } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function DriverLoginPage() {
    const [phone, setPhone] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const supabase = createClient()
            
            // Buscar repartidor por teléfono
            const { data: driver, error } = await supabase
                .from("drivers")
                .select("*")
                .eq("phone", phone)
                .eq("is_active", true)
                .single()

            if (error || !driver) {
                toast.error("Número no registrado o inactivo")
                return
            }

            // Guardar ID del repartidor en localStorage
            localStorage.setItem("driverId", driver.id)
            localStorage.setItem("driverName", driver.name)
            
            toast.success(`Bienvenido, ${driver.name}!`)
            router.push("/driver/dashboard")
        } catch {
            toast.error("Error al iniciar sesión")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-sm rounded-2xl bg-card border-border">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bike className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle
                        className="text-xl text-card-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                    >
                        Repartidor
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Ingresa tu número de teléfono
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="flex flex-col gap-4">
                        <div>
                            <Label htmlFor="phone" className="text-sm text-muted-foreground mb-1.5 block">
                                Teléfono
                            </Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+54 11 5555-0000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Ingresando...
                                </>
                            ) : (
                                <>
                                    <LogIn className="h-4 w-4 mr-2" />
                                    Ingresar
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
