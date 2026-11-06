/**
 * Phần A – Đợt 9 phần 2 (Sếp trả lời 06/11): 3 luật đổi mốc CHÉP Y HỆT BE (BE là nguồn đúng - FE chỉ để hiện ngay trên form, BE vẫn kiểm lại):
 *  - Q9-1 = B `resolveAutoShift`: dời 1 mốc sản xuất thì các mốc sản xuất sau tự dời cùng số ngày
 *    (BE `src/modules/production-invoices/deadline-changes/deadline-values.util.ts`).
 *  - Q9-2 = B `milestoneOrderErrors`: thứ tự mốc ngược → không cho lưu dòng đó (BE `src/common/utils/milestone-order.util.ts`, cùng câu chữ).
 *  - Q9-3 `isFloorStarted`: lệnh đã bắt đầu sản xuất (cắt phôi) = lệnh SX `floorStage` khác PENDING → không sửa mốc được nữa.
 * Hàm thuần, không React - test ở deadlineRules.test.ts.
 */
import { DEADLINE_FIELDS, type DeadlineFieldKey, type DeadlineValues } from '../../../services/deadline-changes-api'

// ─── Q9-3 ─────────────────────────────────────────────────────────────────────────────────────────

export const isFloorStarted = (floorStage: string | null | undefined): boolean => !!floorStage && floorStage !== 'PENDING'

/** Câu hiện trên form / màn Sếp khi lệnh đã bắt đầu sản xuất. */
export const FLOOR_STARTED_TEXT = 'Lệnh đã bắt đầu sản xuất (cắt phôi) — không sửa mốc được nữa.'

// ─── Q9-1 ─────────────────────────────────────────────────────────────────────────────────────────

const isStageKey = (k: DeadlineFieldKey): boolean => k.startsWith('stage.')

/** Các mốc SẢN XUẤT theo thứ tự DEADLINE_FIELDS - chỉ những mốc này tự dời. 2 mốc Mua VT và hạn giao không tự dời. */
export const AUTO_SHIFT_KEYS: DeadlineFieldKey[] = DEADLINE_FIELDS.map((f) => f.key).filter(isStageKey)

const DAY_MS = 86_400_000
const utcOfDay = (day: string): number => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))

/** Số ngày từ `from` tới `to` ('YYYY-MM-DD'), âm nếu `to` sớm hơn. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcOfDay(to) - utcOfDay(from)) / DAY_MS)
}

/** 'YYYY-MM-DD' + n ngày lịch. */
export function addDays(day: string, n: number): string {
  return new Date(utcOfDay(day) + n * DAY_MS).toISOString().slice(0, 10)
}

export interface AutoShiftResult {
  /** Đủ mọi khoá DEADLINE_FIELDS: ô gõ + mốc tự dời + mốc giữ nguyên. */
  values: Required<DeadlineValues>
  /** Các mốc TỰ DỜI (không phải ô gõ), theo thứ tự DEADLINE_FIELDS. */
  autoKeys: DeadlineFieldKey[]
}

/**
 * Mốc sản xuất KHSX không gõ mà đã có ngày → dời cùng số ngày với mốc sản xuất GẦN NHẤT PHÍA TRƯỚC nó mà KHSX đã gõ.
 * `old` = mốc đang lưu; `explicit` = ô KHSX gõ (null / vắng = không gõ). Gõ lại đúng ngày cũ = dời 0 ngày → mốc sau đứng yên. Mốc chưa có
 * ngày không tự sinh; gõ ngày cho mốc chưa có ngày không làm dời mốc sau; 2 mốc Mua VT chỉ ô gõ, không tự dời.
 */
export function resolveAutoShift(old: DeadlineValues, explicit: DeadlineValues): AutoShiftResult {
  const values = {} as Required<DeadlineValues>
  const autoKeys: DeadlineFieldKey[] = []
  let delta = 0
  for (const f of DEADLINE_FIELDS) {
    const prev = old[f.key] ?? null
    const typed = explicit[f.key] ?? null
    if (typed !== null) {
      values[f.key] = typed
      if (isStageKey(f.key) && prev !== null) delta = daysBetween(prev, typed)
      continue
    }
    if (isStageKey(f.key) && prev !== null && delta !== 0) {
      values[f.key] = addDays(prev, delta)
      autoKeys.push(f.key)
      continue
    }
    values[f.key] = prev
  }
  return { values, autoKeys }
}

// ─── Q9-2 ─────────────────────────────────────────────────────────────────────────────────────────

const CHAIN: { key: DeadlineFieldKey | 'deliveryDeadline'; label: string }[] = [
  { key: 'materialDeadline', label: 'Mua VT khung & đan' },
  { key: 'stage.PHOI_START', label: 'Bắt đầu Phôi' },
  { key: 'stage.FRAME_PHOI', label: 'Phôi' },
  { key: 'stage.FRAME_HAN', label: 'Hàn' },
  { key: 'stage.FRAME_SON', label: 'Sơn' },
  { key: 'stage.FRAME', label: 'Khung' },
  { key: 'stage.WEAVING', label: 'Nhập đan' },
  { key: 'stage.TRANSFER_CHECK', label: 'Chuyền kiểm' },
  { key: 'stage.PACKAGING_START', label: 'Bắt đầu đóng gói' },
  { key: 'stage.PACKAGING', label: 'Đóng gói' },
  { key: 'deliveryDeadline', label: 'Hạn giao' },
]

const dm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

export type MilestoneOrderValues = DeadlineValues & { deliveryDeadline?: string | null }

/**
 * Mốc ngược thứ tự → câu lỗi (cùng câu chữ với BE). 1 mốc sau sớm hơn → "Hàn (12/11) sớm hơn Phôi (13/11)"; nhiều mốc sau cùng sớm hơn 1
 * mốc → gộp 1 câu "Hàn (07/12) muộn hơn các mốc sau nó: Sơn (09/11), …"; thêm "Mua VT còn lại" phải trước Bắt đầu đóng gói. Mốc trống bỏ qua.
 */
export function milestoneOrderErrors(values: MilestoneOrderValues): string[] {
  const out: string[] = []
  let prev: { label: string; day: string } | null = null
  let later: string[] = []
  const flush = () => {
    if (prev && later.length === 1) out.push(`${later[0]} sớm hơn ${prev.label} (${dm(prev.day)})`)
    else if (prev && later.length > 1) out.push(`${prev.label} (${dm(prev.day)}) muộn hơn các mốc sau nó: ${later.join(', ')}`)
    later = []
  }
  for (const step of CHAIN) {
    const day = values[step.key] ?? null
    if (!day) continue
    if (prev && day < prev.day) {
      later.push(`${step.label} (${dm(day)})`)
      continue
    }
    flush()
    prev = { label: step.label, day }
  }
  flush()
  const remaining = values.finishedMaterialDeadline ?? null
  const before = values['stage.PACKAGING_START'] ?? values['stage.PACKAGING'] ?? null
  if (remaining && before && remaining > before) {
    const beforeLabel = values['stage.PACKAGING_START'] ? 'Bắt đầu đóng gói' : 'Đóng gói'
    out.push(`Mua VT còn lại (${dm(remaining)}) muộn hơn ${beforeLabel} (${dm(before)})`)
  }
  return out
}
