import { beforeEach, describe, expect, it, vi } from 'vitest';

// Thay toàn bộ core/http bằng mock — không đụng axios/mạng thật. purchasing-api import `http`
// từ đây nên sẽ nhận bản mock này.
vi.mock('./core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  withIdempotencyKey: () => ({ headers: { 'Idempotency-Key': crypto.randomUUID() } }),
}));

import { http } from './core/http';
import type { PurchaseProposal } from '../context/InspectionContext';
import { getPurchaseProposals, bossApproveProposal, receiveProposalItem } from './purchasing-api';

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
        // BE vẫn trả `quotes` (32 báo giá cũ, tra cứu lịch sử) nhưng FE KHÔNG map nữa từ
        // 2026-08-27 - giữ trong fixture để mirror đúng response thật, không phải để assert.
        quotes: [],
        approvalFileUrl: null,
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
        warehouseCode: 'phoi-son-han',
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

  it('bỏ trống deadline (chưa có nguồn dữ liệu) - không tự bịa ngày', async () => {
    get.mockResolvedValueOnce({ data: [beProposal()] });

    const [result] = await getPurchaseProposals();

    expect(result.deadline).toBeUndefined();
  });

  // 2026-09-04: vật tư đóng gói (BomAccessoryItem kind=PACKAGING) giờ có thể mang warehouseCode là
  // kho thành phẩm PHỤ do QLSX chọn cho PI (PurchaseProposalItem.receiveWarehouseCode ở BE), không
  // còn chắc luôn là 1 trong 3 mã kho gốc như trước - phải quy về đúng gia đình 'thanh-pham' thay
  // vì rớt fallback hiện thẳng mã kỹ thuật ra UI.
  it('vật tư đóng gói với warehouseCode là kho thành phẩm PHỤ (instance, không phải 1 trong 3 kho gốc) - vẫn quy đúng về khoKey/khoLabel "Thành phẩm"', async () => {
    get.mockResolvedValueOnce({
      data: [
        beProposal({
          items: [{ ...beProposal().items[0], warehouseCode: 'thanh-pham-1788485485362' }],
        }),
      ],
    });

    const [result] = await getPurchaseProposals();

    expect(result.items[0].khoKey).toBe('thanhPham');
    expect(result.items[0].khoLabel).toBe('Kho Thành phẩm');
  });
});

describe('bossApproveProposal — Sếp duyệt ngoài hệ thống bằng file đã ký (2026-08-27)', () => {
  it('POST /purchase-proposals/:id/boss-approve kèm approvalFileUrl rồi trả về bản ghi mới nhất', async () => {
    const url = 'https://res.cloudinary.com/x/image/upload/v1/dna-erp/approvals/ky.jpg';
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal({ status: 'PURCHASING' }));

    const result = await bossApproveProposal('300', url);

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/boss-approve', {
      approvalFileUrl: url,
    });
    expect(get).toHaveBeenCalledWith('/purchase-proposals/300');
    expect(result.status).toBe('purchasing');
  });

  // BE tự lọc đúng phần vật tư của actor + nhận cả dòng kẹt ở trạng thái luồng cũ - FE KHÔNG gửi
  // danh sách itemId nào, chỉ gửi đúng file. Chốt lại bằng test để không ai thêm tham số vào body.
  it('không gửi kèm itemIds/quote nào - BE tự quyết định dòng nào được duyệt', async () => {
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(beProposal());

    await bossApproveProposal('300', 'https://x/y.pdf');

    expect(post).toHaveBeenCalledWith('/purchase-proposals/300/boss-approve', {
      approvalFileUrl: 'https://x/y.pdf',
    });
  });

  it('map approvalFileUrl của từng dòng về FE để hiện link "Xem file Sếp duyệt"', async () => {
    const url = 'https://res.cloudinary.com/x/raw/upload/v1/dna-erp/approvals/phieu.pdf';
    post.mockResolvedValueOnce(undefined);
    get.mockResolvedValueOnce(
      beProposal({
        items: [{ ...beProposal().items[0], status: 'PURCHASING', approvalFileUrl: url }],
      }),
    );

    const result = await bossApproveProposal('300', url);

    expect(result.items[0].approvalFileUrl).toBe(url);
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
