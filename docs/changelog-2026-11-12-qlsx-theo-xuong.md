# Changelog 12/11/2026 - QLSX theo xưởng (giai đoạn 1, FE)

Đi cùng BE `docs/changelog-2026-11-12-qlsx-theo-xuong.md` (repo BE): tài khoản QLSX có "Xưởng phụ trách"; QLSX xưởng nào xem
và thao tác lệnh xưởng đó (QLSX Phú An xem thêm lệnh Phước An vì Sơn chạy ở Phú An - chỉ xem); KHSX chọn xưởng khi gửi QLSX.

## Sửa
- User/Auth (`types/auth.ts`, `context/AuthContext.tsx`, `utils/normalizeUser.ts`, hook mới `hooks/useScopedWorkshop.ts`):
  user có `workshopId`, `workshopName`; thiếu trường (BE cũ) coi như không giới hạn.
- Admin › Người dùng (`UsersPage.tsx`, `services/users-mapper.ts`): ô "Xưởng phụ trách" khi vai là QLSX (có "Tất cả xưởng"),
  bảng hiện tên xưởng của QLSX.
- Lệnh sản xuất (`LenhSXPage.tsx`, `services/production-invoices-api.ts`, `components/ChangeWorkshopDialog.tsx`):
  - KHSX "Gửi QLSX" bắt buộc chọn xưởng cơ khí (nút Gửi khoá tới khi chọn).
  - QLSX gắn xưởng: ô xưởng trong "Chọn kho & xưởng" khoá theo xưởng của lệnh; nút "Chuyển xưởng" cho lệnh chờ QLSX (hộp đổi
    xưởng có lời nhắc riêng cho trường hợp này); lệnh xưởng khác không vào danh sách việc phải xử lý / đã gửi Sếp.
- Tổng hợp lệnh SX (`ThongKePagePlan.tsx`): KHSX/Sếp/QLSX chưa gắn xưởng có ô lọc "Tất cả xưởng / từng xưởng" (nhớ trong
  localStorage); QLSX gắn xưởng thấy tên xưởng ở tiêu đề, lệnh chỉ xem ẩn Bắt đầu/Tạm dừng/Kết thúc/Nạp lại định mức/Đổi xưởng
  và có nhãn "Sơn tại xưởng bạn · chỉ xem".
- Tổng hợp kho (`MfgWarehousesPage.tsx`): QLSX gắn xưởng chỉ thấy kho xưởng mình + kho dùng chung.

## Kiểm tra
- `tsc` sạch; `eslint` không thêm cảnh báo; `vitest` 444/444.
- Thử trên trình duyệt ở local với BE mới (2 tài khoản QLSX thử, KHSX, Admin): các luồng ở changelog BE đều chạy đúng.

## Chưa làm
- "Tổng hợp vật tư" của QLSX vẫn cộng tồn mọi kho (màn tổng hợp dùng chung, chưa tách theo kho).
- Phần quét QR (Sản lượng xưởng) chưa tách theo xưởng - giai đoạn 2.

## Bổ sung 12/11: Bảng mốc - bấm vào ô để xem chi tiết (thay cho rê chuột)
Ô mốc ở "Bảng mốc" trước đây chỉ có chú thích khi rê chuột, con trỏ hiện dấu "?" (cursor help) khó hiểu; màn cảm ứng không rê
chuột được nên không xem được lý do. `src/modules/pages/Manufacturing/MilestoneBoardView.tsx`:
- Ô mốc là nút (con trỏ bàn tay); bấm mở khung chi tiết neo cạnh ô: mã lệnh · SKU, tên mốc, trạng thái, Hạn, Bắt đầu, Tiến độ
  (% đã về / đã làm / đã đóng), Lý do. Mốc "Không cần" ghi rõ là không cần.
- Đóng khi bấm lại đúng ô, bấm ra ngoài, nhấn Esc, cuộn hoặc đổi cỡ cửa sổ; bấm ô khác thì chuyển sang ô đó. Ô đang mở có viền.
- Dòng hướng dẫn đổi thành "Bấm vào ô để xem chi tiết."; trình đọc màn hình vẫn đọc được tóm tắt ô (aria-label).
- Kiểm: tsc sạch, eslint 0 → 0, vitest 444/444; trình duyệt: mở đúng nội dung, 4 cách đóng / chuyển ô đều đúng.
- Bổ sung: các ô mốc cùng 1 cỡ - bảng `tableLayout: fixed` (cột mốc rộng đều, cột "Mã lệnh · SKU" 170px), ô cao cố định 58px đủ 3
  dòng, chữ căn giữa. Trước đây cột co giãn theo chữ và ô có dòng "Bắt đầu" cao hơn nên bảng lởm chởm. Đo trên trình duyệt: 70 ô
  đều 96 × 58 px, không ô nào bị cắt chữ; khung chi tiết vẫn mở đúng.
