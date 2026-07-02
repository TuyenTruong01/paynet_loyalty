require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

let privateKey = process.env.DEPLOYER_PRIVATE_KEY || "";

if (privateKey && !privateKey.startsWith("0x")) {
  privateKey = `0x${privateKey}`;
}

module.exports = {
  solidity: "0.8.24",
  networks: {
    arcTestnet: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};