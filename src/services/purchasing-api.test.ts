import { beforeEach, describe, expect, it, vi } from 'vitest';

// Thay toàn bộ core/http bằng mock — không đụng axios/mạng thật. purchasing-api import `http`
// từ đây nên sẽ nhận bản mock này.
vi.mock('./core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  withIdempotencyKey: () => ({ headers: { 'Idempotency-Key': crypto.randomUUID() } }),
}));

import { http } from './core/http';
import type { PurchaseProposal } from '../context/InspectionContext';
import {
  getPurchaseProposals,
  acknowledgeProposal,
  submitProposalToDirector,
  approveProposal,
  rejectProposal,
  requoteProposal,
  receiveProposalItem,
} from './purchasing-api';

const get = http.get as ReturnType<typeof vi.fn>;
const post = http.post as ReturnType<typeof vi.fn>;

// BeProposal/BeItem/BeQuote tối thiểu để toProposal() chạy được - mirror đúng shape thật của
// PurchaseProposalResponseDto/PurchaseProposalItemResponseDto/PurchaseProposalQuoteResponseDto
// bên BE (src/modules/purchase-proposals/dto/purchase-proposal-response.dto.ts). Từ A5
// (2026-08-15) `items` LUÔN có sẵn trong response GET /purchase-proposals (list lẫn detail) -
// không còn 2 shape khác nhau như trước.
function beProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: '300',
    cuttingProposalId: '200',
    warehouseCode: 'phoi-son-han',
    status: 'NEW',
    poNumber: 'PO-9',
    salesOrderCode: 'PO-31',
    piCode: 'PI-2026-001',
    mfgProductCode: 'JSE-55',
    mfgProductName: 'Ghế J55',
    createdAt: '2026-08-07T00:00:00.000Z',
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    purchasedAt: null,
    items: [
      {
        id: '400',
        materialId: '30',
        materialCode: 'SAT-25',
        materialName: 'Sắt hộp 25×25',
        unit: 'cây',
        warehouseCode: 'phoi-son-han',
        actualStock: 0,
        buyQty: 8,
        receivedQty: 0,
        quotes: [],
      },
    ],
    ...overrides,
  };
}

// itemId PHẢI có (A5, 2026-08-15) - beItemIdsByMaterialId() ở purchasing-api.ts đọc thuần từ field
// này trên proposal.items, không còn gọi GET riêng để dịch materialId -> itemId nữa (xem comment
// PurchaseProposalItem.itemId, context/InspectionContext.tsx). Thiếu field này khiến mọi action
// (submit/approve/receive) coi như "không dịch được item nào" - lỗi thật đã gặp khi sửa lại file
// test này 2026-08-19.
function feProposal(overrides: Partial<PurchaseProposal> = {}): PurchaseProposal {
  return {
    id: '300',
    requestId: 'cutting-proposal-200',
    skuId: 200,
    poNumber: 'PO-9',
    salesOrderCode: 'PO-31',
    piCode: 'PI-2026-001',
    skuCode: 'JSE-55',
    skuName: 'Ghế J55',
    createdAt: '2026-08-07T00:00:00.000Z',
    warehouseScope: 'phoi-son-han',
    items: [
      {
        name: 'Sắt hộp 25×25',
        unit: 'cây',
        required: 8,
        actualStock: 0,
        buyQty: 8,
        khoKey: 'phoiSonHan',
        khoLabel: 'Kho Phôi Sơn Hàn',
        materialId: 30,
        itemId: '400',
        receivedQty: 0,
        status: 'new',
      },
    ],
    status: 'new',
    ...overrides,
  };
}

// resetAllMocks (không chỉ clearAllMocks) - clearAllMocks KHÔNG xoá queue mockResolvedValueOnce
// chưa tiêu thụ hết, khiến giá trị mock thừa của 1 test rò rỉ sang test kế tiếp và gây lỗi khó
// hiểu ở xa nơi thật sự sai (phát hiện khi sửa lại file này 2026-08-19 - toàn bộ 18/22 test cũ
// mock sai số lần gọi http.get so với hành vi thật hiện tại của purchasing-api.ts).
beforeEach(() => {
  vi.resetAllMocks();
});

