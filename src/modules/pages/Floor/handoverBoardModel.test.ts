import { describe, expect, it } from 'vitest'
import type { HandoverBoardPi } from '../../../services/stage-handover-api'
import {
  HANDOVER_URL_PAGE, OVERRIDE_NOTE, boardSummaryRows, canOverridePiece, overrideTargetText, overrideValid, parseOverrideQty,
  piCodeFromFocus, piFocusKey, pieceOverrideRoom, pieceStatus, sortBoardPis, steelPercent, steelStatus, validateOverride,
  type OverrideTarget,
} from './handoverBoardModel'
import { floorTabForUrl, qlsxTabForUrl } from './qlsxUi'

const pi = (over: Partial<HandoverBoardPi> = {}): HandoverBoardPi => ({
  productionInvoiceId: '45', code: 'PI-2026-045', lenhCode: 'MY-313', blockedPieceCount: 0, awaitingHandoverQty: 120,
  handedNotUsedQty: 30, steelBlocked: false, ...over,
})

describe('bảng tóm tắt theo lệnh + chặng', () => {
  it('2 dòng mỗi lệnh: Phôi (ở kho chờ giao) và Hàn / Sơn (đã giao chưa làm)', () => {
    const rows = boardSummaryRows([pi()])
    expect(rows.map((r) => [r.chang, r.first, r.awaitingQty, r.handedNotUsedQty, r.status.text])).toEqual([
      ['Phôi → Hàn / Sơn', true, 120, null, 'bình thường'],
      ['Hàn / Sơn', false, null, 30, 'bình thường'],
    ])
  })
  it('sắt vượt 102% -> Phôi đang bị chặn; mảnh hết hàng đã nhận -> Hàn / Sơn đang bị chặn', () => {
    const rows = boardSummaryRows([pi({ steelBlocked: true, blockedPieceCount: 3 })])
    expect(rows[0].status).toEqual({ blocked: true, text: 'đang bị chặn · sắt vượt 102%' })
    expect(rows[1].status).toEqual({ blocked: true, text: 'đang bị chặn · 3 mảnh' })
  })
  it('lệnh bị chặn lên đầu, giữ thứ tự trong nhóm', () => {
    const list = [pi({ productionInvoiceId: '1' }), pi({ productionInvoiceId: '2', blockedPieceCount: 1 }), pi({ productionInvoiceId: '3', steelBlocked: true })]
    expect(sortBoardPis(list).map((p) => p.productionInvoiceId)).toEqual(['2', '3', '1'])
  })
})

describe('chi tiết mảnh + sắt', () => {
  it('trạng thái mảnh', () => {
    expect(pieceStatus({ blocked: true, maxNow: 5, receivedLeft: 0 }).text).toBe('đang bị chặn')
    expect(pieceStatus({ blocked: false, maxNow: 0, receivedLeft: 2 }).text).toBe('đã đủ kế hoạch')
    expect(pieceStatus({ blocked: false, maxNow: 5, receivedLeft: 2 }).text).toBe('bình thường')
  })
  it('mở chặn mảnh tối đa = còn kế hoạch − còn theo hàng đã nhận (không vượt kế hoạch)', () => {
    expect(pieceOverrideRoom({ maxNow: 10, receivedLeft: 4 })).toBe(6)
    expect(pieceOverrideRoom({ maxNow: 10, receivedLeft: -3 })).toBe(10)
    expect(pieceOverrideRoom({ maxNow: 4, receivedLeft: 6 })).toBe(0)
    expect(canOverridePiece({ maxNow: 10, receivedLeft: 4 })).toBe(true)
    expect(canOverridePiece({ maxNow: 4, receivedLeft: 6 })).toBe(false)
    expect(canOverridePiece({ maxNow: 10, receivedLeft: null })).toBe(false)
  })
  it('% sắt đã dùng + trạng thái', () => {
    expect(steelPercent({ usableMm: 10000, reportedMm: 10150 })).toBe(101.5)
    expect(steelPercent({ usableMm: 0, reportedMm: 10 })).toBeNull()
    expect(steelStatus({ blocked: false, usableMm: 10000, reportedMm: 10150, receivedBarCount: 2 }).text).toBe('vượt sắt đã nhận (trong 2%)')
    expect(steelStatus({ blocked: true, usableMm: 10000, reportedMm: 10200, receivedBarCount: 2 })).toEqual({ blocked: true, text: 'đang bị chặn' })
    expect(steelStatus({ blocked: false, usableMm: 0, reportedMm: 0, receivedBarCount: 0 }).text).toBe('chưa nhận sắt')
  })
})

