import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  History,
  Home,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Star,
  Store,
  Truck,
  Users,
  UserCog,
  Warehouse,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Main',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: Home },
      { key: 'pos', label: 'POS / Checkout', icon: ShoppingCart, tag: 'POS' },
      { key: 'orders', label: 'Orders', icon: ReceiptText },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'staff', label: 'Staff', icon: UserCog },
    ],
  },
  {
    label: 'Loyalty',
    items: [
      { key: 'rewards', label: 'Rewards', icon: Star },
      { key: 'points', label: 'Points History', icon: History },
    ],
  },
  {
    label: 'Products & Stock',
    items: [
      { key: 'products', label: 'Products', icon: Package },
      { key: 'warehouse', label: 'Warehouse', icon: Boxes },
      { key: 'receiving', label: 'Purchase Orders', icon: Truck },
      { key: 'inventory', label: 'Inventory', icon: Warehouse },
    ],
  },
  {
    label: 'Reports',
    items: [
      { key: 'revenue', label: 'Revenue', icon: CircleDollarSign },
      { key: 'best-sellers', label: 'Best Sellers', icon: BarChart3 },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function Sidebar({ page, onPageChange, store }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-mark">A</div>
        <div>
          <strong>ArcPay Loyalty</strong>
          <span>Crypto POS & Loyalty</span>
        </div>
      </div>

      <nav className="sidebar-nav-scroll">
        {navGroups.map(group => (
          <section className="nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map(item => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  className={`nav-item ${page === item.key ? 'active' : ''}`}
                  onClick={() => onPageChange(item.key)}
                  key={item.key}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {item.tag && <em>{item.tag}</em>}
                </button>
              );
            })}
          </section>
        ))}
      </nav>

      <div className="store-fixed-card">
        <Store size={22} />
        <div>
          <strong>{store?.name || 'Minh Chau Grocery'}</strong>
          <span>{store?.branch || 'Da Nang Branch'}</span>
        </div>
      </div>
    </aside>
  );
}
