const hre = require("hardhat");

const REGISTRY_ADDRESS = "0x7B9941Da31b194Efc2881afB335987EeF137AA6";

// Real paid invoice / payment data
const INVOICE_CODE = "INV-20260702-41011";
const CHECKOUT_TOKEN = "9cc20ace818fb10eaea9af195d21f2c6f";

// Real ArcScan USDC payment transaction hash
const PAYMENT_TX_HASH =
  "0xd312f173ad4b29687bc878984efa6a53fab39644c8dcbd2812bb96fc90dc98ad";

// Merchant receiver wallet
const MERCHANT = "0x10832dbAc54F6EBD6133356e5277868aA36d32fb";

// 1.32 USDC with ERC-20 USDC 6 decimals
const AMOUNT_USDC_6_DECIMALS = 1320000;

// Temporary metadata. Later this can be an IPFS URI or Supabase receipt URL.
const METADATA_URI = "arcpay://invoice/INV-20260702-41011";

function assertAddress(label, value) {
  if (!hre.ethers.isAddress(value)) {
    throw new Error(`${label} is not a valid EVM address: ${value}`);
  }
}

function assertBytes32(label, value) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be bytes32 hex string: ${value}`);
  }
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const payerAddress = await signer.getAddress();

  assertAddress("REGISTRY_ADDRESS", REGISTRY_ADDRESS);
  assertAddress("payerAddress", payerAddress);
  assertAddress("MERCHANT", MERCHANT);
  assertBytes32("PAYMENT_TX_HASH", PAYMENT_TX_HASH);

  console.log("Recording payment proof with wallet:", payerAddress);
  console.log("Registry:", REGISTRY_ADDRESS);

  // Contract requires msg.sender to be payer or merchant.
  // For this test, payer is the signer wallet from DEPLOYER_PRIVATE_KEY.
  const PAYER = payerAddress;

  const registry = await hre.ethers.getContractAt(
    "ArcPayPaymentRegistry",
    REGISTRY_ADDRESS
  );

  const invoiceHash = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes(INVOICE_CODE)
  );

  const checkoutTokenHash = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes(CHECKOUT_TOKEN)
  );

  const paymentTxHashBytes32 = PAYMENT_TX_HASH;

  console.log("Invoice code:", INVOICE_CODE);
  console.log("Invoice hash:", invoiceHash);
  console.log("Checkout token hash:", checkoutTokenHash);
  console.log("Payment tx hash:", paymentTxHashBytes32);
  console.log("Amount:", AMOUNT_USDC_6_DECIMALS, "USDC 6 decimals");
  console.log("Payer:", PAYER);
  console.log("Merchant:", MERCHANT);
  console.log("Metadata URI:", METADATA_URI);

  const alreadyRecorded = await registry.hasPaymentProof(invoiceHash);

  if (alreadyRecorded) {
    console.log("Payment proof already exists. Reading proof...");
    const proof = await registry.getPaymentProof(invoiceHash);
    console.log("Saved proof:");
    console.log({
      invoiceHash: proof[0],
      amount: proof[1].toString(),
      payer: proof[2],
      merchant: proof[3],
      paymentTxHash: proof[4],
      checkoutTokenHash: proof[5],
      recordedAt: proof[6].toString(),
      recorder: proof[7],
      metadataURI: proof[8],
    });
    return;
  }

  const tx = await registry.recordPaymentProof(
    invoiceHash,
    AMOUNT_USDC_6_DECIMALS,
    PAYER,
    MERCHANT,
    paymentTxHashBytes32,
    checkoutTokenHash,
    METADATA_URI
  );

  console.log("Record proof tx sent:", tx.hash);
  console.log(`ArcScan: https://testnet.arcscan.app/tx/${tx.hash}`);

  const receipt = await tx.wait();

  console.log("Record proof confirmed in block:", receipt.blockNumber);

  const proof = await registry.getPaymentProof(invoiceHash);

  console.log("Saved proof:");
  console.log({
    invoiceHash: proof[0],
    amount: proof[1].toString(),
    payer: proof[2],
    merchant: proof[3],
    paymentTxHash: proof[4],
    checkoutTokenHash: proof[5],
    recordedAt: proof[6].toString(),
    recorder: proof[7],
    metadataURI: proof[8],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
