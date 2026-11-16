# 16/11/2026 - Đổi xưởng của lệnh do KHSX (FE)

Đi kèm BE: changelog cùng tên ở repo BE. BE đổi quyền route, dời hàng đợi tổ, đổi luật QLSX gửi Sếp và thông báo; có phần "Vì sao" và "Lưu ý deploy".

## Thay đổi

### Luật dùng chung
File mới `components/changeWorkshopRules.ts`, có test:
- `canChangeWorkshop(user)`: KHSX (`isProductPlanner`) hoặc Admin. Admin không vào được màn Kế hoạch nên thực tế chỉ KHSX thấy nút.
- `workshopChangeAction(...)`: hiện nút, hoặc hiện chữ "Đã xuất sắt / vật tư — không đổi xưởng được", hoặc không hiện gì (lệnh có SKU chưa gửi / bị từ chối).
- `buildPendingMovesWarning(...)`: dựng khung cảnh báo phiếu chuyển.

### Hộp đổi xưởng (`components/ChangeWorkshopDialog.tsx`)
- **Cảnh báo phiếu chuyển:** mở hộp thì gọi `GET /warehouse-transfers/workshop-moves/pending?productionInvoiceId=`.
  - Lệnh còn phiếu chuyển chờ nhận thì hiện khung cam "Lệnh còn N phiếu chuyển hàng chưa nhận", gồm:
    - danh sách tối đa 5 dòng "kho gửi → kho nhận", còn lại gộp "và N phiếu khác";
    - câu hướng dẫn thủ kho của kho gửi xử lý theo hàng thật: hàng chưa rời kho → huỷ phiếu; hàng đang trên đường → đổi nơi nhận; hàng đã tới kho nhận → nhận rồi lập phiếu chuyển tiếp.
  - Khung chỉ cảnh báo, không chặn nút.
  - Không tải được thì hiện chữ nhỏ "Chưa kiểm được phiếu chuyển của lệnh".
- **Chữ trong hộp:**
  - Tiêu đề luôn là "Đổi xưởng cơ khí".
  - Nhãn ô lý do: "Lý do (Sếp, KHSX và QLSX sẽ đọc)".
  - Khung vàng: lệnh còn chờ / đang chạy ở hàng đợi tổ thì sang cuối hàng đợi cùng tổ của xưởng mới; Sơn theo nơi sơn, nên giữa Phú An và Phước An dòng Sơn giữ nguyên. Lệnh đang chờ QLSX thì QLSX xưởng mới nhận lệnh để xử lý.

### "Lệnh sản xuất mới" của KHSX và "Xử lý lệnh sản xuất" của QLSX (`ProductionPlan/LenhSXPage.tsx`)
- **KHSX**, ở chi tiết 1 lệnh: có nút "Đổi xưởng" cạnh "Sửa thời hạn".
  - Nút hiện khi mọi SKU đang chờ QLSX / chờ Sếp / đã duyệt.
  - Lệnh đã xuất sắt / vật tư: thay nút bằng chữ "Đã xuất sắt / vật tư — không đổi xưởng được".
- **QLSX:**
  - Bỏ nút "Chuyển xưởng" ở khối chờ QLSX.
  - Khối "Đã gửi Sếp — chờ duyệt": bỏ nút "Đổi xưởng", giữ danh sách để xem.
  - Hộp "Chọn kho & xưởng": lệnh đã có xưởng thì ô xưởng bị khoá cho mọi QLSX, kèm câu "Xưởng do KHSX chọn - lệnh cần sang xưởng khác thì báo KHSX đổi xưởng." Lệnh chưa có xưởng vẫn chọn được.
- **Hộp "Gửi QLSX" của KHSX:** câu dưới ô xưởng nay chỉ tới nút "Đổi xưởng", không còn "để QLSX chuyển xưởng".
- **Nhãn "Cần kiểm lại phương án cắt"** (chữ khi rê chuột): "QLSX vừa đổi xưởng" đổi thành "Lệnh vừa đổi xưởng".
- **Đánh dấu dòng:** dòng lệnh ở danh sách của KHSX và ở khối "Đã gửi Sếp" có đánh dấu, nên mở từ thông báo thì cuộn tới và nháy đúng dòng.

