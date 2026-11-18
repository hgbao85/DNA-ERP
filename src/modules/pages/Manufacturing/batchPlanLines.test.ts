import { describe, expect, it } from 'vitest'
import type { BeProductionBatchPlan } from '../../../services/production-batches-api'
import { lechOf, syncSummary } from '../../../components/sanxuat/syncSummary'
import { mapBatchPlanToLines } from './batchPlanLines'

const PER = [2, 2, 2, 2, 4, 1, 1]
const QTY = 295

function plan(opts: { withQtyPerUnit?: boolean; done?: number[]; quantity?: number } = {}): BeProductionBatchPlan {
  const quantity = opts.quantity ?? QTY
  return {
    poNumber: 'PO-1', salesOrderCode: null, productName: 'Bộ bàn ghế mẫu', quantity,
    items: PER.map((p, i) => ({
      pieceId: String(i + 1), pieceCode: `M${i + 1}`, pieceName: `Mảnh ${i + 1}`,
      plannedQty: p * QTY, passedQty: opts.done?.[i] ?? p * QTY, awaitingQcQty: 0, openQty: 0,
      ...(opts.withQtyPerUnit ? { qtyPerUnit: p } : {}),
    })),
  } as unknown as BeProductionBatchPlan
}

describe('mapBatchPlanToLines', () => {
  it('suy perManh = plannedQty / quantity khi BE chưa trả qtyPerUnit; đủ 295 bộ thì không lệch', () => {
    const ls = mapBatchPlanToLines(plan())
    expect(ls.map((l) => l.perManh)).toEqual(PER)
    expect(lechOf(ls)).toBe(false)
    expect(syncSummary(ls).db).toBe(295)
  })

  it('dùng thẳng qtyPerUnit của BE khi có (kể cả khi plannedQty không chia hết cho quantity)', () => {
    const p = plan({ withQtyPerUnit: true })
    p.items[0].plannedQty = 591
    expect(mapBatchPlanToLines(p)[0].perManh).toBe(2)
  })

  it('1 mảnh thiếu thì lệch; doneQty = đã báo (đạt + chờ KCS + chưa gửi)', () => {
    const p = plan({ done: [580, 590, 590, 590, 1180, 295, 295] })
    p.items[1].awaitingQcQty = 0
    const ls = mapBatchPlanToLines(p)
    expect(lechOf(ls)).toBe(true)
    expect(syncSummary(ls).needCut).toEqual(['Mảnh 1 +10'])
  })

  it('BE trả failedQty (KCS chấm lỗi chưa bù): Đã báo, cần thêm và số bộ đồng bộ KHÔNG đổi so với khi thiếu trường', () => {
    const base = plan({ done: [480, 590, 590, 590, 1180, 295, 295] })
    const withFailed = plan({ done: [480, 590, 590, 590, 1180, 295, 295] })
    ;(withFailed.items[0] as { failedQty?: number }).failedQty = 100
    const a = mapBatchPlanToLines(base)
    const b = mapBatchPlanToLines(withFailed)
    expect(b.map((l) => l.doneQty)).toEqual(a.map((l) => l.doneQty))
    expect(b[0].doneQty).toBe(480)
    expect(syncSummary(b).db).toBe(syncSummary(a).db)
    expect(syncSummary(b).needCut).toEqual(syncSummary(a).needCut)
  })

  it('không biết số bộ của lệnh -> perManh undefined, không kết luận lệch', () => {
    const ls = mapBatchPlanToLines(plan({ quantity: 0, done: [10, 590, 590, 590, 1180, 295, 295] }))
    expect(ls.every((l) => l.perManh === undefined)).toBe(true)
    expect(lechOf(ls)).toBe(false)
  })

  it('plan null -> rỗng', () => {
    expect(mapBatchPlanToLines(null)).toEqual([])
  })
})
