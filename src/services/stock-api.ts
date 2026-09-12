/**
 * Adapter STOCK: FE ⇄ BE thật (module `stock` — stock-quant + stock-ledger, Phase 3 Ledger
 * Core). stock_quant là cache tồn kho (materialize từ stock_ledger bằng trigger DB, chỉ đọc).
 * stock_ledger là sổ cái bút toán kép fromWarehouse->toWarehouse - đa số đọc qua GET ở đây, ghi
 * bút toán thật đi qua các flow nghiệp vụ khác (warehouse-transfers...). Ngoại lệ duy nhất:
 * adjustStock() - POST /stock-ledger/adjust, dùng cho "Sửa nhanh tồn kho" ở MfgWarehousesPage.tsx
 * và MaterialsPage.tsx (Admin > Vật tư).
 */
import { http, withIdempotencyKey } from './core/http';

export interface BeStockQuant {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  materialId: string | null;
  materialCode: string | null;
  segmentSpecId: string | null;
  segmentSpecLabel: string | null;
  qty: number;
  /** Vấn đề #13 audit 26/08 - tồn thật (qty) trừ phần đang bị giữ chỗ (cắt sắt/chuyển kho nội bộ
   *  ACTIVE), BE tính qua ĐÚNG hàm StockReservationsService.getAvailableQty() dùng chung với màn
   *  Xuất sắt (PhanPhoiNoiBoPage.tsx) - không tự trừ lại ở FE. === qty với dòng segmentSpec/piece/
   *  productVariant (reservation chỉ khoá theo materialId). */
  availableQty: number;
  updatedAt: string;
}

export interface BeStockLedgerEntry {
  id: string;
  fromWarehouseId: string;
  fromWarehouseCode: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseCode: string;
  toWarehouseName: string;
  materialId: string | null;
  materialCode: string | null;
  materialName: string | null;
  materialUnit: string | null;
  segmentSpecId: string | null;
  segmentSpecLabel: string | null;
  /** Mảnh/thành phẩm - 2 chân hàng còn lại của sổ kho (XOR với material/segmentSpec). Kho phôi sơn
   *  hàn/vật tư TP gần như không có dòng loại này, kho thành phẩm thì có. */
  pieceId: string | null;
  pieceCode: string | null;
  productVariantId: string | null;
  productVariantLabel: string | null;
  qty: number;
  refType: string;
  /** Id bản ghi nguồn (vd warehouse_transfers.id) - đa bảng tuỳ refType, chưa dùng để link. */
  refId: string | null;
  /** Mã chứng từ đọc được (vd "CK-2026-010"). CHỈ phiếu chuyển kho có mã; nguồn khác (xuất sắt,
   *  mua hàng, xuất bao bì, điều chỉnh...) không có cột code nên null → hiện nhãn loại thay thế. */
  refCode: string | null;
  /** Công đoạn/tổ của bản ghi nguồn (PHOI/HAN/SON/DAN) - chỉ có với bút toán tiêu hao đoạn sắt và
   *  xuất vật tư tiêu hao; loại khác null vì tổ cố định theo nghiệp vụ (xem TEAM_BY_REF_TYPE). */
  refStage: string | null;
  /** Mã đơn hàng Sales (SalesOrder.orderCode) của Lệnh sản xuất gắn với bản ghi nguồn - cột
   *  "Mã đơn hàng (PO)" ở màn Lịch sử kho (2026-09-12, theo yêu cầu Sếp). null nếu refType không
   *  đi qua Lệnh sản xuất nào (mua hàng, chuyển kho, KCS phế, điều chỉnh tay...) hoặc PI nguồn là
   *  PI gộp nhiều đơn. */
  poCode: string | null;
  /** Mã Lệnh sản xuất (ProductionInvoice.code, vd "PI-2026-005") - "Lệnh sản xuất" TRONG TOÀN HỆ
   *  THỐNG là ProductionInvoice/PI, KHÁC poCode (SalesOrder.orderCode) ở trên. null nếu refType
   *  không gắn Lệnh sản xuất nào (mua hàng, chuyển kho, KCS phế, điều chỉnh tay...). */
  piCode: string | null;
  note: string | null;
  createdAt: string;
  createdById: string | null;
  /** Tên người ghi bút toán - BE trả sẵn (thủ kho không có quyền USER:VIEW để tự resolve). */
  createdByName: string | null;
  /** Chiều dài cây (mm) với sắt bán theo chiều dài, 0 cho loại khác - cùng mã sắt khác chiều dài là
   *  2 lô tồn RIÊNG nên sổ phải hiện ra mới đọc đúng. */
  stockLengthMm: number;
}

export async function getStockQuants(params?: { warehouseId?: string; materialId?: string; segmentSpecId?: string }): Promise<BeStockQuant[]> {
  return http.get<BeStockQuant[]>('/stock-quant', { params });
}

export async function getStockLedger(params: { warehouseId: string; limit?: number }): Promise<BeStockLedgerEntry[]> {
  // limit=100 - đã là max cho phép của PaginationQueryDto (@Max(100) ở BE) nên không bump được
  // nữa. Rủi ro thấp hơn warehouse-transfers/purchase-proposals vì đây là sổ lịch sử, không có
  // trạng thái "pending" nào có thể bị mất dấu - chỉ cắt cụt lịch sử cũ, chấp nhận được.
  const res = await http.get<{ data: BeStockLedgerEntry[] } | BeStockLedgerEntry[]>('/stock-ledger', {
    params: { limit: 100, ...params },
  });
  return Array.isArray(res) ? res : res.data;
}

/** materialId/segmentSpecId - đúng 1 trong 2 phải có giá trị (khớp ràng buộc XOR của
 *  CreateStockAdjustmentDto ở BE - segmentSpecId dùng cho "Kho phôi", xem docs/quy-doi-doan-phoi.md). */
export async function adjustStock(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  materialId?: string;
  segmentSpecId?: string;
  qty: number;
  /** Vấn đề #25 audit 26/08 - bắt buộc (khớp BE), phải là lý do thật do người dùng gõ (xem
   *  AdjustReasonModal), không phải text mẫu cố định như trước. */
  note: string;
  /** Optimistic-lock cho "sửa nhanh tồn kho" - đi kèm expectedCurrentQty, phải trùng
   *  fromWarehouseId hoặc toWarehouseId. BE 409 nếu tồn thật đã đổi kể từ lúc đọc. */
  expectedWarehouseId?: string;
  expectedCurrentQty?: number;
}): Promise<BeStockLedgerEntry> {
  return http.post<BeStockLedgerEntry>('/stock-ledger/adjust', input, withIdempotencyKey());
}
