import { CheckCircle2, ExternalLink, QrCode, RefreshCw, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase, hasSupabaseConfig } from '../lib/supabaseClient.js';
import { confirmArcPayment } from '../services/posService.js';
import { connectArcWallet, sendArcUsdcTransfer, waitForArcReceipt } from '../services/arcWallet.js';
import { ARC_TESTNET, arcScanTxUrl } from '../utils/arcConfig.js';
import { money, pointsFromRaw, rawFromPoints, shortAddress } from '../utils/format.js';
import { mapOrder } from '../utils/mappers.js';

function getCheckoutToken() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('token');

  if (fromQuery) return fromQuery;

  const parts = window.location.pathname.split('/').filter(Boolean);
  const checkoutIndex = parts.findIndex(part => part === 'checkout');

  return checkoutIndex >= 0 ? parts[checkoutIndex + 1] : '';
}

function normalizeWallet(wallet = '') {
  return String(wallet || '').trim().toLowerCase();
}

function getOrderStoreId(order = {}, store = {}) {
  return (
    order?.storeId ||
    order?.store_id ||
    order?.raw?.store_id ||
    store?.id ||
    null
  );
}

async function insertCustomerWithFallback(walletAddress, order, store) {
  const safeWallet = String(walletAddress || '').trim();
  const storeId = getOrderStoreId(order, store);

  const basePayload = {
    full_name: `Wallet ${shortAddress(safeWallet)}`,
    wallet_address: safeWallet,
    point_balance: 0,
  };

  const payloads = [
    storeId
      ? {
          ...basePayload,
          store_id: storeId,
          total_spent: 0,
          is_active: true,
        }
      : {
          ...basePayload,
          total_spent: 0,
          is_active: true,
        },
    storeId
      ? {
          ...basePayload,
          store_id: storeId,
        }
      : basePayload,
    basePayload,
    {
      full_name: `Wallet ${shortAddress(safeWallet)}`,
      wallet_address: safeWallet,
    },
  ];

  let lastError = null;

  for (const payload of payloads) {
    const { data, error } = await supabase
      .from('customers')
      .insert(payload)
      .select('*')
      .single();

    if (!error && data) {
      return data;
    }

    lastError = error;
  }

  throw lastError || new Error('Cannot create customer for connected wallet.');
}

async function findOrCreateCustomerByWallet(walletAddress, order, store) {
  if (!hasSupabaseConfig || !supabase || !walletAddress) {
    return null;
  }

  const safeWallet = String(walletAddress || '').trim();

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('wallet_address', safeWallet)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  return insertCustomerWithFallback(safeWallet, order, store);
}

async function attachOrderToCustomer(orderId, customerId) {
  if (!hasSupabaseConfig || !supabase || !orderId || !customerId) {
    return;
  }

  if (String(orderId).startsWith('demo')) {
    return;
  }

  const { error } = await supabase
    .from('orders')
    .update({ customer_id: customerId })
    .eq('id', orderId);

  if (error) {
    console.warn('Cannot attach order to wallet customer:', error.message || error);
  }
}

