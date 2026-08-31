/**
 * Adapter ĐÓNG GÓI: FE ⇄ BE thật (module `production-invoices`, model `PackagingRecord` mới,
 * chốt 2026-08-12). "Tổng thùng" = ProductionOrder.quantity; BE chỉ chặn vượt tổng, KHÔNG chặn
 * theo số đã qua Chuyền kiểm (quyết định nghiệp vụ 2026-08-12) - FE không tự thêm ràng buộc đó.
 */
import { http } from './core/http';
import type { Sku } from '../types/sku';
import { resolveProductionInvoiceRef } from './production-invoice-item';

export interface BePackagingProgress {
  totalQty: number;
  packedQty: number;
  remainingQty: number;
}

const EMPTY_PROGRESS: BePackagingProgress = { totalQty: 0, packedQty: 0, remainingQty: 0 };

/** totalQty=0 khi SKU chưa gắn PI/chưa có ProductionOrder (chưa được Sếp duyệt) - chưa có gì để
 *  đóng gói, không phải lỗi cần báo cho thủ kho. */
export async function getPackaging(pf: Sku): Promise<BePackagingProgress> {
  const ref = await resolveProductionInvoiceRef(pf);
  if (!ref) return EMPTY_PROGRESS;
  try {
    return await http.get<BePackagingProgress>(
      `/production-invoices/${ref.productionInvoiceId}/items/${ref.itemId}/packaging`,
    );
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Gộp nhiều ProductionInvoiceItem 1 lần — "Bảng thống kê" (ThongKePagePlan.tsx) cần tiến độ
 *  Đóng gói cho nhiều SKU cùng lúc, thay vì N lệnh gọi getPackaging() riêng. Trả về map itemId ->
 *  tiến độ (item không có trong danh sách trả về key rỗng, chưa có ProductionOrder). */
export async function getPackagingBatch(
  itemIds: string[],
): Promise<Record<string, BePackagingProgress>> {
  if (itemIds.length === 0) return {};
  return http.get<Record<string, BePackagingProgress>>(
    `/production-invoices/packaging/batch?itemIds=${encodeURIComponent(itemIds.join(','))}`,
  );
}

export async function recordPackaging(
  pf: Sku,
  data: { boxesPacked: number; note?: string },
): Promise<BePackagingProgress> {
  const ref = await resolveProductionInvoiceRef(pf);
  if (!ref) {
    throw new Error('SKU chưa gắn Lệnh sản xuất (PI) hoặc chưa được Sếp duyệt - chưa có gì để đóng gói');
  }
  return http.post<BePackagingProgress>(
    `/production-invoices/${ref.productionInvoiceId}/items/${ref.itemId}/packaging`,
    data,
  );
}
