"use client"

import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import {
  Clock,
  ChefHat,
  Package,
  Truck,
  Check,
  Phone,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
import type { Order, OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { updateOrderStatus } from "@/app/actions"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Column = {
  id: OrderStatus
  label: string
  icon: any
  color: string
  nextStatus?: OrderStatus
}

const COLUMNS: Column[] = [
  {
    id: "new",
    label: "New",
    icon: Clock,
    color: "bg-chart-1/15 text-chart-1 border-chart-1/20",
    nextStatus: "accepted",
  },
  {
    id: "accepted",
    label: "Accepted",
    icon: Check,
    color: "bg-chart-2/15 text-chart-2 border-chart-2/20",
    nextStatus: "preparing",
  },
  {
    id: "preparing",
    label: "Preparing",
    icon: ChefHat,
    color: "bg-accent/15 text-accent border-accent/20",
    nextStatus: "ready",
  },
  {
    id: "ready",
    label: "Ready",
    icon: Package,
    color: "bg-chart-3/15 text-chart-3 border-chart-3/20",
    nextStatus: "delivered",
  },
  {
    id: "delivered",
    label: "Delivered",
    icon: Truck,
    color: "bg-muted text-muted-foreground border-border",
  },
]

export default function OrdersKanbanPage() {
  const { data: initialOrders, mutate } = useSWR<Order[]>(
    "/api/admin?type=orders",
    fetcher
  )
  const [orders, setOrders] = useState<Order[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Audio ref for notification
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3") // Add a simple mp3 to public folder in real usage
  }, [])

  useEffect(() => {
    if (initialOrders) {
      setOrders(initialOrders)
    }
  }, [initialOrders])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            toast.info(`New order received!`)
            audioRef.current?.play().catch(() => { })
            mutate()
          } else if (payload.eventType === "UPDATE") {
            setOrders((current) =>
              current.map((order) =>
                order.id === payload.new.id
                  ? { ...order, ...payload.new }
                  : order
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mutate])

  const handleNextStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId)
    // Optimistic UI update
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order
      )
    )

    const result = await updateOrderStatus(orderId, nextStatus)

    if (result.error) {
      toast.error(result.error)
      // Revert on error
      mutate()
    }

    setUpdatingId(null)
  }

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
      <div>
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Orders
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage active operations in real-time
        </p>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 snap-x">
        {COLUMNS.map((col) => {
          const safeOrders = Array.isArray(orders) ? orders : []
          const colOrders = safeOrders.filter((o) => o.status === col.id)
          const ColIcon = col.icon

          return (
            <div
              key={col.id}
              className="flex-shrink-0 w-80 flex flex-col gap-4 snap-center"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ColIcon className="h-4 w-4 text-muted-foreground" />
                  <h2
                    className="font-semibold text-foreground uppercase tracking-wide text-sm"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {col.label}
                  </h2>
                </div>
                <Badge
                  variant="outline"
                  className={cn("px-2 text-xs", col.color)}
                >
                  {colOrders.length}
                </Badge>
              </div>

              <ScrollArea className="flex-1 rounded-2xl bg-secondary/30 border border-border/50 p-2">
                <div className="flex flex-col gap-3">
                  {colOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full border-2 border-dashed border-border/50 rounded-xl">
                      <ColIcon className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm font-medium">No orders</p>
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <Card
                        key={order.id}
                        className={cn(
                          "rounded-xl bg-card border-border shadow-sm transition-all",
                          updatingId === order.id && "opacity-50 pointer-events-none"
                        )}
                      >
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                              #{order.orderNumber}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {new Date(order.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <CardTitle className="text-base text-card-foreground">
                            {order.customerName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                            <Phone className="h-3.5 w-3.5" />
                            {order.customerPhone}
                          </div>

                          <div className="space-y-2 mb-4">
                            {order.items.map((item) => (
                              <div key={item.id} className="text-sm flex justify-between">
                                <div>
                                  <span className="font-medium text-foreground">{item.quantity}x</span>{" "}
                                  <span className="text-muted-foreground">{item.name}</span>
                                  {item.modifiers?.length > 0 && (
                                    <p className="text-xs text-muted-foreground/70 pl-5">
                                      {item.modifiers.map(m => m.optionName).join(", ")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                                {order.deliveryMethod}
                              </span>
                              <span className="font-semibold text-foreground text-sm">
                                ${order.total.toFixed(2)}
                              </span>
                            </div>

                            {col.nextStatus && (
                              <Button
                                size="sm"
                                className="h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                                onClick={() => handleNextStatus(order.id, col.nextStatus!)}
                              >
                                Next
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>
    </div>
  )
}
