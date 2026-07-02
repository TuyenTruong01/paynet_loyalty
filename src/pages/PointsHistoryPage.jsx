import { formatTime, shortAddress } from '../utils/format.js';

export default function PointsHistoryPage({ pointsHistory }) {
  return (
    <section className="panel full-page-panel">
      <div className="panel-head"><div><p className="eyebrow">Loyalty Ledger</p><h2>Points History</h2></div></div>
      <table className="data-table">
        <thead><tr><th>No.</th><th>Customer Wallet</th><th>Type</th><th>Points</th><th>Balance After</th><th>Note</th><th>Time</th></tr></thead>
        <tbody>
          {pointsHistory.map((row, index) => (
            <tr key={row.id}>
              <td>{index + 1}</td>
              <td>{shortAddress(row.customers?.wallet_address || row.customerWallet || '')}</td>
              <td><span className={`badge ${row.type === 'earn' ? 'ok' : 'warn'}`}>{row.type}</span></td>
              <td>{row.points}</td>
              <td>{row.balance_after ?? row.balanceAfter}</td>
              <td>{row.note}</td>
              <td>{formatTime(row.created_at || row.createdAt)}</td>
            </tr>
          ))}
          {!pointsHistory.length && <tr><td colSpan="7" className="empty-row">No point transactions yet.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
