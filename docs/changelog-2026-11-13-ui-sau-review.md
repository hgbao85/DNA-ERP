# 13/11/2026 - Sửa giao diện các màn cắt sắt sau buổi review UI

Buổi review UI chiều 13/11 xem lại 9 màn đã sửa trong ngày (góp ý của Sếp, chia máy đợt A, 11 câu Sếp trả lời, bảng "Chia máy cắt" đợt B1)
và tìm ra 16 điểm cần chỉnh. Đợt này làm cả 16 điểm, thêm 6 việc bố cục, rồi chụp lại để kiểm. Chỉ sửa FE: không đổi BE, API hay dữ liệu.

## Dùng chung

- **Hàm ghi số** `utils/numberFormat.ts` (mới, có test): `fmtNum` "5.030", `fmtMm` "5.030 mm", `fmtBars` "6 cây", `fmtPercent` "0,38",
  `fmtPct` "0,38%". Mọi màn cắt sắt và bản in dùng chung; trước đó mỗi màn một kiểu ("6000 mm", "5030mm", "0.38%").
  `utils/cutMachine.ts`: `fmtPercent` chuyển sang `numberFormat` (vẫn export lại ở chỗ cũ), hàm mm nội bộ dùng `fmtNum`.

## Tối ưu cắt sắt (KHSX) - `GomDotCatPage.tsx`, `gomDotCatUi.ts` (mới, có test)

- **Khung "Cài đặt đợt tính"** một hàng: Xưởng cơ khí | Máy cắt | Chế độ cắt | Hao hụt tối đa (chữ "1%", không còn ô nhập xám) |
  Chiều dài cây sắt + Đổi. Giải thích dài vào dấu "?" và nút "Giải thích"; "Xem thông số máy cắt" ở góc khung.
  Ở 1440×900 màn đầu đã thấy tiêu đề bảng SKU và các dòng đầu (trước: toàn ô cài đặt).
- **Thanh dưới cùng**: nút Tính luôn bên phải, không nhảy dòng; chữ gọn "2 SKU · Xưởng Phước An · MC Tự động · Bình thường" + một cụm
  trạng thái (lý do khoá màu đỏ, hoặc cảnh báo ước tính + "Xem cách xử lý"). Điện thoại: thanh cao khoảng 90 px (trước khoảng 1/3 màn).
- **Khối "Đợt đang chọn"** ghi tên SKU (tối đa 3 mã, quá thì "+N").
- **SKU đang chọn lên đầu bảng**: chụp lựa chọn lúc tải danh sách (mở trang, Tải lại, đổi chiều dài) và lúc hệ thống tự thêm đơn gợi ý;
  KHSX tick thêm thì dòng đứng yên, không nhảy khỏi con trỏ. Cột Đơn hàng một dòng (dài thì "…" + tooltip).
- **Chú thích chip** ở dòng xanh: "0,30%" = bộ giải đã kiểm, "≥10,00%" = ước tính tối thiểu, ">1%" = chắc chắn vượt.
- **Lưới "Cách xử lý | Kết quả ước tính"**: cột trái 200 px; màu số theo nguồn (đã kiểm: xanh/đỏ; ước tính: vàng cam). Số của dòng
  "Đơn gấp" là số bộ giải đã chạy nên giữ đỏ. Câu "(tổng tốt nhất x%)" viết lại cho rõ.
- **"Xem thông số máy cắt"**: lưới ô đều nhau, giá trị rút gọn (câu đầy đủ trong tooltip).
- Khung "Lệnh vừa đổi xưởng" mỗi lệnh 1 dòng, nút "Đã kiểm" bên phải.

## Kết quả đã tính, Lệnh SX, Admin › Cắt sắt

`CuttingSolvePanel.tsx`, `LenhSXPage.tsx`, `CuttingPlanNote.tsx`, `Admin/businessData/CuttingProposalsPage.tsx`:

