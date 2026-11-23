# 23/11/2026 - Bỏ hàng đợi xưởng, gộp sản lượng vào Hướng dẫn cắt (FE)

## Vì sao
- Tab "Sản lượng & hàng đợi" trùng với Hướng dẫn cắt (xem các tổ), và QLSX phải chuyển lệnh tay. Chốt 23/11: bỏ hàng đợi.
  Sản lượng xem ở Hướng dẫn cắt, Khung hàn và Mảnh chờ đan. Hàn / Sơn tự chọn lệnh làm được ngay trên màn quét.
- Phước An chỉ có Phôi + Hàn: lệnh Phước An hàn xong thì làm phiếu chuyển khung sang Phú An, tổ Sơn Phú An sơn (BE lọc Sơn
  theo nơi sơn).

## Thay đổi
- **Sản lượng xưởng (QLSX), `QlsxFloorPage`:**
  - bỏ tab "Sản lượng & hàng đợi", mặc định mở tab "Chia máy cắt";
  - xoá `QlsxQueue`, `QlsxReview` (+ test).
  - Bỏ số đỏ tin chờ KCS ở menu QLSX.
- **Màn quét `scan/*`, `useScanReport`:**
  - Hàn / Sơn chọn lệnh trong `stagePis`: mỗi ô lệnh ghi mã lệnh + "còn thiếu N mảnh" + "hạn dd/mm" (còn ≤ 3 ngày màu cam, quá
    hạn màu đỏ kèm "quá hạn"). Ô đang chọn nền đặc màu chính, chữ trắng, dấu ✓ (ô Sản phẩm cùng kiểu). Chỉ có 1 lệnh vẫn hiện
    ô, chọn sẵn; hết lệnh thì hiện câu nhắc.
  - Bỏ "đang làm" / "làm bù".
  - Báo xong (hoặc bị 4xx) thì tải lại không kèm lệnh trước; chỉ giữ lệnh đang chọn nếu nó còn trong danh sách, nên lệnh vừa
    báo đủ số không còn gây 409.
- **Hướng dẫn cắt (`HuongDanCatPage`, `guideOutputModel`):**
  - **Bảng tổng kết** mỗi loại sắt: cột Tên sắt · Đoạn (đứng yên khi cuộn ngang) · Còn thiếu · Cần · Theo phương án · Đã cắt ·
    KCS đạt · Lỗi. Còn thiếu = Cần − (Đã cắt − Lỗi), cùng cách tính với Tổng hợp lệnh SX / Khung hàn / màn quét (phần KCS chưa
    chấm tính tạm). Dưới Đã cắt ghi nhỏ "n đang mở · n KCS đang chấm". Cột "Cần" lấy số cần thật của lệnh (gồm phần KCS đánh bỏ
    phải cắt lại, ghi "(+n cắt lại)"). Công đoạn phụ ghi nhỏ dưới tên sắt. Số 0 màu trung tính.
  - **Dòng nhỏ** dưới mỗi cỡ đoạn cho các công đoạn phụ, vd "Uốn 6/20 · Dập 0/20".
  - **Khối "Mảnh Phôi"** ở cuối trang; đầu trang chi tiết có dòng "Mảnh Phôi: còn thiếu N · xem ↓" bấm để cuộn tới. Lệnh có từ 2 SKU thì mỗi dòng mảnh ghi thêm SKU (cũng áp cho "Còn thiếu" ở chi tiết
    lệnh).
  - **Danh sách lệnh:** thành thẻ dùng chung với Khung hàn (`PiProgressCard`): mã lệnh, "Xong Phôi dd/mm" hoặc "còn thiếu N
    đoạn / mảnh", hạn giao, thanh % Phôi đã báo, lấy theo id các lệnh đang hiện (chia lô 200), nên lệnh cũ
    cũng có.
  - Bản in và Excel không đổi.
  - Tự tải lại khi có thay đổi xuất sắt / KCS / xưởng.
- **Khung hàn / Mảnh chờ đan:** thêm khối "Sản lượng theo lệnh" (`StageOutputBlock`, `stageOutputModel`): chọn xưởng, bấm một
  lệnh để xem chi tiết (`QlsxPiDetail`). Khối kho cũ giữ bên dưới.
  Có dòng chú thích "% và còn thiếu tính theo số đã báo trừ lỗi (gồm phần KCS chưa chấm)".
- **Sản lượng xưởng:** chữ "Xem các tổ" trong câu mô tả là liên kết.
- **Sửa lỗi có từ trước:** QLSX mở thẳng `?p=phoi-huong-dan-cat` / `phoi-kho-phoi` / `han-khung-han` / `son-manh-cho-dan` ra màn
  trắng (QLSX không có menu riêng cho các trang này). Nay chuyển sang "Xem các tổ" đúng tab (`teamViewForUrl`); vai khác không đổi.
- **`services/floor-api.ts`:**
  - bỏ kiểu và hàm hàng đợi;
  - thêm `stagePis`, `stageProgress(stage, workshopId?, productionInvoiceIds?)`, `stageDetail`.
- **Chữ:** bỏ các câu nhắc hàng đợi ở `FloorScanApp`, `QlsxSetup`, `QlsxCutAllocation`, `ChangeWorkshopDialog`. Hướng dẫn trong
  app sửa ở `Guide/content/manufacturing.ts` và `productionPlan.ts`.

## Kiểm
- vitest 78 file / 972 test đạt; tsc sạch; eslint các file đổi sạch.
- QA nghiệm thu trên bản sao (desktop + 375 px): Đạt sau 1 lượt sửa (SL cần, tải lại sau báo, chip 1 lệnh, SKU trên dòng mảnh,
  chữ Sơn theo nơi sơn). Console sạch trên các màn mới.

## Lưu ý deploy
- Deploy NGAY SAU BE.
- Báo xưởng:
  - QLSX không còn tab hàng đợi.
  - Tổ Hàn / Sơn tự chọn lệnh trên màn quét.
  - Sản lượng từng tổ xem ở Hướng dẫn cắt, Khung hàn và Mảnh chờ đan.
