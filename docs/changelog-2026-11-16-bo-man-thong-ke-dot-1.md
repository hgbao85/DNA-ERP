# 16/11/2026 - Bỏ màn thống kê tổ Phôi / Hàn / Sơn, đợt 1 (FE)

Đi kèm BE: changelog cùng tên ở repo BE. BE đóng các API báo cũ, sửa QR khu nhận sắt; có phần "Vì sao" và "Lưu ý deploy".

## Thay đổi

- **Phôi "Lệnh sản xuất"** (`Phoi/LenhSanXuatPhoi.tsx`), chi tiết một loại sắt nay chỉ còn xem:
  - Còn lại: bảng Cần / Đã làm / Lỗi / Còn lại; danh sách đợt kèm kết quả KCS (tab Cắt: "Các đợt cắt"; công đoạn phụ: "Các đợt đã gửi KCS"); nút "Gán" SKU cho đợt cũ; link "Xem hướng dẫn cắt đầy đủ".
  - Đã bỏ (cả ở tab Cắt lẫn các tab công đoạn phụ): ô nhập, "Lưu đợt cắt", "Gửi KCS", "Hoàn tác", "Bù đủ".
  - Đầu màn có khung: "Báo cắt và công đoạn phụ làm bằng quét mã QR tại máy. QLSX kiểm và gửi KCS ở "Sản lượng xưởng"."
  - Tab Vật tư TP và chân nhôm không đổi, vẫn báo được.
- **"Xác nhận nhận sắt"** (`Phoi/XacNhanNhanSatPage.tsx`):
  - Dòng sắt cây chờ nhận chỉ hiện chữ "Nhận bằng mã QR "Khu nhận sắt"".
  - Sắt La và thanh nhôm vẫn có nút "Xác nhận đã nhận".
  - Dòng đếm đầu tab tách riêng: Sắt La / thanh nhôm chờ bạn xác nhận, và lô sắt cây chờ nhận ở khu nhận sắt.
- **Hàn / Sơn "Lệnh sản xuất"** (`Han/LenhSanXuatHan.tsx`, `Son/LenhSanXuatSon.tsx`): luôn chỉ xem, kèm khung "Báo số mảnh làm bằng quét mã QR tại máy…". Khung thông báo dùng chung: `components/sanxuat/LegacyReportNotice.tsx`.
- **QLSX "Xem các tổ"** (`Manufacturing/MfgApp.tsx`, `Manufacturing/QlsxTeamViewsPage.tsx`):
  - 1 mục menu mới, 4 tab con chỉ đọc: Hướng dẫn cắt, Kho phôi (không bật kiểm kê), Khung hàn, Mảnh chờ đan.
  - Hạn chế: 4 màn này hiện dữ liệu mọi xưởng, chưa lọc theo xưởng QLSX phụ trách.
- **QR khu nhận sắt** (`Floor/scan/SteelReceiveRow.tsx`, `Floor/floorUi.ts`): gõ 0 thì không xác nhận được, kèm câu nhắc "Không nhận được cây nào thì báo thủ kho, đừng xác nhận 0."
- **Hướng dẫn** (`Guide/content/manufacturing.ts`):
  - Đã cập nhật các bài: tổng quan tab; Phôi cắt sắt (nay là "xem tiến độ"); xác nhận nhận sắt; Hàn / Sơn; QR của công nhân.
  - Thêm bài "Xem các tổ".
  - 3 bài `mfg-phoi-cat`, `mfg-han-son`, `mfg-phoi-nhan-sat` đã bỏ ảnh màn cũ, nay hiện hình minh hoạ mới (vòng 2). Cần chụp ảnh màn mới.
- Các hàm gọi API cũ trong `src/services/*` chưa xoá, để dọn ở đợt sau.

### Vòng 2, sau QA review

- **"Máy & tem QR"** (`Floor/QlsxSetup.tsx`, hàm `workshopsMissingSteelReceive` trong `Floor/qlsxUi.tsx`):
  - Xưởng nào có máy đang dùng mà thiếu mã "Khu nhận sắt" đang dùng, gán đúng xưởng, thì hiện cảnh báo vàng: "Xưởng X chưa có mã "Khu nhận sắt" đang dùng - sắt xuất cho lệnh của xưởng này sẽ không ai nhận được…"
  - Câu khi chưa có máy đổi thành "mỗi xưởng 1 mã Khu nhận sắt".
