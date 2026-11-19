/**
 * Logic thuần của ngăn "còn thiếu gì" (thẻ PI của tổ ở "Sản lượng xưởng", changelog BE 10-08 mục 45.4/48): từ dữ liệu
 * BE `GET /floor/queue/:stage/detail/:piId` ra danh sách còn thiếu, tổng số theo SKU đang chọn và các bất thường. Mọi số
 * đi qua progressModel.ts (cùng công thức BE) nên khớp thẻ PI và "Tổng hợp lệnh SX".
 */

import type { BeFloorProgress, BeFloorReview, BeStageDetail } from '../../../services/floor-api'
import { lechOf, qtyPerUnitOf, type ProcLine } from '../../../components/sanxuat/core'
import { mapPhoiProgress, type PhoiMaterialView } from '../../../components/sanxuat/PhoiMaterialBoard'
import { bucketLine, isShort, percentOf, pieceLine, remainingQty, steelShortHint, sumBuckets, type ProgressBuckets, type ProgressLineInput } from './progressModel'
import { isStale } from './qlsxUi'

/** 1 mảnh / vật tư thành phẩm (đã gộp theo SKU đang chọn). Số đã chặn trần theo từng (SKU × mảnh) như BE. */
export interface PieceView extends ProgressBuckets {
  key: string
  name: string
  code: string
  remaining: number
  /** Số mảnh / 1 bộ SKU (BE qtyPerUnit hoặc suy từ plannedQty / số bộ). undefined = không biết, hoặc gộp nhiều SKU mà khác
   *  nhau, hoặc vật tư thành phẩm không gắn mảnh (khoá 'm…') - khi đó KHÔNG kết luận lệch bộ (2026-11-17). */
  perUnit?: number
  /** Số lỗi KCS chưa làm bù, tính TỪNG dòng (SKU × mảnh) rồi mới cộng: Σ min(lỗi, còn thiếu − thiếu KCS ghi). Không tính trên số đã gộp. */
  unmade: number
}

/**
 * Lỗi KCS chưa làm bù của 1 dòng: lỗi ở dòng đã đủ số thì không tính; lỗi lớn hơn số còn thiếu thì chỉ tính số còn thiếu.
 * P1 (AC59): phần KCS ghi "thiếu" (không phải lỗi, không cần làm bù) và phần "cắt lại" do công đoạn sau bỏ nằm trong
 * "còn thiếu" nhưng không phải lỗi chưa bù nên trừ ra: min(lỗi, max(0, còn thiếu − thiếu KCS ghi − cắt lại)).
 */
export function unmadeOf(failed: number, remaining: number, shortQty = 0, extraNeed = 0): number {
  return Math.max(0, Math.min(failed, Math.max(0, remaining - shortQty - extraNeed)))
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
  const push = (key: string, name: string, code: string, line: ProgressLineInput, perUnit?: number, shortQty = 0) => {
    const b = bucketLine(line)
    const cur = byKey.get(key)
    if (!cur) {
      byKey.set(key, { key, name, code, ...b, remaining: remainingQty(line), perUnit, unmade: unmadeOf(b.failed, remainingQty(line), shortQty) })
      return
    }
    cur.unmade += unmadeOf(b.failed, remainingQty(line), shortQty)
    if (cur.perUnit !== perUnit) cur.perUnit = undefined // gộp 2 SKU mà khác SL/bộ → không so được
    for (const k of ['required', 'reported', 'passed', 'awaiting', 'open', 'failed'] as const) cur[k] += b[k]
    cur.remaining += remainingQty(line)
  }
  for (const [, plan] of planEntries(detail, orderId)) {
    for (const it of plan.items) push(`p${it.pieceId}`, it.pieceName, it.pieceCode, pieceLine(it), qtyPerUnitOf(it, plan.quantity), it.shortQty ?? 0)
    for (const it of plan.materialYieldItems ?? []) {
      // Vật tư TP: BE chưa trả số lỗi KCS (đạt lấy từ sổ kho theo đợt chốt công đoạn cuối) nên lỗi = 0.
      push(`m${it.materialId}`, it.materialName, it.materialCode, { required: it.plannedQty, done: it.passedQty + it.awaitingQcQty, failed: 0, open: 0, awaiting: it.awaitingQcQty })
    }
  }
  return [...byKey.values()].filter((p) => p.required > 0)
}

