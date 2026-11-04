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

/** "2,5" - cont tương đương làm tròn 1 chữ số thập phân, dấu phẩy kiểu VN. */
export function fmtCont(cont: number): string {
  return (Math.round(cont * 10) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

/** "0,8438" - thể tích m³ kiểu VN, tối đa 4 số lẻ. */
export function fmtM3(m3: number): string {
  return m3.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}