- **Màn Hàn / Sơn chỉ xem** (`components/sanxuat/core.tsx`): chữ gợi ý nhập đổi sang chữ xem, ví dụ "Xem số mảnh đã hàn… Công nhân báo bằng quét mã QR tại máy", "— chưa có —". Chỉ đổi khi chỉ xem, nên Vật tư TP của Phôi giữ nguyên.
- **Chữ màn Phôi:**
  - Câu nhắc theo đúng câu BE ("…QLSX kiểm, hủy lần báo sai và gửi KCS…").
  - "Chưa nhận sắt - công nhân nhận bằng mã QR "Khu nhận sắt" của xưởng."
  - Danh sách đợt công đoạn phụ tên "Các đợt đã gửi KCS", kèm ghi chú số "Đã làm" gồm cả phần chưa gửi KCS.
  - Màn "Xác nhận nhận sắt" ghi khu nhận sắt "của xưởng".
- **Hướng dẫn:**
  - Bỏ ảnh minh hoạ cũ của 3 bài, nên hình minh hoạ mới hiện ra.
  - Sửa các câu lệch: "Các đợt cắt" / "Các đợt đã gửi KCS"; cột "Đã báo (mảnh)"; "Bù đủ" chỉ còn ở Vật tư TP; Vật tư TP loại mảnh không khai công đoạn báo được bằng điểm QR của tổ Phôi.
  - Sửa thêm `warehouse.ts`, `journey.ts` (số đỏ "Xác nhận nhận sắt" nay đếm Sắt La / thanh nhôm).

## Kiểm tra

- tsc sạch. eslint 0 lỗi; 4 cảnh báo có sẵn từ trước, ở `MfgApp.tsx` và `core.tsx`.
- vitest: thư mục Phôi, Hàn, Sơn, sanxuat, Floor, Guide, Manufacturing đạt 19 file / 223 test.
- QA review độc lập: "Đạt có điều kiện"; các điểm phải sửa đã sửa ở vòng 2 (chi tiết ở changelog BE).
- **Thử thật trên trình duyệt** (FE dev 3100 nối BE thử 3003 trên bản sao DB local, đã xoá). QA đi 10 tiêu chí, kết luận "Đạt có điều kiện", không có lỗi mức cao.
  - Phôi:
    - Chi tiết loại sắt: 0 ô nhập, không còn "Lưu đợt" / "Hoàn tác" / "Bù đủ" / "Gửi KCS", khung thông báo đúng câu, khổ 375 px ổn.
    - Vật tư TP lưu được.
    - Chân nhôm mở ô nhập sau khi nhận thanh nhôm.
  - Xác nhận nhận sắt: sắt cây chỉ có chữ cam. Nhận được Sắt La / thanh nhôm. Dòng đếm và số đỏ = 3, giảm dần mỗi lần nhận.
  - Hàn / Sơn: 0 ô nhập, không còn chữ "Nhập".
  - QLSX:
    - "Xem các tổ" đủ 4 tab, không có nút ghi.
    - "Máy & tem QR" cảnh báo đúng xưởng thiếu mã khu nhận sắt; thêm mã thì cảnh báo của xưởng đó mất.
  - QR khu nhận sắt: lọc đúng xưởng; gõ 0 bị khoá nút.
  - Console: không có lỗi mới.
- Sau khi thử, Lead sửa thêm:
  - chữ "Xưởng Xưởng …" bị lặp trong cảnh báo khu nhận sắt;
  - phụ đề màn Phôi khi Giám đốc xem (không nói tới gán SKU / báo Vật tư TP);
  - chân màn Hàn / Sơn bỏ câu "làm tuần tự", vì màn này không khoá SKU;
  - Hướng dẫn `manufacturing.ts`, `productionPlan.ts`, `journey.ts` còn câu nhập số / "Bù đủ" kiểu cũ.
- Lỗi có sẵn từ trước, chưa sửa (ghi ở backlog):
  - **Vật tư TP hiện số chậm một nhịp sau "Lưu đợt".** Người dùng dễ tưởng chưa lưu rồi bấm lại, thành báo trùng.
  - Khổ 375 px: bảng "Xác nhận nhận sắt" và "Kho phôi" phải vuốt ngang mới thấy cột thao tác.
  - Chữ "Chưa xác định được định mức" thoáng hiện khi chuyển tab.
- Ảnh minh hoạ của 3 bài Hướng dẫn cần chụp lại.
