/**
 * Adapter PURCHASING: FE ⇄ BE thật (module `purchase-proposals`, Phase 8 - Mua hàng, rút gọn).
 *
 * Rút gọn (2026-08-07): PurchaseProposal giờ tự sinh thẳng từ CuttingProposal đã duyệt (chỉ vật
 * tư sắt) - KHÔNG còn đi qua InspectionRequest/Sku/đơn hàng khách như mock cũ. Hệ quả khi map
 * ngược về đúng type `PurchaseProposal` (context/InspectionContext.tsx) để không phải sửa UI:
 *   - `poNumber` là mã lệnh sản xuất NỘI BỘ (BE ProductionOrder.poNumber, vd "PO-9"), KHÔNG phải
 *     mã đơn hàng khách như mock cũ ("PO-MY-001").
 *   - `requestId`/`skuId` không có ý nghĩa thật nữa (không còn InspectionRequest) - đặt giá trị
 *     placeholder ổn định, các màn Mua hàng không đọc 2 field này.
 *   - `deadline` chưa có nguồn dữ liệu - luôn `undefined` (field vốn optional).
 *   - `actualStock` là tồn thật (kho phoi-son-han) đã được BE trừ tự động lúc tạo đề xuất (Sếp
 *     quyết định 2026-08-07: "trừ tồn tự động, hiện qua mua hàng, không hiện ở kho") - `buyQty`
 *     giờ chỉ còn là phần THIẾU cần mua, nên `required` (tổng nhu cầu) = actualStock + buyQty.
 *
 * BE dùng id dạng bigint-as-string - giữ nguyên string, không ép Number(). `skuId` là placeholder
 * (xem trên) nên ép vô hại; nhưng `materialId` KHÔNG được ép Number() - dùng nguyên giá trị string
 * dưới lớp áo type `number` (cast `as unknown as number`, giống `materials-api.ts`/`users-mapper.ts`)
 * vì nó phải khớp key với `Material.id` (cũng string-giả-number) khi tra `buyerByMaterialId` ở
 * `utils/purchasingRouting.ts` - ép Number() làm lệch kiểu key, khiến lọc theo buyer luôn thất bại
 * (đã xảy ra thật, sửa 2026-08-08).
 *
 * `quotes` của type cũ key theo String(item.materialId) (KHÔNG phải item.name — sửa 2026-08-13,
 * D.p6-quote-key-collision: 2 vật tư khác nhau có thể trùng tên hiển thị, vd nhiều loại "Sắt phi"
 * khác đường kính; dùng tên làm key qua `new Map(items.map(it => [it.materialName, it.id]))` khiến
 * item đứng trước bị item trùng tên đứng sau ghi đè mất trong map, nên KHÔNG BAO GIỜ gửi báo giá
 * được cho item đó dù UI trông bình thường - phát hiện qua e2e/golden-path.spec.ts khi đề xuất cắt
 * sắt chứa 2 vật tư SAT-006/SAT-007 cùng tên "Sắt phi"). materialId thật ổn định + duy nhất trong
 * 1 đề xuất (BE dùng itemId thật) - các hàm action bên dưới nhận kèm `proposal` (đã có sẵn trong
 * state) để tự tra ngược itemId theo materialId trước khi gọi API. Riêng quoteId (báo giá nào
 * được chọn) KHÔNG tra theo tên NCC nữa (từng làm vậy, đã bỏ - xem approveProposal()) -
 * ProposalQuote nay mang sẵn `id` thật từ lúc đọc về, Sếp chọn thì gửi thẳng id đó, tránh khớp
 * nhầm khi trùng tên NCC hoặc còn báo giá cũ chưa dọn sau 1 vòng "Báo giá lại".
 */
import { http, withIdempotencyKey } from './core/http';
import type {
  KhoKey,
  ProposalQuote,
  PurchaseProposal,
  PurchaseProposalItem,
} from '../context/InspectionContext';

const WAREHOUSE_SCOPE_TO_KHO_KEY: Record<string, KhoKey> = {
  'phoi-son-han': 'phoiSonHan',
  'vat-tu-tp': 'vatTuTP',
  'thanh-pham': 'thanhPham',
};

const KHO_LABELS: Record<string, string> = {
  'phoi-son-han': 'Kho Phôi Sơn Hàn',
  'vat-tu-tp': 'Kho Vật tư thành phẩm',
  'thanh-pham': 'Kho Thành phẩm',
};

