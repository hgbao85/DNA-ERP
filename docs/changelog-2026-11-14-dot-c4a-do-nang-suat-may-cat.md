# 14/11/2026 - Đợt C4a (FE): đo năng suất máy cắt

Đi kèm changelog BE cùng tên. Câu 7 đợt C: hệ thống tự đo năng suất máy cắt từ giờ công nhân báo qua mã QR trong 2–4 tuần chạy thật, IT gửi Sếp số đo để chốt. Đợt này chỉ hiển thị số đo, chưa áp luật chia nào.

## Thay đổi

1. **Khối "Năng suất máy cắt"** (`QlsxCutMachineStats.tsx`), nằm dưới báo cáo KCS trong tab *Báo cáo* của màn QLSX *Sản lượng xưởng*:
   - **Bộ lọc:**
     - chọn xưởng giống tab *Chia máy cắt* (`useQueueWorkshop`): QLSX gắn xưởng thì cố định;
     - khoảng ngày mặc định 14 ngày tới hôm nay; quá 62 ngày thì báo và không gọi máy chủ.
   - **Ô tổng theo loại máy:** số to là cây/ngày trung vị, kèm cây/ngày trung bình, cây/giờ, số máy, số ngày-máy.
   - **Bảng "Theo máy":** mọi máy cắt của xưởng; máy chưa có số hiện mờ "chưa có số".
   - **Mục mở/đóng:** "Chi tiết theo ngày" (lần báo, giờ báo đầu–cuối, phút tính, đoạn, mét, cây, cây/giờ, loại sắt nhiều nhất) và "Theo loại sắt".
   - **"Cách tính":** lấy số từ máy chủ (lưỡi cắt, tề đầu, chiều dài cây mặc định, nghỉ trưa, ngưỡng nghỉ dài, ngưỡng 30 phút).
   - **Tải Excel:** 5 sheet "Theo loại máy", "Theo máy", "Theo ngày", "Theo loại sắt", "Cách tính".
     - Số trong file là số thật, ô không có số để trống.
     - Tên file `nang-suat-may-cat_<mã xưởng>_<từ>_<đến>.xlsx`.
2. **Phần thuần** `cutMachineStats.ts` (+ test): định dạng số / giờ VN, khoảng ngày, nhãn loại máy, dòng "Cách tính", bảng cho Excel, tên file.
3. **`floor-api.ts`:** kiểu `BeCutMachineStats`, `floorAdmin.getCutMachineStats`.
4. **Hướng dẫn** (`manufacturing.ts`, bài tab Báo cáo): cách đọc khối mới, cách tính ngắn, Tải Excel gửi Sếp.

## Kiểm tra

- **Lệnh kiểm:**
  - `tsc` sạch;
  - eslint trên mọi file FE đang đổi: 0 lỗi; 118 cảnh báo đều ở dòng cũ (115 ở `LenhSXPage.tsx`), không có cảnh báo ở dòng mới;
  - vitest toàn repo: 52 file, 540 test đạt (`cutMachineStats.test.ts` 12 test).
- **Chụp thật** (FE thử trỏ BE thử trên bản sao DB, đã xoá):
  - máy tính 1440 và điện thoại 375 đều không tràn ngang trang; trên điện thoại bảng cuộn ngang trong khung riêng;
  - Tải Excel ra đủ 5 sheet, ô số là số.
