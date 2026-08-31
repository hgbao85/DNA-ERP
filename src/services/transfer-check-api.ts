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

/** Gộp nhiều ProductionInvoiceItem 1 lần — "Bảng thống kê" (ThongKePagePlan.tsx) cần tiến độ
 *  Chuyền kiểm cho nhiều SKU cùng lúc, thay vì N lệnh gọi getTransferCheckPieces() riêng. Chỉ cần
 *  itemId (không cần piId như bản đơn - ProductionOrder có quan hệ 1-1 với item). Trả về map
 *  itemId -> danh sách mảnh (item không có trong danh sách trả về key rỗng []). */
export async function getTransferCheckPiecesBatch(
  itemIds: string[],
): Promise<Record<string, BeTransferCheckPiece[]>> {
  if (itemIds.length === 0) return {};
  return http.get<Record<string, BeTransferCheckPiece[]>>(
    `/production-invoices/transfer-check/batch?itemIds=${encodeURIComponent(itemIds.join(','))}`,
  );
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
