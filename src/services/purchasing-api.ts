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
 * 2026-08-27 ("Sếp duyệt ngoài hệ thống"): TOÀN BỘ phần báo giá nhiều NCC đã gỡ khỏi adapter này -
 * `saveProposalQuotes`/`submitProposalToDirector`/`approveProposal`/`rejectProposal`/
 * `requoteProposal`/`acknowledgeProposal` và 2 map `quotes`/`chosenSuppliers` không còn. Thay bằng
 * đúng 1 hàm `bossApproveProposal()`: Mua hàng tự làm phiếu so sánh giá bằng Excel, Sếp ký tay,
 * FE upload file đó rồi gọi BE đẩy dòng sang PURCHASING. Giá và NCC nằm TRONG FILE, cố ý không
 * tách ra field riêng (Sếp chốt) - nên `PurchaseProposalItem.approvalFileUrl` là thứ duy nhất
 * FE cần đọc thêm.
 *
 * BE vẫn trả field `quotes` trên mỗi item (32 báo giá cũ, để tra cứu lịch sử) nhưng FE KHÔNG map
 * nữa - không màn nào hiển thị. Đừng dựng lại map đó nếu không có yêu cầu mới.
 *
 * `itemId` (PurchaseProposalItem.id thật) vẫn là khoá định danh dòng ở mọi màn - KHÔNG dùng
 * materialId (2026-08-26, L6): từ khi "gộp 1 PI = 1 form", 1 vật tư đã PURCHASED mà phát sinh
 * thiếu thêm sẽ tách thành DÒNG MỚI cùng materialId, khoá theo materialId khiến thao tác của dòng
 * này ghi đè/lẫn sang dòng kia.
 */
import { http, withIdempotencyKey } from './core/http';
import type { KhoKey, PurchaseProposal, PurchaseProposalItem } from '../context/InspectionContext';
import { warehouseFamilyOf } from '../utils/warehouseFamily';

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
  // Trạng thái CỦA RIÊNG DÒNG NÀY (2026-08-25, "duyệt riêng từng người mua hàng") - xem
  // PurchaseProposalItem.status ở InspectionContext.tsx cho ý nghĩa đầy đủ.
  status: keyof typeof BE_TO_FE_STATUS;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  purchasedAt: string | null;
  // File phiếu Sếp đã ký duyệt lô mua này (2026-08-27) - null cho dòng duyệt theo luồng cũ.
  // BE vẫn trả thêm `quotes` (báo giá luồng cũ) nhưng FE KHÔNG còn đọc: giá/NCC nay nằm trong file.
  approvalFileUrl: string | null;
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
//
// Từ 2026-09-04 (vật tư đóng gói routing theo kho QLSX chọn, xem PurchaseProposalItem.
// receiveWarehouseCode ở BE) warehouseCode của 1 dòng có thể là kho PHỤ dạng '{gia-đình}-{n}'
// (vd "thanh-pham-1788485485362" = "Kho thành phẩm 2"), không còn chắc luôn là 1 trong 3 mã kho
// gốc - tra thẳng theo warehouseCode như trước sẽ rớt vào fallback (ép raw code làm khoKey/
// khoLabel, hiện mã kỹ thuật thay vì tên kho). Quy về gia đình gốc bằng warehouseFamilyOf() (mirror
// cách BossApp/KhoPhoiPage/... đã xử lý cùng vấn đề) trước khi tra 2 map trên.
function toItem(item: BeItem): PurchaseProposalItem {
  const warehouseCode = item.warehouseCode ?? '—';
  const family = warehouseFamilyOf(warehouseCode);
  const khoKey = (family ? WAREHOUSE_SCOPE_TO_KHO_KEY[family] : undefined) ?? (warehouseCode as KhoKey);
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
    khoLabel: (family ? KHO_LABELS[family] : undefined) ?? warehouseCode,
    warehouseCode,
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
    approvalFileUrl: item.approvalFileUrl ?? undefined,
  };
}

function toProposal(be: BeProposal): PurchaseProposal {
  // be.warehouseCode giờ CHỈ còn là kho tóm tắt của cả đề xuất (xem BE PurchaseProposalResponseDto)
  // - từng dòng vật tư tự có warehouseCode riêng, đọc trong toItem() thay vì nhận truyền xuống.
  const items = (be.items ?? []).map((it) => toItem(it));

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

/**
 * Mua hàng xác nhận "Sếp đã duyệt" kèm file phiếu Sếp đã ký tay (2026-08-27) - thay cho CẢ chuỗi
 * acknowledge -> báo giá nhiều NCC -> gửi Sếp -> Sếp duyệt (đã gỡ hết cùng màn So sánh giá).
 *
 * BE tự lọc đúng phần vật tư của actor trong đề xuất, và nhận LUÔN dòng còn kẹt ở trạng thái của
 * luồng cũ (QUOTING/SUBMITTED/REJECTED) - xem PurchaseProposalsService.bossApprove().
 */
export async function bossApproveProposal(
  id: string,
  approvalFileUrl: string,
): Promise<PurchaseProposal> {
  await http.post(`/purchase-proposals/${id}/boss-approve`, { approvalFileUrl });
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