const BE_TO_FE_STATUS: Record<string, PurchaseProposal['status']> = {
  NEW: 'new',
  QUOTING: 'quoting',
  SUBMITTED: 'submitted',
  PURCHASING: 'purchasing',
  PURCHASED: 'purchased',
  REJECTED: 'rejected',
};

interface BeQuote {
  id: string;
  supplierId: string | null;
  supplierName: string;
  unitPrice: number | null;
  expectedDate: string | null;
  note: string | null;
  isChosen: boolean;
}

interface BeItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  purchaseUnit: string | null;
  khoUnitFactor: number | null;
  actualStock: number;
  buyQty: number;
  receivedQty: number;
  receivedQtyPurchaseUnit: number | null;
  quotes: BeQuote[];
}

interface BeProposal {
  id: string;
  cuttingProposalId: string | null;
  warehouseCode: string;
  status: keyof typeof BE_TO_FE_STATUS;
  poNumber: string;
  mfgProductCode: string;
  mfgProductName: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  purchasedAt: string | null;
  items?: BeItem[];
}

function toItem(item: BeItem, khoKey: KhoKey, warehouseCode: string): PurchaseProposalItem {
  return {
    name: item.materialName,
    unit: item.unit,
    purchaseUnit: item.purchaseUnit,
    khoUnitFactor: item.khoUnitFactor,
    required: item.actualStock + item.buyQty,
    actualStock: item.actualStock,
    buyQty: item.buyQty,
    khoKey,
    khoLabel: KHO_LABELS[warehouseCode] ?? warehouseCode,
    // BE dùng bigint-as-string; PurchaseProposalItem.materialId là number (quy ước cũ) - cast
    // để tương thích, KHÔNG Number() (mất khớp key với buildBuyerByMaterialId ở purchasingRouting.ts,
    // vốn cũng giữ nguyên Material.id string dưới lớp áo type number - xem materials-api.ts).
    materialId: item.materialId as unknown as number,
    receivedQty: item.receivedQty,
    receivedQtyPurchaseUnit: item.receivedQtyPurchaseUnit,
  };
}

function toProposal(be: BeProposal): PurchaseProposal {
  const khoKey = WAREHOUSE_SCOPE_TO_KHO_KEY[be.warehouseCode] ?? (be.warehouseCode as KhoKey);
  const items = (be.items ?? []).map((it) => toItem(it, khoKey, be.warehouseCode));

  const quotes: Record<string, ProposalQuote[]> = {};
  const chosenSuppliers: Record<string, string> = {};
  for (const it of be.items ?? []) {
    const key = it.materialId;
    quotes[key] = it.quotes.map((q) => ({
      id: q.id,
      supplierName: q.supplierName,
      supplierId: q.supplierId ?? undefined,
      unitPrice: q.unitPrice,
      expectedDate: q.expectedDate ?? undefined,
      note: q.note ?? undefined,
    }));
    const chosen = it.quotes.find((q) => q.isChosen);
    if (chosen) chosenSuppliers[key] = chosen.supplierName;
  }

  return {
    id: be.id,
    requestId: `cutting-proposal-${be.cuttingProposalId}`,
    skuId: Number(be.cuttingProposalId),
    poNumber: be.poNumber,
    skuCode: be.mfgProductCode,
    skuName: be.mfgProductName ?? undefined,
    createdAt: be.createdAt,
    warehouseScope: be.warehouseCode,
    items,
    status: BE_TO_FE_STATUS[be.status] ?? 'new',
    quotes,
    chosenSuppliers,
    submittedAt: be.submittedAt ?? undefined,
    approvedAt: be.approvedAt ?? undefined,
    rejectedAt: be.rejectedAt ?? undefined,
    rejectionReason: be.rejectionReason ?? undefined,
    purchasedAt: be.purchasedAt ?? undefined,
  };
}

async function getPurchaseProposal(id: string): Promise<PurchaseProposal> {
  const detail = await http.get<BeProposal>(`/purchase-proposals/${id}`);
  return toProposal(detail);
}

