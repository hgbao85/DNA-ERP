# 21/11/2026 - Đổi mã máy, bỏ tên gọi, Admin vào Máy & tem QR (FE)

## Thay đổi
- `Floor/QlsxSetup.tsx`:
  - Form "Thêm máy" bỏ ô Tên gọi.
  - Thẻ / dòng máy chỉ hiện mã, cạnh mã có bút chì "Đổi mã". Hộp "Đổi mã" (thay hộp "Sửa tên" vừa làm cùng ngày) gửi
    `updateWorkstation(id, { code })`; lỗi BE (mã trùng) hiện trong hộp.
  - Câu hỏi lại tắt máy / đổi xưởng gọi máy bằng mã.
- `Floor/workstationConfirm.ts`: `codeValue` (bỏ khoảng trắng, viết hoa, 2-32 ký tự, chỉ chữ / số / . _ -, khác mã cũ), thay
  `renameValue`.
- `Floor/qrPrint.ts`: tem bỏ dòng tên gọi.
- `Floor/scan/scanModel.ts`, `scan/MyOutputTab.tsx`: màn công nhân hiện mã máy thay tên.
- `Admin/AdminApp.tsx`: mục "Máy & tem QR" cho Admin, dùng lại màn của QLSX.
- `services/floor-api.ts`: `CreateWorkstationInput.name` không bắt buộc; `UpdateWorkstationInput.code`.
- Hướng dẫn `Guide/content/manufacturing.ts`: bỏ "Tên gọi" ở bước thêm máy, thêm đoạn đổi mã.

## Kiểm
- `workstationConfirm.test.ts` thay test `renameValue` bằng 2 ca `codeValue`.
- tsc sạch; eslint không lỗi mới (2 cảnh báo cũ ở AdminApp); vitest 77 file, 975 test đạt.
- Chưa bấm thử trên app chạy máy: DB thử trên máy đang lỗi đăng nhập.

## Deploy
- Deploy SAU BE `changelog-2026-11-21-doi-ma-may.md`.
