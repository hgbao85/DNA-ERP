/**
 * UF2 (tester-unit #4, P1 "KCS tự chuyển"): hộp chấm của KCS - AC28 (ô Thực có tự về Đã báo kèm câu), AC29 (số sai báo đỏ và
 * khoá "Xác nhận chấm"), AC12 / MF2 (dòng xám). Bổ sung cho kcsReviewModel.test.ts của Dev, không lặp ca.
 * Nút "Xác nhận chấm" bị khoá khi hasBlockingError(...) (KcsPhoiPage:866) hoặc calc.error !== null (kcsCore:207,
 * KcsChanNhomSection:389) - ở đây kiểm đúng điều kiện đó trên số liệu.
 */
import { describe, expect, it } from 'vitest'
import {
  MSG_ACTUAL_CLAMPED, MSG_CHUA_GAN_SKU, MSG_LENH_DUNG, MSG_FORBIDDEN, blockedMessage, buildFlatPayload, buildSegmentsPayload,
  calcRow, clampActual, hasBlockingError, pickRowState, sumRows,
} from './kcsReviewModel'

describe('AC28 - Thực có > Đã báo tự về Đã báo, kèm câu', () => {
  it('câu nhắc đúng nguyên văn AC28', () => {
    expect(MSG_ACTUAL_CLAMPED).toBe('Dư thật thì công nhân báo thêm (nếu còn số cần)')
  })
  it('gõ 125, đã báo 120 -> ô là "120" và cờ clamped bật (để hiện câu)', () => {
    const c = clampActual('125', 120)
    expect(c.value).toBe('120')
    expect(c.clamped).toBe(true)
  })
  it('biên: 121 (hơn 1) bị kẹp; 120 (bằng) không bị kẹp', () => {
    expect(clampActual('121', 120)).toEqual({ value: '120', clamped: true })
    expect(clampActual('120', 120).clamped).toBe(false)
  })
  it('sau khi kẹp, dòng chấm không còn lỗi và không thiếu', () => {
    const c = clampActual('125', 120)
    const r = calcRow('CAT', { reported: 120, actual: c.value })
    expect(r).toMatchObject({ actual: 120, short: 0, passed: 120, error: null })
  })
  it('đã báo 0: gõ số nào > 0 cũng về 0 kèm câu', () => {
    expect(clampActual('5', 0)).toEqual({ value: '0', clamped: true })
  })
  it('gõ số thập phân / có khoảng trắng: bỏ phần lẻ, kẹp theo phần nguyên', () => {
    expect(clampActual(' 125 ', 120)).toEqual({ value: '120', clamped: true })
    expect(clampActual('119.9', 120)).toEqual({ value: '119', clamped: false })
  })
  it('ô chỉ có khoảng trắng coi như rỗng (= bằng Đã báo)', () => {
    expect(clampActual('   ', 120)).toEqual({ value: '', clamped: false })
  })
  it('Thực có = 0 hợp lệ: thiếu cả đợt, đạt 0, không lỗi', () => {
    expect(calcRow('CAT', { reported: 120, actual: '0' })).toMatchObject({ actual: 0, short: 120, passed: 0, error: null })
  })
  it('shortQty không bao giờ âm: mọi Thực có (kể cả chữ, âm, lớn) đều cho short >= 0', () => {
    for (const actual of ['', '0', '-1', 'abc', '119', '120', '125', '9999']) {
      expect(calcRow('CAT', { reported: 120, actual }).short, `actual=${actual}`).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('AC29 - số sai báo đỏ ở dòng và khoá "Xác nhận chấm"', () => {
  it('Cắt: thiếu 5 + lỗi 118 / báo 120 -> dòng có error, nút khoá', () => {
    const r = calcRow('CAT', { reported: 120, actual: '115', failed: '118' })
    expect(r.error).not.toBeNull()
    expect(hasBlockingError([r])).toBe(true)
  })
  it('biên: thiếu 5 + lỗi 115 = đúng 120 thì hợp lệ, nút mở; lỗi 116 thì khoá', () => {
    expect(hasBlockingError([calcRow('CAT', { reported: 120, actual: '115', failed: '115' })])).toBe(false)
    expect(hasBlockingError([calcRow('CAT', { reported: 120, actual: '115', failed: '116' })])).toBe(true)
  })
  it('lô Hàn: thiếu 10 + không đạt 55 / báo 60 -> đỏ kèm chữ "không đạt"', () => {
    const r = calcRow('FLAT', { reported: 60, actual: '50', failed: '55' })
    expect(r.error).toBe('Thiếu (10) + không đạt (55) vượt số đã báo (60)')
    expect(hasBlockingError([r])).toBe(true)
  })
  it('công đoạn phụ: làm lại + bỏ + thiếu vượt đã báo -> khoá; chỉ 1 dòng đỏ trong nhiều dòng cũng khoá cả hộp', () => {
    const bad = calcRow('STEP', { reported: 10, actual: '8', rework: '5', scrap: '4' })
    expect(bad.error).toBe('thiếu 2 + lỗi 9 vượt số đã báo trong đợt (10)')
    const ok = calcRow('STEP', { reported: 10, actual: '', rework: '1', scrap: '1' })
    expect(hasBlockingError([ok])).toBe(false)
    expect(hasBlockingError([ok, bad])).toBe(true)
  })
  it('đợt báo 0: lỗi 1 -> đỏ (không đạt nào cũng vượt 0)', () => {
    expect(calcRow('CAT', { reported: 0, actual: '', failed: '1' }).error).not.toBeNull()
  })
  it('sửa lại số cho đúng thì hết đỏ, nút mở lại', () => {
    expect(hasBlockingError([calcRow('CAT', { reported: 120, actual: '115', failed: '118' })])).toBe(true)
    expect(hasBlockingError([calcRow('CAT', { reported: 120, actual: '115', failed: '3' })])).toBe(false)
  })
  it('không kẹp im lặng: dòng đỏ vẫn giữ nguyên số lỗi nhập (không tự sửa về số hợp lệ)', () => {
    const r = calcRow('CAT', { reported: 120, actual: '115', failed: '118' })
    expect(r.failed).toBe(118)
    expect(r.short).toBe(5)
  })
  it('gõ Thực có > Đã báo thẳng vào calcRow (dán số) -> đỏ, không kẹp im lặng', () => {
    const r = calcRow('FLAT', { reported: 60, actual: '70' })
    expect(r.error).toBe('Thực có không được lớn hơn số đã báo (60)')
    expect(hasBlockingError([r])).toBe(true)
  })
  it('tổng của hộp có dòng đỏ vẫn tính được (không ném lỗi)', () => {
    const t = sumRows([calcRow('CAT', { reported: 120, actual: '115', failed: '118' })])
    expect(t.reported).toBe(120)
  })
})

describe('body gửi BE chỉ có số hợp lệ (shortQty không âm)', () => {
  it('Cắt: thiếu 5 -> shortQty 5; không có số âm trong body', () => {
    const body = buildSegmentsPayload('CAT', [{ segmentSpecId: '441', calc: calcRow('CAT', { reported: 120, actual: '115', failed: '3' }) }])
    expect(body).toEqual([{ segmentSpecId: '441', failedQty: 3, shortQty: 5 }])
  })
  it('Thực có rỗng, lỗi 0 -> không gửi dòng nào (khỏi gửi shortQty 0)', () => {
    expect(buildSegmentsPayload('CAT', [{ segmentSpecId: '1', calc: calcRow('CAT', { reported: 5, actual: '' }) }])).toEqual([])
  })
  it('FLAT: Thực có 0 -> shortQty = Đã báo, không âm', () => {
    expect(buildFlatPayload(calcRow('FLAT', { reported: 20, actual: '0' }))).toEqual({ failedQty: 0, shortQty: 20 })
  })
  it('pat / chân nhôm báo vượt số cần (Câu 6): hộp chấm không phụ thuộc số cần, chỉ theo Đã báo', () => {
    // Đã báo 150 trên số cần 100 vẫn chấm bình thường: không có tham số "số cần" trong calcRow
    const r = calcRow('FLAT', { reported: 150, actual: '', failed: '2' })
    expect(r).toMatchObject({ reported: 150, passed: 148, error: null })
  })
})

describe('AC12 / MF2 - dòng xám theo đúng nguồn, câu nguyên văn', () => {
  it('blockedMessage: null / undefined / lý do lạ -> không xám', () => {
    expect(blockedMessage(null)).toBeNull()
    expect(blockedMessage(undefined)).toBeNull()
    expect(blockedMessage('KHAC' as never)).toBeNull()
  })
  it('dòng xám không tính vào số chờ chấm (khớp số đỏ menu)', () => {
    expect(pickRowState({ phase: 'OPEN', blockedReason: 'LENH_DUNG' }).counted).toBe(false)
    expect(pickRowState({ phase: 'AWAITING_QC', piStopped: true }).counted).toBe(false)
    expect(pickRowState({ phase: 'OPEN', blockedReason: null }).counted).toBe(true)
  })
  it('đợt đã chốt mà PI dừng dùng cùng câu "Lệnh đang tạm dừng", không phải câu "chưa gắn SKU"', () => {
    expect(pickRowState({ phase: 'AWAITING_QC', piStopped: true }).message).toBe(MSG_LENH_DUNG)
    expect(pickRowState({ phase: 'AWAITING_QC', piStopped: true }).message).not.toBe(MSG_CHUA_GAN_SKU)
  })
  it('câu 403 nguyên văn', () => {
    expect(MSG_FORBIDDEN).toBe('Chưa có quyền xem các đợt đang mở - tải lại trang sau ít phút hoặc đăng nhập lại.')
  })
})
