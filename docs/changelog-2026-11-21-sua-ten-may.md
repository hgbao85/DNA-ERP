# 21/11/2026 - Sửa tên máy ở "Máy & tem QR" (FE)

## Vì sao
- QLSX tạo máy xong không đổi được tên gọi (chỉ đổi được xưởng, loại máy cắt, tắt / bật). Cần đổi "Máy uốn 3 trục" thành
  "Máy uốn" theo ý quản lý xưởng. BE đã nhận `name` ở `PATCH /floor/workstations/:id` từ trước.

## Thay đổi
- `src/modules/pages/Floor/QlsxSetup.tsx`: nút bút chì "Sửa tên" cạnh tên mỗi máy (bảng và thẻ điện thoại), mở hộp "Sửa tên"
  -> gọi `floorAdmin.updateWorkstation(id, { name })`. Mã ngắn in trên tem giữ nguyên, tem đã dán vẫn quét được. Lỗi BE hiện
  trong hộp.
- `src/modules/pages/Floor/workstationConfirm.ts` `renameValue`: bỏ khoảng trắng 2 đầu; rỗng, trùng tên cũ, quá 120 ký tự (giới
  hạn BE) thì khoá nút Lưu.

## Kiểm
- `workstationConfirm.test.ts` thêm 2 ca cho `renameValue`. tsc sạch; eslint 3 file sạch; vitest 77 file, 975 test đạt.
- Chưa bấm thử trên app chạy máy (DB thử trên máy lỗi lúc kiểm); thử trên bản demo sau deploy.
