# Changelog 11/11/2026 - Khung "Thùng & load cont": báo rõ đã lưu

## Lỗi
Ở chi tiết SKU (Kế hoạch SX → Danh sách SKU) và màn Định mức chi tiết, bấm **Lưu** ở khung "Thùng & load cont" thì không thấy
báo đã lưu. Thực ra có lưu, và có chữ "Đã lưu", nhưng chữ nhỏ, màu nhạt, tự tắt sau 2,5 giây; nút Lưu lại mờ đi ngay nên người
dùng tưởng chưa lưu được.

## Sửa
- `src/components/ContainerLoadEditor.tsx`: lưu xong hiện nhãn xanh có dấu tích **"Đã lưu lúc HH:mm"** cạnh nút Lưu
  (`role="status"`), giữ nguyên tới khi sửa một ô hoặc chuyển sang SKU khác; bỏ hẹn giờ 2,5 giây.
- Không đổi BE, không đổi cách tính load cont.

## Kiểm tra
- `tsc` sạch; `eslint` không thêm cảnh báo mới (còn 1 cảnh báo cũ ở effect đổ dữ liệu vào ô); `vitest` 444/444.
- Thử trên trình duyệt (bản dev, DB local): Lưu → nhãn "Đã lưu lúc …" còn nguyên sau 4 giây; gõ vào một ô thì nhãn ẩn.

## Còn lại
- Màn Admin → Cấu hình hệ thống cũng dùng kiểu chữ "Đã lưu" nhỏ giống trước (`SystemConfigPage.tsx`), chưa sửa.
