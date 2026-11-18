# 18/11/2026 - Nhóm 1 quanh QLSX (N1) + bỏ tab tổ nhận vật tư, Admin kiểm kê đoạn (P3) (FE)

Đi kèm BE: changelog cùng ngày `changelog-2026-11-18-nhom1-qlsx-p3-vat-tu-kiem-ke-doan.md` ở repo BE (tin theo xưởng hàng đợi, nhắc chờ
lâu theo tổ × xưởng, nhắc Kết thúc, chia máy cắt tay xếp hàng đợi Phôi + báo thủ kho, nhắc chuyển mảnh sang Sơn, `expectedRunningPiId`,
vật tư Hàn / Sơn kho xuất là đã nhận + migration, chặn kiểm kê đoạn khi chưa chuyển đổi).

## Thay đổi

### QLSX - Sản lượng xưởng / hàng đợi (N1)
- `Floor/QlsxQueue.tsx`: tổ Phôi có lệnh chạy mà KCS đã đạt đủ nhưng hệ thống chưa tự chuyển -> hiện băng nhắc + nút "Chuyển lệnh tiếp"
  (hàm `phoiAwaitingAutoClose`, có test). Nút gửi `expectedRunningPiId` = id lệnh màn đang thấy (null khi tổ chưa chạy lệnh nào); máy chủ
  thấy khác thì báo 409 tải lại màn. Số "đợt chờ gửi KCS" trong hộp hỏi tính theo lệnh đang chạy. Hộp "Bỏ khỏi hàng đợi" của tổ Phôi nhắc
  lệnh đã Bắt đầu còn dòng chia sẽ được xếp lại.
- `Floor/QlsxFloorPage.tsx`: bỏ đếm tổng đợt chờ (đã chuyển vào QlsxQueue theo lệnh).
- `Floor/piDetailModel.ts`: số lỗi chưa bù tính từng dòng (cỡ đoạn × công đoạn).
- `services/floor-api.ts`: `advance(stage, workshopId, expectedRunningPiId)`; kiểu `started` cho bảng chia.

### Chia máy cắt (N1)
- `cutAllocation/Board.tsx`, `StockPanels.tsx`, `ChangeHistory.tsx`, `cutAllocationModel.ts` (+ test): ghi mã lệnh (GP-xxx) thay mã PI;
  dòng lệnh chưa Bắt đầu có nhãn "chưa Bắt đầu" và nút "Chia luôn" bị khoá; hiện `board.warnings` của BE.

### Máy & tem QR (N1)
- `Floor/QlsxSetup.tsx` + `Floor/workstationConfirm.ts` (mới, có test): hỏi lại trước khi tắt máy, đổi xưởng, đổi loại máy cắt. Hộp tắt /
  đổi xưởng máy cắt ghi rõ phần việc đã chia của máy sẽ bị xoá (về "Chưa chia").

### Tổng hợp lệnh SX + số đỏ (N1)
- `Manufacturing/ThongKePagePlan.tsx`: ô lọc "Chờ kết thúc (N)" (SKU đóng gói đủ chưa Kết thúc); đọc `?pi=` để mở thẳng bảng SKU của lệnh
  và nháy dòng SKU (bấm tin "đã đóng gói đủ - bấm Kết thúc").
- `Manufacturing/currentStagePick.ts` (+ test): `isAwaitingFinish`.
- `Manufacturing/MfgApp.tsx`: menu "Tổng hợp lệnh SX" của QLSX có số đỏ `qlsxAwaitingFinish`.
- `InboundWarehouse/InboundWarehouseApp.tsx`: tab "Xuất theo đơn hàng" có số đỏ `warehouseToPaintPending` (thủ kho kho Hàn của xưởng
  không có kho Sơn).

### Bỏ bước tổ Hàn / Sơn xác nhận nhận vật tư (P3)
- Xoá `Manufacturing/XacNhanVatTuPage.tsx` và tab "Xác nhận nhận vật tư" của tổ Hàn / Sơn (`MfgApp.tsx`). Địa chỉ cũ
  `p=han-son-xac-nhan-vat-tu` rơi về tab mặc định.
- `InboundWarehouse/PhanPhoiNoiBoPage.tsx`, `XuatVatTuTieuHaoPage.tsx`, `Han/KhungHanPage.tsx`, `Son/ManhChoDanPage.tsx`: sửa chữ / chú
  thích còn nhắc tab đã gỡ.

