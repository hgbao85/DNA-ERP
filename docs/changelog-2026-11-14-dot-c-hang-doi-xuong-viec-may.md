# 14/11/2026 - Đợt C bước đầu (FE): hàng đợi theo xưởng, việc của máy ở màn quét, bảng chia theo câu 10 + câu 6

Đi kèm changelog BE cùng tên.

## Thay đổi

1. **Hàng đợi theo xưởng** (Sản lượng xưởng › Sản lượng & gửi KCS, `QlsxFloorPage` / `QlsxQueue`, mới `queueWorkshop.tsx`):
   - Ô "Xưởng" ở đầu khối hàng đợi:
     - QLSX gắn xưởng thấy nhãn cố định.
     - QLSX chưa gắn xưởng chọn xưởng, nhớ trong phiên; chưa chọn thì lấy xưởng đầu danh sách.
   - Mọi nút (Chuyển lệnh tiếp, Mở lại, Xếp lại, Thêm lệnh) gửi đúng xưởng đang xem; danh sách Thêm lệnh lọc theo xưởng.
   - Thẻ lệnh chỉ gắn nhãn "Lệnh của Xưởng …" khi lệnh thuộc xưởng khác xưởng hàng đợi, vd lệnh Phước An trong hàng đợi Sơn của Phú An. Hàm `otherWorkshopLabel` trong `floor-api.ts`.
   - Tổ Sơn có dòng chú thích "Hàng đợi Sơn theo nơi sơn: lệnh của Phước An sơn ở Phú An."
2. **Màn quét máy cắt** (`FloorScanApp`): khối "Việc của máy" trên phần báo.
   - Các dòng chia theo thứ tự cắt; mỗi dòng có:
     - mã lệnh, loại sắt;
     - chiều dài cây, số cây, kiểu cắt;
     - nhãn Uốn / Dập / Khoan / Tán;
     - chi tiết ra, dư mỗi cây.
   - Nhãn "Đang chạy", "Cắt theo bó".
   - Chỉ hiện 3 dòng đầu, có nút "Xem thêm N dòng", để ô nhập số đoạn không bị đẩy xa.
   - Rỗng thì hiện "Máy chưa được chia việc - hỏi QLSX." Không đổi luồng báo.
3. **Bảng chia** (`QlsxCutAllocation`, `cutAllocationModel`):
   - **Dòng kiểu cắt theo bó:**
     - Nút Tách khoá và mờ, ô số cây khoá và xám, kèm gợi ý.
     - Đổi máy phải chọn lý do "Máy hư"; nút "Đổi máy" mờ tới khi chọn.
   - **Dòng thường:** Đổi máy / Tách có lý do tuỳ chọn (Máy hư / Khác) + ghi chú.
   - **Khối mới "Lịch sử chia tay"** (thu gọn mặc định, lọc khoảng ngày, mặc định 30 ngày):
     - "Lệnh có điều chuyển": số lần đổi máy, tách, vì máy hư.
     - Nhật ký các lần thêm / tách / đổi máy / đổi số cây / xoá. Điện thoại hiện dạng thẻ.
4. **Hướng dẫn** `manufacturing.ts`: hàng đợi theo xưởng, việc của máy ở màn quét, dòng theo bó, lịch sử chia tay.

## Kiểm tra

- `tsc` sạch, eslint sạch, vitest thư mục Floor: 110 test đạt.
- **Chụp thật** (FE trỏ vào BE thử trên bản sao DB, đã xoá), máy tính 1440 + điện thoại 375, không màn nào tràn ngang:
  - hàng đợi Phú An / Phước An / Sơn;
  - bảng chia có dòng theo bó + khung đổi máy + lịch sử;
  - màn quét máy Phú An / Phước An / máy chưa được chia.
- **Lỗi bắt khi review, đã sửa:**
  - Nút Tách và nút xác nhận đã khoá nhưng trông như bấm được (thiếu kiểu mờ).
  - Thẻ lệnh Phước An trong hàng đợi Sơn của Phú An bị ghi nhầm "Xưởng Phú An".
  - Khối việc của máy quá dài, đẩy ô báo xuống dưới.

## Chưa làm

- Khối "Chờ gửi KCS" chưa lọc theo xưởng.
- Đổi máy dòng thường giờ phải bấm thêm nút "Đổi máy" trong khung nhỏ (để ghi lý do).
