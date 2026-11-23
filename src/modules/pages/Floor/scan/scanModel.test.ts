import { describe, expect, it } from 'vitest'
import type { BeMyOutputRow, BeScanContext, BeScanMaterial } from '../../../../services/floor-api'
import {
  anySegmentOverMax, groupByDay, hasPickablePi, kcsBatchLabel, kcsLabel, kcsLabelRowIds, materialsForSku, missingPiecesText,
  needPiAction, noPiText, pickablePis, soleStagePi, opCaption, pieceAction, pieceConfirmRow, pieceMaxNow, reportTitle, rowBadges, segmentAction, segmentConfirmRows,
  segmentLeft, segmentLeftText, segmentLines, segmentMaxNow, segmentOverMax, segmentSummary, showMoreToggle, splitByReceived,
  STATE_LABEL, totalsText, workerPendingText,
} from './scanModel'

const ctx = (p: Partial<BeScanContext>): BeScanContext => ({
  workstation: { id: '1', code: 'M1', name: 'Máy 1', stage: 'PHOI', kind: 'CUT', processStep: null }, ...p,
})

describe('chọn lệnh (bỏ hàng đợi 23/11/2026)', () => {
  const hanCtx = (stagePis: BeScanContext['stagePis']) =>
    ctx({ workstation: { id: '1', code: 'H1', name: 'H1', stage: 'HAN', kind: 'PIECE', processStep: null }, stagePis })

  it('Hàn / Sơn: lấy đúng stagePis theo thứ tự BE trả, kèm số còn thiếu', () => {
    const c = hanCtx([
      { productionInvoiceId: 'a', code: 'A', deadline: '2026-12-01', missingPieces: 12 },
      { productionInvoiceId: 'b', code: 'B', deadline: null, missingPieces: 3 },
      { productionInvoiceId: 'c', code: 'C', deadline: null, missingPieces: 7 },
    ])
    expect(pickablePis(c).map((x) => x.productionInvoiceId)).toEqual(['a', 'b', 'c'])
    expect(pickablePis(c)[0].missingPieces).toBe(12)
    expect(hasPickablePi(c)).toBe(true)
    expect(soleStagePi(c)).toBeNull()
  })

  it('chỉ 1 lệnh làm được thì chọn sẵn (soleStagePi)', () => {
    const c = hanCtx([{ productionInvoiceId: 'a', code: 'A', deadline: null, missingPieces: 5 }])
    expect(soleStagePi(c)?.productionInvoiceId).toBe('a')
    expect(soleStagePi(null)).toBeNull()
  })

  it('hết lệnh: không có gì để chọn, hiện câu của spec 5.1', () => {
    const c = hanCtx([])
    expect(hasPickablePi(c)).toBe(false)
    expect(soleStagePi(c)).toBeNull()
    expect(noPiText('HAN')).toBe('Tổ Hàn chưa có lệnh nào làm được: chưa có mảnh Phôi đạt KCS, hoặc quản lý chưa cho làm sản phẩm.')
    expect(noPiText('SON')).toContain('chưa có khung Hàn đạt KCS')
    expect(noPiText('HAN')).not.toMatch(/xếp lệnh/)
    expect(noPiText('PHOI')).not.toMatch(/xếp lệnh/)
  })

  it('Phôi: lệnh trong bảng chia, bỏ trùng; không có số còn thiếu', () => {
    const c = ctx({ allocationPis: [
      { productionInvoiceId: 'a', code: 'A' }, { productionInvoiceId: 'a', code: 'A' }, { productionInvoiceId: 'b', code: 'B' },
    ] })
    expect(pickablePis(c).map((x) => x.productionInvoiceId)).toEqual(['a', 'b'])
    expect(pickablePis(c)[0].missingPieces).toBeUndefined()
    expect(soleStagePi(c)).toBeNull()
  })

  it('chữ chip: "còn thiếu N mảnh", không âm', () => {
    expect(missingPiecesText(12)).toBe('còn thiếu 12 mảnh')
    expect(missingPiecesText(-3)).toBe('còn thiếu 0 mảnh')
  })

  it('tiêu đề theo loại máy', () => {
    expect(reportTitle({ kind: 'STEEL_RECEIVE', processStep: null, stage: 'PHOI' })).toBe('Nhận sắt')
    expect(reportTitle({ kind: 'CUT', processStep: null, stage: 'PHOI' })).toBe('Báo cắt')
    expect(reportTitle({ kind: 'STEP', processStep: 'UON', stage: 'PHOI' })).toBe('Báo Uốn')
    expect(reportTitle({ kind: 'STEP', processStep: null, stage: 'PHOI' })).toBe('Báo công đoạn')
    expect(reportTitle({ kind: 'PIECE', processStep: null, stage: 'HAN' })).toBe('Báo Hàn')
  })
})

