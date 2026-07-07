export const arcTestnet = {
  code: 'arc-testnet',
  label: 'Arc Testnet',
  family: 'evm',
  chainIdDecimal: 5042002,
  chainIdHex: '0x4cef52',
  rpcUrls: ['https://rpc.testnet.arc.network'],
  explorerUrl: 'https://testnet.arcscan.app',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  paymentToken: {
    symbol: 'USDC',
    decimals: 6,
    address: '0x3600000000000000000000000000000000000000',
  },
  proofRegistry: {
    address: '',
    enabled: false,
  },
};
