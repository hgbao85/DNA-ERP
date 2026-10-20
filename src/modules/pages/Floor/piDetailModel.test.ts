import { describe, expect, it } from 'vitest'
import type { BeFloorReview, BeStageDetail } from '../../../services/floor-api'
import { abnormalities, missingText, phoiMaterialsOf, piecesOf, shortMaterials, shortPieces, summarize } from './piDetailModel'

const seg = (cutLengthMm: number, s: { required: number; done: number; failed?: number; openQty?: number; awaitingQcQty?: number }, byOrder?: { productionOrderId: string | null; required: number; done: number; failed: number; openQty?: number; awaitingQcQty?: number }[]) => ({
  segmentSpecId: String(cutLengthMm), cutLengthMm, failed: 0, openQty: 0, awaitingQcQty: 0, ...s, byOrder: byOrder ?? [],
})

const plan = (items: { pieceId: string; plannedQty: number; passedQty: number; awaitingQcQty: number; openQty?: number }[]) => ({
  poNumber: 'PO', salesOrderCode: null, productName: 'Ghế', quantity: 1,
  items: items.map((i) => ({ pieceCode: `M${i.pieceId}`, pieceName: `Mảnh ${i.pieceId}`, rawMaterialOnHand: null, processSteps: [], stepProgress: [], ...i })),
}) as unknown as BeStageDetail['plans'][string]

function detail(over: Partial<BeStageDetail>): BeStageDetail {
  return {
    productionInvoiceId: '45', piCode: 'PI-45', stage: 'PHOI',
    progress: {} as BeStageDetail['progress'],
    orders: [], phoi: [], plans: {}, ...over,
  }
}

describe('piDetailModel', () => {
  const phoi = detail({
    phoi: [
      {
        materialId: '1', materialCode: 'HOP', materialName: 'Sắt hộp', issuedBarCount: 0, steelBalance: null,
        segments: [seg(470, { required: 120, done: 0 })],
        steps: [{ step: 'UON', segments: [seg(470, { required: 120, done: 0 })] }],
      },
      {
        materialId: '2', materialCode: 'PHI4', materialName: 'Sắt phi 4', issuedBarCount: 10,
        steelBalance: { receivedBarCount: 9, usableMm: 1, reportedMm: 2, overMm: 5010 },
        segments: [seg(185, { required: 120, done: 120, failed: 1, openQty: 118 }), seg(60, { required: 600, done: 600, openQty: 599 })],
        steps: [],
      },
      {
        materialId: '3', materialCode: 'V12', materialName: 'Sắt vuông 12', issuedBarCount: 12,
        steelBalance: { receivedBarCount: 12, usableMm: 1, reportedMm: 1, overMm: 0 },
        segments: [seg(441, { required: 60, done: 60, awaitingQcQty: 60 })],
        steps: [],
      },
    ],
  })

  it('còn thiếu: loại chưa nhận sắt lên đầu; thiếu do lỗi KCS cũng tính; loại đủ thì không có', () => {
    const list = shortMaterials(phoiMaterialsOf(phoi, null))
    expect(list.map((m) => [m.code, m.notReceived, m.remaining])).toEqual([['HOP', true, 240], ['PHI4', false, 1]])
    expect(list[0].segments.map((s) => `${s.label} ${s.cutLengthMm}`)).toEqual(['Cắt 470', 'Uốn 470'])
    expect(list[1].segments).toEqual([expect.objectContaining({ cutLengthMm: 185, good: 119, remaining: 1, failed: 1 })])
  })

  it('tổng số = cùng công thức thẻ PI (chặn trần, trừ lỗi)', () => {
    const s = summarize(phoiMaterialsOf(phoi, null), [])
    expect(s).toMatchObject({ required: 1020, reported: 779, awaiting: 60, failed: 1, percent: 76 })
  })

  it('bất thường: báo vượt sắt, đợt chờ quá 4 giờ của ĐÚNG PI, lỗi KCS', () => {
    const now = Date.parse('2026-10-19T10:00:00Z')
    const review = {
      cutBundles: [
        { pi: { productionInvoiceId: '45', code: 'PI-45' }, waitingSince: '2026-10-19T05:00:00Z' },
        { pi: { productionInvoiceId: '99', code: 'PI-99' }, waitingSince: '2026-10-19T01:00:00Z' },
      ],
      stepGroups: [{ pi: { productionInvoiceId: '45', code: 'PI-45' }, waitingSince: '2026-10-19T09:00:00Z' }],
      pieceBatches: [],
    } as unknown as BeFloorReview
    const ab = abnormalities(phoiMaterialsOf(phoi, null), [], review, '45', 'PHOI', now)
    expect(ab.map((a) => a.kind)).toEqual(['steel-over', 'stale', 'qc-failed'])
    expect(ab[1].text).toBe('1 đợt chờ gửi KCS quá 4 giờ')
  })

  it('mảnh: chặn trần theo từng SKU rồi mới gộp (SKU báo vượt không bù SKU thiếu); lọc theo SKU', () => {
    const d = detail({
      stage: 'HAN', phoi: null,
      plans: {
        '41': plan([{ pieceId: '7', plannedQty: 10, passedQty: 15, awaitingQcQty: 0 }]),
        '42': plan([{ pieceId: '7', plannedQty: 10, passedQty: 2, awaitingQcQty: 1, openQty: 1 }]),
      },
    })
    const all = piecesOf(d, null)
    expect(all).toEqual([expect.objectContaining({ key: 'p7', required: 20, reported: 14, remaining: 6, awaiting: 1, open: 1 })])
    expect(piecesOf(d, '42')[0]).toMatchObject({ required: 10, reported: 4, remaining: 6 })
    expect(shortPieces(all).map((p) => p.key)).toEqual(['p7'])
  })

  it('dòng tóm tắt còn thiếu trên thẻ PI', () => {
    expect(missingText({ lines: 39, materials: 6, materialsNotReceived: 4, pieces: 0 }, 4)).toBe('Còn thiếu 6 loại sắt (4 chưa nhận sắt) · 4 đợt chờ gửi KCS')
    expect(missingText({ lines: 5, materials: 0, materialsNotReceived: 0, pieces: 5 }, 0)).toBe('Còn thiếu 5 mảnh')
    expect(missingText({ lines: 2, materials: 0, materialsNotReceived: 0, pieces: 0 }, 0)).toBe('Còn thiếu 2 dòng')
  })

  it('Hàn lệch bộ khi các mảnh báo không đều', () => {
    const d = detail({ stage: 'HAN', phoi: null, plans: { '41': plan([
      { pieceId: '1', plannedQty: 60, passedQty: 0, awaitingQcQty: 12 },
      { pieceId: '2', plannedQty: 60, passedQty: 0, awaitingQcQty: 0 },
    ]) } })
    expect(abnormalities([], piecesOf(d, null), null, '45', 'HAN').map((a) => a.kind)).toEqual(['unbalanced'])
  })
})
