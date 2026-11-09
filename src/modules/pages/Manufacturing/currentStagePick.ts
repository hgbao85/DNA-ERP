// Chọn "Công đoạn hiện tại" của 1 lệnh ở màn Tổng hợp lệnh SX (hàm thuần, có test).
// Luật (2026-11-09, ca GP-182): công đoạn hiện tại = công đoạn XA NHẤT đã bắt đầu làm (có số > 0), % là của
// công đoạn đó - KHÔNG phải công đoạn sớm nhất chưa đủ 100% (cũ: khung 99% vì 2 chân lỗi KCS Hàn làm lệnh
// trông như kẹt ở khung dù đan/chuyền kiểm/đóng gói đã xong). Đóng gói đủ số mà lệnh chưa Kết thúc ->
// 'PACKED_WAIT_END' (100%). Lệnh đã Kết thúc -> 'DONE'.

export type PickStageKey = 'PURCHASING' | 'FRAME' | 'WEAVING' | 'CHUYEN_KIEM' | 'PACKAGING'

export interface ParallelStageInput {
  key: Exclude<PickStageKey, 'PURCHASING'>
  pct: number
  /** Công đoạn không áp dụng cho lệnh này (bỏ qua). */
  na: boolean
}

export type CurrentStagePick =
  | { kind: 'DONE'; pct: 100 }
  | { kind: 'PACKED_WAIT_END'; pct: 100 }
  | { kind: 'STAGE'; stage: PickStageKey; pct: number }

export function pickCurrentStage(input: {
  status: string
  mfgStage?: PickStageKey | null
  purchasingPct: number
  /** Theo đúng thứ tự công đoạn: Khung, Đan, Chuyền kiểm, Đóng gói. */
  parallel: ParallelStageInput[]
}): CurrentStagePick {
  if (input.status === 'DONE') return { kind: 'DONE', pct: 100 }
  if (input.mfgStage === 'PURCHASING') return { kind: 'STAGE', stage: 'PURCHASING', pct: input.purchasingPct }

  const packaging = input.parallel.find(s => s.key === 'PACKAGING' && !s.na)
  if (packaging && packaging.pct >= 100) return { kind: 'PACKED_WAIT_END', pct: 100 }

  let furthest: ParallelStageInput | null = null
  for (const s of input.parallel) {
    if (s.na) continue
    if (s.pct > 0) furthest = s
  }
  if (furthest) return { kind: 'STAGE', stage: furthest.key, pct: furthest.pct }
  return { kind: 'STAGE', stage: 'FRAME', pct: 0 }
}
