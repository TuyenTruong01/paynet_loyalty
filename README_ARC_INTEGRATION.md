# ArcPay Loyalty — Arc Testnet Integration Step

This update adds the first real Arc integration layer for ArcPay Loyalty POS.

## What changed

- Added official Arc Testnet config in `src/utils/arcConfig.js`.
- Added wallet helpers in `src/services/arcWallet.js`:
  - connect EVM wallet,
  - switch/add Arc Testnet,
  - encode ERC-20 USDC transfer using 6 decimals,
  - submit USDC transfer,
  - wait for transaction receipt.
- Updated customer QR checkout page:
  - real `Connect Wallet`,
  - real `Pay with Arc USDC`,
  - ArcScan transaction link,
  - Supabase payment confirmation after receipt.
- Updated manager/staff/receiver wallets:
  - Manager: `0x8e23Ca66E4E4d68c6C52Ed651d8487320B3d57d2`
  - Staff 01: `0x5C73D6297A7447D3412a1B1f9b5B3d9746DfBD81`
  - Staff 02: `0x89dbe1ae9542250CAaAe6449AE9F2A0C45Ef5B18`
  - Merchant receiver: `0x10832dbAc54F6EBD6133356e5277868aA36d32fb`

## Arc details used

- Arc Testnet chain ID: `5042002` / `0x4cef52`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Native currency symbol: `USDC`
- ERC-20 USDC interface: `0x3600000000000000000000000000000000000000`
- ERC-20 USDC decimals: `6`
- Native USDC/gas decimals: `18`

## Important implementation note

For POS payments this version uses the ERC-20 USDC interface, not native `msg.value` transfers. This avoids mixing Arc's native 18-decimal USDC accounting with the ERC-20 6-decimal interface.

## Test order

1. Deploy the app first so QR checkout has a public URL.
2. Connect manager/staff wallet on POS.
3. Create invoice.
4. Open customer checkout link/QR.
5. Customer connects wallet.
6. Wallet switches/adds Arc Testnet.
7. Customer pays with Arc USDC.
8. App waits for receipt and marks payment paid in Supabase.
9. Check Orders / Payments / Inventory / Loyalty.

## Next step after this works

Add Arc Transaction Memo for invoice reconciliation:
- Memo contract: `0x5294E9927c3306DcBaDb03fe70b92e01cCede505`
- Use memoId = invoice/order reference hash.
- Store tx hash + memoId in `payment_proofs`.
