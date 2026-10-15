/**
 * UUID v4 dùng cho Idempotency-Key / correlation id.
 *
 * `crypto.randomUUID()` CHỈ có ở "secure context" (HTTPS hoặc localhost). Điện thoại công nhân mở app qua
 * http://<IP máy chủ> (chạy thử qua Wi-Fi nội bộ, hoặc xưởng cài bản chạy trong mạng LAN không có HTTPS) thì
 * hàm này là undefined -> gọi thẳng sẽ ném TypeError trước khi request được gửi, nút "Lưu" báo lỗi chung
 * (2026-10-15, bước 0 thử trên điện thoại thật). `crypto.getRandomValues` thì có ở mọi ngữ cảnh nên dùng làm
 * phương án dự phòng; không bao giờ gọi `crypto.randomUUID()` trực tiếp ở nơi khác.
 */
export function newUuid(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
