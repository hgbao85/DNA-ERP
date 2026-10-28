# Changelog 2026-10-23 — Chọn máy cắt (MC Laser / MC Tự động) cho "Tối ưu cắt sắt"

> **2026-10-26: ĐÃ COMMIT + PUSH + LÊN PRODUCTION** (BE `4cf4078` trên `main`, FE `d70be5e` trên `demo`; CI xanh, Render và Vercel đã chạy bản mới — changelog BE `docs/changelog-2026-10-06-review-commit-big-update.md` mục 5.8). Các chữ "CHƯA commit/CHƯA deploy" bên dưới là trạng thái lúc viết từng mục.

Phạm vi: FE (D:\DNA-ERP). Phần BE (bộ giải HiGHS theo bó, SystemConfig, ProductionInvoice, CuttingProposal) làm song song ở D:\DNA-ERP-BE
— FE bám đúng tên trường trong hợp đồng dưới đây, **chưa test với BE thật**.

Không có changelog FE nào nói về "Tối ưu cắt sắt"/solver bằng `.md` (các file cũ là `.html`, không chứa `solverAllowCustomLength`),
nên tạo file mới này theo chỉ định.

## 1. Đã làm gì

Sếp yêu cầu chọn **máy cắt**: **MC Laser** (như hiện nay, cắt từng cây) hoặc **MC Tự động** (cắt theo bó 14/16/18/20 cây một lần,
phần lẻ cắt từng cây = "cắt tay"). Máy chọn THEO ĐỢT ở "Tối ưu cắt sắt", mặc định lấy theo Cấu hình hệ thống (Admin).
Hai chế độ cắt "Bình thường" / "Chấp nhận hao hụt cao hơn" giữ nguyên, áp cho cả hai máy. Chữ trên màn: **"bó"**; riêng màn Phôi (nơi đã có
"bó đoạn" = CutBundle) ghi **"bó cây"** cho khỏi lẫn.

### 1.1 Kiểu dữ liệu / adapter
- `src/types/admin.ts`: thêm `SolverMachine = 'laser' | 'tu_dong'`; `SystemConfig` thêm `solverMachine`, `solverMctdBladeWidthMm`,
  `solverMctdTrimStartMm`, `solverBundleFactors: number[]`, `solverMaxManualCuts`, `solverMaxSizesPerPattern`.
- `src/services/system-config-api.ts`: PUT `/system-config` gửi thêm 6 trường trên (không có trong draft → `undefined` → BE giữ nguyên).
- `src/services/cutting-proposals-api.ts`: `PatternBundles = Record<string, number>`, `CuttingBundleSummary`
  (`factors, totalBundles, manualBars, totalCuts, maxSizesPerPattern`); `CuttingProposalPattern.bundles`, `CuttingProposalLine.machine` và `.bundleSummary` (đều optional/null để phương án cũ vẫn chạy).
- `src/services/cutting-batch-api.ts`: `SolverOverrideInput.solverMachine?: SolverMachine | null` (gửi trong cùng payload gộp/cắt riêng với
  `solverAllowCustomLength`/`solverMaxWastePctOverride`); `CuttingSolvePattern.bundles`, `CuttingSolveLine.machine/bundleSummary`;
  `CuttingDefaults.solverMachine?` (xem mục 3, câu hỏi 1).
- `src/services/production-invoices-api.ts`: `ProductionInvoice.solverMachine` (null = theo mặc định); `cuttingPlan.machine?` (tuỳ chọn, xem mục 3).

### 1.2 Màn hình
- **Admin → Cấu hình hệ thống** (`SystemConfigPage.tsx`): trước đây Admin KHÔNG có nhóm solver nào (các tham số `solverAllowCustomLength`,
  `solverTimeLimitSeconds` chỉ có trong type, không có ô chỉnh) → tạo nhóm mới **"Máy cắt"** nằm trong cùng thẻ, dùng chung nút Lưu:
  máy mặc định (2 thẻ chọn MC Laser / MC Tự động) + "Thông số MC Tự động": Lưỡi cắt (mm), Tề đầu (mm), Hệ số bó (nhập "14 16 18 20"),
  Số cây cắt tay tối đa, Số cỡ đoạn tối đa mỗi kiểu cắt — mỗi ô có chú thích ngắn. Kiểm tra trước khi gửi (đúng luật BE: hệ số nguyên > 1,
  1–8 số; cắt tay 0–100; cỡ đoạn 1–10; lưỡi cắt 0–10 mm; tề đầu 0–100 mm) để khỏi ăn lỗi 400. Các ô số giữ dạng chữ lúc gõ (gõ "2," không bị nuốt).
- **Tối ưu cắt sắt** (`GomDotCatPage.tsx`): thẻ **"Máy cắt:"** với ô chọn 3 lựa chọn: `Theo mặc định (MC …)` / `MC Laser` / `MC Tự động`;
  đặt ngay dưới thẻ "Hao hụt sắt mặc định tối đa", trước khối "Chế độ cắt". Chọn "Theo mặc định" thì KHÔNG gửi `solverMachine`
  (BE tự lấy mặc định); chọn riêng thì gửi `solverMachine` kèm ở cả hai chế độ. Thanh Tính cố định ở đáy thêm "Máy: …". "Tính lại với chế độ khác" điền lại máy của lượt cũ.
- **Kết quả tính** (`CuttingSolvePanel.tsx`): dòng loại sắt có `machine='tu_dong'` hiện dưới số cây mua: "x bó + y cây cắt tay = z lần cắt"
  (cột chiều dài cây giữ nguyên); bảng "Cách cắt từng cây" thêm cột "Cách cắt theo bó" khi có `bundles`; tóm tắt thẻ + dòng "Cài đặt đã dùng" có tên máy.
  `displayReason` vẫn hiện đủ, không cắt.
- **Phôi → Hướng dẫn cắt** (`HuongDanCatPage.tsx`) và **Admin → Cắt sắt** (`CuttingProposalsPage.tsx`): kiểu cắt có `bundles` hiện
  "16 cây × 12 bó + 5 cây cắt tay" (hệ số giảm dần, bỏ hệ số 0 bó; "1" = cây cắt tay); Phôi ghi "bó cây"; không có `bundles` thì như cũ.
  Phôi: thêm dòng "Máy cắt: MC Tự động · 12 bó cây + 5 cây cắt tay = 17 lần cắt"; Admin: tên máy ở tiêu đề chi tiết + tóm tắt dưới cột Số cây.
  Bản in/Excel Hướng dẫn cắt (`utils/cuttingGuide.ts`) có cột "Cách cắt theo bó" + dòng "Máy cắt" (chỉ khi có dữ liệu).
- **Lệnh sản xuất** (`LenhSXPage.tsx` → `CuttingPlanNote.tsx`): khối "Phương án cắt đã tính" hiện "Máy cắt: MC Tự động" khi có máy
  (ưu tiên máy KHSX chọn cho lệnh `solverMachine`, rồi máy BE ghi trên phương án, rồi máy trong chi tiết đã nạp).