- **Bảng kết quả**: loại sắt in đậm "Tên · Quy cách", mã chữ xám; bỏ cột Quy cách riêng. Chiều dài "6.000 mm".
  Thẻ lượt tính khi gập ghi thêm xưởng và giờ tính để phân biệt các lượt cùng SKU. Điện thoại: mỗi loại sắt một thẻ.
- **Nhãn "Cần kiểm lại phương án cắt"**: viền cam + biểu tượng cảnh báo (trước cùng màu vàng với "Chờ QLSX xử lý"), đặt cạnh mã lệnh
  nên cột hạn các dòng thẳng hàng. Chi tiết lệnh của KHSX có nhãn và nút "Mở Tối ưu cắt sắt"; QLSX thấy "Chờ KHSX kiểm lại…";
  Sếp thấy lý do dưới nút Duyệt (không còn câu dặn việc của KHSX).
- **Hộp "Gửi QLSX"** của KHSX: ô xưởng đã khoá theo phương án cắt hiện nền xám, con trỏ cấm.
- **Dòng máy lúc tính**: khi đã có nhãn máy từng kiểu cắt thì ghi "Tính theo thông số MC Laser" (Lệnh SX, Admin) cho khỏi hiểu là máy cắt thật.
- **Admin › Module nghiệp vụ › Cắt sắt**: khung chi tiết rộng 960 px (trước 720) và các cột có độ rộng riêng, nên "Tên · Quy cách" và
  dòng "4 bó + 5 cây cắt tay = 9 lần cắt" đều nằm 1 dòng (trước dòng bó tràn đè sang cột Hao hụt); giây ghi "0,41 s".
- Chữ "solver" trên màn đổi thành "bộ giải".

## Hướng dẫn cắt (tổ Phôi) - `HuongDanCatPage.tsx`, `utils/cuttingGuide.ts`

- **Một dòng "Máy cắt: 6 cây MC Tự động"** (nhiều lớp thì "2 cây MC Tự động · 10 cây MC Laser"; xưởng không laze "… · lỗ làm tay"),
  khớp cột Máy. Bỏ dòng "Máy cắt: MC Laser" (máy lúc tính) đứng cạnh dòng "Theo loại cây" vốn làm công nhân không biết cắt máy nào.
  Phương án cũ chưa có dữ liệu lớp máy thì vẫn ghi máy lúc tính. Màn, bản in, Excel giống nhau.
- Số: "Mua 5.030 mm × 6 cây · hao hụt 0,38%", "Cỡ đặt riêng 5.030 mm", cột "(600 mm)"; bản in hết "0.38%". Excel: ô số vẫn là số.
- **Điện thoại**: bảng kiểu cắt thành thẻ "Kiểu 1 · 3 cây" + nhãn máy + danh sách đoạn + HH/cây; không vuốt ngang.
- **Bản in**: cột chữ căn trái, cột số căn phải, có dòng "Máy cắt: …".
- Tiêu đề trang "Hướng dẫn cắt" hiện cả lúc đang tải / lỗi (trước lỗi thay cả trang, mất tiêu đề).
- Cột "Tên sắt" của bảng tổng **giữ nguyên chữ** (cố ý giống bảng "In kết quả" của máy laze cũ xưởng đã quen; cột ghi tên chi tiết),
  chỉ thêm chú thích khi rê chuột trên màn.

## Chia máy cắt (QLSX) - `QlsxCutAllocation.tsx`, `cutAllocationModel.ts`

- **Ô sửa một hàng**: [máy][số cây + chữ "cây"][↑][↓][Tách][Xoá]; ô máy co lại để cả hàng vừa thẻ.
- **Gom dòng liền nhau** cùng lệnh + loại sắt + chiều dài cây: đầu nhóm ghi lệnh, chip N1/Booking/Hạn, loại sắt; "Chi tiết ra" và
  "Đoạn dư cả loại" ghi một lần cuối nhóm. Chỉ gom dòng kề nhau, không xếp lại thứ tự cắt.
