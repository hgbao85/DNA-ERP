# 14/11/2026 - Đợt C2 (FE): tiến độ máy cắt, máy rảnh / sắp hết việc, xong Phôi tự tính

Đi kèm changelog BE cùng tên.

## Thay đổi

1. **Bảng chia** (`QlsxCutAllocation`, `cutAllocationModel`):
   - **Thẻ máy:**
     - ghi "Đã cắt ≈ A/B cây · còn ≈ C cây";
     - nhãn "Máy rảnh" (đỏ), "Sắp hết việc" (vàng), "Chưa có việc".
   - **Một thanh cho cả tải lẫn tiến độ** (`loadBarSegments`):
     - độ dài phần tô màu = tải so với máy nhiều việc nhất (như 13/11);
     - trong đó xanh lá = cây ước đã cắt, xanh dương = cây còn lại.
   - **Dòng:** ghi "≈ đã cắt n/m cây"; dòng cắt đủ thì mờ, có nhãn "Xong".
2. **Màn quét** (`FloorScanApp`):
   - **Khối "Việc của máy":**
     - "Còn ≈ C cây" + thanh tiến độ;
     - máy rảnh hiện "Máy đã cắt hết việc được chia - báo QLSX chia thêm.";
     - mỗi dòng ghi "≈ đã cắt n/m cây".
   - **Nút "Báo cho lệnh này"** (cao 44px) ở dòng chưa xong:
     - bấm thì chọn lệnh đó và cuộn xuống phần báo;
     - dòng đang báo đổi chữ thành "Đang báo lệnh này · nhập số ở dưới".
   - **Chọn lệnh:**
     - thêm nhóm "Lệnh trong bảng chia" (các lệnh không có trong "đang làm" / "làm bù");
     - máy hết việc mà chưa có lệnh chạy thì hiện danh sách để chọn, thay vì "chưa có lệnh nào để làm".
   - Banner "LÀM BÙ" chỉ hiện cho lệnh làm bù; lệnh trong bảng chia không bị gắn nhầm.
3. **Hàng đợi tổ Phôi** (`QlsxQueue`):
   - Khi đang có lệnh chạy:
     - ẩn "Chuyển lệnh tiếp" và "Mở lại";
     - hiện câu "Xong Phôi: hệ thống tự chuyển khi mọi đoạn đủ công đoạn và KCS đạt (Sếp chốt 14/11)."
   - Dòng do hệ thống đóng / tự chạy ghi "hệ thống tự chuyển" (`queueActorText`).
4. `floor-api.ts`: thêm kiểu `CutMachineStatus`, các trường ước cây, `allocationPis`.
5. Hướng dẫn `manufacturing.ts`: bảng chia, màn quét, xong Phôi tự tính.

## Kiểm tra

- `tsc` sạch, eslint sạch, vitest thư mục Floor: 116 test đạt.
- **Chụp thật** (FE trỏ vào BE thử trên bản sao DB, đã xoá), máy tính 1440 + điện thoại 375, không màn nào tràn ngang:
  - bảng chia (máy rảnh / sắp hết việc);
  - màn quét máy TD1 (đang báo, lệnh trong bảng chia) và máy L2 (máy rảnh);
  - chuông thông báo của KHSX;
  - hàng đợi Phôi có dòng "hệ thống tự chuyển".
- **Lỗi bắt khi review, đã sửa:**
  - Thẻ máy có 2 thanh rời không nhãn: thanh tiến độ 0% nằm trên thanh tải, nhìn như máy đã cắt được một ít. Đã gộp thành 1 thanh.
  - Nút "Báo cho lệnh này" lặp lại ở dòng đang báo.
  - Máy rảnh báo nhầm "Tổ Phôi chưa có lệnh nào để làm".
  - Dòng hàng đợi do hệ thống đóng để trống tên người.

## Chưa làm

- C3 (máy rảnh tự kéo lệnh kế) và C4 (đo năng suất) làm bước sau.
