/**
 * Adapter CHUYỀN KIỂM (TRANSFER_CHECK): FE ⇄ BE thật (module `production-invoices`, mốc mới
 * chốt 2026-08-11 - xem comment `ProdItemStageType`/`TransferCheckResult` ở schema.prisma BE).
 * `readyQty` ("chờ thực thi") = SUM(WeavingReceipt.qty) thật (module `weaving-issues`, cùng ngày
 * 2026-08-11 - xem weaving-issues-api.ts) - không còn hardcode 0 như lúc transfer-check mới nối.
 */
import { http } from './core/http';
import type { Sku } from '../types/sku';
import { resolveProductionInvoiceRef } from './production-invoice-item';

export interface BeTransferCheckPiece {
  pieceId: string;
  pieceName: string;
  totalQty: number;
  readyQty: number;
  checkedQty: number;
  defectCount: number;
}

export interface TransferCheckDefectInput {
  reason: string;
  imageUrl?: string;
}

/** Trả mảng rỗng khi SKU chưa gắn PI/chưa có ProductionOrder (chưa được Sếp duyệt) - chưa có gì
 *  để kiểm, không phải lỗi cần báo cho thủ kho. */
export async function getTransferCheckPieces(pf: Sku): Promise<BeTransferCheckPiece[]> {
  const ref = await resolveProductionInvoiceRef(pf);
  if (!ref) return [];
  try {
    return await http.get<BeTransferCheckPiece[]>(
      `/production-invoices/${ref.productionInvoiceId}/items/${ref.itemId}/transfer-check`,
    );
  } catch {
    return [];
  }
}

export async function recordTransferCheck(
  pf: Sku,
  data: { pieceId: string; checkedQty: number; note?: string; defects?: TransferCheckDefectInput[] },
): Promise<BeTransferCheckPiece> {
  const ref = await resolveProductionInvoiceRef(pf);
  if (!ref) {
    throw new Error('SKU chưa gắn Lệnh sản xuất (PI) hoặc chưa được Sếp duyệt - chưa có gì để kiểm');
  }
  return http.post<BeTransferCheckPiece>(
    `/production-invoices/${ref.productionInvoiceId}/items/${ref.itemId}/transfer-check`,
    data,
  );
}
