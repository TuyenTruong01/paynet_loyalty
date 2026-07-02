import { Plus } from 'lucide-react';
import { money } from '../utils/format.js';

export default function InventoryPage({ inventory, products, setEditingProduct, canManage = false }) {
  const rows = inventory?.length ? inventory : products.map(product => ({
    id: product.id,
    productId: product.id,
    name: product.name,
    sku: product.sku,
    costPrice: product.costPrice || 0,
    sellPrice: product.price,
    quantity: product.stock,
    min: product.min,
    warehouse: 'Main Store',
    active: product.active,
    emoji: product.emoji,
  }));

  return (
    <section className="panel full-page-panel">
      <div className="panel-head">
        <div><p className="eyebrow">Stock Control</p><h2>Inventory</h2></div>
        {canManage && <button type="button" onClick={() => setEditingProduct('new')}><Plus size={16} /> Add Product</button>}
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Product</th>
            <th>Product Code</th>
            <th>Cost Price</th>
            <th>Sell Price</th>
            <th>Current Stock</th>
            <th>Minimum Stock</th>
            <th>Warehouse</th>
            <th>Alert</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={item.id || item.productId}>
              <td>{index + 1}</td>
              <td>{item.emoji} {item.name}</td>
              <td>{item.sku}</td>
              <td>{money(item.costPrice)}</td>
              <td>{money(item.sellPrice)}</td>
              <td>{item.quantity}</td>
              <td>{item.min}</td>
              <td>{item.warehouse}</td>
              <td><span className={`badge ${Number(item.quantity) <= Number(item.min) ? 'warn' : 'ok'}`}>{Number(item.quantity) <= Number(item.min) ? 'Reorder' : 'OK'}</span></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="9" className="empty-row">No stock records found.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