describe('số đoạn theo cỡ', () => {
  const mats = [{
    materialId: 'm1', materialCode: 'S1', materialName: 'Sắt 1', hasReceivedSteel: true,
    segments: [
      { segmentSpecId: 's1', cutLengthMm: 500, required: 10, done: 0, byOrder: [{ productionOrderId: 'o1', required: 4, done: 1 }] },
      { segmentSpecId: 's2', cutLengthMm: 900, required: 10, done: 0, byOrder: [{ productionOrderId: 'o1', required: 6, done: 6 }] },
      { segmentSpecId: 's3', cutLengthMm: 700, required: 10, done: 0, byOrder: [{ productionOrderId: 'o2', required: 5, done: 0 }] },
    ],
  }, {
    materialId: 'm2', materialCode: 'S2', materialName: 'Sắt 2', hasReceivedSteel: false,
    segments: [{
      segmentSpecId: 's4', cutLengthMm: 300, required: 3, done: 0, byOrder: [{ productionOrderId: 'o2', required: 3, done: 0 }],
    }],
  }] as BeScanMaterial[]

  it('chỉ giữ cỡ của SKU đang chọn, cỡ dài xếp trước, số cần / đã làm theo SKU', () => {
    const r = materialsForSku(mats, 'o1')
    expect(r).toHaveLength(1)
    expect(r[0].segments.map((s) => [s.cutLengthMm, s.required, s.done])).toEqual([[900, 6, 6], [500, 4, 1]])
  })

  it('báo cắt: loại sắt chưa nhận vào danh sách chờ; công đoạn khác thì dùng được hết', () => {
    const all = materialsForSku(mats, 'o2')
    const cut = splitByReceived(all, 'Cắt')
    expect(cut.usable.map((m) => m.materialId)).toEqual(['m1'])
    expect(cut.waiting.map((m) => m.materialId)).toEqual(['m2'])
    const step = splitByReceived(all, 'Uốn')
    expect(step.usable).toHaveLength(2)
    expect(step.waiting).toHaveLength(0)
  })

  it('còn báo được lấy maxNow của BE; không có maxNow thì dùng số còn cần', () => {
    expect(segmentMaxNow({ required: 5, done: 2, maxNow: 1 })).toBe(1) // bị chặn bởi số đoạn thực có
    expect(segmentMaxNow({ required: 5, done: 2 })).toBe(3)
    expect(segmentMaxNow({ required: 5, done: 7 })).toBe(0)
    expect(segmentLeft({ required: 5, done: 2, maxNow: 3 })).toEqual({ kind: 'left', n: 3, over: 0 })
    expect(segmentLeftText({ required: 5, done: 2, maxNow: 3 })).toBe('còn báo được 3')
  })

  it('chưa có đoạn ở công đoạn trước: còn cần nhưng còn báo được 0', () => {
    expect(segmentLeft({ required: 5, done: 2, maxNow: 0 })).toEqual({ kind: 'none', n: 0, over: 0 })
    expect(segmentLeftText({ required: 5, done: 2, maxNow: 0 })).toBe('còn báo được 0')
  })

  it('đã đủ (vượt N), không bao giờ hiện số âm', () => {
    expect(segmentLeftText({ required: 5, done: 5, maxNow: 0 })).toBe('đã đủ')
    expect(segmentLeftText({ required: 5, done: 7, maxNow: 0 })).toBe('đã đủ (vượt 2)')
    expect(segmentLeft({ required: 5, done: 7, maxNow: 0 })).toEqual({ kind: 'done', n: 0, over: 2 })
    expect(segmentLeftText({ required: 5, done: 7 })).not.toContain('-')
  })

  it('materialsForSku lấy đủ số theo SKU (cần, đã tính, lỗi, thiếu, maxNow, số thực có)', () => {
    const m = [{
      materialId: 'm1', materialCode: 'S1', materialName: 'Sắt 1', hasReceivedSteel: true,
      segments: [{
        segmentSpecId: 's1', cutLengthMm: 500, required: 10, done: 9, maxNow: 9, physicalLeft: 9,
        byOrder: [
          { productionOrderId: 'o1', required: 4, baseRequired: 3, extraNeed: 1, done: 1, failed: 2, shortQty: 1, reportedQty: 4, maxNow: 2, physicalLeft: 2 },
          { productionOrderId: 'o2', required: 6, done: 8, maxNow: 0, physicalLeft: null },
        ],
      }],
    }] as BeScanMaterial[]
    const s = materialsForSku(m, 'o1')[0].segments[0]
    expect(s).toMatchObject({
      required: 4, baseRequired: 3, extraNeed: 1, done: 1, failed: 2, shortQty: 1, reportedQty: 4, maxNow: 2, physicalLeft: 2,
    })
    expect(segmentLeftText(s)).toBe('còn báo được 2') // không lấy maxNow của cả PI (9)
    const s2 = materialsForSku(m, 'o2')[0].segments[0]
    expect(segmentLeftText(s2)).toBe('đã đủ (vượt 2)')
  })

  it('nhập nhiều hơn còn báo được thì chặn', () => {
    expect(segmentOverMax({ required: 5, done: 2, maxNow: 3 }, 3)).toBe(false)
    expect(segmentOverMax({ required: 5, done: 2, maxNow: 3 }, 4)).toBe(true)
    expect(segmentOverMax({ required: 5, done: 5, maxNow: 0 }, 1)).toBe(true)
  })

  it('bảng xác nhận: chỉ dòng có số, chặn (block) khi vượt số còn báo được, tóm tắt gọn', () => {
    const segs = materialsForSku(mats, 'o1')[0].segments
    const lines = segmentLines(segs, { s1: '5', s2: '', s3: 'x' })
    expect(lines).toHaveLength(1)
    const rows = segmentConfirmRows(lines)
    expect(rows[0].label).toBe('500 mm')
    expect(rows[0].value).toBe('5 đoạn')
    expect(rows[0].block).toContain('Chỉ còn báo được 3 đoạn')
    expect(rows[0].warn).toBeUndefined()
    expect(anySegmentOverMax(lines)).toBe(true)
    expect(segmentSummary(lines)).toBe('5 đoạn 500mm')
    const ok = segmentLines(segs, { s1: '3' })
    expect(segmentConfirmRows(ok)[0].block).toBeUndefined()
    expect(anySegmentOverMax(ok)).toBe(false)
  })
})

