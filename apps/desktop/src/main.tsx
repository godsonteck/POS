import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const money = (pesewas: number) => `GH₵ ${(pesewas / 100).toFixed(2)}`;

type CartLine = PosProduct & { quantity: number };
type User = { id: string; name: string; username: string; role: 'owner' | 'cashier' };

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('owner');
  const [pin, setPin] = useState('1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const user = await window.pos.session.login({ username, pin }); if (!user) setError('Incorrect username or PIN.'); else onLogin(user); }
    catch { setError('Unable to access the local database.'); } finally { setBusy(false); }
  }
  return <div className="login-page"><form className="login-card" onSubmit={submit}><div className="brand-mark large">P</div><p className="eyebrow">RETAIL POS</p><h1>Sign in to your shop</h1><p className="muted">Offline checkout is available even when the internet is down.</p><label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></label><label>PIN<input value={pin} onChange={e => setPin(e.target.value)} inputMode="numeric" type="password" maxLength={8} autoComplete="current-password" /></label>{error && <div className="notice error">{error}</div>}<button className="complete" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span>→</span></button><small className="login-hint">Initial owner account: owner / 1234. Change this PIN before deployment.</small></form></div>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [active, setActive] = useState<'pos' | 'inventory'>('pos');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<'cash' | 'momo'>('cash');
  const [tendered, setTendered] = useState('');
  const [momoReference, setMomoReference] = useState('');
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState<{ receipt: string; total: number } | null>(null);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => { if (!user) return; Promise.all([window.pos.catalog.products(), window.pos.catalog.categories(), window.pos.health()]).then(([p, c, h]) => { setProducts(p); setCategories(c); setPendingSync(h.pendingSync); }); }, [user]);

  const filtered = useMemo(() => products.filter(p => `${p.name} ${p.barcode ?? ''}`.toLowerCase().includes(query.toLowerCase()) && (category === 'All' || p.category === category)), [products, query, category]);
  const total = cart.reduce((sum, line) => sum + line.pricePesewas * line.quantity, 0);
  const cash = Math.round((Number(tendered) || 0) * 100);
  const change = payment === 'cash' ? Math.max(0, cash - total) : 0;

  function add(product: PosProduct) { setCart(current => { const existing = current.find(x => x.id === product.id); if (existing) return current.map(x => x.id === product.id ? { ...x, quantity: Math.min(x.quantity + 1, product.quantityInStock) } : x); return [...current, { ...product, quantity: 1 }]; }); setNotice(''); }
  function changeQty(id: string, delta: number) { setCart(current => current.flatMap(x => { if (x.id !== id) return [x]; const q = x.quantity + delta; return q <= 0 ? [] : q <= x.quantityInStock ? [{ ...x, quantity: q }] : [x]; })); }
  async function completeSale() {
    setNotice('');
    if (!cart.length) return setNotice('Add at least one product to the sale.');
    if (payment === 'cash' && cash < total) return setNotice(`Cash received is ${money(total - cash)} short.`);
    if (payment === 'momo' && !momoReference.trim()) return setNotice('Enter the Mobile Money transaction reference.');
    try {
      const result = await window.pos.sales.checkout({ staffId: user!.id, items: cart.map(x => ({ productId: x.id, quantity: x.quantity })), paymentMethod: payment, amountTenderedPesewas: payment === 'cash' ? cash : total, momoReference: payment === 'momo' ? momoReference.trim() : undefined });
      setSuccess({ receipt: result.receiptNumber, total: result.totalPesewas }); setCart([]); setTendered(''); setMomoReference('');
      const [fresh, health] = await Promise.all([window.pos.catalog.products(), window.pos.health()]); setProducts(fresh); setPendingSync(health.pendingSync);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Sale could not be completed. No changes were committed.'); }
  }

  if (!user) return <Login onLogin={setUser} />;
  const lowStock = products.filter(p => p.quantityInStock <= p.lowStockThreshold);

  return <div className="app"><aside className="sidebar"><div className="brand"><div className="brand-mark">P</div><div><b>Retail POS</b><span>Shop A · Cosmetics & Provisions</span></div></div><nav><button className={active === 'pos' ? 'nav active' : 'nav'} onClick={() => setActive('pos')}><span>⌘</span> Point of Sale</button><button className={active === 'inventory' ? 'nav active' : 'nav'} onClick={() => setActive('inventory')}><span>▦</span> Inventory</button></nav><div className="sidebar-bottom"><div className="sync"><i /><div><b>Offline ready</b><small>{pendingSync ? `${pendingSync} queued for sync` : 'Local database active'}</small></div></div><div className="user"><div className="avatar">{user.name.slice(0,1)}</div><div><b>{user.name}</b><small>{user.role}</small></div><button onClick={() => setUser(null)}>↪</button></div></div></aside><main className="main"><header className="header"><div><span className="crumb">SHOP A / {active.toUpperCase()}</span><h1>{active === 'pos' ? 'Point of Sale' : 'Inventory'}</h1></div><div className="header-actions"><div className="connection"><i /> Offline <span>·</span> {pendingSync ? `${pendingSync} pending sync` : 'Synced'}</div><button className="profile">{user.name.slice(0,1)}</button></div></header>
  {active === 'pos' ? <section className="pos-layout"><div className="catalog"><div className="search-row"><div className="search"><span>⌕</span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search product or scan barcode..."/><kbd>F2</kbd></div></div><div className="categories"><button className={category === 'All' ? 'chip selected' : 'chip'} onClick={() => setCategory('All')}>All</button>{categories.map(c => <button key={c.id} className={category === c.name ? 'chip selected' : 'chip'} onClick={() => setCategory(c.name)}>{c.name}</button>)}</div><div className="product-grid">{filtered.map(p => <button className="product" key={p.id} onClick={() => add(p)} disabled={p.quantityInStock === 0}><div className="product-icon">{p.name.slice(0,1)}</div><div className="product-info"><b>{p.name}</b><small>{p.category ?? 'Uncategorised'}</small><strong>{money(p.pricePesewas)}</strong></div><span className={p.quantityInStock <= p.lowStockThreshold ? 'stock low' : 'stock'}>{p.quantityInStock} left</span></button>)}</div></div><aside className="cart-panel"><div className="cart-head"><div><h2>Current Sale</h2><span>{cart.reduce((n,x) => n + x.quantity, 0)} units</span></div><button className="clear" onClick={() => setCart([])}>Clear</button></div><div className="cart-lines">{!cart.length ? <div className="empty"><div>＋</div><b>Cart is empty</b><span>Scan or select a product to begin</span></div> : cart.map(line => <div className="cart-line" key={line.id}><div className="line-icon">{line.name.slice(0,1)}</div><div className="line-main"><b>{line.name}</b><small>{money(line.pricePesewas)} each</small><div className="qty"><button onClick={() => changeQty(line.id,-1)}>−</button><span>{line.quantity}</span><button onClick={() => changeQty(line.id,1)}>+</button></div></div><strong>{money(line.pricePesewas * line.quantity)}</strong></div>)}</div><div className="checkout"><div className="summary"><span>Subtotal</span><b>{money(total)}</b></div><div className="total"><span>Total</span><b>{money(total)}</b></div><div className="payment-tabs"><button className={payment === 'cash' ? 'pay active' : 'pay'} onClick={() => setPayment('cash')}>Cash</button><button className={payment === 'momo' ? 'pay active' : 'pay'} onClick={() => setPayment('momo')}>Mobile Money</button></div>{payment === 'cash' ? <div className="tender"><label>Cash received</label><input inputMode="decimal" value={tendered} onChange={e => setTendered(e.target.value)} placeholder="0.00"/><span>Change <b>{money(change)}</b></span></div> : <div className="tender"><label>MoMo transaction reference</label><input value={momoReference} onChange={e => setMomoReference(e.target.value)} placeholder="e.g. 1234567890"/></div>}<button className="complete" onClick={completeSale}>Complete Sale <span>→</span></button>{notice && <div className="notice error">{notice}</div>}</div></aside></section> : <section className="page"><div className="metric-row"><div className="metric"><span>Products</span><b>{products.length}</b></div><div className="metric"><span>Low stock</span><b>{lowStock.length}</b></div><div className="metric"><span>Out of stock</span><b>{products.filter(p => p.quantityInStock === 0).length}</b></div></div><div className="panel"><div className="panel-head"><div><h2>Products</h2><span>Live inventory from the local SQLite database</span></div></div><table><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Price</th><th>Stock</th></tr></thead><tbody>{products.map(p => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.barcode ?? '—'}</td><td>{p.category ?? '—'}</td><td>{money(p.pricePesewas)}</td><td><span className={p.quantityInStock <= p.lowStockThreshold ? 'badge danger' : 'badge'}>{p.quantityInStock}</span></td></tr>)}</tbody></table></div></section>}
  </main>{success && <div className="modal-backdrop"><div className="success-card"><div className="success-icon">✓</div><p className="eyebrow">SALE COMPLETED</p><h2>Payment received</h2><strong>{money(success.total)}</strong><span>Receipt {success.receipt}</span><button className="complete" onClick={() => setSuccess(null)}>Done</button></div></div>}</div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
