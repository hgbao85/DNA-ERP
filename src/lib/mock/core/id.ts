import { mockStore } from './store';

let seq: number | null = null;

/** Quét toàn bộ mock state để tìm id lớn nhất đã dùng — làm mốc khởi tạo bộ đếm. */
function findMaxId(node: unknown, max = 0): number {
  if (Array.isArray(node)) {
    for (const item of node) max = findMaxId(item, max);
  } else if (node && typeof node === 'object') {
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'id' && typeof val === 'number' && val > max) max = val;
      max = findMaxId(val, max);
    }
  }
  return max;
}

/**
 * seq được khởi tạo lười (lazy) từ dữ liệu thật trong mockStore ở lần gọi đầu
 * tiên, thay vì hardcode 1000 ngay khi module nạp. Next.js Fast Refresh có thể
 * nạp lại module này riêng lẻ giữa phiên làm việc (không kèm store.ts) — nếu
 * seq bị reset về 1000 trong khi mockStore vẫn còn id đã cấp trước đó, id mới
 * sẽ trùng id cũ (React báo "two children with the same key"). Tính lại từ
 * mockStore mỗi khi seq chưa có tránh được việc này bất kể module nào bị nạp lại.
 */
export function nextId(): number {
  if (seq === null) seq = findMaxId(mockStore.get());
  seq += 1;
  return seq;
}

export function nextCode(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, '0')}`;
}
