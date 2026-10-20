/**
 * Logic thuần của ngăn "còn thiếu gì" (thẻ PI của tổ ở "Sản lượng xưởng", changelog BE 10-08 mục 45.4/48): từ dữ liệu
 * BE `GET /floor/queue/:stage/detail/:piId` ra danh sách còn thiếu, tổng số theo SKU đang chọn và các bất thường. Mọi số
 * đi qua progressModel.ts (cùng công thức BE) nên khớp thẻ PI và "Tổng hợp lệnh SX".
 */

import type { BeFloorProgress, BeFloorReview, BeStageDetail } from '../../../services/floor-api'
import { lechOf, type ProcLine } from '../../../components/sanxuat/core'
import { mapPhoiProgress, type PhoiMaterialView } from '../../../components/sanxuat/PhoiMaterialBoard'
import { bucketLine, isShort, percentOf, pieceLine, remainingQty, sumBuckets, type ProgressBuckets, type ProgressLineInput } from './progressModel'
import { isStale } from './qlsxUi'

/** 1 mảnh / vật tư thành phẩm (đã gộp theo SKU đang chọn). Số đã chặn trần theo từng (SKU × mảnh) như BE. */
export interface PieceView extends ProgressBuckets {
  key: string
  name: string
  code: string
  remaining: number
}

/** null = cả PI (mọi SKU). */
export type OrderFilter = string | null

function planEntries(detail: BeStageDetail, orderId: OrderFilter) {
  return Object.entries(detail.plans).filter(([id]) => orderId === null || id === orderId)
}

export function phoiMaterialsOf(detail: BeStageDetail, orderId: OrderFilter): PhoiMaterialView[] {
  return detail.phoi ? mapPhoiProgress(detail.phoi, orderId) : []
}

/** Mảnh của tổ (Hàn/Sơn, hoặc mảnh Phôi + vật tư thành phẩm), mỗi (SKU × mảnh) chặn trần riêng rồi mới gộp theo mảnh. */
export function piecesOf(detail: BeStageDetail, orderId: OrderFilter): PieceView[] {
  const byKey = new Map<string, PieceView>()
  const push = (key: string, name: string, code: string, line: ProgressLineInput) => {
    const b = bucketLine(line)
    const cur = byKey.get(key)
    if (!cur) {
      byKey.set(key, { key, name, code, ...b, remaining: remainingQty(line) })
      return
    }
    for (const k of ['required', 'reported', 'passed', 'awaiting', 'open', 'failed'] as const) cur[k] += b[k]
    cur.remaining += remainingQty(line)
  }
  for (const [, plan] of planEntries(detail, orderId)) {
    for (const it of plan.items) push(`p${it.pieceId}`, it.pieceName, it.pieceCode, pieceLine(it))
    for (const it of plan.materialYieldItems ?? []) {
      push(`m${it.materialId}`, it.materialName, it.materialCode, { required: it.plannedQty, done: it.passedQty + it.awaitingQcQty, failed: 0, open: 0, awaiting: it.awaitingQcQty })
    }
  }
  return [...byKey.values()].filter((p) => p.required > 0)
}

/** Tổng số của tổ theo SKU đang chọn - với "cả PI" ra đúng số thẻ PI (BE computeProgress). */
export function summarize(materials: PhoiMaterialView[], pieces: PieceView[]): ProgressBuckets & { percent: number } {
  const lines: ProgressBuckets[] = []
  for (const m of materials) {
    for (const st of m.steps) {
      for (const s of st.segments) {
        lines.push({ required: s.required, reported: s.good, passed: s.passed, awaiting: s.awaiting, open: s.open, failed: s.failed })
      }
    }
  }
  const t = sumBuckets([...lines, ...pieces])
  return { ...t, percent: percentOf(t.reported, t.required) }
}

export interface ShortSegment { step: string; label: string; cutLengthMm: number; good: number; required: number; remaining: number; failed: number }
export interface ShortMaterial {
  materialId: string
  name: string
  code: string
  notReceived: boolean
  remaining: number
  /** Mỗi công đoạn: đã được tính / cần (cả công đoạn đủ cũng hiện để thấy tiến độ). */
  steps: { label: string; done: number; need: number }[]
  segments: ShortSegment[]
}

