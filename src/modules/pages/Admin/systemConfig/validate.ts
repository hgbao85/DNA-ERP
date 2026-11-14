/**
 * Kiểm tra và đổi chữ đang gõ thành số của màn Cấu hình hệ thống, trước khi gửi BE (báo lỗi ngay tại ô thay vì để BE trả 400).
 * Hàm thuần: không đụng state, không gọi API. `validateConfig` chạy từng bước có tên, mỗi bước ghi vào `next` (bản sao cấu hình)
 * hoặc `errs` (lỗi theo ô).
 */
import type { SystemConfig } from '../../../../types/admin'
import { LSX_PREFIX_PATTERN, parseLsxPrefixes } from '../../../../utils/lenhCode'
import {
  CAPACITY_FIELDS, CONTAINER_VOLUME_FIELD, LASER_FIELDS, MC_NUM_FIELDS, MERGE_FIELDS, SHARED_FIELDS, SPEC_CODE_RE, WS_SIZES_PREFIX,
  type McKey, type SpecRow,
} from './mcFields'

export type McText = Partial<Record<McKey, string>>
export type McErrors = Partial<Record<McKey, string>>

export interface ValidateInput {
  values: SystemConfig
  mcText: McText
  /** null = chưa sửa bảng quy cách (giữ dữ liệu đã lưu). */
  specRows: SpecRow[] | null
  workshops: { code: string }[]
}

export interface ValidateResult {
  next: SystemConfig
  errs: McErrors
  /** Lỗi từng dòng của bảng quy cách (khoá = key dòng); null khi bảng chưa sửa. */
  specRowErrors: Record<number, string> | null
}

type Ctx = { next: SystemConfig; errs: McErrors; text: McText }

const NUMERIC_FIELDS = [...LASER_FIELDS, ...MC_NUM_FIELDS, ...SHARED_FIELDS, ...MERGE_FIELDS, CONTAINER_VOLUME_FIELD, ...CAPACITY_FIELDS]

/** "14 16, 18;20" -> [14, 16, 18, 20] (chưa kiểm hợp lệ). */
export const parseNumberList = (text: string): number[] => text.split(/[\s,;]+/).filter(Boolean).map(Number)

const uniqueSorted = (nums: number[]) => [...new Set(nums)].sort((a, b) => a - b)

/** Lỗi của ô "Tiền tố số LSX": mỗi tiền tố gồm 1 đến 6 chữ cái; null nếu hợp lệ (để trống cũng hợp lệ). */
export function lsxPrefixError(text: string): string | null {
  const bad = parseLsxPrefixes(text).filter((p) => !LSX_PREFIX_PATTERN.test(p))
  return bad.length > 0 ? `Tiền tố sai: ${bad.join(', ')} - mỗi tiền tố gồm 1 đến 6 chữ cái (không số, không dấu gạch)` : null
}

/** Tên công ty và tiền tệ là bắt buộc (tab Công ty). */
export function requiredFieldError(values: Pick<SystemConfig, 'companyName' | 'defaultCurrency'>): string | null {
  if (!values.companyName.trim()) return 'Tên công ty là bắt buộc'
  if (!values.defaultCurrency.trim()) return 'Đơn vị tiền tệ là bắt buộc'
  return null
}

/** Các ô số: trong khoảng min-max, đúng kiểu nguyên / thập phân, bước dò chiều dài là bội 50. */
function checkNumericFields({ next, errs, text }: Ctx) {
  for (const f of NUMERIC_FIELDS) {
    const raw = text[f.name]
    if (raw === undefined) continue
    const n = Number(raw.trim().replace(',', '.'))
    if (raw.trim() === '' || !Number.isFinite(n) || n < f.min || n > f.max || (f.integer && !Number.isInteger(n))) {
      errs[f.name] = `Phải là ${f.integer ? 'số nguyên' : 'số'} từ ${f.min} đến ${f.max}`
      continue
    }
    if (f.name === 'solverLengthStepMm' && n % 50 !== 0) {
      errs[f.name] = 'Phải là bội 50 mm (50, 100, 150…) vì cây đặt riêng luôn tròn 5 cm'
      continue
    }
    // Thể tích cont và cont/ngày giữ 2 số lẻ (BE cũng làm tròn 2 số lẻ); hao hụt tối đa: cột DB Decimal(6,3).
    next[f.name] = f.name === 'containerVolumeM3' || f.name === 'capacityContPerDay' ? Math.round(n * 100) / 100
      : f.name === 'solverMaxWastePercentage' ? Math.round(n * 1000) / 1000
      : n
  }
}

function checkStockLengths({ next, errs, text }: Ctx) {
  if (text.solverStockLengths === undefined) return
  const parts = parseNumberList(text.solverStockLengths)
  if (parts.length < 1 || parts.length > 10 || parts.some((n) => !Number.isInteger(n) || n < 500 || n > 20000)) {
    errs.solverStockLengths = 'Gồm 1 đến 10 số nguyên từ 500 đến 20000, cách nhau bằng dấu cách (vd 6000)'
  } else {
    next.solverStockLengths = uniqueSorted(parts)
  }
}

