/**
 * Sku chỉ biết `productionInvoiceId` (1 PI) + `mfgProductId`, không biết thẳng
 * `productionInvoiceItemId` (1 PI có thể có nhiều item, 1/mfgProduct) nên phải tra ngược qua
 * GET /production-invoices/:id rồi so khớp mfgProductId. Dùng chung cho mọi adapter key theo
 * productionInvoiceItemId (transfer-check-api.ts, packaging-api.ts).
 *
 * Fallback theo mfgProductId (2026-08-18): SKU tạo độc lập (không chọn Sales Order lúc tạo) thì
 * `productionInvoiceId` để trống mãi mãi trên PlanForm, dù sau đó ai đó "Yêu cầu sản xuất" cho
 * đúng mfgProduct này qua 1 đơn hàng thật (tạo ProductionInvoiceItem riêng, chỉ nối ngầm qua
 * mfgProductId - không ghi ngược lại PlanForm gốc, xem SkusService.create()). Không có fallback
 * thì mọi màn dùng hàm này (Phân phối nội bộ, Mua hàng routing, Chuyển kho, Đóng gói) coi như SKU
 * đó chưa từng được sản xuất, dù ProductionOrder thật đã RELEASED. Quét /production-orders?limit=100
 * theo mfgProductId (cùng kiểu "fetch hết rồi lọc client" đã dùng ở resolveProductionOrderId()) -
 * giả định 1 mfgProduct chỉ có tối đa 1 ProductionOrder đang chạy tại 1 thời điểm (chưa xử lý case
 * 1 SKU tái sử dụng cho nhiều lệnh sản xuất song song).
 */
import { http } from './core/http';
import type { Sku } from '../types/sku';

// ─── Cache chung GET /production-orders?limit=100 ────────────────────────────
// 3 hàm dưới đây (resolveProductionInvoiceRef/resolveProductionOrderId/
// buildProductionOrderInfoByMfgProduct) đều "fetch hết rồi lọc client" trên CÙNG 1 danh sách -
// trước đây mỗi lệnh gọi tự bắn 1 request HTTP riêng, không cache gì. 1 trang gọi các hàm này cho
// hàng chục dòng cùng lúc (vd "Bảng thống kê" duyệt qua mọi SKU đã duyệt, mỗi dòng gọi ít nhất 2
// lần qua fetchExecutionStages + getWeavingIssuePlan) khiến số request nhân lên hàng trăm lần
// trong vài giây, đủ đụng rate limit của BE (429) - phát hiện qua browser thật 2026-08-31 (573
// request trong 1 lần tải "Bảng thống kê" sau khi sửa để hiện đủ mọi SKU đã duyệt, trước đó ít lộ
// vì danh sách còn bị lọc thiếu). TTL ngắn chỉ đủ gộp các lệnh gọi bắn dồn dập trong 1 lượt render
// - không cache lâu vì "Xử lý lệnh sản xuất" cần thấy ProductionOrder mới ngay sau khi vừa duyệt.
interface BeProductionOrderRaw {
  id: string;
  mfgProductId: string;
  salesOrderCode: string | null;
  productionInvoiceId: string;
  productionInvoiceItemId: string;
  piCode: string;
  deliveryDeadline: string | null;
  floorStage: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
}
let productionOrdersCache: { promise: Promise<BeProductionOrderRaw[]>; expiresAt: number } | null = null;
const PRODUCTION_ORDERS_CACHE_TTL_MS = 10_000;

function fetchProductionOrdersCached(): Promise<BeProductionOrderRaw[]> {
  const now = Date.now();
  if (productionOrdersCache && productionOrdersCache.expiresAt > now) return productionOrdersCache.promise;
  const promise = http
    .get<BeProductionOrderRaw[] | { data: BeProductionOrderRaw[] }>('/production-orders?limit=100')
    .then((res) => (Array.isArray(res) ? res : res.data))
    .catch((err) => {
      // KHÔNG giữ lại promise lỗi cho hết TTL - nếu không, 1 lần 429/lỗi mạng thoáng qua sẽ làm
      // MỌI lệnh gọi khác dùng chung cache này trong 10s tiếp theo cũng lỗi theo (dù bản thân BE
      // đã hết rate-limit từ lâu), thay vì chỉ đúng những lệnh gọi đã lỡ nhận promise này.
      productionOrdersCache = null;
      throw err;
    });
  productionOrdersCache = { promise, expiresAt: now + PRODUCTION_ORDERS_CACHE_TTL_MS };
  return promise;
}

