import { beforeEach, describe, expect, it, vi } from 'vitest';

// Thay toàn bộ core/http bằng mock — không đụng axios/mạng thật. purchasing-api import `http`
// từ đây nên sẽ nhận bản mock này.
vi.mock('./core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
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
// bên BE (src/modules/purchase-proposals/dto/purchase-proposal-response.dto.ts).
function beProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: '300',
    cuttingProposalId: '200',
    warehouseCode: 'phoi-son-han',
    status: 'NEW',
    poNumber: 'PO-9',
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
        actualStock: 0,
        buyQty: 8,
        receivedQty: 0,
        quotes: [],
      },
    ],
    ...overrides,
  };
}

function feProposal(overrides: Partial<PurchaseProposal> = {}): PurchaseProposal {
  return {
    id: '300',
    requestId: 'cutting-proposal-200',
    skuId: 200,
    poNumber: 'PO-9',
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
        receivedQty: 0,
      },
    ],
    status: 'new',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPurchaseProposals — tải danh sách + chi tiết từng đề xuất', () => {
  it('gọi GET /purchase-proposals rồi fetch chi tiết từng bản ghi (list không kèm items)', async () => {
    get.mockResolvedValueOnce({ data: [{ id: '300' }, { id: '301' }] });
    get.mockResolvedValueOnce(beProposal({ id: '300' }));
    get.mockResolvedValueOnce(beProposal({ id: '301' }));

    const result = await getPurchaseProposals();

    expect(get).toHaveBeenNthCalledWith(1, '/purchase-proposals?limit=100');
    expect(get).toHaveBeenNthCalledWith(2, '/purchase-proposals/300');
    expect(get).toHaveBeenNthCalledWith(3, '/purchase-proposals/301');
    expect(result).toHaveLength(2);
  });

  it('xử lý được response trả thẳng mảng (không bọc envelope { data })', async () => {
    get.mockResolvedValueOnce([{ id: '300' }]);
    get.mockResolvedValueOnce(beProposal());

    const result = await getPurchaseProposals();

    expect(result).toHaveLength(1);
  });

  it('map đúng warehouseCode -> khoKey/khoLabel và status BE (uppercase) -> FE (lowercase)', async () => {
    get.mockResolvedValueOnce({ data: [{ id: '300' }] });
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASING', warehouseCode: 'vat-tu-tp' }));

    const [result] = await getPurchaseProposals();

    expect(result.status).toBe('purchasing');
    expect(result.warehouseScope).toBe('vat-tu-tp');
    expect(result.items[0].khoKey).toBe('vatTuTP');
    expect(result.items[0].khoLabel).toBe('Kho Vật tư thành phẩm');
  });

  it('required = actualStock + buyQty (BE đã trừ tồn tự động - xem CuttingProposalsService.approve())', async () => {
    get.mockResolvedValueOnce({ data: [{ id: '300' }] });
    get.mockResolvedValueOnce(
      beProposal({
        items: [{ ...beProposal().items[0], actualStock: 5, buyQty: 3 }],
      }),
    );

    const [result] = await getPurchaseProposals();

    expect(result.items[0].actualStock).toBe(5);
    expect(result.items[0].buyQty).toBe(3);
    expect(result.items[0].required).toBe(8);
  });

  it('gộp quotes theo materialName và chỉ set chosenSuppliers cho quote có isChosen=true', async () => {
    get.mockResolvedValueOnce({ data: [{ id: '300' }] });
    get.mockResolvedValueOnce(
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
    );

    const [result] = await getPurchaseProposals();

    expect(result.quotes?.['Sắt hộp 25×25']).toHaveLength(2);
    expect(result.chosenSuppliers?.['Sắt hộp 25×25']).toBe('An Phát');
  });

  it('map đúng supplierId từ BE vào từng quote (không chỉ supplierName) - D.risk1-fix', async () => {
    get.mockResolvedValueOnce({ data: [{ id: '300' }] });
    get.mockResolvedValueOnce(
      beProposal({
        items: [
          {
            ...beProposal().items[0],
            quotes: [
              { id: 'q1', supplierId: '55', supplierName: 'Minh Thành', unitPrice: 45000, expectedDate: null, note: null, isChosen: false },
            ],
          },
        ],
      }),
    );

    const [result] = await getPurchaseProposals();

    expect(result.quotes?.['Sắt hộp 25×25']?.[0].supplierId).toBe('55');
  });

  it('bỏ trống deadline (chưa có nguồn dữ liệu) - không tự bịa ngày', async () => {
    get.mockResolvedValueOnce({ data: [{ id: '300' }] });
    get.mockResolvedValueOnce(beProposal());

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
  it('tạo đúng báo giá cho từng vật tư (tra itemId theo tên) rồi submit', async () => {
    get.mockResolvedValueOnce(beProposal()); // getBeItemIdsByName
    post.mockResolvedValue(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'SUBMITTED' })); // getPurchaseProposal cuối

    const result = await submitProposalToDirector(feProposal(), {
      'Sắt hộp 25×25': [{ supplierName: 'Minh Thành', unitPrice: 45000 }],
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
    get.mockResolvedValueOnce(beProposal());
    post.mockResolvedValue(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'SUBMITTED' }));

    await submitProposalToDirector(feProposal(), {
      'Sắt hộp 25×25': [{ supplierName: 'Minh Thành', supplierId: '55', unitPrice: 45000 }],
    });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/items/400/quotes', {
      supplierName: 'Minh Thành',
      supplierId: '55',
      unitPrice: 45000,
      expectedDate: undefined,
      note: undefined,
    });
  });

  it('bỏ qua tên vật tư không khớp item nào của proposal (không gọi API sai)', async () => {
    get.mockResolvedValueOnce(beProposal());
    post.mockResolvedValue(undefined);
    get.mockResolvedValueOnce(beProposal());

    await submitProposalToDirector(feProposal(), {
      'Vật tư không tồn tại': [{ supplierName: 'X', unitPrice: 1 }],
    });

    const quoteCalls = post.mock.calls.filter(([url]) => String(url).includes('/quotes'));
    expect(quoteCalls).toHaveLength(0);
    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/submit');
  });
});

