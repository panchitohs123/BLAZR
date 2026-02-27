"use client"

import { create } from "zustand"
import type { CartItem, CartItemModifier } from "./types"

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, "id">) => void
  removeItem: (id: string) => void
  updateQty: (id: string, quantity: number) => void
  clearCart: () => void
  totalPrice: () => number
  totalItems: () => number
}

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

function getModifiersKey(modifiers: CartItemModifier[]) {
  return modifiers
    .map((m) => `${m.groupId}:${m.optionId}`)
    .sort()
    .join("|")
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item) => {
    const existingItem = get().items.find(
      (i) =>
        i.productId === item.productId &&
        getModifiersKey(i.modifiers) === getModifiersKey(item.modifiers)
    )

    if (existingItem) {
      set({
        items: get().items.map((i) =>
          i.id === existingItem.id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        ),
      })
    } else {
      set({
        items: [...get().items, { ...item, id: generateId() }],
      })
    }
  },

  removeItem: (id) => {
    set({ items: get().items.filter((i) => i.id !== id) })
  },

  updateQty: (id, quantity) => {
    if (quantity <= 0) {
      set({ items: get().items.filter((i) => i.id !== id) })
    } else {
      set({
        items: get().items.map((i) => (i.id === id ? { ...i, quantity } : i)),
      })
    }
  },

  clearCart: () => set({ items: [] }),

  totalPrice: () => {
    return get().items.reduce((total, item) => {
      const modifiersPrice = item.modifiers.reduce((sum, m) => sum + m.price, 0)
      return total + (item.price + modifiersPrice) * item.quantity
    }, 0)
  },

  totalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0)
  },
}))
