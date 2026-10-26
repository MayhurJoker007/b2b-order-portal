// Typed client for b2b-marketplace-api. Shapes mirror the API's DTOs.

export interface Distributor {
  id: number
  name: string
  country: string
  currency: string
  minimumOrderValue: number
}

export interface Product {
  id: number
  sku: string
  name: string
  price: number
  minimumOrderQuantity: number
  caseSize: number
  inStock: boolean
}

export interface ShippingMethod {
  id: number
  name: string
  leadTimeDays: number
  fee: number
  freeAbove: number | null
}

export interface OrderLine {
  sku: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface Order {
  id: number
  distributor: string
  outlet: string
  status: 'Submitted' | 'SentToErp' | 'Confirmed' | 'Cancelled'
  expectedDelivery: string
  subtotal: number
  shippingFee: number
  total: number
  lines: OrderLine[]
}

/** The API rejects orders with a 422 listing every problem; keep them all so the cart can show each one. */
export class ApiError extends Error {
  readonly status: number
  readonly problems: string[]

  constructor(status: number, message: string, problems: string[] = []) {
    super(message)
    this.status = status
    this.problems = problems
  }
}

export class Api {
  private token: string | null = null
  private readonly base: string
  private readonly onUnauthorized: () => void

  constructor(base = '', onUnauthorized: () => void = () => {}) {
    this.base = base
    this.onUnauthorized = onUnauthorized
  }

  get loggedIn() {
    return this.token !== null
  }

  async login(username: string, password: string) {
    const res = await this.request<{ accessToken: string }>('POST', '/api/auth/token', { username, password })
    this.token = res.accessToken
  }

  logout() {
    this.token = null
  }

  distributors = () => this.request<Distributor[]>('GET', '/api/distributors')
  products = (distributorId: number, search = '') =>
    this.request<Product[]>('GET', `/api/distributors/${distributorId}/products?search=${encodeURIComponent(search)}`)
  shippingMethods = (distributorId: number) =>
    this.request<ShippingMethod[]>('GET', `/api/distributors/${distributorId}/shipping-methods`)
  orders = () => this.request<Order[]>('GET', '/api/orders')
  placeOrder = (distributorId: number, shippingMethodId: number, lines: { sku: string; quantity: number }[]) =>
    this.request<Order>('POST', '/api/orders', { distributorId, shippingMethodId, lines })
  cancelOrder = (id: number) => this.request<Order>('POST', `/api/orders/${id}/cancel`)

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (this.token) headers.Authorization = `Bearer ${this.token}`

    let res: Response
    try {
      res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    } catch {
      throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
    }

    if (res.status === 401 && this.token) {
      // Token expired mid-session: drop it and send the user back to the login screen
      this.token = null
      this.onUnauthorized()
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const problems: string[] = data?.errors ? Object.values(data.errors as Record<string, string[]>).flat() : []
      const message = res.status === 401 ? 'Wrong username or password' : (data?.title ?? `Request failed (${res.status})`)
      throw new ApiError(res.status, message, problems)
    }
    return (await res.json()) as T
  }
}
