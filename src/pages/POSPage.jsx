import POSPanel from '../components/POSPanel.jsx';
import ProductGrid from '../components/ProductGrid.jsx';

export default function POSPage(props) {
  return (
    <section className="page-stack">
      <POSPanel {...props} />
      <ProductGrid
        products={props.products}
        categories={props.categories}
        activeCategory={props.activeCategory}
        setActiveCategory={props.setActiveCategory}
        query={props.query}
        onAdd={props.addToCart}
        onEdit={props.setEditingProduct}
        onDelete={props.deleteProduct}
        canManage={props.canManage}
      />
    </section>
  );
}
