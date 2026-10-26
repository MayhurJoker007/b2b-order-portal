import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { Api } from './api'

type Handler = (body: unknown) => [number, unknown]

/** A tiny fake of the marketplace API, enough to drive the UI. */
function fakeServer(overrides: Record<string, Handler> = {}) {
  const routes: Record<string, Handler> = {
    'POST /api/auth/token': body => (body as { password: string }).password === 'Demo@12345'
      ? [200, { accessToken: 'token-1', expiresUtc: '2030-01-01' }]
      : [401, null],
    'GET /api/distributors': () => [200, [{ id: 1, name: 'Highveld Beverages', country: 'South Africa', currency: 'ZAR', minimumOrderValue: 1500 }]],
    'GET /api/distributors/1/shipping-methods': () => [200, [{ id: 7, name: 'Standard delivery', leadTimeDays: 3, fee: 250, freeAbove: 5000 }]],
    'GET /api/distributors/1/products': () => [200, [
      { id: 1, sku: 'HB-COLA-330', name: 'Cola 330ml can (24)', price: 189.9, minimumOrderQuantity: 2, caseSize: 1, inStock: true },
      { id: 2, sku: 'HB-WATER-500', name: 'Still water 500ml (24)', price: 96, minimumOrderQuantity: 5, caseSize: 5, inStock: true },
      { id: 3, sku: 'HB-ENERGY-250', name: 'Energy drink 250ml (24)', price: 312, minimumOrderQuantity: 1, caseSize: 1, inStock: false },
    ]],
    'GET /api/orders': () => [200, []],
    ...overrides,
  }
  const calls: { method: string; path: string; body: unknown; auth: string | null }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const path = url.split('?')[0]
    const body = init.body ? JSON.parse(init.body as string) : undefined
    calls.push({ method: init.method!, path, body, auth: (init.headers as Record<string, string>).Authorization ?? null })
    const handler = routes[`${init.method} ${path}`]
    const [status, data] = handler ? handler(body) : [404, null]
    return new Response(data === null ? '' : JSON.stringify(data), { status })
  }))
  return calls
}

async function signIn(password = 'Demo@12345') {
  const user = userEvent.setup()
  render(<App api={new Api()} />)
  await user.type(screen.getByLabelText('Username'), 'buyer.mamelodi')
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  return user
}

describe('order portal', () => {
  beforeEach(() => vi.useRealTimers())
  afterEach(() => vi.unstubAllGlobals())

  it('shows a clear message for a wrong password', async () => {
    fakeServer()
    await signIn('wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password')
  })

  it('sends the token and lists products after signing in', async () => {
    const calls = fakeServer()
    await signIn()
    expect(await screen.findByText('Cola 330ml can (24)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Energy drink 250ml (24)' })).toBeDisabled()
    expect(calls.find(c => c.path === '/api/distributors')?.auth).toBe('Bearer token-1')
  })

  it('keeps the order button disabled until the cart meets the minimum', async () => {
    fakeServer()
    const user = await signIn()
    await user.click(await screen.findByRole('button', { name: 'Add Cola 330ml can (24)' }))

    const cart = screen.getByRole('complementary', { name: 'Cart' })
    expect(within(cart).getByLabelText('Quantity of Cola 330ml can (24)')).toHaveValue(2)
    expect(within(cart).getByText(/more to reach this distributor's minimum/)).toBeInTheDocument()
    expect(within(cart).getByRole('button', { name: 'Place order' })).toBeDisabled()

    const qty = within(cart).getByLabelText('Quantity of Cola 330ml can (24)')
    await user.clear(qty)
    await user.type(qty, '10')
    expect(within(cart).getByRole('button', { name: 'Place order' })).toBeEnabled()
  })

  it('warns about case sizes while typing', async () => {
    fakeServer()
    const user = await signIn()
    await user.click(await screen.findByRole('button', { name: 'Add Still water 500ml (24)' }))
    const qty = screen.getByLabelText('Quantity of Still water 500ml (24)')
    await user.clear(qty)
    await user.type(qty, '7')
    expect(screen.getByText('Sold in cases of 5')).toBeInTheDocument()
  })

  it('shows every problem the server reports', async () => {
    const calls = fakeServer({
      'POST /api/orders': () => [422, { title: 'Order rejected', errors: { order: ['HB-COLA-330: only 4 in stock'] } }],
    })
    const user = await signIn()
    await user.click(await screen.findByRole('button', { name: 'Add Cola 330ml can (24)' }))
    const qty = screen.getByLabelText('Quantity of Cola 330ml can (24)')
    await user.clear(qty)
    await user.type(qty, '10')
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    expect(await screen.findByText('HB-COLA-330: only 4 in stock')).toBeInTheDocument()
    expect(calls.find(c => c.path === '/api/orders' && c.method === 'POST')?.body).toEqual({
      distributorId: 1, shippingMethodId: 7, lines: [{ sku: 'HB-COLA-330', quantity: 10 }],
    })
  })

  it('goes to the order list after a successful order', async () => {
    const order = {
      id: 42, distributor: 'Highveld Beverages', outlet: 'Mamelodi', status: 'Submitted', expectedDelivery: '2026-10-19',
      subtotal: 1899, shippingFee: 250, total: 2149,
      lines: [{ sku: 'HB-COLA-330', name: 'Cola 330ml can (24)', quantity: 10, unitPrice: 189.9, lineTotal: 1899 }],
    }
    fakeServer({ 'POST /api/orders': () => [201, order], 'GET /api/orders': () => [200, [order]] })
    const user = await signIn()
    await user.click(await screen.findByRole('button', { name: 'Add Cola 330ml can (24)' }))
    const qty = screen.getByLabelText('Quantity of Cola 330ml can (24)')
    await user.clear(qty)
    await user.type(qty, '10')
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => expect(screen.getByText('#42')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })
})
