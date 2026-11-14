/**
 * Hàm thuần cho màn Tối ưu cắt sắt (GomDotCatPage) - tách ra để test được, không đụng state/API (13/11/2026, review UI).
 */

import { format } from 'date-fns'
import type { CuttingBatchFixMaterial, CuttingBatchFixOptions, CuttingDefaults } from '../../../services/cutting-batch-api'
import type { SolverMachine } from '../../../types/admin'
import { fmtMm, fmtNum } from '../../../utils/numberFormat'
import { DEFAULT_MERGE_MAX_SKUS, maxGapDays, type SteelNeedSpan } from '../../../utils/steelNeedWindow'

/** 5850.4 -> "5.850 mm". Làm tròn mm TRƯỚC rồi mới ghi (fmtMm giữ tới 3 số lẻ nên 5850.4 sẽ thành "5.850,4 mm"). */
export function fmtBarMm(mm: number): string {
  return fmtMm(Math.round(mm))
}

/** Tối đa `max` mã (bỏ trùng, giữ thứ tự), quá thì "+N". `full` là danh sách đủ để đưa vào title. */
export function summarizeCodes(codes: readonly string[], max = 3): { text: string; full: string } {
  const uniq = [...new Set(codes.filter((c) => c))]
  const shown = uniq.slice(0, max)
  const rest = uniq.length - shown.length
  return { text: shown.join(', ') + (rest > 0 ? ` +${rest}` : ''), full: uniq.join(', ') }
}

/** Dòng đang chọn lên đầu; hai nhóm đều giữ nguyên thứ tự cũ (sắp ổn định, không đảo lung tung khi tick thêm). */
export function selectedFirst<T>(items: readonly T[], isSelected: (it: T) => boolean): T[] {
  const sel: T[] = []
  const rest: T[] = []
  for (const it of items) (isSelected(it) ? sel : rest).push(it)
  return [...sel, ...rest]
}

/** "Xưởng Phước An" giữ nguyên; "Phước An" -> "Xưởng Phước An" (tên xưởng trong DB thường đã có chữ Xưởng). */
export function workshopText(name: string): string {
  return /^x[uư]ởng\b/i.test(name.trim()) ? name.trim() : `Xưởng ${name.trim()}`
}

export type CutModeKey = 'AUTO' | 'ACCEPT_OVER'

/** Dòng tóm tắt thanh dưới cùng: "2 SKU · Xưởng Phước An · MC Tự động · Bình thường". Chưa chọn xưởng thì bỏ phần xưởng (đã có cụm trạng thái đỏ nhắc). */
export function buildBarSummary(p: { count: number; workshopName: string | null; machineLabel: string; cutMode: CutModeKey }): string {
  return [
    `${p.count} SKU`,
    p.workshopName ? workshopText(p.workshopName) : null,
    p.machineLabel,
    p.cutMode === 'ACCEPT_OVER' ? 'Hao hụt cao hơn' : 'Bình thường',
  ].filter(Boolean).join(' · ')
}

export type BarTone = 'red' | 'amber' | 'muted'

/**
 * Cụm trạng thái ở thanh dưới cùng, chỉ MỘT cụm theo thứ tự ưu tiên: thiếu xưởng > thiếu lý do > vượt luật gộp >
 * ước tính có loại sắt vượt ngưỡng > tình trạng kết quả. `fixLink` = có nút "Xem cách xử lý" đi kèm.
 */