/**
 * Số cỡ đoạn tối đa/cây theo xưởng: ô để trống = bỏ luật riêng của xưởng; chỉ gửi xưởng có giá trị. Khoá lạ (xưởng không còn
 * trong danh sách) giữ nguyên.
 */
function checkWorkshopSizes({ next, errs, text }: Ctx, workshops: { code: string }[]) {
  const edited = workshops.filter((w) => text[`${WS_SIZES_PREFIX}${w.code}` as McKey] !== undefined)
  if (edited.length === 0) return
  const map: Record<string, number> = { ...(next.solverMaxSizesPerBarByWorkshop ?? {}) }
  for (const w of edited) {
    const key = `${WS_SIZES_PREFIX}${w.code}` as McKey
    const raw = (text[key] ?? '').trim()
    if (raw === '') { delete map[w.code]; continue }
    const n = Number(raw.replace(',', '.'))
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      errs[key] = 'Phải là số nguyên từ 1 đến 10 (để trống = không giới hạn riêng)'
      continue
    }
    map[w.code] = n
  }
  next.solverMaxSizesPerBarByWorkshop = map
}

/** Lỗi của 1 dòng bảng quy cách, null nếu hợp lệ. `seen` = các mã đã có (kiểm trùng). */
function specRowError(code: string, rawFactors: string, seen: Record<string, number[]>): string | null {
  if (!SPEC_CODE_RE.test(code)) return 'Mã quy cách phải dạng V20 (sắt vuông), H13-26 (sắt hộp) hoặc FI19 (sắt phi)'
  if (Object.prototype.hasOwnProperty.call(seen, code)) return `Mã ${code} bị trùng`
  const parts = parseNumberList(rawFactors)
  if (parts.length < 1 || parts.length > 12 || parts.some((n) => !Number.isInteger(n) || n < 2 || n > 500)) {
    return 'Gồm 1 đến 12 số nguyên từ 2 đến 500, cách nhau bằng dấu cách hoặc phẩy (vd 60 64 68)'
  }
  if (new Set(parts).size !== parts.length) return 'Các số cây/bó không được trùng nhau'
  return null
}

/**
 * Bảng số cây/bó theo quy cách: dòng trống hẳn bỏ qua; mã tự viết hoa + bỏ khoảng trắng; kiểm mã, trùng mã, danh sách số.
 * Trả bảng đã chuẩn hoá + lỗi từng dòng.
 */
export function checkSpecRows(rows: SpecRow[]): { map: Record<string, number[]>; rowErrs: Record<number, string> } {
  const rowErrs: Record<number, string> = {}
  const map: Record<string, number[]> = {}
  for (const r of rows) {
    const code = r.code.replace(/\s+/g, '').toUpperCase()
    const rawFactors = r.factors.trim()
    if (code === '' && rawFactors === '') continue
    const err = specRowError(code, rawFactors, map)
    if (err) { rowErrs[r.key] = err; continue }
    map[code] = uniqueSorted(parseNumberList(rawFactors))
  }
  return { map, rowErrs }
}

/** BE không kiểm cặp này - ngắn nhất lớn hơn dài nhất thì bộ giải không có chiều dài nào để dò. */
function checkLengthRange({ next, errs }: Ctx) {
  if (!errs.solverMinLengthMm && !errs.solverMaxLengthMm && next.solverMinLengthMm > next.solverMaxLengthMm) {
    errs.solverMaxLengthMm = 'Phải lớn hơn hoặc bằng “Cây đặt riêng ngắn nhất”'
  }
}

function checkBundleFactors({ next, errs, text }: Ctx) {
  if (text.solverBundleFactors === undefined) return
  const parts = parseNumberList(text.solverBundleFactors)
  if (parts.length < 1 || parts.length > 8 || parts.some((n) => !Number.isInteger(n) || n <= 1)) {
    errs.solverBundleFactors = 'Gồm 1 đến 8 số nguyên lớn hơn 1, cách nhau bằng dấu cách (vd 14 16 18 20)'
  } else {
    next.solverBundleFactors = uniqueSorted(parts)
  }
}

export function validateConfig(input: ValidateInput): ValidateResult {
  const ctx: Ctx = { next: { ...input.values }, errs: {}, text: input.mcText }
  checkNumericFields(ctx)
  checkStockLengths(ctx)
  checkWorkshopSizes(ctx, input.workshops)
  let specRowErrors: Record<number, string> | null = null
  if (input.specRows !== null) {
    const { map, rowErrs } = checkSpecRows(input.specRows)
    specRowErrors = rowErrs
    if (Object.keys(rowErrs).length > 0) {
      ctx.errs.solverBundleFactorsBySpec = 'Bảng số cây/bó theo quy cách có dòng chưa hợp lệ — xem thông báo dưới từng dòng.'
    } else {
      ctx.next.solverBundleFactorsBySpec = map
    }
  }
  checkLengthRange(ctx)
  checkBundleFactors(ctx)
  return { next: ctx.next, errs: ctx.errs, specRowErrors }
}
