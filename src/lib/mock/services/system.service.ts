import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';

export interface SystemStats {
  collectionCounts: { key: string; count: number }[];
  storageBytes: number;
}

/** Số bản ghi mỗi collection + dung lượng localStorage ước tính — chỉ để tham khảo, không phải log lỗi thật. */
export async function getSystemStats(): Promise<SystemStats> {
  await mockDelay();
  const state = mockStore.get();
  const collectionCounts = Object.entries(state)
    .filter(([, v]) => Array.isArray(v))
    .map(([key, v]) => ({ key, count: (v as unknown[]).length }))
    .sort((a, b) => b.count - a.count);
  const storageBytes = new Blob([JSON.stringify(state)]).size;
  return { collectionCounts, storageBytes };
}

/** Xóa toàn bộ dữ liệu demo trong localStorage và seed lại từ đầu. */
export async function resetSystemData(): Promise<void> {
  await mockDelay();
  mockStore.reset();
}
