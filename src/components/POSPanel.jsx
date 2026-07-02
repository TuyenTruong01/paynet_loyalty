import { CheckCircle2, Copy, ExternalLink, Minus, Plus, QrCode, ReceiptText, RefreshCw, Search, Trash2, Wallet } from 'lucide-react';
import { money, shortAddress } from '../utils/format.js';

export default function POSPanel({
  invoiceActive,
  onCreateInvoice,
  cartRows,
  customers,
  customerId,
  setCustomerId,
  productSearch,
  setProductSearch,
  onSearchSubmit,
  changeQty,
  removeItem,
  subtotal,
  taxRate,
  taxAmount,
  grossTotal,
  pointsUsed,
  setPointsUsed,
  pointsDiscount,
  total,
  pointsEarned,
  selectedCustomer,
  onCreateCheckout,
  onConfirmMockPayment,
  checkout,
  paymentStatus,
  receiverWallet,
}) {
  const checkoutToken = checkout?.checkout_token || checkout?.checkoutToken || '';
  const checkoutLink = checkoutToken ? `${window.location.origin}/checkout/${checkoutToken}` : '';

  async function copyCheckoutLink() {
    if (!checkoutLink) return;
    try {
      await navigator.clipboard.writeText(checkoutLink);
      alert('Checkout link copied.');
    } catch {
      prompt('Copy checkout link:', checkoutLink);
    }
  }
  const canUsePoints = selectedCustomer?.id && Number(selectedCustomer.points || 0) > 0;
  const maxDiscountRaw = Math.floor(grossTotal * 0.2);
  const pointsCap = Math.min(Number(selectedCustomer?.points || 0), Math.floor(maxDiscountRaw / 100));

  return (
    <section className="pos-panel panel">
      <div className="panel-head pos-head">
        <div>
          <p className="eyebrow">Crypto Checkout</p>
          <h2>POS / Checkout</h2>
        </div>
        <button type="button" className="primary small" onClick={onCreateInvoice}>
          <ReceiptText size={16} /> Create New Invoice
        </button>
      </div>

      {!invoiceActive ? (
        <div className="empty-invoice">
          <ReceiptText size={40} />
          <h3>No active invoice</h3>
          <p>Create a new invoice first. The checkout QR will let the customer connect wallet, redeem points, and pay.</p>
        </div>
      ) : (
        <div className="pos-workspace">
          <div className="invoice-area">
            <form className="scan-row" onSubmit={onSearchSubmit}>
              <Search size={18} />
              <input
                value={productSearch}
                onChange={event => setProductSearch(event.target.value)}
                placeholder="Scan barcode, enter SKU, QR code, or search product name..."
              />
              <button type="submit"><QrCode size={17} /> Add</button>
            </form>

            <div className="invoice-table-wrap">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Product</th>
                    <th>Product Code</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cartRows.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-row">No products in this invoice yet.</td>
                    </tr>
                  ) : cartRows.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td><span className="product-name-cell">{row.emoji} {row.name}</span></td>
                      <td>{row.sku}</td>
                      <td>
                        <span className="qty-control">
                          <button type="button" onClick={() => changeQty(row.id, -1)}><Minus size={13} /></button>
                          <b>{row.qty}</b>
                          <button type="button" onClick={() => changeQty(row.id, 1)}><Plus size={13} /></button>
                        </span>
                      </td>
                      <td>{money(row.price)}</td>
                      <td><strong>{money(row.price * row.qty)}</strong></td>
                      <td>
                        <button className="table-icon danger" type="button" onClick={() => removeItem(row.id)}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="checkout-summary">
            <label className="field-label">Customer Wallet</label>
            <select value={customerId || ''} onChange={event => setCustomerId(event.target.value)}>
              <option value="">Guest checkout</option>
              {customers.map(customer => (
                <option value={customer.id} key={customer.id}>{shortAddress(customer.wallet)} · {customer.points} pts</option>
              ))}
            </select>

            <div className="summary-lines">
              <p><span>Total Products</span><strong>{cartRows.reduce((sum, row) => sum + row.qty, 0)}</strong></p>
              <p><span>Subtotal</span><strong>{money(subtotal)}</strong></p>
              <p><span>Tax ({taxRate}%)</span><strong>{money(taxAmount)}</strong></p>
              <p><span>Total before points</span><strong>{money(grossTotal)}</strong></p>
              <p><span>Redeemed Points</span><strong>{pointsUsed} pts</strong></p>
              <p><span>Redeemed Value</span><strong>-{money(pointsDiscount)}</strong></p>
              <p className="total"><span>Payable</span><strong>{money(total)}</strong></p>
              <p><span>Estimated Earn</span><strong>{pointsEarned} pts</strong></p>
            </div>

            <label className={`check-line ${!canUsePoints ? 'muted' : ''}`}>
              <input
                type="checkbox"
                disabled={!canUsePoints}
                checked={pointsUsed > 0}
                onChange={event => setPointsUsed(event.target.checked ? pointsCap : 0)}
              />
              Customer redeems loyalty points before signing
            </label>
            {canUsePoints && <small className="helper-text">Max demo redemption: {pointsCap} pts, capped at 20% of the invoice total.</small>}

            <div className="payment-method-card">
              <Wallet size={18} />
              <div>
                <strong>Arc Crypto Payment</strong>
                <span>USDC checkout on Arc Testnet</span>
              </div>
            </div>

            {!checkout ? (
              <button className="primary full" type="button" disabled={!cartRows.length || paymentStatus === 'checking'} onClick={onCreateCheckout}>
                {paymentStatus === 'checking' ? <RefreshCw className="spin" size={16} /> : <QrCode size={16} />}
                Generate Arc Checkout QR
              </button>
            ) : (
              <button className="success full" type="button" disabled={paymentStatus === 'checking' || paymentStatus === 'paid'} onClick={onConfirmMockPayment}>
                {paymentStatus === 'checking' ? <RefreshCw className="spin" size={16} /> : <CheckCircle2 size={16} />}
                {paymentStatus === 'paid' ? 'Paid on Arc' : 'Manual Confirm Payment'}
              </button>
            )}

            {checkout && (
              <div className="qr-card">
                <h3>Checkout QR</h3>
                <div className="qr-box"><span>A</span></div>
                <p>Invoice <strong>{checkout.order_code}</strong></p>
                <small>Token: {checkoutToken}</small>
                <small>Checkout page: {checkoutLink}</small>
                <div className="payment-info">
                  <p><span>Network</span><strong>Arc Testnet</strong></p>
                  <p><span>Receiver</span><strong>{shortAddress(receiverWallet)}</strong></p>
                  <p><span>Payable</span><strong>{money(total)}</strong></p>
                </div>
                <div className="qr-actions">
                  <button type="button" className="ghost full" onClick={copyCheckoutLink}><Copy size={15} /> Copy checkout link</button>
                  <button type="button" className="ghost full" onClick={() => window.open(checkoutLink, '_blank')}><ExternalLink size={15} /> Open customer page</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
