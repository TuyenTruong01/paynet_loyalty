# Paynet APoint

Paynet APoint is a multi-store point-of-sale and loyalty application for small retail businesses. It combines a Supabase-backed operating system for stores with Arc Testnet USDC checkout and on-chain payment proof events.

The app is built for a hackathon/demo environment: store staff can create invoices, customers can pay from a wallet through a public QR checkout page, and the system records minimal payment proof on Arc while keeping private operational data in Supabase.

## Problem

Small shops often run checkout, inventory, staff access, customer rewards, and payment records in separate systems. Loyalty balances are usually store-specific, hard to audit, and disconnected from on-chain payment activity.

For a shared retail loyalty network, the core problems are:

- Store staff need a simple POS flow that works across multiple store types.
- Store owners need wallet-based access control without a heavy back-office setup.
- Customers need a checkout page that supports wallet payment and loyalty redemption.
- Payment proof should be verifiable without putting private customer or order details on-chain.
- Operational data such as products, inventory, staff, and order items should remain off-chain.

## Solution

Paynet APoint provides a multi-store POS and loyalty workflow:

- Supabase stores operational data: stores, products, staff, customers, orders, payments, inventory, and loyalty ledger rows.
- Arc Testnet handles USDC wallet payments and public payment proof events.
- A Solidity contract emits a `PaymentRecorded` event for each wallet checkout proof.
- Wallet-based role access separates system admin, store owner, staff, and guest behavior.
- The cashier POS can generate a QR checkout link, wait for wallet payment status, or manually confirm a cash payment.

## Key Features

- Multi-store admin console for adding stores, editing store details, updating owner wallets, and disabling/reactivating stores.
- Wallet whitelist access based on `src/config/roleAccess.json`.
- Role-aware navigation for system admins, store owners, staff, and unassigned wallets.
- POS invoice builder with product search, quantity controls, checkout totals, tax, loyalty redemption, and QR generation.
- Customer checkout page at `/checkout/:token`.
- Arc Testnet USDC transfer flow using the ERC-20 USDC interface.
- On-chain payment proof through the `ApointPaymentProof` contract.
- Automatic POS payment status polling after QR generation.
- Manual cash confirmation path for non-wallet payments.
- Product catalog management with images, SKU, barcode/QR field, category, price, description, and status.
- Staff wallet management for owner/manager roles.
- Inventory and warehouse views with low-stock indicators.
- Orders page with filters, receipt modal, print, and HTML export.
- Customer wallet list with APoint balances.
- APoint analytics and ledger view.
- Dashboard, revenue, best-seller, rewards, settings, warehouse, inventory, purchase-order placeholder-style views.
- Local demo data fallback when Supabase environment variables are not configured.

## Tech Stack

- React
- Vite
- Supabase JavaScript client
- Hardhat
- Solidity `0.8.24`
- Arc Testnet
- EVM wallet provider API
- WalletConnect Ethereum provider dependency
- Lucide React icons
- Plain CSS in `src/styles.css`

## User Roles

Role access is resolved from `src/config/roleAccess.json` and applied in `src/utils/storeNetwork.js`.

| Role | Access in the current app |
| --- | --- |
| System Admin | Can view the network admin console, manage participating stores, update owner wallets, disable/reactivate stores, and access store operation pages. |
| Store Owner / Manager | Can manage staff, products, inventory, warehouses, settings, and POS operations for their assigned store. |
| Store Staff / Cashier | Can access operational pages such as POS, orders, customers, and inventory for their assigned store. |
| Guest / Unassigned Wallet | Gets a locked access screen and cannot use store operations. |
| Customer Wallet | Uses the public checkout page, can connect a wallet, redeem available points, pay USDC, and receive new APoint balance updates. |

## Main Workflow

