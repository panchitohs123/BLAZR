export interface Category {
  id: string
  name: string
  slug: string
  order: number
}

export interface ModifierOption {
  id: string
  name: string
  price: number
}

export interface ModifierGroup {
  id: string
  name: string
  required: boolean
  maxSelections: number
  options: ModifierOption[]
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  images: string[]
  categoryId: string
  active: boolean
  modifierGroups: string[] // IDs of modifier groups
}

export interface CartItemModifier {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  price: number
}

export interface CartItem {
  id: string // unique cart item id
  productId: string
  name: string
  image: string
  price: number
  quantity: number
  modifiers: CartItemModifier[]
}

export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled"

export type DeliveryMethod = "delivery" | "pickup"

export type PaymentMethod = "mercadopago" | "cash"

export interface Order {
  id: string
  orderNumber?: number
  trackingToken?: string
  customerName: string
  customerPhone: string
  address: string
  deliveryNotes: string
  deliveryMethod: DeliveryMethod
  paymentMethod: PaymentMethod
  items: CartItem[]
  subtotal: number
  deliveryFee: number
  total: number
  status: OrderStatus
  createdAt: string
  acceptedAt?: string
  preparingAt?: string
  readyAt?: string
  deliveredAt?: string
  cancelledAt?: string
  branchId: string
}

export interface Branch {
  id: string
  name: string
  address: string
  deliveryZones: string[]
  isOpen: boolean
}
