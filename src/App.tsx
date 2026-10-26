import { useMemo, useState } from 'react'
import { Api, type Order } from './api'
import { Login } from './Login'
import { Orders } from './Orders'
import { Shop } from './Shop'

type View = 'shop' | 'orders'

export default function App({ api: injected }: { api?: Api }) {
  const [user, setUser] = useState<string | null>(null)
  const [view, setView] = useState<View>('shop')
  const [lastOrder, setLastOrder] = useState<Order | null>(null)
  const api = useMemo(() => injected ?? new Api('', () => setUser(null)), [injected])

  if (!user) {
    return <main className="center"><Login api={api} onLoggedIn={setUser} /></main>
  }

  return (
    <>
      <header className="topbar">
        <strong>Order portal</strong>
        <nav>
          <button className={view === 'shop' ? 'active' : ''} onClick={() => setView('shop')}>Shop</button>
          <button className={view === 'orders' ? 'active' : ''} onClick={() => setView('orders')}>My orders</button>
        </nav>
        <span className="muted small">{user}</span>
        <button onClick={() => { api.logout(); setUser(null) }}>Sign out</button>
      </header>
      <main>
        {lastOrder && view === 'shop' && (
          <p className="notice" role="status">
            Order #{lastOrder.id} placed. Expected {new Date(lastOrder.expectedDelivery).toLocaleDateString('en-ZA')}.
          </p>
        )}
        {view === 'shop'
          ? <Shop api={api} onOrderPlaced={o => { setLastOrder(o); setView('orders') }} />
          : <Orders api={api} highlight={lastOrder?.id} />}
      </main>
    </>
  )
}