### Admin - Tồn đoạn kho Phôi, Quản lý kho, Lịch sử kho (P3)
- `Admin/AdminApp.tsx`: mục mới "Tồn đoạn kho Phôi" (dưới "Quản lý kho") dùng `Phoi/KhoPhoiPage.tsx` với mọi kho Phôi đang hoạt động, có
  nút Kiểm kê từng dòng; BE trả 409 chưa chuyển đổi thì hiện câu của BE (`khoPhoiModel.ts`, có test).
- `Manufacturing/MfgWarehousesPage.tsx` + `mfgWarehousesModel.ts` (mới, có test): kho ảo không sửa tồn được; sửa tồn sắt bắt chọn chiều dài
  cây (mặc định 6000) và ghi đúng ô chiều dài; "Sao chép vật tư" nhóm Sắt hiện câu nhắc thay ô tồn ban đầu.
- `components/AdjustReasonModal.tsx`: ô chiều dài cây cho sắt.
- `components/WarehouseLedgerHistory.tsx` + `warehouseLedgerModel.ts` (mới, có test): dòng điều chỉnh / kiểm kê hiện "Người sửa: <tên>",
  dòng tồn đầu kỳ hiện "—".

### Hướng dẫn trong app
- `Guide/content/manufacturing.ts`, `warehouse.ts`, `admin.ts`, `journey.ts`: gỡ bài tổ Hàn / Sơn xác nhận nhận vật tư; thêm bài Admin "Tồn
  đoạn kho Phôi"; sửa đoạn QLSX (Chờ kết thúc, Chuyển lệnh tiếp), Chia máy cắt, Máy & tem QR, hàng đợi, thủ kho Hàn Phước An.

### Sửa theo QA review độc lập (18/11)
- `Floor/QlsxQueue.tsx`: "Chuyển lệnh tiếp" bị 409 (lệnh đang chạy vừa đổi) thì hộp đóng, hàng đợi tải lại, câu của máy chủ hiện ở thẻ
  (trước đây hộp vẫn mở và bấm lại vẫn gửi id cũ). Cả hộp "Chuyển lệnh tiếp" lẫn hộp "còn thiếu" (`isStaleConflict`, có test).
- `Floor/cutAllocationModel.ts`: hộp "Chia lại" nhắc dòng hệ thống của lệnh chưa Bắt đầu / Tạm dừng sẽ về "Chưa chia".
- `Floor/workstationConfirm.ts`: hộp tắt / đổi xưởng máy cắt nhắc phần máy đã cắt dở cũng về "Chưa chia", chia lại phải bớt số đã cắt.
- `Phoi/KhoPhoiPage.tsx` + `khoPhoiModel.ts`: màn Admin "Tồn đoạn kho Phôi" không còn nháy "Không tải được dữ liệu" lúc đang tải.
- `Manufacturing/MfgWarehousesPage.tsx` + `mfgWarehousesModel.ts`: nhóm vật tư chưa tải / lỗi thì khoá sửa tồn vật tư có nhóm (băng vàng,
  nút Thử lại) để sắt không bị ghi vào ô chiều dài 0.
- `Admin/masterData/MaterialsPage.tsx`: tạo vật tư Sắt phần mềm không còn ô "Tồn kho ban đầu" (ghi vào ô chiều dài 0); câu nhắc nhập ở
  Quản lý kho > Sửa tồn.
- Hướng dẫn: "7 kho cố định và các kho ảo", băng đỏ "Có tồn âm" / băng vàng "Dư âm"; thời điểm tin chuyển mảnh tự đóng; "mỗi tổ của mỗi
  xưởng một thông báo"; số đỏ menu đếm SKU còn ô lọc đếm lệnh; tin xuất sắt liệt kê mọi loại sắt chưa xuất.
- Xoá ảnh `public/guide-screens/mfg-han-son-nhan-vattu.png` (tab đã gỡ).

### Sửa theo QA nghiệm thu (18/11)
- `Floor/QlsxQueue.tsx`: hộp "Chuyển lệnh tiếp cho tổ …?" (tổ chưa đủ số) chụp lệnh đang chạy / lệnh kế lúc mở hộp và gửi id lệnh đó;
  trước đây màn tự tải lại làm hộp đổi sang lệnh mới và đóng nhầm lệnh mới mà máy chủ không chặn. Chuyển thành công thì xoá câu lỗi cũ.