- Hướng dẫn sử dụng (`Guide/content/productionPlan.ts`, `admin.ts`): thêm 1 bước/1 câu nói về máy cắt.
- Mới: `src/utils/cutMachine.ts` (nhãn máy, `fmtBundles`, `fmtBundleSummary`) + test `cutMachine.test.ts`; `cuttingGuide.test.ts` cập nhật và thêm ca MC Tự động.

## 2. Kết quả kiểm tra
- `npx tsc --noEmit`: sạch (0 lỗi).
- `npx vitest run`: 22 file / 206 test đều qua (đã sửa 1 expectation cũ vì hàng bảng hướng dẫn cắt có thêm `bundles: null`).
- `npm run lint` toàn repo: 186 lỗi + 193 cảnh báo **có sẵn từ trước** ở nhiều file không đụng tới (react-hooks/set-state-in-effect, no-explicit-any...);
  chạy eslint riêng trên các file đã sửa/thêm: **0 lỗi** (chỉ còn cảnh báo cũ của LenhSXPage, production-invoices-api, CuttingProposalsPage, GomDotCatPage).
- Chưa chạy dev server / chưa test với BE thật (BE chưa sẵn sàng).

## 2b. Sửa theo review (Opus, cùng ngày) — kết luận ĐẠT, 10 điểm nhỏ đã sửa
1. Ô "Hệ số bó": bỏ `inputMode="numeric"` (bàn phím số điện thoại không có dấu cách/phẩy).
2. Tên cột thống nhất "Cách cắt theo bó cây" ở bản in + Excel (khớp màn Phôi); test mới cho `buildSheetAoa` / `buildPrintSectionHtml` (đã export hai hàm), gồm ca MC Laser không có cột.
3. Bài hướng dẫn Phôi (`Guide/content/manufacturing.ts`) thêm câu cách đọc dòng "Máy cắt: …" và cột "Cách cắt theo bó cây".
4. `CuttingPlanNote`: ưu tiên máy đã dùng thật `plan.machine`, rồi máy KHSX chọn cho lệnh, rồi máy trong chi tiết.
5. Giới hạn theo BE: lưỡi cắt 0–10 mm, tề đầu 0–100 mm (trước đó FE tự đặt 0–50 / 0–500).
6. `fmtBundleSummary`: manualBars = 0 thì bỏ vế "+ 0 cây cắt tay" ("12 bó = 12 lần cắt").
7. Khôi phục cụm "— xem bài riêng" ở `Guide/content/admin.ts`.
8. `CuttingProposalsPage`: gán tên máy vào biến `detailMachine`.
9. "Tính lại với chế độ khác": điền máy THỰC SỰ đã dùng của lượt cũ (`solve.lines[].machine`, lấy khi tất cả trùng nhau) thay vì "theo mặc định", để đổi chế độ không vô tình đổi máy khi Admin đã đổi mặc định. Hệ quả: sau khi tính lại, ô máy đang ghim một máy cụ thể, KHSX tự chọn lại "Theo mặc định" nếu muốn.
10. Câu chú thích ở thẻ "Máy cắt" nói "hai chế độ cắt (Bình thường / Chấp nhận hao hụt cao hơn) áp cho cả hai máy" — đúng cả lúc chưa chọn SKU (trước đó trỏ tới khối "Chế độ cắt" chỉ hiện khi đã chọn SKU).

Kiểm tra lại sau sửa: xem số liệu ở cuối mục này.

## 3. Chưa làm / còn treo / cần BE xác nhận
1. **Máy mặc định cho KHSX đọc ở đâu?** Hợp đồng đặt `solverMachine` trong `GET /system-config`, nhưng endpoint đó cần quyền `SYSTEM_CONFIG:VIEW`
   (Admin); KHSX chỉ có `CUTTING_PROPOSAL`. FE đang đọc `solverMachine` từ `GET /system-config/cutting-defaults` (KHSX đọc được) — đề nghị BE trả
   thêm trường này ở đó. Chưa có thì ô chọn ghi "Theo mặc định" (không kèm tên máy), không lỗi.
2. **Sếp có thấy máy khi KHSX không chọn riêng?** `ProductionInvoice.solverMachine = null` nghĩa là theo mặc định → màn duyệt không biết máy nào.
   Đề nghị BE thêm `cuttingPlan.machine` (máy đã dùng, đã quy đổi); FE đã sẵn sàng đọc, và tự lấy từ chi tiết phương án khi bấm "Xem chi tiết".
3. Lệnh sản xuất cũ không có phương án (`cuttingPlan = null`) không hiện dòng máy cắt.
4. Chưa hiện máy ở danh sách "Kết quả đã tính" dạng lọc/sắp xếp — chỉ ở dòng tóm tắt thẻ.

### Kết quả kiểm tra sau sửa theo review
- `npx tsc --noEmit`: sạch.
- `npx vitest run`: 22 file / 209 test qua (thêm 3 test cho bản Excel/bản in và 1 ca `manualBars = 0`).
- eslint trên các file đã sửa (Admin, GomDotCat, CuttingSolvePanel, CuttingPlanNote, HuongDanCat, Guide, utils, services, types): 0 lỗi.

## 2c. Sửa theo đối chiếu BE↔FE (Opus)
- **FE-1 (lỗi thật):** chọn MC Tự động mà bảng ước tính / số xác minh / xem trước vẫn tính theo máy mặc định, lệch với bằng chứng đặc cách BE dựng cho Sếp.
  Nay `getCuttingBatchCandidates(stockLengths, solverMachine)` gửi `&solverMachine=…` trên query, `previewCuttingBatch(ids, stockLengths, solverMachine)` gửi `solverMachine` trong body,
  `getCuttingBatchSuggestions(solverMachine?)` cũng nhận tham số (ProductionPlanApp gọi không máy = theo mặc định). "Theo mặc định" thì bỏ trường.
  `GomDotCatPage`: máy nằm trong dependency của `load` và effect xem trước → đổi máy là tải lại bảng + xem trước (giữ nguyên SKU đang tick). Thẻ "Máy cắt" thêm ghi chú khi máy hiệu lực là MC Tự động:
  số ước tính chưa tính ràng buộc cắt theo bó, số chính thức là kết quả sau khi bấm Tính phương án cắt.
- **FE-2:** ô "Tề đầu" là số nguyên (BE `@IsInt`), `integer: true`, chú thích ghi rõ mm nguyên.
- **Gợi ý:** `machineSummaryText`: dòng khả thi chưa ghi máy (dữ liệu cũ) hiện "MC Laser"; dòng không khả thi chưa ghi máy thì không nêu. Test cập nhật (bản in/Excel của phương án cũ nay có dòng "Máy cắt: MC Laser").
- Kiểm tra: `tsc --noEmit` sạch; `vitest` 22 file / 209 test qua; eslint trên các file sửa 0 lỗi.

