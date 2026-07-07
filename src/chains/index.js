import { arcTestnet } from './arcTestnet.js';

export const DEFAULT_CHAIN_CODE = 'arc-testnet';

export const paymentChains = [
  arcTestnet,
];

const chainByCode = paymentChains.reduce((map, chain) => {
  map[chain.code] = chain;
  return map;
}, {});

export function getPaymentChain(code = DEFAULT_CHAIN_CODE) {
  return chainByCode[String(code || DEFAULT_CHAIN_CODE).toLowerCase()] || chainByCode[DEFAULT_CHAIN_CODE];
}

export function getCheckoutChain(order = {}) {
  return getPaymentChain(order.network || order.networkCode || order.paymentNetwork?.code || DEFAULT_CHAIN_CODE);
}

export function getChainLabel(code = DEFAULT_CHAIN_CODE) {
  return getPaymentChain(code).label;
}

export function explorerTxUrl(chain, txHash = '') {
  return txHash && chain?.explorerUrl ? `${chain.explorerUrl}/tx/${txHash}` : '';
}
