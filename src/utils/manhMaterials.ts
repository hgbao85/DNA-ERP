import type { DaySonItem, ManhChildGroup, Sku, SatItem } from '../types/sku';

/** Gộp phẳng children thuộc 1 nhóm vật tư từ tất cả mảnh (manhData.pieces) của 1 Sku. */
function flattenManhGroup(pf: Sku, group: ManhChildGroup) {
  const pieces = pf.manhData?.pieces ?? [];
  return pieces.flatMap((m) => m.children.filter((c) => c.group === group));
}

/**
 * Gộp phẳng danh sách loại sắt từ tất cả "mảnh" (manhData.pieces, children group='sat') của 1 Sku
 * thành SatItem[] — dùng thay quotaManagement.materialType.sat (đã bỏ khỏi luồng nhập định mức
 * chi tiết) cho các màn hình tổng hợp vật tư (Kiểm tra vật tư, Tổng hợp vật tư, Xuất kho, Bảng
 * thống kê).
 */
export function flattenManhSteel(pf: Sku): SatItem[] {
  return flattenManhGroup(pf, 'sat').map((c) => ({
    name: c.name,
    specifications: c.specs ?? undefined,
    chieuDai: c.length ?? undefined,
    unit: 'cây',
    quantity: c.qty != null && c.qty !== '' ? Number(c.qty) : undefined,
  }));
}

const toDaySonItem = (c: ReturnType<typeof flattenManhGroup>[number]): DaySonItem => ({
  name: c.name,
  materialId: c.materialId,
  unit: c.unit ?? undefined,
  kg: c.qty != null && c.qty !== '' ? Number(c.qty) : undefined,
});

/**
 * Nhu cầu Dây/Sơn thật (tính theo kg) của 1 SKU nằm ở 2 nguồn: mảnh dây (manhData.pieces, children
 * group='day' — do account Sắt nhập chung trong bước định mức mảnh) và Sơn chi tiết
 * (quotaManagement.materialType.daySon) — gộp cả 2 để các màn hình tổng hợp không thiếu dây.
 * KHÔNG gồm Đinh/Tán rút/Nút nhựa vì chúng tính theo cây/cái (đếm), không cùng đơn vị kg với
 * dây/sơn — trộn chung sẽ sai số liệu tổng hợp.
 */
export function combinedDaySon(pf: Sku): DaySonItem[] {
  return [...(pf.quotaManagement?.materialType?.daySon ?? []), ...flattenManhGroup(pf, 'day').map(toDaySonItem)];
}

/**
 * Nhu cầu Đinh (tính theo cây, đếm) của 1 SKU — chỉ 1 nguồn duy nhất (manhData.pieces, children
 * group='dinh', do account Sắt nhập chung trong bước định mức mảnh, không có nhóm chi tiết tương
 * ứng như Dây/Sơn). Tách hàm riêng khỏi combinedDaySon vì khác đơn vị (cây, không phải kg) — các
 * màn hình tổng hợp phải hiển thị Đinh thành dòng/nhóm riêng, không được cộng chung số lượng với
 * Dây/Sơn.
 */
export function dinhItems(pf: Sku): DaySonItem[] {
  return flattenManhGroup(pf, 'dinh').map(toDaySonItem);
}

/** Nhu cầu Tán rút (tính theo cái, đếm) của 1 SKU — cùng nguồn/lý do tách riêng như dinhItems. */
export function rivetItems(pf: Sku): DaySonItem[] {
  return flattenManhGroup(pf, 'tanRut').map(toDaySonItem);
}

/** Nhu cầu Nút nhựa (tính theo cái, đếm) của 1 SKU — cùng nguồn/lý do tách riêng như dinhItems. */
export function plasticButtonItems(pf: Sku): DaySonItem[] {
  return flattenManhGroup(pf, 'nutNhua').map(toDaySonItem);
}