## 2d. Sửa 2 lỗi UI từ test đầu cuối (FE 3100 / BE 3002)
- `fmtBundleSummary` (cutMachine.ts, dùng ở mọi nơi): không có bó nào thì bỏ vế "0 bó +" → "5 cây cắt tay = 5 lần cắt" (đã bỏ trước đó vế "+ 0 cây cắt tay"). Test cập nhật.
- `CuttingSolvePanel` bảng "Cách cắt từng cây": ô "Cách cắt theo bó" bỏ `nowrap`, cho xuống dòng (`overflowWrap: anywhere`, `minWidth: 150`), khung bảng thêm `maxWidth: 100%`
  → không còn tràn/cắt mép phải ở màn 1440 px; mobile vẫn cuộn ngang trong khung như cũ.
- Kiểm tra: tsc sạch, vitest qua (22 file), eslint file sửa 0 lỗi. **Chưa kiểm trực quan** (cửa sổ trình duyệt dev rộng 243 px, chưa mở sẵn kết quả có bó) — nhờ người điều phối nhìn lại ở 1440 px và mobile.

## 2e. Sửa theo kiểm tra trình duyệt của Opus (UX-1 … UX-18; UX-6, UX-7 là phía BE, không làm)
Đã sửa:
- **UX-1 (chặn)** `CuttingSolvePanel`: dòng "Cài đặt đã dùng" `flex: 1 1 260px` (trước `flex:1 + minWidth:0` bị ép cột 19 px ở 375 px); 2 nút "Tính lại với chế độ khác"/"Xóa lượt tính này" cao 40 px trên mobile. Đo thật ở 375 px: chữ rộng 312 px, nút cao 40 px.
- **UX-2** `GomDotCatPage`: khi tải lại do đổi máy/chiều dài cây, bảng SKU mờ (opacity .5, `aria-busy`) + dòng `role="status"` "Đang tính lại số ước tính theo MC …"; chữ "Đang tải…" đầu trang chỉ còn cho lần tải đầu.
- **UX-3** dòng "x bó + y cây cắt tay = z lần cắt": 12 px, màu `--text2` (Kết quả tính + Admin Cắt sắt).
- **UX-4** hàng loại sắt mở chi tiết có `<button aria-expanded>` bọc chevron + mã (Kết quả tính; Admin: nút bọc "mã — tên", chevron `aria-hidden`); `onClick` hàng giữ nguyên (click/Enter nổi bọt lên hàng, không bật 2 lần).
- **UX-5** quy tắc "dòng khả thi chưa ghi máy = MC Laser" vào `utils/cutMachine.ts` (`lineMachine`, `linesMachine`), dùng chung: Kết quả tính (`solveMachine`, thẻ tóm tắt, "Cài đặt đã dùng"), `CuttingPlanNote` (ưu tiên `plan.machine` rồi máy KHSX chọn rồi máy từ chi tiết), Admin, Phôi/in/Excel (`machineSummaryText`). Có test.
- **UX-8** một cụm chữ + một màu: "Cao hơn mức mặc định" (hổ phách) ở Kết quả tính, đầu `CuttingPlanNote` ("Có loại sắt hao hụt cao hơn mức mặc định") và Admin ("⚠ Cao hơn mức mặc định (≤x%)"); nhãn ĐỎ "Có loại sắt vượt ngưỡng hao hụt" chỉ khi chi tiết đã nạp và có dòng `overThreshold === true` (BE `hasOverThreshold` gồm cả ca chỉ cao hơn mức mặc định nên chưa nạp chi tiết chỉ được nói mức nhẹ).
- **UX-9** `PrintExportButton` variant `solid`: nền lấy token `--bg-*` cùng màu (luôn đậm) thay vì `--fg-*` (sáng ở chế độ tối); nút/mục menu cao 40 px trên mobile.
- **UX-10** mobile: tóm tắt bó được xuống dòng (không nowrap, rộng tối đa 150 px) để cột Hao hụt/Kết quả không khuất.
- **UX-11** "đã có kết quả" chỉ khi lượt tính khớp cả tập SKU + máy + chế độ; khác thì ghi "đã có kết quả nhưng với máy/chế độ khác"; nhãn thanh đáy thống nhất "Máy cắt:".
- **UX-12** thẻ đang tính hiện "MC Tự động · đang tính" (khi biết máy KHSX đã chọn).
- **UX-13** `CuttingPlanNote` bỏ dấu "·" đầu "Máy cắt: …"; nút "Xem/Ẩn chi tiết" cao 40 px trên mobile.
- **UX-14** `LenhSXPage`: "trongđợt" → "trong đợt" (`{' '}` trước chú thích JSX).
- **UX-15** bản in thêm `<colgroup>` khi có cột bó: STT 5%, HH/cây 8%, Số cây 8%, "Cách cắt theo bó cây" 18%. Có test.
- **UX-16** Phôi mobile: cột "Cách cắt theo bó cây" đứng ngay sau STT (desktop/bản in để cuối).
- **UX-17** `SystemConfigPage`: lỗi hiện ngay dưới ô sai (`role="alert"`, `aria-invalid`, viền đỏ, xoá khi gõ lại), chữ hướng dẫn gắn `aria-describedby`; dòng chung ở cuối chỉ nhắc xem lỗi dưới ô. Guide `admin.ts`: "— xem bài riêng" chỉ gắn với tem QR/IP, nhóm "Máy cắt" tách thành câu riêng. Guide `boss.ts` thêm câu về dòng "Máy cắt" và nhãn hao hụt trên khối Phương án cắt đã tính.
- **UX-18** ô lý do có nhãn thật "Lý do để Sếp duyệt" (placeholder chỉ còn ví dụ); nút "Đóng" panel Admin ≥ 40 px trên mobile; % hao hụt dùng dấu phẩy ("0,49%") qua `fmtPercent` trên các màn kết quả cắt (Kết quả tính, CuttingPlanNote, Admin Cắt sắt, Phôi) — KHÔNG đổi các chip ước tính ở bảng chọn SKU và bản in/Excel; "Phần thừa/cây" thống nhất ở Admin (trước "hao hụt …mm/cây"). Bản Phôi/in/Excel giữ "HH/cây" vì mô phỏng đúng bản in MC Laser.

Kiểm tra: `tsc --noEmit` sạch; `vitest` 22 file / 212 test qua; eslint trên file sửa 0 lỗi. Kiểm trực quan bằng dev server 3100: thẻ kết quả hiện "0,49% · MC Laser"; ở 375 px dòng "Cài đặt đã dùng" rộng 312 px và 2 nút cao 40 px. Các mục UX-2, UX-4, UX-9, UX-13, UX-17 sau đó đã được Opus kiểm trực quan (xem mục 2f); UX-16 sau đó Opus kiểm trên trình duyệt bằng vai boss (mục 2g).