describe('getPurchaseProposals — tải danh sách kèm sẵn items, không còn N+1 detail fetch (A5, D.a5-n-plus-one)', () => {
  it('gọi GET /purchase-proposals đúng 1 lần duy nhất (list đã có sẵn items, không cần fetch chi tiết riêng)', async () => {
    get.mockResolvedValueOnce({ data: [beProposal({ id: '300' }), beProposal({ id: '301' })] });

    const result = await getPurchaseProposals();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/purchase-proposals?limit=100');
    expect(result).toHaveLength(2);
  });

  it('xử lý được response trả thẳng mảng (không bọc envelope { data })', async () => {
    get.mockResolvedValueOnce([beProposal()]);

    const result = await getPurchaseProposals();

    expect(result).toHaveLength(1);
  });

  it('map đúng warehouseCode CỦA TỪNG DÒNG -> khoKey/khoLabel (không phải kho tóm tắt cấp đề xuất) và status BE (uppercase) -> FE (lowercase)', async () => {
    get.mockResolvedValueOnce({
      data: [
        beProposal({
          status: 'PURCHASING',
          // Kho tóm tắt cấp đề xuất cố tình khác kho thật của dòng vật tư, để chứng minh FE đọc
          // đúng field cấp item (Sếp chốt 2026-08-15) chứ không còn "ăn theo" giá trị này.
          warehouseCode: 'phoi-son-han',
          items: [{ ...beProposal().items[0], warehouseCode: 'vat-tu-tp' }],
        }),
      ],
    });

    const [result] = await getPurchaseProposals();

    expect(result.status).toBe('purchasing');
    expect(result.items[0].khoKey).toBe('vatTuTP');
    expect(result.items[0].khoLabel).toBe('Kho Vật tư thành phẩm');
  });

  it('mỗi dòng vật tư giữ đúng kho riêng của nó khi 1 đề xuất gồm nhiều vật tư khác kho nhau', async () => {
    get.mockResolvedValueOnce({
      data: [
        beProposal({
          items: [
            { ...beProposal().items[0], id: '400', materialId: '30', warehouseCode: 'phoi-son-han' },
            { ...beProposal().items[0], id: '401', materialId: '31', warehouseCode: 'thanh-pham' },
          ],
        }),
      ],
    });

    const [result] = await getPurchaseProposals();

    expect(result.items[0].khoLabel).toBe('Kho Phôi Sơn Hàn');
    expect(result.items[1].khoLabel).toBe('Kho Thành phẩm');
  });

  it('required = actualStock + buyQty (BE đã trừ tồn tự động - xem CuttingProposalsService.approve())', async () => {
    get.mockResolvedValueOnce({
      data: [beProposal({ items: [{ ...beProposal().items[0], actualStock: 5, buyQty: 3 }] })],
    });

    const [result] = await getPurchaseProposals();

    expect(result.items[0].actualStock).toBe(5);
    expect(result.items[0].buyQty).toBe(3);
    expect(result.items[0].required).toBe(8);
  });

  it('gộp quotes theo itemId (KHÔNG phải materialId lẫn materialName - L6 2026-08-26) và chỉ set chosenSuppliers cho quote có isChosen=true', async () => {
    get.mockResolvedValueOnce({
      data: [
        beProposal({
          items: [
            {
              ...beProposal().items[0],
              quotes: [
                { id: 'q1', supplierId: null, supplierName: 'Minh Thành', unitPrice: 45000, expectedDate: null, note: null, isChosen: false },
                { id: 'q2', supplierId: null, supplierName: 'An Phát', unitPrice: 43500, expectedDate: null, note: null, isChosen: true },
              ],
            },
          ],
        }),
      ],
    });

    const [result] = await getPurchaseProposals();

    expect(result.quotes?.['400']).toHaveLength(2);
    expect(result.chosenSuppliers?.['400']).toBe('An Phát');
  });

  it('map đúng supplierId từ BE vào từng quote (không chỉ supplierName) - D.risk1-fix', async () => {
    get.mockResolvedValueOnce({
      data: [
        beProposal({
          items: [
            {
              ...beProposal().items[0],
              quotes: [{ id: 'q1', supplierId: '55', supplierName: 'Minh Thành', unitPrice: 45000, expectedDate: null, note: null, isChosen: false }],
            },
          ],
        }),
      ],
    });

    const [result] = await getPurchaseProposals();

    expect(result.quotes?.['400']?.[0].supplierId).toBe('55');
  });

  it('2 vật tư khác nhau trùng tên hiển thị vẫn giữ được quotes riêng (D.p6-quote-key-collision — trước đây key theo materialName khiến item đứng trước bị đè mất)', async () => {
    get.mockResolvedValueOnce({
      data: [
        beProposal({
          items: [
            {
              id: '400', materialId: '30', materialCode: 'SAT-006', materialName: 'Sắt phi',
              unit: 'cây', actualStock: 0, buyQty: 8, receivedQty: 0,
              quotes: [{ id: 'q1', supplierId: null, supplierName: 'Minh Thành', unitPrice: 45000, expectedDate: null, note: null, isChosen: false }],
            },
            {
              id: '401', materialId: '31', materialCode: 'SAT-007', materialName: 'Sắt phi',
              unit: 'cây', actualStock: 0, buyQty: 4, receivedQty: 0,
              quotes: [{ id: 'q2', supplierId: null, supplierName: 'An Phát', unitPrice: 20000, expectedDate: null, note: null, isChosen: false }],
            },
          ],
        }),
      ],
    });

    const [result] = await getPurchaseProposals();

    expect(result.items).toHaveLength(2);
    expect(result.quotes?.['400']?.[0].supplierName).toBe('Minh Thành');
    expect(result.quotes?.['401']?.[0].supplierName).toBe('An Phát');
  });

  // L6 (2026-08-26): 2 DÒNG CÙNG materialId trong 1 đề xuất (vật tư đã PURCHASED phát sinh thiếu
  // thêm, xem BE CuttingProposalsService.approve() nhánh shortfall) - trường hợp mà key theo
  // materialId (dùng tới 2026-08-25) sẽ làm 1 trong 2 dòng bị đè mất quotes của dòng kia. Key theo
  // itemId (id thật, PK) không bao giờ trùng nên cả 2 dòng luôn giữ được quotes riêng.
  it('2 DÒNG CÙNG materialId (đã PURCHASED + shortfall mới) vẫn giữ được quotes riêng theo itemId', async () => {
    get.mockResolvedValueOnce({
      data: [
        beProposal({
          items: [
            {
              id: '400', materialId: '30', materialCode: 'SAT-25', materialName: 'Sắt hộp 25×25',
              unit: 'cây', actualStock: 0, buyQty: 8, receivedQty: 8, status: 'PURCHASED',
              quotes: [{ id: 'q1', supplierId: null, supplierName: 'Minh Thành', unitPrice: 45000, expectedDate: null, note: null, isChosen: true }],
            },
            {
              id: '402', materialId: '30', materialCode: 'SAT-25', materialName: 'Sắt hộp 25×25',
              unit: 'cây', actualStock: 0, buyQty: 3, receivedQty: 0, status: 'NEW',
              quotes: [],
            },
          ],
        }),
      ],
    });

    const [result] = await getPurchaseProposals();

    expect(result.items).toHaveLength(2);
    expect(result.quotes?.['400']).toHaveLength(1);
    expect(result.quotes?.['402']).toHaveLength(0);
    expect(result.chosenSuppliers?.['400']).toBe('Minh Thành');
  });

  it('bỏ trống deadline (chưa có nguồn dữ liệu) - không tự bịa ngày', async () => {
    get.mockResolvedValueOnce({ data: [beProposal()] });

    const [result] = await getPurchaseProposals();

    expect(result.deadline).toBeUndefined();
  });
});

