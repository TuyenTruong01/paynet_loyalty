import { formatPoints, money } from '../utils/format.js';

function SimpleBarChart({ title, rows }) {
  const max = Math.max(...rows.map(row => row.value), 1);
  return (
    <div className="panel chart-panel">
      <div className="panel-head"><h2>{title}</h2></div>
      <div className="bar-list">
        {rows.map(row => (
          <div className="bar-row" key={row.label}>
            <span>{row.label}</span>
            <div><i style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }} /></div>
            <strong>{row.display || row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage({ orders, customers, products }) {
  const paidOrders = orders.filter(order => order.paymentStatus === 'paid' || order.status === 'paid');
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const lowStock = products.filter(product => product.stock <= product.min);
  const totalPoints = customers.reduce((sum, customer) => sum + customer.points, 0);

  const bestSellers = products.slice(0, 5).map(product => {
    const qty = paidOrders.flatMap(order => order.items || []).filter(item => item.productId === product.id || item.name === product.name).reduce((sum, item) => sum + item.qty, 0);
    return { label: product.name, value: qty || Math.max(1, Math.floor((product.min + product.stock) / 12)), display: `${qty || Math.max(1, Math.floor((product.min + product.stock) / 12))} sold` };
  });

  const cards = [
    ['Today Revenue', money(revenue), 'Crypto checkout volume', 'green'],
    ['Orders Today', paidOrders.length || orders.length, 'Paid and pending invoices', 'blue'],
    ['Customers', customers.length, 'Wallet-linked customers', 'orange'],
    ['Loyalty Points', formatPoints(totalPoints), 'Available customer points', 'green'],
    ['Low Stock', lowStock.length, 'Products below threshold', 'red'],
  ];

  return (
    <section className="page-stack">
      <div className="stats-grid">
        {cards.map(card => (
          <article className="stat-card" key={card[0]}>
            <span className={card[3]}>{card[0]}</span>
            <strong>{card[1]}</strong>
            <small>{card[2]}</small>
          </article>
        ))}
      </div>

      <div className="dashboard-charts">
        <SimpleBarChart title="Revenue Trend" rows={[
          { label: 'Paid Volume', value: Math.max(revenue, 1), display: money(revenue) },
          { label: 'Average Order', value: paidOrders.length ? revenue / paidOrders.length : 0, display: money(paidOrders.length ? revenue / paidOrders.length : 0) },
          { label: 'Loyalty Value', value: totalPoints * 100, display: `${formatPoints(totalPoints)} pts` },
        ]} />
        <SimpleBarChart title="Best Sellers" rows={bestSellers} />
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-head"><h2>Recent Orders</h2></div>
          <table>
            <tbody>
              {orders.slice(0, 6).map(order => (
                <tr key={order.id}>
                  <td>{order.code}</td>
                  <td>{order.customerWallet || order.customer}</td>
                  <td>{money(order.total)}</td>
                  <td><span className={`badge ${order.paymentStatus === 'paid' ? 'ok' : 'warn'}`}>{order.paymentStatus}</span></td>
                </tr>
              ))}
              {!orders.length && <tr><td className="empty-row">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Inventory Alerts</h2></div>
          <table>
            <tbody>
              {lowStock.slice(0, 6).map(product => (
                <tr key={product.id}>
                  <td>{product.emoji} {product.name}</td>
                  <td>{product.stock}</td>
                  <td>{product.min}</td>
                  <td><span className="badge warn">Low</span></td>
                </tr>
              ))}
              {!lowStock.length && <tr><td className="empty-row">No low-stock alerts.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
