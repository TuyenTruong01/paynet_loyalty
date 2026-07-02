import { Pencil, Plus, Trash2 } from 'lucide-react';
import { money } from '../utils/format.js';

export default function ProductGrid({ products, categories, activeCategory, setActiveCategory, query, onAdd, onEdit, onDelete, canManage = false }) {
  const normalized = query.trim().toLowerCase();
  const list = products.filter(product => {
    const categoryOk = activeCategory === 'All' || product.category === activeCategory;
    const searchOk = !normalized || [product.name, product.sku, product.barcode].join(' ').toLowerCase().includes(normalized);
    return categoryOk && searchOk;
  });

  return (
    <section className="panel product-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Quick Add</p>
          <h2>Featured Products</h2>
        </div>
        {canManage && <button type="button" onClick={() => onEdit('new')}><Plus size={16} /> Add Product</button>}
      </div>

      <div className="tabs">
        {categories.map(category => (
          <button
            type="button"
            className={activeCategory === category ? 'selected' : ''}
            onClick={() => setActiveCategory(category)}
            key={category}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="product-grid">
        {list.map(product => (
          <article className="product-card" key={product.id} onClick={() => onAdd(product)}>
            <div className="product-image">
              {product.image ? <img src={product.image} alt="" /> : <span>{product.emoji}</span>}
            </div>
            <h3>{product.name}</h3>
            <strong>{money(product.price)}</strong>
            <p>Stock: {product.stock}</p>
            {canManage && (
              <div className="product-actions" onClick={event => event.stopPropagation()}>
                <button type="button" onClick={() => onEdit(product)}><Pencil size={15} /></button>
                <button type="button" className="danger" onClick={() => onDelete(product.id)}><Trash2 size={15} /></button>
              </div>
            )}
          </article>
        ))}
        {canManage && (
          <button className="add-product-card" type="button" onClick={() => onEdit('new')}>
            <Plus size={42} />
            Add New Product
          </button>
        )}
      </div>
    </section>
  );
}
