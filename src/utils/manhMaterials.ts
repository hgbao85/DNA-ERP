import type { DaySonItem, Sku, SatItem } from '../types/sku';

/**
 * Gộp phẳng danh sách loại sắt từ tất cả "mảnh" (manhData.sat) của 1 Sku thành SatItem[] —
 * dùng thay quotaManagement.materialType.sat (đã bỏ khỏi luồng nhập định mức chi tiết) cho các
 * màn hình tổng hợp vật tư (Kiểm tra vật tư, Tổng hợp vật tư, Xuất kho, Bảng thống kê).
 */
export function flattenManhSteel(pf: Sku): SatItem[] {
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
 * Nhu cầu Dây/Sơn thật (tính theo kg) của 1 SKU nằm ở 2 nguồn: mảnh dây (manhData.day, do account
 * Dây/Sơn nhập ở bước định mức mảnh) và Sơn chi tiết (quotaManagement.materialType.daySon) — gộp
 * cả 2 để các màn hình tổng hợp không thiếu dây. KHÔNG gồm Đinh (manhData.dinh) vì Đinh tính theo
 * cây (đếm), không cùng đơn vị kg với dây/sơn — trộn chung sẽ sai số liệu tổng hợp.
 */
export function combinedDaySon(pf: Sku): DaySonItem[] {
  return [...(pf.quotaManagement?.materialType?.daySon ?? []), ...(pf.manhData?.day ?? [])];
}

/**
 * Nhu cầu Đinh (tính theo cây, đếm) của 1 SKU — chỉ 1 nguồn duy nhất (manhData.dinh, do account
 * Dây/Sơn nhập ở bước định mức mảnh, không có nhóm chi tiết tương ứng như Dây/Sơn). Tách hàm riêng
 * khỏi combinedDaySon vì khác đơn vị (cây, không phải kg) — các màn hình tổng hợp phải hiển thị
 * Đinh thành dòng/nhóm riêng, không được cộng chung số lượng với Dây/Sơn.
 */
export function dinhItems(pf: Sku): DaySonItem[] {
  return pf.manhData?.dinh ?? [];
}