describe('nút chính ở cuối màn', () => {
  it('Phôi: tắt thì có lý do ngắn, bật thì không', () => {
    expect(segmentAction({ busy: false, total: 0, blocked: false }))
      .toEqual({ label: 'Nhập số đoạn', disabled: true, reason: 'Gõ số đoạn vào ô ở trên' })
    expect(segmentAction({ busy: false, total: 5, blocked: true }))
      .toEqual({ label: 'Lưu 5 đoạn', disabled: true, reason: 'Loại sắt này chưa nhận' })
    expect(segmentAction({ busy: false, total: 5, blocked: false })).toEqual({ label: 'Lưu 5 đoạn', disabled: false, reason: null })
    expect(segmentAction({ busy: true, total: 5, blocked: false })).toEqual({ label: 'Đang lưu…', disabled: true, reason: null })
  })

  it('báo vượt còn báo được: nút Lưu khoá kèm lý do (Phôi và Hàn / Sơn)', () => {
    expect(segmentAction({ busy: false, total: 5, blocked: false, over: true }))
      .toEqual({ label: 'Lưu 5 đoạn', disabled: true, reason: 'Số nhập nhiều hơn số còn báo được' })
    expect(pieceAction({ busy: false, pieceName: 'Chân', n: 9, over: true }))
      .toEqual({ label: 'Lưu 9 Chân', disabled: true, reason: 'Số nhập nhiều hơn số còn báo được' })
  })

  it('mảnh: còn báo được = maxNow của BE, dòng xác nhận chặn khi vượt', () => {
    const p = { pieceId: 'p', pieceCode: 'P', pieceName: 'Chân', plannedQty: 10, awaitingQcQty: 2, passedQty: 3, openQty: 1, maxNow: 4 }
    expect(pieceMaxNow(p)).toBe(4)
    expect(pieceMaxNow({ ...p, maxNow: 0 })).toBe(0)
    expect(pieceMaxNow({ ...p, maxNow: undefined })).toBe(4) // BE cũ: 10 - 3 - 2 - 1
    expect(pieceConfirmRow(p, 4).block).toBeUndefined()
    expect(pieceConfirmRow(p, 5).block).toContain('Chỉ còn báo được 4 mảnh')
  })

  it('Hàn/Sơn: chưa chọn mảnh, chưa nhập số, sẵn sàng', () => {
    expect(pieceAction({ busy: false, pieceName: null, n: 0 }).reason).toBe('Chọn mảnh ở trên trước')
    expect(pieceAction({ busy: false, pieceName: 'Chân', n: 0 }).reason).toBe('Gõ số mảnh vào ô bên trái')
    expect(pieceAction({ busy: false, pieceName: 'Chân', n: 4 })).toEqual({ label: 'Lưu 4 Chân', disabled: false, reason: null })
  })

  it('chưa chọn lệnh: máy cắt có Việc của máy thì chỉ về khối đó', () => {
    expect(needPiAction({ kind: 'CUT' }, true)).toEqual({ label: 'Nhập số đoạn', disabled: true, reason: 'Chọn lệnh ở Việc của máy trước' })
    expect(needPiAction({ kind: 'CUT' }, false).reason).toBe('Chọn lệnh ở trên trước')
    expect(needPiAction({ kind: 'PIECE' }, false).label).toBe('Nhập số mảnh')
  })
})