export default function CustomerCheckoutPage({
  demoOrders = [],
  settings = {},
  store = {},
  receiverWallet = '',
}) {
  const token = getCheckoutToken();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);

  const [customerWallet, setCustomerWallet] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletCustomer, setWalletCustomer] = useState(null);
  const [availablePoints, setAvailablePoints] = useState(0);

  const [usePoints, setUsePoints] = useState(false);
  const [status, setStatus] = useState('ready');
  const [txHash, setTxHash] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadCheckout() {
      setLoading(true);
      setErrorMessage('');

      try {
        if (hasSupabaseConfig && supabase && token) {
          const { data, error } = await supabase
            .from('orders')
            .select('*, customers(full_name, wallet_address, point_balance), order_items(*, products(name, sku, barcode)), payments(*)')
            .or(`checkout_token.eq.${token},code.eq.${token}`)
            .limit(1)
            .maybeSingle();

          if (error) throw error;

          if (data) {
            const mapped = mapOrder(data);

            setOrder({
              ...mapped,
              raw: data,
              storeId: data.store_id,
            });

            /**
             * Important:
             * Do NOT load loyalty points from the invoice customer here.
             * Loyalty points must follow the wallet that connects on this checkout page.
             *
             * Flow:
             * 1. POS creates invoice as Guest or selected customer.
             * 2. Customer opens checkout.
             * 3. Customer connects wallet.
             * 4. App finds/creates customer by wallet_address.
             * 5. Points are loaded from that wallet customer only.
             */
            setCustomerWallet('');
            setWalletConnected(false);
            setWalletCustomer(null);
            setAvailablePoints(0);
            setUsePoints(false);

            if (mapped.paymentStatus === 'paid' || mapped.status === 'paid') {
              setStatus('paid');
              setTxHash(mapped.txHash || '');
            } else {
              setStatus('ready');
              setTxHash('');
            }
          }
        } else {
          const found = demoOrders.find(
            item =>
              item.checkoutToken === token ||
              item.code === token ||
              item.id === token
          );

          if (found) {
            setOrder(found);
            setAvailablePoints(0);
            setUsePoints(false);
          }
        }
      } catch (error) {
        console.error(error);
        setErrorMessage(error.message || 'Cannot load checkout.');
      } finally {
        setLoading(false);
      }
    }

    loadCheckout();
  }, [token, demoOrders]);

  async function connectWallet() {
    setErrorMessage('');

    try {
      const wallet = await connectArcWallet();
      const walletAddress = wallet.address;

      setCustomerWallet(walletAddress);
      setWalletConnected(true);
      setUsePoints(false);

      if (hasSupabaseConfig && supabase && walletAddress) {
        const customer = await findOrCreateCustomerByWallet(walletAddress, order, store);

        setWalletCustomer(customer);
        setAvailablePoints(Number(customer?.point_balance || 0));

        if (order?.id && customer?.id && status !== 'paid') {
          await attachOrderToCustomer(order.id, customer.id);
        }
      } else {
        setWalletCustomer(null);
        setAvailablePoints(0);
      }
    } catch (error) {
      console.error(error);
      setWalletConnected(false);
      setCustomerWallet('');
      setWalletCustomer(null);
      setAvailablePoints(0);
      setUsePoints(false);
      setErrorMessage(error.message || 'Cannot connect wallet.');
    }
  }

  async function refreshWalletCustomerPoints(walletAddress) {
    if (!hasSupabaseConfig || !supabase || !walletAddress) {
      return;
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .ilike('wallet_address', walletAddress)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setWalletCustomer(data);
      setAvailablePoints(Number(data.point_balance || 0));
    }
  }

  const taxRate = Number(settings.taxRate || 10);

  const subtotal = useMemo(() => {
    if (!order) return 0;

    if (Number(order.subtotal || 0) > 0) {
      return Number(order.subtotal || 0);
    }

    return (order.items || []).reduce(
      (sum, item) =>
        sum + Number(item.total || item.unitPrice * item.qty || 0),
      0
    );
  }, [order]);

  const taxAmount = Math.round(subtotal * taxRate / 100);
  const totalBeforePoints = subtotal + taxAmount;

  const maxDiscountRaw = Math.floor(totalBeforePoints * 0.2);
  const redeemPoints = usePoints
    ? Math.min(availablePoints, Math.floor(maxDiscountRaw / 100))
    : 0;

  const redeemedValue = rawFromPoints(redeemPoints);
  const payable = Math.max(totalBeforePoints - redeemedValue, 0);
  const earnedPoints = pointsFromRaw(payable);

  async function payWithArc() {
    if (!order) return;

    setErrorMessage('');
    setStatus('paying');

    try {
      const wallet = walletConnected && customerWallet
        ? { address: customerWallet }
        : await connectArcWallet();

      const walletAddress = wallet.address;

      setCustomerWallet(walletAddress);
      setWalletConnected(true);

      let customer = walletCustomer;

      if (hasSupabaseConfig && supabase && walletAddress) {
        customer = await findOrCreateCustomerByWallet(walletAddress, order, store);

        setWalletCustomer(customer);
        setAvailablePoints(Number(customer?.point_balance || 0));

        if (order?.id && customer?.id && status !== 'paid') {
          await attachOrderToCustomer(order.id, customer.id);
        }
      }

      const submittedHash = await sendArcUsdcTransfer({
        from: walletAddress,
        to: receiverWallet,
        rawAmount: payable,
      });

      setTxHash(submittedHash);
      setStatus('confirming');

      const receipt = await waitForArcReceipt(submittedHash);

      if (String(receipt?.status || '').toLowerCase() === '0x0') {
        throw new Error('Arc transaction reverted. The invoice was not marked as paid.');
      }

      if (hasSupabaseConfig && supabase && order.id && !String(order.id).startsWith('demo')) {
        await confirmArcPayment({
          orderId: order.id,
          payerWallet: walletAddress,
          checkoutToken: token || order.checkoutToken,
          txHash: submittedHash,
          rawResponse: {
            mode: 'real-arc-usdc-erc20-transfer',
            chain_id: ARC_TESTNET.chainIdDecimal,
            network: 'arc-testnet',
            receiver_wallet: receiverWallet,
            payable_raw: payable,
            redeemed_points: redeemPoints,
            redeemed_value_raw: redeemedValue,
            earned_points: earnedPoints,
            tx_hash: submittedHash,
            wallet_customer_id: customer?.id || null,
            wallet_address: walletAddress,
            receipt,
          },
        });

        await refreshWalletCustomerPoints(walletAddress);
      }

      setStatus('paid');
    } catch (error) {
      console.error(error);
      setStatus('ready');
      setErrorMessage(error.message || 'Arc payment failed.');
    }
  }

  if (loading) {
    return (
      <main className="customer-checkout">
        <section className="checkout-public-card">
          <RefreshCw className="spin" /> Loading checkout...
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="customer-checkout">
        <section className="checkout-public-card center-card">
          <QrCode size={44} />
          <h1>Checkout not found</h1>
          <p>Please ask the cashier to generate a new ArcPay checkout QR.</p>
          {errorMessage && <p className="error-text">{errorMessage}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="customer-checkout">
      <section className="checkout-public-card">
        <div className="checkout-public-head">
          <div className="logo-mark">A</div>
          <div>
            <p className="eyebrow">ArcPay Checkout</p>
            <h1>{store?.name || 'Minh Chau Grocery'}</h1>
            <span>{store?.branch || 'Da Nang Branch'} · {ARC_TESTNET.chainName}</span>
          </div>
        </div>

        <div className="checkout-invoice-title">
          <div>
            <span>Invoice</span>
            <strong>{order.code}</strong>
          </div>
          <span className={`badge ${status === 'paid' ? 'ok' : 'warn'}`}>
            {status === 'paid' ? 'Paid' : 'Pending'}
          </span>
        </div>

        <table className="data-table public-items">
          <thead>
            <tr>
              <th>No.</th>
              <th>Product</th>
              <th>Code</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, index) => (
              <tr key={item.id || index}>
                <td>{index + 1}</td>
                <td><strong>{item.name}</strong></td>
                <td>{item.sku || '-'}</td>
                <td>{item.qty}</td>
                <td>{money(item.unitPrice)}</td>
                <td>{money(item.total || item.unitPrice * item.qty)}</td>
              </tr>
            ))}

            {!(order.items || []).length && (
              <tr>
                <td colSpan="6" className="empty-row">No invoice items found.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="public-summary-grid">
          <p><span>Subtotal</span><strong>{money(subtotal)}</strong></p>
          <p><span>Tax ({taxRate}%)</span><strong>{money(taxAmount)}</strong></p>
          <p><span>Total before points</span><strong>{money(totalBeforePoints)}</strong></p>
          <p>
            <span>Available points</span>
            <strong>{walletConnected ? availablePoints : 0} pts</strong>
          </p>
          <p><span>Redeemed value</span><strong>-{money(redeemedValue)}</strong></p>
          <p className="total"><span>Payable</span><strong>{money(payable)}</strong></p>
        </div>

        {!walletConnected ? (
          <>
            <button
              className="primary full public-pay-button"
              type="button"
              onClick={connectWallet}
            >
              <Wallet size={18} /> Connect Wallet
            </button>
            <p className="helper-text">
              Loyalty points will be loaded from the wallet you connect. A new wallet starts with 0 pts.
            </p>
          </>
        ) : (
          <>
            <div className="connected-public-wallet">
              <Wallet size={18} /> Connected wallet: <strong>{shortAddress(customerWallet)}</strong>
            </div>

            <label className={`check-line ${availablePoints <= 0 ? 'muted' : ''}`}>
              <input
                type="checkbox"
                disabled={
                  availablePoints <= 0 ||
                  status === 'paid' ||
                  status === 'paying' ||
                  status === 'confirming'
                }
                checked={usePoints}
                onChange={event => setUsePoints(event.target.checked)}
              />
              Use loyalty points before signing payment
            </label>

            <p className="helper-text">
              Loyalty account: <strong>{walletCustomer?.full_name || shortAddress(customerWallet)}</strong>.
              New loyalty points will be earned from the actual paid amount: <strong>{earnedPoints} pts</strong>.
            </p>

            <button
              className="success full public-pay-button"
              type="button"
              disabled={status === 'paying' || status === 'confirming' || status === 'paid'}
              onClick={payWithArc}
            >
              {status === 'paying' || status === 'confirming'
                ? <RefreshCw className="spin" size={16} />
                : <CheckCircle2 size={16} />}
              {status === 'paid'
                ? 'Payment Confirmed'
                : status === 'confirming'
                  ? 'Waiting for Arc finality...'
                  : 'Pay with Arc USDC'}
            </button>
          </>
        )}

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        {txHash && (
          <a
            className="explorer-link"
            href={arcScanTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
          >
            View transaction on ArcScan <ExternalLink size={14} />
          </a>
        )}

        <div className="payment-info public-payment-info">
          <p><span>Receiver</span><strong>{shortAddress(receiverWallet)}</strong></p>
          <p><span>Network</span><strong>{ARC_TESTNET.chainName}</strong></p>
          <p><span>USDC Contract</span><strong>{shortAddress('0x3600000000000000000000000000000000000000')}</strong></p>
          <p><span>Checkout token</span><strong>{token || order.checkoutToken || '-'}</strong></p>
        </div>
      </section>
    </main>
  );
}