# 13/11/2026 - Chia sắt cho máy cắt, đợt A (nền)

Phần giao diện đi kèm thay đổi BE cùng ngày (xem changelog cùng tên ở repo BE).

## Thay đổi

- **Sản lượng xưởng → Máy & tem QR** (`Floor/QlsxSetup.tsx`, `qlsxUi.tsx`, `qrPrint.ts`):
  - Thêm máy cắt phải chọn Loại máy cắt (MC Laser / MC Tự động) và Xưởng (mặc định xưởng phụ trách của QLSX).
  - Danh sách máy có cột Xưởng; máy cắt sửa nhanh xưởng và loại máy ngay trên dòng.
  - Đầu bảng có dòng "Máy cắt đang dùng" theo xưởng.
  - Nhãn "Máy cắt laser" đổi thành "Máy cắt" + loại máy. Tem QR in thêm loại máy và xưởng.
- **Màn quét QR** (`FloorScanApp.tsx`): dòng phụ dưới tiêu đề ghi loại máy và xưởng.
- **Số lỗ ô van:** đã làm rồi gỡ trong ngày (Sếp chốt 13/11, câu 7: cây có lỗ ô van không cắt máy tự động, số lỗ không còn tác dụng). Màn Định mức mảnh không đổi.
- **Hướng dẫn cắt (Phôi)**, **Lệnh SX** (`CuttingSolvePanel.tsx`, `CuttingPlanNote.tsx`), **Admin → Phương án cắt**:
  - Mỗi kiểu cắt có cột / huy hiệu "Máy": MC Tự động (không lỗ hoặc chỉ khoan) / MC Laser (có đoạn dập lỗ ô van), kèm đoạn dập trên cây.
  - Kiểu cắt tách nhiều nhóm thì ghi "N cây · …". Xưởng chỉ có máy tự động thì ghi "MC Tự động · lỗ làm tay".
  - Phôi có thêm dòng "Theo loại cây".
  - Bản in và Excel của hướng dẫn cắt có cột Máy.
- **Hàm dùng chung** `utils/cutMachine.ts`: nhãn lớp máy, câu đoạn dập (mm ghi kiểu Việt), tổng số cây theo lớp.
- **Hướng dẫn sử dụng** (`Guide/content/manufacturing.ts`, `productionPlan.ts`, `admin.ts`): khai máy cắt theo xưởng, cột Máy ở Hướng dẫn cắt, luật đoạn cuối laze, quy cách ngoài bảng bó bị chặn.

## Kiểm tra

- tsc sạch; eslint toàn `src` giữ 189 cảnh báo, 0 lỗi; vitest 45 file, 458 test pass.
- Thử trên trình duyệt (local):
  - Hướng dẫn cắt của Phôi hiện cột Máy và dòng "Theo loại cây".
  - Tab Máy & tem QR hiện dòng tóm tắt, ô chọn xưởng và loại máy.
