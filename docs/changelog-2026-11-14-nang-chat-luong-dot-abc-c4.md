# 14/11/2026 - Nâng chất lượng FE đợt chia máy cắt (A/B/C) + C4

Đi kèm changelog BE cùng tên. Mục tiêu: UI, UX và độ sạch code của các màn đợt chia máy cắt lên mức tối thiểu 8,5/10, không đổi nghiệp vụ.

## Thay đổi

1. **Màn QLSX "Chia máy cắt"** (`Floor/QlsxCutAllocation.tsx` + thư mục mới `Floor/cutAllocation/`):
   - Tách thành khoảng 15 component nhỏ, dài nhất 43 dòng (trước: Board 203, AllocRow 119, HistoryBody 94). Thao tác ghi gom ở `useBoardActions`.
   - Nút sửa của từng dòng (đổi máy, số cây, ↑ ↓, Tách, Xoá) ẩn sau nút **"Sửa" / "Xong"** của từng thẻ máy. Mặc định chỉ xem, bớt rối.
   - Đầu thẻ máy còn 1 dòng "Đã cắt ≈ X/Y cây · còn ≈ Z" + thanh. Chú thích "≈ là số ước từ số đoạn công nhân đã báo" ghi một lần ở đầu bảng.
   - "Cách hệ thống chia" thành 10 gạch đầu dòng ngắn (`explainLines`).
   - Ô chọn máy khoá máy BE không nhận dòng đó, kèm chữ "máy này không nhận dòng này". Dùng trường mới `allowedMachineIds`; BE cũ không trả trường này thì dùng `machineAcceptsRow` làm dự phòng.
   - "Chờ sắt" ghi "N cây còn giữ ở kho xưởng khác, chờ chuyển kho" (trường mới `heldElsewhereBars`).
   - Tự tải lại theo realtime, gom 1,5 giây.
2. **Khối "Năng suất máy cắt"** (`QlsxCutMachineStats.tsx` + `Floor/cutMachineStats/`):
   - Tách theo loại máy, theo máy, theo ngày, theo loại sắt; component chính từ 198 xuống 38 dòng.
   - Bảng cuộn trong khung, trang không tràn ngang. Tải Excel giữ nguyên.
3. **Màn quét QR của công nhân** (`Floor/FloorScanApp.tsx` + `Floor/scan/`):
   - File từ 1.248 xuống 110 dòng; component dài nhất 56 dòng.
   - Nút chính tắt thì ghi lý do ngay trên nút: "Chọn lệnh ở Việc của máy trước", "Gõ số đoạn vào ô ở trên", "Loại sắt này chưa nhận", "Chọn mảnh ở trên trước".
   - Nút chính Hàn / Sơn đổi chữ "Chọn mảnh" thành "Nhập số mảnh".
   - Khối "Việc của máy" có dòng "≈ là số ước từ số đoạn đã báo".
   - Dòng đầu màn không còn hiện mã vai trò thô (vd "tổ PRODUCTION_MANAGER") với tài khoản không thuộc tổ.
4. **Hai trang lớn, chỉ tách, không đổi giao diện / hành vi:**
   - `ProductionPlan/GomDotCatPage.tsx`: component chính từ 1.692 xuống 1.001 dòng; phần đợt này thêm chuyển sang `ProductionPlan/gomDotCat/`.
   - `Admin/SystemConfigPage.tsx`: component chính từ 732 xuống 153 dòng, `handleSave` từ 122 xuống 26 dòng (các bước kiểm có tên trong `systemConfig/validate.ts`, có test).
5. **Dùng chung:**
   - `STAGE_LABEL` / `STEP_LABEL` gom về `Floor/floorUi.ts`;
   - primitive style dùng chung trong `qlsxUi.tsx`;
   - bỏ "(Sếp chốt 14/11)" khỏi chữ hiển thị (gợi ý dòng theo bó, ghi chú hàng đợi Phôi).
6. **Hướng dẫn** (`Guide/content/manufacturing.ts`):
   - bài "Chia máy cắt": nút Sửa / Xong, dòng giữ ở kho xưởng khác;
   - bài quét QR: chú thích "≈", lý do khi nút chính mờ.

## Kiểm tra

- tsc sạch. eslint không có lỗi; 118 cảnh báo còn lại đều ở dòng có sẵn từ trước (LenhSXPage, GomDotCatPage, CuttingProposalsPage), không cảnh báo nào ở dòng đợt này.
- vitest: 54 file, 601 test đạt; sau các sửa cuối, thư mục pages 24 file, 329 test đạt.
- **Xem thật trên trình duyệt** (FE dev nối BE thử trên bản sao DB, đã xoá):
  - bảng chia ở máy tính và 375 px: chế độ xem, chế độ Sửa, ô chọn máy khoá đúng;
  - khối năng suất;
  - màn quét công nhân: nút chính ghi lý do;
  - tab Máy cắt của Cấu hình hệ thống, trang Tối ưu cắt sắt: hiển thị đúng, không lỗi console.
  - Không màn nào tràn ngang ở 375 px.

## Còn lại

- Trên điện thoại, tên máy dài bị ép 3 dòng cạnh 2 nút "Sửa" / "In phiếu".
- `GomDotCatPage` còn component chính khoảng 1.000 dòng (phần có từ trước đợt này).
- FE vẫn viết style thẳng trong JSX theo lối chung của repo; mới gom phần lặp lại.
