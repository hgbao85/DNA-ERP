# Changelog 12/11/2026 - Cấu hình hệ thống: chia tab + thông số MC Laser

## Yêu cầu
1. Màn Admin → Cấu hình hệ thống không có chỗ chỉnh thông số MC Laser (chỉ có "Thông số MC Tự động"), dù BE có sẵn
   `solverBladeWidthMm` (lưỡi cắt, mặc định 1) và `solverTrimStartMm` (tề đầu, mặc định 10) và API cho sửa.
2. Màn gom mọi thứ thành một trang dài, khó nhìn: tách thành nhiều nút (tab).

## Sửa (chỉ FE)
- `src/modules/pages/Admin/SystemConfigPage.tsx`:
  - 4 tab: **Công ty** (tên, địa chỉ, điện thoại, email, MST, tiền tệ) · **Xưởng & tem QR** (địa chỉ ERP in trên tem QR;
    mục mạng công ty nếu đang bật) · **Máy cắt** (máy mặc định, Thông số MC Laser, Thông số MC Tự động, gợi ý gộp đơn) ·
    **Kế hoạch sản xuất** (tiền tố số LSX, thể tích cont, năng lực sản xuất).
  - Nút "Lưu thay đổi" vẫn lưu MỌI tab cùng lúc. Có ô sai ở tab khác thì màn tự chuyển sang tab đó; tab có ô sai có chấm đỏ.
  - Khung mới **Thông số MC Laser**: Lưỡi cắt (mm, 0–10, có số lẻ) và Tề đầu (mm nguyên, 0–100), cùng khoảng với MC Tự động.
  - Tab Máy cắt đổi bố cục: 2 **thẻ máy** (MC Laser / MC Tự động), mỗi thẻ có dòng tóm tắt thông số chính (vd "Lưỡi 1 mm ·
    Tề 10 mm"), nhãn **Mặc định** ở máy mặc định, chấm cam khi máy đó có sửa chưa lưu, chấm đỏ khi có ô sai. Bấm thẻ nào thì
    bên dưới chỉ hiện thông số máy đó; mở màn ra tự chọn máy mặc định. Bấm thẻ chỉ để xem/sửa, KHÔNG đổi máy mặc định -
    đổi bằng nút "Đặt làm máy mặc định" trong khung thông số (để sửa thông số MC Tự động mà không lỡ đổi máy mặc định).
    Lưu mà ô sai nằm ở máy đang không xem thì tự chuyển sang thẻ máy đó. "Gợi ý gộp đơn (áp cho cả hai máy)" luôn hiện bên dưới.
  - Lưu xong hiện nhãn xanh "Đã lưu lúc HH:mm" (giữ tới khi sửa tiếp; trước đây chữ "Đã lưu" tự tắt sau 2,5 giây);
    đang có sửa chưa lưu thì ghi "Có thay đổi chưa lưu".
- `src/types/admin.ts`: `SystemConfig` thêm `solverBladeWidthMm`, `solverTrimStartMm`.
- `src/services/system-config-api.ts`: gửi thêm 2 field trên khi lưu (hàm này chỉ gửi field được liệt kê tên).
- BE không đổi.

## Kiểm tra
- `tsc` sạch; `eslint` sạch; `vitest` 444/444.
- Thử trên trình duyệt (bản dev, DB local, tài khoản admin): đổi qua lại 4 tab không lỗi console; nhập sai tề đầu Laser rồi
  bấm Lưu khi đang ở tab Công ty → tự chuyển sang tab Máy cắt, chấm đỏ, báo lỗi dưới ô; đổi lưỡi cắt Laser 1 → 1,5, lưu,
  DB ghi 1.5, rồi trả về 1; màn 375px các nút tab xuống dòng, không tràn ngang.
- Thẻ máy: bấm MC Tự động chỉ hiện thông số MC Tự động, nhãn Mặc định vẫn ở MC Laser; sửa ô MC Tự động → chấm cam trên thẻ;
  nhập sai ô MC Laser rồi Lưu khi đang xem MC Tự động → tự chuyển sang thẻ MC Laser, chấm đỏ, báo lỗi dưới ô;
  "Đặt làm máy mặc định" chuyển nhãn sang máy kia và hiện "Có thay đổi chưa lưu" (thử xong tải lại, không lưu). Không lỗi console.

## Thông số chung cả hai máy (thêm cùng ngày)
MC Laser chỉ có 2 thông số riêng (lưỡi cắt, tề đầu); bộ giải còn luật cố định ưu tiên tối đa 4 cỡ đoạn trên một cây cho MC Laser
(`MAX_SIZES_PER_BAR` ở BE, không phải cấu hình). 8 thông số DÙNG CHUNG cho cả hai máy trước đây chỉ sửa được qua API, nay có
khung **"Thông số chung (áp cho cả hai máy)"** trong tab Máy cắt:
- Cây sắt: Cây chuẩn (mm, nhiều cỡ cách nhau dấu cách, 500–20000, tối đa 10 số) · Cho đặt cây riêng (bật/tắt) · Cây đặt riêng
  ngắn nhất / dài nhất (mm, 500–20000; FE chặn ngắn nhất > dài nhất vì BE không kiểm cặp này) · Bước dò chiều dài (mm, 1–1000).
- Bộ giải: Hao hụt tối đa (%, 0,1–100, làm tròn 3 số lẻ theo cột DB) · Dư tối đa mỗi cỡ đoạn (0–1000) · Thời gian chạy tối đa
  mỗi loại sắt (giây, 1–1700).
- `types/admin.ts` thêm các field tương ứng; `system-config-api.ts` gửi thêm 8 field khi lưu.
- Sửa kèm: ô báo lỗi trên trang dùng `border` đầy đủ thay vì đè `borderColor` lên `border` (React cảnh báo khi đổi qua lại).
- Lưu ý: việc làm tròn chiều dài cây đặt riêng lên bội 5 cm đang làm ở phiên Loopwright riêng (BE) - nếu BE đổi luật bước dò
  (vd bội 50) thì cập nhật khoảng / chữ hướng dẫn của ô "Bước dò chiều dài" cho khớp.
- Thử trên trình duyệt: giá trị DB local hiện đúng (cây chuẩn 6000, hao hụt 1, dư 10, ngắn/dài 5000/6000, bước 10, thời gian 60,
  cho đặt cây riêng bật); ngắn nhất 6500 > dài nhất → báo lỗi dưới ô dài nhất và tự chuyển sang tab Máy cắt; cây chuẩn "6000 abc"
  → báo lỗi; đổi dư tối đa 10 → 12, lưu, DB ghi 12, rồi trả về 10; không còn cảnh báo console.