export function buildBarStatus(p: {
  workshopChosen: boolean
  reasonMissing: boolean
  ruleBlocked: boolean
  overCount: number
  hasMatchingResult: boolean
  hasOtherResult: boolean
}): { tone: BarTone; text: string; fixLink: boolean } {
  if (!p.workshopChosen) return { tone: 'red', text: 'Chọn xưởng trước khi tính', fixLink: false }
  if (p.reasonMissing) return { tone: 'red', text: 'Chưa điền lý do ở “Chế độ cắt”', fixLink: false }
  if (p.ruleBlocked) return { tone: 'red', text: 'Vượt luật gộp', fixLink: true }
  if (p.overCount > 0) return { tone: 'amber', text: `Ước tính: ${p.overCount} loại sắt có thể vượt ngưỡng`, fixLink: true }
  if (p.hasMatchingResult) return { tone: 'muted', text: 'Đã có kết quả (tab “Kết quả đã tính”)', fixLink: false }
  if (p.hasOtherResult) return { tone: 'muted', text: 'Đã có kết quả nhưng với máy/chế độ khác', fixLink: false }
  return { tone: 'muted', text: 'Chưa tính', fixLink: false }
}

export type PctSource = 'checked' | 'estimate'

/**
 * Màu con số hao hụt theo NGUỒN: số bộ giải đã kiểm - đạt ngưỡng xanh, không đạt đỏ; số ước tính (chưa kiểm) luôn vàng cam,
 * vì ước tính chưa đủ để kết luận đạt hay không.
 */
export function pctColor(source: PctSource, meetsThreshold: boolean): string {
  if (source === 'estimate') return 'var(--fg-b45309)'
  return meetsThreshold ? 'var(--fg-166534)' : 'var(--fg-b91c1c)'
}

/**
 * Loại sắt có cây vượt ngưỡng: số % kèm theo là TỔNG hao hụt tốt nhất của cả đợt nếu chấp nhận các cây vượt đó
 * (không phải phương án hệ thống tự chọn). `thr` và `total` đã ghi sẵn (vd "1%", "16,75%").
 */
export function overThresholdText(thr: string, total: string): string {
  return `có cây vượt ${thr}; chấp nhận các cây đó thì cả đợt hao thấp nhất ${total}`
}


// ─── Hằng và hàm thuần dùng chung giữa trang chính và các khối trong ./gomDotCat/ ──────────────────────────

/** Cây chuẩn công ty đang mua. Chỉ dùng làm PLACEHOLDER / nhãn dự phòng - số thật hiển thị trên chip luôn lấy từ BE. */
export const DEFAULT_STOCK_LENGTH_MM = 6000
/** Cùng khoảng BE chặn (stock-lengths-by-material.validator.ts) - bắt sớm ca gõ 6 hay 600 thay vì 6000. */
export const MIN_STOCK_LENGTH_MM = 500
export const MAX_STOCK_LENGTH_MM = 20000

/** date-fns 'dd/MM': toLocaleDateString('vi-VN') của Chrome in "01-11", lệch với "01/11" mọi màn khác. */
export const fmtDate = (iso: string | null) => (iso ? format(new Date(iso), 'dd/MM') : '—')

/** Cây đặt riêng luôn tròn 5 cm - BE làm tròn lên bội 50 mm cả số KHSX gõ (stock-length-grid.ts): 5830 -> 5850. */
export function roundUp5cm(mm: number): number {
  return Math.ceil(mm / 50 - 1e-9) * 50
}

/** Nhãn loại sắt "Tên · Quy cách"; thiếu tên thì rơi về mã. Mã đưa vào `title` ở chỗ dùng. */
export function materialLabel(name: string | null | undefined, spec: string | null | undefined, code: string): string {
  const n = name?.trim() || code
  const s = spec?.trim()
  return s ? `${n} · ${s}` : n
}

/** Ô chiều dài cây đang gõ dở / sai khoảng (ô rỗng = dùng cây chuẩn, không tính là sai). */
export function isBadStockLength(raw: string): boolean {
  if (raw.trim() === '') return false
  const n = Number(raw)
  return !(Number.isFinite(n) && n >= MIN_STOCK_LENGTH_MM && n <= MAX_STOCK_LENGTH_MM)
}

export interface MaterialInTable {
  id: string
  code: string
  name: string
  spec: string | null
  label: string
  stockLengthMm: number | null
}

