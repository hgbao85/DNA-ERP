/**
 * Quản lý kho - hàm thuần (không React) cho MfgWarehousesPage (dùng ở Admin, Giám đốc, KHSX, QLSX, thủ kho).
 */

/** Chiều dài cây mặc định điền sẵn khi sửa tồn sắt chưa có ô chiều dài. */
export const CHIEU_DAI_CAY_MAC_DINH = 6000

export interface WhQuyen { code: string; isVirtual: boolean }

export interface QuantRow {
  materialId: string | null
  warehouseId: string
  /** Chiều dài cây (mm) với sắt bán theo chiều dài, 0 cho loại khác - cùng mã sắt khác chiều dài
   *  là 2 lô tồn RIÊNG (unique index warehouseId+materialId+stockLengthMm). */
  stockLengthMm: number
  /** Quy cách (nệm), '' = không quy cách - cùng vật tư khác quy cách là các dòng tồn RIÊNG. */
  spec?: string
  qty: number
  /** Tồn còn dùng được (đã trừ phần giữ chỗ cắt sắt/chuyển kho), BE tính sẵn qua getAvailableQty(). */
  availableQty: number
}

export interface StockItem {
  materialId: number
  code: string
  name: string
  unit: string
  spec: string | null
  groupName: string
  /** null = vật tư chưa có ô tồn nào khác 0 ở kho đang xem - hiện "—" ở cột Chiều dài.
   *  0 = ô chiều dài 0 đang có tồn (vật tư không bán theo chiều dài, hoặc tồn chưa gán chiều dài) - cũng hiện "—",
   *  nhưng khi sửa phải ghi đúng ô 0. >0 = chiều dài cây thật (mm). 1 vật tư Sắt có thể ra NHIỀU dòng (mỗi ô 1 dòng). */
  stockLengthMm: number | null
  /** Quy cách của ô tồn này (nệm), '' / bỏ trống = không quy cách. */
  bucketSpec?: string
  qty: number
  /** Mặc định === qty nếu vật tư không có dòng stock_quant nào. */
  availableQty: number
}

/** 7 kho cố định không xoá được (BE PROTECTED_WAREHOUSE_CODES). */
export const BASE_CODES = new Set(['phoi-son-han', 'vat-tu-tp', 'thanh-pham', 'phoi-son-han-han-pa', 'phoi-son-han-son-pa', 'phoi-son-han-phoi-pha', 'phoi-son-han-han-pha'])

/** Kho ảo (SUPPLIER / PRODUCTION / SCRAP / OPENING_BALANCE) không sửa tồn, không thêm vật tư, không xoá. */
export function quyenTrenKho(isAdmin: boolean, wh: WhQuyen): { canWrite: boolean; isDeletable: boolean } {
  return {
    canWrite: isAdmin && !wh.isVirtual,
    isDeletable: isAdmin && !wh.isVirtual && !BASE_CODES.has(wh.code),
  }
}

/** Tách tồn của 1 vật tư thành từng ô (chiều dài + quy cách). Bỏ ô tồn 0; ô chiều dài 0 có tồn GIỮ stockLengthMm = 0
 *  (để sửa ghi đúng ô 0); không có ô nào thì ra 1 dòng stockLengthMm null, tồn 0. */
export function tachDongTheoO<B extends object>(base: B, rows: QuantRow[]): (B & Pick<StockItem, 'stockLengthMm' | 'bucketSpec' | 'qty' | 'availableQty'>)[] {
  const buckets = rows.filter(r => r.qty !== 0)
  if (buckets.length === 0) return [{ ...base, stockLengthMm: null, qty: 0, availableQty: 0 }]
  return buckets.map(r => ({ ...base, stockLengthMm: r.stockLengthMm, bucketSpec: r.spec ?? '', qty: r.qty, availableQty: r.availableQty }))
}

/** Vật tư sắt cây phần mềm: nhóm Sắt (systemKey STEEL_BAR), nhóm con Phần mềm (SOFTWARE) hoặc để trống (NULL = SOFTWARE). */
export function laSatCay(
  material: { materialGroupId: number | string | null; steelSubGroup?: string | null },
  groups: { id: number | string; systemKey?: string | null }[],
): boolean {
  if (material.materialGroupId == null) return false
  const g = groups.find(x => String(x.id) === String(material.materialGroupId))
  if (g?.systemKey !== 'STEEL_BAR') return false
  return material.steelSubGroup == null || material.steelSubGroup === 'SOFTWARE'
}

export type CachGhiChieuDai =
  | { kind: 'dung-o'; stockLengthMm: number }
  | { kind: 'chon-chieu-dai'; macDinh: number }
  | { kind: 'mac-dinh' }

/** Cách ghi chiều dài khi sửa tồn: dòng đã có ô (kể cả ô 0) thì ghi đúng ô đó; sắt chưa có ô thì bắt chọn chiều dài; còn lại để BE mặc định. */
export function cachGhiChieuDai(it: { stockLengthMm: number | null }, laSat: boolean): CachGhiChieuDai {
  if (it.stockLengthMm !== null) return { kind: 'dung-o', stockLengthMm: it.stockLengthMm }
  if (laSat) return { kind: 'chon-chieu-dai', macDinh: CHIEU_DAI_CAY_MAC_DINH }
  return { kind: 'mac-dinh' }
}

/** Đọc ô "Chiều dài cây (mm)": số nguyên > 0 chia hết cho 50, sai thì null. */
export function docChieuDaiCay(s: string): number | null {
  const t = (s ?? '').trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isSafeInteger(n) && n > 0 && n % 50 === 0 ? n : null
}

export const CAU_CHIEU_DAI_SAI = 'Chiều dài cây phải là số mm chia hết cho 50 (vd 6000)'

export type TrangThaiNhomVatTu = 'ok' | 'dang-tai' | 'loi'

/**
 * Chưa có danh sách nhóm vật tư thì chưa biết vật tư có phải sắt cây không (laSatCay trả false) -> sửa tồn sẽ ghi nhầm vào ô chiều dài 0.
 * Vật tư có nhóm mà nhóm chưa tải được: khoá nút sửa, trả câu giải thích. Vật tư không có nhóm thì không cần danh sách nhóm.
 */
export function lyDoKhoaSuaTon(material: { materialGroupId: number | string | null } | undefined, trangThai: TrangThaiNhomVatTu): string | null {
  if (trangThai === 'ok' || !material || material.materialGroupId == null) return null
  return trangThai === 'dang-tai' ? 'Đang tải nhóm vật tư…' : 'Chưa tải được nhóm vật tư nên chưa sửa tồn được. Bấm Thử lại ở phía trên.'
}
