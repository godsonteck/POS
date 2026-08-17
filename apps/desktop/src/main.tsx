import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Product = { id: string; name: string; category: string; barcode: string; price: number; stock: number };
type CartLine = Product & { quantity: number };

const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Cantu Shea Butter Cream', category: 'Hair Care', barcode: '817513010124', price: 55, stock: 12 },
  { id: 'p2', name: 'Vaseline Cocoa Radiant', category: 'Skin Care', barcode: '8712561267075', price: 38, stock: 24 },
  { id: 'p3', name: 'Nivea Soft Moisturiser', category: 'Skin Care', barcode: '4005900380742', price: 42, stock: 7 },
  { id: 'p4', name: 'Milo 400g', category: 'Provisions', barcode: '7613032230700', price: 32, stock: 31 },
  { id: 'p5', name: 'Ideal Milk 160g', category: 'Provisions', barcode: '8716200220134', price: 8.5, stock: 4 },
  { id: 'p6', name: 'Closeup Toothpaste 120ml', category: 'Personal Care', barcode: '8717163705632', price: 21, stock: 9 },
  { id: 'p7', name: 'Ghana Mixed Biscuits', category: 'Snacks', barcode: '000000000007', price: 12, stock: 18 },
  { id: 'p8', name: 'Imperial Leather Soap', category: 'Personal Care', barcode: '5000108024680', price: 14, stock: 3 },
];

const money = (amount: number) => `GH₵ ${amount.toFixed(2)}`;