## 2f. Sửa theo Opus kiểm lại (2026-10-24)
Opus kiểm lại UX-1…18 trên trình duyệt: 13 đạt, 3 đạt một phần (UX-6, UX-9, UX-10), 2 chỉ kiểm qua code (UX-7 chữ, UX-16). Đã sửa thêm:
- `CuttingSolvePanel`: nút mở chi tiết loại sắt thêm `textAlign: 'left'` — mã dài (SAT-VUONG-20X20) xuống dòng ở mobile không còn căn giữa.
- `LenhSXPage` (khối "Kế hoạch SX xin cắt đặc cách"): khi `solverOverrideEvidence.fromProposal` = true (BE mới lưu, PI tạo từ phương án đã
  tính) ghi "**X** ở cây 6000mm hao hụt **33,75%** theo phương án đã tính"; bản ghi cũ giữ "ước tính hao ≥…". Số qua `fmtPercent` (dấu phẩy).
  Kiểu `solverOverrideEvidence` trong `production-invoices-api.ts` thêm `stockLengthMm?`, `fromProposal?`.
- Admin Cắt sắt: "⚠ Cao hơn mức mặc định (≤1%)" → "(mặc định ≤1%)".
- ~~Còn treo: UX-9~~ (đã sửa, xem dưới); UX-10 bảng mobile vẫn cuộn ngang (Opus chấp nhận).
  Chip ước tính và bản in/Excel giữ dấu chấm; Phôi/bản in giữ "HH/cây" — Opus đánh giá chấp nhận được.

Kiểm tra: `tsc --noEmit` sạch; eslint file sửa 0 lỗi. Câu mới trên màn Sếp sau đó Opus thấy tận mắt ở tablet: "SAT-VUONG-50X50 ở cây 6000mm hao hụt 33,75% theo phương án đã tính".
- **UX-9 (sửa sau, người dùng chốt "chỉ đổi nút In (… vật tư), không đổi màu chung toàn app")**: thêm token `--bg-bf360c: #bf360c` (cả sáng lẫn tối, nền đặc giữ nguyên như `--bg-e65100`) vào `theme-palette.css`; `HuongDanCatPage` truyền `color="var(--bg-bf360c)"` cho nút "In (… vật tư)". Màu `--bg-e65100` và nút "In" từng vật tư không đổi. Đo trên trình duyệt (QR-NEN-72871, tài khoản Sếp): nền rgb(191,54,12), chữ trắng, tương phản 5,6:1 (trước 3,79:1), chế độ tối cùng màu. tsc sạch, eslint 0 lỗi.

## 2g. Đơn gấp chỉ cây đã định + sửa theo Opus kiểm Hướng dẫn cắt/tablet (2026-10-24)
- **Người dùng chốt:** đơn gấp bắt buộc mua cây đã định (6000), bỏ ô tick "Giữ đúng chiều dài đã định" vì cho dò chiều dài là trùng chế độ
  "Bình thường". `GomDotCatPage`: bỏ checkbox + state `onlyStandardLength`; `ACCEPT_OVER` luôn gửi `solverAllowCustomLength: false` (cùng
  `solverMaxWastePctOverride: 100` như từ 2026-09-30). Mô tả chế độ và dòng trong khối đơn gấp nói rõ "chỉ cắt trên đúng chiều dài cây đã
  định (không dò cây khác)… hệ thống tự tìm phương án hao hụt nhỏ nhất trên cây đó". Guide `productionPlan.ts` cập nhật.
- `HuongDanCatPage`: cột "Cách cắt theo bó cây" LUÔN sau STT trên màn hình (trước chỉ < 768 px — tablet và desktop loại nhiều cỡ bị khuất);
  tiêu đề cỡ đoạn xuống dòng (`whiteSpace: normal`, `minWidth 72`); nút viền "In" dùng `--fg-c2410c` (5,18:1, trước 3,79:1); HH/cây định dạng
  `vi-VN`. Bỏ `useIsMobile`/`ACCENT` không còn dùng.
- `CuttingProposalsPage` (Admin): "phần thừa …mm/cây" định dạng `vi-VN`; nhãn "⚠ Cao hơn mức mặc định 1%" (thay "(mặc định ≤1%)").
- Kiểm tra: tsc sạch; eslint 0 lỗi; vitest 22 file / 212 test. Trình duyệt: tablet 768 PI-2026-042 9/9 bảng cột bó trong khung
  (SAT-HOP-10X20 864/713, trước 1331); KHSX khối đơn gấp không còn checkbox, tính thật → phương án 194 lưu `solverAllowCustomLength: false`,
  9/9 loại chốt 6000.
- Chưa làm: vùng chạm 40 px trên tablet (chỉ áp < 768 px; nên `(pointer: coarse)`).

## 2h. KHSX xem thông số máy cắt (chỉ xem, đóng sẵn) (2026-10-24)
- Người dùng: "để KHSX xem thông số hiện tại… làm ẩn ở đâu đó cho UI khỏi bị tràn… cần config lại thì liên hệ admin".
- `services/cutting-batch-api.ts` `CuttingDefaults` thêm (tuỳ chọn) `solverStockLengths`, `solverMaxSurplus`, `solverTrimStartMm`,
  `solverBladeWidthMm`, `solverMctdTrimStartMm`, `solverMctdBladeWidthMm`, `solverBundleFactors`, `solverMaxManualCuts`,
  `solverMaxSizesPerPattern` (BE trả ở `GET /system-config/cutting-defaults`).
- `GomDotCatPage` khối "Máy cắt": nút "Xem thông số máy cắt"/"Ẩn thông số máy cắt" (đóng sẵn, `aria-expanded` + `aria-controls`, 40 px trên
  mobile) → `<dl>` lưới `auto-fit minmax(130px)` (mobile 2 cột) thông số của máy sẽ dùng (chọn riêng hoặc mặc định), số định dạng `vi-VN`,
  dòng "Chỉ xem. Cần đổi thông số thì liên hệ Admin (Cấu hình hệ thống)." Thiếu trường (BE cũ) thì không hiện. Guide `productionPlan.ts` +1 câu.
- Kiểm tra: tsc sạch; eslint 0 lỗi; vitest 22 file / 212 test. Trình duyệt: desktop đổi máy Laser ↔ Tự động bảng đổi đúng; mobile 375 tối
  không tràn, 2 cột, tương phản 7,2:1 / 12,7:1.

