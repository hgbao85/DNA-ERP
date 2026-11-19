/**
 * Định nghĩa SỐ DUY NHẤT của tiến độ tổ (changelog BE 2026-10-08 mục 45.2/47) — bản sao đúng công thức của BE
 * `src/modules/floor/floor-progress.util.ts` (thẻ PI của tổ ở "Sản lượng xưởng", nhắc "đủ số"). Sửa 1 bên thì sửa
 * cả bên kia, nếu không 2 màn lại ra 2 con số.
 *
 * Mỗi dòng (cỡ đoạn × công đoạn của Phôi, hoặc mảnh):
 *   Đã báo = Đang mở + KCS đang chấm + KCS đã chấm (Đạt + Lỗi)
 *   Được tính = Đã báo − Lỗi        Còn thiếu = max(0, Cần − Được tính)
 * Tiến độ = Σ min(Được tính, Cần) / Σ Cần trên mọi dòng — dòng báo vượt không che dòng còn thiếu.
 * P1: số KCS ghi "thiếu" đã được BE trừ khỏi `done` (đã báo − thiếu, vẫn gồm lỗi) nên công thức không đổi.
 */

/** Số gốc của 1 dòng: `done` là TỔNG đã báo (gồm đang mở + KCS đang chấm + đã chấm, đã trừ phần KCS ghi thiếu); `failed` = KCS chấm lỗi. */
export interface ProgressLineInput {
  required: number
  done: number
  failed: number
  /** Phần của `done` đang mở (công nhân đã báo, KCS chưa bấm Chấm). */
  open: number
  /** Phần của `done` KCS đang chấm (đã chốt, chưa lưu kết quả). */
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

/** Chia 1 dòng vào 3 ngăn theo thứ tự đạt → KCS đang chấm → đang mở rồi chặn trần (báo vượt thì cắt "đang mở" trước). */
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

/**
 * Mảnh từ batch-plan: `passedQty` đã là số ĐẠT sau KCS (lỗi đã trừ), `failedQty` = lỗi KCS cộng dồn (thiếu thì 0).
 * Đã báo (done) = đạt + lỗi + KCS đang chấm + đang mở; Được tính = done − failed nên số tiến độ / còn thiếu không đổi.
 * Phần KCS ghi thiếu (shortQty) đã nằm ngoài passedQty - nó nằm trong "còn thiếu" nhưng KHÔNG phải lỗi chưa bù (xem unmadeOf).
 */
export function pieceLine(it: { plannedQty: number; passedQty: number; awaitingQcQty: number; openQty?: number; failedQty?: number }): ProgressLineInput {
  const open = it.openQty ?? 0
  const failed = it.failedQty ?? 0
  return { required: it.plannedQty, done: it.passedQty + failed + it.awaitingQcQty + open, failed, open, awaiting: it.awaitingQcQty }
}

const dm = (mm: number) => (mm / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** Số nguyên có dấu ngăn nghìn kiểu Việt (2.899), cùng kiểu "1.242,5 m" (QA nghiệm thu 19/11). */
const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * AC51: dòng gợi ý thiếu sắt của 1 loại sắt (chỉ đọc, chỉ ở ngăn chi tiết lệnh của QLSX), vd
 * "Còn phải cắt 10 đoạn (gồm 10 đoạn cắt lại) - sắt còn ước 2,0 m, thiếu khoảng 2,8 m".
 * null = đủ sắt, hoặc BE cũ chưa trả các trường này. Không biết chiều dài cây (issuableMm = null) thì ghi thêm
 * "(chưa tính sắt kho còn xuất)".
 */
export function steelShortHint(b: {
  remainingSegments?: number; recutSegments?: number; leftoverReceivedMm?: number; issuableMm?: number | null; shortMm?: number
} | null | undefined): string | null {
  if (!b || b.shortMm === undefined || b.remainingSegments === undefined || b.leftoverReceivedMm === undefined) return null
  if (b.shortMm <= 0 || b.remainingSegments <= 0) return null
  const recut = (b.recutSegments ?? 0) > 0 ? ` (gồm ${num(b.recutSegments ?? 0)} đoạn cắt lại)` : ''
  const unknown = b.issuableMm === null ? ' (chưa tính sắt kho còn xuất)' : ''
  return `Còn phải cắt ${num(b.remainingSegments)} đoạn${recut} - sắt còn ước ${dm(b.leftoverReceivedMm)} m, thiếu khoảng ${dm(b.shortMm)} m${unknown}`
}
