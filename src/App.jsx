import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import ProductModal from './components/ProductModal.jsx';
import Sidebar from './components/Sidebar.jsx';
import StatusBanner from './components/StatusBanner.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import POSPage from './pages/POSPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import PointsHistoryPage from './pages/PointsHistoryPage.jsx';
import RewardsPage from './pages/RewardsPage.jsx';
import WarehousePage from './pages/WarehousePage.jsx';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage.jsx';
import RevenuePage from './pages/RevenuePage.jsx';
import BestSellersPage from './pages/BestSellersPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import StaffPage from './pages/StaffPage.jsx';
import CustomerCheckoutPage from './pages/CustomerCheckoutPage.jsx';
import { supabase, hasSupabaseConfig } from './lib/supabaseClient.js';
import { createPosOrder, confirmArcPayment } from './services/posService.js';
import { demoState } from './utils/demoData.js';
import { DEFAULT_STAFF_WALLETS, MANAGER_WALLET, isManagerWallet, normalizeWallet } from './utils/roles.js';
import { mapCustomer, mapInventory, mapOrder, mapProduct, mapPurchaseOrder, mapStaff, mapStore, mapWarehouse } from './utils/mappers.js';
import { pointsFromRaw, rawFromPoints } from './utils/format.js';
import { MERCHANT_RECEIVER_WALLET } from './utils/arcConfig.js';
import { connectArcWallet } from './services/arcWallet.js';

const DEFAULT_STORE_ID = 'e9db5f1e-f9f9-4569-ad73-879f6dc90138';

function isUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function firstNonEmpty(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') || null;
}



function isValidEvmAddress(value = '') {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
}

function resolveReceiverWallet(value = '') {
  const text = String(value || '').trim();
  const demoReceiver = '0x1234abcd5678ef901234abcd5678ef901234abcd';
  if (isValidEvmAddress(text) && normalizeWallet(text) !== normalizeWallet(demoReceiver)) {
    return text;
  }
  return MERCHANT_RECEIVER_WALLET;
}

function findStaffByWallet(staffMembers = [], wallet = '') {
  const normalized = normalizeWallet(wallet);
  return staffMembers.find(member => normalizeWallet(member.wallet) === normalized) || null;
}

function mergeStaffWhitelist(rows = []) {
  const byWallet = new Map();
  DEFAULT_STAFF_WALLETS.forEach(member => byWallet.set(normalizeWallet(member.wallet), member));
  rows.forEach(member => {
    const key = normalizeWallet(member.wallet);
    if (key) byWallet.set(key, { ...byWallet.get(key), ...member });
  });
  return Array.from(byWallet.values()).filter(member => member.wallet);
}

