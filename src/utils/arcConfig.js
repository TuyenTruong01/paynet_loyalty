// Arc Testnet configuration based on the official Arc documentation.
// Important: Arc uses USDC as the native gas token. The ERC-20 USDC interface
// at ARC_USDC_ADDRESS uses 6 decimals and is the safest option for POS transfers.

export const ARC_TESTNET = {
  chainIdDecimal: 5042002,
  chainIdHex: '0x4cef52',
  chainName: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.testnet.arc.network'],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
};

export const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const ARC_MEMO_ADDRESS = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505';
export const ARC_USDC_DECIMALS = 6;
export const ARC_NATIVE_USDC_DECIMALS = 18;

export const MERCHANT_RECEIVER_WALLET = '0x10832dbAc54F6EBD6133356e5277868aA36d32fb';

export function arcScanTxUrl(txHash = '') {
  return txHash ? `${ARC_TESTNET.blockExplorerUrls[0]}/tx/${txHash}` : '';
}
