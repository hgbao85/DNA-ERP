# 14/11/2026 - Đợt C3 (FE): máy cắt rảnh tự kéo lệnh kế tiếp

Đi kèm changelog BE cùng tên. Việc kéo lệnh do BE làm nền; FE thêm nhãn, chú thích, hướng dẫn, và sắp lại khối việc ở màn quét. Thông báo mới do BE dựng sẵn.

## Thay đổi

1. **Lịch sử chia tay** (`QlsxCutAllocation`, `cutAllocationModel`, `floor-api.ts`):
   - Loại dòng mới `AUTO_PULL`, ghi "Hệ thống kéo (máy rảnh)".
   - Người làm ghi "Hệ thống" (`logActorText`).
   - Thẻ điện thoại vẫn ẩn tên khi không có người.
2. **"Cách hệ thống chia"** (`explainText`) thêm:
   - mỗi máy tính theo số cây còn phải cắt;
   - máy cắt hết việc thì hệ thống tự kéo lệnh kế tiếp đủ sắt mà máy cắt được, chỉ lệnh đã Bắt đầu và không chờ KHSX kiểm lại phương án cắt, lệnh gần nhất trước;
   - việc kéo về thêm vào cuối việc của máy, rồi báo QLSX + KHSX;
   - sắt còn trong kho thì báo thủ kho xuất ngay.
3. **Màn quét máy cắt** (`FloorScanApp`, `openRowsFirst`):
   - Khối "Việc của máy" đưa dòng còn việc lên trước (giữ thứ tự cắt, đánh số 1, 2, …).
   - Dòng đã cắt xong xuống cuối, đánh dấu ✓.
   - Lý do: việc máy rảnh kéo về nằm cuối danh sách chia; nếu giữ nguyên thứ tự, các dòng "Xong" phía trên đẩy việc mới ra khỏi phần xem trước 3 dòng.
4. **Hướng dẫn:**
   - `manufacturing.ts` (Chia máy cắt): mô tả máy rảnh tự kéo lệnh gồm điều kiện (kể cả lệnh chờ kiểm lại phương án cắt không được kéo), dòng mới nằm cuối, thông báo, tự vào hàng đợi Phôi, nhật ký, khi nào máy vẫn rảnh.
   - `manufacturing.ts` (màn quét): máy hết việc thì hệ thống tự kéo lệnh kế tiếp.
   - `warehouse.ts` (Xuất sắt trong phôi): thủ kho nhận "Xuất sắt lệnh … xuống Phôi ngay"; xuất đủ thì tự đóng.
5. **Sau thử đầu-cuối (14/11 trưa)** - BE sửa: sắt còn giữ ở kho xưởng khác (lệnh vừa đổi xưởng, chưa chuyển kho) không tính "đủ sắt". FE chỉ sửa chữ:
   - khối "Chờ sắt" (`QlsxCutAllocation`): thêm câu "Sắt còn giữ ở kho xưởng khác … chưa tính tới khi kho xưởng này nhận phiếu chuyển";
   - `manufacturing.ts`: luật "Loại sắt được chia" và đoạn máy rảnh tự kéo ghi "giữ chỗ ở kho của xưởng này"; thêm lỗi thường gặp "Lệnh đã có sắt giữ trong kho mà vẫn nằm ở Chờ sắt";
   - `warehouse.ts`: tin "Xuất sắt …" tới thủ kho kho Phôi của xưởng làm lệnh, tự đóng ở lượt kiểm kế tiếp (chậm nhất khoảng 10 phút); lệnh đổi xưởng phải chuyển kho trước.

## Kiểm tra

- `tsc` sạch, eslint sạch, vitest thư mục Floor + Guide: 135 test đạt (sau khi kéo bản Hướng dẫn tồn đoạn về, 2 chỗ xung đột trong `manufacturing.ts` gộp giữ cả hai bên).
- **Chụp thật** (FE trỏ BE thử trên bản sao DB, đã xoá), máy tính 1440 + điện thoại 375, không màn nào tràn ngang:
  - bảng chia có dòng hệ thống kéo về + "Cách hệ thống chia";
  - "Lịch sử chia tay" có dòng "Hệ thống kéo (máy rảnh)";
  - chuông KHSX và chuông thủ kho;
  - màn quét máy tự động (lệnh vừa kéo đứng đầu, đang chọn sẵn);
  - hàng đợi Phôi có 2 lệnh hệ thống thêm.
- **Sửa khi review:**
  - thẻ nhật ký điện thoại hiện " · —" khi không có người;
  - dòng mới bị dòng "Xong" đẩy khỏi phần xem trước ở màn quét.