// resolveProductionInvoiceRef() gọi GET /production-invoices/:id riêng cho MỖI SKU - 1 PI có
// nhiều SKU (vd đợt gộp) khiến cùng 1 PI bị tải lại nhiều lần trùng lặp trong cùng 1 lượt render
// "Bảng thống kê" (getTransferCheckPieces + getPackaging của MỖI dòng đều tự gọi hàm này riêng,
// nhân đôi số lần gọi cho cùng 1 SKU). Cache theo piId, cùng TTL/cách xử lý lỗi với
// fetchProductionOrdersCached() ở trên.
interface BeProductionInvoiceLite {
  items: { id: string; mfgProductId: string }[];
}
const productionInvoiceCache = new Map<string, { promise: Promise<BeProductionInvoiceLite>; expiresAt: number }>();
const PRODUCTION_INVOICE_CACHE_TTL_MS = 10_000;

function fetchProductionInvoiceCached(piId: string): Promise<BeProductionInvoiceLite> {
  const now = Date.now();
  const hit = productionInvoiceCache.get(piId);
  if (hit && hit.expiresAt > now) return hit.promise;
  const promise = http.get<BeProductionInvoiceLite>(`/production-invoices/${piId}`).catch((err) => {
    productionInvoiceCache.delete(piId);
    throw err;
  });
  productionInvoiceCache.set(piId, { promise, expiresAt: now + PRODUCTION_INVOICE_CACHE_TTL_MS });
  return promise;
}

export async function resolveProductionInvoiceItemId(pf: Sku): Promise<string | null> {
  const ref = await resolveProductionInvoiceRef(pf);
  return ref?.itemId ?? null;
}

export interface ProductionInvoiceItemRef {
  /** PI CHA thật của item này — KHÔNG phải lúc nào cũng bằng pf.productionInvoiceId (SKU tạo độc
   *  lập, resolve qua fallback mfgProductId, để trống mãi mãi trên PlanForm - xem comment đầu
   *  file). Dùng field này thay vì pf.productionInvoiceId khi build URL /production-invoices/:id/...,
   *  nếu không URL sẽ thành ".../undefined/..." (400) cho đúng nhóm SKU dùng fallback. */
  productionInvoiceId: string;
  itemId: string;
}

/** Cùng logic resolveProductionInvoiceItemId() nhưng trả thêm productionInvoiceId thật - dùng cho
 *  các adapter cần build URL /production-invoices/:id/items/:itemId/... (transfer-check-api.ts,
 *  packaging-api.ts). Phát hiện 2026-08-19 qua browser thật: VatTuDashboardPage gọi getPackaging()
 *  cho SKU tạo độc lập (fallback path, pf.productionInvoiceId null) ra 400 "/production-invoices/
 *  undefined/items/.../packaging" - trước đó ít lộ vì getPackaging chỉ gọi tương tác theo 1 SKU
 *  được chọn, không lặp qua mọi SKU như VatTuDashboardPage. */
export async function resolveProductionInvoiceRef(pf: Sku): Promise<ProductionInvoiceItemRef | null> {
  if (pf.productionInvoiceId) {
    const pi = await fetchProductionInvoiceCached(pf.productionInvoiceId);
    const item = pi.items.find((it) => it.mfgProductId === pf.mfgProductId);
    if (item) return { productionInvoiceId: pf.productionInvoiceId, itemId: String(item.id) };
  }
  const list = await fetchProductionOrdersCached();
  const order = list.find((o) => o.mfgProductId === pf.mfgProductId);
  return order ? { productionInvoiceId: order.productionInvoiceId, itemId: order.productionInvoiceItemId } : null;
}

/**
 * ProductionOrder tự sinh 1-1 với productionInvoiceItemId ngay khi Sếp duyệt (xem
 * ProductionOrdersService.createFromApproval, BE) - không có endpoint lọc theo
 * productionInvoiceItemId nên phải quét GET /production-orders?limit=100 rồi so khớp (cùng kiểu
 * "fetch hết rồi lọc client" đã dùng ở getPurchaseProposals/getInspectionRequests - danh sách
 * này chưa lớn, xem ghi chú M4 "chưa có phân trang thật" ở roadmap). Dùng cho adapter key theo
 * productionOrderId (weaving-issues-api.ts) - khác productionInvoiceItemId (transfer-check-api.ts/
 * packaging-api.ts).
 */
export async function resolveProductionOrderId(pf: Sku): Promise<string | null> {
  const itemId = await resolveProductionInvoiceItemId(pf);
  if (!itemId) return null;
  const list = await fetchProductionOrdersCached();
  const order = list.find((o) => o.productionInvoiceItemId === itemId);
  return order ? order.id : null;
}

