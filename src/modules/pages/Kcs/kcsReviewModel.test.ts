import { describe, expect, it } from 'vitest'
import {
  MSG_CHUA_GAN_SKU, MSG_LENH_DUNG, buildFlatPayload, buildSegmentsPayload, calcRow, clampActual, doneText,
  hasBlockingError, isPiStopped, parseQty, pickRowState, reviewOutcome, sumPendingQty, sumRows, totalsText,
} from './kcsReviewModel'

describe('sumPendingQty (tiêu đề nhóm khi lệnh dừng)', () => {
  it('cộng đủ 1+2+8+4 = 15 dù các dòng đều xám', () => {
    expect(sumPendingQty([{ pendingQty: 1 }, { pendingQty: 2 }, { pendingQty: 8 }, { pendingQty: 4 }])).toBe(15)
  })
  it('không có dòng -> 0', () => {
    expect(sumPendingQty([])).toBe(0)
  })
})

describe('pickRowState (UF2 / AC10-AC12)', () => {
  it('dòng mở bình thường -> chấm được, tính vào số chờ', () => {
    expect(pickRowState({ phase: 'OPEN', blockedReason: null })).toEqual({ muted: false, locked: false, message: null, counted: true })
  })
  it('dòng mở, BE cũ chưa trả blockedReason -> chấm được', () => {
    expect(pickRowState({ phase: 'OPEN' }).locked).toBe(false)
  })
  it('dòng mở LENH_DUNG -> xám, khoá, đúng câu', () => {
    const s = pickRowState({ phase: 'OPEN', blockedReason: 'LENH_DUNG' })
    expect(s).toEqual({ muted: true, locked: true, message: MSG_LENH_DUNG, counted: false })
    expect(s.message).toBe('Lệnh đang tạm dừng / đã kết thúc - chưa chấm được')
  })
  it('dòng mở CHUA_GAN_SKU -> xám, khoá, câu báo IT', () => {
    const s = pickRowState({ phase: 'OPEN', blockedReason: 'CHUA_GAN_SKU' })
    expect(s.locked).toBe(true)
    expect(s.message).toBe(MSG_CHUA_GAN_SKU)
    expect(s.message).toBe('Dữ liệu cũ chưa gắn SKU - chưa chấm được, báo IT')
  })
  it('dòng đã chốt, PI không dừng -> chấm được', () => {
    expect(pickRowState({ phase: 'AWAITING_QC', piStopped: false })).toEqual({ muted: false, locked: false, message: null, counted: true })
  })
  it('dòng đã chốt, PI dừng (stoppedPis) -> xám, khoá, không tính', () => {
    expect(pickRowState({ phase: 'AWAITING_QC', piStopped: true })).toEqual({ muted: true, locked: true, message: MSG_LENH_DUNG, counted: false })
  })
  it('dòng đã chốt KHÔNG xám chỉ vì blockedReason (đợt đã chốt chỉ theo stoppedPis)', () => {
    expect(pickRowState({ phase: 'AWAITING_QC', blockedReason: 'CHUA_GAN_SKU', piStopped: false }).locked).toBe(false)
  })
  it('dòng mở KHÔNG xám theo stoppedPis (đã có blockedReason của BE)', () => {
    expect(pickRowState({ phase: 'OPEN', blockedReason: null, piStopped: true }).locked).toBe(false)
  })
})

describe('isPiStopped (MF2)', () => {
  const stopped = [{ productionInvoiceId: '78', code: 'PI-2026-004' }]
  it('so theo id (KcsPhoiPage)', () => {
    expect(isPiStopped(stopped, { productionInvoiceId: '78' })).toBe(true)
    expect(isPiStopped(stopped, { productionInvoiceId: '79' })).toBe(false)
  })
  it('so theo mã PI (KcsStagePage)', () => {
    expect(isPiStopped(stopped, { code: 'PI-2026-004' })).toBe(true)
    expect(isPiStopped(stopped, { code: 'PI-2026-005' })).toBe(false)
  })
  it('thiếu danh sách / thiếu mã -> không xám', () => {
    expect(isPiStopped(undefined, { code: 'PI-2026-004' })).toBe(false)
    expect(isPiStopped(null, { code: 'PI-2026-004' })).toBe(false)
    expect(isPiStopped([], { code: 'PI-2026-004' })).toBe(false)
    expect(isPiStopped(stopped, { code: null })).toBe(false)
    expect(isPiStopped(stopped, { code: '', productionInvoiceId: '' })).toBe(false)
  })
})