describe('hộp mở chặn', () => {
  const piece: OverrideTarget = { stage: 'HAN', productionOrderId: '11', pieceId: '3', label: 'Khung lưng', room: 6 }
  const steel: OverrideTarget = { stage: 'PHOI', materialId: '9', label: 'Sắt SAT-005', room: null }
  it('câu nhắc đúng bản duyệt', () => {
    expect(OVERRIDE_NOTE).toBe('Chỉ mở chặn hàng đã nhận, không vượt kế hoạch. Hệ thống ghi nhật ký và báo Sếp.')
  })
  it('lý do bắt buộc', () => {
    expect(validateOverride(piece, '2', '').reason).toBe('Cần ghi lý do mở chặn')
    expect(validateOverride(piece, '2', ' ab ').reason).toBe('Lý do ít nhất 3 ký tự')
    expect(validateOverride(piece, '2', 'x'.repeat(501)).reason).toBe('Lý do tối đa 500 ký tự')
  })
  it('mảnh: số nguyên > 0, không quá phần còn kế hoạch', () => {
    expect(validateOverride(piece, '', 'kho vắng').qty).toBe('Nhập số mảnh cho làm thêm')
    expect(validateOverride(piece, '0', 'kho vắng').qty).toBe('Số phải lớn hơn 0')
    expect(validateOverride(piece, '1.5', 'kho vắng').qty).toBe('Số mảnh phải là số nguyên')
    expect(validateOverride(piece, '7', 'kho vắng').qty).toBe('Không vượt kế hoạch: mở thêm tối đa 6 mảnh')
    expect(validateOverride({ ...piece, room: 0 }, '1', 'kho vắng').qty).toBe('Mảnh này không còn kế hoạch để mở thêm')
    expect(overrideValid(validateOverride(piece, '6', 'kho vắng'))).toBe(true)
  })
  it('Phôi: số mm (được lẻ, tối đa 4 số lẻ, dấu phẩy được)', () => {
    expect(validateOverride(steel, '', 'cân lại').qty).toBe('Nhập số mm cho làm thêm')
    expect(overrideValid(validateOverride(steel, '1200,5', 'cân lại'))).toBe(true)
    expect(parseOverrideQty('1200,5')).toBe(1200.5)
    expect(validateOverride(steel, '1.12345', 'cân lại').qty).toBe('Tối đa 4 số lẻ')
  })
  it('cột Mục của danh sách mở chặn', () => {
    expect(overrideTargetText({ stage: 'PHOI', materialCode: 'SAT-005', materialId: '9', pieceName: null, pieceCode: null, pieceId: null })).toBe('Sắt SAT-005')
    expect(overrideTargetText({ stage: 'HAN', pieceName: 'Khung lưng', pieceCode: 'M03', pieceId: '3', materialCode: null, materialId: null })).toBe('Khung lưng (M03)')
    expect(overrideTargetText({ stage: 'SON', pieceName: null, pieceCode: null, pieceId: '3', materialCode: null, materialId: null })).toBe('Mảnh 3')
  })
})

describe('link thông báo STAGE_HANDOVER_OVERRIDE', () => {
  it('QLSX mở ?p=giao-nhan-giua-to -> Sản lượng xưởng, tab Giao nhận giữa tổ', () => {
    expect(HANDOVER_URL_PAGE).toBe('giao-nhan-giua-to')
    expect(qlsxTabForUrl('giao-nhan-giua-to', true)).toBe('san-luong-xuong')
    expect(floorTabForUrl('giao-nhan-giua-to')).toBe('handover')
    expect(floorTabForUrl('san-luong-xuong')).toBeNull()
    expect(qlsxTabForUrl('giao-nhan-giua-to', false)).toBe('giao-nhan-giua-to')
  })
  it('focus=PI_CODE:<mã PI> mở đúng lệnh', () => {
    expect(piFocusKey('PI-2026-045')).toBe('PI_CODE:PI-2026-045')
    expect(piCodeFromFocus('PI_CODE:PI-2026-045')).toBe('PI-2026-045')
    expect(piCodeFromFocus('PRODUCTION_INVOICE:45')).toBeNull()
    expect(piCodeFromFocus(null)).toBeNull()
  })
})
