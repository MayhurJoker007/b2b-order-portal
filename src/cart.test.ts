import { describe, expect, it } from 'vitest'
import type { Product, ShippingMethod } from './api'
import { addToCart, canSubmit, lineProblems, nextValidQuantity, removeFromCart, setQuantity, totals } from './cart'

const water: Product = { id: 1, sku: 'WATER', name: 'Water 500ml (24)', price: 96, minimumOrderQuantity: 5, caseSize: 5, inStock: true }
const cola: Product = { id: 2, sku: 'COLA', name: 'Cola 330ml (24)', price: 189.9, minimumOrderQuantity: 2, caseSize: 1, inStock: true }
const chips: Product = { id: 3, sku: 'CHIPS', name: 'Chips', price: 18.99, minimumOrderQuantity: 1, caseSize: 1, inStock: true }
const standard: ShippingMethod = { id: 1, name: 'Standard', leadTimeDays: 3, fee: 250, freeAbove: 5000 }

describe('quantities', () => {
  it('rounds up to the MOQ and whole cases', () => {
    expect(nextValidQuantity(water, 1)).toBe(5)
    expect(nextValidQuantity(water, 7)).toBe(10)
    expect(nextValidQuantity(cola, 1)).toBe(2)
  })

  it('adding starts at the minimum and then adds a case at a time', () => {
    let cart = addToCart({}, water)
    expect(cart.WATER.quantity).toBe(5)
    cart = addToCart(cart, water)
    expect(cart.WATER.quantity).toBe(10)
  })

  it('clearing the quantity keeps the line, removing is explicit', () => {
    const cleared = setQuantity(addToCart({}, water), 'WATER', 0)
    expect(cleared.WATER.quantity).toBe(0)
    expect(lineProblems(cleared.WATER)).toEqual(['Enter a whole number'])
    expect(removeFromCart(cleared, 'WATER')).toEqual({})
  })

  it('explains what is wrong with a line', () => {
    expect(lineProblems({ product: water, quantity: 7 })).toEqual(['Sold in cases of 5'])
    expect(lineProblems({ product: cola, quantity: 1 })).toEqual(['Minimum order is 2'])
    expect(lineProblems({ product: water, quantity: 2.5 })).toEqual(['Enter a whole number'])
    expect(lineProblems({ product: { ...cola, inStock: false }, quantity: 2 })).toEqual(['Out of stock'])
  })
})

describe('totals', () => {
  it('adds money in cents so there is no float drift', () => {
    const sweets = { ...chips, sku: 'SWEETS', price: 1.1 }
    expect(1.1 * 3).not.toBe(3.3)            // the problem
    const cart = { SWEETS: { product: sweets, quantity: 3 } }
    expect(totals(cart, standard, 0).subtotal).toBe(3.3)
  })

  it('charges shipping until the free threshold', () => {
    const small = { COLA: { product: cola, quantity: 10 } }
    expect(totals(small, standard, 0)).toMatchObject({ subtotal: 1899, shipping: 250, total: 2149 })
    const big = { COLA: { product: cola, quantity: 30 } }
    expect(totals(big, standard, 0)).toMatchObject({ subtotal: 5697, shipping: 0, total: 5697 })
  })

  it('reports how far below the minimum order value the cart is', () => {
    const cart = { COLA: { product: cola, quantity: 2 } }
    expect(totals(cart, standard, 1500).belowMinimum).toBe(1120.2)
  })

  it('only allows submitting a valid cart', () => {
    const ok = { COLA: { product: cola, quantity: 10 } }
    expect(canSubmit(ok, totals(ok, standard, 1500), standard)).toBe(true)
    expect(canSubmit(ok, totals(ok, standard, 1500), undefined)).toBe(false)
    const bad = { WATER: { product: water, quantity: 7 }, COLA: { product: cola, quantity: 10 } }
    expect(canSubmit(bad, totals(bad, standard, 0), standard)).toBe(false)
  })
})
