import { useEffect, useState } from 'react'
import { ApiError, type Api, type Order } from './api'
import { money } from './cart'

const STATUS_LABEL: Record<Order['status'], string> = {
  Submitted: 'Submitted',
  SentToErp: 'With distributor',
  Confirmed: 'Confirmed',
  Cancelled: 'Cancelled',
}

export function Orders({ api, highlight }: { api: Api; highlight?: number }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.orders().then(setOrders).catch(() => setError('Could not load orders'))
  }, [api])

  async function cancel(id: number) {
    if (!window.confirm('Cancel this order? The stock goes back to the distributor.')) return
    try {
      const updated = await api.cancelOrder(id)
      setOrders(list => list?.map(o => (o.id === id ? updated : o)) ?? null)
    } catch (err) {
      setError(err instanceof ApiError && err.problems.length ? err.problems[0] : 'Could not cancel the order')
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>
  if (!orders) return <p className="muted">Loading…</p>
  if (!orders.length) return <p className="muted">No orders yet.</p>

  return (
    <div className="orders">
      {orders.map(o => (
        <article key={o.id} className={`card order ${o.id === highlight ? 'new' : ''}`}>
          <header>
            <strong>#{o.id}</strong> {o.distributor}
            <span className={`badge ${o.status.toLowerCase()}`}>{STATUS_LABEL[o.status]}</span>
          </header>
          <p className="muted small">
            {o.status === 'Cancelled' ? 'Cancelled' : `Expected ${new Date(o.expectedDelivery).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}`}
          </p>
          <ul>
            {o.lines.map(l => <li key={l.sku}>{l.quantity} × {l.name} <span className="num">{money(l.lineTotal)}</span></li>)}
          </ul>
          <footer>
            <strong>{money(o.total)}</strong>
            {o.status === 'Submitted' && <button onClick={() => cancel(o.id)}>Cancel</button>}
          </footer>
        </article>
      ))}
    </div>
  )
}
