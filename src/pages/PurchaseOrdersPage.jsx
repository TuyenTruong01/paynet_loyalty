import { money, formatTime } from '../utils/format.js';

export default function PurchaseOrdersPage({ purchaseOrders }) {
  return (
    <section className="panel full-page-panel">
      <div className="panel-head"><div><p className="eyebrow">Receiving</p><h2>Purchase Orders</h2></div></div>
      <table className="data-table">
        <thead><tr><th>No.</th><th>PO Code</th><th>Supplier</th><th>Items</th><th>Total Cost</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>
          {purchaseOrders.map((po, index) => <tr key={po.id}><td>{index + 1}</td><td>{po.code}</td><td>{po.supplier}</td><td>{po.items?.length || 0}</td><td>{money(po.total)}</td><td><span className={`badge ${po.status === 'received' ? 'ok' : 'warn'}`}>{po.status}</span></td><td>{formatTime(po.createdAt)}</td></tr>)}
          {!purchaseOrders.length && <tr><td colSpan="7" className="empty-row">No purchase orders yet. This module will be used for supplier restocking and receiving goods.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
