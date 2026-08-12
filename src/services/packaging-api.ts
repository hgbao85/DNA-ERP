/**
 * Adapter ĐÓNG GÓI: FE ⇄ BE thật (module `production-invoices`, model `PackagingRecord` mới,
 * chốt 2026-08-12). "Tổng thùng" = ProductionOrder.quantity; BE chỉ chặn vượt tổng, KHÔNG chặn
 * theo số đã qua Chuyền kiểm (quyết định nghiệp vụ 2026-08-12) - FE không tự thêm ràng buộc đó.
 */
import { http } from './core/http';
import type { Sku } from '../types/sku';
import { resolveProductionInvoiceItemId } from './production-invoice-item';

export interface BePackagingProgress {
  totalQty: number;
  packedQty: number;
  remainingQty: number;
}

const EMPTY_PROGRESS: BePackagingProgress = { totalQty: 0, packedQty: 0, remainingQty: 0 };

/** totalQty=0 khi SKU chưa gắn PI/chưa có ProductionOrder (chưa được Sếp duyệt) - chưa có gì để
 *  đóng gói, không phải lỗi cần báo cho thủ kho. */
export async function getPackaging(pf: Sku): Promise<BePackagingProgress> {
  const itemId = await resolveProductionInvoiceItemId(pf);
  if (!itemId) return EMPTY_PROGRESS;
  try {
    return await http.get<BePackagingProgress>(
      `/production-invoices/${pf.productionInvoiceId}/items/${itemId}/packaging`,
    );
  } catch {
    return EMPTY_PROGRESS;
  }
}

export async function recordPackaging(
  pf: Sku,
  data: { boxesPacked: number; note?: string },
): Promise<BePackagingProgress> {
  const itemId = await resolveProductionInvoiceItemId(pf);
  if (!itemId) {
    throw new Error('SKU chưa gắn Lệnh sản xuất (PI) hoặc chưa được Sếp duyệt - chưa có gì để đóng gói');
  }
  return http.post<BePackagingProgress>(
    `/production-invoices/${pf.productionInvoiceId}/items/${itemId}/packaging`,
    data,
  );
}
