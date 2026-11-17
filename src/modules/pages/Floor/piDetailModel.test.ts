import { describe, expect, it } from 'vitest'
import type { BeFloorReview, BeStageDetail } from '../../../services/floor-api'
import { lechOf, type ProcLine } from '../../../components/sanxuat/core'
import { abnormalities, missingText, phoiMaterialsOf, piecesOf, shortMaterials, shortPieces, summarize, syncComparable, unbalancedOrders } from './piDetailModel'

const seg = (cutLengthMm: number, s: { required: number; done: number; failed?: number; openQty?: number; awaitingQcQty?: number }, byOrder?: { productionOrderId: string | null; required: number; done: number; failed: number; openQty?: number; awaitingQcQty?: number }[]) => ({
  segmentSpecId: String(cutLengthMm), cutLengthMm, failed: 0, openQty: 0, awaitingQcQty: 0, ...s, byOrder: byOrder ?? [],
})

const plan = (items: { pieceId: string; plannedQty: number; passedQty: number; awaitingQcQty: number; openQty?: number; qtyPerUnit?: number }[], quantity = 1, productName = 'Ghế') => ({
  poNumber: 'PO', salesOrderCode: null, productName, quantity,
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
    // 30 bộ, mỗi mảnh ×2: mảnh 1 đã báo 12 (6 bộ), mảnh 2 chưa báo
    const d = detail({ stage: 'HAN', phoi: null, plans: { '41': plan([
      { pieceId: '1', plannedQty: 60, passedQty: 0, awaitingQcQty: 12 },
      { pieceId: '2', plannedQty: 60, passedQty: 0, awaitingQcQty: 0 },
    ], 30) } })
    const ab = abnormalities([], piecesOf(d, null), null, '45', 'HAN', Date.now(), unbalancedOrders(d, null))
    expect(ab.map((a) => a.kind)).toEqual(['unbalanced'])
    expect(ab[0].text).toContain('Ghế')
  })

  // Bộ mẫu: 295 bộ, 7 mảnh SL/bộ 2,2,2,2,4,1,1 (dữ liệu giả).
  const PER = [2, 2, 2, 2, 4, 1, 1]
  const bo = (done: number[], quantity = 295, productName = 'Bàn ghế', idBase = 0) => plan(
    PER.map((p, i) => ({ pieceId: String(idBase + i + 1), plannedQty: p * quantity, passedQty: done[i], awaitingQcQty: 0 })), quantity, productName)
  const full = PER.map((p) => p * 295)

  it('AC5: đủ bộ (số mảnh 590,590,590,590,1180,295,295 / SL/bộ 2,2,2,2,4,1,1) -> không có mục "unbalanced"', () => {
    const d = detail({ stage: 'HAN', phoi: null, plans: { '68': bo(full) } })
    expect(unbalancedOrders(d, null)).toEqual([])
    expect(abnormalities([], piecesOf(d, null), null, '45', 'HAN', Date.now(), unbalancedOrders(d, null)).map((a) => a.kind)).not.toContain('unbalanced')
  })

  it('AC5: mảnh báo dư (592/590) không làm lệch; tab Bất thường khớp băng Đồng bộ ở tab Tất cả', () => {
    const done = [...full]
    done[0] = 592
    const d = detail({ stage: 'HAN', phoi: null, plans: { '68': bo(done) } })
    const bat = unbalancedOrders(d, null)
    // băng ở tab "Tất cả": dựng đúng như QlsxPiDetail.pieceProcLines từ piecesOf
    const ls: ProcLine[] = piecesOf(d, null).map((p, i) => ({ id: i + 1, itemName: p.name, spec: p.code, needQty: p.required, doneQty: p.reported, perManh: p.perUnit, lastInputAt: null }))
    expect(bat).toEqual([])
    expect(lechOf(ls)).toBe(false)
  })

  it('AC5: thiếu 1 mảnh -> cả 2 tab cùng báo lệch', () => {
    const done = [...full]
    done[0] = 580
    const d = detail({ stage: 'HAN', phoi: null, plans: { '68': bo(done) } })
    const ls: ProcLine[] = piecesOf(d, null).map((p, i) => ({ id: i + 1, itemName: p.name, spec: p.code, needQty: p.required, doneQty: p.reported, perManh: p.perUnit, lastInputAt: null }))
    expect(unbalancedOrders(d, null)).toEqual(['Bàn ghế (PO)'])
    expect(lechOf(ls)).toBe(true)
  })

  it('AC6: PI 2 SKU khác sản phẩm, mỗi SKU tự đều -> không "unbalanced" và không so được số bộ chung', () => {
    const d = detail({
      stage: 'HAN', phoi: null,
      plans: {
        '1': bo(PER.map((p) => p * 100), 100, 'Bàn', 0),
        '2': plan([
          { pieceId: '11', plannedQty: 100, passedQty: 100, awaitingQcQty: 0 },
          { pieceId: '12', plannedQty: 100, passedQty: 100, awaitingQcQty: 0 },
        ], 50, 'Ghế'),
      },
    })
    expect(unbalancedOrders(d, null)).toEqual([])
    expect(syncComparable(d, null)).toBe(false)
    expect(syncComparable(d, '1')).toBe(true) // chọn 1 SKU thì xem được
  })

  it('PI 2 SKU CÙNG sản phẩm (cùng mảnh, cùng SL/bộ): gộp vẫn giữ perUnit, nhưng xem cả lệnh thì ẩn băng (mỗi SKU số bộ riêng)', () => {
    const d = detail({ stage: 'HAN', phoi: null, plans: { '68': bo(full, 295), '69': bo(PER.map((p) => p * 100), 100) } })
    expect(syncComparable(d, null)).toBe(false)
    expect(syncComparable(d, '68')).toBe(true)
    expect(piecesOf(d, null).map((p) => p.perUnit)).toEqual(PER)
  })

  it('gộp 2 SKU mà khác SL/bộ của cùng mảnh -> perUnit undefined', () => {
    const d = detail({ stage: 'HAN', phoi: null, plans: {
      '1': plan([{ pieceId: '7', plannedQty: 20, passedQty: 0, awaitingQcQty: 0 }], 10),
      '2': plan([{ pieceId: '7', plannedQty: 30, passedQty: 0, awaitingQcQty: 0 }], 10),
    } })
    expect(piecesOf(d, '1')[0].perUnit).toBe(2)
    expect(piecesOf(d, null)[0].perUnit).toBeUndefined()
  })

  it('vật tư thành phẩm không gắn mảnh (khoá m…) không có perUnit, không lọt vào tính lệch', () => {
    const p = plan([{ pieceId: '1', plannedQty: 10, passedQty: 10, awaitingQcQty: 0 }], 10) as unknown as { materialYieldItems?: unknown[] }
    p.materialYieldItems = [{ materialId: '5', materialCode: 'CN', materialName: 'Chân nhôm', plannedQty: 40, passedQty: 0, awaitingQcQty: 0 }]
    const d = detail({ stage: 'PHOI', phoi: null, plans: { '1': p as unknown as BeStageDetail['plans'][string] } })
    const ps = piecesOf(d, null)
    expect(ps.find((x) => x.key === 'm5')?.perUnit).toBeUndefined()
    expect(ps.find((x) => x.key === 'p1')?.perUnit).toBe(1)
  })
})
