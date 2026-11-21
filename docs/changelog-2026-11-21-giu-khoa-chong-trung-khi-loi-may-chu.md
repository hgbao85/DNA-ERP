# 21/11/2026 - Giữ khoá chống bấm trùng khi gặp lỗi máy chủ 5xx (FE)

## Vì sao
- Hook `useRetrySafeKey` (dùng ở màn báo sản lượng QR, Vật tư TP, báo sản lượng cũ, thông báo chung, chuyển kho tự do,
  chuyển mảnh) chỉ giữ khoá khi mất mạng (statusCode 0) hoặc BE báo "đang xử lý" (409 IdempotencyKeyInUseException).
- Proxy Render trả 502 / 503 / 504 khi BE đang khởi động lại hoặc quá giờ chờ, trong lúc BE có thể đã ghi xong. Hook bỏ
  khoá, người dùng bấm lại thì gửi khoá mới: ra lần báo / phiếu thứ hai (với chuyển kho: tồn chuyển hai lần nếu kho nhận
  xác nhận cả hai). Phát hiện khi review bản sửa chuyển kho 20/11 (F-03).

## Thay đổi
- `src/hooks/useRetrySafeKey.ts` `keepsRetryKey`: giữ khoá thêm khi lỗi máy chủ (statusCode >= 500). Lỗi 4xx (400, 403,
  404, 409 thường, 422) vẫn đổi khoá mới như cũ.
- An toàn vì BE ghi khoá chống trùng cùng transaction với thao tác: lần trước chưa ghi thì lần bấm lại chạy như mới, đã ghi
  thì BE trả lại kết quả cũ.

## Kiểm
- `src/hooks/useRetrySafeKey.test.ts`: thêm ca 500 / 502 / 503 / 504 giữ khoá, 403 / 404 đổi khoá, lõi dùng lại khoá sau 504.
- tsc sạch; eslint 2 file sạch; vitest toàn bộ 77 file, 970 test đạt.

## Chưa làm (phần của màn chuyển kho, đã báo người phụ trách)
- Chuyển kho: POST tạo phiếu thành công nhưng bước đọc lại chi tiết lỗi thì màn vẫn báo lỗi và bỏ khoá.
- Chuyển mảnh nhiều dòng dùng chung một khoá.
