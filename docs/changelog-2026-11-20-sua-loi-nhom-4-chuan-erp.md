# 20/11/2026 - Sửa lỗi nhóm 4 theo chuẩn ERP (FE)

Đi kèm BE: `changelog-2026-11-20-sua-loi-nhom-4-chuan-erp.md` ở repo BE (quy ước chống bấm trùng 409 / 422, bộ kiểm tệp đính kèm, 409 khi
xoá dữ liệu đang được dùng). Deploy BE trước, FE ngay sau trong cùng đợt.

## Thay đổi
- Giám đốc ở Bán hàng > Quản lí đơn hàng (E2E-4): không còn nút "Tạo PO"; nhãn cọc không bấm được; dòng phụ ghi "· chỉ xem"; chi tiết PO
  không có "Xoá đơn hàng" và "Đổi màu dây / vải nệm" - khớp luật BE (chỉ Sales + Admin ghi đơn). Sales / Admin thấy như cũ.
  Tiện ích `utils/salesAccess.ts` (`canWriteSalesOrders`).
- Load cont (E2E-3): làm tròn 2 số lẻ, đơn ít bộ hiện "≈ 0,04 cont" (trước "≈ 0 cont"); số cực nhỏ hiện "< 0,01 cont".
- Chống bấm trùng (T4-4, T1-9): `useRetrySafeKey` giữ khoá khi mất mạng hoặc BE báo 409 "đang xử lý" (`IdempotencyKeyInUseException`), đổi
  khoá ở mọi lỗi khác (422, 400...). Màn Admin > Thông báo gửi `Idempotency-Key` khi phát thông báo chung: bấm lại không tạo bản thứ 2.
- Xoá nhiều SKU (XOA-SKU): xoá hết danh sách, SKU nào bị chặn thì báo "Đã xoá x/y SKU. <lý do của BE>" và vẫn tải lại danh sách.
- Hướng dẫn: Bán hàng (xoá đơn bị chặn vì lượt tính phương án cắt; khách có đơn / booking không xoá được; sửa câu cũ sai về đổi màu),
  Giám đốc (chỉ xem đơn hàng), Sản xuất (cách đọc Load cont).

## Kiểm
- tsc sạch; vitest 77 file / 969 test (mới: salesAccess, useRetrySafeKey, sku-api; sửa containerLoad, notifications-api); eslint 0 lỗi.
- Trình duyệt trên bản sao (BE bản build mới): Load cont đơn ít bộ hiện "≈ 0,04 cont"; Giám đốc ở Quản lí đơn hàng chỉ xem (desktop +
  375 px, không tràn ngang, console sạch); Admin phát thông báo chung mất phản hồi lần 1 -> bấm lại cùng khoá, chỉ 1 bản.
