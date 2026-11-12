# Changelog 12/11/2026 - Màn Tối ưu cắt sắt: bỏ chờ thừa và gọi API trùng khi mở màn

## Yêu cầu
Mở màn Kế hoạch SX → Tối ưu cắt sắt trên production thấy gọi khá nhiều API và xổ ra lâu. Đo ở local (bản build production,
DB local, tài khoản KHSX): mở màn bắn 16 lượt gọi, xong lượt cuối ở 1,65 s dù mỗi API chỉ 10–120 ms. Thời gian nằm ở các bộ
hẹn giờ chờ và gọi trùng, không phải ở API.

## Nguyên nhân
- Bảng SKU (`cutting-batch-candidates`) bị chờ 400 ms ngay lần mở màn: debounce dành cho lúc KHSX gõ chiều dài cây nhưng áp
  cả lần tải đầu.
- Khối "Đợt đang chọn" (`cutting-batch-fix-options`) chờ 500 ms sau khi hệ thống TỰ tick sẵn đơn gấp, rồi lại chờ 500 ms nữa
  sau khi hệ thống tự thêm đơn gợi ý gộp - không ai đang bấm mà vẫn chờ, nối đuôi nhau.
- `cutting-recheck/pending` gọi 2 lần: menu (số đỏ) và màn tự gọi riêng.
- `me/work-queue` và `notifications/unread-count` gọi 2 lần ở MỌI màn: poll lần 1 khi có token, vài ms sau realtime chuyển
  sang "đã kết nối" làm effect chạy lại và poll ngay lần 2.

## Sửa (chỉ FE)
- `src/modules/pages/ProductionPlan/GomDotCatPage.tsx`:
  - Lần tải đầu gọi bảng ngay; debounce 400 ms chỉ còn khi đổi chiều dài cây / máy.
  - Lựa chọn do hệ thống đặt (tick sẵn lần đầu, tự thêm đơn gợi ý gộp, cập nhật sau lượt kiểm bù) → fix-options gọi ngay.
    Người bấm tay vẫn chờ 500 ms như cũ. Mốc "do hệ thống" giữ theo KHOÁ tổ hợp (`systemKey`), xoá khi gọi thật.
  - Danh sách "Lệnh vừa đổi xưởng – cần kiểm lại" nhận từ `ProductionPlanApp` qua prop `recheck`, không tự gọi nữa.
- `src/modules/pages/ProductionPlan/ProductionPlanApp.tsx`: truyền `recheck` xuống màn; mỗi lần CHUYỂN sang tab Tối ưu cắt
  sắt thì tải lại danh sách này (trước đây màn tự tải mỗi lần mở; mở thẳng vào màn thì không gọi thêm).
- `src/hooks/useWorkQueue.ts`, `src/hooks/useNotifications.ts`: effect bỏ qua lần poll tức thì nếu vừa poll cùng token dưới
  2 giây. Realtime, interval, `visibilitychange`, `refresh`, đổi token và kết nối lại sau khi rớt lâu vẫn poll như cũ.

## Kiểm tra
- `tsc` sạch; `eslint` không thêm cảnh báo (4 cảnh báo có sẵn từ trước); `vitest` 444/444.
- Đo lại bản build production ở local, cùng DB và tài khoản: 16 → 13 lượt gọi, xong lượt cuối 1,65 s → 0,32 s.
  `work-queue`, `unread-count`, `cutting-recheck/pending` còn 1 lần; bảng SKU gọi ở 0,16 s (trước 0,56 s); fix-options ở
  0,28 s (trước 1,11 s và 1,64 s). Không lỗi console.
- Hành vi giữ nguyên: vẫn tự tick đơn gấp + đơn gợi ý gộp (2 SKU); bỏ/tick lại tay thì fix-options gọi sau ~500 ms; chuyển
  sang "Lệnh sản xuất mới" rồi quay lại thì gọi lại `cutting-recheck/pending`.

## Chưa xử lý
- Trên production phần chậm chính còn ở BE: `cutting-batch-candidates` chạy bộ giải xác minh chip (tối đa 12 s) TRƯỚC khi trả
  bảng, cùng `fix-options` (tối đa 60 s) và lượt kiểm bù nền (tối đa 120 s), xếp hàng trên 1 worker. Chưa đo được ở local vì
  DB local chỉ có 2 SKU nhỏ.
- `purchase-proposals` (2 lượt: đang xử lý + lịch sử) vẫn tải ở mọi màn của các vai có quyền xem đề xuất mua, do
  `InspectionContext` dùng chung; không chặn màn này nhưng tốn băng thông.

## Bổ sung 12/11: đề xuất mua chỉ tải khi có màn cần
Đo trên production (màn Tối ưu cắt sắt không có SKU chờ gom): 2 lượt `purchase-proposals` (đang xử lý + lịch sử, ~85 KB mỗi
lượt) chậm nhất lúc mở màn (3,2 s và 3,8 s) và kéo chậm các API khác vì máy chủ xử lý dồn. `InspectionProvider` bọc cả app nên
trước đây MỌI màn của KHSX/Sếp/Mua hàng đều tải 2 lượt này ngay khi mở app, kể cả màn không dùng.
- `src/context/InspectionContext.tsx`: chỉ tải khi có màn gọi `useInspection()` lần đầu (cả 8 màn dùng hook này đều đọc
  `proposals`), rồi giữ và làm mới theo realtime như cũ; realtime trước khi có màn cần thì bỏ qua. Thêm `proposalsReady`
  (đã tải xong lần đầu, kể cả lỗi; vai không có quyền xem thì luôn true) và `requestProposals` (hook tự gọi).
- `src/modules/pages/Manufacturing/ThongKePagePlan.tsx`: bảng "Tổng hợp lệnh SX" chờ cả `proposalsReady`, để bước "Mua hàng"
  không hiện "xong" sai trong lúc đề xuất mua còn đang tải.
- Kiểm tra: `tsc` sạch, `eslint` không thêm cảnh báo, `vitest` 444/444. Trình duyệt (dev, KHSX): mở thẳng Tối ưu cắt sắt không
  còn gọi `purchase-proposals`; chuyển sang "Tổng hợp lệnh SX" thì tải đúng 1 lần, bảng hiện bước Mua hàng đúng tiến độ.
- Lưu ý: màn đầu tiên dùng đề xuất mua trong phiên giờ phải chờ thêm 1 lượt tải (trước đây đã tải sẵn lúc mở app).