export interface ProductionOrderInfo {
  /** Mã đơn hàng Sales gốc (SalesOrder.code) — mã "PO" hiển thị cho người dùng. null nếu lệnh sản
   *  xuất này không gắn đơn hàng nào (tạo tay). */
  poCode: string | null;
  /** Id PI cha (ProductionInvoice.id) — dùng gọi endpoint gộp theo PI (vd steel-issues-api.ts). */
  productionInvoiceId: string;
  /** Mã PI cha (ProductionInvoice.code). */
  piCode: string;
  /** Hạn giao (ProductionInvoiceItem.deliveryDeadline) — null nếu chưa khai. */
  deliveryDate: string | null;
  /** QLSX kiểm soát qua nút Bắt đầu/Kết thúc ở "Bảng thống kê" (2026-08-31) - dùng để ẩn PI khỏi
   *  "Phân phối nội bộ" (XuatSatPage/XuatVatTuTieuHaoPage) cho tới khi có ít nhất 1 SKU ACTIVE. */
  floorStage: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
}

/**
 * Map PO/PI THẬT (từ ProductionOrder Sếp đã duyệt) — PHẢI dùng thay cho `Sku.exportOrder`/
 * `Sku.piCode` khi hiển thị cột PO/PI ở "Phân phối nội bộ": field trên Sku chỉ phản ánh
 * PlanForm.salesOrderId tĩnh (gắn được ngay khi Sales tạo PO, dù Sếp chưa duyệt sản xuất gì),
 * trong khi PO/PI thật chỉ tồn tại SAU khi Sếp duyệt 1 ProductionInvoiceItem sinh ra ProductionOrder
 * (xem ProductionOrdersService.createFromApproval, BE) — đúng lúc kho mới có gì để xuất (sắt/vật tư
 * phải được mua/nhập kho theo lệnh sản xuất đó trước).
 *
 * Khoá theo CẢ 2 dạng - dùng lookupProductionOrderInfo() để tra đúng, không tự .get() trực tiếp:
 *  - `${productionInvoiceId}:${mfgProductId}` (khoá CHÍNH, chính xác tuyệt đối) - mỗi dòng
 *    ProductionOrder ứng đúng 1 cặp (PI, mfgProduct) này (1-1 với ProductionInvoiceItem).
 *  - `mfgProductId` đơn (khoá FALLBACK, giữ order đầu tiên tìm thấy) - CHỈ dùng khi Sku chưa gắn PI
 *    nào (SKU tạo độc lập, productionInvoiceId để trống mãi mãi - xem comment đầu file).
 *
 * SỬA bug #1 (changelog 2026-08-31-qlsx-floor-stage-toan-chuoi.html mục 10, phát hiện qua E2E
 * browser thật 31/8, CHƯA sửa lúc đó): trước đây map CHỈ khoá theo mfgProductId đơn nên 1 mfgProduct
 * chạy song song NHIỀU PI (nhiều đơn hàng khác nhau cùng đặt 1 sản phẩm - vd "GTY-E2E-01" có 5 PI
 * song song trong data demo) luôn trả về ĐÚNG 1 PI (mới nhất) cho MỌI Sku cùng mfgProduct đó - sai
 * cho mọi Sku thuộc PI khác, có thể ẩn hoàn toàn 1 SKU đang ACTIVE thật khỏi các trang kho.
 */
export async function buildProductionOrderInfoByMfgProduct(): Promise<Map<string, ProductionOrderInfo>> {
  const list = await fetchProductionOrdersCached();
  const map = new Map<string, ProductionOrderInfo>();
  for (const o of list) {
    const info: ProductionOrderInfo = {
      poCode: o.salesOrderCode,
      productionInvoiceId: o.productionInvoiceId,
      piCode: o.piCode,
      deliveryDate: o.deliveryDeadline,
      floorStage: o.floorStage,
    };
    map.set(`${o.productionInvoiceId}:${o.mfgProductId}`, info);
    if (!map.has(o.mfgProductId)) map.set(o.mfgProductId, info);
  }
  return map;
}

/**
 * Tra map trả về từ buildProductionOrderInfoByMfgProduct() ĐÚNG cho 1 Sku cụ thể - ưu tiên khoá
 * chính xác (Sku.productionInvoiceId, mfgProductId) vì mỗi Sku (1 dòng đơn hàng, KHÔNG phải 1 mã
 * catalog dùng chung nhiều đơn) đã tự biết đúng PI của NÓ (xem comment Sku.piCode ở types/sku.ts).
 * Chỉ rơi về khoá mfgProductId đơn khi Sku chưa gắn PI nào (SKU tạo độc lập). Luôn dùng hàm này
 * thay vì `.get(pf.mfgProductId)` trực tiếp - xem bug #1 ở comment trên.
 */
export function lookupProductionOrderInfo(
  map: Map<string, ProductionOrderInfo>,
  pf: Sku,
): ProductionOrderInfo | undefined {
  if (pf.productionInvoiceId) {
    const exact = map.get(`${pf.productionInvoiceId}:${pf.mfgProductId}`);
    if (exact) return exact;
  }
  return map.get(pf.mfgProductId);
}
