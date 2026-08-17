import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">RETAIL POS</span>
          <h1>Cosmetics & Provisions</h1>
        </div>
        <div className="status"><span className="dot" /> Offline-ready</div>
      </header>
      <section className="content">
        <div className="card hero">
          <p className="eyebrow">SYSTEM FOUNDATION</p>
          <h2>Fast checkout. Safe stock. No internet dependency.</h2>
          <p>The production POS engine is being built around a local transactional database with an online synchronization layer.</p>
        </div>
        <div className="grid">
          <div className="card"><strong>0</strong><span>Products</span></div>
          <div className="card"><strong>GH₵ 0.00</strong><span>Today's sales</span></div>
          <div className="card"><strong>0</strong><span>Low-stock items</span></div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