/**
 * Mỗi QUY CÁCH đúng MỘT dòng, gom từ mọi SKU trong bảng (một loại sắt xuất hiện ở nhiều dòng SKU nhưng chỉ có một ô chiều dài).
 * Nhiều loại sắt trùng TÊN, chỉ khác quy cách nên nhãn = "Tên · Quy cách".
 */
export function collectMaterialsInTable(
  items: readonly { materials: readonly {
    materialId: string; materialCode: string; materialName?: string | null; materialSpec?: string | null; stockLengthMm: number | null
  }[] }[],
): MaterialInTable[] {
  const map = new Map<string, MaterialInTable>()
  for (const it of items) {
    for (const m of it.materials) {
      if (map.has(m.materialId)) continue
      map.set(m.materialId, {
        id: m.materialId,
        code: m.materialCode,
        name: m.materialName?.trim() || m.materialCode,
        spec: m.materialSpec?.trim() || null,
        label: materialLabel(m.materialName, m.materialSpec, m.materialCode),
        stockLengthMm: m.stockLengthMm,
      })
    }
  }
  return [...map.values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'vi') || (a.spec ?? '').localeCompare(b.spec ?? '', 'vi') || a.code.localeCompare(b.code),
  )
}

/** "cây chuẩn 6.000 mm" khi đúng cây chuẩn, "cây 5.850 mm" khi KHSX đã đổi chiều dài. */
export function stdLabelFor(len: number | null, stdLenMm: number): string {
  return len != null && len !== stdLenMm ? `cây ${fmtBarMm(len)}` : `cây chuẩn ${fmtBarMm(stdLenMm)}`
}

/** "· mốc cần sắt 12/11 → 15/11" (ngày đã sắp tăng dần); chưa có mốc thì "· chưa có mốc cần sắt". */
export function needDatesText(sortedDates: readonly string[]): string {
  if (sortedDates.length === 0) return '· chưa có mốc cần sắt'
  const first = sortedDates[0]
  const last = sortedDates[sortedDates.length - 1]
  if (sortedDates.length === 1 || first.slice(0, 10) === last.slice(0, 10)) return `· mốc cần sắt ${fmtDate(first)}`
  return `· mốc cần sắt ${fmtDate(first)} → ${fmtDate(last)}`
}

/**
 * Lý do KHÔNG gộp được đợt đang chọn (null = gộp được): ưu tiên câu BE trả (đúng đợt đang tick), rồi tới quá số SKU tối đa,
 * rồi mốc cần sắt cách nhau quá khung N ngày.
 */
export function buildRuleReason(p: {
  beReason: string | null
  selectedCount: number
  mergeMax: number
  mergeWindow: number
  span: SteelNeedSpan | null
}): string | null {
  if (p.beReason) return p.beReason
  if (p.selectedCount > p.mergeMax) return `Đợt gồm ${p.selectedCount} SKU, tối đa ${p.mergeMax} SKU mỗi đợt/lệnh gộp.`
  const span = p.span
  if (!span || span.days <= maxGapDays(p.mergeWindow)) return null
  return `Mốc cần sắt của các SKU trong đợt cách nhau ${span.days} ngày `
    + `(sớm nhất ${fmtDate(span.earliest.date)} – ${span.earliest.code}, muộn nhất ${fmtDate(span.latest.date)} – ${span.latest.code})`
    + ` - chỉ được gộp trong khung ${p.mergeWindow} ngày (chênh tối đa ${maxGapDays(p.mergeWindow)} ngày).`
}

export type FixKey = 'add' | 'custom' | 'urgent'

/**
 * "Nên chọn" = cách ĐẠT ngưỡng có hao hụt thấp nhất. Xưởng có luật số cỡ (`hasWsRule`): chưa có số chính xác của cây riêng
 * nên không đưa "đặt riêng" vào so sánh.
 */