1. A whitelisted staff or owner wallet connects to the app.
2. The app resolves the wallet role and assigned store.
3. Staff opens the POS page and creates a new invoice.
4. Staff adds products to the cart.
5. The POS calculates subtotal, tax, optional loyalty redemption, payable amount, and estimated APoint earning.
6. Staff generates a checkout QR/link.
7. Customer opens the checkout page from the QR/link.
8. Customer connects an EVM wallet on Arc Testnet.
9. The checkout page loads or creates the wallet customer record in Supabase.
10. Customer optionally redeems APoint, capped at 20% of invoice total.
11. Customer pays USDC on Arc Testnet.
12. The app waits for the payment receipt.
13. The app sends a second transaction to `ApointPaymentProof` to emit the payment proof event.
14. Supabase marks the order and payment as paid, stores tx/proof metadata, and updates the loyalty ledger.
15. The POS page polls Supabase and automatically shows `Payment Confirmed`.
16. If the customer pays cash instead, staff can use `Manual Confirm Cash Payment`, which marks the order paid in Supabase without an on-chain proof transaction.

## Loyalty Rules

The current point logic is implemented in `src/utils/format.js`.

- Display unit: `10,000` raw units = `1.00 USDC`.
- Earning: `100 USDC paid = 1 APoint`.
- Fractional points are supported. Example: `3.08 USDC = 0.0308 APoint`.
- Redemption: `1 APoint = 0.20 USDC discount`.
- Maximum redemption in checkout: 20% of invoice total.
- On-chain proof stores points as scaled integer units using `POINTS_ONCHAIN_SCALE = 10000`.

## Blockchain / Smart Contract Integration

The current blockchain integration targets Arc Testnet.

| Item | Value |
| --- | --- |
| Chain | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Gas token | USDC |
| ERC-20 USDC interface | `0x3600000000000000000000000000000000000000` |

### USDC Payment Flow

`src/services/arcPayment.js`:

- Adds/switches the connected wallet to Arc Testnet.
- Encodes an ERC-20 `transfer(address,uint256)`.
- Sends payment to the store receiver wallet.
- Waits for an Arc transaction receipt.
- Builds Arc explorer transaction links.

### Proof Contract

Contract: `contracts/ApointPaymentProof.sol`

The contract does not store order state. It emits an event:

```solidity
event PaymentRecorded(
    string invoiceId,
    address indexed customerWallet,
    address indexed storeWallet,
    uint256 amount,
    uint256 points,
    uint256 timestamp
);
```

`src/services/apointProofService.js` manually encodes and sends the `recordPayment` call to the deployed proof contract. The app stores the proof transaction hash in Supabase.

### Hardhat Commands

```bash
npm run compile:contracts
npm run deploy:arc
npm run test:proof:arc
```

After deployment, set `VITE_APOINT_PAYMENT_PROOF_ADDRESS` in `.env`.

## Database / Supabase Integration

Supabase is optional for local UI exploration but required for the full connected workflow.

The client is configured in `src/lib/supabaseClient.js` from:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Schema file: `supabase/paynet_schema.sql`

Main tables created by the schema:

- `store_types`
- `product_statuses`
- `warehouse_statuses`
- `stores`
- `store_staff`
- `products`
- `warehouses`
- `inventory`
- `customers`
- `payment_networks`
- `payment_tokens`
- `store_payment_methods`
- `orders`
- `order_items`
- `payments`
- `apoint_ledger`
- `audit_logs`

The schema seeds:

- Store types
- Product and warehouse statuses
- Arc Testnet payment network
- Arc USDC token
- Demo stores, staff wallets, products, warehouses, customers, and payment methods

RLS is enabled in the schema, but the included policies are prototype policies for the demo frontend:

```sql
create policy "prototype_all_*" ... for all using (true) with check (true)
```

Tighten these policies before production use.

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

On Windows:

```bash
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Fill in the required values in `.env`.

### 3. Set Up Supabase

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run the full contents of `supabase/paynet_schema.sql`.
4. Copy your Supabase project URL and anon key into `.env`.

### 4. Deploy the Proof Contract

Make sure the deployer wallet has Arc Testnet USDC for gas.

```bash
npm run deploy:arc
```

Copy the deployed contract address into:

```env
VITE_APOINT_PAYMENT_PROOF_ADDRESS=
```

### 5. Start the App

```bash
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

### 6. Build for Production

```bash
npm run build
```

### 7. Preview Production Build

```bash
npm run preview
```

## Environment Variables