/**
 * Có hiện băng "Đồng bộ N bộ" không (2026-11-17): chỉ khi đang xem ĐÚNG 1 SKU. Xem cả lệnh có từ 2 SKU thì mỗi SKU có số bộ
 * riêng (kể cả cùng sản phẩm, khác màu dây / nệm): gộp mảnh rồi chia SL/bộ có thể ra kết luận ngược với tab "Bất thường"
 * (tính theo từng SKU) → ẩn băng, nhắc chọn 1 SKU (QA review 17/11).
 */
export function syncComparable(detail: BeStageDetail, orderId: OrderFilter): boolean {
  return planEntries(detail, orderId).length <= 1
}

/**
 * Tên các SKU đang LỆCH BỘ (2026-11-17): tính THEO TỪNG SKU (mỗi plan có số bộ riêng), bằng số đã chặn trần
 * (bucketLine(pieceLine).reported) - cùng số với tab "Tất cả" khi xem 1 SKU. Mảnh thiếu SL/bộ thì không kết luận (lechOf).
 * Ghi kèm số lệnh (poNumber) vì 2 SKU cùng tên sản phẩm phải phân biệt được.
 */
export function unbalancedOrders(detail: BeStageDetail, orderId: OrderFilter): string[] {
  const out: string[] = []
  for (const [, plan] of planEntries(detail, orderId)) {
    const lines: ProcLine[] = plan.items.map((it, i) => ({
      id: i, itemName: it.pieceName, spec: it.pieceCode, needQty: it.plannedQty,
      doneQty: bucketLine(pieceLine(it)).reported, perManh: qtyPerUnitOf(it, plan.quantity), lastInputAt: null,
    }))
    const label = `${plan.productName} (${plan.poNumber})`
    if (lechOf(lines) && !out.includes(label)) out.push(label)
  }
  return out
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

export interface ShortSegment {
  step: string; label: string; cutLengthMm: number; good: number; required: number; remaining: number; failed: number
  /** Số phải cắt thêm vì công đoạn sau bỏ (đã nằm trong `required`) - hiện "(+N cắt lại)". */
  extraNeed: number
  /** KCS ghi thiếu (không phải lỗi, không cần làm bù). */
  shortQty: number
  /** Lỗi KCS chưa làm bù = unmadeOf(lỗi, còn thiếu, thiếu KCS ghi, cắt lại). */
  unmade: number
}
export interface ShortMaterial {
  materialId: string
  name: string
  code: string
  notReceived: boolean
  remaining: number
  /** Mỗi công đoạn: đã được tính / cần (cả công đoạn đủ cũng hiện để thấy tiến độ). */
  steps: { label: string; done: number; need: number }[]
  segments: ShortSegment[]
  /** Dòng gợi ý thiếu sắt (AC51) - null = đủ sắt / chưa nhận sắt / BE cũ. Chỉ ngăn chi tiết lệnh của QLSX dùng. */
  steelHint: string | null
}

/** Loại sắt còn thiếu: chưa nhận sắt lên đầu, rồi theo số còn thiếu giảm dần. */
export function shortMaterials(materials: PhoiMaterialView[]): ShortMaterial[] {
  const out: ShortMaterial[] = []
  for (const m of materials) {
    const segments: ShortSegment[] = []
    for (const st of m.steps) {
      for (const s of st.segments) {
        const line = { required: s.required, done: s.done, failed: s.failed, open: s.open, awaiting: s.awaiting }
        if (isShort(line)) {
          segments.push({
            step: st.step, label: st.label, cutLengthMm: s.cutLengthMm, good: s.good, required: s.required, remaining: s.remaining, failed: s.failed,
            extraNeed: s.extraNeed, shortQty: s.shortQty, unmade: unmadeOf(s.failed, s.remaining, s.shortQty, s.extraNeed),
          })
        }
      }
    }
    if (segments.length === 0) continue
    out.push({
      materialId: m.materialId, name: m.materialName, code: m.materialCode,
      notReceived: m.steelBalance === null,
      remaining: segments.reduce((a, s) => a + s.remaining, 0),
      steps: m.steps.map((st) => ({ label: st.label, done: st.done, need: st.need })),
      segments,
      steelHint: steelShortHint(m.steelBalance),
    })
  }
  return out.sort((a, b) => Number(b.notReceived) - Number(a.notReceived) || b.remaining - a.remaining)
}

export function shortPieces(pieces: PieceView[]): PieceView[] {
  return pieces.filter((p) => p.remaining > 0).sort((a, b) => b.remaining - a.remaining)
}

export type AbnormalKind = 'steel-over' | 'stale' | 'qc-failed' | 'unbalanced'
export interface Abnormal { kind: AbnormalKind; text: string }

/**
 * Đợt ĐANG MỞ của PI này (từ khối "Đang chờ KCS chấm" của tổ): cắt, công đoạn, lô mảnh - không có pat / chân nhôm (không có sổ báo).
 * Dòng xám (blockedReason: lệnh dừng / chưa gắn SKU) KHÔNG đếm - cùng cách đếm `summary.open` của BE (S5). Mốc chờ = `waitingSince`.
 */
export function openBatchesOf(review: BeFloorReview | null, productionInvoiceId: string) {
  if (!review) return []
  return [...review.cutBundles, ...review.stepGroups, ...review.pieceBatches]
    .filter((b) => b.pi?.productionInvoiceId === productionInvoiceId && !b.blockedReason)
}

/** Lỗi chưa bù của các dòng Phôi (mỗi cỡ đoạn × công đoạn một dòng). */
function unmadeSegments(materials: PhoiMaterialView[]): number {
  let n = 0
  for (const m of materials) for (const st of m.steps) for (const sg of st.segments) n += unmadeOf(sg.failed, sg.remaining, sg.shortQty, sg.extraNeed)
  return n
}

export function abnormalities(
  materials: PhoiMaterialView[],
  pieces: PieceView[],
  review: BeFloorReview | null,
  productionInvoiceId: string,
  stage: string,
  now = Date.now(),
  /** Tên SKU lệch bộ - từ unbalancedOrders(); mặc định không có. */
  unbalanced: string[] = [],
): Abnormal[] {
  const out: Abnormal[] = []
  for (const m of materials) {
    const b = m.steelBalance
    if (b && b.overMm > 0) {
      out.push({ kind: 'steel-over', text: `${m.materialName}: đoạn báo vượt sắt đã nhận ${(b.overMm / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m` })
    }
  }
  // openBatchesOf đã bỏ dòng xám (blockedReason) nên dòng đó không bị đếm vào "quá 4 giờ".
  const stale = openBatchesOf(review, productionInvoiceId).filter((b) => isStale(b.waitingSince, now)).length
  if (stale > 0) out.push({ kind: 'stale', text: `${stale} đợt chờ KCS chấm quá 4 giờ` })
  // 2026-11-18: chỉ đếm lỗi CHƯA bù, tính từng dòng (cỡ đoạn × công đoạn; SKU × mảnh) rồi mới cộng - bù đủ thì hết hiện dù tổng lỗi KCS vẫn còn.
  // 2026-11-18 (QA review): đoạn và cái là 2 đơn vị khác nhau - tách 2 dòng, không cộng lẫn (tổ Phôi có cả đoạn sắt lẫn mảnh như pat).
  const failedSegments = unmadeSegments(materials)
  const failedPieces = pieces.reduce((a, p) => a + p.unmade, 0)
  if (failedSegments > 0) out.push({ kind: 'qc-failed', text: `KCS chấm lỗi ${failedSegments.toLocaleString('vi-VN')} đoạn chưa làm bù` })
  if (failedPieces > 0) out.push({ kind: 'qc-failed', text: `KCS chấm lỗi ${failedPieces.toLocaleString('vi-VN')} cái chưa làm bù` })
  // 2026-11-17: lệch bộ tính theo từng SKU với SL/bộ của định mức (trước gộp mọi SKU + coi mọi mảnh ×1 nên báo sai).
  if (stage !== 'PHOI' && unbalanced.length > 0) {
    out.push({ kind: 'unbalanced', text: `Số mảnh đã báo chưa đồng bộ thành bộ (mảnh này nhiều, mảnh kia ít): ${unbalanced.join(', ')}` })
  }
  return out
}

/** "Còn thiếu 5 loại sắt (2 chưa nhận sắt) · 3 mảnh · 4 đợt đang mở" - chỉ ghi phần có. */
export function missingText(m: BeFloorProgress['missing'], openBatches: number): string {
  const parts: string[] = []
  if (m.materials > 0) parts.push(`${m.materials} loại sắt${m.materialsNotReceived > 0 ? ` (${m.materialsNotReceived} chưa nhận sắt)` : ''}`)
  if (m.pieces > 0) parts.push(`${m.pieces} mảnh`)
  const head = parts.length ? `Còn thiếu ${parts.join(' · ')}` : `Còn thiếu ${m.lines} dòng`
  return openBatches > 0 ? `${head} · ${openBatches} đợt đang mở` : head
}

/** Nhãn công đoạn của breakdown BE ('CAT', 'UON', ..., 'PIECE'). */
export function stepLabel(step: string, stepLabels: Record<string, string>): string {
  return step === 'PIECE' ? 'Mảnh' : stepLabels[step] ?? step
}
