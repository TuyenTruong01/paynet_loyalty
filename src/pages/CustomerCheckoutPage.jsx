import { CheckCircle2, ExternalLink, QrCode, RefreshCw, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase, hasSupabaseConfig } from '../lib/supabaseClient.js';
import { confirmCheckoutPayment, loadCheckoutOrder } from '../services/paynetService.js';
import {
  connectArcTestnetWallet,
  arcTxUrl,
  sendArcTestnetUsdcPayment,
  waitForArcTestnetReceipt,
  ARC_TESTNET_CHAIN,
  ARC_USDC,
} from '../services/arcPayment.js';
import { getActiveEvmProvider } from '../services/evmWallet.js';
import { recordApointPaymentProof } from '../services/apointProofService.js';
import { formatPoints, money, pointsFromRaw, pointsToOnchainUnits, rawFromPoints, redeemablePointsFromRaw, shortAddress } from '../utils/format.js';

function getCheckoutToken() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('token');

  if (fromQuery) return fromQuery;

  const parts = window.location.pathname.split('/').filter(Boolean);
  const checkoutIndex = parts.findIndex(part => part === 'checkout');

  return checkoutIndex >= 0 ? parts[checkoutIndex + 1] : '';
}

const CHECKOUT_STORAGE_KEY = 'paynet.pendingCheckouts';

