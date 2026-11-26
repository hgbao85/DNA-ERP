import { describe, expect, it } from 'vitest'
import type { FramePlanRow, SegmentPlanRow } from '../../../services/stage-handover-api'
import {
  buildFrameCartLine, buildSegmentCartLine, effectiveQty, frameDefaults, frameRowKey, frameRowMax, handoverCartKey, handoverPrintNote,
  handoverSpecText, handoverStagesOf, hanWarehouseHasPaint, parseQty, qtyDigits, qtyError, recipientPlaceholder, segmentCartConflict,
  segmentDefaults, segmentHandoverRows, segmentRowMax, segmentStillNeeded, slipKindLabel,
} from './handoverModel'

const seg = (over: Partial<SegmentPlanRow> = {}): SegmentPlanRow => ({
  segmentSpecId: '7', segmentSteps: 'DAP', materialCode: 'SAT-005', cutLengthMm: 460, stepsLabel: 'Dập',
  label: 'SAT-005 @ 460mm · Dập',
  stages: [{ stage: 'HAN', requiredQty: 100, handedOverQty: 30, draftQty: 10 }],
  requiredQty: 100, passedQty: 80, handedOverQty: 30, draftQty: 10, ownHeldQty: 50, surplusQty: 0, inStockQty: 50, availableQty: 40,
  ...over,
})

const frame = (over: Partial<FramePlanRow> = {}): FramePlanRow => ({
  productionOrderId: '11', sku: 'GHE-J55', pieceId: '3', pieceCode: 'M03', pieceName: 'Khung lưng',
  requiredQty: 40, passedQty: 25, handedOverQty: 10, draftQty: 0, inStockQty: 15, availableQty: 15,
  ...over,
})

describe('kho Hàn giao mảnh cho Sơn chỉ ở xưởng có kho Sơn', () => {
  it('Hàn Phú An có, Hàn Phước An không, kho khác không', () => {
    expect(hanWarehouseHasPaint('phoi-son-han-han-pa')).toBe(true)
    expect(hanWarehouseHasPaint('phoi-son-han-han-pha')).toBe(false)
    expect(hanWarehouseHasPaint('phoi-son-han')).toBe(false)
    expect(hanWarehouseHasPaint(null)).toBe(false)
  })
})

describe('giao đoạn: tách dòng theo tổ nhận + số giao được', () => {
  it('mỗi mã đoạn × tổ 1 dòng; mã đoạn không có tổ coi như Hàn', () => {
    const rows = segmentHandoverRows([
      seg({ stages: [{ stage: 'HAN', requiredQty: 60, handedOverQty: 0, draftQty: 0 }, { stage: 'SON', requiredQty: 40, handedOverQty: 0, draftQty: 0 }] }),
      seg({ segmentSpecId: '8', stages: [] }),
    ])
    expect(rows.map(r => r.key)).toEqual(['7|DAP|HAN', '7|DAP|SON', '8|DAP|HAN'])
    expect(rows[0].codeKey).toBe(rows[1].codeKey)
    expect(rows[2].requiredQty).toBe(100)
  })

  it('còn phải giao = cần − đã giao − chờ ký, không âm', () => {
    expect(segmentStillNeeded({ requiredQty: 100, handedOverQty: 30, draftQty: 10 })).toBe(60)
    expect(segmentStillNeeded({ requiredQty: 10, handedOverQty: 12, draftQty: 0 })).toBe(0)
  })

  it('số mặc định không quá giao được, 2 tổ cùng mã đoạn chia chung', () => {
    const one = segmentHandoverRows([seg()])
    expect(segmentDefaults(one)).toEqual({ '7|DAP|HAN': 40 })
    const two = segmentHandoverRows([seg({
      availableQty: 50,
      stages: [{ stage: 'HAN', requiredQty: 30, handedOverQty: 0, draftQty: 0 }, { stage: 'SON', requiredQty: 30, handedOverQty: 0, draftQty: 0 }],
    })])
    expect(segmentDefaults(two)).toEqual({ '7|DAP|HAN': 30, '7|DAP|SON': 20 })
  })

  it('tối đa của dòng trừ số đang gõ ở dòng tổ khác cùng mã đoạn', () => {
    const rows = segmentHandoverRows([seg({
      availableQty: 50,
      stages: [{ stage: 'HAN', requiredQty: 30, handedOverQty: 0, draftQty: 0 }, { stage: 'SON', requiredQty: 30, handedOverQty: 0, draftQty: 0 }],
    })])
    const qty = { '7|DAP|HAN': '35', '7|DAP|SON': '20' }
    expect(segmentRowMax(rows[0], rows, qty)).toBe(30)
    expect(segmentRowMax(rows[1], rows, qty)).toBe(15)
    expect(qtyError(35, 30, 'đoạn')).toBe('Chỉ giao được tối đa 30 đoạn')
  })

  it('giao được lẻ làm tròn xuống (BE chỉ nhận số nguyên)', () => {
    const rows = segmentHandoverRows([seg({ availableQty: 12.5 })])
    expect(segmentRowMax(rows[0], rows, {})).toBe(12)
  })
})

describe('giao mảnh: tồn mảnh chung mọi SKU cùng mảnh', () => {
  it('số mặc định chia tồn theo thứ tự dòng', () => {
    const rows = [frame(), frame({ productionOrderId: '12', sku: 'GHE-J56', handedOverQty: 0 })]
    expect(frameDefaults(rows)).toEqual({ '11|3': 15, '12|3': 0 })
  })
  it('tối đa trừ số gõ ở SKU khác cùng mảnh', () => {
    const rows = [frame(), frame({ productionOrderId: '12' })]
    const qty = { [frameRowKey(rows[0])]: '5', [frameRowKey(rows[1])]: '20' }
    expect(frameRowMax(rows[0], rows, qty)).toBe(0)
    expect(frameRowMax(rows[1], rows, qty)).toBe(10)
    expect(qtyError(5, 0, 'mảnh')).toBe('Kho không còn mảnh để giao')
  })
})

