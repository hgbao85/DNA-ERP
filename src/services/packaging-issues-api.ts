/**
 * Adapter XUẤT VẬT TƯ ĐÓNG GÓI: FE ⇄ BE thật (module `packaging-issues`, chốt 2026-08-19). Thay
 * MOCK ở WarehouseXuatPage.tsx scope 'vat-tu-tp' (tem nhãn, màng PE, túi zip... từ kho vat-tu-tp
 * sang kho thanh-pham theo PO). Không có state machine ISSUED->RECEIVED như material-issues-api.ts
 * (không có bước "tổ xác nhận nhận" riêng) — ghi StockLedger ngay lúc tạo.
 */
import { http, withIdempotencyKey } from './core/http';

export interface BePackagingIssuePlanItem {
  productionOrderId: string;
  poNumber: string;
  salesOrderCode: string | null;
  productName: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  materialUnit: string;
  /** Mã kho THẬT chứa vật tư này (2026-09-04) - không phải lúc nào cũng vat-tu-tp, vd "Thùng"
   *  (VTK-009) lại mặc định về kho thanh-pham gốc. WarehouseXuatPage dùng field này để biết ĐÚNG
   *  thủ kho nào (theo mã kho thật, không phải theo cả gia đình) mới thấy được dòng vật tư này. */
  materialWarehouseCode: string | null;
  requiredQty: number;
  issuedQty: number;
  remainingToIssue: number;
}

/** Gộp nhiều PO 1 lần - cùng mẫu getPieceTransferPlan() (warehouse-transfers-api.ts), dùng cho
 *  WarehouseXuatPage liệt kê mọi PO đang hoạt động cùng lúc. */
export async function getPackagingIssuePlan(
  productionOrderIds: Array<string | number>,
): Promise<BePackagingIssuePlanItem[]> {
  if (productionOrderIds.length === 0) return [];
  const ids = productionOrderIds.map((id) => String(id)).join(',');
  return http.get<BePackagingIssuePlanItem[]>(
    `/packaging-issues/plan?productionOrderIds=${encodeURIComponent(ids)}`,
  );
}

export async function issuePackaging(
  productionOrderId: string | number,
  data: { materialId: string; issuedQty: number; note?: string },
): Promise<void> {
  await http.post(
    `/production-orders/${productionOrderId}/packaging-issues`,
    data,
    withIdempotencyKey(),
  );
}
