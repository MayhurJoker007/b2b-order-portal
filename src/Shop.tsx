import { useEffect, useMemo, useState } from 'react'
import { ApiError, type Api, type Distributor, type Order, type Product, type ShippingMethod } from './api'
import { addToCart, canSubmit, lineProblems, money, removeFromCart, setQuantity, totals, type Cart } from './cart'

export function Shop({ api, onOrderPlaced }: { api: Api; onOrderPlaced: (order: Order) => void }) {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [distributorId, setDistributorId] = useState<number | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [shipping, setShipping] = useState<ShippingMethod[]>([])
  const [shippingId, setShippingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Cart>({})
  const [problems, setProblems] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.distributors().then(list => {
      setDistributors(list)
      if (list.length) setDistributorId(list[0].id)
    }).catch(() => setLoadError('Could not load distributors'))
  }, [api])

  useEffect(() => {
    if (distributorId === null) return
    api.shippingMethods(distributorId).then(methods => {
      setShipping(methods)
      setShippingId(methods[0]?.id ?? null)
    })
  }, [api, distributorId])

  // Debounced search so typing doesn't fire a request per key
  useEffect(() => {
    if (distributorId === null) return
    const timer = setTimeout(() => {
      api.products(distributorId, search).then(setProducts).catch(() => setLoadError('Could not load products'))
    }, 250)
    return () => clearTimeout(timer)
  }, [api, distributorId, search])

  const distributor = distributors.find(d => d.id === distributorId)
  const method = shipping.find(s => s.id === shippingId)
  const t = useMemo(() => totals(cart, method, distributor?.minimumOrderValue ?? 0), [cart, method, distributor])
  const lines = Object.values(cart)
  const currency = distributor?.currency ?? 'ZAR'

  // Switching distributor starts a new cart: an order goes to one distributor only
  function changeDistributor(id: number) {
    setDistributorId(id)
    setCart({})
    setProblems([])
  }

  async function placeOrder() {
    if (!distributor || !method) return
    setSubmitting(true)
    setProblems([])
    try {
      const order = await api.placeOrder(distributor.id, method.id,
        lines.map(l => ({ sku: l.product.sku, quantity: l.quantity })))
      setCart({})
      onOrderPlaced(order)
    } catch (err) {
      // e.g. stock ran out between loading the page and submitting
      setProblems(err instanceof ApiError && err.problems.length ? err.problems : [(err as Error).message])
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) return <p className="error" role="alert">{loadError}</p>

  return (
    <div className="shop">
      <section className="catalogue">
        <div className="toolbar">
          <select aria-label="Distributor" value={distributorId ?? ''} onChange={e => changeDistributor(Number(e.target.value))}>
            {distributors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.country})</option>)}
          </select>
          <input type="search" placeholder="Search products or SKU" aria-label="Search"
                 value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <table>
          <thead>
            <tr><th>Product</th><th className="num">Price</th><th>Ordering</th><th /></tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.sku} className={p.inStock ? '' : 'unavailable'}>
                <td>{p.name}<div className="muted small">{p.sku}</div></td>
                <td className="num">{money(p.price, currency)}</td>
                <td className="muted small">
                  {p.minimumOrderQuantity > 1 && <>min {p.minimumOrderQuantity}</>}
                  {p.minimumOrderQuantity > 1 && p.caseSize > 1 && ' · '}
                  {p.caseSize > 1 && <>cases of {p.caseSize}</>}
                </td>
                <td>
                  <button disabled={!p.inStock} onClick={() => setCart(c => addToCart(c, p))}
                          aria-label={`Add ${p.name}`}>
                    {p.inStock ? 'Add' : 'Out of stock'}
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={4} className="muted">No products found.</td></tr>}
          </tbody>
        </table>
      </section>

      <aside className="card cart" aria-label="Cart">
        <h2>Order</h2>
        {lines.length === 0 && <p className="muted">Nothing added yet.</p>}
        {lines.map(l => {
          const issues = lineProblems(l)
          return (
            <div className="cart-line" key={l.product.sku}>
              <div>
                {l.product.name}
                {issues.map(i => <div key={i} className="warning small">{i}</div>)}
                <button className="link small" onClick={() => setCart(c => removeFromCart(c, l.product.sku))}
                        aria-label={`Remove ${l.product.name}`}>Remove</button>
              </div>
              <input type="number" min={0} step={l.product.caseSize} value={l.quantity || ''}
                     aria-label={`Quantity of ${l.product.name}`} aria-invalid={issues.length > 0}
                     onChange={e => setCart(c => setQuantity(c, l.product.sku, Number(e.target.value)))} />
            </div>
          )
        })}

        {shipping.length > 0 && (
          <label>
            Delivery
            <select value={shippingId ?? ''} onChange={e => setShippingId(Number(e.target.value))}>
              {shipping.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}, {s.leadTimeDays} working day{s.leadTimeDays === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
        )}

        <dl className="totals">
          <dt>Subtotal</dt><dd>{money(t.subtotal, currency)}</dd>
          <dt>Delivery</dt><dd>{t.shipping === 0 && lines.length ? 'Free' : money(t.shipping, currency)}</dd>
          <dt className="strong">Total</dt><dd className="strong">{money(t.total, currency)}</dd>
        </dl>
        {lines.length > 0 && t.belowMinimum > 0 && (
          <p className="warning small">Add {money(t.belowMinimum, currency)} more to reach this distributor's minimum order.</p>
        )}
        {problems.length > 0 && (
          <ul className="error" role="alert">{problems.map(p => <li key={p}>{p}</li>)}</ul>
        )}
        <button className="primary" disabled={!canSubmit(cart, t, method) || submitting} onClick={placeOrder}>
          {submitting ? 'Placing order…' : 'Place order'}
        </button>
      </aside>
    </div>
  )
}
