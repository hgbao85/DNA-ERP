import { beforeEach, describe, expect, it, vi } from 'vitest';

// Thay toàn bộ core/http bằng mock — không đụng axios/mạng thật. materials-api import `http`
// từ đây nên sẽ nhận bản mock này.
vi.mock('./core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

import { http } from './core/http';
import { createMaterial, updateMaterial } from './materials-api';

const post = http.post as ReturnType<typeof vi.fn>;
const patch = http.patch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// % dự trù hao hụt khi mua (purchaseWastePercentage) hợp lệ với giá trị 0 ("không có hao hụt")
// - khác NULL/undefined ("chưa set gì"). `|| undefined` sẽ vô tình nuốt mất 0 vì nó falsy trong
// JS - đã cố ý dùng truyền thẳng thay vì `|| undefined` cho riêng field này (xem materials-api.ts).
describe('createMaterial — gửi đủ 2 field hao hụt, kể cả khi giá trị là 0 (D.hao-hut-sat)', () => {
  it('truyền thẳng maxCuttingWastePercentage/purchaseWastePercentage kể cả 0', async () => {
    post.mockResolvedValue({});

    await createMaterial({
      code: 'SAT-01',
      name: 'Sat vuong',
      unit: 'cay',
      maxCuttingWastePercentage: 0,
      purchaseWastePercentage: 0,
    });

    expect(post).toHaveBeenCalledWith(
      '/materials',
      expect.objectContaining({
        maxCuttingWastePercentage: 0,
        purchaseWastePercentage: 0,
      }),
    );
  });

  it('không gửi field nào thì để undefined (Prisma dùng default khi tạo mới)', async () => {
    post.mockResolvedValue({});

    await createMaterial({ code: 'SAT-01', name: 'Sat vuong', unit: 'cay' });

    const body = (post.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect(body.maxCuttingWastePercentage).toBeUndefined();
    expect(body.purchaseWastePercentage).toBeUndefined();
  });
});

// Bug thật đã tìm ra khi review: input số trả về `undefined` khi bị xoá trắng
// (AdminEntityPage.tsx) - undefined bị JSON.stringify bỏ khỏi payload PATCH, khiến BE không đụng
// cột (tưởng "không gửi field" = giữ nguyên) dù người dùng vừa xoá trắng để xin về mặc định.
// updateMaterial() PHẢI ép undefined -> null để gửi đúng ý định "xoá field".
describe('updateMaterial — gửi null (không phải undefined) khi field bị xoá trắng (D.hao-hut-sat)', () => {
  it('field undefined (đã xoá trắng) -> gửi null, không bị JSON.stringify nuốt mất', async () => {
    patch.mockResolvedValue({});

    await updateMaterial(1, { name: 'Sat vuong', maxCuttingWastePercentage: undefined });

    expect(patch).toHaveBeenCalledWith(
      '/materials/1',
      expect.objectContaining({ maxCuttingWastePercentage: null }),
    );
  });

  it('field có giá trị thật thì gửi đúng giá trị đó (không bị ép về null)', async () => {
    patch.mockResolvedValue({});

    await updateMaterial(1, { name: 'Sat vuong', maxCuttingWastePercentage: 2.5 });

    expect(patch).toHaveBeenCalledWith(
      '/materials/1',
      expect.objectContaining({ maxCuttingWastePercentage: 2.5 }),
    );
  });

  it('giá trị 0 không bị coi là "xoá trắng" - vẫn gửi đúng 0', async () => {
    patch.mockResolvedValue({});

    await updateMaterial(1, { name: 'Bao bi', purchaseWastePercentage: 0 });

    expect(patch).toHaveBeenCalledWith(
      '/materials/1',
      expect.objectContaining({ purchaseWastePercentage: 0 }),
    );
  });
});