## 2i. Gợi ý "gộp với đơn nào" gọn lại + nút chọn đơn gần hạn (2026-10-24) — đã thay bằng mục 2j (gợi ý chuyển lên khối trên bảng)
- Người dùng chỉ ảnh cột "Loại sắt · hao hụt khi cắt riêng": mỗi loại sắt vượt ngưỡng in 1 đoạn "gộp được với: GHE-J55, GHE-J55, GHE-TINH-YEU…"
  (BE `mergeableWithSkus` chỉ có MÃ SKU, lặp 1 lần mỗi đơn) — lặp tên không phân biệt được đơn, 3 loại sắt lặp gần y hệt (~15 dòng/SKU),
  không bấm được; chip dùng dấu chấm. Người dùng duyệt: "gom một dòng gọn mỗi SKU, đếm đơn trùng tên, nút chọn đơn gần hạn nhất, danh sách
  đơn đóng sẵn có mã PO và hạn giao, chip dùng dấu phẩy".
- `src/utils/mergeHints.ts` (mới): `itemsByMaterialOf(items)` (loại sắt → mọi đơn trong bảng), `buildMergeGroups(it, map)` (các loại vượt ngưỡng
  có CÙNG tập đơn gộp chung 1 nhóm; đối tác xếp theo hạn giao GẦN với đơn này nhất, không có hạn xuống cuối; đơn này không hạn thì theo hạn
  sớm nhất), `countBySku` ("GHE-J55 ×9 · GHE-TINH-YEU ×8 · BAN-8-MEIYING-J55 ×3"). Dựng từ chính danh sách đơn của bảng (có id, mã PO, hạn) —
  KHÔNG đổi BE; `mergeableWithSkus` không còn dùng ở FE.
- `GomDotCatPage` `materialsCell`: mỗi nhóm 1 dòng "↳ **SAT-…** gộp được với **N** đơn khác: …" + nút **"Chọn đơn gần hạn nhất"** (tick SKU này
  + 1 đơn đầu danh sách chưa tick; bấm lại thêm đơn kế; hết thì "Đã chọn hết đơn gộp được", khoá) + nút **"Xem N đơn"** (đóng sẵn,
  `aria-expanded`) mở danh sách có ô tick từng đơn "GHE-J55 · RP-… · hạn dd/mm" (cuộn khi dài, tối đa 240 px). Mọi nút/ô trong khối chặn nổi bọt
  để không tick nhầm dòng SKU. Nhóm không có đối tác: "— không đơn nào khác dùng, gộp không cứu được". Nút 40 px trên mobile.
- `MaterialChip`: số % và tooltip dùng `fmtPercent` (vi-VN, "0,28%", "≥0,17%"), ngưỡng ">1%" định dạng vi-VN. Không thêm chú thích "≥" vì đầu trang
  đã có dòng giải thích "Số kèm dấu ≥ chỉ là ước tính nhanh…" (đã thêm rồi gỡ vì trùng).
- Kiểm tra: tsc sạch; eslint 0 lỗi; vitest 23 file / 217 test (+5 `mergeHints.test.ts`: gom nhóm cùng tập đơn, thứ tự theo hạn gần nhất, đơn
  không hạn, không đối tác, đếm). Trình duyệt (KHSX, DB test): đơn RP-GHE-J55-20-…633975 hiện "SAT-VUONG-20X20 gộp được với 20 đơn khác:
  GHE-J55 ×9 · GHE-TINH-YEU ×8 · BAN-8-MEIYING-J55 ×3" và "SAT-VUONG-12X12 … 17 đơn" — khớp số đơn BE (`mergeableWithSkus` 20/17); bấm
  "Chọn đơn gần hạn nhất" 2 lần → tick thêm lần lượt 2 đơn, danh sách hiện [x] đúng; desktop dòng SKU cao 258 px (đóng) ; mobile 375: nút 40 px,
  dòng danh sách 44 px, bấm "Xem"/tick trong danh sách không đổi ô chọn của thẻ, trang không cuộn ngang được.
- Hạn chế dữ liệu test: mọi đơn ứng viên trong DB test đều không có hạn giao ("hạn —"), nên thứ tự "gần hạn nhất" chỉ kiểm bằng unit test.

## 2j. Chip cây 6m 3 trạng thái + kiểm bù nền + khối gợi ý gộp + "Chọn lại đề xuất" (2026-10-24) — nút/`nextPicks` thay bằng nhóm gộp ở mục 2k
- Thay mục 2i (gợi ý gộp ở từng dòng) theo người dùng: "giữ chip ở cây 6m, chip chưa kiểm hiện xám "chưa kiểm", kiểm bù ca chậm không chặn
  trang, tiêu đề cột ghi "ở cây 6m", mỗi dòng SKU chỉ hiện loại có cảnh báo, gợi ý gộp lên khối trên bảng" + "click 1 cái xong tự fill các SKU
  được hệ thống đề xuất lại".
- `utils/mergeHints.ts` (viết lại): `chipStatus` (over = `overThreshold`; ok = đã xác minh; unknown = chưa xác minh mà cận dưới chưa vượt),
  `mergeVerified` (ghép lượt bù: chỉ thay loại lượt bù xác minh được, giữ thứ tự dòng + đề xuất), `warningMaterials` (mỗi loại có chip đỏ: đơn
  vượt + mọi đơn dùng), `nextPicks` (chưa tick đơn nào → 2 đơn hạn sớm nhất; đã tick → 1 đơn hạn gần hạn sớm nhất của nhóm), `countBySku`.
  Bỏ `buildMergeGroups`. Test 8.
- `cutting-batch-api.ts`: `getCuttingBatchCandidates(…, { deepVerify })` → `deepVerify=true`, timeout riêng 150 s (http chung 20 s).
- `GomDotCatPage`:
  - `load()` có số thứ tự (bỏ kết quả lần tải cũ); bảng hiện xong mà còn chip chưa kiểm → gọi lượt bù NỀN (không làm mờ bảng), dòng
    `role="status"` "Đang kiểm thêm các loại sắt “chưa kiểm”…", ghép bằng `mergeVerified`.
  - `MaterialChip({ m, checking })`: đỏ (⚠, ">1%" khi chắc chắn vượt luật mỗi cây, "x%" khi đã xác minh mà tổng > ngưỡng, "≥x%" khi cận dưới đã
    vượt), xanh "x%" (đã xác minh), xám viền đứt "· chưa kiểm" / "· đang kiểm" (tooltip nêu ước tính ≥x%). Bỏ dấu "?" ở chip.
  - Ô loại sắt: chỉ chip đỏ/xám + nút "✓ n loại đạt" (mở/đóng, `aria-expanded`, chặn nổi bọt). Gợi ý gộp KHÔNG còn ở từng dòng.
  - Khối "Loại sắt có cảnh báo khi cắt riêng ở cây 6m" trên bảng: mỗi loại 1 dòng "⚠ SAT-… — vượt 1% ở a/b đơn · dùng ở: GHE-J55 ×10 · …" + nút
    "Chọn đơn gần hạn nhất" / "Xem b đơn" cùng hàng; danh sách đơn có ô tick, mã PO, hạn, chip của loại đó; loại gộp được xếp trước, "chỉ 1 đơn
    dùng" xuống cuối; hiện 3 loại đầu + "Xem thêm n loại sắt".
  - Banner đầu trang giải thích 3 màu "cảnh báo hao hụt khi SKU cắt riêng ở cây 6m"; tiêu đề cột "Loại sắt · hao hụt khi cắt riêng ở cây 6m"
    (lấy cây chuẩn từ cấu hình).
  - Dòng tóm tắt: nút "Chọn lại đề xuất" (chỉ hiện khi lựa chọn khác đề xuất; bấm → đúng tập `recommendedItemIds`), đúng rồi thì ghi "đang chọn
    đúng đề xuất". Nhãn "ĐỀ XUẤT" + mã SKU `nowrap` (trước gãy "GHE-/J55 ĐỀ/XUẤT").
