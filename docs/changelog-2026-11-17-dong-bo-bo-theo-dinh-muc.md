# 17/11/2026 - Đồng bộ bộ theo số mảnh / bộ của định mức (FE)

Đi kèm BE: changelog cùng ngày `changelog-2026-11-17-bao-bu-kha-dung-sat-so-manh-bo.md` ở repo BE (BE thêm `qtyPerUnit` vào kế hoạch mảnh; màn quét / thẻ chờ gửi KCS trả số đã trừ lỗi KCS; câu lỗi / tin KCS lời thường; khả dụng sắt).

## Vì sao

"Tổng hợp lệnh SX", màn "Lệnh sản xuất" Hàn / Sơn và ngăn chi tiết lệnh của QLSX báo "lệch bộ", "cần hàn thêm ..." và cột SL/bộ "×1" sai với mọi SKU có mảnh ×2 / ×4: FE không gán số mảnh / 1 bộ (`perManh`) nên coi mọi mảnh là ×1. Ví dụ SKU đã báo đủ mọi mảnh theo định mức (mảnh ×2, ×4, ×1) vẫn bị "lệch bộ 100%" và "cần hàn thêm ..." cho các mảnh ×1 / ×2.

## Thay đổi

### Tính đồng bộ (file mới `components/sanxuat/syncSummary.ts`, có test)
- Tách logic khỏi `VatTuDetailBoard` thành hàm thuần `syncSummary` (đồng bộ N bộ, lệch, cần thêm), cùng `perManh`, `manhFromLine`, `dongBoOf`, `lechOf`, `qtyPerUnitOf`. `core.tsx` xuất lại các hàm này nên nơi khác import như cũ.
- `qtyPerUnitOf`: lấy `qtyPerUnit` của BE; BE cũ chưa trả thì suy `plannedQty / số bộ` khi chia hết; không suy được thì không biết (không bịa ×1).
- Số bộ của mỗi mảnh **chặn trần theo định mức**: mảnh báo dư không làm "lệch" và không bù cho mảnh khác (mặc định Lead chọn, chờ người dùng xác nhận - ghi trong code).
- Mảnh không biết SL/bộ: cột SL/bộ hiện "—", không kết luận lệch, băng ghi "chưa đủ dữ liệu định mức".
- `VatTuDetailBoard` thêm prop `showSync` (mặc định bật).

### Nơi dùng
- `Manufacturing/batchPlanLines.ts` (mới, có test): `mapBatchPlanToLines` chuyển từ `ThongKePagePlan.tsx`, gán `perManh` → Tổng hợp lệnh SX (danh sách, chi tiết, tooltip) tự đúng.
- `components/sanxuat/core.tsx` `fetchHanSonRows`: màn "Lệnh sản xuất" Hàn / Sơn gán `perManh`.
- Ngăn chi tiết lệnh của QLSX (`Floor/piDetailModel.ts`, `Floor/QlsxPiDetail.tsx`):
  - `PieceView.perUnit`; tab "Bất thường" tính lệch **theo từng SKU** bằng số đã chặn trần, ghi tên sản phẩm kèm số lệnh.
  - Xem "Cả lệnh" có từ 2 SKU: ẩn băng đồng bộ, nhắc chọn 1 SKU (mỗi SKU có số bộ riêng).
  - Tab Phôi: vật tư thành phẩm không gắn mảnh (vd chân nhôm) tách bảng riêng "Vật tư thành phẩm (không gắn mảnh)", không vào băng đồng bộ; bảng mảnh đổi tên "Mảnh Phôi".
- `services/production-batches-api.ts`: `qtyPerUnit?` (optional). `services/floor-api.ts`: chỉ kiểu + chú thích (`failed?`, `reportedQty?`; `done` là số đã trừ lỗi KCS).
- Hướng dẫn (`Guide/content/manufacturing.ts`): "đã báo / vượt / Đã cắt" là số đã trừ đoạn KCS chấm lỗi, báo bù không bị coi là vượt; cách bù cho Cắt và công đoạn phụ; đồng bộ so theo SL/bộ của định mức.

## Kiểm tra (17/11)
- vitest toàn FE qua (667 test); tsc sạch; eslint 0 lỗi.
- QA nghiệm thu trên app thử (bản sao dữ liệu): Tổng hợp lệnh SX / Lệnh SX Hàn, Sơn / ngăn QLSX cho cùng kết luận; SKU đủ bộ không còn "lệch bộ", SL/bộ đúng định mức; khổ 375 không vỡ khung.

## Còn biết, chưa sửa
- Dòng cấp PI của "Tổng hợp lệnh SX" với PI nhiều SKU vẫn gộp mảnh mọi SKU rồi mới tính lệch (có từ trước).
- Màn "Lệnh sản xuất" Hàn / Sơn tính "đã báo" = chỉ phần KCS đạt, còn Tổng hợp lệnh SX và ngăn QLSX tính đạt + chờ KCS + chưa gửi: khi còn đợt chờ, 2 bên có thể khác số (có từ trước, chủ đích của màn).

## Lưu ý deploy
- Chạy được với BE cũ (tự suy số mảnh / bộ); nên deploy cùng BE.
- Báo KHSX / Sếp: lệnh có mảnh ×2 / ×4 hết "lệch bộ" sai; số "Đã hàn (bộ)" ở màn Lệnh SX Hàn / Sơn có thể GIẢM với SKU đang làm dở vì trước đây đếm thừa.
