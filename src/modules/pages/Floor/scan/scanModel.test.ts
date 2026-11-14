import { describe, expect, it } from 'vitest'
import type { BeMyOutputRow, BeScanContext, BeScanMaterial } from '../../../../services/floor-api'
import {
  allocationOnlyPis, groupByDay, hasPickablePi, isOnlyRunningPi, isReworkSelected, materialsForSku, needPiAction, opCaption,
  pieceAction, reportTitle, rowBadges, segmentAction, segmentConfirmRows, segmentLeft, segmentLines, segmentSummary, showMoreToggle,
  splitByReceived, totalsText, workerPendingText,
} from './scanModel'

const ctx = (p: Partial<BeScanContext>): BeScanContext => ({
  workstation: { id: '1', code: 'M1', name: 'Máy 1', stage: 'PHOI', kind: 'CUT', processStep: null }, ...p,
})

describe('chọn lệnh', () => {
  it('bảng chia không lặp lệnh đã có ở đang làm / làm bù', () => {
    const c = ctx({
      runningPi: { productionInvoiceId: 'a', code: 'A' },
      reworkPis: [{ productionInvoiceId: 'b', code: 'B', endedAt: null }],
      allocationPis: [
        { productionInvoiceId: 'a', code: 'A' }, { productionInvoiceId: 'b', code: 'B' },
        { productionInvoiceId: 'c', code: 'C' }, { productionInvoiceId: 'c', code: 'C' },
      ],
    })
    expect(allocationOnlyPis(c).map((x) => x.productionInvoiceId)).toEqual(['c'])
    expect(isOnlyRunningPi(c)).toBe(false)
    expect(isReworkSelected(c, 'b')).toBe(true)
    expect(isReworkSelected(c, 'a')).toBe(false)
  })

  it('chỉ có lệnh đang chạy thì bỏ hàng chọn lệnh', () => {
    const c = ctx({ runningPi: { productionInvoiceId: 'a', code: 'A' } })
    expect(isOnlyRunningPi(c)).toBe(true)
    expect(hasPickablePi(c)).toBe(true)
    expect(hasPickablePi(ctx({}))).toBe(false)
    expect(isOnlyRunningPi(null)).toBe(false)
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

  it('còn / vượt / đủ', () => {
    expect(segmentLeft({ required: 5, done: 2 })).toEqual({ kind: 'left', n: 3 })
    expect(segmentLeft({ required: 5, done: 7 })).toEqual({ kind: 'over', n: 2 })
    expect(segmentLeft({ required: 5, done: 5 })).toEqual({ kind: 'done', n: 0 })
  })

  it('bảng xác nhận: chỉ dòng có số, cảnh báo khi vượt, tóm tắt gọn', () => {
    const segs = materialsForSku(mats, 'o1')[0].segments
    const lines = segmentLines(segs, { s1: '5', s2: '', s3: 'x' })
    expect(lines).toHaveLength(1)
    const rows = segmentConfirmRows(lines, 'Cắt')
    expect(rows[0].label).toBe('500 mm')
    expect(rows[0].value).toBe('5 đoạn')
    expect(rows[0].warn).toContain('vượt 2')
    expect(segmentSummary(lines)).toBe('5 đoạn 500mm')
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
    expect(rowBadges({ running: true, picked: true, done: false, isBundle: false }).map((b) => b.text)).toEqual(['Đang chạy'])
    expect(rowBadges({ running: false, picked: true, done: false, isBundle: true }).map((b) => b.text)).toEqual(['Đang báo', 'Cắt theo bó'])
    expect(rowBadges({ running: false, picked: false, done: true, isBundle: false }).map((b) => b.text)).toEqual(['Xong'])
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

  it('đổi chữ chờ KCS sang chữ của công nhân', () => {
    expect(workerPendingText('3 chưa gửi, 2 chờ KCS')).toBe('3 chờ quản lý kiểm, 2 đang kiểm hàng')
  })

  it('gom theo ngày giữ thứ tự', () => {
    const row = (id: string, createdAt: string) => ({ id, createdAt }) as BeMyOutputRow
    const g = groupByDay([row('1', '2026-11-14T08:00:00'), row('2', '2026-11-14T09:00:00'), row('3', '2026-11-13T09:00:00')])
    expect(g.map(([, l]) => l.map((r) => r.id))).toEqual([['1', '2'], ['3']])
  })
})