- Kiểm tra: tsc sạch; eslint 0 lỗi; vitest 23 file / 220 test. Trình duyệt: xem changelog BE mục 29 (0 chip chưa kiểm sau lượt bù, dòng SKU 83 px,
  khối cảnh báo 236 px, 2 nút chọn chạy đúng, mobile 375 ổn).

## 2k. Nhóm gộp ít hao hụt nhất trong cửa sổ hạn giao (2026-10-24)
- Người dùng: "theo chuẩn ERP sản xuất thì phải là chọn gộp SKU để cho ra ít hao hụt nhất" → chốt "ít hao hụt nhất trong cửa sổ hạn giao" (Admin
  cấu hình ngày), tick sẵn theo cùng tiêu chí. BE trả `mergeGroups` + `recommendedItemIds` mới (changelog BE mục 30).
- `cutting-batch-api.ts`: kiểu `CuttingMergeGroup`, `CuttingBatchCandidateList.mergeGroups?`, `CuttingDefaults.solverMergeWindowDays?`.
  `types/admin.ts`: `SystemConfig.solverMergeWindowDays`.
- `utils/mergeHints.ts`: bỏ `nextPicks` (nút "Chọn đơn gần hạn nhất" bỏ); `mergeVerified` lấy `mergeGroups` + `recommendedItemIds` của lượt bù.
  Test 6 (bỏ 4 test nextPicks, +1 test ghép nhóm).
- `GomDotCatPage`:
  - Lượt bù chạy cả khi nhóm gộp chưa xác minh; xong thì nếu lựa chọn vẫn đúng đề xuất lúc tải → đổi sang đề xuất mới (đã tick tay thì giữ).
  - Khối "Loại sắt có cảnh báo": dòng phụ "hệ thống chọn sẵn nhóm đơn gộp ít hao hụt nhất trong các đơn có hạn giao cách nhau tối đa N ngày…";
    mỗi loại "… · gộp n đơn (GHE-J55 ×10 · …, hạn cách nhau d ngày) → x%" (xanh đạt / đỏ "vẫn >1%" / "≥x% (ước tính)"); không có nhóm trong cửa
    sổ thì "… đơn khác dùng nhưng hạn giao cách quá N ngày, không gộp được"; nút **"Chọn nhóm này (n đơn)"** = tick ĐÚNG nhóm đó (bỏ tick khác),
    đang đúng thì "Đang chọn nhóm này". Xếp: gộp cứu được → còn vượt → không có nhóm → chỉ 1 đơn.
  - "Xem thông số máy cắt" thêm dòng "Gợi ý gộp đơn có hạn cách nhau: tối đa N ngày".
- `SystemConfigPage`: khối "Gợi ý gộp đơn (cả hai máy)" với ô "Gộp đơn có hạn giao cách nhau tối đa (ngày)" (số nguyên 0–365, báo lỗi dưới ô).
- Guide `productionPlan.ts`: cột "… ở cây 6m", câu hướng dẫn mới về chip/khối cảnh báo/"Chọn nhóm này"/"Chọn lại đề xuất".
- Kiểm tra: tsc sạch; eslint 0 lỗi; vitest 23 file / 217. Trình duyệt: xem changelog BE mục 30.

## 2l. Lệnh SX: khoảng hạn lệnh gộp + luật 3 ngày khi sửa hạn + Admin trần SKU (2026-10-24) — đã kiểm trình duyệt với BE thật ở mục 2m
- Sếp chốt (2026-10-24): KHSX gộp nhiều SKU vào một lệnh sản xuất (PI `isMerged`) — cắt/mua sắt theo PI, sản xuất và mốc thời gian vẫn theo SKU.
  **Luật cứng**: trong lệnh gộp, "mốc cần sắt" của các SKU (ngày Mua hàng; chưa có thì ngày Khung cơ khí; cả hai trống = bỏ qua) nằm trong khung N ngày
  (`solverMergeWindowDays`, mặc định 3 — trước là 7 — Admin chỉnh được; **khung tính cả hai đầu, chênh tối đa N−1 ngày**, xem "Làm rõ" cuối mục), và một lệnh gộp
  có tối đa M SKU (`solverMergeMaxSkus`, mặc định **2**).
  Hợp đồng BE (làm song song, **FE chưa test với BE thật**): `PATCH /production-invoices/:id/items-deadlines` (lưu hạn PI + MỌI SKU trong một giao dịch;
  vi phạm luật → 400 kèm câu tiếng Việt, không lưu gì), `GET /system-config/cutting-defaults` trả thêm `solverMergeWindowDays` + `solverMergeMaxSkus`,
  `GET/PUT /system-config` thêm `solverMergeMaxSkus` (nguyên 1–50).
- **API (`production-invoices-api.ts`, xuất qua `api.ts`)**: `updateProductionInvoiceItemsDeadlines(piId, { deadline?, items: [{ itemId, materialDeadline?,
  deliveryDeadline?, stages? }] })` → trả cùng dạng `getProductionInvoice` (đã qua `toPI`). `toPI` thêm `deadlineLatest` = hạn giao MUỘN NHẤT của các SKU
  (null khi dưới 2 ngày giao khác nhau theo ngày lịch) đi cặp với `deadline` (sớm nhất, `piDisplayDeadline`).
