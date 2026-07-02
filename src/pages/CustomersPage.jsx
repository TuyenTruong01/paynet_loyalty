import { formatTime, money, shortAddress } from '../utils/format.js';

export default function CustomersPage({ customers }) {
  const sorted = [...customers].sort((a, b) => Number(b.totalSpent || 0) - Number(a.totalSpent || 0));

  return (
    <section className="panel full-page-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Wallet Loyalty</p>
          <h2>Customers</h2>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Wallet Address</th>
            <th>Loyalty Points</th>
            <th>Total Spent</th>
            <th>Last Activity</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((customer, index) => (
            <tr key={customer.id}>
              <td>{index + 1}</td>
              <td><code title={customer.wallet}>{shortAddress(customer.wallet)}</code></td>
              <td><strong>{Number(customer.points || 0).toLocaleString('en-US')} pts</strong></td>
              <td>{money(customer.totalSpent)}</td>
              <td>{formatTime(customer.createdAt)}</td>
              <td><button type="button" className="small-action">View History</button></td>
            </tr>
          ))}
          {!customers.length && <tr><td colSpan="6" className="empty-row">No wallet customers found.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