describe('khối Việc của máy', () => {
  it('nhãn đầu dòng: Đang báo không hiện khi đã là Đang chạy', () => {
    expect(rowBadges({ picked: true, done: false, isBundle: false }).map((b) => b.text)).toEqual(['Đang báo'])
    expect(rowBadges({ picked: true, done: false, isBundle: true }).map((b) => b.text)).toEqual(['Đang báo', 'Cắt theo bó'])
    expect(rowBadges({ picked: false, done: true, isBundle: false }).map((b) => b.text)).toEqual(['Xong'])
  })

  it('nút Xem thêm chỉ hiện khi quá phần xem trước', () => {
    expect(showMoreToggle(3, 0, false)).toBe(false)
    expect(showMoreToggle(5, 2, false)).toBe(true)
    expect(showMoreToggle(5, 0, true)).toBe(true)
  })
})

describe('sản lượng của tôi', () => {
  it('chú thích và tổng theo loại việc', () => {
    expect(opCaption({ op: 'PIECE', qty: 1 } as never)).toBe('mảnh đã báo')
    expect(opCaption({ op: 'CAT', qty: 1 } as never)).toBe('đoạn đã cắt')
    expect(opCaption({ op: 'STEP', qty: 1 } as never)).toBe('đoạn đã làm công đoạn')
    expect(totalsText([{ op: 'CAT', qty: 120 }, { op: 'PIECE', qty: 5 }] as never)).toBe('Cắt 120 đoạn · 5 mảnh')
  })

  it('đổi chữ "đang mở / KCS đang chấm" sang chữ của công nhân', () => {
    expect(workerPendingText('Cắt: 3 đoạn đang mở, 2 đoạn KCS đang chấm')).toBe('Cắt: 3 đoạn chờ kiểm hàng, 2 đoạn đang kiểm hàng')
  })

  it('nhãn trạng thái: đợt đang mở là "Chờ kiểm hàng"', () => {
    expect(STATE_LABEL.OPEN[0]).toBe('Chờ kiểm hàng')
    expect(STATE_LABEL.AWAITING_QC[0]).toBe('Đang kiểm hàng')
    expect(STATE_LABEL.QC_DONE[0]).toBe('Đã kiểm xong')
  })

  it('nhãn KCS: thiếu N · lỗi M; chưa chấm (null) hoặc không thiếu / lỗi thì không hiện', () => {
    expect(kcsLabel({ failedQty: 2, shortQty: 3 })).toBe('KCS: thiếu 3 · lỗi 2')
    expect(kcsLabel({ failedQty: 0, shortQty: 4 })).toBe('KCS: thiếu 4 · lỗi 0')
    expect(kcsLabel(null)).toBeNull()
    expect(kcsLabel(undefined)).toBeNull()
    expect(kcsLabel({ failedQty: 0, shortQty: 0 })).toBeNull()
  })

  it('nhãn KCS cả đợt chỉ ở dòng mới nhất của đợt', () => {
    const k = { failedQty: 1, shortQty: 4 }
    const mk = (id: string, createdAt: string, extra: Partial<BeMyOutputRow> = {}) =>
      ({ id, createdAt, kind: 'PIECE', piCode: 'PBD-1', step: null, state: 'QC_DONE', reversed: null, kcs: k, ...extra }) as BeMyOutputRow
    const rows = [
      mk('3', '2026-11-14T10:00:00'), mk('2', '2026-11-14T09:00:00'), mk('1', '2026-11-14T08:00:00'),
      mk('9', '2026-11-13T09:00:00', { kcs: { failedQty: 0, shortQty: 2 } }),
    ]
    expect([...kcsLabelRowIds(rows)].sort()).toEqual(['3', '9'])
    expect(kcsBatchLabel(k)).toBe('KCS chấm cả đợt: thiếu 4 · lỗi 1')
    expect(kcsBatchLabel(null)).toBeNull()
    expect(kcsLabelRowIds([mk('a', '2026-11-14T10:00:00', { reversed: { reason: null, at: '', byName: null } })]).size).toBe(0)
  })

  it('nhãn KCS cả đợt theo batchKey của BE: 2 đợt liền nhau cùng số vẫn tách, cùng đợt không liền nhau chỉ 1 nhãn', () => {
    const k = { failedQty: 1, shortQty: 4 }
    const mk = (id: string, createdAt: string, batchKey: string) =>
      ({ id, createdAt, kind: 'CUT', piCode: 'PBD-1', step: null, state: 'QC_DONE', reversed: null, kcs: k, batchKey }) as BeMyOutputRow
    const rows = [
      mk('5', '2026-11-14T11:00:00', 'CUT:40'), mk('4', '2026-11-14T10:30:00', 'CUT:39'),
      mk('3', '2026-11-14T10:00:00', 'CUT:40'), mk('2', '2026-11-14T09:00:00', 'CUT:39'),
    ]
    expect([...kcsLabelRowIds(rows)].sort()).toEqual(['4', '5'])
  })

  it('gom theo ngày giữ thứ tự', () => {
    const row = (id: string, createdAt: string) => ({ id, createdAt }) as BeMyOutputRow
    const g = groupByDay([row('1', '2026-11-14T08:00:00'), row('2', '2026-11-14T09:00:00'), row('3', '2026-11-13T09:00:00')])
    expect(g.map(([, l]) => l.map((r) => r.id))).toEqual([['1', '2'], ['3']])
  })
})