describe('acknowledgeProposal', () => {
  it('POST /purchase-proposals/:id/acknowledge rồi trả về bản ghi mới nhất', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'QUOTING' }));

    const result = await acknowledgeProposal('300');

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/acknowledge');
    expect(result.status).toBe('quoting');
  });
});

describe('submitProposalToDirector', () => {
  it('tạo đúng báo giá cho từng vật tư (key = itemId thật, gửi thẳng KHÔNG qua dịch - L6 2026-08-26) rồi submit', async () => {
    post.mockResolvedValue(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'SUBMITTED' })); // getPurchaseProposal cuối

    const result = await submitProposalToDirector(feProposal(), {
      '400': [{ supplierName: 'Minh Thành', unitPrice: 45000 }],
    });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/items/400/quotes', {
      supplierName: 'Minh Thành',
      unitPrice: 45000,
      expectedDate: undefined,
      note: undefined,
    });
    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/submit');
    expect(result.status).toBe('submitted');
  });

  it('gửi kèm supplierId khi chọn NCC từ danh sách đã đăng ký (không chỉ supplierName) - D.risk1-fix', async () => {
    post.mockResolvedValue(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'SUBMITTED' }));

    await submitProposalToDirector(feProposal(), {
      '400': [{ supplierName: 'Minh Thành', supplierId: '55', unitPrice: 45000 }],
    });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/items/400/quotes', {
      supplierName: 'Minh Thành',
      supplierId: '55',
      unitPrice: 45000,
      expectedDate: undefined,
      note: undefined,
    });
  });

  // L6 (2026-08-26): key giờ CHÍNH LÀ itemId, gửi thẳng lên BE - KHÔNG còn bước dịch/lọc theo
  // proposal.items nữa (đã bỏ hẳn beItemIdsByMaterialId()). Caller luôn xây record này từ chính
  // item.itemId thật (xem LenhMuaNCCPage.myQuotesOf) nên không còn khái niệm "key không khớp" ở
  // tầng này - nếu ai truyền itemId không tồn tại, BE sẽ 404 rõ ràng thay vì bị FE âm thầm nuốt.
  it('gửi thẳng bất kỳ itemId nào được truyền, không lọc/dịch qua proposal.items nữa', async () => {
    post.mockResolvedValue(undefined);
    get.mockResolvedValueOnce(beProposal());

    await submitProposalToDirector(feProposal(), {
      '999': [{ supplierName: 'X', unitPrice: 1 }],
    });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/items/999/quotes', expect.objectContaining({ supplierName: 'X' }));
    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/submit');
  });

  it('2 DÒNG CÙNG materialId (đã PURCHASED + shortfall mới) vẫn gửi báo giá riêng cho từng itemId (L6, 2026-08-26)', async () => {
    const twoItemsFe = feProposal({
      items: [
        { name: 'Sắt hộp 25×25', unit: 'cây', required: 8, actualStock: 0, buyQty: 8, khoKey: 'phoiSonHan', khoLabel: 'Kho Phôi Sơn Hàn', materialId: 30, itemId: '400', receivedQty: 8, status: 'purchased' as const },
        { name: 'Sắt hộp 25×25', unit: 'cây', required: 3, actualStock: 0, buyQty: 3, khoKey: 'phoiSonHan', khoLabel: 'Kho Phôi Sơn Hàn', materialId: 30, itemId: '402', receivedQty: 0, status: 'new' as const },
      ],
    });
    post.mockResolvedValue(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'SUBMITTED' }));

    await submitProposalToDirector(twoItemsFe, {
      '402': [{ supplierName: 'An Phát', unitPrice: 20000 }],
    });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/items/402/quotes', expect.objectContaining({ supplierName: 'An Phát' }));
    // Dòng 400 (đã purchased) KHÔNG bị đụng vào dù cùng materialId 30 - trước 2026-08-26, key theo
    // materialId sẽ khiến 2 dòng này LẪN VÀO NHAU (chỉ gửi được báo giá cho 1 trong 2).
    const quoteCallsForItem400 = post.mock.calls.filter(([url]) => String(url).includes('/items/400/quotes'));
    expect(quoteCallsForItem400).toHaveLength(0);
  });

  it('2 vật tư trùng tên hiển thị vẫn gửi báo giá riêng cho cả 2 (D.p6-quote-key-collision — trước đây item đứng trước KHÔNG BAO GIỜ gửi được báo giá)', async () => {
    const twoItemsFe = feProposal({
      items: [
        { name: 'Sắt phi', unit: 'cây', required: 8, actualStock: 0, buyQty: 8, khoKey: 'phoiSonHan', khoLabel: 'Kho Phôi Sơn Hàn', materialId: 30, itemId: '400', receivedQty: 0, status: 'new' as const },
        { name: 'Sắt phi', unit: 'cây', required: 4, actualStock: 0, buyQty: 4, khoKey: 'phoiSonHan', khoLabel: 'Kho Phôi Sơn Hàn', materialId: 31, itemId: '401', receivedQty: 0, status: 'new' as const },
      ],
    });
    post.mockResolvedValue(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'SUBMITTED' }));

    await submitProposalToDirector(twoItemsFe, {
      '400': [{ supplierName: 'Minh Thành', unitPrice: 45000 }],
      '401': [{ supplierName: 'An Phát', unitPrice: 20000 }],
    });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/items/400/quotes', expect.objectContaining({ supplierName: 'Minh Thành' }));
    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/items/401/quotes', expect.objectContaining({ supplierName: 'An Phát' }));
  });
});

