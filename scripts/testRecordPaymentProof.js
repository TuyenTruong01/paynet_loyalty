const hre = require('hardhat');

async function main() {
  const contractAddress = process.env.VITE_APOINT_PAYMENT_PROOF_ADDRESS;

  if (!contractAddress) {
    throw new Error('Missing VITE_APOINT_PAYMENT_PROOF_ADDRESS in .env');
  }

  const [deployer] = await hre.ethers.getSigners();
  const proof = await hre.ethers.getContractAt('ApointPaymentProof', contractAddress);

  const invoiceId = 'INV-DEMO-001';
  const customerWallet = deployer.address;
  const storeWallet = deployer.address;
  const amount = 9000000;
  const points = 9;

  const tx = await proof.recordPayment(
    invoiceId,
    customerWallet,
    storeWallet,
    amount,
    points
  );

  console.log(`tx hash: ${tx.hash}`);

  const receipt = await tx.wait();
  const blockNumber = receipt?.blockNumber || '';

  console.log(`block number: ${blockNumber}`);
  console.log(`Arc explorer: https://testnet.arcscan.app/tx/${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