describe('approveProposal — gửi thẳng quoteId, KHÔNG tra lại theo tên NCC (D.h3-quote-id-not-name)', () => {
  it('dịch item.name -> BE itemId rồi gửi thẳng quoteId đã nhận (không tìm quote theo supplierName)', async () => {
    get.mockResolvedValueOnce(beProposal());
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASING' }));

    // 'q2' là quoteId đã có sẵn trong tay FE (đọc từ ProposalQuote.id lúc trước, không phải tên).
    const result = await approveProposal(feProposal(), { 'Sắt hộp 25×25': 'q2' });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/approve', {
      chosenQuoteIdByItemId: { '400': 'q2' },
    });
    expect(result.status).toBe('purchasing');
  });

  it('vẫn chọn đúng quote dù 2 báo giá trùng tên NCC (từng là bug khi còn tra theo tên)', async () => {
    get.mockResolvedValueOnce(
      beProposal({
        items: [
          {
            ...beProposal().items[0],
            quotes: [
              { id: 'q1', supplierId: null, supplierName: 'An Phát', unitPrice: 45000, expectedDate: null, note: null, isChosen: false },
              { id: 'q2', supplierId: null, supplierName: 'An Phát', unitPrice: 43500, expectedDate: null, note: null, isChosen: false },
            ],
          },
        ],
      }),
    );
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASING' }));

    // Sếp bấm đúng dòng q1 (giá 45000, không phải giá rẻ nhất) - id phải đi thẳng, không bị tra
    // theo tên "An Phát" rồi lỡ khớp sang q2.
    await approveProposal(feProposal(), { 'Sắt hộp 25×25': 'q1' });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/approve', {
      chosenQuoteIdByItemId: { '400': 'q1' },
    });
  });

  it('bỏ qua item không dịch được sang BE itemId (tên vật tư không khớp)', async () => {
    get.mockResolvedValueOnce(beProposal());
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal());

    await approveProposal(feProposal(), { 'Vật tư không tồn tại': 'q1' });

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/approve', {
      chosenQuoteIdByItemId: {},
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

    expect(result.status).toBe('quoting');
  });
});

describe('receiveProposalItem', () => {
  it('tra itemId theo tên rồi POST receive với đúng receivedQty kèm header Idempotency-Key', async () => {
    get.mockResolvedValueOnce(beProposal());
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASED' }));

    const result = await receiveProposalItem(feProposal(), 'Sắt hộp 25×25', 8);

    expect(post).toHaveBeenCalledWith(
      '/purchase-proposals/300/items/400/receive',
      { receivedQty: 8 },
      { headers: { 'Idempotency-Key': expect.any(String) as string } },
    );
    expect(result.status).toBe('purchased');
  });

  it('ném lỗi rõ ràng khi không tìm thấy vật tư theo tên (không gọi POST)', async () => {
    get.mockResolvedValueOnce(beProposal());

    await expect(
      receiveProposalItem(feProposal(), 'Vật tư không tồn tại', 1),
    ).rejects.toThrow(/Không tìm thấy vật tư/);
    expect(post).not.toHaveBeenCalled();
  });
});
