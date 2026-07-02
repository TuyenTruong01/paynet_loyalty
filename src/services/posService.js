import { supabase } from '../lib/supabaseClient.js';
import { ARC_TESTNET } from '../utils/arcConfig.js';
import { makeMockTx } from '../utils/format.js';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function normalizeNullableUuid(value) {
  const text = String(value || '').trim();
  return isUuid(text) ? text : null;
}

function normalizeItems(items = []) {
  return items
    .filter((item) => item?.id && Number(item?.qty || 0) > 0)
    .map((item) => ({
      product_id: item.id,
      quantity: Number(item.qty || 1),
    }));
}

export async function createPosOrder({
  storeId,
  staffId,
  customerId,
  items,
  pointsUsed = 0,
  pointsDiscount = 0,
  taxRate = 10,
  taxAmount = 0,
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const payload = normalizeItems(items);

  if (!payload.length) {
    throw new Error('Cannot create invoice without products.');
  }

  const safeStoreId = normalizeNullableUuid(storeId);
  const safeStaffId = normalizeNullableUuid(staffId);
  const safeCustomerId = normalizeNullableUuid(customerId);

  if (!safeStoreId) {
    throw new Error('Invalid store_id. Please check store settings or seed data.');
  }

  // Existing RPC already subtracts points_used * store_settings.point_value.
  // The extra discount amount makes the demo UI total match the 100 pts = 1 USDC policy
  // without changing the database schema yet.
  const extraDiscountForUiPolicy = Math.max(
    Number(pointsDiscount || 0) - Number(pointsUsed || 0),
    0
  );

  const { data, error } = await supabase.rpc('create_pos_order', {
    p_store_id: safeStoreId,
    p_staff_id: safeStaffId,
    p_customer_id: safeCustomerId,
    p_items: payload,
    p_points_used: Number(pointsUsed || 0),
    p_discount_amount: extraDiscountForUiPolicy,
    p_note: `ArcPay Loyalty crypto checkout | tax_rate=${Number(
      taxRate || 0
    )}% | tax_amount=${Number(taxAmount || 0)}`,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
}

export async function confirmArcPayment({
  orderId,
  payerWallet,
  checkoutToken,
  txHash,
  rawResponse = {},
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const safeOrderId = normalizeNullableUuid(orderId);

  if (!safeOrderId) {
    throw new Error('Invalid order_id. Cannot confirm payment.');
  }

  const finalTxHash = txHash || makeMockTx();

  const { data, error } = await supabase.rpc('confirm_arc_payment', {
    p_order_id: safeOrderId,
    p_tx_hash: finalTxHash,
    p_payer_wallet: payerWallet || '0xguest_mock_wallet',
    p_raw_response: {
      network: 'arc-testnet',
      chain_id: ARC_TESTNET.chainIdDecimal,
      mode: txHash ? 'real-arc-usdc-erc20-transfer' : 'mock-crypto-payment',
      checkout_token: checkoutToken,
      currency: 'USDC',
      tx_hash: finalTxHash,
      ...rawResponse,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}