# 19/11/2026 - KCS tự chuyển, chặn báo vượt, KCS ghi số thực có, KCS chọn bỏ / làm lại (FE)

Đi kèm BE: changelog cùng ngày `changelog-2026-11-19-kcs-tu-chuyen-chan-vuot.md` ở repo BE (route KCS chốt đợt, chặn báo vượt trong khoá,
`shortQty` / `scrapQty`, tin `KCS_BATCH_STALE`, 2 migration, KCS có quyền xem đợt đang mở).

## Thay đổi

### KCS (Phôi, Hàn, Sơn, Vật tư không gắn mảnh)
- Màn KCS thấy ngay các đợt công nhân vừa Lưu ("đang mở", giờ báo, người báo) - không còn chờ QLSX gửi. Bấm "Chấm" = chốt đợt (số "Đã
  báo" giữ đúng lúc chốt, công nhân Lưu tiếp thì thành đợt mới) rồi mở hộp chấm.
- Hộp chấm: cột "Đã báo", ô "Thực có" (điền sẵn = Đã báo; gõ lớn hơn thì tự về Đã báo kèm câu "Dư thật thì công nhân báo thêm (nếu còn số
  cần)"), "Lỗi - cắt lại" (Cắt); công đoạn phụ có "Làm lại" và "Bỏ, cắt lại"; dòng tổng "Đạt · Lỗi (bỏ a, làm lại b) · Thiếu c"; thiếu + lỗi
  vượt Đã báo thì dòng đỏ và khoá "Xác nhận chấm". Kết quả có câu vàng (`notes`) khi công đoạn sau đã báo nhiều hơn số đoạn cắt thực có.
- Đợt của lệnh đang tạm dừng / đã kết thúc: dòng xám "Lệnh đang tạm dừng / đã kết thúc - chưa chấm được", nút Chấm khoá, không tính số đỏ;
  tự cập nhật ngay khi QLSX đổi trạng thái lệnh. Dữ liệu cũ chưa gắn SKU ở lệnh nhiều SKU: dòng xám "báo IT".
- Tự tải lại theo realtime (gom 3 giây; chậm nhất 5 giây kể từ sự kiện đầu dù sự kiện còn đến liên tục). KCS Phôi đọc đủ mọi trang danh
  sách lô / đợt.
- Tiêu đề nhóm KCS Hàn / Sơn giữ tổng số đã báo cả khi lệnh đang dừng.
- File chính: `Kcs/KcsPhoiPage.tsx`, `KcsStagePage.tsx`, `KcsChanNhomSection.tsx`, `kcsReviewModel.ts` (mới, hàm thuần), `components/sanxuat/
  kcsCore.tsx`, `services/kcs-floor-api.ts` (mới).

### QLSX - Sản lượng xưởng
- Tab "Sản lượng & hàng đợi" (bỏ chữ "gửi KCS"): không còn nút "Gửi KCS đợt này / tất cả"; khối "Đang chờ KCS chấm" mở từng lần báo ("Xem
  lần báo") kèm nút Hủy (ghi lý do) và câu "KCS bấm Chấm thì không hủy được nữa". Màn hẹp: mỗi lần báo là một thẻ, nút Hủy thấy ngay.
- Pill từng tổ "N đang mở · M KCS đang chấm · K quá 4 giờ"; số đỏ menu = tổng đợt chờ KCS chấm quá 4 giờ; tự hỏi lại mỗi 5 phút khi đang xem.
- Thẻ lệnh: thanh 3 ngăn KCS đạt / KCS đang chấm / đang mở, "Còn N đợt đang mở.", "(+N cắt lại)", dòng "Còn phải cắt … - sắt còn ước …,
  thiếu khoảng …" khi thiếu sắt cho phần cắt lại.
- Bấm tin "đợt chờ KCS chấm quá 4 giờ": QLSX mở "Sản lượng xưởng" đúng tab tổ (Phôi / Hàn / Sơn); link `?p=kcs-*` của QLSX chuyển sang
  "Sản lượng xưởng".
- File chính: `Floor/QlsxReview.tsx`, `QlsxFloorPage.tsx`, `QlsxQueue.tsx`, `QlsxPiDetail.tsx`, `piDetailModel.ts`, `progressModel.ts`,
  `qlsxUi.tsx`, `floorStats.ts`, `Manufacturing/MfgApp.tsx`, `components/sanxuat/PhoiMaterialBoard.tsx`.

### Công nhân - màn quét
- Mỗi cỡ đoạn / mảnh hiện "còn báo được N" (số của máy chủ, gồm giới hạn số đoạn đã cắt); hết số cần hiện "đã đủ (vượt N)", không số âm.
  Gõ quá N: báo ngay ở ô "Chỉ còn báo được N đoạn. Sửa lại số." và khoá Lưu; máy chủ vẫn chặn (băng đỏ, số đã nhập giữ nguyên, tự tải lại
  số mới).
- "Sản lượng của tôi": đợt đang mở "Chờ kiểm hàng"; đợt đã chấm có nhãn "KCS chấm cả đợt: thiếu N · lỗi M" ở dòng mới nhất của đợt.
- File chính: `Floor/scan/scanModel.ts`, `SegmentForm.tsx`, `PieceForm.tsx`, `ScanParts.tsx`, `MyOutputTab.tsx`, `useScanReport.ts`,
  `FloorScanApp.tsx`.

### Chung
- `realtime/hooks.ts`: `useRealtimeRefetch` có trần chờ `maxWaitMs` (mặc định 5 giây); nơi khác giữ debounce cũ.
- `hooks/useWorkQueue.ts`, `workQueueTopics.ts`: KCS nghe thêm 'floor' (gom 3 giây).
- `services/*-api.ts`: kiểu mới (`maxNow`, `physicalLeft`, `kcs`, `batchKey`, `waitingSince`, `stoppedPis`, summary `{ open, awaitingKcs,
  stale }`, `shortQty` / `scrapQty` / `notes`); bỏ hàm hoàn tác đợt cắt.
- Hướng dẫn trong app (Sản xuất, hành trình, kế hoạch): bỏ "QLSX kiểm rồi gửi KCS", thêm KCS tự chấm, số thực có, bỏ / làm lại, chặn báo
  vượt, "Riêng pat và chân nhôm được báo vượt số cần (làm sẵn) - phần mềm không chặn.".

## Kiểm tra (19/11)
- Làm trên FE `9e52291` (đã gộp commit 18-19/11 trên demo; `KcsPhoiPage.tsx`, `KcsChanNhomSection.tsx`, `steel-issues-api.ts` gộp 3 chiều với
  bản đọc đủ trang).
- vitest toàn bộ: 71 file / 929 test đạt (+ test mới sau đó). tsc sạch. ESLint các file đổi: 0 lỗi.
- E2E trên bản sao dữ liệu 17/11 (desktop + 375 px, FE mới và FE cũ): xem changelog BE cùng ngày.
- QA nghiệm thu trên bản sao: Đạt có điều kiện, 52 / 52 AC đạt, 0 Cao, 0 Vừa (chi tiết ở changelog BE). Sửa thêm sau nghiệm thu: Hướng dẫn 6
  chỗ chữ cũ (nhãn "KCS chấm cả đợt", dòng tổng pat, Bỏ / Làm lại, câu lỗi trích dẫn, "còn báo được"), câu đỏ hộp chấm cùng chữ câu 400 của
  BE, cột "Tổng SL chờ chấm" ở KCS Hàn / Sơn ghi "(+N chưa chấm được)" cho dòng xám, "Còn phải cắt 2.899 đoạn" có dấu ngăn nghìn. vitest
  71 file / 937 test đạt.

## Còn biết, chưa sửa
- Màn KCS có lỗi 403 `GET /production-orders` trong console (banner "lệnh dừng" gọi danh sách lệnh mà vai KCS không có quyền xem lệnh). Có
  từ trước, màn vẫn chạy.
- Thanh % pat / chân nhôm có thể hiện trên 100% khi làm vượt (quyết định cho phép làm vượt).
- Tài khoản thống kê Phôi: pat / chân nhôm vẫn "Lưu đợt" + "Gửi KCS" như cũ (tới gói vật tư TP bằng QR); chữ "chưa gửi KCS" ở màn này là
  đúng.
- Tin quá 4 giờ của tổ Phôi luôn mở tab Cắt ở KCS Phôi.

## Lưu ý deploy
- **Push FE (demo) SAU khi BE (main) đã chạy xong trên Render.** FE mới gọi route KCS chốt đợt và đọc trường mới; FE cũ chạy được với BE mới.
- Báo người dùng:
  - Công nhân: bấm Lưu là số sang KCS ngay. Báo quá số cần thì không lưu được ("còn báo được N"); số cần sai thì báo QLSX.
  - KCS: **đăng nhập lại** sau ngày đổi. Màn KCS hiện các đợt đang mở; bấm "Chấm" để chốt và chấm. Số báo sai thì ghi "Thực có" (phần thiếu
    không tính lỗi, công nhân không làm bù). Lỗi ở Uốn / Dập / Tán…: chọn bao nhiêu đoạn "Bỏ, cắt lại", còn lại là "Làm lại". Đợt chờ quá 4
    giờ có tin nhắc.
  - QLSX: không bấm "Gửi KCS" nữa. Hủy lần báo sai (ghi lý do) được tới lúc KCS bấm "Chấm". Số đỏ là số đợt chờ KCS chấm quá 4 giờ.
  - Tài khoản thống kê Phôi: pat / chân nhôm báo như cũ và được báo vượt số cần.
  - Lỗi Uốn / Dập KCS chấm trước ngày đổi tính là "làm lại được": cỡ nào trước đây đã cắt thêm để bù thì máy cắt hiện "đã đủ (vượt N)" - không
    phải lỗi.