function findStoredCheckout(token = '') {
  if (!token || typeof window === 'undefined') return null;
  try {
    const rows = JSON.parse(window.localStorage.getItem(CHECKOUT_STORAGE_KEY) || '[]');
    return rows.find(item =>
      item.checkoutToken === token ||
      item.checkout_token === token ||
      item.code === token ||
      item.id === token
    ) || null;
  } catch {
    return null;
  }
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

function isArcTestnetChainId(chainId) {
  if (!chainId) return false;

  const value = String(chainId).toLowerCase();

  if (value === ARC_TESTNET_CHAIN.chainIdHex.toLowerCase()) {
    return true;
  }

  return Number(value) === ARC_TESTNET_CHAIN.chainIdDecimal;
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
  const [walletChainReady, setWalletChainReady] = useState(false);
  const [walletCustomer, setWalletCustomer] = useState(null);
  const [availablePoints, setAvailablePoints] = useState(0);

  const [usePoints, setUsePoints] = useState(false);
  const [redeemInput, setRedeemInput] = useState(0);
  const [status, setStatus] = useState('ready');
  const [txHash, setTxHash] = useState('');
  const [proofTxHash, setProofTxHash] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadCheckout() {
      setLoading(true);
      setErrorMessage('');

      try {
        let checkoutFound = false;

        if (hasSupabaseConfig && supabase && token) {
          const mapped = await loadCheckoutOrder(token);

          if (mapped) {
            setOrder(mapped);
            setCustomerWallet('');
            setWalletConnected(false);
            setWalletChainReady(false);
            setWalletCustomer(null);
            setAvailablePoints(0);
            setUsePoints(false);
            setRedeemInput(0);

            if (mapped.paymentStatus === 'paid' || mapped.status === 'paid') {
              setStatus('paid');
              setTxHash(mapped.txHash || '');
              setProofTxHash(mapped.proofTxHash || '');
            } else {
              setStatus('ready');
              setTxHash('');
              setProofTxHash('');
            }

            checkoutFound = true;
          }
        }

        if (!checkoutFound) {
          const found = demoOrders.find(
            item =>
              item.checkoutToken === token ||
              item.checkout_token === token ||
              item.code === token ||
              item.id === token
          ) || findStoredCheckout(token);

          if (found) {
            setOrder(found);
            setAvailablePoints(0);
            setUsePoints(false);
            setRedeemInput(0);
            setStatus(found.paymentStatus === 'paid' || found.status === 'paid' ? 'paid' : 'ready');
            setTxHash(found.txHash || '');
            setProofTxHash(found.proofTxHash || '');
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

  useEffect(() => {
    if (!walletConnected) return undefined;

    const ethereum = getActiveEvmProvider();

    if (!ethereum) return undefined;

    let mounted = true;

    const syncChain = async () => {
      try {
        const chainId = await ethereum.request({ method: 'eth_chainId' });

        if (!mounted) return;

        const ready = isArcTestnetChainId(chainId);
        setWalletChainReady(ready);

        if (ready) {
          setErrorMessage('');
        } else {
          setErrorMessage(`Wallet connected. Please switch your wallet to ${ARC_TESTNET_CHAIN.label} before paying.`);
        }
      } catch (error) {
        if (mounted) {
          setWalletChainReady(false);
          setErrorMessage(error.message || `Wallet connected. Please switch your wallet to ${ARC_TESTNET_CHAIN.label} before paying.`);
        }
      }
    };

    const handleAccountsChanged = accounts => {
      const nextAddress = Array.isArray(accounts) ? accounts[0] : '';

      if (nextAddress) {
        setCustomerWallet(nextAddress);
        setWalletConnected(true);
      }
    };

    const handleChainChanged = chainId => {
      const ready = isArcTestnetChainId(chainId);
      setWalletChainReady(ready);
      setErrorMessage(ready ? '' : `Wallet connected. Please switch your wallet to ${ARC_TESTNET_CHAIN.label} before paying.`);
    };

    const handleDisconnect = () => {
      setWalletConnected(false);
      setWalletChainReady(false);
      setCustomerWallet('');
      setWalletCustomer(null);
      setAvailablePoints(0);
      setUsePoints(false);
      setRedeemInput(0);
    };

    syncChain();

    ethereum.on?.('accountsChanged', handleAccountsChanged);
    ethereum.on?.('chainChanged', handleChainChanged);
    ethereum.on?.('disconnect', handleDisconnect);
    ethereum.on?.('session_delete', handleDisconnect);

    return () => {
      mounted = false;
      ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      ethereum.removeListener?.('chainChanged', handleChainChanged);
      ethereum.removeListener?.('disconnect', handleDisconnect);
      ethereum.removeListener?.('session_delete', handleDisconnect);
    };
  }, [walletConnected]);

  async function connectWallet() {
    setErrorMessage('');

    try {
      const wallet = await connectArcTestnetWallet();
      const walletAddress = wallet.address;

      setCustomerWallet(walletAddress);
      setWalletConnected(true);
      setWalletChainReady(Boolean(wallet.chainReady));
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

      if (!wallet.chainReady) {
        setErrorMessage(
          wallet.chainError?.message ||
          `Wallet connected. Please switch your wallet to ${ARC_TESTNET_CHAIN.label} before paying.`
        );
      }
    } catch (error) {
      console.error(error);
      setWalletConnected(false);
      setWalletChainReady(false);
      setCustomerWallet('');
      setWalletCustomer(null);
      setAvailablePoints(0);
      setUsePoints(false);
      setRedeemInput(0);
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
  const checkoutStore = {
    name: order?.storeName || store?.name || 'Store',
    branch: order?.storeBranch || store?.branch || 'Checkout',
  };
  const checkoutReceiverWallet = order?.receiverWallet || receiverWallet;
  const paymentTokenSymbol = ARC_USDC.symbol;

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
  const maxRedeemPoints = Math.min(availablePoints, redeemablePointsFromRaw(maxDiscountRaw));
  const safeRedeemInput = Math.max(
    0,
    Math.min(maxRedeemPoints, Number(redeemInput) || 0)
  );
  const redeemPoints = usePoints ? safeRedeemInput : 0;

  const redeemedValue = rawFromPoints(redeemPoints);
  const payable = Math.max(totalBeforePoints - redeemedValue, 0);
  const earnedPoints = pointsFromRaw(payable);

  useEffect(() => {
    if (!usePoints) {
      setRedeemInput(0);
      return;
    }

    setRedeemInput(current => Math.max(
      0,
      Math.min(maxRedeemPoints, Number(current) || 0)
    ));
  }, [maxRedeemPoints, usePoints]);

  function updateUsePoints(checked) {
    setUsePoints(checked);
    setRedeemInput(checked ? maxRedeemPoints : 0);
  }

  function updateRedeemPoints(value) {
    const next = Math.max(
      0,
      Math.min(maxRedeemPoints, Number(value) || 0)
    );

    setRedeemInput(next);
    setUsePoints(next > 0);
  }

  function updateRedeemPercent(percent) {
    updateRedeemPoints(Number((maxRedeemPoints * percent / 100).toFixed(4)));
  }

  async function payWithWallet() {
    if (!order) return;

    setErrorMessage('');
    setTxHash('');
    setProofTxHash('');
    setStatus('paying');

    try {
      const wallet = walletConnected && customerWallet && walletChainReady
        ? { address: customerWallet, chainReady: true }
        : await connectArcTestnetWallet();

      const walletAddress = wallet.address;

      setCustomerWallet(walletAddress);
      setWalletConnected(true);
      setWalletChainReady(Boolean(wallet.chainReady));

      if (!wallet.chainReady) {
        setStatus('ready');
        setErrorMessage(
          wallet.chainError?.message ||
          `Wallet connected. Please switch your wallet to ${ARC_TESTNET_CHAIN.label} before paying.`
        );
        return;
      }

      let customer = walletCustomer;

      if (hasSupabaseConfig && supabase && walletAddress) {
        customer = await findOrCreateCustomerByWallet(walletAddress, order, store);

        setWalletCustomer(customer);
        setAvailablePoints(Number(customer?.point_balance || 0));

        if (order?.id && customer?.id && status !== 'paid') {
          await attachOrderToCustomer(order.id, customer.id);
        }
      }

      setStatus('confirming');

      const paymentTxHash = await sendArcTestnetUsdcPayment({
        from: walletAddress,
        to: checkoutReceiverWallet,
        rawAmount: payable,
        provider: wallet.provider,
      });

      setTxHash(paymentTxHash);

      const paymentReceipt = await waitForArcTestnetReceipt(paymentTxHash, {
        provider: wallet.provider,
      });

      if (String(paymentReceipt?.status || '').toLowerCase() === '0x0') {
        throw new Error('USDC payment reverted. The invoice was not marked as paid.');
      }

      const proof = await recordApointPaymentProof({
        from: walletAddress,
        invoiceId: order.code,
        customerWallet: walletAddress,
        storeWallet: checkoutReceiverWallet,
        amount: payable,
        points: pointsToOnchainUnits(earnedPoints),
      });

      setProofTxHash(proof.txHash);

      if (hasSupabaseConfig && supabase && order.id && !String(order.id).startsWith('demo')) {
        await confirmCheckoutPayment({
          orderId: order.id,
          payerWallet: walletAddress,
          txHash: paymentTxHash,
          rawResponse: {
            mode: 'arc-testnet-usdc-payment-with-apoint-proof',
            chain_id: ARC_TESTNET_CHAIN.chainIdDecimal,
            network: ARC_TESTNET_CHAIN.code,
            receiver_wallet: checkoutReceiverWallet,
            payable_raw: payable,
            redeemed_points: redeemPoints,
            redeemed_value_raw: redeemedValue,
            earned_points: earnedPoints,
            proof_points_scale: 10000,
            proof_points_units: pointsToOnchainUnits(earnedPoints),
            payment_token: ARC_USDC.address,
            payment_tx_hash: paymentTxHash,
            payment_block_number: paymentReceipt?.blockNumber || '',
            payment_explorer_url: arcTxUrl(paymentTxHash),
            proof_tx_hash: proof.txHash,
            proof_block_number: proof.blockNumber || '',
            proof_contract_address: proof.contractAddress,
            proof_explorer_url: proof.explorerUrl,
            wallet_customer_id: customer?.id || null,
            wallet_address: walletAddress,
          },
        });

        await refreshWalletCustomerPoints(walletAddress);
      }

      setStatus('paid');
    } catch (error) {
      console.error(error);
      setStatus('ready');
      setErrorMessage(error.message || 'Arc Testnet payment failed.');
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
          <p>Please ask the cashier to generate a new checkout QR.</p>
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
            <p className="eyebrow">Paynet Checkout</p>
            <h1>{checkoutStore.name}</h1>
            <span>{checkoutStore.branch} · {paymentTokenSymbol} Payment</span>
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
            <strong>{formatPoints(walletConnected ? availablePoints : 0)} pts</strong>
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
                onChange={event => updateUsePoints(event.target.checked)}
              />
              Use loyalty points before signing payment
            </label>

            {usePoints && (
              <div className="redeem-control">
                <div className="redeem-control-head">
                  <label>
                    <span>APoint to redeem</span>
                    <input
                      type="number"
                      min="0"
                      max={maxRedeemPoints}
                      step="0.0001"
                      value={safeRedeemInput}
                      onChange={event => updateRedeemPoints(event.target.value)}
                    />
                  </label>
                  <strong>-{money(rawFromPoints(safeRedeemInput))}</strong>
                </div>

                <input
                  className="redeem-slider"
                  type="range"
                  min="0"
                  max={maxRedeemPoints}
                  value={safeRedeemInput}
                  onChange={event => updateRedeemPoints(event.target.value)}
                />

                <div className="redeem-quick-row">
                  {[25, 50, 75, 100].map(percent => (
                    <button
                      key={percent}
                      type="button"
                      className={safeRedeemInput === Number((maxRedeemPoints * percent / 100).toFixed(4)) ? 'active' : ''}
                      onClick={() => updateRedeemPercent(percent)}
                    >
                      {percent}%
                    </button>
                  ))}
                </div>

                <small>Max redeem: {formatPoints(maxRedeemPoints)} pts</small>
              </div>
            )}

            <p className="helper-text">
              Loyalty account: <strong>{walletCustomer?.full_name || shortAddress(customerWallet)}</strong>.
              New loyalty points will be earned from the actual paid amount: <strong>{formatPoints(earnedPoints)} pts</strong>.
            </p>

            {!walletChainReady && (
              <p className="helper-text warn-text">
                Wallet connected. Please switch your wallet to {ARC_TESTNET_CHAIN.label} before paying.
              </p>
            )}

            <button
              className="success full public-pay-button"
              type="button"
              disabled={
                !walletChainReady ||
                status === 'paying' ||
                status === 'confirming' ||
                status === 'paid'
              }
              onClick={payWithWallet}
            >
              {status === 'paying' || status === 'confirming'
                ? <RefreshCw className="spin" size={16} />
                : <CheckCircle2 size={16} />}
              {status === 'paid'
                ? 'Payment Confirmed'
                : status === 'confirming'
                  ? 'Waiting for payment confirmation...'
                  : `Pay with ${paymentTokenSymbol}`}
            </button>
          </>
        )}

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        {status === 'paid' && (
          <p className="payment-confirmation-note">
            <CheckCircle2 size={16} /> Payment confirmed. Your receipt has been recorded.
          </p>
        )}

        {txHash && (
          <a
            className="explorer-link"
            href={arcTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
          >
            View USDC payment transaction <ExternalLink size={14} />
          </a>
        )}

        {proofTxHash && (
          <a
            className="explorer-link"
            href={arcTxUrl(proofTxHash)}
            target="_blank"
            rel="noreferrer"
          >
            View APoint proof transaction <ExternalLink size={14} />
          </a>
        )}
      </section>
    </main>
  );
}
