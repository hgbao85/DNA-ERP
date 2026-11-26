# Gộp màn hình 5 tính năng xưởng / kho + nút quét QR, mọi công tắc TẮT (26/11/2026)

Gộp phần FE của code quản lý gửi 24-25/11 (đã review 25/11) vào `demo`. Đi cùng BE `docs/changelog-2026-11-26-gop-5-tinh-nang-xuong-kho.md`.
**Tắt thì màn như cũ**: các tab / màn mới chỉ hiện khi BE trả `enabled: true` (công tắc ở BE).

## 1. Màn mới (ẩn khi BE tắt công tắc)

- Kho Phôi "Giao đoạn cho Hàn", kho Hàn (xưởng có kho Sơn) "Giao khung cho Sơn" trong Phân phối nội bộ; QLSX tab "Giao nhận" ở
  Sản lượng xưởng; màn công nhân Hàn / Sơn hiện số đã nhận / đã làm / còn.
- Pallet Sơn: thủ kho Sơn xếp pallet, công nhân quét pallet báo "Sơn xong", xuất đan theo pallet.
- Chuyền kiểm / đóng gói bằng quét QR: tài khoản công nhân chuyền kiểm, đóng gói, KCS chuyền kiểm.
- Vị trí kho Thành phẩm: khai ô + in tem, tồn theo ô, soạn hàng theo booking, load cont.
- Điều phối đan: màn theo dõi điểm đan, ghi chú + hẹn trả, quản lý điểm đan.

## 2. Nút quét QR trong app công nhân - công tắc mới, mặc định TẮT

- Biến `NEXT_PUBLIC_QR_SCAN_ENABLED` (chỉ đúng chuỗi `true` mới bật; `src/constants/featureFlags.ts`). Biến đóng vào bản build:
  đổi giá trị phải build / deploy lại.
- Tắt: màn `/floor` như trước - không nút "Quét mã QR", không xin quyền camera, công nhân quét tem bằng app camera của điện thoại
  (quyết định 15/10). Bật: nút quét trong app, đổi máy / khu nhận sắt không phải thoát ra app camera.
- Nút tách thành `scan/ScanButton.tsx`, có test.
- Lưu ý: các màn pallet, chuyền kiểm / đóng gói, vị trí kho (khi bật công tắc BE của chúng) vẫn có nút quét riêng, không theo biến này.

## 3. Kiểm

- `tsc` sạch; vitest 88 file / 1080 test đạt (trên `demo` mới nhất 72bbbc2); eslint các file đổi 0 lỗi (8 cảnh báo).

## 4. Lưu ý deploy

- Vercel: KHÔNG đặt `NEXT_PUBLIC_QR_SCAN_ENABLED` (hoặc đặt `false`). Lên sau BE.
- Còn khác ở màn cũ khi tắt (chỉ hiển thị): màn điểm đan có thêm cột "Người liên hệ"; vài màn kho hiện "đang tải" một nhịp trước
  khi biết công tắc tắt. Câu báo `/floor` cho tài khoản không thuộc tổ giữ như cũ khi tắt (chỉ nêu tổ mới khi BE bật chuyền kiểm /
  đóng gói QR).
