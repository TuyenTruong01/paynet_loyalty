import { money } from '../utils/format.js';

export default function RevenuePage({ orders }) {
  const paid = orders.filter(order => order.paymentStatus === 'paid' || order.status === 'paid');
  const revenue = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const average = paid.length ? revenue / paid.length : 0;
  const pending = orders.filter(order => order.paymentStatus !== 'paid').length;

  return (
    <section className="page-stack">
      <div className="stats-grid four">
        <article className="stat-card"><span className="green">Total Revenue</span><strong>{money(revenue)}</strong><small>From paid Arc checkouts</small></article>
        <article className="stat-card"><span className="blue">Paid Orders</span><strong>{paid.length}</strong><small>Confirmed invoices</small></article>
        <article className="stat-card"><span className="orange">Average Order</span><strong>{money(average)}</strong><small>Paid order value</small></article>
        <article className="stat-card"><span className="red">Pending</span><strong>{pending}</strong><small>Not confirmed yet</small></article>
      </div>
      <section className="panel full-page-panel">
        <div className="panel-head"><div><p className="eyebrow">Reports</p><h2>Revenue</h2></div></div>
        <table className="data-table">
          <thead><tr><th>No.</th><th>Invoice</th><th>Wallet</th><th>Amount</th><th>Status</th><th>Payment</th></tr></thead>
          <tbody>
            {orders.map((order, index) => <tr key={order.id}><td>{index + 1}</td><td>{order.code}</td><td>{order.customerWallet || '-'}</td><td>{money(order.total)}</td><td><span className={`badge ${order.paymentStatus === 'paid' ? 'ok' : 'warn'}`}>{order.paymentStatus}</span></td><td>Arc USDC</td></tr>)}
            {!orders.length && <tr><td colSpan="6" className="empty-row">No revenue data yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </section>
  );
}
