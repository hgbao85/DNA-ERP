/**
 * Phần A – Đợt 9 (YC2): hàm thuần dùng chung cho form "Sửa thời hạn", hộp xem trước Excel và hộp Lịch sử đổi mốc
 * (nhãn loại / trạng thái, định dạng ngày, câu tóm tắt sau khi lưu, nhận biết dòng đã duyệt / đang chờ / đã Kết thúc).
 * Không React, không gọi API - test ở deadlineChange.test.ts.
 */
import type {
  DeadlineEntryCheck,
  DeadlineEntryKind,
  DeadlineFieldChange,
  DeadlineHistoryEntry,
  DeadlineSaveResult,
  PendingDeadlineChangeRef,
  DeadlineFieldKey,
  DeadlineValues,
} from '../../../services/deadline-changes-api'
import { daysBetween, isFloorStarted, milestoneOrderErrors, resolveAutoShift } from './deadlineRules'

/** Màu nhãn - ánh xạ sang biến CSS ở nơi hiển thị. */
export type DeadlineTone = 'green' | 'yellow' | 'red' | 'blue' | 'gray'

export const TONE_STYLE: Record<DeadlineTone, { color: string; background: string }> = {
  green: { color: 'var(--fg-2e7d32)', background: 'var(--bg-dcfce7)' },
  yellow: { color: 'var(--fg-b45309)', background: 'var(--bg-fef3c7)' },
  red: { color: 'var(--fg-b91c1c)', background: 'var(--bg-fee2e2)' },
  blue: { color: 'var(--fg-1d4ed8)', background: 'var(--bg-dbeafe)' },
  gray: { color: 'var(--text3)', background: 'var(--surface2)' },
}

// ─── Nhận biết trạng thái dòng SKU ────────────────────────────────────────────────────────────────

/** Phần của dòng SKU (item trong response PI đã qua toItem) mà các hàm dưới đọc - BE cũ chưa trả `pendingDeadlineChange` thì coi như null. */
export interface DeadlineItemLike {
  prodApproval?: { status?: string } | null
  floorStage?: string | null
  pendingDeadlineChange?: PendingDeadlineChangeRef | null
}

/**
 * FREE chưa Sếp duyệt (sửa thẳng) · APPROVED Sếp đã duyệt (sửa phải gửi duyệt lại) · PENDING đang chờ Sếp duyệt lại · ENDED lệnh đã Kết thúc ·
 * STARTED (Phần A – Đợt 9 phần 2, Q9-3) lệnh đã bắt đầu sản xuất (cắt phôi) - khoá như ENDED.
 */
export type DeadlineItemState = 'FREE' | 'APPROVED' | 'PENDING' | 'ENDED' | 'STARTED'

export function itemDeadlineState(item: DeadlineItemLike | null | undefined): DeadlineItemState {
  if (item?.floorStage === 'FINISHED') return 'ENDED'
  if (item?.pendingDeadlineChange) return 'PENDING'
  if (isFloorStarted(item?.floorStage)) return 'STARTED'
  if (item?.prodApproval?.status === 'APPROVED') return 'APPROVED'
  return 'FREE'
}

/** Dòng Sếp đã duyệt và lệnh chưa Kết thúc (kể cả đang chờ duyệt lại và đã bắt đầu sản xuất). */
export const isRunningItem = (item: DeadlineItemLike | null | undefined): boolean => {
  const s = itemDeadlineState(item)
  return s === 'APPROVED' || s === 'PENDING' || s === 'STARTED'
}

/** PI thuộc tab "Đang chạy": có ít nhất 1 dòng SKU đã duyệt mà lệnh chưa Kết thúc, PI chưa huỷ / xong. */
export function isRunningPi(pi: { status?: string; items?: DeadlineItemLike[] } | null | undefined): boolean {
  if (!pi || pi.status === 'CANCELLED' || pi.status === 'DONE') return false
  return (Array.isArray(pi.items) ? pi.items : []).some(isRunningItem)
}

// ─── Ngày ─────────────────────────────────────────────────────────────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/

/** 'YYYY-MM-DD' (hoặc ISO) → 'dd/mm' ; rỗng → '(chưa có)'. */
export function fmtDayShort(s: string | null | undefined): string {
  const m = typeof s === 'string' ? DAY_RE.exec(s) : null
  return m ? `${m[3]}/${m[2]}` : '(chưa có)'
}

/** 'YYYY-MM-DD' (hoặc ISO) → 'dd/mm/yyyy' ; rỗng → '(chưa có)'. */
export function fmtDayFull(s: string | null | undefined): string {
  const m = typeof s === 'string' ? DAY_RE.exec(s) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '(chưa có)'
}