Use `.env.example` as the source template.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxxx
ARC_RPC_URL=https://rpc.testnet.arc.network
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x
VITE_APOINT_PAYMENT_PROOF_ADDRESS=
VITE_ARC_TESTNET_CHAIN_ID=5042002
VITE_ARC_TESTNET_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_WALLETCONNECT_PROJECT_ID=
```

Notes:

- Never commit a real `DEPLOYER_PRIVATE_KEY`.
- `VITE_WALLETCONNECT_PROJECT_ID` is used when the app falls back to WalletConnect because no injected EVM wallet is available.
- `VITE_APOINT_PAYMENT_PROOF_ADDRESS` must be set after deploying `ApointPaymentProof`.

## Demo Accounts / Wallets

These are public wallet addresses used for role access and seeded demo data. They are not private keys.

### System Admin

| Label | Wallet |
| --- | --- |
| System Admin | `0x8e23Ca66E4E4d68c6C52Ed651d8487320B3d57d2` |

### Stores

| Store | Role | Wallet |
| --- | --- | --- |
| Minh Chau Grocery | Owner / Receiver | `0x863FBd9eaC8D1001828B2502A71d9520Cf85636D` |
| Minh Chau Grocery | Cashier | `0xCb55bA6B93A54Ae9406710620cD0686BDce4522d` |
| Morning Cafe | Owner / Receiver | `0xc8044822b1cBF8416489e5Fc676c7746E2515aC6` |
| Morning Cafe | Cashier | `0x8F524d30238C1a5734ddd1Fc7470Fe72204539E8` |
| Golden Bowl Noodles | Owner / Receiver | `0x1e09B25731eef93646A36aD03E20147D3dfF3214` |
| Golden Bowl Noodles | Cashier | `0x34104D0684434918EFa4B87eeC291C38ae25B8A1` |

### Seeded Customer Wallets

| Label | Wallet |
| --- | --- |
| Wallet Customer | `0xf3a00000000000000000000000000000009b2c1d` |
| Guest Wallet | `0x7b2e1af93c000000000000000000000000abc123` |

## Project Structure

```text
.
├── contracts/
│   └── ApointPaymentProof.sol
├── scripts/
│   ├── deployApointPaymentProof.js
│   └── testRecordPaymentProof.js
├── supabase/
│   └── paynet_schema.sql
├── src/
│   ├── chains/
│   │   ├── arcTestnet.js
│   │   └── index.js
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── POSPanel.jsx
│   │   ├── ProductGrid.jsx
│   │   ├── ProductModal.jsx
│   │   ├── Sidebar.jsx
│   │   └── StatusBanner.jsx
│   ├── config/
│   │   └── roleAccess.json
│   ├── lib/
│   │   └── supabaseClient.js
│   ├── pages/
│   │   ├── CustomerCheckoutPage.jsx
│   │   ├── POSPage.jsx
│   │   ├── SystemAdminPage.jsx
│   │   └── other dashboard and operation pages
│   ├── services/
│   │   ├── apointProofService.js
│   │   ├── arcPayment.js
│   │   ├── evmWallet.js
│   │   └── paynetService.js
│   ├── utils/
│   │   ├── format.js
│   │   ├── storeNetwork.js
│   │   └── supporting mappers/helpers
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── public/
│   └── png/
├── hardhat.config.js
├── package.json
└── README.md
```

## Screenshots

Screenshots can be added under `docs/images`.

Suggested placeholders:

- `docs/images/system-admin.png`
- `docs/images/store-pos.png`
- `docs/images/customer-checkout.png`
- `docs/images/payment-confirmed.png`
- `docs/images/points-history.png`



## Roadmap

The current codebase already includes the working demo flow. Reasonable next steps visible from the code and schema are:

- Replace prototype Supabase RLS policies with production-grade policies.
- Add stronger validation around manual cash confirmation.
- Add an indexer or admin view for reading `PaymentRecorded` events from Arc.
- Expand proof analytics for payment and loyalty history.
- Improve mobile WalletConnect testing with a configured `VITE_WALLETCONNECT_PROJECT_ID`.
- Add production deployment documentation.
- Add automated tests for point math, checkout confirmation, and proof encoding.
- Add Arc mainnet configuration when production addresses are available.

## Current Limitations

- The included Supabase policies are intentionally permissive prototype policies.
- The proof contract emits events but does not keep an on-chain registry mapping.
- Manual cash payments are recorded in Supabase only and do not emit Arc proof events.
- The app is configured for Arc Testnet, not production mainnet.
- Product, inventory, and staff flows are designed for the current demo schema and should be reviewed before production use.
