# 13/11/2026 - Chia sắt cho máy cắt, đợt B1 (tab "Chia máy cắt")

Phần giao diện đi kèm BE cùng ngày (xem changelog cùng tên ở repo BE). Sếp chốt 13/11, câu 8: hệ thống tự chia, QLSX xưởng chỉnh linh hoạt.
Bảng chỉ là kế hoạch, không đổi màn quét QR hay hàng đợi tổ.

## Thay đổi

- **Sản lượng xưởng → tab mới "Chia máy cắt"** (`Floor/QlsxCutAllocation.tsx`, đặt sau "Sản lượng & gửi KCS"):
  - **Chọn xưởng:** QLSX có xưởng thấy ngay xưởng mình; QLSX chung chọn ở ô Xưởng (nhớ lựa chọn trên máy).
  - **Nút chia:**
    - "Chia tự động" lần đầu;
    - sau đó "Chia phần còn lại" và "Chia lại" (hỏi lại: giữ dòng sửa tay, xếp lại thứ tự theo ưu tiên).
    - Có nhắc số dòng cũ, khung vàng cảnh báo, một đoạn giải thích cách hệ thống chia.
  - **Mỗi máy 1 thẻ:** loại máy, tổng cây, "Đã báo ≈X/Y đoạn (xấp xỉ)", nút "In phiếu".
  - **Mỗi dòng ghi:**
    - lệnh + chip N1 / Booking / Hạn;
    - loại sắt, cây "5.030 mm", số cây;
    - kiểu cắt "600×3 + 400×8" kèm huy hiệu Uốn / Dập / Khoan / Tán theo đoạn;
    - bó, lớp máy, đoạn dập trên cây;
    - chi tiết ra, đoạn dư cả loại, nhãn "Đã sửa tay".
  - **Sửa tay trên dòng:**
    - đổi máy, sửa số cây (Enter / rời ô), lên / xuống, tách sang máy khác, xoá;
    - ô chọn máy khoá máy tự động với dòng có đoạn dập khi xưởng có laze (cùng luật BE);
    - lỗi BE hiện nguyên câu.
  - **Khối "Chưa chia"** (nút "Chia phần còn lại") và **"Chờ sắt"** (Cần / Có / Thiếu, nút "Chia luôn" có hỏi lại).
  - **In:** "In phiếu" từng máy hoặc "In tất cả máy" (mỗi máy 1 trang A4 ngang).
    - 9 cột: STT, Lệnh, Loại sắt, Cây (mm), Số cây, Kiểu cắt, Khoan/Dập/Uốn, Chi tiết ra, Đoạn dư.
    - Phiếu luôn nền trắng chữ đen.
    - Trình duyệt chặn cửa sổ in thì màn báo rõ.
  - Tự tải lại khi có thay đổi ở xưởng (realtime `floor`, `steel-issues`).
- **Hàm thuần** `Floor/cutAllocationModel.ts` (gom dòng theo máy, chữ hiển thị, máy nhận được dòng, nhãn xưởng, HTML phiếu in), có test.
- **API** `services/floor-api.ts`: kiểu `BeCutAllocationBoard` / `BeCutAllocationRow`… và 7 hàm gọi `/floor/cut-allocation`.
- **Hướng dẫn sử dụng** (`Guide/content/manufacturing.ts`):
  - bài mới "QLSX — Sản lượng xưởng: chia sắt cho từng máy cắt" (cách dùng, bảng luật chia, lỗi thường gặp);
  - tổng quan QLSX ghi 5 tab; bảng "Việc nào làm ở màn nào" thêm dòng chia máy cắt.

## Kiểm tra

- tsc sạch; eslint toàn `src` giữ 189 cảnh báo, 0 lỗi (Floor + `floor-api.ts` 0 cảnh báo); vitest Floor 95 test, Guide 16 test pass.
- Thử trên trình duyệt (local, QLSX Phú An):
  - **Bố cục:** tab hiện đủ thẻ máy, dòng, chờ sắt. Khổ điện thoại 375 px gọn, không cuộn ngang trang.
  - **Thao tác:** nút lên / xuống đổi đúng thứ tự trên máy. Ô chọn máy ghi "- không cắt cây có đoạn dập" ở máy tự động.
  - **In:** phiếu in dựng từ bảng thật đúng 9 cột, mỗi máy 1 trang.