export default function App() {
  const [page, setPage] = useState('pos');
  const [query, setQuery] = useState('');
  const [data, setData] = useState(demoState);
  const [ids, setIds] = useState({ storeId: null, staffId: null });
  const [dbMessage, setDbMessage] = useState('Loading Supabase...');
  const [connected, setConnected] = useState(false);
  const [currentWallet, setCurrentWallet] = useState('');

  const [invoiceActive, setInvoiceActive] = useState(false);
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [productSearch, setProductSearch] = useState('');
  const [pointsUsed, setPointsUsed] = useState(0);
  const [checkout, setCheckout] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [editingProduct, setEditingProduct] = useState(null);

  async function loadData() {
    if (!hasSupabaseConfig || !supabase) {
      setData({ ...demoState, staff: findStaffByWallet(demoState.staffMembers || DEFAULT_STAFF_WALLETS, currentWallet) || DEFAULT_STAFF_WALLETS[0] });
      setIds({ storeId: DEFAULT_STORE_ID, staffId: null });
      setCustomerId(demoState.customers[0]?.id || '');
      setDbMessage('Supabase is not configured. Using local demo data.');
      return;
    }

    setDbMessage('Reading live Supabase data...');

    const safeRows = (result, fallback = []) => {
      if (result?.error) {
        console.warn('Supabase optional query error:', result.error.message || result.error);
        return fallback;
      }
      return Array.isArray(result?.data) ? result.data : fallback;
    };

    const safeSingle = (result, fallback = null) => {
      if (result?.error) {
        console.warn('Supabase optional query error:', result.error.message || result.error);
        return fallback;
      }
      return result?.data || fallback;
    };

    try {
      // Keep these three queries simple. If a relation join or optional filter fails,
      // the whole app should not fall back to demo data.
      const [storeListRes, productRes, settingsListRes] = await Promise.all([
        supabase.from('stores').select('*').limit(5),
        supabase.from('products').select('*').order('name', { ascending: true }),
        supabase.from('store_settings').select('*').limit(5),
      ]);

      const storeRows = safeRows(storeListRes, []);
      const allProductRows = safeRows(productRes, []);
      const settingsRows = safeRows(settingsListRes, []);

      const storeRow = storeRows.find(row => row.id === DEFAULT_STORE_ID) || storeRows.find(row => row.is_active !== false) || storeRows[0] || null;
      const settingsRow = settingsRows.find(row => row.store_id === (storeRow?.id || DEFAULT_STORE_ID)) || settingsRows.find(row => row.is_active !== false) || settingsRows[0] || {};
      const resolvedStoreId = firstNonEmpty(
        storeRow?.id,
        settingsRow?.store_id,
        allProductRows.find(row => row.store_id)?.store_id,
        DEFAULT_STORE_ID
      );

      const productRows = allProductRows
        .filter(row => row.is_active !== false)
        .filter(row => !resolvedStoreId || !row.store_id || row.store_id === resolvedStoreId);

      const [categoryRes, customerRes, staffRes, orderRes, pointsRes, inventoryRes, warehouseRes, purchaseRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('customers').select('*').order('total_spent', { ascending: false }),
        supabase.from('staff').select('*').order('created_at', { ascending: true }),
        supabase.from('orders').select('*, customers(full_name, wallet_address), order_items(*, products(name, sku, barcode)), payments(*)').order('created_at', { ascending: false }).limit(80),
        supabase.from('loyalty_transactions').select('*, customers(wallet_address)').order('created_at', { ascending: false }).limit(80),
        supabase.from('inventory').select('*, products(name, sku, barcode, cost_price, sell_price, min_stock, stock_quantity, is_active), warehouses(name)').order('updated_at', { ascending: false }),
        supabase.from('warehouses').select('*').order('created_at', { ascending: true }),
        supabase.from('purchase_orders').select('*, suppliers(name), purchase_order_items(*, products(name, sku))').order('created_at', { ascending: false }).limit(30),
      ]);

      const categoryRows = safeRows(categoryRes, []).filter(row => row.is_active !== false);
      const categoryMap = Object.fromEntries(categoryRows.map(row => [row.id, row.name]));
      const categories = ['All', ...categoryRows.map(row => mapProduct({ id: 'x', name: 'x', sell_price: 0, stock_quantity: 0, min_stock: 0, category_id: row.id }, categoryMap).category)].filter((item, index, arr) => arr.indexOf(item) === index);
      const products = productRows.map(row => mapProduct(row, categoryMap));
      const customers = safeRows(customerRes, []).map(mapCustomer);
      const staffRows = safeRows(staffRes, []).filter(row => row.is_active !== false).map(mapStaff);
      const mergedStaff = mergeStaffWhitelist(staffRows);
      const currentStaff = findStaffByWallet(mergedStaff, currentWallet) || mergedStaff[0] || DEFAULT_STAFF_WALLETS[0];
      const store = mapStore(storeRow || { id: resolvedStoreId, name: 'Minh Chau Grocery', branch_name: 'Da Nang Branch' });
      const receiverWallet = resolveReceiverWallet(settingsRow.arc_receiver_wallet);

      setData({
        store: { ...store, id: resolvedStoreId, network: settingsRow.arc_network === 'arc-mainnet' ? 'Arc Mainnet' : 'Arc Testnet' },
        settings: {
          taxRate: Number(settingsRow.tax_rate || 10),
          earnRate: '1 USDC paid = 1 point',
          redeemRate: '100 points = 1 USDC discount',
          maxRedeem: 'Max 20% of invoice total',
        },
        receiverWallet,
        staff: currentStaff,
        staffMembers: mergedStaff,
        categoryRows,
        categories: categories.length > 1 ? categories : demoState.categories,
        products: products.length ? products : demoState.products,
        customers: customers.length ? customers : demoState.customers,
        orders: safeRows(orderRes, []).map(mapOrder),
        payments: [],
        movements: [],
        pointsHistory: safeRows(pointsRes, []),
        inventory: safeRows(inventoryRes, []).map(mapInventory),
        warehouses: safeRows(warehouseRes, []).map(mapWarehouse),
        purchaseOrders: safeRows(purchaseRes, []).map(mapPurchaseOrder),
      });

      setIds({ storeId: resolvedStoreId, staffId: currentStaff.id || null });
      setCustomerId(current => current || customers[0]?.id || '');
      setDbMessage(products.length
        ? `Connected to live Supabase. store_id: ${String(resolvedStoreId).slice(0, 8)}...`
        : `Connected to Supabase, but products did not load. store_id: ${String(resolvedStoreId).slice(0, 8)}...`);
    } catch (error) {
      console.error(error);
      setData({ ...demoState, store: { ...demoState.store, id: DEFAULT_STORE_ID }, staff: findStaffByWallet(demoState.staffMembers || DEFAULT_STAFF_WALLETS, currentWallet) || DEFAULT_STAFF_WALLETS[0] });
      setIds({ storeId: DEFAULT_STORE_ID, staffId: null });
      setCustomerId(demoState.customers[0]?.id || '');
      setDbMessage(`Supabase error: ${error.message || error}. Using local demo data with default store_id.`);
    }
  }

  useEffect(() => { loadData(); }, [currentWallet]);

  const selectedCustomer = data.customers.find(customer => customer.id === customerId) || null;
  const cartRows = useMemo(() => cart.map(item => {
    const product = data.products.find(row => row.id === item.id);
    return product ? { ...product, qty: item.qty } : null;
  }).filter(Boolean), [cart, data.products]);

  const staffMembers = data.staffMembers || DEFAULT_STAFF_WALLETS;
  const activeStaff = findStaffByWallet(staffMembers, currentWallet) || data.staff || DEFAULT_STAFF_WALLETS[0];
  const isManager = isManagerWallet(currentWallet, activeStaff);

  const taxRate = Number(data.settings?.taxRate || 10);
  const subtotal = cartRows.reduce((sum, row) => sum + row.price * row.qty, 0);
  const taxAmount = Math.round(subtotal * taxRate / 100);
  const grossTotal = subtotal + taxAmount;
  const pointsDiscount = rawFromPoints(pointsUsed);
  const total = Math.max(grossTotal - pointsDiscount, 0);
  const pointsEarned = pointsFromRaw(total);

  function createNewInvoice() {
    setInvoiceActive(true);
    setCart([]);
    setCheckout(null);
    setPaymentStatus('idle');
    setPointsUsed(0);
    setProductSearch('');
  }

  function addToCart(product) {
    if (!invoiceActive) setInvoiceActive(true);
    setCheckout(null);
    setPaymentStatus('idle');
    setCart(current => {
      const exists = current.find(item => item.id === product.id);
      if (exists) return current.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...current, { id: product.id, qty: 1 }];
    });
  }

  function changeQty(productId, delta) {
    setCart(current => current.map(item => item.id === productId ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  }

  function removeItem(productId) {
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
    if (!cartRows.length) return;
    setPaymentStatus('checking');
    try {
      if (!hasSupabaseConfig || !supabase) {
        throw new Error('Supabase is not configured. Check your .env file and restart npm run dev.');
      }

      const resolvedStoreId = firstNonEmpty(
        ids.storeId,
        data.store?.id,
        cartRows.find(row => row.raw?.store_id)?.raw?.store_id,
        DEFAULT_STORE_ID
      );

      if (!isUuid(resolvedStoreId)) {
        throw new Error(`Invalid store_id: ${resolvedStoreId || 'empty'}. Check public.stores.`);
      }

      const invalidItems = cartRows.filter(row => !isUuid(row.id));
      if (invalidItems.length) {
        throw new Error('Products are still loaded from local demo data, not Supabase. Click Reload. If P/S Toothpaste is visible, the product query is still falling back to demo data.');
      }

      const order = await createPosOrder({
        storeId: resolvedStoreId,
        staffId: ids.staffId,
        customerId: customerId || null,
        items: cartRows,
        pointsUsed,
        pointsDiscount,
        taxRate,
        taxAmount,
      });

      if (!order?.checkout_token || !order?.order_id) {
        throw new Error('create_pos_order did not return order_id and checkout_token. Check the RPC return payload.');
      }

      setIds(current => ({ ...current, storeId: resolvedStoreId }));
      setCheckout(order);
      setPaymentStatus('pending');
    } catch (error) {
      console.error(error);
      alert(error.message || 'Cannot create checkout.');
      setPaymentStatus('idle');
    }
  }

  async function handleConfirmMockPayment() {
    if (!checkout) return;
    setPaymentStatus('checking');
    try {
      if (checkout?.order_id && hasSupabaseConfig) {
        await confirmArcPayment({
          orderId: checkout.order_id,
          payerWallet: selectedCustomer?.wallet || data.staff.wallet,
          checkoutToken: checkout.checkout_token,
        });
        await loadData();
      } else {
        const demoOrder = {
          id: checkout.order_id,
          code: checkout.order_code,
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
        setData(current => ({ ...current, orders: [demoOrder, ...current.orders] }));
      }
      setPaymentStatus('paid');
      setCart([]);
      setInvoiceActive(false);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Cannot confirm payment.');
      setPaymentStatus('pending');
    }
  }

  async function deleteProduct(productId) {
    if (!isManager) return alert('Only the manager wallet can edit products.');
    if (!confirm('Hide this product from POS?')) return;
    if (hasSupabaseConfig && supabase && !String(productId).startsWith('P')) {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', productId);
      if (error) return alert(error.message);
      await loadData();
      return;
    }
    setData(current => ({ ...current, products: current.products.filter(product => product.id !== productId) }));
  }


  async function saveProduct(product) {
    if (!isManager) return alert('Only the manager wallet can edit products.');

    const id = product.id || `P${Date.now().toString().slice(-6)}`;
    const normalized = {
      ...product,
      id,
      stock: Number(product.stock || 0),
      min: Number(product.min || 0),
      price: Number(product.price || 0),
      costPrice: Number(product.costPrice || 0),
      active: product.active !== false,
    };

    const safeStoreIdForSave = ids.storeId || data.store?.id || DEFAULT_STORE_ID;

    if (hasSupabaseConfig && supabase && safeStoreIdForSave && !String(id).startsWith('P')) {
      const categoryRow = (data.categoryRows || []).find(row => row.name === product.category || row.id === product.categoryId);
      const payload = {
        name: product.originalName || product.name,
        sku: product.sku,
        barcode: product.barcode || null,
        category_id: categoryRow?.id || product.categoryId || null,
        unit: product.unit || 'unit',
        sell_price: Number(product.price || 0),
        cost_price: Number(product.costPrice || 0),
        stock_quantity: Number(product.stock || 0),
        min_stock: Number(product.min || 0),
        description: product.description || '',
        image_url: product.image || '',
        is_active: product.active !== false,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('products').update(payload).eq('id', id);
      if (error) return alert(error.message);
      await loadData();
      setEditingProduct(null);
      return;
    }

    if (hasSupabaseConfig && supabase && safeStoreIdForSave && String(id).startsWith('P')) {
      const categoryRow = (data.categoryRows || []).find(row => row.name === product.category || row.id === product.categoryId);
      const payload = {
        store_id: safeStoreIdForSave,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || null,
        category_id: categoryRow?.id || null,
        unit: product.unit || 'unit',
        sell_price: Number(product.price || 0),
        cost_price: Number(product.costPrice || 0),
        stock_quantity: Number(product.stock || 0),
        min_stock: Number(product.min || 0),
        description: product.description || '',
        image_url: product.image || '',
        is_active: product.active !== false,
      };
      const { error } = await supabase.from('products').insert(payload);
      if (error) return alert(error.message);
      await loadData();
      setEditingProduct(null);
      return;
    }

    setData(current => {
      const exists = current.products.some(item => item.id === id);
      return {
        ...current,
        products: exists ? current.products.map(item => item.id === id ? normalized : item) : [normalized, ...current.products],
      };
    });
    setEditingProduct(null);
  }

  async function saveStaffMember(staffDraft) {
    if (!isManager) return alert('Only the manager wallet can edit staff whitelist.');
    const wallet = staffDraft.wallet.trim();
    const normalized = {
      id: staffDraft.id || `staff-${Date.now()}`,
      name: staffDraft.name.trim(),
      role: staffDraft.role === 'manager' ? 'Manager' : staffDraft.role.charAt(0).toUpperCase() + staffDraft.role.slice(1),
      roleKey: staffDraft.role,
      wallet,
      avatar: staffDraft.role === 'manager' ? '👨🏻‍💼' : '👩🏻‍💼',
      active: staffDraft.active !== false,
    };

    if (hasSupabaseConfig && supabase) {
      const payload = {
        full_name: normalized.name,
        role: staffDraft.role,
        wallet_address: wallet,
        is_active: normalized.active,
      };
      if (ids.storeId || data.store?.id || DEFAULT_STORE_ID) payload.store_id = ids.storeId || data.store?.id || DEFAULT_STORE_ID;
      let result;
      if (staffDraft.id && !String(staffDraft.id).startsWith('staff-')) {
        result = await supabase.from('staff').update(payload).eq('id', staffDraft.id);
      } else {
        result = await supabase.from('staff').insert(payload);
      }
      if (result.error) return alert(result.error.message);
      await loadData();
      return;
    }

    setData(current => {
      const existing = (current.staffMembers || []).some(member => normalizeWallet(member.wallet) === normalizeWallet(wallet));
      return {
        ...current,
        staffMembers: existing
          ? current.staffMembers.map(member => normalizeWallet(member.wallet) === normalizeWallet(wallet) ? { ...member, ...normalized } : member)
          : [normalized, ...(current.staffMembers || [])],
      };
    });
  }

  async function disableStaffMember(member) {
    if (!isManager) return alert('Only the manager wallet can edit staff whitelist.');
    if (normalizeWallet(member.wallet) === normalizeWallet(MANAGER_WALLET)) return alert('The manager wallet cannot be disabled.');
    if (!confirm(`Disable ${member.name || member.wallet}?`)) return;

    if (hasSupabaseConfig && supabase && member.id && !String(member.id).startsWith('staff-')) {
      const { error } = await supabase.from('staff').update({ is_active: false }).eq('id', member.id);
      if (error) return alert(error.message);
      await loadData();
      return;
    }

    setData(current => ({
      ...current,
      staffMembers: (current.staffMembers || []).map(item => normalizeWallet(item.wallet) === normalizeWallet(member.wallet) ? { ...item, active: false } : item),
    }));
  }

  async function handleConnectWallet() {
    try {
      const wallet = await connectArcWallet();
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
  }

  function renderPage() {
    const common = {
      products: data.products,
      customers: data.customers,
      orders: data.orders,
      inventory: data.inventory || [],
      warehouses: data.warehouses || [],
      purchaseOrders: data.purchaseOrders || [],
      settings: data.settings || {},
      store: data.store,
      receiverWallet: data.receiverWallet,
      taxRate,
      isManager,
    };
    if (page === 'dashboard') return <DashboardPage {...common} />;
    if (page === 'orders') return <OrdersPage {...common} />;
    if (page === 'customers') return <CustomersPage customers={data.customers} />;
    if (page === 'staff') return <StaffPage staffMembers={staffMembers} isManager={isManager} currentWallet={currentWallet} onSaveStaff={saveStaffMember} onDisableStaff={disableStaffMember} />;
    if (page === 'products') return <ProductsPage products={data.products} setEditingProduct={setEditingProduct} canManage={isManager} />;
    if (page === 'inventory') return <InventoryPage products={data.products} inventory={data.inventory || []} setEditingProduct={setEditingProduct} canManage={isManager} />;
    if (page === 'points') return <PointsHistoryPage pointsHistory={data.pointsHistory} />;
    if (page === 'rewards') return <RewardsPage settings={data.settings || {}} />;
    if (page === 'warehouse') return <WarehousePage warehouses={data.warehouses || []} inventory={data.inventory || []} />;
    if (page === 'receiving') return <PurchaseOrdersPage purchaseOrders={data.purchaseOrders || []} />;
    if (page === 'revenue') return <RevenuePage orders={data.orders} />;
    if (page === 'best-sellers') return <BestSellersPage orders={data.orders} products={data.products} />;
    if (page === 'settings') return <SettingsPage store={data.store} receiverWallet={data.receiverWallet} settings={data.settings || {}} />;
    if (page === 'pos') {
      return (
        <POSPage
          invoiceActive={invoiceActive}
          onCreateInvoice={createNewInvoice}
          cartRows={cartRows}
          customers={data.customers}
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
          paymentStatus={paymentStatus}
          receiverWallet={data.receiverWallet}
          products={data.products}
          categories={data.categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          query={query}
          addToCart={addToCart}
          setEditingProduct={setEditingProduct}
          deleteProduct={deleteProduct}
          canManage={isManager}
        />
      );
    }

    return <DashboardPage {...common} />;
  }

  if (window.location.pathname.startsWith('/checkout')) {
    return (
      <CustomerCheckoutPage
        demoOrders={data.orders}
        settings={data.settings || {}}
        store={data.store}
        receiverWallet={data.receiverWallet}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onPageChange={setPage} store={data.store} />
      <main className="main-shell">
        <Header
          query={query}
          setQuery={setQuery}
          connected={connected}
          onConnect={handleConnectWallet}
          onSignOut={handleSignOut}
          staff={activeStaff}
          staffMembers={staffMembers}
          currentWallet={currentWallet}
          setCurrentWallet={setCurrentWallet}
          isManager={isManager}
          network={data.store.network}
        />
        <StatusBanner message={dbMessage} onReload={loadData} />
        <div className="content-shell">
          {renderPage()}
        </div>
      </main>

      {editingProduct && isManager && (
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
