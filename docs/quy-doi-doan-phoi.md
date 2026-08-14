# Kế hoạch triển khai — Quy đổi đoạn sắt (Kho phôi)

> Tài liệu này được `src/lib/quy-doi-sat.ts` trỏ tới từ trước ("Xem docs/quy-doi-doan-phoi.md để
> biết hợp đồng dữ liệu & cách bê xuống BE") nhưng chưa từng được viết — đây là bản đầu tiên.
> Ngày chốt quyết định nghiệp vụ: 2026-08-14.
>
> **Đã triển khai 2026-08-14** (cùng ngày) — mục 4 (bước 1-5) đã code xong, xem "Kết quả triển
> khai" ở cuối file. Phần 5 (chưa quyết) vẫn còn nguyên, chưa làm.

## 1. Vấn đề đang giải quyết

[KhoPhoiPage.tsx](../src/modules/pages/Phoi/KhoPhoiPage.tsx) (mục sidebar "Kho phôi", dưới "Lịch sử
nhận sắt") là **domain FE cuối cùng** trong khối sản xuất tại xưởng vẫn chạy mock, không nối được
vào 7 domain M2/M3 đã xong ở [dna-erp-roadmap.html](../../DNA-ERP-BE/docs/dna-erp-roadmap.html) vì
lý do khác hẳn 7 domain kia: không phải thiếu 1 module BE để đổi mock 1-đổi-1, mà là thiếu **quyết
định nghiệp vụ** về cách quy đổi "cây sắt đã cắt" thành "tồn kho theo đoạn" và cách tổ Hàn tiêu hao
đoạn đó.

Trang hiện đọc 2 nguồn mock:
- `getDoanTonKho()` (`phoi-sat.service.ts`) — tự tính tồn đoạn từ `bundles` (kiểu cắt) × tỷ lệ
  KCS đạt, KHÔNG dựa trên dữ liệu ghi tay nào.
- `hanSeed()` (`LenhSanXuatHan.tsx`) — seed cứng phía FE cho nhu cầu Hàn.
- Công thức `computeDoanKho()` ([phan-loai-doan-sat.ts](../src/lib/mock/phan-loai-doan-sat.ts)) tự
  so khớp 2 nguồn trên để chia tồn thành 2 xô "Cần" (chờ chuyển Hàn) / "Thừa" (đầu mẩu).

## 2. Quyết định nghiệp vụ đã chốt (2026-08-14)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Ai/khi nào ghi tồn đoạn vào hệ thống? | **Thủ kho tự đếm thủ công**, không tự động tính từ `CuttingProposalPattern`/tỷ lệ KCS đạt |
| 2 | Nhập tồn qua cơ chế nào? | Dùng đúng `POST /stock-ledger/adjust` **đã có sẵn** — không xây API/màn hình riêng |
| 3 | Đoạn thừa/đầu mẩu (chiều dài lẻ, không khớp BOM) xử lý sao? | Tạo riêng **1 `SegmentSpec` "đầu mẩu" cho mỗi material sắt** (không gắn 1 chiều dài BOM cụ thể) |
| 4 | Khi Hàn báo sản lượng, tồn đoạn có tự trừ không? | **Có** — tự động trừ theo `PartBom.qtyPerPart` |
| 5 | Tồn đoạn có tách riêng theo từng PO không? | **Không** — gộp chung theo kho, khớp đúng `StockQuant` hiện có (không có cột `productionOrderId`) |
| 6 | Tồn không đủ lúc Hàn báo sản lượng thì sao? | **Vẫn cho báo, tồn được phép âm** — cùng triết lý "QC mới là bước kiểm soát" đã áp cho `production-batches` |
| 7 | Đầu mẩu đã tồn có cần hành động xử lý (tái dùng/bán phế liệu) không? | **Có nhu cầu**, nhưng chưa rõ luồng cụ thể — tạm dùng `POST /stock-ledger/adjust` chung, để sau |

## 3. Data contract — đã có sẵn ở BE, KHÔNG cần migration

Tra trực tiếp `prisma/schema.prisma` (D:\DNA-ERP-BE) xác nhận toàn bộ hạ tầng cần thiết đã tồn
tại từ trước, chỉ chưa được nối vào đúng luồng nghiệp vụ:

- `SegmentSpec` (materialId + cutLengthMm) — danh mục "đoạn chuẩn", CRUD qua module
  `segment-specs` đã có.
- `PartBom` (partId → segmentSpecId, `qtyPerPart`) — định mức đoạn/chi tiết Hàn, **đã có sẵn dữ
  liệu** (KHSX khai khi duyệt BOM), chưa được đọc bởi bất kỳ service nào ở bước báo sản lượng.
- `StockLedger`/`StockQuant` — cả 2 đã có cột `segmentSpecId` (kiểu `BigInt?`, 1 trong 4 chân
  hàng XOR cùng `materialId`/`pieceId`/`productVariantId`).
- `StockLedgerRefType.SEGMENT_CONSUME` — **enum value đã tồn tại trong schema, đúng ý nghĩa
  "tiêu hao đoạn"**, nhưng chưa từng được dùng ở bất kỳ service nào (`grep segmentSpecId`/
  `SEGMENT_CONSUME` trong `src/` không ra kết quả nào ngoài DTO/schema) — rõ ràng là chỗ được
  chừa sẵn cho đúng tính năng này.
- `POST /stock-ledger/adjust` (`CreateStockAdjustmentDto`) — đã nhận `segmentSpecId` optional,
  đúng yêu cầu quyết định #2.
- `GET /stock-quant` (`StockQuantResponseDto`) — đã trả `segmentSpecId`/`segmentSpecLabel`,
  filter được qua `ListStockQuantQueryDto.segmentSpecId`.

→ Không cần migration DB. Việc cần làm là **thêm logic ở tầng service** (mục 4) + **dữ liệu**
(mục 4, bước 1) + **nối FE** (mục 4, bước 3-4).

## 4. Các bước triển khai

### Bước 1 — Dữ liệu: khai báo SegmentSpec "đầu mẩu" (không cần code)
KHSX tạo qua CRUD `segment-specs` có sẵn, 1 dòng cho mỗi material sắt đang dùng. Vì unique
constraint là `(materialId, cutLengthMm)` và `SegmentSpec` không có cột mô tả/note riêng, cần
chốt 1 **quy ước giá trị `cutLengthMm`** để phân biệt "đầu mẩu" khỏi đoạn chuẩn thật — đề xuất
`cutLengthMm = 0` (không trùng bất kỳ chiều dài cắt thật nào, dễ lọc `WHERE cutLengthMm = 0` ở
FE khi cần hiển thị riêng tab "Thừa"). Cần KHSX xác nhận quy ước này trước khi thao tác.

### Bước 2 — BE: tự động trừ tồn đoạn khi Hàn báo sản lượng
Sửa [production-batches.service.ts](../../DNA-ERP-BE/src/modules/production-batches/production-batches.service.ts)
`ProductionBatchesService.create()` (dòng ~45-82): sau khi `assertPartInBom()` xác nhận
`partId` thuộc BOM, trước hoặc trong cùng transaction với `productionBatch.create()`:

1. Query `PartBom` theo `(bomRevisionId, partId)` → danh sách `segmentSpecId` + `qtyPerPart`.
2. Với mỗi dòng, gọi `StockLedgerService.postEntry()`:
   - `fromWarehouseId` = kho vật tư sắt (`phoi-son-han`, cùng hằng số `STEEL_WAREHOUSE_CODE`
     dùng ở `steel-issues.service.ts`).
   - `toWarehouseId` = kho "tiêu hao"/công đoạn Hàn (theo đúng quy ước kho ảo đã dùng cho
     `material-issues`, cần xác nhận lại mã kho đích khi code — không suy đoán ở đây).
   - `segmentSpecId`, `qty = qtyPerPart × dto.reportedQty`, `refType = SEGMENT_CONSUME`,
     `refId` = id của `ProductionBatch` vừa tạo.
3. **Không chặn nếu tồn không đủ** — `postEntry()` hiện không tự check số dư âm (StockQuant chỉ
   là cache materialize qua trigger), đúng quyết định #6 nên không cần thêm code chặn.
4. Test: thêm case cho `ProductionBatchesService.create()` xác nhận `StockLedger` có đúng số dòng
   `SEGMENT_CONSUME` với `qty` đúng theo `PartBom`, và case tồn âm vẫn tạo batch thành công.

### Bước 3 — FE: mở rộng adapter tồn kho
[stock-api.ts](../src/services/stock-api.ts) hiện chỉ map `materialId`/`materialCode` trong
`BeStockQuant`, và `adjustStock()` chỉ nhận `materialId` — dù BE đã trả/nhận `segmentSpecId` từ
trước (mục 3). Cần:
- Thêm `segmentSpecId`/`segmentSpecLabel` vào interface `BeStockQuant`.
- Đổi `adjustStock()` nhận 1 trong 2 (`materialId` hoặc `segmentSpecId`), khớp đúng ràng buộc XOR
  của `CreateStockAdjustmentDto`.

### Bước 4 — FE: nối KhoPhoiPage.tsx vào API thật
Thay `getDoanTonKho()`/`hanSeed()`/`computeDoanKho()` bằng `getStockQuants({ warehouseId })`
lọc theo `segmentSpecId` thuộc material nhóm sắt:
- Tab "Đã KCS duyệt (chờ chuyển Hàn)" = mọi dòng `segmentSpecId` có `cutLengthMm > 0`.
- Tab "Đoạn thừa (chờ xử lý)" = dòng `segmentSpecId` có `cutLengthMm = 0` (quy ước bước 1).

Không cần BE trả thêm gì ngoài `GET /stock-quant` đã có — chỉ đổi 1 chỗ trong service facade,
đúng pattern đã dùng cho 7 domain M3.

### Bước 5 — Dọn code chết
Sau khi bước 4 xong và xác nhận qua browser thật, xoá phần không còn ai đọc:
- `getDoanTonKho()`, `DoanTon` (`phoi-sat.service.ts`) — kiểm tra kỹ trước khi xoá, các trang khác
  của Phôi (`LenhSanXuatPhoi`, `LichSuNhanSatPage`) đã cutover sang `steel-issues-api.ts` từ
  2026-08-13/14 nên nhiều khả năng không còn ai gọi.
- [quy-doi-sat.ts](../src/lib/quy-doi-sat.ts) (`quyDoiDoan`, `CutPattern`...) và
  [phan-loai-doan-sat.ts](../src/lib/mock/phan-loai-doan-sat.ts) (`computeDoanKho`) — chỉ xoá nếu
  `grep` xác nhận không còn import nào khác ngoài `KhoPhoiPage.tsx`.

## 5. Chưa quyết — để lại cho lần sau

Xử lý cụ thể cho đầu mẩu đã tồn (dùng lại cho chi tiết khác / xuất bán phế liệu) — quyết định #7
xác nhận có nhu cầu nhưng chưa chốt luồng. Tạm thời đủ dùng `POST /stock-ledger/adjust` chung
(giảm tồn `SegmentSpec` "đầu mẩu", note lý do) khi phát sinh thực tế, không xây thêm state machine
hay endpoint riêng ở đợt này.

## 6. Không nằm trong phạm vi tài liệu này

- Tồn tại thời hoạt động của kho vật tư `phoi-son-han` (bước 2) cần được xác nhận đúng tên/id
  thật lúc code — tài liệu này chỉ nêu hướng, không tra cứu sẵn vì mã kho có thể đổi.
- Không đổi gì ở luồng "Xuất sắt cho Phôi" (`steel-issues`) hay `CuttingProposalsService.approve()`
  — 2 luồng đó vẫn ghi `StockLedger` gộp theo `materialId` (cây sắt) như hiện tại, không chồng lấn
  với `SEGMENT_CONSUME` (theo đoạn) mới thêm ở bước 2.

## 7. Kết quả triển khai (2026-08-14)

Đã code xong bước 2-5 của mục 4, theo đúng 7 quyết định ở mục 2. Lệch nhỏ so với dự kiến ban đầu:

- **Kho đích xác nhận được ngay** (mục 6 nói "cần xác nhận lúc code"): `phoi-son-han` (from) →
  `PRODUCTION` (kho ảo, to) — đúng pattern `MaterialIssuesService.postLedgerEntry()` đã dùng cho
  Xuất vật tư tiêu hao Hàn/Sơn, không cần quyết định thêm.
- **Phát hiện thêm 1 lỗ hổng quyền khi nối FE** (cùng dạng đã lặp lại nhiều lần ở M3, xem
  `dna-erp-roadmap.html` mục 07): `PHOI_STAFF` chưa từng có `STOCK:VIEW` nên `KhoPhoiPage.tsx` gọi
  `GET /stock-quant` sẽ 403 âm thầm — đã vá thêm (`role-permissions.constant.ts`, chỉ VIEW).
- **`GET /warehouses` không cần dùng ở FE** — ban đầu nghĩ cần resolve `warehouseId` từ code
  `phoi-son-han`, nhưng `BeStockQuant` đã có sẵn `warehouseCode` nên lọc client-side trực tiếp,
  tránh phải xin thêm quyền `WAREHOUSE:VIEW` cho `PHOI_STAFF`.
- **`cutLengthMm` không có field riêng ở `StockQuantResponseDto`** (BE chỉ trả `segmentSpecLabel`
  dạng chuỗi `"{materialCode} @ {cutLengthMm}mm"`) — FE parse lại bằng regex thay vì gọi thêm
  `segment-specs` API, tránh 1 lời gọi mạng thừa.

### File đã đổi

**BE** (`D:\DNA-ERP-BE`):
- `src/modules/production-batches/production-batches.service.ts` — thêm `postSegmentConsumeEntries()`.
- `src/modules/production-batches/production-batches.service.spec.ts` — 4 test case mới.
- `src/modules/production-batches/production-batches.module.ts` — import `StockModule`.
- `src/common/constants/role-permissions.constant.ts` — `PHOI_STAFF` + `STOCK:VIEW`.

**FE** (`d:\DNA-ERP`):
- `src/services/stock-api.ts` — `BeStockQuant`/`BeStockLedgerEntry` thêm `segmentSpecId`/
  `segmentSpecLabel`; `adjustStock()` nhận thêm `segmentSpecId` (optional, XOR với `materialId`).
- `src/modules/pages/Phoi/KhoPhoiPage.tsx` — viết lại, đọc `GET /stock-quant` thật.
- `src/lib/mock/services/phoi-sat.service.ts` — xoá `getDoanTonKho`/`DoanTon` (chết).
- `src/lib/mock/services/san-luong.service.ts` — **xoá hẳn file** (chết toàn bộ).
- `src/lib/mock/phan-loai-doan-sat.ts` — **xoá hẳn file** (chết toàn bộ).
- `src/lib/mock/services/index.ts` — bỏ export file đã xoá.
- `src/components/sanxuat/core.tsx` — đổi import `SanLuongStage` (từ file mock đã xoá) sang alias
  `ProductionBatchStage` thật (`production-batches-api.ts`), giữ nguyên logic.

### Đã xác nhận sạch

BE: 457/457 test pass (453 cũ + 4 mới), `tsc --noEmit` sạch, `eslint` 0 lỗi.
FE: 37/37 vitest pass, `tsc --noEmit` sạch, `next build` (Turbopack) sạch, `eslint` 0 lỗi (2
warning có từ trước ở `core.tsx`, không liên quan đợt này).

**Chưa làm** (ngoài phạm vi đợt này, xem mục 5): xác nhận qua browser thật với tài khoản
`phoi`/`khopsh` demo; luồng xử lý đầu mẩu tái dùng/bán phế liệu (quyết định #7, tạm dùng
`stock-ledger/adjust` chung khi phát sinh).
