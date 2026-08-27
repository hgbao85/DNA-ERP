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
 * `quotes`/`chosenSuppliers` key theo `item.itemId` (PurchaseProposalItem.id thật, KHÔNG phải
 * materialId lẫn item.name — sửa 2026-08-26, L6 rà soát lỗi #6). Lịch sử 2 lần đổi key:
 *   1. 2026-08-13 (D.p6-quote-key-collision): từng key theo item.name, đổi sang materialId vì 2
 *      vật tư khác nhau có thể trùng tên hiển thị (vd nhiều loại "Sắt phi" khác đường kính) khiến
 *      item đứng trước bị item trùng tên đứng sau ghi đè mất trong map.
 *   2. 2026-08-26 (L6): materialId cũng KHÔNG còn duy nhất trong 1 đề xuất - từ khi "gộp 1 PI =
 *      1 form" (2026-08-25), 1 vật tư đã PURCHASED mà lại phát sinh thiếu thêm sẽ tách thành DÒNG
 *      MỚI cùng materialId (xem BE CuttingProposalsService.approve() nhánh shortfall) - key theo
 *      materialId khiến báo giá/duyệt/nhận hàng của dòng này ghi đè/lẫn sang dòng kia. itemId là
 *      định danh DUY NHẤT thật sự (PurchaseProposalItem.id, PK) - không còn ca nào trùng được nữa.
 * Vì key giờ CHÍNH LÀ itemId, các hàm action bên dưới gửi thẳng lên BE, KHÔNG cần tra ngược qua
 * `proposal.items` nữa (đã bỏ hẳn beItemIdsByMaterialId() cũ). Riêng quoteId (báo giá nào được
 * chọn) KHÔNG tra theo tên NCC (từng làm vậy, đã bỏ - xem approveProposal()) - ProposalQuote nay
 * mang sẵn `id` thật từ lúc đọc về, Sếp chọn thì gửi thẳng id đó, tránh khớp nhầm khi trùng tên
 * NCC hoặc còn báo giá cũ chưa dọn sau 1 vòng "Báo giá lại".
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
  // Chiều dài cây phải đặt (mm) - CHỈ có ở vật tư sắt, null cho nhánh kiểm tra vật tư thường
  // (2026-08-26, xem BE PurchaseProposalItem.stockLengthMm).
  stockLengthMm: number | null;
  receivedQty: number;
  receivedQtyPurchaseUnit: number | null;
  quotes: BeQuote[];
  // Trạng thái CỦA RIÊNG DÒNG NÀY (2026-08-25, "duyệt riêng từng người mua hàng") - xem
  // PurchaseProposalItem.status ở InspectionContext.tsx cho ý nghĩa đầy đủ.
  status: keyof typeof BE_TO_FE_STATUS;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  purchasedAt: string | null;
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
    stockLengthMm: item.stockLengthMm,
    khoKey,
    khoLabel: KHO_LABELS[warehouseCode] ?? warehouseCode,
    // BE dùng bigint-as-string; PurchaseProposalItem.materialId là number (quy ước cũ) - cast
    // để tương thích, KHÔNG Number() (mất khớp key với buildBuyerByMaterialId ở purchasingRouting.ts,
    // vốn cũng giữ nguyên Material.id string dưới lớp áo type number - xem materials-api.ts).
    materialId: item.materialId as unknown as number,
    itemId: item.id,
    receivedQty: item.receivedQty,
    receivedQtyPurchaseUnit: item.receivedQtyPurchaseUnit,
    status: BE_TO_FE_STATUS[item.status] ?? 'new',
    submittedAt: item.submittedAt ?? undefined,
    approvedAt: item.approvedAt ?? undefined,
    rejectedAt: item.rejectedAt ?? undefined,
    rejectionReason: item.rejectionReason ?? undefined,
    purchasedAt: item.purchasedAt ?? undefined,
  };
}

