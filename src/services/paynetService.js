import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js';
import { pointsFromRaw } from '../utils/format.js';

function rows(result) {
  if (result?.error) throw result.error;
  return Array.isArray(result?.data) ? result.data : [];
}

function one(result) {
  if (result?.error) throw result.error;
  return result?.data || null;
}

function roleLabel(role = 'cashier') {
  if (role === 'owner') return 'Owner';
  if (role === 'manager') return 'Manager';
  if (role === 'warehouse') return 'Warehouse';
  if (role === 'accountant') return 'Accountant';
  return 'Cashier';
}

function mapStaff(row) {
  return {
    id: row.id,
    name: row.full_name,
    role: roleLabel(row.role),
    roleKey: row.role,
    wallet: row.wallet_address,
    avatar: row.avatar || (row.role === 'owner' ? 'SO' : 'ST'),
    active: row.is_active !== false,
  };
}

function mapProduct(row, warehouseMap = {}) {
  const warehouse = warehouseMap[row.id] || null;
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode || '',
    category: row.category || 'Other',
    unit: row.unit || 'unit',
    price: Number(row.sell_price || 0),
    costPrice: Number(row.cost_price || 0),
    stock: Number(row.stock_quantity || 0),
    min: Number(row.min_stock || 0),
    image: row.image_url || '',
    emoji: '',
    description: row.description || '',
    status: row.status || 'active',
    active: row.status === 'active',
    warehouseId: warehouse?.warehouseId || '',
    warehouse: warehouse?.warehouse || '',
  };
}

function mapWarehouse(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address || '',
    status: row.status || 'active',
    active: row.status === 'active',
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    code: row.code,
    checkoutToken: row.checkout_token,
    storeId: row.store_id,
    customer: row.customer_wallet || 'Guest',
    customerWallet: row.customer_wallet || '',
    subtotal: Number(row.subtotal || 0),
    taxAmount: Number(row.tax_amount || 0),
    taxRate: Number(row.tax_rate || 10),
    pointsUsed: Number(row.apoints_redeemed || 0),
    pointsDiscount: Number(row.discount_amount || 0),
    total: Number(row.total_amount || 0),
    status: row.status || 'pending',
    paymentStatus: row.payment_status || 'pending',
    paymentMethod: 'usdc',
    txHash: row.payments?.[0]?.tx_hash || '',
    proofTxHash: row.payments?.[0]?.proof_tx_hash || row.payments?.[0]?.raw_response?.proof_tx_hash || '',
    createdAt: row.created_at,
    paidAt: row.paid_at,
    items: (row.order_items || []).map(item => ({
      id: item.id,
      productId: item.product_id,
      name: item.product_name,
      sku: item.sku,
      qty: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      total: Number(item.total_price || 0),
    })),
  };
}

function mapPointLedger(row, storesById = {}, ordersById = {}) {
  const order = ordersById[row.order_id] || null;
  const payment = Array.isArray(order?.payments) ? order.payments[0] : null;
  const rawResponse = payment?.raw_response || {};

  return {
    id: row.id,
    customerWallet: row.wallet_address || row.customer_wallet || '',
    wallet_address: row.wallet_address || row.customer_wallet || '',
    storeId: row.store_id,
    store_id: row.store_id,
    storeName: row.store_name || storesById[row.store_id]?.name || '',
    store_name: row.store_name || storesById[row.store_id]?.name || '',
    orderId: row.order_id,
    order_id: row.order_id,
    invoiceId: row.invoice_id || order?.code || '',
    invoice_id: row.invoice_id || order?.code || '',
    type: row.type,
    points: Number(row.points || 0),
    balanceAfter: Number(row.balance_after || 0),
    balance_after: Number(row.balance_after || 0),
    paymentTxHash: row.payment_tx_hash || row.tx_hash || payment?.tx_hash || rawResponse.payment_tx_hash || '',
    payment_tx_hash: row.payment_tx_hash || row.tx_hash || payment?.tx_hash || rawResponse.payment_tx_hash || '',
    proofTxHash: row.proof_tx_hash || payment?.proof_tx_hash || rawResponse.proof_tx_hash || '',
    proof_tx_hash: row.proof_tx_hash || payment?.proof_tx_hash || rawResponse.proof_tx_hash || '',
    tx_hash: row.tx_hash || row.payment_tx_hash || payment?.tx_hash || rawResponse.payment_tx_hash || '',
    note: row.note || '',
    createdAt: row.created_at,
    created_at: row.created_at,
  };
}