describe('clampActual (S2 / AC28)', () => {
  it('gõ 125 khi đã báo 120 -> về 120 kèm cờ nhắc', () => {
    expect(clampActual('125', 120)).toEqual({ value: '120', clamped: true })
  })
  it('bằng hoặc nhỏ hơn Đã báo -> giữ nguyên', () => {
    expect(clampActual('120', 120)).toEqual({ value: '120', clamped: false })
    expect(clampActual('115', 120)).toEqual({ value: '115', clamped: false })
  })
  it('rỗng giữ rỗng (= bằng Đã báo)', () => {
    expect(clampActual('', 120)).toEqual({ value: '', clamped: false })
  })
  it('số âm / chữ -> 0', () => {
    expect(clampActual('-3', 120).value).toBe('0')
    expect(clampActual('abc', 120).value).toBe('0')
  })
  it('parseQty bỏ phần lẻ', () => expect(parseQty('3.9')).toBe(3))
})

describe('calcRow', () => {
  it('Cắt: đã báo 120, thực có 115, lỗi 3 -> thiếu 5, đạt 112 (AC27)', () => {
    const r = calcRow('CAT', { reported: 120, actual: '115', failed: '3' })
    expect(r).toMatchObject({ actual: 115, short: 5, failed: 3, passed: 112, error: null })
  })
  it('Thực có rỗng = Đã báo, không thiếu', () => {
    expect(calcRow('CAT', { reported: 120, actual: '' })).toMatchObject({ short: 0, failed: 0, passed: 120, error: null })
  })
  it('thiếu + lỗi vượt đã báo -> báo đỏ (AC29)', () => {
    const r = calcRow('CAT', { reported: 120, actual: '115', failed: '118' })
    expect(r.error).toBe('thiếu 5 + lỗi 118 vượt số đã báo trong đợt (120)')
  })
  it('không thiếu: bỏ phần "thiếu" (cùng chữ BE)', () => {
    expect(calcRow('CAT', { reported: 2, actual: '', failed: '3' }).error).toBe('lỗi 3 vượt số đã báo trong đợt (2)')
    expect(calcRow('FLAT', { reported: 60, actual: '', failed: '61' }).error).toBe('Số không đạt (61) không được vượt số lượng đã báo (60)')
  })
  it('mảnh: câu dùng "không đạt" (lô Hàn thiếu 10 + không đạt 55 / báo 60 vẫn hợp lệ)', () => {
    expect(calcRow('FLAT', { reported: 60, actual: '50', failed: '10' }).error).toBeNull()
    expect(calcRow('FLAT', { reported: 60, actual: '50', failed: '55' }).error).toBe('Thiếu (10) + không đạt (55) vượt số đã báo (60)')
  })
  it('công đoạn phụ: lỗi = làm lại + bỏ', () => {
    const r = calcRow('STEP', { reported: 200, actual: '', rework: '3', scrap: '5' })
    expect(r).toMatchObject({ failed: 8, rework: 3, scrap: 5, short: 0, passed: 192 })
  })
  it('lỗi đúng bằng đã báo vẫn hợp lệ; hơn 1 là đỏ', () => {
    expect(calcRow('CAT', { reported: 10, actual: '', failed: '10' }).error).toBeNull()
    expect(calcRow('CAT', { reported: 10, actual: '', failed: '11' }).error).not.toBeNull()
  })
  it('Thực có lớn hơn Đã báo (ô bị dán số) -> báo đỏ, không kẹp im lặng', () => {
    expect(calcRow('CAT', { reported: 10, actual: '12' }).error).toBe('Thực có không được lớn hơn số đã báo (10)')
  })
})