- `Floor/progressModel.ts` `pieceLine`: dùng `failedQty` mới của BE (đã báo = đạt + lỗi + chờ + chưa gửi; được tính = đã báo − lỗi nên % và
  còn thiếu không đổi) để tab "Bất thường" của tổ Hàn / Sơn hiện "KCS chấm lỗi N cái chưa làm bù".
- `Manufacturing/batchPlanLines.ts`: cột "Đã báo" của "Tổng hợp lệnh SX" lấy số được tính (`goodQty`), không cộng phần lỗi (QA review bắt
  được ở lần sửa đầu: nếu lấy `done` thì Đã báo / Còn lại / % / số bộ đồng bộ bị cộng thêm lỗi). Có test.
- `Floor/piDetailModel.ts`: lỗi chưa bù tách 2 dòng "đoạn" và "cái" (tổ Phôi có cả đoạn sắt lẫn mảnh như pat).
- `Floor/QlsxPiDetail.tsx`: tab "Còn thiếu" - dòng mảnh luôn ghi "cái" (trước ghi "đoạn" ở tổ Phôi) và kèm "(KCS lỗi chưa bù N)" để biết lỗi
  nằm ở mảnh nào.
- `Floor/QlsxQueue.tsx`: câu đỏ 409 cũng tự xoá khi "Mở lại", "Bỏ khỏi hàng đợi", "Thêm lệnh" thành công.
- `services/production-batches-api.ts`: `failedQty?` cho mục mảnh.
- `Guide/content/admin.ts`: bài "Tồn đoạn kho Phôi" thêm ý số đếm ít hơn phần đang giữ, xem lại ở Lịch sử kèm "Người sửa", câu 409
  nguyên văn.

## Kiểm tra (18/11)
- Làm trên FE `013470d`.
- vitest toàn bộ: 64 file / 749 test đạt. tsc sạch. ESLint các file đổi: 0 lỗi (12 cảnh báo, phần lớn có sẵn; mới: 1
  `set-state-in-effect` ở ThongKePagePlan khi mở lệnh theo `?pi=`).
- QA nghiệm thu trên bản sao dữ liệu 17/11 (desktop + 375 px): xem changelog BE cùng ngày (P3 22 đạt, N1 31 đạt, không lỗi Cao / Vừa;
  lỗi Thấp mới đã sửa ở mục trên).

## Còn biết, chưa sửa
- `e2e/full-flow.spec.ts` (chưa theo dõi git) còn mở tab đã gỡ.
- Hộp "Chuyển lệnh tiếp" ghi tên lệnh kế, nhưng máy chủ chỉ kiểm lệnh đang chạy; nếu đúng lúc đó có người đổi thứ tự hàng đợi, lệnh được
  chạy có thể khác tên trong hộp (Thấp, ít gặp).
- Chưa có test tự động cho hành vi hộp giữ lệnh lúc mở (đã kiểm trên app thử).
- Thẻ "Chờ gửi KCS" của QLSX còn ghi mã PI thay mã lệnh (đã biết từ 17/11).

## Lưu ý deploy
- **Push FE (demo) SAU khi BE (main) đã chạy xong trên Render** (nút "Chuyển lệnh tiếp" gửi trường mới mà BE cũ chặn).
- Báo người dùng:
  - QLSX: có tin + số đỏ + ô lọc "Chờ kết thúc"; chia máy cắt tay giờ tự xếp hàng đợi Phôi và báo thủ kho, không chia lệnh chưa Bắt đầu;
    tổ Phôi có nút "Chuyển lệnh tiếp" khi KCS đạt đủ mà chưa tự chuyển; Máy & tem QR có hộp hỏi lại; QLSX Phú An nhận tin tổ Sơn của lệnh
    Phước An.
  - Thủ kho kho Hàn Phước An: tin + số đỏ "Xuất theo đơn hàng" khi có mảnh hàn xong chờ sang kho Sơn; phiếu vẫn tự lập và ký như cũ.
  - Tổ Hàn / Sơn: không còn tab "Xác nhận nhận vật tư"; thủ kho xác nhận phiếu có chữ ký là đã nhận.
  - Công nhân: quét tem máy đang tắt thấy "Máy này đang tắt - báo QLSX bật lại".
  - Admin: có "Tồn đoạn kho Phôi", nhưng ghi kiểm kê đoạn bị chặn tới khi IT chuyển đổi dữ liệu đoạn.
