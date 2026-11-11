# Changelog 11/11/2026 - Tối ưu cắt sắt: hiện tên + quy cách sắt

## Yêu cầu
Màn Kế hoạch SX → Tối ưu cắt sắt:
1. Khung "Chiều dài cây sắt" (chọn chiều dài cây cho từng loại sắt, bỏ trống = cây chuẩn 6m) đang ghi mã sắt (SAT-002…).
   Người dùng không nhớ mã, cần thấy tên sắt.
2. Bảng "Kết quả đã tính" thiếu cột Quy cách.

Lưu ý dữ liệu: nhiều loại sắt TRÙNG TÊN, chỉ khác quy cách (vd SAT-001 và SAT-025 đều "Sắt phi 6zem", Ø21 / Ø19;
SAT-003/004/017/021 đều "Sắt vuông 6zem"), nên chỉ ghi tên là chưa đủ, phải kèm quy cách.

## Sửa (FE)
- `src/modules/pages/ProductionPlan/GomDotCatPage.tsx` - khung "Chiều dài cây sắt":
  - nhãn ghi "Tên · Quy cách" (vd "Sắt vuông 6zem · 20x20"); không có quy cách thì chỉ tên; thiếu tên thì dùng mã;
  - rê chuột vào nhãn hiện mã; dòng tóm tắt khi khung đóng cũng ghi nhãn này (vd "Sắt hộp 6zem · 10x20 5m85 · còn lại 6m");
  - xếp theo tên, rồi quy cách, rồi mã.
- `src/modules/pages/ProductionPlan/CuttingSolvePanel.tsx` - bảng kết quả (`SolveLinesTable`): thêm cột **Quy cách** ngay sau
  cột Loại sắt ("—" khi không có). Bảng này dùng chung cho "Kết quả đã tính" và phần phương án cắt ở màn Lệnh sản xuất.
- `src/services/cutting-batch-api.ts`, `src/services/cutting-proposals-api.ts`: thêm `materialSpec?: string | null` vào
  `CandidateMaterial`, `CuttingSolveLine`, `CuttingProposalLine`.
- Cần BE trả `materialSpec` (xem changelog BE cùng ngày).

## Kiểm tra
- `tsc` sạch; `eslint` không thêm cảnh báo mới (còn 2 cảnh báo cũ ở `GomDotCatPage.tsx`); `vitest` 444/444.
- Thử trên trình duyệt (bản dev, DB local, PO thử `TEST-XEM-TEN-SAT` gồm PB-SP1 + PB-SP2): khung ghi
  "Sắt hộp 6zem · 10x20", "Sắt phi 6zem · Ø21"; tính phương án xong, bảng kết quả có cột Quy cách (Ø21, 10x20), dòng Tổng thẳng cột.
