import { displayCategoryName, displayProductName, productEmoji } from './productNames.js';

export function mapStore(row) {
  return {
    id: row?.id || null,
    name: row?.name ? row.name.replace('Tạp hóa Minh Châu', 'Minh Chau Grocery') : 'Minh Chau Grocery',
    branch: row?.branch_name ? row.branch_name.replace('Chi nhánh Đà Nẵng', 'Da Nang Branch') : 'Da Nang Branch',
    network: 'Arc Testnet',
  };
}

export function mapStaff(row) {
  const rawRole = row?.role || 'manager';
  return {
    id: row?.id || null,
    name: row?.full_name || row?.name || 'Nguyen Van A',
    role: roleLabel(rawRole),
    roleKey: String(rawRole || 'staff').toLowerCase(),
    wallet: row?.wallet_address || row?.wallet || '0x1234abcd5678ef901234abcd5678ef901234abcd',
    avatar: row?.avatar || (String(rawRole).toLowerCase() === 'manager' ? '👨🏻‍💼' : '👩🏻‍💼'),
    active: row?.is_active !== false,
    createdAt: row?.created_at,
    raw: row,
  };
}

export function mapProduct(row, categoryMap = {}) {
  const categoryName = row?.categories?.name || categoryMap[row?.category_id] || 'Other';
  return {
    id: row.id,
    rawId: row.id,
    name: displayProductName(row.name),
    originalName: row.name,
    sku: row.sku || row.barcode || row.id?.slice(0, 8) || 'SKU',
    barcode: row.barcode || '',
    category: displayCategoryName(categoryName),
    categoryId: row.category_id,
    price: Number(row.sell_price || 0),
    costPrice: Number(row.cost_price || 0),
    stock: Number(row.stock_quantity || 0),
    min: Number(row.min_stock || 0),
    unit: row.unit || 'unit',
    description: row.description || row.note || '',
    image: row.image_url || '',
    emoji: productEmoji(row.name),
    active: row.is_active !== false,
    raw: row,
  };
}

export function mapCustomer(row) {
  return {
    id: row.id,
    name: row.full_name || 'Arc Wallet Customer',
    wallet: row.wallet_address || '',
    points: Number(row.point_balance || 0),
    totalSpent: Number(row.total_spent || 0),
    phone: row.phone || '',
    note: row.note || '',
    createdAt: row.created_at,
    raw: row,
  };
}

export function mapOrderItem(row = {}) {
  return {
    id: row.id || `${row.product_id}-${row.product_name}`,
    productId: row.product_id,
    name: displayProductName(row.product_name || row.products?.name || 'Product'),
    sku: row.products?.sku || row.products?.barcode || row.product_id?.slice(0, 8) || '-',
    qty: Number(row.quantity || 0),
    unitPrice: Number(row.unit_price || 0),
    total: Number(row.total_price || 0),
  };
}

export function mapOrder(row) {
  const payments = Array.isArray(row.payments) ? row.payments : [];
  const latestPayment = payments[0] || null;
  return {
    id: row.id,
    code: row.code || row.id,
    customer: row.customers?.full_name || row.customers?.wallet_address || 'Guest',
    customerWallet: row.customers?.wallet_address || latestPayment?.payer_wallet || '',
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount_amount || 0),
    pointsUsed: Number(row.points_used || 0),
    pointsDiscount: Number(row.points_discount || 0) + Number(row.discount_amount || 0),
    total: Number(row.total_amount || 0),
    status: row.status || 'draft',
    paymentStatus: row.payment_status || 'unpaid',
    paymentMethod: row.payment_method || 'arc',
    checkoutToken: row.checkout_token || '',
    txHash: latestPayment?.tx_hash || '',
    network: latestPayment?.network || 'arc-testnet',
    paidAt: row.paid_at || latestPayment?.paid_at,
    createdAt: row.created_at,
    items: Array.isArray(row.order_items) ? row.order_items.map(mapOrderItem) : [],
    raw: row,
  };
}

export function mapInventory(row) {
  const product = row.products || {};
  return {
    id: row.id,
    productId: row.product_id,
    name: displayProductName(product.name || row.product_name || 'Product'),
    sku: product.sku || product.barcode || row.product_id?.slice(0, 8) || '-',
    costPrice: Number(product.cost_price || 0),
    sellPrice: Number(product.sell_price || 0),
    quantity: Number(row.quantity ?? product.stock_quantity ?? 0),
    min: Number(row.min_quantity ?? product.min_stock ?? 0),
    warehouse: row.warehouses?.name || 'Main Store',
    active: product.is_active !== false,
    emoji: productEmoji(product.name || row.product_name),
  };
}

export function mapWarehouse(row) {
  return {
    id: row.id,
    name: row.name || 'Main Store',
    address: row.address || '',
    active: row.is_active !== false,
    createdAt: row.created_at,
  };
}

export function mapPurchaseOrder(row) {
  return {
    id: row.id,
    code: row.code || row.id,
    supplier: row.suppliers?.name || 'Supplier',
    status: row.status || 'draft',
    total: Number(row.total_amount || 0),
    createdAt: row.created_at,
    items: Array.isArray(row.purchase_order_items) ? row.purchase_order_items.map(item => ({
      id: item.id,
      product: displayProductName(item.products?.name || 'Product'),
      qty: Number(item.quantity || 0),
      costPrice: Number(item.cost_price || 0),
      total: Number(item.total_price || 0),
    })) : [],
  };
}

export function roleLabel(role) {
  const roles = {
    owner: 'Owner',
    manager: 'Manager',
    cashier: 'Cashier',
    warehouse: 'Warehouse',
    accountant: 'Accountant',
  };
  return roles[role] || role || 'Staff';
}
