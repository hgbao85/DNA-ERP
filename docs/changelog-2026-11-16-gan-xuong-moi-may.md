# 16/11/2026 - Gán xưởng cho mọi loại máy ở "Máy & tem QR"

Sửa sau buổi review các commit ngày 14/11 (điểm 1). Đi kèm BE: changelog cùng ngày ở repo BE (`FLOOR_ALERTS=off` tắt hẳn nhắc nền).

## Vì sao

- Từ đợt C1, hàng đợi các tổ tách theo xưởng:
  - màn quét lấy lệnh theo xưởng của máy;
  - máy chưa gán xưởng được BE tính theo xưởng mặc định;
  - báo cho lệnh của xưởng khác thì bị chặn.
- Trước bản sửa này, chỉ máy cắt có ô Xưởng. Máy công đoạn phụ, điểm làm việc Hàn / Sơn và khu nhận sắt không gán được xưởng.
- Hậu quả: máy đặt ở Phước An bị tính theo xưởng mặc định, nên công nhân quét tem thấy lệnh của Phú An.
- BE đã nhận `workshopId` cho mọi loại máy; chỉ FE còn thiếu.

## Thay đổi (`Floor/QlsxSetup.tsx`, `Floor/qlsxUi.tsx`)

- **"Thêm máy":**
  - ô Xưởng hiện cho mọi loại máy, mặc định là xưởng phụ trách của QLSX;
  - gửi `workshopId` cho mọi loại; ô Loại máy cắt vẫn chỉ có ở máy cắt.
- **Bảng và thẻ điện thoại:** mọi loại máy có ô Xưởng sửa nhanh trên dòng.
  - Máy đang dùng mà chưa gán xưởng thì ô có viền vàng.
  - Tooltip của máy loại khác: "Chưa gán xưởng: máy này đang được tính theo xưởng mặc định". Máy cắt giữ câu cũ.
- **Thông báo vàng** dưới khối "Máy cắt đang dùng":
  - chỉ hiện khi có máy hoặc điểm làm việc (không phải máy cắt) đang dùng mà chưa gán xưởng;
  - nội dung: "N máy / điểm làm việc chưa gán xưởng - đang được tính theo xưởng mặc định. Máy đặt ở xưởng khác phải gán đúng xưởng, nếu không công nhân quét tem sẽ thấy lệnh của xưởng mặc định."
- **Ô Xưởng luôn đặt `borderColor`** thay vì thêm / bớt, nên hết cảnh báo React về style gộp khi đổi giữa chưa gán và đã gán.
- **Hàm thuần mới:** `isWorkshopUnassigned`, `countNonCutUnassigned`, kèm test.
- **Hướng dẫn** (`Guide/content/manufacturing.ts`, bài tạo máy và tem QR): mọi loại máy chọn Xưởng đặt máy; máy ở Phước An phải gán Xưởng Phước An.

## Kiểm tra

- tsc sạch; eslint 4 file sạch; vitest thư mục Floor + Guide: 14 file, 179 test đạt.
- **Thử trên trình duyệt:** FE dev nối BE thử trên bản sao DB local (đã xoá), đăng nhập QLSX Phú An, tab Máy & tem QR.
  - Máy công đoạn phụ đang dùng mà chưa gán xưởng thì có viền vàng và thông báo vàng.
  - Gán Xưởng Phước An ngay trên dòng thì hết viền vàng, hết thông báo; BE lưu đúng.
  - "Thêm máy", chọn tổ Hàn, loại điểm làm việc: có ô Xưởng (mặc định Xưởng Phú An), không có ô Loại máy cắt.
  - Khổ điện thoại 375 px: thẻ máy có ô Xưởng, trang không tràn ngang.

## Sau khi deploy

- QLSX gán xưởng cho mọi máy và điểm làm việc đặt ở Phước An: máy cắt, máy công đoạn phụ, điểm Hàn, khu nhận sắt.
