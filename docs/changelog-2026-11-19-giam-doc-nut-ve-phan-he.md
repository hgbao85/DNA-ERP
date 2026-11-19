# 19/11/2026 - Giám đốc có nút về trang chọn phân hệ (FE)

Nguồn: đợt test toàn hệ thống 19/11 (câu Q2, người dùng chốt "có"). Không đổi BE, không đổi API.

## Thay đổi

### Giám đốc
- Màn Giám đốc có nút ô lưới ở đầu menu ("Trở về trang chọn phân hệ"); trên điện thoại nút nằm trong menu ☰. Trước đây Giám đốc không
  có đường nào về trang chọn phân hệ, chỉ vào phân hệ khác được qua thông báo hoặc gõ `?m=` trên địa chỉ.
- Trang chọn phân hệ có thẻ "Giám đốc" (Tổng hợp chờ duyệt, lệnh SX, SKU, kho) đứng đầu, chỉ Giám đốc bấm được - để từ phân hệ khác quay
  lại màn Giám đốc. Luật bấm được của các thẻ khác giữ nguyên, tách sang hàm thuần có test.
- File: `app/page.tsx`, `modules/pages/Boss/BossApp.tsx`, `components/ModuleSelector.tsx`, `components/moduleSelectorAccess.ts` (mới).

### Kho đầu vào khi Giám đốc mở (tài khoản không gắn kho)
- Bỏ 2 mục "Theo dõi nhập đan" và "Quản lý điểm đan": hai màn này chỉ vẽ được với kho thành phẩm / kho vật tư thành phẩm cụ thể, Giám đốc
  bấm vào ra trang trắng. Link cũ `?p=nhap-dan` / `?p=diem-dan` rơi về "Tổng hợp vật tư". Thủ kho có kho cụ thể không đổi gì.
- File: `modules/pages/InboundWarehouse/InboundWarehouseApp.tsx`.

### Sửa lỗi cũ: bấm nút về bị kéo lại phân hệ cũ
- Trang chính đồng bộ `m` trên địa chỉ ngược về phân hệ đang mở cả khi chính phân hệ đổi: bấm nút về (state đã về trang chọn) nhưng địa
  chỉ còn `m` cũ do `router.replace` chưa áp, nên bị mở lại phân hệ cũ. Nay chỉ nhận theo địa chỉ khi chính `m` vừa đổi (bấm thông báo,
  nút Back của trình duyệt). Lỗi có từ trước nhưng chưa lộ vì Giám đốc chưa từng đi đường này.
- File: `app/page.tsx`, `utils/urlModuleSync.ts` (mới, hàm thuần).

### Hướng dẫn trong app
- Mục Giám đốc / Tổng quan: thêm bước chuyển phân hệ bằng nút ô lưới; ghi chú Kho đầu vào của Giám đốc không có 2 mục nhập đan / điểm đan.
- File: `modules/pages/Guide/content/boss.ts`.

## Kiểm
- tsc sạch; vitest 74 file / 958 test đạt (mới: `moduleSelectorAccess.test.ts` 5, `moduleSelectorAccess.qa.test.ts` 7 - bảng 576 tổ hợp
  tài khoản x thẻ so với luật cũ, `urlModuleSync.test.ts` 5); eslint 0 lỗi (cảnh báo còn lại đều ở dòng cũ).
- Trình duyệt (bản sao dữ liệu 17/11), desktop + 375 px: Giám đốc -> trang chọn -> Kho đầu vào -> về -> Bán hàng -> về -> Giám đốc;
  điều hướng kiểu bấm thông báo (`?m=production_plan`) vẫn mở đúng phân hệ; link nhập đan / điểm đan rơi về Tổng hợp vật tư; không tràn
  ngang, không lỗi console.

## Deploy
- Chỉ FE. Không migration, không biến môi trường, không cần đăng nhập lại.
