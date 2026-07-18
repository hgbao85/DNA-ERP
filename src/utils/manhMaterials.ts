import type { DaySonItem, PlanForm, SatItem } from '../types/plan-form';

/**
 * Gộp phẳng danh sách loại sắt từ tất cả "mảnh" (manhData.sat) của 1 PlanForm thành SatItem[] —
 * dùng thay quotaManagement.materialType.sat (đã bỏ khỏi luồng nhập định mức chi tiết) cho các
 * màn hình tổng hợp vật tư (Kiểm tra vật tư, Tổng hợp vật tư, Xuất kho, Bảng thống kê).
 */
export function flattenManhSteel(pf: PlanForm): SatItem[] {
  const rows = pf.manhData?.sat ?? [];
  return rows.flatMap((m) =>
    m.children.map((c) => ({
      name: c.name,
      specifications: c.specs ?? undefined,
      chieuDai: c.length ?? undefined,
      unit: 'cây',
      quantity: c.qty != null && c.qty !== '' ? Number(c.qty) : undefined,
    })),
  );
}

/**
 * Nhu cầu Dây/Sơn thật của 1 SKU nằm ở 2 nguồn từ khi tách "định mức mảnh dây": mảnh dây
 * (manhData.daySon, do account Dây/Sơn nhập ở bước định mức mảnh) và Sơn/Đinh chi tiết
 * (quotaManagement.materialType.daySon) — gộp cả 2 để các màn hình tổng hợp không thiếu dây.
 */
export function combinedDaySon(pf: PlanForm): DaySonItem[] {
  return [...(pf.quotaManagement?.materialType?.daySon ?? []), ...(pf.manhData?.daySon ?? [])];
}
