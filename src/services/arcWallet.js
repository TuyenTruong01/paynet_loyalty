import { ARC_TESTNET, ARC_USDC_ADDRESS, arcScanTxUrl } from '../utils/arcConfig.js';
import { DISPLAY_UNITS_PER_USDC } from '../utils/format.js';

const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';

const ARC_TESTNET_WALLET_PARAMS = {
  chainId: '0x4cef52',
  chainName: 'Arc Testnet',
  rpcUrls: ['https://rpc.testnet.arc.network'],
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  blockExplorerUrls: ['https://testnet.arcscan.app'],
};

export function getInjectedEthereum() {
  if (typeof window === 'undefined') return null;

  const eth = window.ethereum;
  if (!eth) return null;

  // When multiple wallets are installed, MetaMask exposes providers here.
  if (Array.isArray(eth.providers)) {
    const metamask = eth.providers.find((provider) => provider.isMetaMask);
    const rabby = eth.providers.find((provider) => provider.isRabby);
    return metamask || rabby || eth.providers[0] || eth;
  }

  return eth;
}

export function isValidEvmAddress(address = '') {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address).trim());
}

function assertAddress(address, label = 'address') {
  if (!isValidEvmAddress(address)) {
    throw new Error(`Invalid ${label}: ${address || '(empty)'}`);
  }
}

function toPaddedAddress(address) {
  assertAddress(address, 'recipient address');
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function toPaddedUint256(value) {
  const big = BigInt(value);
  if (big < 0n) throw new Error('Amount must be positive.');
  return big.toString(16).padStart(64, '0');
}

export function rawAmountToUsdcMicroUnits(rawAmount = 0) {
  // Demo DB stores display prices where DISPLAY_UNITS_PER_USDC = 10,000.
  // ERC-20 USDC on Arc uses 6 decimals.
  // raw -> USDC -> micro-USDC: raw / 10,000 * 1,000,000 = raw * 100.
  const raw = BigInt(Math.max(0, Math.round(Number(rawAmount || 0))));
  return raw * (1000000n / BigInt(DISPLAY_UNITS_PER_USDC));
}

export function encodeUsdcTransferData(to, rawAmount) {
  const amountMicro = rawAmountToUsdcMicroUnits(rawAmount);

  if (amountMicro <= 0n) {
    throw new Error('Payment amount must be greater than 0 USDC.');
  }

  return `${ERC20_TRANSFER_SELECTOR}${toPaddedAddress(to)}${toPaddedUint256(amountMicro)}`;
}

export async function ensureArcTestnet() {
  const ethereum = getInjectedEthereum();

  if (!ethereum) {
    throw new Error('No EVM wallet found. Please install MetaMask, Rabby, Coinbase Wallet, or another EVM wallet.');
  }

  const currentChain = await ethereum.request({ method: 'eth_chainId' });

  if (String(currentChain).toLowerCase() === ARC_TESTNET.chainIdHex.toLowerCase()) {
    return true;
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_TESTNET.chainIdHex }],
    });

    return true;
  } catch (switchError) {
    // 4902 = chain has not been added to the wallet.
    if (switchError?.code !== 4902) {
      throw switchError;
    }

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [ARC_TESTNET_WALLET_PARAMS],
    });

    return true;
  }
}

export async function connectArcWallet() {
  const ethereum = getInjectedEthereum();

  if (!ethereum) {
    throw new Error('No EVM wallet found. Please install a wallet first.');
  }

  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  const address = accounts?.[0];

  assertAddress(address, 'connected wallet');

  await ensureArcTestnet();

  return {
    address,
    chainId: ARC_TESTNET.chainIdDecimal,
    network: ARC_TESTNET.chainName,
  };
}

export async function sendArcUsdcTransfer({ from, to, rawAmount }) {
  const ethereum = getInjectedEthereum();

  if (!ethereum) {
    throw new Error('No EVM wallet found.');
  }

  assertAddress(from, 'sender wallet');
  assertAddress(to, 'merchant receiver wallet');

  await ensureArcTestnet();

  const data = encodeUsdcTransferData(to, rawAmount);

  const txHash = await ethereum.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: ARC_USDC_ADDRESS,
        value: '0x0',
        data,
      },
    ],
  });

  return txHash;
}

export async function waitForArcReceipt(txHash, { timeoutMs = 90000, intervalMs = 1500 } = {}) {
  const ethereum = getInjectedEthereum();

  if (!ethereum) {
    throw new Error('No EVM wallet found.');
  }

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const receipt = await ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    if (receipt) return receipt;

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Transaction was submitted but no receipt was found yet. Check ArcScan: ${arcScanTxUrl(txHash)}`);
}