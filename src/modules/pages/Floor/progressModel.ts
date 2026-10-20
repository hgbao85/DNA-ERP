/**
 * Định nghĩa SỐ DUY NHẤT của tiến độ tổ (changelog BE 2026-10-08 mục 45.2/47) — bản sao đúng công thức của BE
 * `src/modules/floor/floor-progress.util.ts` (thẻ PI của tổ ở "Sản lượng xưởng", nhắc "đủ số"). Sửa 1 bên thì sửa
 * cả bên kia, nếu không 2 màn lại ra 2 con số.
 *
 * Mỗi dòng (cỡ đoạn × công đoạn của Phôi, hoặc mảnh):
 *   Đã báo = Chưa gửi KCS + Chờ KCS + KCS đã chấm (Đạt + Lỗi)
 *   Được tính = Đã báo − Lỗi        Còn thiếu = max(0, Cần − Được tính)
 * Tiến độ = Σ min(Được tính, Cần) / Σ Cần trên mọi dòng — dòng báo vượt không che dòng còn thiếu.
 */

/** Số gốc của 1 dòng: `done` là TỔNG đã báo (gồm chưa gửi + chờ KCS + đã chấm); `failed` = KCS chấm lỗi. */
export interface ProgressLineInput {
  required: number
  done: number
  failed: number
  /** Phần của `done` chưa gửi KCS. */
  open: number
  /** Phần của `done` đã gửi KCS, đang chờ chấm. */
  awaiting: number
}

/** Đã chặn trần ở `required`: passed + awaiting + open = reported ≤ required. `failed` không chặn trần. */
export interface ProgressBuckets {
  required: number
  reported: number
  passed: number
  awaiting: number
  open: number
  failed: number
}

export const emptyBuckets = (): ProgressBuckets => ({ required: 0, reported: 0, passed: 0, awaiting: 0, open: 0, failed: 0 })

export function goodQty(line: Pick<ProgressLineInput, 'done' | 'failed'>): number {
  return Math.max(0, line.done - line.failed)
}

export function remainingQty(line: ProgressLineInput): number {
  return Math.max(0, line.required - goodQty(line))
}

export function isShort(line: ProgressLineInput): boolean {
  return line.required > 0 && goodQty(line) < line.required
}

/** Chia 1 dòng vào 3 ngăn theo thứ tự đạt → chờ KCS → chưa gửi rồi chặn trần (báo vượt thì cắt "chưa gửi" trước). */
export function bucketLine(line: ProgressLineInput): ProgressBuckets {
  const good = goodQty(line)
  // Tổng 3 ngăn = min(Đã báo − Lỗi, Cần) - kể cả khi dữ liệu lệch (lỗi lớn hơn phần đã chấm) cũng không vượt.
  const cap = Math.min(good, line.required)
  const passedRaw = Math.max(0, good - line.open - line.awaiting)
  const passed = Math.min(passedRaw, cap)
  const awaiting = Math.min(line.awaiting, cap - passed)
  const open = Math.min(line.open, cap - passed - awaiting)
  return { required: line.required, reported: passed + awaiting + open, passed, awaiting, open, failed: line.failed }
}

export function sumBuckets(list: ProgressBuckets[]): ProgressBuckets {
  const acc = emptyBuckets()
  for (const b of list) {
    acc.required += b.required
    acc.reported += b.reported
    acc.passed += b.passed
    acc.awaiting += b.awaiting
    acc.open += b.open
    acc.failed += b.failed
  }
  return acc
}

/** Cùng quy tắc `pctOf` của "Tổng hợp lệnh SX" và `percentOf` của BE: làm tròn xuống, có làm thì ≥ 1%. */
export function percentOf(reported: number, required: number): number {
  if (required <= 0) return 0
  const done = Math.min(reported, required)
  return Math.min(100, Math.max(done > 0 ? 1 : 0, Math.floor((done / required) * 100)))
}

/** Mảnh từ batch-plan: `passedQty` đã là số ĐẠT sau KCS (lỗi đã trừ) nên failed = 0. */
export function pieceLine(it: { plannedQty: number; passedQty: number; awaitingQcQty: number; openQty?: number }): ProgressLineInput {
  const open = it.openQty ?? 0
  return { required: it.plannedQty, done: it.passedQty + it.awaitingQcQty + open, failed: 0, open, awaiting: it.awaitingQcQty }
}
