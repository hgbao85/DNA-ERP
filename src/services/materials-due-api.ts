/**
 * Phần A – Đợt 4 (YC6): adapter màn "Vật tư cần về" ⇄ BE `GET /materials-due`. Kiểu dưới đây CHÉP Y HỆT hợp đồng BE
 * `src/modules/materials-due/materials-due.types.ts` (BE là nguồn đúng - FE không tự tính lại trạng thái/hạn).
 */
import { http } from './core/http';

/** Bộ lọc: Quá hạn · Hôm nay · Theo ngày (cần `date`) · Tất cả. */
export type MaterialsDueView = 'overdue' | 'today' | 'date' | 'all';
/** Người mua: "Vật tư của tôi" (mặc định) hoặc "Tất cả". Vai trò khác bỏ qua tham số này. */
export type MaterialsDueScope = 'mine' | 'all';

/**
 * Trạng thái dòng so với hôm nay:
 *  - OVERDUE        hạn chót < hôm nay                      → đỏ, "Quá hạn N ngày"      (lọc Quá hạn)
 *  - DEADLINE_TODAY hạn chót = hôm nay                      → đỏ, "HẠN CHÓT HÔM NAY"     (lọc Hôm nay)
 *  - IN_WINDOW      về từ ≤ hôm nay < hạn chót              → "Còn N ngày tới hạn chót"  (lọc Hôm nay)
 *  - UPCOMING       hôm nay < về từ                         → "Về từ dd/mm"              (chỉ ở Theo ngày / Tất cả)
 *  - NO_DEADLINE    không SKU nào có hạn                     → "Chưa có hạn", xếp cuối    (chỉ ở Tất cả)
 */
export type MaterialsDueState = 'OVERDUE' | 'DEADLINE_TODAY' | 'IN_WINDOW' | 'UPCOMING' | 'NO_DEADLINE';

/** 1 dòng SKU đang chạy dùng dòng mua này (lệnh gộp: nhiều SKU, mỗi SKU 1 hạn riêng). */
export interface MaterialsDueSku {
  itemId: string;
  /** Mã lệnh của CHÍNH dòng SKU: số LSX của dòng, chưa có thì mã lệnh hiển thị của PI. Không bao giờ là mã PI khi đã có LSX. */
  lenhCode: string;
  skuCode: string;
  /** Hạn chót vật tư của SKU này theo nhóm của vật tư (`purchaseDeadlineOf`), null = chưa có. */
  deadline: string | null;
}

/** 1 dòng = 1 dòng đề xuất mua (PurchaseProposalItem) còn chưa về đủ số chốt mua. */
export interface MaterialsDueRow {
  lineId: string;
  piId: string;
  /** Mã lệnh hiển thị của PI (các LSX nối " + ", chưa có thì mã PI) - `loadLenhDisplayCodes`. */
  lenhCode: string;
  materialId: string;
  /** Tên vật tư kèm chiều dài cây / quy cách khi có (như Bảng mốc). */
  materialName: string;
  /** 'cây' cho dòng sắt mua theo cây, còn lại `Material.unit`. */
  unit: string;
  /** VT khung & đan (theo mốc "vật tư khung về đủ") / VT còn lại (theo mốc "vật tư còn lại về đủ"). */
  group: 'FRAME' | 'FINISHED';
  /** Cần mua (`buyQty`, hệ thống tính). */
  needQty: number;
  /** Số chốt mua = `effectiveOrderQty(buyQty, orderQty)` - số được theo dõi. */
  orderQty: number;
  receivedQty: number;
  /** orderQty − receivedQty (luôn > 0: dòng đủ rồi không có trong danh sách). */
  remainingQty: number;
  /** Trạng thái dòng mua: NEW / QUOTING / SUBMITTED = chưa đặt NCC; PURCHASING = đã đặt, chờ hàng về. */
  purchaseStatus: 'NEW' | 'QUOTING' | 'SUBMITTED' | 'PURCHASING';
  /** Hạn chót của dòng = hạn sớm nhất trong `skus` (null = không SKU nào có hạn). */
  deadline: string | null;
  /** Ngày sớm nhất được về = deadline − N. */
  earliestArrival: string | null;
  /** deadline − hôm nay (âm = đã quá hạn chừng ấy ngày), null khi chưa có hạn. */
  daysLeft: number | null;
  state: MaterialsDueState;
  /** SKU đang chạy dùng dòng này, xếp theo hạn tăng dần (chưa có hạn cuối). Luôn ≥ 1 phần tử. */
  skus: MaterialsDueSku[];
  /** NCC: đơn đặt hàng (`supplierOrder.supplier.name`, đơn chưa huỷ), không có thì báo giá `isChosen`; null = chưa đặt. */
  supplierName: string | null;
  /** Số đơn đặt hàng "seq/year" (vd "52/2026"), null = chưa vào đơn. */
  supplierOrderCode: string | null;
  /** Người mua phụ trách (`Material.buyerId`) + tên hiển thị "firstName lastName". */
  buyerId: string | null;
  buyerName: string | null;
  /** Kho nhận thật: `receiveWarehouseCode ?? Material.warehouse.code` (như receiveItem / Bảng mốc). */
  warehouseCode: string | null;
  warehouseName: string | null;
}

/** Đếm trên tập đã lọc theo phạm vi người xem (người mua / kho), TRƯỚC bộ lọc view - để hiện số trên các nút lọc. */
export interface MaterialsDueCounts {
  overdue: number;
  deadlineToday: number;
  inWindow: number;
  upcoming: number;
  noDeadline: number;
}

export interface MaterialsDueResponse {
  today: string;
  /** N đang dùng (SystemConfig.materialEarliestArrivalDays). */
  earliestArrivalDays: number;
  view: MaterialsDueView;
  /** Ngày đang lọc khi view = 'date', còn lại null. */
  date: string | null;
  /** Phạm vi THẬT đã áp (người không phải người mua luôn 'all'). */
  scope: MaterialsDueScope;
  /** true = người gọi là người mua → FE hiện nút "Vật tư của tôi / Tất cả". */
  canChooseScope: boolean;
  /** Mã kho bị khoá theo (thủ kho có warehouseScope, không phải người mua / KHSX / QLSX / Sếp / Admin); null = không khoá. */
  warehouseScope: string | null;
  counts: MaterialsDueCounts;
  /** Đã lọc theo view; xếp: OVERDUE → DEADLINE_TODAY → IN_WINDOW → UPCOMING → NO_DEADLINE, rồi hạn chót, về từ, tên vật tư. */
  rows: MaterialsDueRow[];
}

export interface MaterialsDueQuery {
  view: MaterialsDueView;
  /** Bắt buộc khi view = 'date'. */
  date?: string;
  /** Chỉ có tác dụng với người mua. */
  scope?: MaterialsDueScope;
}

export async function getMaterialsDue(q: MaterialsDueQuery): Promise<MaterialsDueResponse> {
  return http.get<MaterialsDueResponse>('/materials-due', { params: q });
}