function storeCategories(products = []) {
  return ['All', ...products.map(product => product.category).filter(Boolean)]
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

async function syncStoreDefaultPaymentReceiver(storeId, receiverWallet) {
  if (!storeId || !receiverWallet) return;

  const network = one(await supabase.from('payment_networks').select('id').eq('code', 'arc-testnet').maybeSingle());
  if (!network?.id) return;

  const token = one(await supabase
    .from('payment_tokens')
    .select('id')
    .eq('network_id', network.id)
    .eq('symbol', 'USDC')
    .maybeSingle());

  if (!token?.id) return;

  await supabase.from('store_payment_methods').upsert({
    store_id: storeId,
    network_id: network.id,
    token_id: token.id,
    receiver_wallet: receiverWallet,
    is_default: true,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'store_id,network_id,token_id' });
}

export async function loadPaynetNetwork() {
  if (!hasSupabaseConfig || !supabase) return null;

  const [
    storeTypeRows,
    storeRows,
    staffRows,
    productRows,
    warehouseRows,
    inventoryRows,
    orderRows,
    customerRows,
    pointRows,
  ] = await Promise.all([
    supabase.from('store_types').select('*').order('sort_order'),
    supabase.from('stores').select('*, store_types(name, code)').order('created_at'),
    supabase.from('store_staff').select('*').order('created_at'),
    supabase.from('products').select('*').order('name'),
    supabase.from('warehouses').select('*').order('created_at'),
    supabase.from('inventory').select('*, warehouses(name)').order('updated_at'),
    supabase.from('orders').select('*, order_items(*), payments(*)').order('created_at', { ascending: false }),
    supabase.from('customers').select('*').order('total_spent', { ascending: false }),
    supabase.from('apoint_ledger').select('*').order('created_at', { ascending: false }),
  ]);

  const storeTypes = rows(storeTypeRows);
  const staff = rows(staffRows);
  const products = rows(productRows);
  const warehouses = rows(warehouseRows);
  const inventory = rows(inventoryRows);
  const orders = rows(orderRows);
  const customers = rows(customerRows).map(row => ({
    id: row.id,
    name: row.full_name || 'Wallet Customer',
    wallet: row.wallet_address,
    points: Number(row.point_balance || 0),
    totalSpent: Number(row.total_spent || 0),
    createdAt: row.created_at,
  }));
  const rawPointRows = rows(pointRows);
  const storesById = Object.fromEntries(rows(storeRows).map(store => [store.id, store]));
  const ordersById = Object.fromEntries(orders.map(order => [order.id, order]));
  const pointsHistory = rawPointRows.map(row => mapPointLedger(row, storesById, ordersById));

  const warehouseByProduct = Object.fromEntries(inventory.map(row => [
    row.product_id,
    {
      warehouseId: row.warehouse_id,
      warehouse: row.warehouses?.name || '',
      quantity: Number(row.quantity || 0),
      min: Number(row.min_quantity || 0),
    },
  ]));

  const stores = rows(storeRows).map(store => {
    const storeProducts = products.filter(product => product.store_id === store.id).map(product => mapProduct(product, warehouseByProduct));
    return {
      id: store.id,
      slug: store.slug,
      name: store.name,
      branch: store.branch,
      type: store.store_types?.name || 'Store',
      status: store.status,
      accent: store.accent || '#2563eb',
      imageFolder: store.image_folder,
      ownerWallet: store.owner_wallet,
      receiverWallet: store.receiver_wallet,
      staffMembers: staff.filter(member => member.store_id === store.id).map(mapStaff),
      categories: storeCategories(storeProducts),
      warehouses: warehouses.filter(warehouse => warehouse.store_id === store.id).map(mapWarehouse),
      products: storeProducts,
      orders: orders.filter(order => order.store_id === store.id).map(mapOrder),
      pointsHistory: pointsHistory.filter(point => point.store_id === store.id),
    };
  });

  return { stores, storeTypes, customers, pointsHistory };
}

export async function createStoreRecord(draft) {
  const slug = String(draft.name || 'new-store').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'new-store';
  const type = one(await supabase.from('store_types').select('id').eq('name', draft.type).maybeSingle());
  const payload = {
    slug,
    name: draft.name.trim(),
    branch: draft.branch?.trim() || 'Main Branch',
    store_type_id: type?.id || null,
    owner_wallet: draft.ownerWallet.trim(),
    receiver_wallet: draft.ownerWallet.trim(),
    image_folder: `/png/stores/${slug}/products`,
    status: 'active',
  };
  const store = one(await supabase.from('stores').insert(payload).select('*').single());
  await supabase.from('store_staff').insert({
    store_id: store.id,
    full_name: `${store.name} Owner`,
    role: 'owner',
    wallet_address: store.owner_wallet,
    avatar: 'SO',
  });
  await supabase.from('warehouses').insert({
    store_id: store.id,
    name: 'Main Store',
    address: store.branch,
    status: 'active',
  });
  await syncStoreDefaultPaymentReceiver(store.id, store.owner_wallet);
  return store;
}

export async function updateStoreRecord(storeId, draft) {
  const type = one(await supabase.from('store_types').select('id').eq('name', draft.type).maybeSingle());
  const ownerWallet = draft.ownerWallet.trim();
  const store = one(await supabase.from('stores').update({
    name: draft.name,
    branch: draft.branch,
    store_type_id: type?.id || null,
    status: draft.status,
    owner_wallet: ownerWallet,
    receiver_wallet: ownerWallet,
    updated_at: new Date().toISOString(),
  }).eq('id', storeId).select('*').single());
  await syncStoreDefaultPaymentReceiver(storeId, ownerWallet);
  return store;
}

export async function updateStoreOwnerRecord(storeId, ownerWallet) {
  const wallet = ownerWallet.trim();
  const updatedAt = new Date().toISOString();
  const store = one(await supabase.from('stores').update({
    owner_wallet: wallet,
    receiver_wallet: wallet,
    updated_at: updatedAt,
  }).eq('id', storeId).select('*').single());

  await supabase.from('store_staff').upsert({
    store_id: storeId,
    full_name: `${store.name} Owner`,
    role: 'owner',
    wallet_address: wallet,
    avatar: 'SO',
    is_active: true,
    updated_at: updatedAt,
  }, { onConflict: 'store_id,wallet_address' });

  await syncStoreDefaultPaymentReceiver(storeId, wallet);
  return store;
}

export async function updateStoreStatusRecord(storeId, status) {
  return one(await supabase.from('stores').update({ status, updated_at: new Date().toISOString() }).eq('id', storeId).select('*').single());
}

export async function saveStaffRecord(storeId, staffDraft) {
  const payload = {
    store_id: storeId,
    full_name: staffDraft.name.trim(),
    role: staffDraft.role,
    wallet_address: staffDraft.wallet.trim(),
    is_active: staffDraft.active !== false,
    avatar: staffDraft.role === 'owner' ? 'SO' : 'ST',
    updated_at: new Date().toISOString(),
  };
  if (staffDraft.id && !String(staffDraft.id).startsWith('staff-')) {
    return one(await supabase.from('store_staff').update(payload).eq('id', staffDraft.id).select('*').single());
  }
  return one(await supabase.from('store_staff').insert(payload).select('*').single());
}

export async function disableStaffRecord(staffId) {
  return one(await supabase.from('store_staff').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', staffId).select('*').single());
}

export async function saveProductRecord(storeId, product) {
  const payload = {
    store_id: storeId,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode || null,
    category: product.category || 'Other',
    unit: product.unit || 'unit',
    sell_price: Number(product.price || 0),
    cost_price: Number(product.costPrice || 0),
    stock_quantity: Number(product.stock || 0),
    min_stock: Number(product.min || 0),
    image_url: product.image || '',
    description: product.description || '',
    status: product.status || (product.active === false ? 'inactive' : 'active'),
    updated_at: new Date().toISOString(),
  };
  if (product.id && !String(product.id).startsWith('P') && product.id.length > 20) {
    return one(await supabase.from('products').update(payload).eq('id', product.id).select('*').single());
  }
  return one(await supabase.from('products').insert(payload).select('*').single());
}

export async function updateProductStatusRecord(productId, status) {
  return one(await supabase.from('products').update({ status, updated_at: new Date().toISOString() }).eq('id', productId).select('*').single());
}

export async function addWarehouseRecord(storeId, draft) {
  return one(await supabase.from('warehouses').insert({
    store_id: storeId,
    name: draft.name.trim(),
    address: draft.address?.trim() || '',
    status: draft.status || 'active',
  }).select('*').single());
}

export async function updateWarehouseStatusRecord(warehouseId, status) {
  return one(await supabase.from('warehouses').update({ status, updated_at: new Date().toISOString() }).eq('id', warehouseId).select('*').single());
}

export async function createCheckoutOrder({
  store,
  staff,
  customer,
  cartRows,
  subtotal,
  taxRate,
  taxAmount,
  pointsUsed,
  pointsDiscount,
  total,
}) {
  const token = `${store.slug || store.id}-${Date.now().toString(16)}`;
  const code = `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
  const earned = pointsFromRaw(total);

  const order = one(await supabase.from('orders').insert({
    store_id: store.id,
    staff_id: staff?.id || null,
    customer_id: customer?.id && !String(customer.id).startsWith('C') ? customer.id : null,
    customer_wallet: customer?.wallet || null,
    code,
    checkout_token: token,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_before_points: subtotal + taxAmount,
    apoints_redeemed: pointsUsed,
    discount_amount: pointsDiscount,
    total_amount: total,
    apoints_earned: earned,
    status: 'pending',
    payment_status: 'pending',
  }).select('*').single());

  await supabase.from('order_items').insert(cartRows.map(row => ({
    order_id: order.id,
    product_id: row.id,
    product_name: row.name,
    sku: row.sku,
    quantity: row.qty,
    unit_price: row.price,
    total_price: row.price * row.qty,
  })));

  const arcMethod = one(await supabase
    .from('store_payment_methods')
    .select('*, payment_networks!inner(*), payment_tokens(*)')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .eq('payment_networks.code', 'arc-testnet')
    .maybeSingle());

  const method = arcMethod || one(await supabase
    .from('store_payment_methods')
    .select('*, payment_networks(*), payment_tokens(*)')
    .eq('store_id', store.id)
    .eq('is_default', true)
    .maybeSingle());

  await supabase.from('payments').insert({
    order_id: order.id,
    store_id: store.id,
    network_id: method?.network_id || null,
    token_id: method?.token_id || null,
    receiver_wallet: method?.receiver_wallet || store.receiverWallet,
    amount: total,
    status: 'pending',
  });

  return {
    order_id: order.id,
    order_code: order.code,
    checkout_token: order.checkout_token,
  };
}

export async function loadCheckoutOrder(token) {
  const order = one(await supabase
    .from('orders')
    .select('*, stores(name, branch, receiver_wallet), order_items(*), payments(*, payment_networks(*), payment_tokens(*))')
    .or(`checkout_token.eq.${token},code.eq.${token}`)
    .maybeSingle());

  if (!order) return null;
  const payment = Array.isArray(order.payments) ? order.payments[0] : null;

  return {
    ...mapOrder(order),
    storeName: order.stores?.name,
    storeBranch: order.stores?.branch,
    receiverWallet: payment?.receiver_wallet || order.stores?.receiver_wallet,
    networkCode: payment?.payment_networks?.code || payment?.network || 'arc-testnet',
    paymentNetwork: payment?.payment_networks || null,
    paymentToken: payment?.payment_tokens || null,
  };
}

export async function loadCheckoutPaymentStatus(orderId) {
  if (!hasSupabaseConfig || !supabase || !orderId) return null;

  const order = one(await supabase
    .from('orders')
    .select('*, payments(*, payment_networks(*), payment_tokens(*))')
    .eq('id', orderId)
    .maybeSingle());

  if (!order) return null;

  const payment = Array.isArray(order.payments) ? order.payments[0] : null;
  const rawResponse = payment?.raw_response || {};

  return {
    orderId: order.id,
    code: order.code,
    checkoutToken: order.checkout_token,
    status: order.status || 'pending',
    paymentStatus: order.payment_status || payment?.status || 'pending',
    total: Number(order.total_amount || payment?.amount || 0),
    subtotal: Number(order.subtotal || 0),
    taxAmount: Number(order.tax_amount || 0),
    pointsUsed: Number(order.apoints_redeemed || 0),
    pointsDiscount: Number(order.discount_amount || 0),
    pointsEarned: Number(order.apoints_earned || 0),
    paidAt: order.paid_at || payment?.paid_at || '',
    payerWallet: payment?.payer_wallet || rawResponse.wallet_address || '',
    receiverWallet: payment?.receiver_wallet || rawResponse.receiver_wallet || '',
    txHash: payment?.tx_hash || rawResponse.payment_tx_hash || '',
    proofTxHash: payment?.proof_tx_hash || rawResponse.proof_tx_hash || '',
    proofContractAddress: payment?.proof_contract_address || rawResponse.proof_contract_address || '',
    paymentExplorerUrl: rawResponse.payment_explorer_url || '',
    proofExplorerUrl: rawResponse.proof_explorer_url || '',
    paymentMode: rawResponse.mode || '',
    rawResponse,
  };
}

export async function confirmCheckoutPayment({ orderId, payerWallet, txHash, rawResponse = {} }) {
  const paidAt = new Date().toISOString();
  const redeemedPoints = Number(rawResponse.redeemed_points || 0);
  const redeemedValue = Number(rawResponse.redeemed_value_raw || 0);
  const earnedPoints = Number(rawResponse.earned_points || 0);
  const paidTotal = Number(rawResponse.payable_raw || 0);
  const paymentTxHash = rawResponse.payment_tx_hash || txHash || '';
  const proofTxHash = rawResponse.proof_tx_hash || '';

  const order = one(await supabase
    .from('orders')
    .update({
      status: 'paid',
      payment_status: 'paid',
      paid_at: paidAt,
      updated_at: paidAt,
      apoints_redeemed: redeemedPoints,
      discount_amount: redeemedValue,
      total_amount: paidTotal,
      apoints_earned: earnedPoints,
    })
    .eq('id', orderId)
    .select('*')
    .single());

  const paymentUpdate = {
    payer_wallet: payerWallet,
    tx_hash: txHash,
    chain_id: rawResponse.chain_id || null,
    contract_address: rawResponse.payment_token || null,
    proof_tx_hash: rawResponse.proof_tx_hash || null,
    proof_contract_address: rawResponse.proof_contract_address || null,
    status: 'paid',
    raw_response: rawResponse,
    paid_at: paidAt,
  };

  const paymentResult = await supabase.from('payments').update(paymentUpdate).eq('order_id', orderId);
  if (paymentResult.error) {
    const fallbackUpdate = {
      payer_wallet: payerWallet,
      tx_hash: txHash,
      status: 'paid',
      raw_response: rawResponse,
      paid_at: paidAt,
    };
    const fallbackResult = await supabase.from('payments').update(fallbackUpdate).eq('order_id', orderId);
    if (fallbackResult.error) throw fallbackResult.error;
  }

  if (payerWallet && (earnedPoints > 0 || redeemedPoints > 0)) {
    const existing = one(await supabase.from('customers').select('*').eq('wallet_address', payerWallet).maybeSingle());
    const startingBalance = Number(existing?.point_balance || 0);
    const balance = Number(existing?.point_balance || 0) + earnedPoints - redeemedPoints;
    if (existing) {
      await supabase.from('customers').update({
        point_balance: balance,
        total_spent: Number(existing.total_spent || 0) + paidTotal,
        updated_at: paidAt,
      }).eq('id', existing.id);
    } else {
      await supabase.from('customers').insert({
        wallet_address: payerWallet,
        full_name: 'Wallet Customer',
        point_balance: balance,
        total_spent: paidTotal,
      });
    }

    const store = one(await supabase.from('stores').select('name').eq('id', order.store_id).maybeSingle());
    const ledgerRows = [];
    if (redeemedPoints > 0) {
      ledgerRows.push({
        wallet_address: payerWallet,
        store_id: order.store_id,
        store_name: store?.name || '',
        order_id: order.id,
        invoice_id: order.code,
        type: 'redeemed',
        points: -redeemedPoints,
        balance_after: startingBalance - redeemedPoints,
        tx_hash: paymentTxHash,
        payment_tx_hash: paymentTxHash,
        proof_tx_hash: proofTxHash,
        note: 'Redeemed for checkout discount',
      });
    }
    if (earnedPoints > 0) {
      ledgerRows.push({
        wallet_address: payerWallet,
        store_id: order.store_id,
        store_name: store?.name || '',
        order_id: order.id,
        invoice_id: order.code,
        type: 'earned',
        points: earnedPoints,
        balance_after: balance,
        tx_hash: paymentTxHash,
        payment_tx_hash: paymentTxHash,
        proof_tx_hash: proofTxHash,
        note: 'Earned from USDC payment',
      });
    }
    if (ledgerRows.length) {
      const ledgerResult = await supabase.from('apoint_ledger').insert(ledgerRows);
      if (ledgerResult.error) {
        const fallbackRows = ledgerRows.map(row => ({
          wallet_address: row.wallet_address,
          store_id: row.store_id,
          order_id: row.order_id,
          type: row.type === 'earned' ? 'earn' : row.type === 'redeemed' ? 'redeem' : row.type,
          points: row.points,
          balance_after: row.balance_after,
          tx_hash: row.tx_hash,
          note: row.note,
        }));
        const fallbackResult = await supabase.from('apoint_ledger').insert(fallbackRows);
        if (fallbackResult.error) throw fallbackResult.error;
      }
    }
  }

  return order;
}
