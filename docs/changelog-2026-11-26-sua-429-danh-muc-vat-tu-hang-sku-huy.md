# Bớt lỗi 429 "Thao tác quá nhanh" + màn Hàng SKU huỷ cho Sếp (26/11/2026)

Lỗi gặp khi chạy thử toàn bộ màn theo vai trên bản sao production 23/11. Đi cùng BE
`docs/changelog-2026-11-26-sua-quyen-xem-xuong-hang-sku-huy-429.md` (lên BE trước).

## Thay đổi

- Danh mục vật tư (`getMaterials`, 9 màn dùng): mỗi lần tải cả danh mục theo trang 100 dòng (khoảng 5 request), đổi qua lại vài màn là
  chạm giới hạn 100 request / 60 giây của BE. Nay các lần gọi trong 30 giây dùng chung 1 lần tải; xoá bộ nhớ ngay khi tạo / sửa / xoá
  vật tư, sửa hao hụt hàng loạt, chuyển người phụ trách mua, hoặc khi tải lỗi. Danh mục không chứa số tồn.
- Bộ nhớ danh mục vật tư được xoá khi đăng nhập, đăng xuất và khi hết phiên (không mang sang người dùng sau).
- Lưới an toàn: GET bị 429 mà `Retry-After` ≤ 9 giây thì tự chờ rồi thử lại tối đa 2 lần (`src/services/core/retryAfter.ts`).
  POST / PATCH / DELETE không bao giờ tự lặp. Thực tế hiếm khi chạy: vượt trần thì BE khoá trọn 60 giây nên lần chặn đầu báo chờ 60
  giây -> báo lỗi như cũ. Phần giảm 429 chính là danh mục vật tư dùng chung ở trên.
- Màn Chuyển kho ngoài đơn hàng: tải vật tư / tồn lỗi thì hiện câu lỗi + nút "Thử lại", kể cả khi còn danh sách của kho chọn trước
  (trước đây ô Vật tư trống hoặc giữ tồn của kho cũ mà không báo gì).
- Màn Hàng SKU đã huỷ: Sếp xem được (BE mở quyền đọc), cột thao tác ghi "Chỉ KHSX chuyển" thay cho nút Chuyển; tài khoản vừa Sếp vừa
  KHSX vẫn thấy nút Chuyển.

## Kiểm

- Test mới: `retryAfter.test.ts`, `materials-api.test.ts` (dùng chung trong 30 giây, xoá khi tạo / sửa / sửa hàng loạt / xoá /
  chuyển người phụ trách mua / khi lỗi). tsc sạch, vitest 89 file / 1092 test đạt.
- QA review độc lập: Đạt có điều kiện, 0 Cao; đã sửa: chú thích tự thử lại 429, báo lỗi khi còn danh sách cũ, Sếp + KHSX, xoá bộ nhớ
  khi đăng xuất, thêm test. Còn biết: tab / người khác sửa vật tư thì màn này thấy bản cũ tối đa 30 giây.
- Chạy thật trên bản sao: Sếp mở màn Hàng SKU đã huỷ không còn 403; làm hết lượt `/materials` rồi mở Chuyển kho thì hiện lỗi + nút
  "Thử lại".

## Lưu ý deploy

- Lên sau BE. Không biến môi trường mới.