- **Thanh tải** mảnh dưới tên mỗi máy (cây của máy ÷ cây của máy nhiều nhất).
- **Nhãn lớp máy chỉ hiện khi cần**: "Cắt được máy tự động" (cây không dập trên máy laze), "Lỗ làm tay" (xưởng không laze),
  "Cây có đoạn dập – nên cắt laze" (đỏ). Trước: cây không dập trên máy laze vẫn mang nhãn "MC Tự động".
- "Cách hệ thống chia" thu vào nút, chỉ nói luật của xưởng đang xem. "Đã báo ≈x/y đoạn" bỏ chữ "(xấp xỉ)" (giải thích ở tooltip),
  máy trống chỉ ghi "Chưa có việc.". Bảng Chờ sắt ghi đơn vị "(cây)".
- **Phiếu in**: cột chữ căn trái, cột số căn phải, tiêu đề cùng dấu " · ".

## Máy & tem QR (QLSX) - `QlsxSetup.tsx`, `qlsxUi.tsx`

- Bỏ chữ "Máy cắt:" trên ô loại; cột đổi tên "Loại máy cắt". Ô Xưởng và ô Loại cùng cỡ, thẳng hàng. Máy cắt chưa gán xưởng: viền vàng + tooltip.
- Điện thoại: mỗi máy một thẻ (ô Xưởng đọc đủ tên, ô Loại máy cắt, nút Xem / in).

## Admin › Cấu hình hệ thống › Máy cắt - `SystemConfigPage.tsx`, `systemConfigUi.ts` (mới, có test)

- Chia 3 khung cùng kiểu: **Theo máy** (2 thẻ máy, thông số riêng, bảng số cây/bó theo quy cách), **Theo xưởng** (số cỡ đoạn tối đa,
  máy cắt bắt buộc), **Bộ giải và gộp đơn**.
- Ô cùng hàng thẳng hàng; nhãn "Thời gian giải tối đa (giây)"; lời giải thích tối đa 2 dòng, phần dài bấm "Xem thêm".
- Bảng quy cách có dữ liệu thì ô "Hệ số bó" chung khoá kèm câu giải thích (giá trị và cách lưu không đổi); thẻ MC Tự động ghi
  "Bó theo 14 quy cách". Dưới mã quy cách có chữ giải nghĩa "Phi 10", "Hộp 13×26", "Vuông 15".

## Khác

- **Hướng dẫn sử dụng** (`Guide/content/manufacturing.ts`, `productionPlan.ts`, `admin.ts`, `boss.ts`): cập nhật theo giao diện mới.
- **e2e** `golden-path.spec.ts`: chọn Xưởng cơ khí trước khi bấm Tính (bắt buộc từ sáng 13/11, trước đó e2e chưa chọn).

## Kiểm tra

- tsc sạch; eslint toàn `src` giữ 189 cảnh báo, 0 lỗi; vitest 49 file, 507 test pass (khoảng 35 test mới).
- Chụp ảnh thật ở local (Edge headless): 1440×900, 375 px, nền tối cho mọi màn trên; trạng thái lỗi / đang tải / rỗng của Chia máy cắt,
  lỗi của Hướng dẫn cắt; 4 màn lượt review chưa xem được: Sếp duyệt (nhãn cần kiểm lại, nút Duyệt khoá), hộp Gửi QLSX (ô xưởng khoá),
  màn quét QR (dòng "Laze 1 Phú An · MC Laser · Xưởng Phú An · tổ Phôi"), Admin › Cắt sắt. Bấm "Mở Tối ưu cắt sắt" chuyển đúng trang.
- Không trang nào cuộn ngang ở 375 px.

## Chưa làm / chờ

- Cột trống "Đã cắt" cho công nhân đánh dấu trên phiếu cắt theo máy / bản in hướng dẫn cắt: chờ xưởng trả lời.
- QLSX và tổ Phôi dùng thử một buổi rồi chỉnh tiếp chỗ họ khựng lại.
- Chưa chạy e2e (chỉ sửa bước chọn xưởng trong `golden-path.spec.ts`).