describe('approveProposal — gửi thẳng quoteId, KHÔNG tra lại theo tên NCC (D.h3-quote-id-not-name)', () => {
  it('key = itemId thật, gửi thẳng lên BE KHÔNG qua dịch (L6, 2026-08-26) - kèm quoteId (không tìm quote theo supplierName)', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASING' }));

    // 'q2' là quoteId đã có sẵn trong tay FE (đọc từ ProposalQuote.id lúc trước, không phải tên).
    const result = await approveProposal(feProposal(), { '400': 'q2' });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/approve', {
      chosenQuoteIdByItemId: { '400': 'q2' },
    });
    expect(result.status).toBe('purchasing');
  });

  it('vẫn chọn đúng quote dù 2 báo giá trùng tên NCC (từng là bug khi còn tra theo tên) - quoteId đi thẳng, không qua bước tra tên nào', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASING' }));

    // Sếp bấm đúng dòng q1 (không phải q2, dù cả 2 có thể trùng tên NCC "An Phát" phía UI) - id
    // phải đi thẳng tới BE, không có bước tra theo tên nào ở giữa để lỡ khớp nhầm.
    await approveProposal(feProposal(), { '400': 'q1' });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/approve', {
      chosenQuoteIdByItemId: { '400': 'q1' },
    });
  });

  // L6 (2026-08-26): không còn bước dịch/lọc theo proposal.items nữa (đã bỏ hẳn
  // beItemIdsByMaterialId()) - key truyền vào ĐI THẲNG làm chosenQuoteIdByItemId, y nguyên.
  it('gửi thẳng bất kỳ itemId nào được truyền, không lọc/dịch qua proposal.items nữa', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal());

    await approveProposal(feProposal(), { '999': 'q1' });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/approve', {
      chosenQuoteIdByItemId: { '999': 'q1' },
    });
  });

  it('2 DÒNG CÙNG materialId (đã PURCHASED + shortfall mới) vẫn duyệt đúng quote riêng cho từng itemId (L6, 2026-08-26)', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASING' }));

    // Chỉ duyệt quote cho dòng shortfall (402) - dòng 400 (cùng materialId, đã purchased) không
    // được đụng tới. Trước 2026-08-26, key theo materialId sẽ khiến 2 dòng này LẪN VÀO NHAU.
    await approveProposal(feProposal(), { '402': 'q3' });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/approve', {
      chosenQuoteIdByItemId: { '402': 'q3' },
    });
  });

  it('2 vật tư trùng tên hiển thị vẫn duyệt đúng quote riêng cho cả 2 (D.p6-quote-key-collision)', async () => {
    const twoItemsFe = feProposal({
      items: [
        { name: 'Sắt phi', unit: 'cây', required: 8, actualStock: 0, buyQty: 8, khoKey: 'phoiSonHan', khoLabel: 'Kho Phôi Sơn Hàn', materialId: 30, itemId: '400', receivedQty: 0, status: 'new' as const },
        { name: 'Sắt phi', unit: 'cây', required: 4, actualStock: 0, buyQty: 4, khoKey: 'phoiSonHan', khoLabel: 'Kho Phôi Sơn Hàn', materialId: 31, itemId: '401', receivedQty: 0, status: 'new' as const },
      ],
    });
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASING' }));

    await approveProposal(twoItemsFe, { '400': 'q1', '401': 'q2' });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/approve', {
      chosenQuoteIdByItemId: { '400': 'q1', '401': 'q2' },
    });
  });
});

