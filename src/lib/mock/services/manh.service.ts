import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import type { ManhOrder } from '../../../types/manh';

// ─── Mảnh theo PO — PO là cấp lớn nhất, 1 PO có nhiều SKU, mỗi SKU ứng với 1 mã PI riêng. Chỉ còn
// đọc (getManhOrders) — dùng bởi VatTuDashboardPage.tsx để tra tồn theo mảnh. Xuất/nhập đan thật đã
// chuyển sang weaving-issues-api.ts (issueWeaving/receiveWeaving), thay cho xuatManh/nhapManh cũ ở
// đây (đã xoá — không còn trang nào gọi). ─────────────────────────────────────────────────────────

export const getManhOrders = async (): Promise<ManhOrder[]> => {
  await mockDelay();
  return structuredClone((mockStore.get() as any).manhOrders ?? []);
};
