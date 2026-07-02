import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying ArcPayPaymentRegistry with:", deployer.address);

  const Registry = await hre.ethers.getContractFactory("ArcPayPaymentRegistry");
  const registry = await Registry.deploy();

  await registry.waitForDeployment();

  const address = await registry.getAddress();

  console.log("ArcPayPaymentRegistry deployed to:", address);
  console.log("ArcScan:", `https://testnet.arcscan.app/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});