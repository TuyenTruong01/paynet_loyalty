import { Save, Upload, X } from 'lucide-react';
import { useState } from 'react';

export default function ProductModal({ product, categories, onClose, onSave }) {
  const [draft, setDraft] = useState(product && product !== 'new' ? product : {
    name: 'New Product',
    sku: `SKU-${Date.now().toString().slice(-5)}`,
    barcode: '',
    category: categories.find(c => c !== 'All') || 'Other',
    unit: 'unit',
    price: 10000,
    costPrice: 7000,
    stock: 10,
    min: 5,
    description: '',
    active: true,
    emoji: '🛒',
    image: '',
  });

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft(current => ({ ...current, image: reader.result }));
    reader.readAsDataURL(file);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="panel-head">
          <h2>{product === 'new' ? 'Add Product' : 'Edit Product'}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label>Product Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Product Code / SKU<input value={draft.sku} onChange={event => setDraft({ ...draft, sku: event.target.value })} /></label>
          <label>Barcode / QR Code<input value={draft.barcode || ''} onChange={event => setDraft({ ...draft, barcode: event.target.value })} /></label>
          <label>Category<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Unit<input value={draft.unit || 'unit'} onChange={event => setDraft({ ...draft, unit: event.target.value })} /></label>
          <label>Sell Price<input type="number" value={draft.price} onChange={event => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
          <label>Cost / Import Price<input type="number" value={draft.costPrice || 0} onChange={event => setDraft({ ...draft, costPrice: Number(event.target.value) })} /></label>
          <label>Stock<input type="number" value={draft.stock} onChange={event => setDraft({ ...draft, stock: Number(event.target.value) })} /></label>
          <label>Minimum Stock<input type="number" value={draft.min} onChange={event => setDraft({ ...draft, min: Number(event.target.value) })} /></label>
          <label>Status<select value={draft.active === false ? 'inactive' : 'active'} onChange={event => setDraft({ ...draft, active: event.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label>Emoji<input value={draft.emoji} onChange={event => setDraft({ ...draft, emoji: event.target.value })} /></label>
          <label>Image URL<input value={draft.image} onChange={event => setDraft({ ...draft, image: event.target.value })} /></label>
        </div>
        <label>Description<textarea value={draft.description || ''} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
        <label className="upload-label"><Upload size={16} /> Upload Image<input type="file" accept="image/*" onChange={handleFile} /></label>
        <button className="primary full" type="button" onClick={() => onSave(draft)}><Save size={16} /> Save Product</button>
      </div>
    </div>
  );
}