/** Loại sắt còn thiếu: chưa nhận sắt lên đầu, rồi theo số còn thiếu giảm dần. */
export function shortMaterials(materials: PhoiMaterialView[]): ShortMaterial[] {
  const out: ShortMaterial[] = []
  for (const m of materials) {
    const segments: ShortSegment[] = []
    for (const st of m.steps) {
      for (const s of st.segments) {
        const line = { required: s.required, done: s.done, failed: s.failed, open: s.open, awaiting: s.awaiting }
        if (isShort(line)) segments.push({ step: st.step, label: st.label, cutLengthMm: s.cutLengthMm, good: s.good, required: s.required, remaining: s.remaining, failed: s.failed })
      }
    }
    if (segments.length === 0) continue
    out.push({
      materialId: m.materialId, name: m.materialName, code: m.materialCode,
      notReceived: m.steelBalance === null,
      remaining: segments.reduce((a, s) => a + s.remaining, 0),
      steps: m.steps.map((st) => ({ label: st.label, done: st.done, need: st.need })),
      segments,
    })
  }
  return out.sort((a, b) => Number(b.notReceived) - Number(a.notReceived) || b.remaining - a.remaining)
}

export function shortPieces(pieces: PieceView[]): PieceView[] {
  return pieces.filter((p) => p.remaining > 0).sort((a, b) => b.remaining - a.remaining)
}

export type AbnormalKind = 'steel-over' | 'stale' | 'qc-failed' | 'unbalanced'
export interface Abnormal { kind: AbnormalKind; text: string }

/** Đợt chờ gửi KCS của PI này (từ danh sách "Chờ gửi KCS" của tổ). */
export function openBatchesOf(review: BeFloorReview | null, productionInvoiceId: string) {
  if (!review) return []
  return [...review.cutBundles, ...review.stepGroups, ...review.pieceBatches].filter((b) => b.pi?.productionInvoiceId === productionInvoiceId)
}

export function abnormalities(
  materials: PhoiMaterialView[],
  pieces: PieceView[],
  review: BeFloorReview | null,
  productionInvoiceId: string,
  stage: string,
  now = Date.now(),
): Abnormal[] {
  const out: Abnormal[] = []
  for (const m of materials) {
    const b = m.steelBalance
    if (b && b.overMm > 0) {
      out.push({ kind: 'steel-over', text: `${m.materialName}: đoạn báo vượt sắt đã nhận ${(b.overMm / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m` })
    }
  }
  const stale = openBatchesOf(review, productionInvoiceId).filter((b) => isStale(b.waitingSince, now)).length
  if (stale > 0) out.push({ kind: 'stale', text: `${stale} đợt chờ gửi KCS quá 4 giờ` })
  const failed = materials.reduce((a, m) => a + m.failed, 0) + pieces.reduce((a, p) => a + p.failed, 0)
  if (failed > 0) out.push({ kind: 'qc-failed', text: `KCS chấm lỗi ${failed.toLocaleString('vi-VN')} ${materials.length ? 'đoạn' : 'cái'} - cần làm bù` })
  if (stage !== 'PHOI' && pieces.length > 1) {
    const lines: ProcLine[] = pieces.map((p, i) => ({ id: i, itemName: p.name, spec: p.code, needQty: p.required, doneQty: p.reported, lastInputAt: null }))
    if (lechOf(lines)) out.push({ kind: 'unbalanced', text: 'Số mảnh đã báo chưa đồng bộ thành bộ (mảnh này nhiều, mảnh kia ít)' })
  }
  return out
}

/** "Còn thiếu 5 loại sắt (2 chưa nhận sắt) · 3 mảnh · 4 đợt chờ gửi KCS" - chỉ ghi phần có. */
export function missingText(m: BeFloorProgress['missing'], openBatches: number): string {
  const parts: string[] = []
  if (m.materials > 0) parts.push(`${m.materials} loại sắt${m.materialsNotReceived > 0 ? ` (${m.materialsNotReceived} chưa nhận sắt)` : ''}`)
  if (m.pieces > 0) parts.push(`${m.pieces} mảnh`)
  const head = parts.length ? `Còn thiếu ${parts.join(' · ')}` : `Còn thiếu ${m.lines} dòng`
  return openBatches > 0 ? `${head} · ${openBatches} đợt chờ gửi KCS` : head
}

/** Nhãn công đoạn của breakdown BE ('CAT', 'UON', ..., 'PIECE'). */
export function stepLabel(step: string, stepLabels: Record<string, string>): string {
  return step === 'PIECE' ? 'Mảnh' : stepLabels[step] ?? step
}
