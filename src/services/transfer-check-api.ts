/**
 * Adapter CHUYỀN KIỂM (TRANSFER_CHECK): FE ⇄ BE thật (module `production-invoices`, mốc mới
 * chốt 2026-08-11 - xem comment `ProdItemStageType`/`TransferCheckResult` ở schema.prisma BE).
 * `readyQty` ("chờ thực thi") luôn trả về 0 - CHƯA có dữ liệu sản lượng thật của công đoạn Đan
 * (M2, chưa xây) nên BE cố tình không suy ra số giả; KhoChuyenKiemPage hiển thị đúng như vậy,
 * không tự bịa số ở tầng FE.
 * Sku chỉ biết `productionInvoiceId` (1 PI) + `mfgProductId`, không biết thẳng
 * `productionInvoiceItemId` (1 PI có thể có nhiều item, 1/mfgProduct) nên phải tra ngược qua
 * GET /production-invoices/:id rồi so khớp mfgProductId - xem resolveItemId().
 */
import { http } from './core/http';
import type { Sku } from '../types/sku';

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

async function resolveItemId(pf: Sku): Promise<string | null> {
  if (!pf.productionInvoiceId) return null;
  const pi = await http.get<{ items: { id: number; mfgProductId: number }[] }>(
    `/production-invoices/${pf.productionInvoiceId}`,
  );
  const item = pi.items.find((it) => it.mfgProductId === pf.mfgProductId);
  return item ? String(item.id) : null;
}

/** Trả mảng rỗng khi SKU chưa gắn PI/chưa có ProductionOrder (chưa được Sếp duyệt) - chưa có gì
 *  để kiểm, không phải lỗi cần báo cho thủ kho. */
export async function getTransferCheckPieces(pf: Sku): Promise<BeTransferCheckPiece[]> {
  const itemId = await resolveItemId(pf);
  if (!itemId) return [];
  try {
    return await http.get<BeTransferCheckPiece[]>(
      `/production-invoices/${pf.productionInvoiceId}/items/${itemId}/transfer-check`,
    );
  } catch {
    return [];
  }
}

export async function recordTransferCheck(
  pf: Sku,
  data: { pieceId: string; checkedQty: number; note?: string; defects?: TransferCheckDefectInput[] },
): Promise<BeTransferCheckPiece> {
  const itemId = await resolveItemId(pf);
  if (!itemId) {
    throw new Error('SKU chưa gắn Lệnh sản xuất (PI) hoặc chưa được Sếp duyệt - chưa có gì để kiểm');
  }
  return http.post<BeTransferCheckPiece>(
    `/production-invoices/${pf.productionInvoiceId}/items/${itemId}/transfer-check`,
    data,
  );
}