- **`LenhSXPage`**:
  1. Mọi nơi hiện "Hạn hoàn thành" của PI (danh sách KHSX, danh sách Boss/QLSX, chi tiết KHSX, chi tiết Boss/QLSX, hộp Gửi QLSX, hộp Duyệt, hộp Chọn kho)
     dùng chung component `PiDeadlineText`: đợt gộp có `deadlineLatest` khác ngày → "12/11/2026 → 14/11/2026 (n SKU)" (chữ "(n SKU)" nhỏ, mờ). Màu quá
     hạn + đếm "N quá hạn" vẫn theo ngày SỚM NHẤT. Ở hai dòng danh sách đã có chip "N SKU" ngay cạnh thì bỏ chữ "(n SKU)" cho khỏi ghi hai lần (vẫn có
     tooltip). Cột ngày từng SKU không đổi.
  2. "Sửa thời hạn" (`handleSavePI`): bỏ `updateProductionInvoice` + `updateProductionInvoiceItem` song song, thay bằng MỘT lời gọi
     `updateProductionInvoiceItemsDeadlines` mang cùng giá trị (giữ `isCommittable`: ô ước tính chưa đụng tới KHÔNG gửi; hạn PI vẫn là hạn giao sớm nhất).
     Lý do: luật chỉ kiểm được trên toàn bộ mốc sau khi sửa, lưu lẻ từng SKU thì trạng thái giữa chừng luôn vi phạm. Lỗi (kể cả 400 của BE) hiện NGAY
     trong hộp (`editError`) thay cho `alert` — hộp còn mở để dời mốc rồi lưu lại; sửa tiếp một ô thì câu lỗi cũ tự mất.
  3. Kiểm trực tiếp cho PI gộp: tính mốc cần sắt từng SKU từ giá trị trong form, khoảng cách sớm–muộn; vượt N → câu đỏ dưới danh sách SKU nêu SKU và
     ngày sớm nhất/muộn nhất (cùng lời văn câu 400 của BE) + khoá nút Lưu (tooltip = chính câu đó). Đúng luật → một dòng mờ nhắc "chỉ được gộp trong khung N ngày (chênh tối đa N−1 ngày)". N đọc từ
     `getCuttingDefaults()` khi mở hộp của PI gộp (thiếu field → 3). **Quyết định**: chỉ tính các ô SẼ ĐƯỢC LƯU (ô còn "ước tính" chưa đụng tới không gửi lên nên BE
     coi như trống — tính cả chúng thì FE chặn mà BE không thấy vi phạm); đọc cấu hình lỗi (mạng) → KHÔNG tự kiểm ở FE (đoán sai N sẽ chặn oan), BE vẫn chặn
     và câu lỗi hiện trong hộp. PI thường không kiểm.
  - Helper thuần `utils/steelNeedWindow.ts` (`steelNeedDate`, `steelNeedSpan`, `steelNeedSpanMessage`, `DEFAULT_MERGE_WINDOW_DAYS`, `DEFAULT_MERGE_MAX_SKUS`, `maxGapDays`) + test (cập nhật theo "Làm rõ" cuối mục).
- **Admin `SystemConfigPage`**: khối "Gợi ý gộp đơn (cả hai máy)" có thêm ô **"Số SKU gộp tối đa mỗi lệnh"** (`solverMergeMaxSkus`, nguyên 1–50, vào chung
  vòng kiểm tra + báo lỗi dưới ô); hai ô xếp cạnh nhau trên màn rộng, chồng dọc trên điện thoại (lưới auto-fit). Help ô "Gộp đơn có hạn giao cách nhau tối đa
  (ngày)" viết lại: mặc định 3, là luật cứng (xa hơn thì KHSX không tính/gộp/lưu mốc được). `types/admin.ts`: `SystemConfig.solverMergeMaxSkus`.
- **Lỗi cũ phát hiện + sửa**: `updateSystemConfig` (`system-config-api.ts`) chỉ chuyển các field được liệt kê tên mà `solverMergeWindowDays` KHÔNG có trong
  danh sách → Admin sửa ô "Gộp đơn có hạn giao cách nhau tối đa" ở mục 2k mà BE không bao giờ nhận được. Đã thêm cả `solverMergeWindowDays` và
  `solverMergeMaxSkus`.
- Guide: `productionPlan.ts` (bài "Lập lệnh sản xuất & đặt thời hạn") thêm một câu về luật 3 ngày của PI gộp; `admin.ts` (bài Cấu hình hệ thống) thêm một
  câu về khối "Gợi ý gộp đơn".
- Kiểm tra: `tsc --noEmit` sạch; `vitest run` 24 file / 228 test đều qua (số liệu sau "Làm rõ") (thêm `steelNeedWindow.test.ts`); eslint các file đã đổi 0 lỗi (còn cảnh báo `any`
  sẵn có). **Không** chạy trình duyệt, không có BE thật nên các điểm sau CHƯA kiểm: lời gọi `PATCH …/items-deadlines` thật, định dạng 400 của BE hiện
  đúng trong hộp, `cutting-defaults` trả `solverMergeWindowDays`, PUT `/system-config` nhận `solverMergeMaxSkus`, và giao diện hộp "Sửa thời hạn" /
  khối Admin trên màn rộng + điện thoại.
- Chưa làm / còn treo: FE chưa dùng `solverMergeMaxSkus` ở nơi nào ngoài Admin (chặn tối đa M SKU khi gộp là việc màn "Tối ưu cắt sắt" — `GomDotCatPage.tsx`,
  `CuttingDefaults` ở `cutting-batch-api.ts` do người khác đang sửa). PI gộp cũ đã vi phạm luật sẽ bị khoá nút Lưu cho tới khi KHSX dời mốc lại.

### 2l-b. Làm rõ luật của Sếp Nhân (2026-10-24, cùng ngày) — khung gộp tính CẢ HAI ĐẦU — phần "còn treo" đã xong ở mục 2m
- Lời Sếp: "bắt buộc chỉ được gộp tối đa 2 lệnh có ngày cắt sắt cách nhau không quá 3 ngày (ví dụ: ngày 1 gộp được ngày 3, ngày 1 không được gộp với ngày 4)".
  → `solverMergeWindowDays = N` là **khung N ngày tính cả hai đầu**: mốc sớm nhất và muộn nhất chênh tối đa **N−1** ngày (N=3: ngày 1 + ngày 3 được, ngày 1 + ngày 4
  chặn; N=1: chỉ cùng ngày). Bản đầu của mục 2l hiểu là chênh tối đa N ngày — SAI một ngày so với ý Sếp, đã sửa. BE đồng bộ: `maxGapDays(N) = max(0, N−1)`,
  chặn khi chênh > N−1. Trần SKU mặc định đổi 5 → **2**.
- `utils/steelNeedWindow.ts`: thêm/xuất `maxGapDays`, `DEFAULT_MERGE_MAX_SKUS = 2`; `steelNeedSpanMessage(span, windowDays)` chặn khi chênh > `maxGapDays(windowDays)` và
  dùng đúng câu của BE: "Mốc cần sắt của các SKU trong lệnh gộp cách nhau {span} ngày (sớm nhất {dd/mm} – {SKU}, muộn nhất {dd/mm} – {SKU}) - chỉ được gộp trong khung
  {N} ngày (chênh tối đa {N−1} ngày, vd ngày 1 gộp được ngày {N}). Dời lại mốc hoặc tách SKU ra lệnh riêng." Test viết lại (ví dụ của Sếp 1→3 được, 1→4 chặn; N=1; `maxGapDays`; câu
  báo; thêm năm). Dòng mờ trong hộp "Sửa thời hạn" đổi thành "chỉ được gộp trong khung N ngày (chênh tối đa N−1 ngày)". Dự phòng ở FE: khung 3, tối đa 2 SKU.
