export default function WarehousePage({ warehouses, inventory }) {
  return (
    <section className="panel full-page-panel">
      <div className="panel-head"><div><p className="eyebrow">Stock Locations</p><h2>Warehouse</h2></div></div>
      <table className="data-table">
        <thead><tr><th>No.</th><th>Warehouse</th><th>Address</th><th>Products Stored</th><th>Status</th></tr></thead>
        <tbody>
          {warehouses.map((warehouse, index) => {
            const count = inventory.filter(item => item.warehouse === warehouse.name).length;
            return <tr key={warehouse.id}><td>{index + 1}</td><td>{warehouse.name}</td><td>{warehouse.address || '-'}</td><td>{count}</td><td><span className={`badge ${warehouse.active ? 'ok' : 'bad'}`}>{warehouse.active ? 'Active' : 'Inactive'}</span></td></tr>;
          })}
          {!warehouses.length && <tr><td colSpan="5" className="empty-row">No warehouse locations yet. Inventory can still use the main store as the default stock location.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
