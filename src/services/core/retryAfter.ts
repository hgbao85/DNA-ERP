/**
 * Tự thử lại lời gọi GET bị 429 "Thao tác quá nhanh" (26/11/2026). BE (ThrottlerGuard) gửi header `Retry-After` = số giây còn phải
 * chờ; BE phải cho phép trình duyệt đọc header này (CORS `exposedHeaders`). Chỉ thử lại khi BIẾT thời gian chờ và đó là tối đa 9 giây
 * (làm tròn lên + 250 ms <= 10 s); không biết hoặc phải chờ lâu thì KHÔNG đoán mò - báo lỗi để người dùng bấm "Thử lại" sau.
 * Lưu ý: vượt trần thì BE khoá trọn 60 giây (blockDuration mặc định = ttl), nên lần chặn đầu thường báo 60 -> không tự thử lại; hàm
 * này chỉ là lưới an toàn cho lần gọi rơi vào vài giây cuối của lần khoá.
 */
export const MAX_AUTO_RETRY_429 = 2;
export const MAX_AUTO_WAIT_MS = 10_000;

/** Số mili-giây chờ rồi thử lại, hoặc null = không tự thử lại. `attempt` = số lần đã tự thử lại trước đó. */
export function retryDelayFor429(retryAfter: unknown, attempt: number): number | null {
  if (attempt >= MAX_AUTO_RETRY_429) return null;
  const raw = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
  const sec = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(sec) || sec <= 0) return null;
  const ms = Math.ceil(sec) * 1000 + 250; // +250ms dự phòng lệch đồng hồ
  return ms <= MAX_AUTO_WAIT_MS ? ms : null;
}