/** Thời điểm ISO → 'dd/mm/yyyy HH:mm' theo giờ máy. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 'Khung: 10/11 → 12/11' */
export const fmtChange = (c: Pick<DeadlineFieldChange, 'label' | 'from' | 'to'>): string => `${c.label}: ${fmtDayShort(c.from)} → ${fmtDayShort(c.to)}`

/** Tên file tải về: ke-hoach-san-xuat-<yyyymmdd-hhmm>.xlsx (giờ máy). */
export function planFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `ke-hoach-san-xuat-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.xlsx`
}

// ─── Nhãn ─────────────────────────────────────────────────────────────────────────────────────────

export const HISTORY_KIND_LABEL: Record<DeadlineHistoryEntry['kind'], string> = {
  DIRECT: 'Sửa thẳng',
  REQUESTED: 'Gửi Sếp duyệt',
  APPROVED: 'Sếp duyệt',
  REJECTED: 'Sếp từ chối',
  CANCELLED: 'Huỷ yêu cầu',
}

export const HISTORY_KIND_TONE: Record<DeadlineHistoryEntry['kind'], DeadlineTone> = {
  DIRECT: 'blue',
  REQUESTED: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'gray',
}

export const historySourceLabel = (source: DeadlineHistoryEntry['source']): string =>
  source === 'EXCEL' ? 'Excel' : source === 'MANUAL' ? 'Sửa tay' : '—'

export const ENTRY_KIND_LABEL: Record<DeadlineEntryKind, string> = {
  APPLY: 'Ghi ngay',
  NEEDS_APPROVAL: 'Chờ Sếp duyệt lại',
  NO_CHANGE: 'Không đổi',
  ERROR: 'Lỗi',
}

export const ENTRY_KIND_TONE: Record<DeadlineEntryKind, DeadlineTone> = {
  APPLY: 'green',
  NEEDS_APPROVAL: 'yellow',
  NO_CHANGE: 'gray',
  ERROR: 'red',
}

// ─── Tóm tắt sau khi lưu / xác nhận ───────────────────────────────────────────────────────────────

export interface SaveSummary {
  message: string
  /** Cảnh báo (vd thứ tự mốc ngược) - vàng, không chặn; mỗi câu đã kèm mã SKU. */
  warnings: string[]
  tone: 'green' | 'yellow'
}

/** Cảnh báo của các dòng đã ghi / đã gửi duyệt, bỏ trùng. */
function collectWarnings(res: DeadlineSaveResult): string[] {
  const out: string[] = []
  const add = (sku: string, ws: string[] | undefined) => {
    for (const w of ws ?? []) {
      const line = sku ? `${sku}: ${w}` : w
      if (!out.includes(line)) out.push(line)
    }
  }
  for (const a of res.applied ?? []) add(a.skuCode, a.warnings)
  for (const r of res.batch?.requests ?? []) add(r.skuCode, r.warnings)
  return out
}

/**
 * "Đã lưu N SKU. M SKU đã gửi Sếp duyệt lại." (+ "K SKU bị bỏ vì lỗi." với Excel). `res` rỗng (BE cũ chưa trả `deadlineSave`)
 * → câu chung "Đã lưu thời hạn.".
 */
export function summarizeSave(res: DeadlineSaveResult | null | undefined): SaveSummary {
  if (!res) return { message: 'Đã lưu thời hạn.', warnings: [], tone: 'green' }
  const n = res.applied?.length ?? 0
  const m = res.batch?.requests?.length ?? 0
  const k = res.skipped?.length ?? 0
  const parts: string[] = []
  if (n > 0) parts.push(`Đã lưu ${n} SKU.`)
  if (m > 0) parts.push(`${m} SKU đã gửi Sếp duyệt lại (mốc cũ vẫn chạy tới khi Sếp duyệt).`)
  if (k > 0) parts.push(`${k} SKU bị bỏ vì lỗi.`)
  if (parts.length === 0) parts.push('Không có mốc nào thay đổi.')
  return { message: parts.join(' '), warnings: collectWarnings(res), tone: m > 0 || k > 0 ? 'yellow' : 'green' }
}

/** Dòng NEEDS_APPROVAL / APPLY có cảnh báo: tên hiển thị "MY-313 · SKU123". */
export const entryLabel = (e: Pick<DeadlineEntryCheck, 'lenhCode' | 'skuCode'>): string =>
  [e.lenhCode, e.skuCode].filter(Boolean).join(' · ')

// ─── Phần A – Đợt 9 phần 2: tự dời mốc + chặn thứ tự ngược trên form "Sửa thời hạn" ─────────────────────────────────