export function bestFixKey(m: CuttingBatchFixMaterial, hasWsRule: boolean): FixKey | null {
  const cands: { k: FixKey; pct: number }[] = []
  if (m.addSuggestion?.meetsThreshold) cands.push({ k: 'add', pct: m.addSuggestion.wastePct })
  if (!hasWsRule && m.customLength && m.customLength.wastePct <= m.thresholdPct) cands.push({ k: 'custom', pct: m.customLength.wastePct })
  if (m.urgent && m.urgent.wastePct <= m.thresholdPct) cands.push({ k: 'urgent', pct: m.urgent.wastePct })
  return cands.length ? cands.reduce((x, y) => (y.pct < x.pct ? y : x)).k : null
}

/** Chia loại sắt của gợi ý xử lý theo trạng thái; chưa có gợi ý đúng đợt đang tick (`fix` null) thì rỗng cả ba. */
export function splitFixMaterials(fix: CuttingBatchFixOptions | null) {
  const list = fix?.materials ?? []
  return {
    over: list.filter((m) => m.status === 'over'),
    ok: list.filter((m) => m.status === 'ok'),
    unknown: list.filter((m) => m.status === 'unknown'),
  }
}

export interface MachineParam { label: string; value: string; hint?: string }

/** Số cây/bó theo quy cách, sắp theo mã (V15 trước V20). */
export function bundleSpecEntriesOf(defaults: CuttingDefaults | null): [string, number[]][] {
  return Object.entries(defaults?.solverBundleFactorsBySpec ?? {}).sort(([a], [b]) => a.localeCompare(b, 'vi', { numeric: true }))
}

/** Phần riêng của MC Tự động trong khối thông số: lưỡi, tề đầu, số cây/bó, cắt tay, cỡ đoạn/kiểu cắt. */
function tuDongParams(d: CuttingDefaults, specCount: number): MachineParam[] {
  const hasSpecs = specCount > 0
  return [
    { label: 'Lưỡi cắt', value: fmtMm(d.solverMctdBladeWidthMm ?? 0) },
    { label: 'Tề đầu', value: fmtMm(d.solverMctdTrimStartMm ?? 0) },
    hasSpecs
      ? { label: 'Số cây/bó', value: `Theo bảng quy cách (${specCount})`, hint: 'Số cây/bó theo quy cách (bảng ở Cấu hình hệ thống)' }
      : { label: 'Số cây mỗi bó', value: `${(d.solverBundleFactors ?? []).map(fmtNum).join(' / ')} cây` },
    // Quy cách có trong bảng: phần lẻ không đủ bó cắt lẻ tới (bó nhỏ nhất − 1) cây.
    hasSpecs
      ? {
          label: 'Cắt lẻ (phần không đủ bó)',
          value: 'Tối đa (bó nhỏ nhất − 1) cây',
          hint: 'Mỗi loại sắt cắt lẻ tối đa (bó nhỏ nhất − 1) cây',
        }
      : { label: 'Cắt tay tối đa', value: `${fmtNum(d.solverMaxManualCuts ?? 0)} cây/loại sắt` },
    { label: 'Cỡ đoạn tối đa/kiểu cắt', value: fmtNum(d.solverMaxSizesPerPattern ?? 0) },
  ]
}

/** Phần riêng của MC Laser: lưỡi, tề đầu và luật đoạn cuối (nhát cắt cuối phải ra 1 đoạn dài hơn số này, tính cả cùi). */
function laserParams(d: CuttingDefaults): MachineParam[] {
  const tail = d.solverLaserMinTailMm ?? 0
  return [
    { label: 'Lưỡi cắt', value: fmtMm(d.solverBladeWidthMm ?? 0) },
    { label: 'Tề đầu', value: fmtMm(d.solverTrimStartMm ?? 0) },
    ...(tail > 0
      ? [{
          label: 'Đoạn cuối tối thiểu',
          value: `Dài hơn ${fmtMm(tail)}`,
          hint: 'Nhát cắt cuối phải ra 1 đoạn dài hơn số này (đoạn dài nhất + cùi, cắt tay)',
        }]
      : []),
  ]
}