describe('ô nhập', () => {
  it('chỉ số nguyên', () => {
    expect(qtyDigits('12a.5')).toBe('125')
    expect(parseQty('')).toBe(0)
    expect(parseQty(undefined)).toBe(0)
    expect(parseQty('7')).toBe(7)
  })
  it('0 / trống không báo lỗi; trong trần không báo lỗi', () => {
    expect(qtyError(0, 0, 'đoạn')).toBeNull()
    expect(qtyError(10, 10, 'đoạn')).toBeNull()
  })
  it('chưa gõ thì dùng số mặc định, gõ trống giữ trống', () => {
    expect(effectiveQty({ b: '' }, { a: 3, b: 4 })).toEqual({ a: '3', b: '' })
  })
})

describe('dòng phiếu đang lập', () => {
  const pi = { productionInvoiceId: '45', lenhCode: 'MY-313' }
  it('dòng giao đoạn đúng dạng BE SEGMENT_HANDOVER', () => {
    const [r] = segmentHandoverRows([seg()])
    expect(buildSegmentCartLine(pi, r, 12)).toEqual({
      kind: 'SEGMENT_HANDOVER', productionInvoiceId: '45', segmentSpecId: '7', segmentSteps: 'DAP', stage: 'HAN', qty: 12,
      materialName: 'SAT-005 @ 460mm · Dập', unit: 'đoạn', lenhLabel: 'MY-313',
    })
  })
  it('dòng giao mảnh đúng dạng BE FRAME_HANDOVER', () => {
    expect(buildFrameCartLine(pi, frame(), 5)).toEqual({
      kind: 'FRAME_HANDOVER', productionOrderId: '11', pieceId: '3', stage: 'SON', qty: 5,
      materialName: 'Khung lưng (M03)', unit: 'mảnh', lenhLabel: 'MY-313 · GHE-J55',
    })
  })
  it('khoá giỏ: đoạn theo (lệnh, mã đoạn) không theo tổ; mảnh theo (SKU, mảnh); dòng khác null', () => {
    const [h] = segmentHandoverRows([seg()])
    const a = buildSegmentCartLine(pi, h, 1)
    expect(handoverCartKey(a)).toBe(handoverCartKey({ ...a, stage: 'SON' } as typeof a))
    expect(handoverCartKey(buildFrameCartLine(pi, frame(), 1))).toBe('FRAME_HANDOVER|11|3')
    expect(handoverCartKey({ kind: 'STEEL', productionInvoiceId: '45' })).toBeNull()
  })
  it('cùng mã đoạn đã có trên phiếu cho tổ khác thì báo, cùng tổ thì thay số', () => {
    const [h] = segmentHandoverRows([seg()])
    const han = buildSegmentCartLine(pi, h, 1)
    const son = { ...han, stage: 'SON' as const }
    expect(segmentCartConflict([han], son)).toMatch(/tổ Hàn/)
    expect(segmentCartConflict([han], { ...han, qty: 9 })).toBeNull()
    expect(segmentCartConflict([], son)).toBeNull()
  })
})

describe('nhãn phiếu xuất', () => {
  it('cột Loại', () => {
    expect(slipKindLabel('SEGMENT_HANDOVER', 'HAN')).toBe('Giao Hàn')
    expect(slipKindLabel('SEGMENT_HANDOVER', 'SON')).toBe('Giao Sơn')
    expect(slipKindLabel('FRAME_HANDOVER', 'SON')).toBe('Giao Sơn')
    expect(slipKindLabel('FRAME_HANDOVER', null)).toBe('Giao Sơn')
    expect(slipKindLabel('CONSUMABLE', 'HAN')).toBe('Tiêu hao Hàn')
    expect(slipKindLabel('STEEL', null)).toBe('Sắt')
  })
  it('gợi ý người nhận theo tổ nhận', () => {
    expect(recipientPlaceholder([{ kind: 'STEEL' }])).toBe('Người nhận (tổ / tên)')
    expect(recipientPlaceholder([{ kind: 'SEGMENT_HANDOVER', stage: 'HAN' }])).toBe('Tổ Hàn – <tên>')
    expect(recipientPlaceholder([{ kind: 'FRAME_HANDOVER', stage: null }, { kind: 'SEGMENT_HANDOVER', stage: 'HAN' }])).toBe('Tổ Hàn / Sơn – <tên>')
    expect(handoverStagesOf([{ kind: 'CONSUMABLE', stage: 'HAN' }])).toEqual([])
  })
  it('phiếu in: quy cách đoạn + ghi chú tổ nhận', () => {
    expect(handoverSpecText({ kind: 'SEGMENT_HANDOVER', cutLengthMm: 460, segmentLabel: 'SAT-005 @ 460mm · Dập' })).toBe('Đoạn 460mm · Dập')
    expect(handoverSpecText({ kind: 'SEGMENT_HANDOVER', cutLengthMm: null, segmentLabel: null })).toBe('Đoạn')
    expect(handoverSpecText({ kind: 'STEEL' })).toBe('')
    expect(handoverPrintNote({ kind: 'SEGMENT_HANDOVER', stage: 'HAN' })).toBe('Giao tổ hàn (đoạn)')
    expect(handoverPrintNote({ kind: 'FRAME_HANDOVER', stage: 'SON' })).toBe('Giao tổ sơn (mảnh đã hàn)')
    expect(handoverPrintNote({ kind: 'STEEL', stage: null })).toBe('')
  })
})
