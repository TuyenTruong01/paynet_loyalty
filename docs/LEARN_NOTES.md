# Ghi chú học từ template admin dashboard

Template bạn tải lên là dạng admin dashboard Next.js. Với dự án ArcPay Loyalty, chỉ nên học các phần sau:

## Nên học

1. Cách chia layout
   - Sidebar cố định bên trái.
   - Header/topbar có search, network, wallet, avatar.
   - Nội dung chính chia card/panel rõ ràng.

2. Cách tổ chức component
   - Product card.
   - Table đơn hàng.
   - Form thêm/sửa dữ liệu.
   - KPI cards.
   - Modal.

3. Cách dùng màu và spacing
   - Nền xám nhạt.
   - Card trắng.
   - Border mảnh.
   - Màu tím làm màu chính cho Arc.
   - Xanh cho đã thanh toán, cam cho cảnh báo, đỏ cho lỗi.

4. Cách thiết kế dashboard thật
   - Không làm landing page quá lớn.
   - Ưu tiên màn hình thao tác bán hàng.
   - POS phải nhìn được sản phẩm, giỏ hàng, tổng tiền và QR cùng lúc.

## Không nên bê nguyên template

- Không dùng quá nhiều trang chưa cần thiết.
- Không giữ nội dung tiếng Anh chung chung.
- Không làm giao diện quá rỗng hoặc quá nhiều biểu đồ.
- Không đưa dữ liệu nhạy cảm như private key, seed phrase, API secret lên GitHub.

## Luồng ArcPay nên làm theo pha

### Pha 1 — Demo UI + dữ liệu local

- Sản phẩm có sẵn.
- Thêm/sửa/xóa sản phẩm.
- Tồn kho lưu localStorage.
- Thanh toán Arc mock.
- QR thanh toán mock.

### Pha 2 — Backend thật

- Dùng Supabase/Firebase/PostgreSQL để lưu sản phẩm, đơn hàng, tồn kho, khách hàng, điểm thưởng.
- Có đăng nhập nhân viên.
- Phân quyền: Admin, Manager, Cashier, Warehouse.

### Pha 3 — Arc payment thật

- Kết nối ví.
- Tạo payment request.
- Theo dõi trạng thái giao dịch.
- Lưu tx hash vào đơn hàng.
- Chỉ trừ kho/cộng điểm khi giao dịch confirmed.

### Pha 4 — Loyalty on-chain / hybrid

- Điểm thưởng có thể lưu off-chain để rẻ và nhanh.
- Chỉ những proof quan trọng hoặc voucher lớn mới ghi on-chain.
- Tránh ghi mọi thao tác bán hàng lên blockchain vì chi phí và tốc độ không phù hợp POS thực tế.
