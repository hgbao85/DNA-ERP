// Theo dõi tiến độ đọc — tiện ích cho từng người xem, lưu trong trình duyệt của họ.
// KHÔNG phải state nghiệp vụ (không đồng bộ giữa các máy, không gửi lên server) — chỉ để
// hiện dấu "đã đọc" và gợi ý "tiếp tục đọc". Mọi thao tác bọc try/catch vì localStorage có
// thể ném lỗi (chế độ ẩn danh, site data bị chặn...).

const VISITED_KEY = 'dna-guide-visited-v1';
const LAST_KEY = 'dna-guide-last-v1';

function readVisitedSet(): Set<string> {
  try {
    const raw = window.localStorage.getItem(VISITED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function isVisited(id: string): boolean {
  try {
    return readVisitedSet().has(id);
  } catch {
    return false;
  }
}

export function markVisited(id: string): void {
  try {
    const set = readVisitedSet();
    set.add(id);
    window.localStorage.setItem(VISITED_KEY, JSON.stringify(Array.from(set)));
    window.localStorage.setItem(LAST_KEY, id);
  } catch {
    // bỏ qua — không có bộ nhớ vẫn phải xem được nội dung bình thường
  }
}

export function getLastVisited(): string | null {
  try {
    return window.localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
