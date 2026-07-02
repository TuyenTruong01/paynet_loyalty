const PRODUCT_TRANSLATIONS = [
  ['bánh chocopie', 'ChocoPie Cake'],
  ['coca cola', 'Coca-Cola Can 330ml'],
  ['dầu ăn neptune', 'Neptune Cooking Oil 1L'],
  ['gạo st25', 'ST25 Rice 5kg'],
  ['giấy vệ sinh', 'Pulppy Toilet Paper'],
  ['kem đánh răng', 'P/S Toothpaste'],
  ['mì hảo hảo', 'Hao Hao Shrimp Noodles'],
  ['nước giặt comfort', 'Comfort Laundry Detergent 3.2L'],
  ['nước giặt omo', 'OMO Laundry Detergent 3.8kg'],
  ['nước mắm chinsu', 'Chinsu Fish Sauce 500ml'],
  ['sữa tươi vinamilk', 'Vinamilk Fresh Milk 1L'],
];

const CATEGORY_TRANSLATIONS = {
  'Tất cả': 'All',
  'Đồ uống': 'Drinks',
  'Thực phẩm': 'Food',
  'Gia vị': 'Condiments',
  'Vệ sinh': 'Household',
  'Bánh kẹo': 'Snacks',
  'Khác': 'Other',
};

export function displayProductName(name = '') {
  const lower = name.toLowerCase();
  const match = PRODUCT_TRANSLATIONS.find(([key]) => lower.includes(key));
  return match ? match[1] : name;
}

export function displayCategoryName(name = '') {
  return CATEGORY_TRANSLATIONS[name] || name || 'Other';
}

export function productEmoji(name = '') {
  const n = name.toLowerCase();
  if (n.includes('mắm')) return '🍾';
  if (n.includes('dầu')) return '🛢️';
  if (n.includes('gạo')) return '🍚';
  if (n.includes('mì')) return '🍜';
  if (n.includes('sữa')) return '🥛';
  if (n.includes('coca') || n.includes('cola')) return '🥤';
  if (n.includes('bánh')) return '🍪';
  if (n.includes('giặt')) return '🧴';
  if (n.includes('kem')) return '🪥';
  if (n.includes('giấy')) return '🧻';
  return '🛒';
}
