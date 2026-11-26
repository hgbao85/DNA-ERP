import { describe, expect, it } from 'vitest'
import type { BeScanPieceItem } from '../../../../services/floor-api'
import { handoverTiles, pieceConfirmRow, pieceMaxNow, piecePlanLeft, receivedOverText } from './scanModel'

// Kế hoạch: 20 - 5 đạt - 2 chờ - 1 mở = còn 12. BE gửi maxNow = min(12, receivedLeft).
const base: BeScanPieceItem = { pieceId: 'p', pieceCode: 'P', pieceName: 'Khung lưng', plannedQty: 20, passedQty: 5, awaitingQcQty: 2, openQty: 1, maxNow: 12 }
const withHandover = (receivedLeft: number, over: Partial<BeScanPieceItem> = {}): BeScanPieceItem => ({
  ...base,
  maxNow: Math.max(0, Math.min(12, receivedLeft)),
  handover: { mode: 'SEGMENT', receivedQty: 10, usedQty: 10 - receivedLeft, receivedLeft, overrideQty: 0 },
  ...over,
})

describe('màn Hàn / Sơn: Đã nhận / Đã làm / Còn (giao nhận giữa tổ)', () => {
  it('công tắc tắt (không có handover): không có ô, không có banner, chữ cũ giữ nguyên', () => {
    expect(handoverTiles(base)).toBeNull()
    expect(handoverTiles({ ...base, handover: null })).toBeNull()
    expect(receivedOverText(base, 99)).toBeNull()
    expect(pieceConfirmRow(base, 13).block).toBe('Chỉ còn báo được 12 mảnh (cần 20). Sửa lại số.')
  })

  it('3 ô + kế hoạch còn báo được', () => {
    const p = withHandover(4)
    expect(handoverTiles(p)).toEqual({ received: 10, used: 6, left: 4, planLeft: 12 })
    expect(piecePlanLeft(p)).toBe(12)
    expect(pieceMaxNow(p)).toBe(4)
  })

  it('còn âm (làm trước khi bật) hiện 0', () => {
    expect(handoverTiles(withHandover(-3))?.left).toBe(0)
  })

  it('nhập vượt số đã nhận còn lại: banner đỏ + dòng xác nhận chặn cùng câu', () => {
    const p = withHandover(4)
    expect(receivedOverText(p, 4)).toBeNull()
    expect(receivedOverText(p, 5)).toBe('Chỉ còn 4 mảnh đã nhận. Qua kho ký phiếu lấy thêm, hoặc báo QLSX.')
    expect(pieceConfirmRow(p, 5).block).toBe('Chỉ còn 4 mảnh đã nhận. Qua kho ký phiếu lấy thêm, hoặc báo QLSX.')
    expect(pieceConfirmRow(p, 4).block).toBeUndefined()
  })

  it('kế hoạch là trần chặt hơn: giữ câu kế hoạch, không bảo qua kho lấy thêm', () => {
    const p = withHandover(15)
    expect(pieceMaxNow(p)).toBe(12)
    expect(receivedOverText(p, 13)).toBeNull()
    expect(pieceConfirmRow(p, 13).block).toBe('Chỉ còn báo được 12 mảnh (cần 20). Sửa lại số.')
  })
})
