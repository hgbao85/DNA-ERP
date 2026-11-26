import { beforeEach, describe, expect, it, vi } from 'vitest';

// Thay toàn bộ core/http bằng mock — không đụng axios/mạng thật. materials-api import `http`
// từ đây nên sẽ nhận bản mock này.
vi.mock('./core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

import { http } from './core/http';
import {
  MATERIALS_CACHE_TTL_MS,
  bulkUpdateMaterialWaste,
  createMaterial,
  deleteMaterial,
  getMaterials,
  invalidateMaterialsCache,
  updateMaterial,
} from './materials-api';
import { transferBuyerMaterials } from './users-api';

const get = http.get as ReturnType<typeof vi.fn>;
const post = http.post as ReturnType<typeof vi.fn>;
const patch = http.patch as ReturnType<typeof vi.fn>;
const del = http.del as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  invalidateMaterialsCache();
});

// 26/11/2026 (lỗi 429): getMaterials() dùng chung 1 lần tải trong 30 giây thay vì mỗi màn tải lại cả danh mục.
describe('getMaterials - dùng chung 1 lần tải (giảm request, tránh 429)', () => {
  const page = (ids: number[], totalPages = 1) => ({ data: ids.map((id) => ({ id })), meta: { totalPages } });

  it('gọi cùng lúc nhiều nơi chỉ tải 1 lần; mỗi nơi nhận 1 bản sao mảng riêng', async () => {
    get.mockResolvedValue(page([1, 2]));

    const [a, b] = await Promise.all([getMaterials(), getMaterials()]);

    expect(get).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a).not.toBe(b); // sắp xếp / lọc tại chỗ ở nơi này không ảnh hưởng nơi khác
  });

  it('danh mục nhiều trang: vẫn tải đủ từng trang, và lần gọi sau trong 30 giây không tải lại', async () => {
    get.mockResolvedValueOnce(page([1], 2)).mockResolvedValueOnce(page([2], 2));

    const first = await getMaterials();
    const second = await getMaterials();

    expect(first.map((m) => m.id)).toEqual([1, 2]);
    expect(second.map((m) => m.id)).toEqual([1, 2]);
    expect(get).toHaveBeenCalledTimes(2); // 2 trang, tải đúng 1 lượt
  });

  it('quá 30 giây thì tải lại', async () => {
    vi.useFakeTimers();
    get.mockResolvedValue(page([1]));

    await getMaterials();
    vi.setSystemTime(Date.now() + MATERIALS_CACHE_TTL_MS + 1);
    await getMaterials();

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('có thao tác ghi vật tư (tạo / sửa / sửa hao hụt hàng loạt / xoá) thì lần gọi sau tải lại', async () => {
    get.mockResolvedValue(page([1]));
    post.mockResolvedValue({});
    patch.mockResolvedValue({});
    del.mockResolvedValue(undefined);

    await getMaterials();
    await createMaterial({ code: 'A', name: 'A', unit: 'cai' });
    await getMaterials();
    await updateMaterial(1, { name: 'B' });
    await getMaterials();
    await bulkUpdateMaterialWaste({ materialIds: ['1'], value: 1 });
    await getMaterials();
    await deleteMaterial(1);
    await getMaterials();

    expect(get).toHaveBeenCalledTimes(5);
  });

  it('chuyển người phụ trách mua hàng loạt vật tư thì lần gọi sau tải lại', async () => {
    get.mockResolvedValue(page([1]));
    post.mockResolvedValue({ count: 3 });

    await getMaterials();
    await transferBuyerMaterials(5, 6);
    await getMaterials();

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('tải lỗi (vd 429) thì KHÔNG nhớ lỗi: lần gọi sau tải lại được', async () => {
    get.mockRejectedValueOnce(new Error('429')).mockResolvedValueOnce(page([7]));

    await expect(getMaterials()).rejects.toThrow('429');
    const list = await getMaterials();

    expect(list.map((m) => m.id)).toEqual([7]);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

// % dự trù hao hụt khi mua (purchaseWastePercentage) hợp lệ với giá trị 0 ("không có hao hụt")
// - khác NULL/undefined ("chưa set gì"). `|| undefined` sẽ vô tình nuốt mất 0 vì nó falsy trong
// JS - đã cố ý dùng truyền thẳng thay vì `|| undefined` cho riêng field này (xem materials-api.ts).
describe('createMaterial — purchaseWastePercentage truyền thẳng kể cả 0; KHÔNG còn gửi maxCuttingWastePercentage (D.hao-hut-sat, 2026-09-30)', () => {
  it('truyền thẳng purchaseWastePercentage kể cả 0, và không gửi ngưỡng cắt theo vật tư', async () => {
    post.mockResolvedValue({});

    await createMaterial({
      code: 'SAT-01',
      name: 'Sat vuong',
      unit: 'cay',
      maxCuttingWastePercentage: 3, // Sắt không còn ngưỡng cắt riêng - phải bị bỏ khỏi payload
      purchaseWastePercentage: 0,
    });

    expect(post).toHaveBeenCalledWith(
      '/materials',
      expect.objectContaining({ purchaseWastePercentage: 0 }),
    );
    const body = (post.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect(body).not.toHaveProperty('maxCuttingWastePercentage');
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

    await updateMaterial(1, { name: 'Bao bi', purchaseWastePercentage: undefined });

    expect(patch).toHaveBeenCalledWith(
      '/materials/1',
      expect.objectContaining({ purchaseWastePercentage: null }),
    );
  });

  it('field có giá trị thật thì gửi đúng giá trị đó (không bị ép về null)', async () => {
    patch.mockResolvedValue({});

    await updateMaterial(1, { name: 'Bao bi', purchaseWastePercentage: 2.5 });

    expect(patch).toHaveBeenCalledWith(
      '/materials/1',
      expect.objectContaining({ purchaseWastePercentage: 2.5 }),
    );
  });

  it('KHÔNG gửi maxCuttingWastePercentage (Sắt không còn ngưỡng cắt riêng theo vật tư)', async () => {
    patch.mockResolvedValue({});

    await updateMaterial(1, { name: 'Sat vuong', maxCuttingWastePercentage: 2.5 });

    const body = (patch.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect(body).not.toHaveProperty('maxCuttingWastePercentage');
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

// Đính chính audit toàn diện 09/09 (Cao/H1): AdminEntityPage.tsx đã gửi đúng `null` khi Admin
// chọn "— Không —" để gỡ Nhóm vật tư/Kho/Người phụ trách mua, nhưng updateMaterial() từng dùng
// `|| undefined` - `null || undefined` luôn ra `undefined`, bị JSON.stringify xoá khỏi payload
// PATCH, BE tưởng "không gửi field" = giữ nguyên -> gỡ gán báo thành công nhưng không có tác dụng.
describe('updateMaterial — gửi null (không phải undefined) khi gỡ gán Nhóm vật tư/Kho/Người phụ trách mua (Cao/H1)', () => {
  it.each(['materialGroupId', 'warehouseId', 'buyerId'] as const)(
    'field %s = null (chọn "— Không —") -> vẫn gửi null, không bị nuốt mất',
    async (field) => {
      patch.mockResolvedValue({});

      await updateMaterial(1, { name: 'Sat vuong', [field]: null });

      expect(patch).toHaveBeenCalledWith(
        '/materials/1',
        expect.objectContaining({ [field]: null }),
      );
    },
  );

  it('field có giá trị thật (id thật) thì gửi đúng giá trị đó', async () => {
    patch.mockResolvedValue({});

    await updateMaterial(1, { name: 'Sat vuong', materialGroupId: '30', warehouseId: '5', buyerId: '7' });

    expect(patch).toHaveBeenCalledWith(
      '/materials/1',
      expect.objectContaining({ materialGroupId: '30', warehouseId: '5', buyerId: '7' }),
    );
  });
});

describe('bulkUpdateMaterialWaste', () => {
  it('gửi PATCH /materials/bulk-waste kèm nguyên payload (materialIds, value)', async () => {
    patch.mockResolvedValue({ updated: 2, skippedSteel: 0 });

    const result = await bulkUpdateMaterialWaste({ materialIds: ['1', '2'], value: 3 });

    expect(patch).toHaveBeenCalledWith('/materials/bulk-waste', { materialIds: ['1', '2'], value: 3 });
    expect(result).toEqual({ updated: 2, skippedSteel: 0 });
  });

  it('value = null (xoá % hao hụt) truyền thẳng, không bị nuốt mất', async () => {
    patch.mockResolvedValue({ updated: 5 });

    await bulkUpdateMaterialWaste({ materialGroupId: '7', value: null });

    expect(patch).toHaveBeenCalledWith('/materials/bulk-waste', { materialGroupId: '7', value: null });
  });
});