### "Tổng hợp lệnh SX" (`Manufacturing/ThongKePagePlan.tsx`)
Nút "Đổi xưởng" ở chi tiết lệnh chuyển từ QLSX sang KHSX.

### Hướng dẫn trong app
**`Guide/content/productionPlan.ts`, bài "Số LSX và xưởng cơ khí":**
- Chỉ KHSX đổi xưởng. Nơi bấm:
  - "Lệnh sản xuất mới" > tab "Đang lập" / "Đang chạy" > mở lệnh;
  - hoặc "Tổng hợp lệnh SX" > chi tiết lệnh.
- QLSX không đổi xưởng, kể cả lúc gửi Sếp.
- Hàng đợi tổ sang cuối hàng đợi xưởng mới. Lệnh đang chạy ở xưởng cũ thì QLSX xưởng cũ bấm "Bắt đầu lệnh đầu hàng đợi" nếu hàng đợi còn lệnh chờ. Hàng đợi Sơn giữ nguyên nếu nơi sơn không đổi.
- Cảnh báo phiếu chuyển và cách thủ kho xử lý.
- Người nhận thông báo.
- Lỗi thường gặp có thêm nguyên nhân "là QLSX".
- Xưởng cơ khí: KHSX chọn ở "Tối ưu cắt sắt" lúc tính; hộp "Gửi QLSX" và hộp "Chọn kho & xưởng" hiện sẵn và khoá.

**Các bài khác trong `productionPlan.ts`:**
- Bài lập lệnh của KHSX: bước "Gửi QLSX" kiểm ô "Xưởng cơ khí (cả lệnh)".
- Bài QLSX chọn kho: ô xưởng hiện sẵn và khoá.

**`Guide/content/manufacturing.ts`:**
- Bước 1 của luồng QLSX: xưởng do KHSX chọn.
- Bài hàng đợi QLSX: thêm câu về đổi xưởng.
- Tên nút khớp màn thật: "Thêm lệnh", "Chuyển lệnh tiếp", "Bắt đầu lệnh đầu hàng đợi", "Chuyển nhầm? Mở lại <mã lệnh>".

**`Guide/content/warehouse.ts`:** điều kiện bài "Chuyển hàng của lệnh đổi xưởng" đổi thành "KHSX đã đổi xưởng của lệnh".

## Kiểm tra

- tsc sạch. eslint 0 lỗi, chỉ còn các cảnh báo có từ trước.
- vitest các thư mục `components`, `services`, `Guide`, `ProductionPlan`, `Manufacturing`, `Floor`, `Phoi`: 32 file / 379 test đạt. Đã gồm commit mới của đồng nghiệp (tải đủ mọi trang, HEAD `1489d38`) vừa pull.
- **QA:**
  - Review độc lập.
  - Nghiệm thu trên trình duyệt, bản sao DB local, 2 vòng, desktop + 375 px:
    - KHSX thấy nút ở cả 2 màn;
    - lệnh đã xuất sắt hoặc chỉ xuất vật tư hiện chữ khoá;
    - hộp hiện khung cam khi có phiếu chuyển thật;
    - QLSX không còn nút nào, ô xưởng khoá;
    - Hướng dẫn hiện đúng câu mới;
    - console không có lỗi mới.
- **Sửa sau lần nghiệm thu cuối, chưa chạy lại trên trình duyệt** (đã qua soát đối kháng + vitest):
  - câu về Sơn trong hộp;
  - chữ Hướng dẫn;
  - đánh dấu dòng khi mở từ thông báo.

## Còn lại (để sau)

- "Tổng hợp lệnh SX": nút "Đổi xưởng" chưa xét trạng thái mọi SKU (lệnh có SKU chưa gửi thì bấm xong mới nhận 409). Hộp ghi "cả N SKU" nhưng chỉ đếm SKU đã duyệt.
- Khổ 375 px: nhãn "Cần kiểm lại phương án cắt" đè ngày hạn ở danh sách lệnh (có từ trước).
- Link thông báo của QLSX mở "Sản lượng xưởng" theo tổ nhớ trong máy, không theo tổ trong câu.