/**
 * Thông số máy cắt hiện tại cho khối CHỈ XEM của KHSX: phần riêng của máy `machine` + phần chung. null khi BE cũ chưa trả
 * (khối không hiện).
 */
export function buildMachineParams(
  d: CuttingDefaults | null,
  machine: SolverMachine,
  workshopNameOf: (code: string) => string | undefined,
): MachineParam[] | null {
  if (!d || d.solverBundleFactors == null) return null
  const specCount = bundleSpecEntriesOf(d).length
  const perWorkshop = Object.entries(d.solverMaxSizesPerBarByWorkshop ?? {})
  return [
    ...(machine === 'tu_dong' ? tuDongParams(d, specCount) : laserParams(d)),
    { label: 'Cây chuẩn', value: (d.solverStockLengths ?? []).map((n) => fmtMm(n)).join(' / ') },
    { label: 'Dư tối đa mỗi cỡ đoạn', value: `${fmtNum(d.solverMaxSurplus ?? 0)} đoạn` },
    ...(perWorkshop.length > 0
      ? [{
          label: 'Cỡ đoạn tối đa/cây theo xưởng',
          value: perWorkshop.map(([code, n]) => `${workshopNameOf(code) ?? code}: ${fmtNum(n)}`).join(' · '),
        }]
      : []),
    ...(d.solverMergeWindowDays != null
      ? [{
          label: 'Luật gộp (mốc cần sắt)',
          value: `Khung ${fmtNum(d.solverMergeWindowDays)} ngày, tối đa ${fmtNum(d.solverMergeMaxSkus ?? DEFAULT_MERGE_MAX_SKUS)} SKU`,
        }]
      : []),
  ]
}

export interface CutModeOption { value: CutModeKey; label: string; desc: string }

/**
 * 2 tình huống cắt KHSX chọn cho đợt sắp tạo, đặt tên theo NGHIỆP VỤ (bên dưới quy về solverAllowCustomLength /
 * solverMaxWastePctOverride). "Chấp nhận hao hụt cao hơn" luôn giữ đúng chiều dài cây đã định.
 */
export const CUT_MODES: CutModeOption[] = [
  {
    value: 'AUTO',
    label: 'Bình thường (mặc định)',
    desc: 'Dùng mức “Hao hụt tối đa” ở phần cài đặt. Cây chuẩn nào đạt thì chốt luôn; không cây nào đạt thì tự dò thêm '
      + 'chiều dài khác rồi mới đặt. Không có cách cắt nào đạt thì báo “Cần xử lý” (chưa có phương án để tạo lệnh).',
  },
  {
    value: 'ACCEPT_OVER',
    label: 'Chấp nhận hao hụt cao hơn (đơn gấp)',
    desc: 'Dùng cho đợt gấp: chỉ cắt trên đúng chiều dài cây đã định (cây chuẩn, hoặc chiều dài đặt ở ô “Chiều dài cây sắt”), '
      + 'không dò cây khác; không đặt trần hao hụt cho riêng đợt này, hệ thống tự tìm phương án hao hụt nhỏ nhất trên cây đó '
      + '(không đổi mức mặc định). Kết quả hiện ngay sau khi tính; Sếp thấy lý do và % hao hụt thật khi duyệt lệnh sản xuất.',
  },
]

/** Câu giải thích "Chế độ cắt" cho tooltip / khối Giải thích: nhãn bỏ phần "(…)", ghép bằng `sep`. */
export function cutModesHelp(sep: string): string {
  return CUT_MODES.map((m) => `${m.label.replace(/ \(.*\)$/, '')}: ${m.desc}`).join(sep)
}