export async function getPurchaseProposals(): Promise<PurchaseProposal[]> {
  const res = await http.get<BeProposal[] | { data: BeProposal[] }>('/purchase-proposals?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return Promise.all(list.map((p) => getPurchaseProposal(p.id)));
}

export async function acknowledgeProposal(id: string): Promise<PurchaseProposal> {
  await http.post(`/purchase-proposals/${id}/acknowledge`);
  return getPurchaseProposal(id);
}

/** Tạo mọi dòng báo giá đã nhập (client gom sẵn trong quoteEdits) rồi gửi Sếp duyệt 1 lượt. */
export async function submitProposalToDirector(
  proposal: PurchaseProposal,
  quotesByMaterialId: Record<string, ProposalQuote[]>,
): Promise<PurchaseProposal> {
  const beItemIdByMaterialId = await getBeItemIdsByMaterialId(proposal.id);

  for (const [materialId, rows] of Object.entries(quotesByMaterialId)) {
    const beItemId = beItemIdByMaterialId.get(materialId);
    if (!beItemId) continue;
    for (const row of rows) {
      await http.post(`/purchase-proposals/${proposal.id}/items/${beItemId}/quotes`, {
        supplierName: row.supplierName,
        supplierId: row.supplierId,
        unitPrice: row.unitPrice ?? undefined,
        expectedDate: row.expectedDate,
        note: row.note,
      });
    }
  }
  await http.post(`/purchase-proposals/${proposal.id}/submit`);
  return getPurchaseProposal(proposal.id);
}

/**
 * Sếp duyệt - nhận thẳng quoteId thật (BossApp.tsx lưu theo id, không phải tên NCC nữa - xem
 * ProposalQuote.id). KHÔNG tra lại theo supplierName: 2 báo giá có thể trùng tên NCC (hợp lệ,
 * BE không cấm), hoặc còn báo giá cũ chưa dọn sau 1 vòng "Báo giá lại" (mỗi lần báo giá lại là
 * create() mới, giữ báo giá cũ làm lịch sử) - tra theo tên có thể khớp nhầm sang bản không phải
 * cái Sếp vừa bấm (D.h3-quote-id-not-name). Vẫn cần 1 lần GET để dịch materialId -> BE itemId
 * (state FE key theo materialId, không đổi được mà không sửa cả UI).
 */
export async function approveProposal(
  proposal: PurchaseProposal,
  chosenQuoteIdByMaterialId: Record<string, string>,
): Promise<PurchaseProposal> {
  const beItemIdByMaterialId = await getBeItemIdsByMaterialId(proposal.id);
  const chosenQuoteIdByItemId: Record<string, string> = {};

  for (const [materialId, quoteId] of Object.entries(chosenQuoteIdByMaterialId)) {
    const beItemId = beItemIdByMaterialId.get(materialId);
    if (beItemId) chosenQuoteIdByItemId[beItemId] = quoteId;
  }

  await http.post(`/purchase-proposals/${proposal.id}/approve`, { chosenQuoteIdByItemId });
  return getPurchaseProposal(proposal.id);
}

export async function rejectProposal(id: string, reason: string): Promise<PurchaseProposal> {
  await http.post(`/purchase-proposals/${id}/reject`, { rejectionReason: reason });
  return getPurchaseProposal(id);
}

export async function requoteProposal(id: string): Promise<PurchaseProposal> {
  await http.post(`/purchase-proposals/${id}/requote`);
  return getPurchaseProposal(id);
}

export async function receiveProposalItem(
  proposal: PurchaseProposal,
  materialId: string,
  qty: number,
  receivedQtyPurchaseUnit?: number,
): Promise<PurchaseProposal> {
  const beItemIdByMaterialId = await getBeItemIdsByMaterialId(proposal.id);
  const beItemId = beItemIdByMaterialId.get(materialId);
  if (!beItemId) {
    throw new Error(`Không tìm thấy vật tư (materialId=${materialId}) trong đề xuất mua ${proposal.id}`);
  }
  // BE ghi StockLedger (PURCHASE) mỗi lần nhận hàng - bắt buộc header này vì 1 item có thể nhận
  // nhiều đợt nên không có key tất định từ dữ liệu (xem PurchaseProposalsService.receiveItem()).
  await http.post(
    `/purchase-proposals/${proposal.id}/items/${beItemId}/receive`,
    { receivedQty: qty, receivedQtyPurchaseUnit },
    withIdempotencyKey(),
  );
  return getPurchaseProposal(proposal.id);
}

/** materialId -> itemId thật (PurchaseProposalItem.id) - type cũ không có chỗ lưu itemId nên
 *  tra lại qua 1 lần gọi detail còn tươi, dùng chung cho mọi action cần itemId. Dùng materialId
 *  (KHÔNG phải materialName - xem comment đầu file, D.p6-quote-key-collision) vì materialId mới
 *  là định danh duy nhất trong 1 đề xuất; materialName có thể trùng giữa nhiều vật tư khác nhau. */
async function getBeItemIdsByMaterialId(proposalId: string): Promise<Map<string, string>> {
  const beDetail = await http.get<BeProposal>(`/purchase-proposals/${proposalId}`);
  return new Map((beDetail.items ?? []).map((it) => [it.materialId, it.id]));
}