function App() {
  const [active, setActive] = useState<'pos' | 'sales' | 'inventory'>('pos');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<'cash' | 'momo'>('cash');
  const [tendered, setTendered] = useState('');
  const [notice, setNotice] = useState('');

  const categories = ['All', ...new Set(PRODUCTS.map((p) => p.category))];
  const filtered = useMemo(() => PRODUCTS.filter((p) => {
    const matchesQuery = `${p.name} ${p.barcode}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === 'All' || p.category === category);
  }), [query, category]);

  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const cash = Number(tendered) || 0;
  const change = payment === 'cash' ? Math.max(0, cash - total) : 0;

  function add(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) return current.map((line) => line.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, product.stock) } : line);
      return [...current, { ...product, quantity: 1 }];
    });
    setNotice('');
  }

  function changeQty(id: string, delta: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.id !== id) return [line];
      const quantity = line.quantity + delta;
      return quantity > 0 && quantity <= line.stock ? [{ ...line, quantity }] : quantity <= 0 ? [] : [line];
    }));
  }

  function completeSale() {
    if (!cart.length) return setNotice('Add at least one product to the sale.');
    if (payment === 'cash' && cash < total) return setNotice(`Cash received is ${money(total - cash)} short.`);
    if (payment === 'momo') return setNotice('MoMo reference capture will be connected to the transactional checkout service next.');
    setNotice(`Sale ready to commit: ${money(total)} cash, change ${money(change)}.`);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">P</div><div><b>Retail POS</b><span>Shop A · Offline-first</span></div></div>
        <nav>
          <button className={active === 'pos' ? 'nav active' : 'nav'} onClick={() => setActive('pos')}><span>⌘</span> Point of Sale</button>
          <button className={active === 'sales' ? 'nav active' : 'nav'} onClick={() => setActive('sales')}><span>▤</span> Sales</button>
          <button className={active === 'inventory' ? 'nav active' : 'nav'} onClick={() => setActive('inventory')}><span>▦</span> Inventory</button>
        </nav>
        <div className="sidebar-bottom"><div className="sync"><i /> <div><b>Offline ready</b><small>Local database active</small></div></div><div className="user"><div className="avatar">M</div><div><b>Owner</b><small>Administrator</small></div><button>⋮</button></div></div>
      </aside>
      <main className="main">
        <header className="header"><div><span className="crumb">SHOP A / {active.toUpperCase()}</span><h1>{active === 'pos' ? 'Point of Sale' : active === 'sales' ? 'Sales History' : 'Inventory'}</h1></div><div className="header-actions"><div className="connection"><i /> Offline <span>·</span> Sync queue ready</div><button className="icon-btn">?</button><button className="profile">M</button></div></header>
        {active === 'pos' && <section className="pos-layout">
          <div className="catalog">
            <div className="search-row"><div className="search"><span>⌕</span><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product or scan barcode..."/><kbd>F2</kbd></div><button className="scan">▣ Scan</button></div>
            <div className="categories">{categories.map((item) => <button key={item} className={category === item ? 'chip selected' : 'chip'} onClick={() => setCategory(item)}>{item}</button>)}</div>
            <div className="product-grid">{filtered.map((product) => <button className="product" key={product.id} onClick={() => add(product)} disabled={product.stock === 0}><div className="product-icon">{product.name.slice(0, 1)}</div><div className="product-info"><b>{product.name}</b><small>{product.category}</small><strong>{money(product.price)}</strong></div><span className={product.stock <= 5 ? 'stock low' : 'stock'}>{product.stock} left</span></button>)}</div>
          </div>
          <aside className="cart-panel">
            <div className="cart-head"><div><h2>Current Sale</h2><span>{cart.length} item{cart.length === 1 ? '' : 's'}</span></div><button className="clear" onClick={() => setCart([])}>Clear</button></div>
            <div className="cart-lines">{cart.length === 0 ? <div className="empty"><div>＋</div><b>Cart is empty</b><span>Scan or select a product to begin</span></div> : cart.map((line) => <div className="cart-line" key={line.id}><div className="line-icon">{line.name.slice(0, 1)}</div><div className="line-main"><b>{line.name}</b><small>{money(line.price)} each</small><div className="qty"><button onClick={() => changeQty(line.id, -1)}>−</button><span>{line.quantity}</span><button onClick={() => changeQty(line.id, 1)}>+</button></div></div><strong>{money(line.price * line.quantity)}</strong></div>)}</div>
            <div className="checkout"><div className="summary"><span>Subtotal</span><b>{money(total)}</b></div><div className="summary"><span>Discount</span><b>{money(0)}</b></div><div className="total"><span>Total</span><b>{money(total)}</b></div><div className="payment-tabs"><button className={payment === 'cash' ? 'pay active' : 'pay'} onClick={() => setPayment('cash')}>Cash</button><button className={payment === 'momo' ? 'pay active' : 'pay'} onClick={() => setPayment('momo')}>Mobile Money</button></div>{payment === 'cash' && <div className="tender"><label>Cash received</label><input inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder="0.00"/><span>Change <b>{money(change)}</b></span></div>}{payment === 'momo' && <div className="momo-note">MoMo reference will be required before final commit.</div>}<button className="complete" onClick={completeSale}>Complete Sale <span>→</span></button>{notice && <div className="notice">{notice}</div>}</div>
          </aside>
        </section>}
        {active === 'sales' && <section className="page"><div className="metric-row"><div className="metric"><span>Today's sales</span><b>{money(0)}</b></div><div className="metric"><span>Cash</span><b>{money(0)}</b></div><div className="metric"><span>Mobile Money</span><b>{money(0)}</b></div><div className="metric"><span>Transactions</span><b>0</b></div></div><div className="panel"><div className="panel-head"><div><h2>Sales history</h2><span>Transactions recorded locally and queued for sync</span></div><button className="outline">Export</button></div><div className="empty-table">No completed sales yet.</div></div></section>}
        {active === 'inventory' && <section className="page"><div className="metric-row"><div className="metric"><span>Products</span><b>{PRODUCTS.length}</b></div><div className="metric"><span>Low stock</span><b>{PRODUCTS.filter((p) => p.stock <= 5).length}</b></div><div className="metric"><span>Out of stock</span><b>0</b></div></div><div className="panel"><div className="panel-head"><div><h2>Products</h2><span>Inventory is maintained locally for uninterrupted checkout</span></div><button className="primary">+ Add product</button></div><table><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Price</th><th>Stock</th></tr></thead><tbody>{PRODUCTS.map((p) => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.barcode}</td><td>{p.category}</td><td>{money(p.price)}</td><td><span className={p.stock <= 5 ? 'badge danger' : 'badge'}>{p.stock}</span></td></tr>)}</tbody></table></div></section>}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