- Admin `SystemConfigPage`: `solverMergeWindowDays` hợp lệ **1–365** (hết cho nhập 0; 1 = chỉ cùng ngày), nhãn đổi thành "Gộp lệnh có mốc cần sắt trong khung (ngày)", help giải thích khung
  tính cả hai đầu kèm ví dụ của Sếp và nói rõ là luật cứng ở bước tính / gộp / lưu mốc thời gian; help `solverMergeMaxSkus` ghi "Mặc định 2". `types/admin.ts` + Guide
  (`productionPlan.ts`, `admin.ts`) sửa câu cho khớp.
- Kiểm tra: `tsc --noEmit` sạch; `vitest run` 24 file / 228 test qua; eslint các file đã đổi 0 lỗi. Vẫn CHƯA test với BE thật, chưa xem trình duyệt.
- Còn treo (không thuộc phần này): màn "Tối ưu cắt sắt" (`GomDotCatPage.tsx`, `cutting-batch-api.ts`) còn câu "hạn giao cách nhau tối đa N ngày" theo nghĩa cũ và chưa dùng
  `solverMergeMaxSkus`; người đang sửa các file đó cần đổi lời cho khớp "khung N ngày (chênh tối đa N−1)".

## 2m. "Tối ưu cắt sắt" theo luật gộp cứng: khung "Đợt đang chọn" + kiểm trình duyệt với BE thật (2026-10-24)

Luật và phần BE: changelog BE `D:\DNA-ERP-BE\docs\changelog-2026-10-21-review-du-lieu-test-solve.md` mục 32 (worktree 11.10).
- `GomDotCatPage.tsx`:
  - Khung **"Đợt đang chọn"** đặt trên bảng, ngoài vùng làm mờ: số SKU, khoảng mốc cần sắt, "luật gộp: khung N ngày, tối đa M SKU". Vi phạm → hộp đỏ
    "Không tính / gộp được đợt này: …". Mỗi loại sắt vượt ngưỡng ở cây chuẩn: gộp thêm đơn ([Nên làm] khi đạt, nút "Thêm vào đợt") / cây riêng
    ("phải chờ NCC cán cây") / đơn gấp ("Chuyển sang đơn gấp", "cần Sếp duyệt"). Có thêm danh sách loại đạt (đóng sẵn), loại chưa kiểm kịp, ô
    "Bỏ khỏi đợt", "Thêm tất cả đơn gợi ý". Gọi `getCuttingBatchFixOptions` (debounce 500 ms). Bỏ khối "Nếu gộp N SKU" / khối 1 SKU / khối cảnh báo cũ.
  - Nút Tính khoá khi vi phạm luật (tooltip ghi lý do); thanh dưới "vượt luật gộp · Xem cách xử lý" (cuộn tới khung).
  - Câu báo tức thời (trước khi BE trả) giờ giống câu BE: kèm ngày sớm nhất/muộn nhất và **mã SKU + mã PO**, vd "sớm nhất 01/11 – GHE-J55
    (RP-…633975), muộn nhất 04/11 – GHE-J55 (RP-…320871)". Trước chỉ "(GHE-J55 → GHE-J55)", nhiều đơn cùng SKU không biết đơn nào.
  - Ô "Bỏ khỏi đợt" chuyển lên ngay dưới cảnh báo luật: trước nằm sau danh sách loại sắt, gợi ý tải xong đẩy ô xuống, bấm trượt (gặp khi kiểm).
  - `fmtDate` dùng date-fns `dd/MM`: `toLocaleDateString('vi-VN')` của Chrome in "01-11".
- `LenhSXPage.tsx` — **lỗi tìm thấy khi kiểm, đã sửa**: mốc "ước tính" của SKU trong lệnh gộp lùi từ `pi.deadline` (= hạn SỚM NHẤT của lệnh) thay
  vì hạn giao của chính SKU. Ví dụ PI-2026-016: GHE-TINH-YEU giao 10/12 nhưng hiện "Mua hàng 14/11" (lùi từ 05/12). Thêm `estimateFrom(item,
  piDeadline)` (lùi từ `item.deliveryDeadline`, chưa có mới dùng hạn lệnh) và dùng ở cả 4 chỗ: modal Sửa thời hạn, chi tiết lệnh KHSX, chi tiết
  Boss/QLSX, modal gửi QLSX. Giờ hiện 19/11 · 26/11 · 02/12 · 07/12.
- Kiểm tra: `tsc --noEmit` sạch; eslint 0 lỗi (cảnh báo cũ giữ nguyên, `LenhSXPage` 91 như trước); `vitest run` 24 file / 227 test.
  Trình duyệt với BE thật (localhost:3100 → 3002, DB test, KHSX demo, bề ngang hẹp):
  - 01/11 + 04/11: báo đỏ, nút Tính khoá.
  - 3 SKU trong khung: "Đợt gồm 3 SKU, tối đa 2 SKU mỗi đợt/lệnh gộp.", nút khoá kèm tooltip.
  - "Xem cách xử lý" cuộn tới khung. "Bỏ khỏi đợt" → còn 2 SKU, nút mở.
  - Lệnh gộp hiện "05/12/2026 → 10/12/2026 (2 SKU)". Sửa thời hạn: chênh 5 ngày → báo lỗi + khoá Lưu; chênh 2 ngày → Lưu
    (`PATCH /production-invoices/21/items-deadlines` 200).
  - Admin demo: "Gộp lệnh có mốc cần sắt trong khung (ngày)" = 3, "Số SKU gộp tối đa mỗi lệnh" = 2.
  Mục "còn treo" của 2l-b (màn Tối ưu cắt sắt còn câu cũ, chưa dùng `solverMergeMaxSkus`, chưa xem trình duyệt) đã xong ở mục này.
- Sự cố: lỡ chạy `prettier --write` lên `GomDotCatPage.tsx`. Repo FE không có cấu hình prettier, nên cả file bị định dạng lại. Đã dựng lại bản gốc
  từ cache Turbopack `.next-e2e/dev/cache/turbopack` (bản 14:45) cộng 3 lần sửa sau đó. Đối chiếu: chạy prettier lên bản dựng lại ra đúng từng byte
  với bản lỗi. Diff thật so với HEAD +517/−253. Từ giờ không chạy prettier ở FE.
- Chưa làm: chưa có test vitest riêng cho khung "Đợt đang chọn" (logic luật nằm ở `steelNeedWindow.ts` đã có test). Còn chờ người dùng quyết có tính
  "ngày cắt sắt" theo mốc Phôi không. Nếu đổi thì sửa cả `steelNeedDate` ở FE.
