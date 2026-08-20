/**
 * Adapter PURCHASING: FE ⇄ BE thật (module `purchase-proposals`, Phase 8 - Mua hàng, rút gọn).
 *
 * Rút gọn (2026-08-07): PurchaseProposal giờ tự sinh thẳng từ CuttingProposal đã duyệt (chỉ vật
 * tư sắt) - KHÔNG còn đi qua InspectionRequest/Sku/đơn hàng khách như mock cũ. Hệ quả khi map
 * ngược về đúng type `PurchaseProposal` (context/InspectionContext.tsx) để không phải sửa UI:
 *   - `poNumber` là mã lệnh sản xuất NỘI BỘ (BE ProductionOrder.poNumber) - CHỈ để hệ thống tra
 *     cứu, KHÔNG hiển thị cho người dùng nữa (xem `salesOrderCode` bên dưới). Trước 2026-08-18
 *     từng đổi sang mã PI theo chốt của Sếp (2026-08-17), rồi tách tiếp thành `salesOrderCode`/
 *     `piCode` riêng như dưới đây nên `poNumber` quay về vai trò tra cứu nội bộ thuần túy.
 *   - `salesOrderCode` (2026-08-18) là mã đơn hàng Sales gốc (SalesOrder.code, vd "PO-31") - đây
 *     mới là mã "PO" hiện trên UI Mua hàng. null khi SKU không gắn đơn Sales nào (tạo tay); có
 *     thể là danh sách nhiều mã nối bằng ", " ở nhánh PI gộp (nhiều đơn Sales trong cùng 1 đợt cắt).
 *   - `piCode` (2026-08-18) là mã ProductionInvoice ("PI-2026-001") mà lệnh SX trên thuộc về - bộ
 *     đếm ĐỘC LẬP với poNumber/salesOrderCode, thêm cột riêng ở UI để không nhầm lẫn.
 *   - `requestId`/`skuId` không có ý nghĩa thật nữa (không còn InspectionRequest) - đặt giá trị
 *     placeholder ổn định, các màn Mua hàng không đọc 2 field này.
 *   - `deadline` (2026-08-15, A3): trước đó luôn `undefined` (chưa có nguồn dữ liệu, xem
 *     `toProposal()`); nay BE tính sẵn (`PurchaseProposalsService.frameDeadlineOf`) - nhánh lệnh
 *     SX đơn ưu tiên materialDeadline -> mốc Khung cơ khí -> hạn cả PI; nhánh PI gộp lấy hạn SỚM
 *     NHẤT trong cả nhóm SKU. `null` (không phải `undefined`) khi không SKU nào có hạn nào.
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
  // Kho nhận hàng THẬT của riêng vật tư này (Material.warehouseId, xem BE
  // PurchaseProposalItemResponseDto) - Sếp chốt 2026-08-15: 1 đề xuất có thể gồm nhiều vật tư
  // khác kho nhau, KHÔNG còn dùng chung warehouseCode của cả đề xuất (be.warehouseCode dưới).
  warehouseCode: string | null;
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
  salesOrderCode: string | null;
  piCode: string;
  mfgProductCode: string;
  mfgProductName: string | null;
  // Hạn Mua hàng nên ưu tiên (A3, 2026-08-15) - BE tính từ materialDeadline/mốc Khung cơ khí/hạn
  // PI (PurchaseProposalsService.frameDeadlineOf), null nếu không SKU nào trong đề xuất có hạn.
  // Trước đây field này LUÔN undefined ở FE (không có nguồn dữ liệu) - xem comment đầu file.
  deadline: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  purchasedAt: string | null;
  items?: BeItem[];
}

// item.warehouseCode có thể null (vật tư cũ/chưa gán kho, xem BE) - rơi về '—' thay vì hiện
// "null" hay đè nhầm sang kho của đề xuất.
function toItem(item: BeItem): PurchaseProposalItem {
  const warehouseCode = item.warehouseCode ?? '—';
  const khoKey = WAREHOUSE_SCOPE_TO_KHO_KEY[warehouseCode] ?? (warehouseCode as KhoKey);
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
    itemId: item.id,
    receivedQty: item.receivedQty,
    receivedQtyPurchaseUnit: item.receivedQtyPurchaseUnit,
  };
}

function toProposal(be: BeProposal): PurchaseProposal {
  // be.warehouseCode giờ CHỈ còn là kho tóm tắt của cả đề xuất (xem BE PurchaseProposalResponseDto)
  // - từng dòng vật tư tự có warehouseCode riêng, đọc trong toItem() thay vì nhận truyền xuống.
  const items = (be.items ?? []).map((it) => toItem(it));

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
      // Phải mang theo: đây là nguồn xác thực DUY NHẤT cho "báo giá nào đã được Sếp duyệt".
      // Từng bị đánh rơi ở bước map này, khiến TheoDoiMuaHangPage phải suy ngược bằng cách so
      // supplierName với chosenSuppliers - sai khi 2 báo giá trùng tên NCC (D.a2-price-by-name).
      isChosen: q.isChosen,
    }));
    const chosen = it.quotes.find((q) => q.isChosen);
    if (chosen) chosenSuppliers[key] = chosen.supplierName;
  }

  return {
    id: be.id,
    requestId: `cutting-proposal-${be.cuttingProposalId}`,
    skuId: Number(be.cuttingProposalId),
    poNumber: be.poNumber,
    salesOrderCode: be.salesOrderCode,
    piCode: be.piCode,
    skuCode: be.mfgProductCode,
    skuName: be.mfgProductName ?? undefined,
    createdAt: be.createdAt,
    warehouseScope: be.warehouseCode,
    items,
    status: BE_TO_FE_STATUS[be.status] ?? 'new',
    quotes,
    chosenSuppliers,
    deadline: be.deadline ?? undefined,
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

// A5 (2026-08-15, D.a5-n-plus-one): BE findAll() nay trả kèm items (DETAIL_INCLUDE, xem
// PurchaseProposalsService) - map thẳng, KHÔNG còn 1+N request (trước đây mỗi dòng phải gọi
// thêm GET :id chỉ để lấy items, limit 100 -> tối đa 101 request/lần tải danh sách).
// limit=100 - ĐÃ là max cho phép của PaginationQueryDto (@Max(100) ở BE, dùng chung toàn app) nên
// không bump được nữa mà không đổi ràng buộc đó (ảnh hưởng mọi endpoint phân trang khác, ngoài
// phạm vi đợt sửa Medium này). BE findAll() cũng không hỗ trợ filter status (khác
// warehouse-transfers) nên không tách được pending/history để giảm rủi ro theo cách khác - vẫn là
// giới hạn đã biết (audit liệt kê "thêm phân trang thật" như 1 lựa chọn riêng, tốn công thiết kế
// UI hơn phạm vi đợt sửa này).
export async function getPurchaseProposals(): Promise<PurchaseProposal[]> {
  const res = await http.get<BeProposal[] | { data: BeProposal[] }>('/purchase-proposals?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return list.map(toProposal);
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
  const beItemIdByMaterialId = beItemIdsByMaterialId(proposal);

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
 * BE không cấm) - tra theo tên có thể khớp nhầm sang bản không phải cái Sếp vừa bấm
 * (D.h3-quote-id-not-name). Riêng ca "còn báo giá cũ chưa dọn sau 1 vòng Báo giá lại" KHÔNG còn
 * xảy ra được nữa - `requote()` BE nay XOÁ SẠCH báo giá cũ trước khi mở lại QUOTING (đổi
 * 2026-08-11, "không giữ làm lịch sử nữa"; xem `requoteProposal` ở InspectionContext.tsx), nên
 * lý do #2 chỉ còn ghi lại làm ngữ cảnh lịch sử của quyết định thiết kế này, không phải hành vi
 * hiện tại. Dịch materialId -> BE itemId đọc THUẦN từ `proposal.items` đã có sẵn (A5, không còn
 * GET riêng - xem beItemIdsByMaterialId()).
 */
export async function approveProposal(
  proposal: PurchaseProposal,
  chosenQuoteIdByMaterialId: Record<string, string>,
): Promise<PurchaseProposal> {
  const beItemIdByMaterialId = beItemIdsByMaterialId(proposal);
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
  const beItemIdByMaterialId = beItemIdsByMaterialId(proposal);
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

/** materialId -> itemId thật (PurchaseProposalItem.id) - đọc THUẦN từ state đã có (proposal.items
 *  mang sẵn itemId từ 2026-08-15, xem toItem()), KHÔNG còn phải gọi GET riêng để dịch nữa (A5,
 *  D.a5-n-plus-one). Dùng materialId (KHÔNG phải materialName - xem comment đầu file,
 *  D.p6-quote-key-collision) vì materialId mới là định danh duy nhất trong 1 đề xuất; materialName
 *  có thể trùng giữa nhiều vật tư khác nhau. */
function beItemIdsByMaterialId(proposal: PurchaseProposal): Map<string, string> {
  return new Map(
    proposal.items
      .filter((it): it is PurchaseProposalItem & { materialId: number; itemId: string } =>
        it.materialId != null && it.itemId != null,
      )
      .map((it) => [String(it.materialId), it.itemId]),
  );
}