/** Ô ngày của form (trừ hạn giao) - khớp EditVals ở LenhSXPage. */
export type DeadlineFormField =
  | 'materialDeadline' | 'finishedMaterialDeadline'
  | 'PHOI_START' | 'PHOI' | 'HAN' | 'SON' | 'FRAME' | 'WEAVING' | 'TRANSFER_CHECK' | 'PACKAGING_START' | 'PACKAGING'

/** Ô của form → khoá mốc của luật (deadlineRules). Hạn giao không thuộc luật. */
export const FORM_FIELD_KEY: Record<DeadlineFormField, DeadlineFieldKey> = {
  materialDeadline: 'materialDeadline',
  finishedMaterialDeadline: 'finishedMaterialDeadline',
  PHOI_START: 'stage.PHOI_START',
  PHOI: 'stage.FRAME_PHOI',
  HAN: 'stage.FRAME_HAN',
  SON: 'stage.FRAME_SON',
  FRAME: 'stage.FRAME',
  WEAVING: 'stage.WEAVING',
  TRANSFER_CHECK: 'stage.TRANSFER_CHECK',
  PACKAGING_START: 'stage.PACKAGING_START',
  PACKAGING: 'stage.PACKAGING',
}
export const DEADLINE_FORM_FIELDS = Object.keys(FORM_FIELD_KEY) as DeadlineFormField[]

export interface FormAutoShiftResult<V> {
  /** Giá trị các ô sau khi áp tự dời (ô khác giữ nguyên). */
  vals: V
  /** Ô đang TỰ DỜI → số ngày dời so với mốc đã lưu (khác 0). */
  auto: Partial<Record<DeadlineFormField, number>>
}

/**
 * Q9-1: áp luật tự dời lên 1 dòng của form. `saved` = mốc ĐÃ LƯU (null nếu chưa lưu - ô chỉ là đề xuất thì không bao giờ tự dời);
 * `touched` = ô KHSX đã chạm (giá trị ô; chạm mà để trống = gõ lại ngày đã lưu, dời 0); `prevAuto` = ô đang tự dời ở lần trước - nay không
 * còn tự dời (vd KHSX gõ lại mốc trước về ngày cũ) thì trả về ngày đã lưu. Ô KHSX vừa chạm không bao giờ bị ghi đè.
 */
export function applyFormAutoShift<V extends Record<DeadlineFormField, string>>(args: {
  saved: Record<DeadlineFormField, string | null>
  vals: V
  touched: ReadonlySet<DeadlineFormField>
  prevAuto: ReadonlySet<DeadlineFormField>
}): FormAutoShiftResult<V> {
  const { saved, vals, touched, prevAuto } = args
  const old: DeadlineValues = {}
  const explicit: DeadlineValues = {}
  for (const f of DEADLINE_FORM_FIELDS) {
    const key = FORM_FIELD_KEY[f]
    old[key] = saved[f] ?? null
    if (touched.has(f)) explicit[key] = vals[f] || (saved[f] ?? null)
  }
  const { values, autoKeys } = resolveAutoShift(old, explicit)
  const out = { ...vals }
  const auto: Partial<Record<DeadlineFormField, number>> = {}
  for (const f of DEADLINE_FORM_FIELDS) {
    if (touched.has(f)) continue
    const key = FORM_FIELD_KEY[f]
    if (autoKeys.includes(key)) {
      const to = values[key]
      const from = saved[f]
      if (to && from) {
        out[f] = to as V[DeadlineFormField]
        auto[f] = daysBetween(from, to)
      }
    } else if (prevAuto.has(f)) {
      out[f] = (saved[f] ?? '') as V[DeadlineFormField]
    }
  }
  return { vals: out, auto }
}

/** "(tự dời +3)" / "(tự dời −2)". */
export const autoShiftLabel = (days: number): string => `tự dời ${days > 0 ? '+' : '−'}${Math.abs(days)}`

/**
 * Q9-2: thứ tự mốc ngược của 1 dòng SẼ GỬI ĐI. `saved` = mốc đã lưu, `sent` = giá trị sẽ gửi (chồng lên mốc đã lưu), `delivery` = hạn giao
 * dùng để so. Dòng không đổi thật so với đã lưu thì không kiểm (trả []).
 */
export function projectedOrderErrors(saved: DeadlineValues, sent: DeadlineValues, delivery: string | null): string[] {
  const keys = Object.keys(sent) as DeadlineFieldKey[]
  if (!keys.some((k) => !!sent[k] && sent[k] !== (saved[k] ?? null))) return []
  const projected: DeadlineValues = { ...saved }
  for (const k of keys) if (sent[k]) projected[k] = sent[k]
  return milestoneOrderErrors({ ...projected, deliveryDeadline: delivery })
}
