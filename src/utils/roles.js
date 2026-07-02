export const MANAGER_WALLET = '0x8e23Ca66E4E4d68c6C52Ed651d8487320B3d57d2';

export const DEFAULT_STAFF_WALLETS = [
  {
    id: 'manager-wallet',
    name: 'Nguyen Van A',
    role: 'Manager',
    roleKey: 'manager',
    wallet: MANAGER_WALLET,
    avatar: '👨🏻‍💼',
    active: true,
  },
  {
    id: 'staff-wallet-1',
    name: 'Staff 01',
    role: 'Cashier',
    roleKey: 'cashier',
    wallet: '0x5C73D6297A7447D3412a1B1f9b5B3d9746DfBD81',
    avatar: '👩🏻‍💼',
    active: true,
  },
  {
    id: 'staff-wallet-2',
    name: 'Staff 02',
    role: 'Cashier',
    roleKey: 'cashier',
    wallet: '0x89dbe1ae9542250CAaAe6449AE9F2A0C45Ef5B18',
    avatar: '👨🏻‍💻',
    active: true,
  },
];

export function normalizeWallet(wallet = '') {
  return String(wallet || '').trim().toLowerCase();
}

export function ensureStaffArray(staffMembers) {
  if (Array.isArray(staffMembers)) {
    return staffMembers;
  }

  return DEFAULT_STAFF_WALLETS;
}

export function findWhitelistedStaffByWallet(staffMembers = DEFAULT_STAFF_WALLETS, wallet = '') {
  const list = ensureStaffArray(staffMembers);
  const normalizedWallet = normalizeWallet(wallet);

  if (!normalizedWallet) {
    return null;
  }

  return (
    list.find(member => {
      const memberWallet = normalizeWallet(member?.wallet);
      const isActive = member?.active !== false;

      return memberWallet === normalizedWallet && isActive;
    }) || null
  );
}

export function isWhitelistedStaffWallet(wallet = '', staffMembers = DEFAULT_STAFF_WALLETS) {
  return Boolean(findWhitelistedStaffByWallet(staffMembers, wallet));
}

export function isManagerWallet(wallet = '', staff = null) {
  const normalizedWallet = normalizeWallet(wallet);

  if (!normalizedWallet) {
    return false;
  }

  if (normalizedWallet === normalizeWallet(MANAGER_WALLET)) {
    return true;
  }

  const role = String(staff?.role || staff?.roleKey || '').toLowerCase();

  return role === 'manager' || role === 'owner';
}

export function rolePermissionLabel(isManager) {
  return isManager ? 'Manager: full edit access' : 'Staff: POS access only';
}