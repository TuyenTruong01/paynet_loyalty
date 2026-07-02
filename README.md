# ArcPay Loyalty POS - Supabase Connected

Bản này đã sửa code để đọc/ghi Supabase thật.

## Cài đặt

```bash
npm install
```

Tạo file `.env` ở thư mục gốc:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxx
VITE_ARC_NETWORK=arc-testnet
```

Sau khi sửa `.env`, tắt server cũ rồi chạy lại:

```bash
npm run dev
```

## Cách kiểm tra đã link Supabase

1. Mở DevTools > Network > filter `supabase`.
2. Refresh web.
3. Phải thấy request tới `/rest/v1/products`, `/rest/v1/customers`, `/rest/v1/orders`.
4. Sửa `sell_price` trong bảng `products` ở Supabase, refresh web, giá phải đổi theo.
5. Bấm `Thanh toán Arc`, sau đó kiểm tra bảng `orders`, `payments`, `inventory_movements`, `loyalty_transactions`.

## Luồng hiện tại

- Supabase thật: products, customers, orders, order_items, payments, inventory, loyalty.
- Arc payment: đang mock bằng tx hash giả `0xarc_mock_...`.
- Khi bấm thanh toán, app gọi RPC:
  - `create_pos_order`
  - `confirm_arc_payment`

## Chú ý

Không đưa `sb_secret_...` hoặc service role key vào frontend/GitHub.
Chỉ dùng `sb_publishable_...` trong `.env` frontend.
