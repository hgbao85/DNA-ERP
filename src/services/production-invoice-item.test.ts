import { beforeEach, describe, expect, it, vi } from 'vitest';

// 2026-10-12: các trang kho (Chuyền kiểm/Đóng gói/Xuất-Nhập đan/Xuất vật tư TP-hàn-sơn) chuyển từ
// "mỗi Sku 1 dòng" sang "mỗi LỆNH SẢN XUẤT 1 dòng". Bug gốc: Sku danh mục không gắn PI nên tra theo
// mfgProductId luôn ra lệnh ĐẦU TIÊN - 1 sản phẩm có 2 PI thì lệnh còn lại không bao giờ vào được.
// Test phủ đúng ca đó (dữ liệu mô phỏng PI-2026-007/008 cùng sản phẩm 79 trên DB dev).
vi.mock('./core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

import { http } from './core/http';
import type { Sku } from '../types/sku';
import {
  buildProductionOrderInfoByMfgProduct,
  expandSkusByProductionOrder,
  lookupProductionOrderInfo,
  productionOrderRowKey,
  resolveProductionInvoiceRef,
  resolveProductionOrderId,
  type BeProductionOrderRaw,
} from './production-invoice-item';

const get = http.get as ReturnType<typeof vi.fn>;

function order(overrides: Partial<BeProductionOrderRaw>): BeProductionOrderRaw {
  return {
    id: '13',
    mfgProductId: '79',
    quantity: 3,
    salesOrderCode: null,
    productionInvoiceId: '13',
    productionInvoiceItemId: '113',
    piCode: 'PI-2026-008',
    deliveryDeadline: null,
    floorStage: 'PENDING',
    warehouseCode: 'thanh-pham',
    bomOutOfDate: false,
    ...overrides,
  };
}

function sku(overrides: Partial<Sku>): Sku {
  return { id: '91', mfgProductId: '79', status: 'APPROVED', piCode: '', exportOrderId: null, ...overrides } as Sku;
}

// Thứ tự BE trả: mới nhất trước - PI-008 (chưa chạy) đứng TRƯỚC PI-007 (đang chạy), đúng ca gây bug.
const PI_008 = order({});
const PI_007 = order({ id: '12', productionInvoiceId: '12', productionInvoiceItemId: '112', piCode: 'PI-2026-007', quantity: 80, floorStage: 'ACTIVE' });
const OTHER_PRODUCT = order({ id: '6', mfgProductId: '75', productionInvoiceId: '6', productionInvoiceItemId: '106', piCode: 'PI-2026-001', floorStage: 'FINISHED' });

describe('expandSkusByProductionOrder', () => {
  it('tách 1 Sku danh mục thành mỗi lệnh sản xuất 1 dòng, mang đúng id lệnh của nó', () => {
    const rows = expandSkusByProductionOrder([sku({})], [PI_008, PI_007]);

    expect(rows.map((r) => [r.piCode, r.productionOrderId, r.productionInvoiceId, r.productionInvoiceItemId])).toEqual([
      ['PI-2026-008', '13', '13', '113'],
      ['PI-2026-007', '12', '12', '112'],
    ]);
    // Vẫn là cùng 1 Sku gốc (id/sản phẩm không đổi) - chỉ thêm thông tin lệnh.
    expect(rows.every((r) => r.id === '91' && r.mfgProductId === '79')).toBe(true);
  });

  it('bỏ qua lệnh mà sản phẩm không có Sku nào, và Sku không có lệnh nào thì không sinh dòng', () => {
    const rows = expandSkusByProductionOrder([sku({}), sku({ id: '85', mfgProductId: '73' })], [PI_007, OTHER_PRODUCT]);

    expect(rows.map((r) => r.piCode)).toEqual(['PI-2026-007']);
  });

  it('nhiều Sku cùng sản phẩm: ưu tiên bản đã gắn đúng PI, rồi tới bản đã duyệt', () => {
    const draft = sku({ id: '70', status: 'IN_PROGRESS' as Sku['status'] });
    const approved = sku({ id: '91' });
    const bound = sku({ id: '95', status: 'IN_PROGRESS' as Sku['status'], productionInvoiceId: '12' });

    expect(expandSkusByProductionOrder([draft, approved], [PI_008])[0].id).toBe('91');
    expect(expandSkusByProductionOrder([draft, approved, bound], [PI_007])[0].id).toBe('95');
  });

  it('1 PI gộp chứa 2 lệnh CÙNG sản phẩm vẫn ra 2 dòng riêng', () => {
    const second = order({ id: '14', productionInvoiceItemId: '114' });
    const rows = expandSkusByProductionOrder([sku({})], [PI_008, second]);

    expect(rows.map((r) => r.productionOrderId)).toEqual(['13', '14']);
    expect(new Set(rows.map(productionOrderRowKey)).size).toBe(2);
  });
});

describe('productionOrderRowKey', () => {
  it('khoá theo lệnh khi có, không thì theo Sku', () => {
    expect(productionOrderRowKey(sku({ productionOrderId: '12' }))).toBe('order:12');
    expect(productionOrderRowKey(sku({}))).toBe('sku:91');
    expect(productionOrderRowKey(null)).toBe('');
  });
});

describe('tra lệnh sản xuất cho 1 dòng', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('lookupProductionOrderInfo: dòng theo lệnh ra đúng lệnh của nó, Sku trần vẫn rơi về lệnh đầu tiên như cũ', async () => {
    get.mockResolvedValueOnce([PI_008, PI_007]);
    const map = await buildProductionOrderInfoByMfgProduct();
    const [row008, row007] = expandSkusByProductionOrder([sku({})], [PI_008, PI_007]);

    expect(lookupProductionOrderInfo(map, row007)).toMatchObject({ piCode: 'PI-2026-007', floorStage: 'ACTIVE' });
    expect(lookupProductionOrderInfo(map, row008)).toMatchObject({ piCode: 'PI-2026-008', floorStage: 'PENDING' });
    expect(lookupProductionOrderInfo(map, sku({}))).toMatchObject({ piCode: 'PI-2026-008' });
  });

  it('resolveProductionInvoiceRef / resolveProductionOrderId: dùng thẳng id trên dòng, không gọi API dò lại', async () => {
    const [, row007] = expandSkusByProductionOrder([sku({})], [PI_008, PI_007]);

    await expect(resolveProductionInvoiceRef(row007)).resolves.toEqual({ productionInvoiceId: '12', itemId: '112' });
    await expect(resolveProductionOrderId(row007)).resolves.toBe('12');
    expect(get).not.toHaveBeenCalled();
  });
});
