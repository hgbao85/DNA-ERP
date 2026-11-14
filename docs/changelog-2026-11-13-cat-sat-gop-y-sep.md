# 13/11/2026 - Tối ưu cắt sắt theo góp ý của Sếp (12/11)

Phần giao diện đi kèm thay đổi BE cùng ngày (xem changelog cùng tên ở repo BE).

## Thay đổi

- **Tối ưu cắt sắt** (`GomDotCatPage.tsx`):
  - Thêm ô **Xưởng cơ khí**, bắt buộc chọn mới bấm được Tính. Xưởng được gửi kèm lượt tính; lệnh tạo ra mang sẵn xưởng đó.
  - Dưới ô chọn hiện luật số cỡ đoạn/cây của xưởng (nếu có). Số ước tính trên bảng chưa áp luật này.
  - Khung "Lệnh vừa đổi xưởng": sửa câu hướng dẫn (xưởng mới có thể có luật cắt riêng; Sếp chưa duyệt được tới khi bấm Đã kiểm).
- **Kết quả đã tính** (`CuttingSolvePanel.tsx`):
  - "Cài đặt đã dùng" hiện tên xưởng.
  - Dòng loại sắt hiện lý do khi phải nới số cỡ đoạn/cây, và nhãn "có trong kho" khi chọn chiều dài đang có tồn.
- **Lệnh sản xuất** (`LenhSXPage.tsx`):
  - Hộp "Gửi QLSX": lệnh đã có xưởng thì ô xưởng chọn sẵn và khoá.
  - Màn Sếp duyệt: lệnh đang chờ kiểm lại phương án cắt hiện nhãn và khoá nút Duyệt; Từ chối vẫn dùng được.
- **Admin › Cấu hình hệ thống** (`SystemConfigPage.tsx`):
  - Khối mới "Số cỡ đoạn tối đa trên 1 cây theo xưởng" (mỗi xưởng một ô 1–10, để trống = theo máy).
  - Sửa mặc định và lời giải thích: tề đầu MC Tự động 10, dải dò 4000–6500 (dò từ cây chuẩn ra 2 phía), khung gộp 5, hao hụt chỉ tính cùi.
- **Theo quy tắc chia sắt cho máy cắt (07/11)**:
  - Tối ưu cắt sắt: xưởng có máy cắt bắt buộc (Phước An = MC Tự động) thì ô máy cắt tự chuyển sang máy đó và khoá; ước tính cũng theo máy đó.
    Bảng "Xem thông số máy cắt" liệt kê số cây/bó theo quy cách.
  - Quy cách ngoài bảng bó bị BE chặn khi Tính với MC Tự động (Sếp chốt 13/11, câu 3): màn hiện nguyên câu BE; bảng "Xem thông số máy cắt" ghi rõ.
  - Mỗi dòng kết quả hiện đúng máy của dòng (dữ liệu cũ có thể khác máy).
    `linesMachine` (`utils/cutMachine.ts`): phương án có dòng MC Tự động thì cả phương án là MC Tự động.
  - Admin › Cấu hình hệ thống › Máy cắt: "Máy cắt bắt buộc theo xưởng" và bảng "Số cây/bó theo quy cách" (thêm / xoá dòng, kiểm mã quy cách
    `V…`, `H…-…`, `FI…`).
  - Panel MC Laser có ô "Đoạn cuối tối thiểu (mm)" (`solverLaserMinTailMm`, mặc định 100, 0 = tắt) theo câu 11 Sếp chốt 13/11; màn KHSX hiện
    thông số này trong "Xem thông số máy cắt", và dòng "Cắt lẻ (phần không đủ bó): tối đa (bó nhỏ nhất − 1) cây" khi có bảng bó.
  - Câu mô tả luật số cỡ sửa theo thứ tự đúng: giữ cây chuẩn và chiều dài tồn, nới số cỡ trước, không đạt mới dò cây đặt riêng.
- **Chỉnh màn Tối ưu cắt sắt cho dễ đọc** (`GomDotCatPage.tsx`, chỉ giao diện):
  - Ô Xưởng cơ khí đứng trước ô Máy cắt.
  - Chip loại sắt và khối "Đợt đang chọn" hiện "Tên · Quy cách" thay cho mã vật tư (mã nằm trong tooltip).
  - Mỗi loại sắt vượt ngưỡng: các cách xử lý xếp thành lưới Cách xử lý | Hao hụt ước tính | nút; cách đạt ngưỡng tốt nhất có nhãn "nên chọn".
    Cách gộp không đạt ngưỡng không còn nút "Thêm vào đợt".
  - Xưởng có luật số cỡ: dòng "Đặt riêng" ghi rõ hệ thống giữ cây chuẩn và nới số cỡ trước, không còn khuyên đặt cây riêng theo số ước tính.
  - Cảnh báo dựa trên ước tính ở cây chuẩn chuyển sang màu vàng và ghi rõ là ước tính; màu đỏ chỉ còn cho kết quả bộ giải đã kiểm và lỗi luật gộp.
  - Chiều dài cây ghi thống nhất theo mm ("6.050 mm"), không còn "6m05".
  - Dòng trạng thái có tiến độ "Đã kiểm X/Y loại sắt"; chip đang kiểm chỉ còn biểu tượng xoay và tên sắt.
- **Khung gộp**: mặc định phía FE 3 → 5 (`steelNeedWindow.ts`).
- **Hướng dẫn sử dụng**: cập nhật các mục Tối ưu cắt sắt, Lệnh sản xuất, Cấu hình hệ thống.

## Kiểm tra

- tsc sạch; eslint toàn `src` giữ 189 cảnh báo, 0 lỗi; vitest 445/445.
- Thử trên trình duyệt (local): màn Tối ưu cắt sắt có ô xưởng, chưa chọn thì nút Tính khoá; chọn Phước An thì ô máy khoá ở MC Tự động;
  kết quả hiện tên xưởng đã tính và dòng lý do nới số cỡ.

## Chưa làm

- Bản in hướng dẫn cắt và màn Phôi (`cuttingGuide.ts`, `HuongDanCatPage.tsx`), trang Admin › Phương án cắt chưa có nhãn "có trong kho"
  và chưa hiện lý do nới số cỡ.
- Khung "Lệnh vừa đổi xưởng" chưa có nút tính lại cho từng lệnh.
