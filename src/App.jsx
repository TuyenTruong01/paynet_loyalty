import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import ProductModal from './components/ProductModal.jsx';
import Sidebar from './components/Sidebar.jsx';
import StatusBanner from './components/StatusBanner.jsx';
import BestSellersPage from './pages/BestSellersPage.jsx';
import CustomerCheckoutPage from './pages/CustomerCheckoutPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import POSPage from './pages/POSPage.jsx';
import PointsHistoryPage from './pages/PointsHistoryPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage.jsx';
import RevenuePage from './pages/RevenuePage.jsx';
import RewardsPage from './pages/RewardsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import StaffPage from './pages/StaffPage.jsx';
import SystemAdminPage from './pages/SystemAdminPage.jsx';
import WarehousePage from './pages/WarehousePage.jsx';
import { connectEvmWallet } from './services/evmWallet.js';
import { getPaymentChain } from './chains/index.js';
import {
  addWarehouseRecord,
  confirmCheckoutPayment,
  createCheckoutOrder,
  createStoreRecord,
  disableStaffRecord,
  loadCheckoutPaymentStatus,
  loadPaynetNetwork,
  saveProductRecord,
  saveStaffRecord,
  updateProductStatusRecord,
  updateStoreOwnerRecord,
  updateStoreRecord,
  updateStoreStatusRecord,
  updateWarehouseStatusRecord,
} from './services/paynetService.js';
import { hasSupabaseConfig } from './lib/supabaseClient.js';
import { pointsFromRaw, rawFromPoints } from './utils/format.js';
import {
  applyRoleAccessToStores,
  buildStoreState,
  initialNetworkStores,
  normalizeWallet,
  roleAccessConfig,
  resolveNetworkRole,
} from './utils/storeNetwork.js';

function firstActiveStore(stores = []) {
  return stores.find(store => store.status !== 'disabled') || stores[0] || null;
}

function titleCaseRole(role = 'cashier') {
  return role === 'owner' ? 'Owner' : role.charAt(0).toUpperCase() + role.slice(1);
}

function isStoreOwnerRole(roleKey = '') {
  return ['store_owner', 'owner'].includes(roleKey);
}

function connectChainCode(store = {}) {
  const code = String(store?.networkCode || '').toLowerCase();
  if (code.includes('arc')) return 'arc-testnet';
  if (code.includes('avalanche') || code.includes('fuji') || code.includes('avax')) return 'avalanche';
  return code || 'arc-testnet';
}

function ensureStoreProducts(store) {
  return Array.isArray(store?.products) ? store.products : [];
}

function slugifyStoreName(name = '') {
  return String(name || 'new-store')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-store';
}

const STAFF_ALLOWED_PAGES = ['pos', 'orders', 'customers', 'inventory'];
const OWNER_ALLOWED_PAGES = [
  'dashboard',
  'pos',
  'orders',
  'customers',
  'staff',
  'products',
  'inventory',
  'points',
  'rewards',
  'warehouse',
  'receiving',
  'revenue',
  'best-sellers',
  'settings',
];
const SYSTEM_ADMIN_ALLOWED_PAGES = ['admin', ...OWNER_ALLOWED_PAGES];
const CHECKOUT_STORAGE_KEY = 'paynet.pendingCheckouts';