describe('rejectProposal / requoteProposal', () => {
  it('rejectProposal gửi đúng rejectionReason', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'REJECTED', rejectionReason: 'Giá quá cao' }));

    const result = await rejectProposal('300', 'Giá quá cao');

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/reject', {
      rejectionReason: 'Giá quá cao',
    });
    expect(result.status).toBe('rejected');
  });

  it('requoteProposal không cần body', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'QUOTING' }));

    const result = await requoteProposal('300');

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/requote');
    expect(result.status).toBe('quoting');
  });
});

describe('receiveProposalItem', () => {
  it('nhận itemId thật, POST receive trực tiếp KHÔNG qua dịch (L6, 2026-08-26) với đúng receivedQty kèm header Idempotency-Key', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASED' }));

    const result = await receiveProposalItem(feProposal(), '400', 8);

    expect(post).toHaveBeenCalledWith(
      '/purchase-proposals/300/items/400/receive',
      { receivedQty: 8 },
      { headers: { 'Idempotency-Key': expect.any(String) as string } },
    );
    expect(result.status).toBe('purchased');
  });

  // L6 (2026-08-26): 2 DÒNG CÙNG materialId (đã PURCHASED + shortfall mới) - trước đây tra theo
  // materialId sẽ luôn khớp NHẦM vào dòng ĐẦU TIÊN trong proposal.items, khiến thủ kho không thể
  // nào xác nhận nhận hàng riêng cho dòng shortfall. itemId thật không có ca này.
  it('2 DÒNG CÙNG materialId - vẫn nhận đúng dòng shortfall (itemId khác), không lẫn sang dòng đã purchased', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASING' }));

    await receiveProposalItem(feProposal(), '402', 3);

    expect(post).toHaveBeenCalledWith(
      '/purchase-proposals/300/items/402/receive',
      { receivedQty: 3 },
      expect.anything(),
    );
  });
});
