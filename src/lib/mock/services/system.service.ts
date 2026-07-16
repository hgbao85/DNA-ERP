import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import type { SystemConfig } from '../../../types/admin';

export async function getSystemConfig(): Promise<SystemConfig> {
  await mockDelay();
  return structuredClone(mockStore.get().systemConfig);
}

export async function updateSystemConfig(data: Partial<SystemConfig>): Promise<SystemConfig> {
  await mockDelay();
  mockStore.update((s) => { Object.assign(s.systemConfig, data); });
  return structuredClone(mockStore.get().systemConfig);
}

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