function readStoredCheckouts() {
  try {
    return JSON.parse(window.localStorage.getItem(CHECKOUT_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredCheckout(order) {
  const current = readStoredCheckouts().filter(item => item.checkoutToken !== order.checkoutToken);
  window.localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify([order, ...current].slice(0, 80)));
}

export default function App() {
  const [page, setPage] = useState('admin');
  const [query, setQuery] = useState('');
  const [stores, setStores] = useState(() => applyRoleAccessToStores(initialNetworkStores));
  const [networkCustomers, setNetworkCustomers] = useState([]);
  const [networkPointsHistory, setNetworkPointsHistory] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(initialNetworkStores[0]?.id || '');
  const [connected, setConnected] = useState(false);
  const [currentWallet, setCurrentWallet] = useState('');
  const [dbMessage, setDbMessage] = useState('Frontend multi-store mode. Supabase schema can be connected after the UI is approved.');

  const [invoiceActive, setInvoiceActive] = useState(false);
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('C001');
  const [activeCategory, setActiveCategory] = useState('All');
  const [productSearch, setProductSearch] = useState('');
  const [pointsUsed, setPointsUsed] = useState(0);
  const [checkout, setCheckout] = useState(null);
  const [checkoutPayment, setCheckoutPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [editingProduct, setEditingProduct] = useState(null);

  async function reloadNetwork() {
    if (!hasSupabaseConfig) {
      setDbMessage('Supabase is not configured. Using local demo data.');
      return;
    }

    try {
      const result = await loadPaynetNetwork();
      if (result?.stores?.length) {
        const accessStores = applyRoleAccessToStores(result.stores, roleAccessConfig);
        setStores(accessStores);
        setNetworkCustomers(result.customers || []);
        setNetworkPointsHistory(result.pointsHistory || []);
        setSelectedStoreId(current => accessStores.some(store => store.id === current) ? current : accessStores[0].id);
        setDbMessage(`Connected to Supabase. Loaded ${accessStores.length} stores.`);
      }
    } catch (error) {
      console.error(error);
      setDbMessage(`Supabase error: ${error.message || error}. Using local fallback data.`);
    }
  }

  useEffect(() => {
    reloadNetwork();
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !checkout?.order_id) {
      return undefined;
    }

    let cancelled = false;
    let timer = null;

    async function refreshCheckoutPayment() {
      try {
        const status = await loadCheckoutPaymentStatus(checkout.order_id);
        if (cancelled || !status) return;

        setCheckoutPayment(status);

        if (status.paymentStatus === 'paid' || status.status === 'paid') {
          setPaymentStatus('paid');
          if (timer) window.clearInterval(timer);
          await reloadNetwork();
          return;
        }

        setPaymentStatus('pending');
      } catch (error) {
        console.warn('Cannot refresh checkout payment status:', error.message || error);
        if (!cancelled) setPaymentStatus('pending');
      }
    }

    setPaymentStatus('checking');
    refreshCheckoutPayment();
    timer = window.setInterval(refreshCheckoutPayment, 2500);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [checkout?.order_id]);

  const roleContext = useMemo(
    () => resolveNetworkRole(
      stores,
      currentWallet,
      roleAccessConfig
    ),
    [stores, currentWallet]
  );

  const isSystemAdmin = connected && roleContext.roleKey === 'system_admin';
  const isGuest = connected && roleContext.roleKey === 'guest';
  const roleStore = roleContext.store;
  const allowedPages = useMemo(() => {
    if (isSystemAdmin) return SYSTEM_ADMIN_ALLOWED_PAGES;
    if (isGuest || !connected) return [];
    if (isStoreOwnerRole(roleContext.roleKey)) return OWNER_ALLOWED_PAGES;
    return STAFF_ALLOWED_PAGES;
  }, [connected, isGuest, isSystemAdmin, roleContext.roleKey]);

  useEffect(() => {
    if (!connected || !currentWallet) return;

    if (roleContext.roleKey === 'system_admin') {
      setPage(current => current || 'admin');
      setSelectedStoreId(current => current || firstActiveStore(stores)?.id || '');
      return;
    }

    if (roleStore?.id) {
      setSelectedStoreId(roleStore.id);
      setPage(current => {
        const pages = isStoreOwnerRole(roleContext.roleKey) ? OWNER_ALLOWED_PAGES : STAFF_ALLOWED_PAGES;
        return pages.includes(current) ? current : 'pos';
      });
      return;
    }

    if (roleContext.roleKey === 'guest') {
      setPage('dashboard');
    }
  }, [connected, currentWallet, roleContext.roleKey, roleStore?.id, stores]);

  useEffect(() => {
    if (!connected || isGuest || !allowedPages.length) return;
    if (!allowedPages.includes(page)) {
      setPage(allowedPages[0]);
    }
  }, [allowedPages, connected, isGuest, page]);

  const activeStore = useMemo(() => {
    if (!stores.length) return null;
    if (isGuest) return null;
    return stores.find(store => store.id === selectedStoreId) || firstActiveStore(stores);
  }, [stores, selectedStoreId, isGuest]);

  const data = useMemo(
    () => activeStore ? buildStoreState(activeStore) : buildStoreState(firstActiveStore(initialNetworkStores)),
    [activeStore]
  );

  const staffMembers = data.staffMembers || [];
  const activeStaff = roleContext.member;
  const displayStaff = activeStaff || { name: 'Not connected', role: 'Guest', roleKey: 'guest', wallet: currentWallet, avatar: 'U' };
  const isStoreOwner = isStoreOwnerRole(roleContext.roleKey);
  const canManageStore = isSystemAdmin || isStoreOwner;
  const canUsePos = connected && Boolean(activeStore) && activeStore.status !== 'disabled' && roleContext.roleKey !== 'guest';
  const isManager = canManageStore;
  const posLockMessage = !connected
    ? 'Connect or preview an approved wallet to create invoices.'
    : activeStore?.status === 'disabled'
      ? 'This store is disabled by the system admin.'
      : roleContext.roleKey === 'guest'
        ? 'This wallet is not assigned to any participating store.'
        : '';

  const customers = networkCustomers.length ? networkCustomers : data.customers;
  const visibleStores = isSystemAdmin ? stores : activeStore ? [activeStore] : [];
  const safeReceiverWallet = isGuest ? '' : data.receiverWallet;
  const safeStaffMembers = isGuest ? [] : staffMembers;
  const selectedCustomer = customers.find(customer => customer.id === customerId) || customers[0] || null;
  const cartRows = useMemo(() => cart.map(item => {
    const product = ensureStoreProducts(activeStore).find(row => row.id === item.id);
    return product ? { ...product, qty: item.qty } : null;
  }).filter(Boolean), [cart, activeStore]);

  const taxRate = Number(data.settings?.taxRate || 10);
  const subtotal = cartRows.reduce((sum, row) => sum + row.price * row.qty, 0);
  const taxAmount = Math.round(subtotal * taxRate / 100);
  const grossTotal = subtotal + taxAmount;
  const pointsDiscount = rawFromPoints(pointsUsed);
  const total = Math.max(grossTotal - pointsDiscount, 0);
  const pointsEarned = pointsFromRaw(total);

  function updateActiveStore(updater) {
    setStores(current => current.map(store => {
      if (store.id !== activeStore?.id) return store;
      return updater(store);
    }));
  }

  function requireStoreAccess(actionName = 'perform this action') {
    if (!canUsePos) {
      alert(posLockMessage || `Cannot ${actionName}.`);
      return false;
    }
    return true;
  }

  function createNewInvoice() {
    if (!requireStoreAccess('create an invoice')) return;
    setInvoiceActive(true);
    setCart([]);
    setCheckout(null);
    setCheckoutPayment(null);
    setPaymentStatus('idle');
    setPointsUsed(0);
    setProductSearch('');
  }

  function addToCart(product) {
    if (!requireStoreAccess('add products to an invoice')) return;
    if (!invoiceActive) setInvoiceActive(true);
    setCheckout(null);
    setCheckoutPayment(null);
    setPaymentStatus('idle');
    setCart(current => {
      const exists = current.find(item => item.id === product.id);
      if (exists) return current.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...current, { id: product.id, qty: 1 }];
    });
  }

  function changeQty(productId, delta) {
    if (!requireStoreAccess('edit invoice quantity')) return;
    setCart(current => current.map(item => item.id === productId ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  }

  function removeItem(productId) {
    if (!requireStoreAccess('remove products from an invoice')) return;
    setCart(current => current.filter(item => item.id !== productId));
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const keyword = productSearch.trim().toLowerCase();
    if (!keyword) return;
    const product = data.products.find(item => [item.name, item.sku, item.barcode].join(' ').toLowerCase().includes(keyword));
    if (product) {
      addToCart(product);
      setProductSearch('');
    }
  }

  async function handleCreateCheckout() {
    if (!requireStoreAccess('create a checkout order')) return;
    if (!cartRows.length) return;

    let order = null;

    if (hasSupabaseConfig) {
      try {
        order = await createCheckoutOrder({
          store: activeStore,
          staff: activeStaff,
          customer: selectedCustomer,
          cartRows,
          subtotal,
          taxRate,
          taxAmount,
          pointsUsed,
          pointsDiscount,
          total,
        });
      } catch (error) {
        console.error(error);
        alert(error.message || 'Cannot create checkout in Supabase.');
        return;
      }
    } else {
      const token = `${activeStore.id}-${Date.now().toString(16)}`;
      order = {
        order_id: `demo-${token}`,
        order_code: `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`,
        checkout_token: token,
      };
    }

    const pendingOrder = {
      id: order.order_id,
      code: order.order_code,
      checkoutToken: order.checkout_token,
      storeId: activeStore.id,
      storeName: activeStore.name,
      storeBranch: activeStore.branch,
      receiverWallet: activeStore.receiverWallet,
      customer: selectedCustomer?.name || 'Guest',
      customerWallet: selectedCustomer?.wallet || '',
      subtotal,
      taxAmount,
      taxRate,
      pointsUsed,
      pointsDiscount,
      total,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'usdc',
      createdAt: new Date().toISOString(),
      items: cartRows.map(row => ({
        id: row.id,
        productId: row.id,
        name: row.name,
        sku: row.sku,
        qty: row.qty,
        unitPrice: row.price,
        total: row.price * row.qty,
      })),
    };

    saveStoredCheckout(pendingOrder);
    setCheckout(order);
    setCheckoutPayment(null);
    setPaymentStatus('pending');
    if (hasSupabaseConfig) await reloadNetwork();
  }

  async function handleConfirmMockPayment() {
    if (!requireStoreAccess('confirm payment')) return;
    if (!checkout) return;
    setPaymentStatus('checking');

    if (hasSupabaseConfig && checkout.order_id && !String(checkout.order_id).startsWith('demo')) {
      try {
        await confirmCheckoutPayment({
          orderId: checkout.order_id,
          payerWallet: selectedCustomer?.wallet || '',
          txHash: '',
          rawResponse: {
            mode: 'manual-cash-payment',
            receiver_wallet: activeStore?.receiverWallet || '',
            payable_raw: total,
            redeemed_points: pointsUsed,
            redeemed_value_raw: pointsDiscount,
            earned_points: pointsEarned,
            wallet_customer_id: selectedCustomer?.id || null,
            wallet_address: selectedCustomer?.wallet || '',
          },
        });

        const status = await loadCheckoutPaymentStatus(checkout.order_id);
        setCheckoutPayment(status);
        setPaymentStatus('paid');
        await reloadNetwork();
        setCart([]);
        setInvoiceActive(false);
        return;
      } catch (error) {
        console.error(error);
        setPaymentStatus('pending');
        alert(error.message || 'Cannot confirm cash payment.');
        return;
      }
    }

    const paidOrder = {
      id: checkout.order_id,
      code: checkout.order_code,
      checkoutToken: checkout.checkout_token,
      storeId: activeStore.id,
      customer: selectedCustomer?.name || 'Guest',
      customerWallet: selectedCustomer?.wallet || '',
      subtotal,
      pointsUsed,
      pointsDiscount,
      total,
      status: 'paid',
      paymentStatus: 'paid',
      paymentMethod: 'arc',
      txHash: `0xmock${Date.now().toString(16)}`,
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      items: cartRows.map(row => ({ id: row.id, productId: row.id, name: row.name, sku: row.sku, qty: row.qty, unitPrice: row.price, total: row.price * row.qty })),
    };

    updateActiveStore(store => ({
      ...store,
      orders: [paidOrder, ...(store.orders || [])],
      products: store.products.map(product => {
        const cartItem = cartRows.find(item => item.id === product.id);
        return cartItem ? { ...product, stock: Math.max(0, Number(product.stock || 0) - Number(cartItem.qty || 0)) } : product;
      }),
    }));

    saveStoredCheckout(paidOrder);

    setPaymentStatus('paid');
    setCart([]);
    setInvoiceActive(false);
  }

  async function deleteProduct(productId) {
    if (!canManageStore) return alert('Only the system admin or store owner can edit products.');
    if (!confirm('Disable this product from POS?')) return;
    updateActiveStore(store => ({
      ...store,
      products: store.products.map(product => product.id === productId ? { ...product, active: false } : product),
    }));
  }

  async function saveProduct(product) {
    if (!canManageStore) return alert('Only the system admin or store owner can edit products.');

    const isNew = product === 'new' || !product.id;
    const id = isNew ? `${activeStore.id.slice(-3).toUpperCase()}-${Date.now().toString().slice(-5)}` : product.id;
    const normalized = {
      ...product,
      id,
      stock: Number(product.stock || 0),
      min: Number(product.min || 0),
      price: Number(product.price || 0),
      costPrice: Number(product.costPrice || 0),
      active: product.active !== false,
      status: product.status || (product.active === false ? 'inactive' : 'active'),
    };

    updateActiveStore(store => {
      const exists = store.products.some(item => item.id === id);
      return {
        ...store,
        products: exists
          ? store.products.map(item => item.id === id ? normalized : item)
          : [normalized, ...store.products],
      };
    });
    setEditingProduct(null);
    if (hasSupabaseConfig) {
      try {
        await saveProductRecord(activeStore.id, normalized);
        await reloadNetwork();
      } catch (error) {
        alert(error.message || error);
      }
    }
  }

  async function saveStaffMember(staffDraft) {
    if (!canManageStore) return alert('Only the system admin or store owner can edit staff.');
    const wallet = staffDraft.wallet.trim();
    const normalized = {
      id: staffDraft.id || `staff-${Date.now()}`,
      name: staffDraft.name.trim(),
      role: titleCaseRole(staffDraft.role),
      roleKey: staffDraft.role,
      wallet,
      avatar: staffDraft.role === 'owner' ? 'SO' : 'ST',
      active: staffDraft.active !== false,
    };

    updateActiveStore(store => {
      const existing = (store.staffMembers || []).some(member => normalizeWallet(member.wallet) === normalizeWallet(wallet));
      return {
        ...store,
        staffMembers: existing
          ? store.staffMembers.map(member => normalizeWallet(member.wallet) === normalizeWallet(wallet) ? { ...member, ...normalized } : member)
          : [normalized, ...(store.staffMembers || [])],
      };
    });
    if (hasSupabaseConfig) {
      try {
        await saveStaffRecord(activeStore.id, staffDraft);
        await reloadNetwork();
      } catch (error) {
        alert(error.message || error);
      }
    }
  }

  async function disableStaffMember(member) {
    if (!canManageStore) return alert('Only the system admin or store owner can edit staff.');
    if (normalizeWallet(member.wallet) === normalizeWallet(activeStore.ownerWallet)) return alert('The store owner wallet cannot be disabled from the store staff page.');
    if (!confirm(`Disable ${member.name || member.wallet}?`)) return;

    updateActiveStore(store => ({
      ...store,
      staffMembers: (store.staffMembers || []).map(item => normalizeWallet(item.wallet) === normalizeWallet(member.wallet) ? { ...item, active: false } : item),
    }));
    if (hasSupabaseConfig && member.id && !String(member.id).startsWith('staff-')) {
      try {
        await disableStaffRecord(member.id);
        await reloadNetwork();
      } catch (error) {
        alert(error.message || error);
      }
    }
  }

  async function handleConnectWallet() {
    try {
      const wallet = await connectEvmWallet(getPaymentChain(connectChainCode(activeStore)));
      setCurrentWallet(wallet.address);
      setConnected(true);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Cannot connect wallet.');
    }
  }

  function handleSignOut() {
    setConnected(false);
    setCurrentWallet('');
    setPage('admin');
    setInvoiceActive(false);
    setCart([]);
    setCheckout(null);
    setCheckoutPayment(null);
    setPaymentStatus('idle');
    setPointsUsed(0);
  }

  function handleAddStore(draft) {
    const id = `store-${Date.now().toString(16)}`;
    const storeSlug = slugifyStoreName(draft.name);
    const newStore = {
      id,
      name: draft.name.trim(),
      branch: draft.branch.trim() || 'Main Branch',
      type: draft.type,
      status: 'active',
      accent: '#2563eb',
      imageFolder: `/png/stores/${storeSlug}/products`,
      ownerWallet: draft.ownerWallet.trim(),
      receiverWallet: draft.ownerWallet.trim(),
      staffMembers: [
        { id: `${id}-owner`, name: `${draft.name.trim()} Owner`, role: 'Owner', roleKey: 'owner', wallet: draft.ownerWallet.trim(), avatar: 'SO', active: true },
      ],
      categories: ['All', 'Popular', 'Food', 'Drinks'],
      warehouses: [{ id: `${id}-main`, name: 'Main Store', address: draft.branch.trim() || 'Main Branch', status: 'active', active: true }],
      products: [],
      orders: [],
    };
    setStores(current => [newStore, ...current]);
    setSelectedStoreId(id);
    if (hasSupabaseConfig) {
      createStoreRecord(draft).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleUpdateStore(storeId, draft) {
    setStores(current => current.map(store => {
      if (store.id !== storeId) return store;
      const ownerMember = {
        id: `${store.id}-owner`,
        name: `${draft.name || store.name} Owner`,
        role: 'Owner',
        roleKey: 'owner',
        wallet: draft.ownerWallet,
        avatar: 'SO',
        active: true,
      };
      const staffWithoutOldOwner = (store.staffMembers || []).filter(member => normalizeWallet(member.wallet) !== normalizeWallet(store.ownerWallet));

      return {
        ...store,
        name: draft.name,
        branch: draft.branch,
        type: draft.type,
        status: draft.status,
        ownerWallet: draft.ownerWallet,
        receiverWallet: draft.ownerWallet,
        imageFolder: store.imageFolder || `/png/stores/${slugifyStoreName(draft.name)}/products`,
        staffMembers: [ownerMember, ...staffWithoutOldOwner],
      };
    }));
    if (hasSupabaseConfig) {
      updateStoreRecord(storeId, draft).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleToggleStoreStatus(storeId) {
    const store = stores.find(item => item.id === storeId);
    const nextStatus = store?.status === 'disabled' ? 'active' : 'disabled';
    setStores(current => current.map(store => store.id === storeId
      ? { ...store, status: nextStatus }
      : store));
    if (hasSupabaseConfig) {
      updateStoreStatusRecord(storeId, nextStatus).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleUpdateStoreOwner(storeId, wallet) {
    setStores(current => current.map(store => {
      if (store.id !== storeId) return store;
      const ownerMember = {
        id: `${store.id}-owner`,
        name: `${store.name} Owner`,
        role: 'Owner',
        roleKey: 'owner',
        wallet,
        avatar: 'SO',
        active: true,
      };
      const staffWithoutOldOwner = (store.staffMembers || []).filter(member => normalizeWallet(member.wallet) !== normalizeWallet(store.ownerWallet));
      return {
        ...store,
        ownerWallet: wallet,
        receiverWallet: wallet,
        staffMembers: [ownerMember, ...staffWithoutOldOwner],
      };
    }));
    if (hasSupabaseConfig) {
      updateStoreOwnerRecord(storeId, wallet).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleUpdateProductStatus(productId, status) {
    updateActiveStore(store => ({
      ...store,
      products: store.products.map(product => product.id === productId
        ? { ...product, status, active: status === 'active' }
        : product),
    }));
    if (hasSupabaseConfig) {
      updateProductStatusRecord(productId, status).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleAddWarehouse(draft) {
    updateActiveStore(store => ({
      ...store,
      warehouses: [
        {
          id: `${store.id}-warehouse-${Date.now().toString(16)}`,
          name: draft.name.trim(),
          address: draft.address.trim(),
          status: draft.status || 'active',
          active: draft.status === 'active',
        },
        ...(store.warehouses || []),
      ],
    }));
    if (hasSupabaseConfig) {
      addWarehouseRecord(activeStore.id, draft).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleUpdateWarehouseStatus(warehouseId, status) {
    updateActiveStore(store => ({
      ...store,
      warehouses: (store.warehouses || []).map(warehouse => warehouse.id === warehouseId
        ? { ...warehouse, status, active: status === 'active' }
        : warehouse),
    }));
    if (hasSupabaseConfig) {
      updateWarehouseStatusRecord(warehouseId, status).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleAddInventoryProduct(draft) {
    const warehouse = (activeStore.warehouses || []).find(item => item.id === draft.warehouseId);
    updateActiveStore(store => ({
      ...store,
      products: store.products.map(product => product.id === draft.productId
        ? {
            ...product,
            stock: Number(draft.quantity || 0),
            min: Number(draft.min || 0),
            warehouseId: draft.warehouseId,
            warehouse: warehouse?.name || product.warehouse,
          }
        : product),
    }));
  }

  function handleUpdateInventoryWarehouse(productId, warehouseId) {
    const warehouse = (activeStore.warehouses || []).find(item => item.id === warehouseId);
    updateActiveStore(store => ({
      ...store,
      products: store.products.map(product => product.id === productId
        ? { ...product, warehouseId, warehouse: warehouse?.name || product.warehouse }
        : product),
    }));
  }

  function renderPage() {
    if (isGuest) {
      return (
        <section className="panel full-page-panel locked-access-panel">
          <div className="locked-box">
            <strong>Wallet not whitelisted</strong>
            <span>This wallet is not assigned as a system admin, store owner, or store staff wallet.</span>
          </div>
        </section>
      );
    }

    if (connected && allowedPages.length && !allowedPages.includes(page)) {
      return (
        <section className="panel full-page-panel locked-access-panel">
          <div className="locked-box">
            <strong>Role access required</strong>
            <span>This wallet does not have permission to open this section.</span>
          </div>
        </section>
      );
    }

    const activeProducts = data.products.filter(product => (product.status || (product.active === false ? 'inactive' : 'active')) === 'active');
    const common = {
      products: activeProducts,
      customers,
      orders: activeStore?.orders || [],
      inventory: data.inventory || [],
      warehouses: data.warehouses || [],
      purchaseOrders: data.purchaseOrders || [],
      settings: data.settings || {},
      store: data.store,
      receiverWallet: safeReceiverWallet,
      taxRate,
      isManager,
    };

    if (page === 'admin') {
      return (
        <SystemAdminPage
          stores={stores}
          selectedStoreId={selectedStoreId}
          onSelectStore={setSelectedStoreId}
          onAddStore={handleAddStore}
          onUpdateStore={handleUpdateStore}
          onToggleStoreStatus={handleToggleStoreStatus}
          onUpdateStoreOwner={handleUpdateStoreOwner}
          currentWallet={currentWallet}
        />
      );
    }
    if (page === 'dashboard') return <DashboardPage {...common} />;
    if (page === 'orders') return <OrdersPage {...common} />;
    if (page === 'customers') return <CustomersPage customers={customers} />;
    if (page === 'staff') return <StaffPage staffMembers={safeStaffMembers} isManager={canManageStore} currentWallet={currentWallet} onSaveStaff={saveStaffMember} onDisableStaff={disableStaffMember} />;
    if (page === 'products') return <ProductsPage products={data.products} setEditingProduct={setEditingProduct} canManage={canManageStore} onUpdateProductStatus={handleUpdateProductStatus} />;
    if (page === 'inventory') return <InventoryPage products={data.products} warehouses={data.warehouses || []} inventory={data.inventory || []} canManage={canManageStore} onAddInventoryProduct={handleAddInventoryProduct} onUpdateInventoryWarehouse={handleUpdateInventoryWarehouse} />;
    if (page === 'points') {
      return (
        <PointsHistoryPage
          pointsHistory={data.pointsHistory}
          stores={visibleStores}
          scopeLabel={isSystemAdmin ? 'Network Analytics' : 'Store Analytics'}
        />
      );
    }
    if (page === 'rewards') return <RewardsPage settings={data.settings || {}} />;
    if (page === 'warehouse') return <WarehousePage warehouses={data.warehouses || []} inventory={data.inventory || []} canManage={canManageStore} onAddWarehouse={handleAddWarehouse} onUpdateWarehouseStatus={handleUpdateWarehouseStatus} />;
    if (page === 'receiving') return <PurchaseOrdersPage purchaseOrders={data.purchaseOrders || []} />;
    if (page === 'revenue') return <RevenuePage orders={activeStore?.orders || []} />;
    if (page === 'best-sellers') return <BestSellersPage orders={activeStore?.orders || []} products={common.products} />;
    if (page === 'settings') return <SettingsPage store={data.store} receiverWallet={safeReceiverWallet} settings={data.settings || {}} canViewWallet={!isGuest} />;
    if (page === 'pos') {
      return (
        <POSPage
          invoiceActive={invoiceActive}
          canUsePos={canUsePos}
          posLockMessage={posLockMessage}
          onCreateInvoice={createNewInvoice}
          cartRows={cartRows}
          customers={customers}
          customerId={customerId}
          setCustomerId={setCustomerId}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          onSearchSubmit={handleSearchSubmit}
          changeQty={changeQty}
          removeItem={removeItem}
          subtotal={subtotal}
          taxRate={taxRate}
          taxAmount={taxAmount}
          grossTotal={grossTotal}
          pointsUsed={pointsUsed}
          setPointsUsed={setPointsUsed}
          pointsDiscount={pointsDiscount}
          total={total}
          pointsEarned={pointsEarned}
          selectedCustomer={selectedCustomer}
          onCreateCheckout={handleCreateCheckout}
          onConfirmMockPayment={handleConfirmMockPayment}
          checkout={checkout}
          checkoutPayment={checkoutPayment}
          paymentStatus={paymentStatus}
          receiverWallet={safeReceiverWallet}
          products={common.products}
          categories={data.categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          query={query}
          addToCart={addToCart}
          setEditingProduct={setEditingProduct}
          deleteProduct={deleteProduct}
          canManage={canManageStore}
        />
      );
    }

    return <DashboardPage {...common} />;
  }

  if (window.location.pathname.startsWith('/checkout')) {
    return (
      <CustomerCheckoutPage
        demoOrders={stores.flatMap(store => store.orders || [])}
        settings={data.settings || {}}
        store={data.store}
        receiverWallet={safeReceiverWallet}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onPageChange={setPage}
        store={data.store}
        stores={stores}
        selectedStoreId={selectedStoreId}
        onStoreChange={setSelectedStoreId}
        isSystemAdmin={isSystemAdmin}
        isGuest={isGuest}
      />
      <main className="main-shell">
        <Header
          query={query}
          setQuery={setQuery}
          connected={connected}
          onConnect={handleConnectWallet}
          onSignOut={handleSignOut}
          staff={displayStaff}
          currentWallet={currentWallet}
          isManager={isManager}
          network={data.store.network}
          roleLabel={roleContext.label}
        />
        <StatusBanner message={dbMessage} onReload={reloadNetwork} />
        <div className="content-shell">
          {renderPage()}
        </div>
      </main>

      {editingProduct && canManageStore && (
        <ProductModal
          product={editingProduct}
          categories={data.categories}
          onClose={() => setEditingProduct(null)}
          onSave={saveProduct}
        />
      )}
    </div>
  );
}
