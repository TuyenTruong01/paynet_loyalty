import { money } from '../utils/format.js';

export default function BestSellersPage({ orders, products }) {
  const itemMap = new Map();
  orders.forEach(order => {
    if (!(order.paymentStatus === 'paid' || order.status === 'paid')) return;
    (order.items || []).forEach(item => {
      const key = item.productId || item.name;
      const current = itemMap.get(key) || { product: item.name, sku: item.sku, qty: 0, revenue: 0 };
      current.qty += Number(item.qty || 0);
      current.revenue += Number(item.total || 0);
      itemMap.set(key, current);
    });
  });

  const rows = [...itemMap.values()].sort((a, b) => b.qty - a.qty);
  const fallback = products.slice(0, 8).map((product, index) => ({ product: product.name, sku: product.sku, qty: Math.max(1, Math.floor((product.stock + product.min) / 12)), revenue: product.price * Math.max(1, Math.floor((product.stock + product.min) / 12)), fallback: true }));
  const displayRows = rows.length ? rows : fallback;

  return (
    <section className="panel full-page-panel">
      <div className="panel-head"><div><p className="eyebrow">Reports</p><h2>Best Sellers</h2></div></div>
      <table className="data-table">
        <thead><tr><th>Rank</th><th>Product</th><th>Code</th><th>Quantity Sold</th><th>Revenue</th><th>Source</th></tr></thead>
        <tbody>
          {displayRows.map((row, index) => <tr key={`${row.product}-${index}`}><td>{index + 1}</td><td>{row.product}</td><td>{row.sku}</td><td>{row.qty}</td><td>{money(row.revenue)}</td><td><span className={`badge ${row.fallback ? 'warn' : 'ok'}`}>{row.fallback ? 'Demo estimate' : 'Order items'}</span></td></tr>)}
          {!displayRows.length && <tr><td colSpan="6" className="empty-row">No best-seller data yet.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
