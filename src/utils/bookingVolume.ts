/**
 * Phần A – Đợt 10a (YC5): tính thử tổng m³ của booking ở FE (xem trước khi Lưu). CÙNG luật với BE - số chính thức
 * vẫn là số BE lưu và trả về. Tính bằng SỐ NGUYÊN, đơn vị 1e-4 m³:
 *   đơn vị = Math.round(boxVolumeM3 × 10000) × boxesPerSet × qty ; cộng nguyên rồi chia 10000.
 */
export interface BookingVolumeLine {
  qty: number
  boxVolumeM3: number | null
  boxesPerSet: number
  factoryCode: string
}

export interface BookingTotalsPreview {
  /** 3 số lẻ */
  totalM3: number
  /** thể tích cont × số cont, 2 số lẻ */
  capacityM3: number
  /** 1 số lẻ; null khi sức chứa 0 */
  fillPct: number | null
  missingVolumeSkus: string[]
}

const hasVolume = (v: number | null): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

export function bookingTotalsPreview(
  lines: BookingVolumeLine[],
  containerVolumeM3: number,
  containerQty: number,
): BookingTotalsPreview {
  let units = 0
  const missing: string[] = []
  for (const l of lines) {
    const qty = Number.isFinite(l.qty) ? Math.round(l.qty) : 0
    if (qty <= 0) continue
    if (!hasVolume(l.boxVolumeM3)) {
      if (!missing.includes(l.factoryCode)) missing.push(l.factoryCode)
      continue
    }
    const perSet = Number.isFinite(l.boxesPerSet) && l.boxesPerSet > 0 ? Math.round(l.boxesPerSet) : 1
    units += Math.round(l.boxVolumeM3 * 10000) * perSet * qty
  }
  const totalM3 = Math.round(units / 10) / 1000
  const capacityM3 = Math.round(Math.max(0, containerVolumeM3) * Math.max(0, containerQty) * 100) / 100
  const fillPct = capacityM3 > 0 ? Math.round((units / 10000 / capacityM3) * 1000) / 10 : null
  return { totalM3, capacityM3, fillPct, missingVolumeSkus: missing }
}
