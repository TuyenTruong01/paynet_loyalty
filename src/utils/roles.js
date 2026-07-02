export const MANAGER_WALLET = '0x8e23Ca66E4E4d68c6C52Ed651d8487320B3d57d2';

export const DEFAULT_STAFF_WALLETS = [
  {
    id: 'manager-wallet',
    name: 'Nguyen Van A',
    role: 'Manager',
    wallet: MANAGER_WALLET,
    avatar: '👨🏻‍💼',
    active: true,
  },
  {
    id: 'staff-wallet-1',
    name: 'Staff 01',
    role: 'Cashier',
    wallet: '0x5C73D6297A7447D3412a1B1f9b5B3d9746DfBD81',
    avatar: '👩🏻‍💼',
    active: true,
  },
  {
    id: 'staff-wallet-2',
    name: 'Staff 02',
    role: 'Cashier',
    wallet: '0x89dbe1ae9542250CAaAe6449AE9F2A0C45Ef5B18',
    avatar: '👨🏻‍💻',
    active: true,
  },
];

export function normalizeWallet(wallet = '') {
  return String(wallet || '').trim().toLowerCase();
}

export function isManagerWallet(wallet = '', staff = null) {
  const normalized = normalizeWallet(wallet);
  if (!normalized) return false;
  if (normalized === normalizeWallet(MANAGER_WALLET)) return true;
  const role = String(staff?.role || '').toLowerCase();
  return role === 'manager' || role === 'owner';
}

export function rolePermissionLabel(isManager) {
  return isManager ? 'Manager: full edit access' : 'Staff: POS access only';
}
