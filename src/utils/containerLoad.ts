/**
 * Phần A – Đợt 1 (YC9): tính thử load cont ở FE (xem trước khi Lưu). CÙNG công thức số nguyên với BE
 * `src/common/utils/container-load.util.ts` và cùng bộ ví dụ test - số chính thức vẫn là số BE lưu và trả về.
 *
 *   load cont = ⌊ thể tích cont ÷ (thể tích 1 thùng × số thùng / bộ) ⌋ ; có số nhập tay thì dùng số nhập tay.
 *
 * Tính bằng mm/mm³ nguyên: 68 ÷ 0,68 bằng số thực ra 99,999… → 99 (sai), số nguyên ra đúng 100.
 */
import type { ContainerLoadSource } from '../types/containerLoad'

export interface ContainerLoadInput {
  boxLengthCm: number | null
  boxWidthCm: number | null
  boxHeightCm: number | null
  boxesPerSet: number
  loadContManual: number | null
}

export interface ContainerLoadResult {
  boxVolumeM3: number | null
  loadContFormula: number | null
  loadCont: number | null
  source: ContainerLoadSource | null
}

const cmToMm = (cm: number): number => Math.round(cm * 10)
const isPositive = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0

export function computeContainerLoad(input: ContainerLoadInput, containerVolumeM3: number): ContainerLoadResult {
  const { boxLengthCm, boxWidthCm, boxHeightCm, loadContManual } = input
  const boxesPerSet = isPositive(input.boxesPerSet) ? Math.round(input.boxesPerSet) : 1

  let boxVolumeM3: number | null = null
  let loadContFormula: number | null = null
  if (isPositive(boxLengthCm) && isPositive(boxWidthCm) && isPositive(boxHeightCm)) {
    const boxMm3 = cmToMm(boxLengthCm) * cmToMm(boxWidthCm) * cmToMm(boxHeightCm)
    boxVolumeM3 = Math.round(boxMm3 / 100_000) / 10_000
    if (isPositive(containerVolumeM3) && boxMm3 > 0) {
      const containerMm3 = Math.round(containerVolumeM3 * 100) * 10_000_000
      loadContFormula = Math.floor(containerMm3 / (boxMm3 * boxesPerSet))
    }
  }

  const manual = isPositive(loadContManual) ? Math.round(loadContManual) : null
  const loadCont = manual ?? loadContFormula
  const source: ContainerLoadSource | null = manual !== null ? 'MANUAL' : loadContFormula !== null ? 'FORMULA' : null
  return { boxVolumeM3, loadContFormula, loadCont, source }
}

/** Số cont tương đương của `qty` bộ; null khi SKU chưa có load cont. */
export function contEquivalent(qty: number, loadCont: number | null | undefined): number | null {
  if (!isPositive(loadCont)) return null
  return qty / loadCont
}

/**
 * "2,5" - cont tương đương làm tròn tối đa 2 số lẻ, dấu phẩy kiểu VN. 20/11/2026 (E2E-3): số khác 0 không hiện thành "0" -
 * rất nhỏ (dưới 0,005) thì ghi "< 0,01".
 */
export function fmtCont(cont: number): string {
  if (cont > 0 && cont < 0.005) return '< 0,01'
  return (Math.round(cont * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

/** "≈ 0,04 cont"; số rất nhỏ thì "< 0,01 cont". */
export function contHintText(cont: number): string {
  const text = fmtCont(cont)
  return text.startsWith('<') ? `${text} cont` : `≈ ${text} cont`
}

/** "0,8438" - thể tích m³ kiểu VN, tối đa 4 số lẻ. */
export function fmtM3(m3: number): string {
  return m3.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}
