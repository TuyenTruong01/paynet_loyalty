import {
  BarChart3,
  Boxes,
  Building2,
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

function buildNavGroups(isSystemAdmin, isLimitedGuest = false) {
  const mainItems = [
    { key: 'dashboard', label: 'Dashboard', icon: Home },
    ...(!isLimitedGuest ? [
      { key: 'pos', label: 'POS / Checkout', icon: ShoppingCart, tag: 'POS' },
      { key: 'orders', label: 'Orders', icon: ReceiptText },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'staff', label: 'Staff', icon: UserCog },
    ] : []),
  ];

  return [
    ...(isSystemAdmin ? [{
      label: 'Network',
      items: [
        { key: 'admin', label: 'System Admin', icon: Building2, tag: 'HQ' },
      ],
    }] : []),
    {
      label: 'Main',
      items: mainItems,
    },
    ...(isLimitedGuest ? [] : [
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
    ]),
  ];
}

export default function Sidebar({
  page,
  onPageChange,
  store,
  stores = [],
  selectedStoreId,
  onStoreChange,
  isSystemAdmin = false,
  isGuest = false,
  connected = false,
  demoMode = false,
}) {
  const limitedGuest = !connected && !demoMode;
  const navGroups = isGuest ? [] : buildNavGroups(isSystemAdmin, limitedGuest);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-mark image-logo">
          <img src="/png/logo/paynet-logo.png" alt="Paynet" />
        </div>
        <div>
          <strong>Paynet</strong>
          <span>APoint Loyalty</span>
        </div>
      </div>

      {(isSystemAdmin || demoMode) && !isGuest && stores.length > 0 && (
        <div className="sidebar-store-switcher">
          <span>Active store view</span>
          <select value={selectedStoreId || ''} onChange={event => onStoreChange?.(event.target.value)}>
            {stores.map(item => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="sidebar-nav-scroll">
        {isGuest && (
          <section className="nav-group">
            <p>Access</p>
            <button type="button" className="nav-item active">
              <Users size={17} />
              <span>No whitelist role</span>
            </button>
          </section>
        )}
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
          <strong>{isGuest ? 'Guest wallet' : store?.name || 'Select a store'}</strong>
          <span>{isGuest ? 'No store access' : store?.branch || 'Network view'}</span>
        </div>
      </div>
    </aside>
  );
}