function toProposal(be: BeProposal): PurchaseProposal {
  // be.warehouseCode giờ CHỈ còn là kho tóm tắt của cả đề xuất (xem BE PurchaseProposalResponseDto)
  // - từng dòng vật tư tự có warehouseCode riêng, đọc trong toItem() thay vì nhận truyền xuống.
  const items = (be.items ?? []).map((it) => toItem(it));

  const quotes: Record<string, ProposalQuote[]> = {};
  const chosenSuppliers: Record<string, string> = {};
  for (const it of be.items ?? []) {
    // Key theo itemId (L6, 2026-08-26) - xem comment đầu file. it.id luôn có (BE luôn trả id thật).
    const key = it.id;
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
    // requestId là khoá GỘP NHÓM ở BossApp.tsx (nhiều PurchaseProposal cùng 1 phương án cắt gộp
    // lại 1 nhóm) - be.cuttingProposalId null (sourceType=PIECE_MATERIAL_YIELD, 2026-08-22,
    // không đi qua CuttingProposal nào) sẽ ra CÙNG 1 chuỗi "cutting-proposal-null" cho MỌI đề
    // xuất khác PI nhau, gộp nhầm chúng làm 1 nhóm - dùng be.id (luôn duy nhất, không nhóm) làm
    // fallback thay vì lặp lại chuỗi cố định.
    requestId: be.cuttingProposalId ? `cutting-proposal-${be.cuttingProposalId}` : `purchase-proposal-${be.id}`,
    // skuId là placeholder không liên quan gì tới Sku.id thật (xem ThongKePagePlan.tsx) - giữ
    // nguyên hành vi cũ (đã biết vỡ từ trước, không phải phạm vi sửa lần này).
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
// không bump được nữa mà không đổi ràng buộc đó (ảnh hưởng mọi endpoint phân trang khác).
//
// Audit 2026-08-20 (Medium "FE hard-code limit=100"): `activeOnly` (mặc định false, giữ nguyên
// hành vi cũ) cho InspectionContext gọi kèm để BE lọc where PURCHASED ở tầng DB thay vì lọc
// pending/history ở client trên top-100 theo createdAt - tránh phiếu NEW/QUOTING/SUBMITTED/
// PURCHASING/REJECTED cũ bị đẩy khỏi trang bởi phiếu PURCHASED tích luỹ vô hạn theo thời gian.
// Không truyền activeOnly (vd "Lịch sử đã mua", status=purchased) vẫn cắt cụt ở top-100 nếu số
// phiếu PURCHASED vượt 100 - chấp nhận được vì đây thuần là tra cứu lịch sử, không phải hàng đợi
// cần xử lý (cùng mức rủi ro đã chấp nhận cho stock-ledger, xem stock-api.ts:getStockLedger).
export async function getPurchaseProposals(opts?: { activeOnly?: boolean }): Promise<PurchaseProposal[]> {
  const url = opts?.activeOnly
    ? '/purchase-proposals?limit=100&activeOnly=true'
    : '/purchase-proposals?limit=100';
  const res = await http.get<BeProposal[] | { data: BeProposal[] }>(url);
  const list = Array.isArray(res) ? res : res.data;
  return list.map(toProposal);
}

export async function acknowledgeProposal(id: string): Promise<PurchaseProposal> {
  await http.post(`/purchase-proposals/${id}/acknowledge`);
  return getPurchaseProposal(id);
}

/**
 * Gửi mọi dòng báo giá CHƯA lưu (row.id rỗng - addQuote() BE luôn CREATE, không update, gửi lại
 * dòng đã có id sẽ tạo trùng) lên đúng item của nó. Dùng chung cho save-nháp và submit-cuối.
 */
async function postNewQuotes(
  proposal: PurchaseProposal,
  quotesByItemId: Record<string, ProposalQuote[]>,
): Promise<void> {
  // Key giờ CHÍNH LÀ itemId (L6, 2026-08-26, xem comment đầu file) - gửi thẳng, không cần tra
  // ngược qua proposal.items nữa.
  for (const [itemId, rows] of Object.entries(quotesByItemId)) {
    for (const row of rows) {
      if (row.id) continue;
      await http.post(`/purchase-proposals/${proposal.id}/items/${itemId}/quotes`, {
        supplierName: row.supplierName,
        supplierId: row.supplierId,
        unitPrice: row.unitPrice ?? undefined,
        expectedDate: row.expectedDate,
        note: row.note,
      });
    }
  }
}

/**
 * Lưu báo giá đã nhập cho CÁC VẬT TƯ CỦA MÌNH mà KHÔNG gửi Sếp duyệt (2026-08-25) - cần thiết từ
 * khi 1 đề xuất gộp nhiều người mua (LenhMuaNCCPage.splitItemsByOwner): người xong phần mình
 * trước phải lưu được ngay, không đợi đồng nghiệp phụ trách phần còn lại xong trước mới lưu được
 * (tránh deadlock 2 người chờ nhau). BE addQuote() giờ tự chặn báo giá hộ vật tư người khác
 * (assertActorMayQuoteItem) nên chỉ cần gửi đúng phần quotesByItemId của actor.
 */
export async function saveProposalQuotes(
  proposal: PurchaseProposal,
  quotesByItemId: Record<string, ProposalQuote[]>,
): Promise<PurchaseProposal> {
  await postNewQuotes(proposal, quotesByItemId);
  return getPurchaseProposal(proposal.id);
}

/** Tạo mọi dòng báo giá CHƯA lưu (client gom sẵn trong quoteEdits) rồi gửi Sếp duyệt 1 lượt. BE
 *  submit() tự soi CẢ đề xuất (mọi vật tư, kể cả của đồng nghiệp khác) đã có báo giá hợp lệ chưa -
 *  ai bấm sau cùng khi đề xuất đã đủ đều gửi được, không nhất thiết phải là người tạo mọi dòng. */
export async function submitProposalToDirector(
  proposal: PurchaseProposal,
  quotesByItemId: Record<string, ProposalQuote[]>,
): Promise<PurchaseProposal> {
  await postNewQuotes(proposal, quotesByItemId);
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
 * hiện tại. Key giờ CHÍNH LÀ itemId (L6, 2026-08-26) - gửi thẳng lên BE, không cần dịch nữa.
 */
export async function approveProposal(
  proposal: PurchaseProposal,
  chosenQuoteIdByItemId: Record<string, string>,
): Promise<PurchaseProposal> {
  await http.post(`/purchase-proposals/${proposal.id}/approve`, { chosenQuoteIdByItemId });
  return getPurchaseProposal(proposal.id);
}

/** `itemIds` (2026-08-25) - từ chối đúng batch item SUBMITTED mà Sếp đang xem; không truyền thì
 *  BE áp dụng cho MỌI item đang SUBMITTED của đề xuất (tương thích ngược, xem reject() BE). */
export async function rejectProposal(id: string, reason: string, itemIds?: string[]): Promise<PurchaseProposal> {
  await http.post(`/purchase-proposals/${id}/reject`, { rejectionReason: reason, itemIds });
  return getPurchaseProposal(id);
}

export async function requoteProposal(id: string): Promise<PurchaseProposal> {
  await http.post(`/purchase-proposals/${id}/requote`);
  return getPurchaseProposal(id);
}

/** `itemId` (2026-08-26, L6) là PurchaseProposalItem.id thật - gửi thẳng lên BE, không cần tra
 *  ngược qua proposal.items nữa (trước đây dịch qua materialId, xem comment đầu file). */
export async function receiveProposalItem(
  proposal: PurchaseProposal,
  itemId: string,
  qty: number,
  receivedQtyPurchaseUnit?: number,
): Promise<PurchaseProposal> {
  // BE ghi StockLedger (PURCHASE) mỗi lần nhận hàng - bắt buộc header này vì 1 item có thể nhận
  // nhiều đợt nên không có key tất định từ dữ liệu (xem PurchaseProposalsService.receiveItem()).
  await http.post(
    `/purchase-proposals/${proposal.id}/items/${itemId}/receive`,
    { receivedQty: qty, receivedQtyPurchaseUnit },
    withIdempotencyKey(),
  );
  return getPurchaseProposal(proposal.id);
}
