"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Store, CreditCard, Banknote, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useCartStore } from "@/lib/store"
import type { DeliveryMethod, PaymentMethod, Branch } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createOrder } from "@/app/actions"

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items)
  const totalPrice = useCartStore((s) => s.totalPrice())
  const clearCart = useCartStore((s) => s.clearCart)
  const router = useRouter()

  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("delivery")
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("mercadopago")

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")

  useEffect(() => {
    fetch("/api/admin?type=branches")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBranches(data)
          const openBranch = data.find((b: Branch) => b.isOpen)
          if (openBranch) setSelectedBranch(openBranch.id)
        }
      })
      .catch(() => { })
  }, [])

  const deliveryFee = deliveryMethod === "delivery" ? 3.99 : 0
  const grandTotal = totalPrice + deliveryFee

  const handlePlaceOrder = async () => {
    if (!name || !phone) {
      toast.error("Please fill in your name and phone number")
      return
    }
    if (deliveryMethod === "delivery" && !address) {
      toast.error("Please enter a delivery address")
      return
    }
    if (items.length === 0) {
      toast.error("Your cart is empty")
      return
    }

    setLoading(true)
    try {
      const result = await createOrder({
        customerName: name,
        customerPhone: phone,
        fulfillmentType: deliveryMethod,
        addressText: address,
        notes,
        paymentMethod,
        sucursalId: selectedBranch,
        items,
        subtotal: totalPrice,
        deliveryFee,
        total: grandTotal,
      })

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      clearCart()
      toast.success(`Order #${result.orderNumber} placed!`)
      router.push(`/order/${result.trackingToken}`)
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Your cart is empty</p>
        <Button asChild variant="outline">
          <Link href="/">Back to Menu</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" className="rounded-full" asChild>
            <Link href="/" aria-label="Back to menu">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Checkout
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-6">
          {/* Delivery Method */}
          <section className="rounded-2xl bg-card border border-border p-5">
            <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
              Delivery Method
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                  deliveryMethod === "delivery"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
                onClick={() => setDeliveryMethod("delivery")}
              >
                <MapPin
                  className={cn(
                    "h-5 w-5",
                    deliveryMethod === "delivery"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    deliveryMethod === "delivery"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  Delivery
                </span>
              </button>
              <button
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                  deliveryMethod === "pickup"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
                onClick={() => setDeliveryMethod("pickup")}
              >
                <Store
                  className={cn(
                    "h-5 w-5",
                    deliveryMethod === "pickup"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    deliveryMethod === "pickup"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  Pickup
                </span>
              </button>
            </div>
          </section>

          {/* Contact Info */}
          <section className="rounded-2xl bg-card border border-border p-5">
            <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
              Contact Info
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="name" className="text-sm text-muted-foreground mb-1.5 block">
                  Name
                </Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm text-muted-foreground mb-1.5 block">
                  Phone
                </Label>
                <Input
                  id="phone"
                  placeholder="+54 11 5555-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              {deliveryMethod === "delivery" && (
                <>
                  <div>
                    <Label htmlFor="address" className="text-sm text-muted-foreground mb-1.5 block">
                      Address
                    </Label>
                    <Input
                      id="address"
                      placeholder="Street, number, apartment"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes" className="text-sm text-muted-foreground mb-1.5 block">
                      Delivery Notes
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="Ring bell, leave at door, etc."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Payment Method */}
          <section className="rounded-2xl bg-card border border-border p-5">
            <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
              Payment Method
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                  paymentMethod === "mercadopago"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
                onClick={() => setPaymentMethod("mercadopago")}
              >
                <CreditCard
                  className={cn(
                    "h-5 w-5",
                    paymentMethod === "mercadopago"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    paymentMethod === "mercadopago"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  MercadoPago
                </span>
              </button>
              <button
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                  paymentMethod === "cash"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote
                  className={cn(
                    "h-5 w-5",
                    paymentMethod === "cash"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    paymentMethod === "cash"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  Cash
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* Order Summary Sidebar */}
        <aside className="lg:w-80 shrink-0">
          <div className="rounded-2xl bg-card border border-border p-5 lg:sticky lg:top-20">
            <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
              Order Summary
            </h2>
            <div className="flex flex-col gap-3">
              {items.map((item) => {
                const modPrice = item.modifiers.reduce(
                  (sum, m) => sum + m.price,
                  0
                )
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-card-foreground truncate">
                        {item.quantity}x {item.name}
                      </p>
                      {item.modifiers.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.modifiers
                            .map((m) => m.optionName)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-card-foreground shrink-0">
                      ${((item.price + modPrice) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span>
                  {deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : "Free"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg text-card-foreground">
                <span>Total</span>
                <span className="text-primary">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <Button
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base mt-5"
              onClick={handlePlaceOrder}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Placing Order...
                </>
              ) : (
                "Place Order"
              )}
            </Button>
          </div>
        </aside>
      </main>
    </div>
  )
}
