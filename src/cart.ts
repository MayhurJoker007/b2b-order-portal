// Cart rules, kept free of React so they're easy to test.
//
// These mirror the API's rules so buyers get feedback while they type. The server still checks everything:
// the cart is a convenience, not the authority.

import type { Product, ShippingMethod } from './api'

export interface CartLine {
  product: Product
  quantity: number
}

export type Cart = Record<string, CartLine> // keyed by SKU

/** Smallest valid quantity at or above `wanted`: at least the MOQ and a whole number of cases. */
export function nextValidQuantity(product: Product, wanted: number): number {
  const atLeast = Math.max(wanted, product.minimumOrderQuantity, 1)
  return Math.ceil(atLeast / product.caseSize) * product.caseSize
}

export function lineProblems(line: CartLine): string[] {
  const { product, quantity } = line
  const problems: string[] = []
  if (!Number.isInteger(quantity) || quantity <= 0) return ['Enter a whole number']
  if (quantity < product.minimumOrderQuantity) problems.push(`Minimum order is ${product.minimumOrderQuantity}`)
  if (quantity % product.caseSize !== 0) problems.push(`Sold in cases of ${product.caseSize}`)
  if (!product.inStock) problems.push('Out of stock')
  return problems
}

export function addToCart(cart: Cart, product: Product): Cart {
  const current = cart[product.sku]?.quantity ?? 0
  const quantity = current === 0 ? nextValidQuantity(product, 1) : current + product.caseSize
  return { ...cart, [product.sku]: { product, quantity } }
}

// An empty or zero quantity keeps the line (the buyer is probably mid-way through retyping it);
// removing a line is a separate, explicit action.
export function setQuantity(cart: Cart, sku: string, quantity: number): Cart {
  if (!cart[sku]) return cart
  return { ...cart, [sku]: { ...cart[sku], quantity } }
}

export function removeFromCart(cart: Cart, sku: string): Cart {
  const rest = { ...cart }
  delete rest[sku]
  return rest
}

/** Integer cents internally, so 3 x 1.10 is 3.30 and not 3.3000000000000003. */
function cents(amount: number) {
  return Math.round(amount * 100)
}

export interface Totals {
  subtotal: number
  shipping: number
  total: number
  belowMinimum: number // how much more to spend to reach the distributor minimum, 0 if reached
}

export function totals(cart: Cart, shipping: ShippingMethod | undefined, minimumOrderValue: number): Totals {
  const subtotalCents = Object.values(cart).reduce((sum, l) => sum + cents(l.product.price) * l.quantity, 0)
  const free = shipping?.freeAbove != null && subtotalCents >= cents(shipping.freeAbove)
  const shippingCents = shipping && !free ? cents(shipping.fee) : 0
  return {
    subtotal: subtotalCents / 100,
    shipping: shippingCents / 100,
    total: (subtotalCents + shippingCents) / 100,
    belowMinimum: Math.max(0, cents(minimumOrderValue) - subtotalCents) / 100,
  }
}

export function canSubmit(cart: Cart, t: Totals, shipping: ShippingMethod | undefined) {
  const lines = Object.values(cart)
  return lines.length > 0 && shipping !== undefined && t.belowMinimum === 0 && lines.every(l => lineProblems(l).length === 0)
}

const formatters: Record<string, Intl.NumberFormat> = {}
export function money(amount: number, currency = 'ZAR') {
  formatters[currency] ??= new Intl.NumberFormat('en-ZA', { style: 'currency', currency })
  return formatters[currency].format(amount)
}