describe('tổng + câu chữ', () => {
  const rows = [
    calcRow('STEP', { reported: 100, actual: '95', rework: '3', scrap: '2' }),
    calcRow('STEP', { reported: 50, actual: '', rework: '', scrap: '' }),
  ]
  it('sumRows', () => {
    expect(sumRows(rows)).toEqual({ reported: 150, passed: 140, failed: 5, rework: 3, scrap: 2, short: 5 })
  })
  it('dòng tổng công đoạn phụ: Đạt · Lỗi (bỏ a, làm lại b) · Thiếu c', () => {
    expect(totalsText('STEP', sumRows(rows))).toBe('Đạt 140 · Lỗi 5 (bỏ 2, làm lại 3) · Thiếu 5')
  })
  it('dòng tổng Cắt không có phần bỏ / làm lại', () => {
    expect(totalsText('CAT', sumRows([calcRow('CAT', { reported: 120, actual: '115', failed: '3' })]))).toBe('Đạt 112 · Lỗi 3 · Thiếu 5')
  })
  it('dòng tổng mảnh dùng "Không đạt"', () => {
    expect(totalsText('FLAT', sumRows([calcRow('FLAT', { reported: 60, actual: '', failed: '1' })]))).toBe('Đạt 59 · Không đạt 1 · Thiếu 0')
  })
  it('câu báo xong chỉ hiện phần khác 0', () => {
    expect(doneText('CAT', sumRows([calcRow('CAT', { reported: 120, actual: '115', failed: '3' })]))).toBe('112 đạt · 3 lỗi · thiếu 5')
    expect(doneText('FLAT', sumRows([calcRow('FLAT', { reported: 60, actual: '' })]))).toBe('60 đạt')
  })
  it('hasBlockingError', () => {
    expect(hasBlockingError(rows)).toBe(false)
    expect(hasBlockingError([...rows, calcRow('CAT', { reported: 1, actual: '', failed: '2' })])).toBe(true)
  })
})

describe('buildSegmentsPayload', () => {
  it('Cắt: failedQty + shortQty, bỏ dòng 0 / 0, không có scrapQty', () => {
    const body = buildSegmentsPayload('CAT', [
      { segmentSpecId: '1', calc: calcRow('CAT', { reported: 120, actual: '115', failed: '3' }) },
      { segmentSpecId: '2', calc: calcRow('CAT', { reported: 50, actual: '' }) },
      { segmentSpecId: '3', calc: calcRow('CAT', { reported: 10, actual: '', failed: '2' }) },
    ])
    expect(body).toEqual([
      { segmentSpecId: '1', failedQty: 3, shortQty: 5 },
      { segmentSpecId: '3', failedQty: 2 },
    ])
  })
  it('công đoạn phụ: failedQty = làm lại + bỏ, scrapQty = bỏ (kể cả 0 khi chỉ làm lại)', () => {
    const body = buildSegmentsPayload('STEP', [
      { segmentSpecId: '1', calc: calcRow('STEP', { reported: 200, actual: '', rework: '3', scrap: '5' }) },
      { segmentSpecId: '2', calc: calcRow('STEP', { reported: 20, actual: '', rework: '4', scrap: '' }) },
    ])
    expect(body).toEqual([
      { segmentSpecId: '1', failedQty: 8, scrapQty: 5 },
      { segmentSpecId: '2', failedQty: 4, scrapQty: 0 },
    ])
  })
  it('công đoạn phụ chỉ thiếu (không lỗi): không gửi scrapQty', () => {
    const body = buildSegmentsPayload('STEP', [{ segmentSpecId: '1', calc: calcRow('STEP', { reported: 20, actual: '18' }) }])
    expect(body).toEqual([{ segmentSpecId: '1', failedQty: 0, shortQty: 2 }])
  })
  it('đạt hết -> mảng rỗng', () => {
    expect(buildSegmentsPayload('CAT', [{ segmentSpecId: '1', calc: calcRow('CAT', { reported: 5, actual: '' }) }])).toEqual([])
  })
})

describe('buildFlatPayload', () => {
  it('có thiếu thì gửi shortQty', () => {
    expect(buildFlatPayload(calcRow('FLAT', { reported: 60, actual: '56', failed: '1' }))).toEqual({ failedQty: 1, shortQty: 4 })
  })
  it('không thiếu thì không gửi shortQty', () => {
    expect(buildFlatPayload(calcRow('FLAT', { reported: 60, actual: '', failed: '1' }))).toEqual({ failedQty: 1 })
  })
})

describe('reviewOutcome', () => {
  it('cộng lỗi / thiếu / bỏ theo từng cỡ; làm lại = lỗi - bỏ', () => {
    expect(reviewOutcome([
      { failedQty: 8, shortQty: 0, scrapQty: 5 },
      { failedQty: 2, shortQty: 3 },
    ])).toEqual({ failed: 10, short: 3, scrap: 5, rework: 5 })
  })
  it('đợt cũ chưa có shortQty / scrapQty -> 0 (Cắt: lỗi nào cũng cắt lại, không có phần bỏ)', () => {
    expect(reviewOutcome([{ failedQty: 4 }])).toEqual({ failed: 4, short: 0, scrap: 0, rework: 4 })
  })
  it('rỗng -> toàn 0', () => {
    expect(reviewOutcome([])).toEqual({ failed: 0, short: 0, scrap: 0, rework: 0 })
  })
})
