import { describe, expect, it } from 'vitest'
import { bookingDueDay, daysBetween, fmtDay, fmtVnDateTime, isoToVnLocal, todayVn, vnDayOfIso, vnLocalToIso } from './bookingDates'

describe('bookingDates (giờ VN cố định)', () => {
  it('vnLocalToIso / isoToVnLocal khứ hồi', () => {
    expect(vnLocalToIso('2026-11-02T08:00')).toBe('2026-11-02T01:00:00.000Z')
    expect(vnLocalToIso('2026-11-02T00:30')).toBe('2026-11-01T17:30:00.000Z')
    expect(isoToVnLocal('2026-11-02T01:00:00.000Z')).toBe('2026-11-02T08:00')
    expect(isoToVnLocal('2026-11-01T17:30:00.000Z')).toBe('2026-11-02T00:30')
    expect(vnLocalToIso('abc')).toBeNull()
    expect(isoToVnLocal(null)).toBe('')
  })

  it('định dạng hiển thị', () => {
    expect(fmtVnDateTime('2026-11-02T01:00:00.000Z')).toBe('08:00 02/11/2026')
    expect(fmtVnDateTime(null)).toBe('')
    expect(fmtDay('2026-11-02')).toBe('02/11/2026')
    expect(fmtDay(null)).toBe('')
  })

  it('qua nửa đêm: 17:30Z là 00:30 hôm sau giờ VN', () => {
    expect(vnDayOfIso('2026-11-01T17:30:00.000Z')).toBe('2026-11-02')
    expect(vnDayOfIso('2026-11-01T16:59:00.000Z')).toBe('2026-11-01')
    expect(vnDayOfIso(null)).toBeNull()
  })

  it('bookingDueDay lấy ngày sớm hơn', () => {
    expect(bookingDueDay({ pickupDate: '2026-11-05', cutOffAt: '2026-11-01T17:30:00.000Z' })).toBe('2026-11-02')
    expect(bookingDueDay({ pickupDate: '2026-11-01', cutOffAt: '2026-11-01T17:30:00.000Z' })).toBe('2026-11-01')
    expect(bookingDueDay({ pickupDate: '2026-11-05', cutOffAt: null })).toBe('2026-11-05')
    expect(bookingDueDay({ pickupDate: null, cutOffAt: '2026-11-01T17:30:00.000Z' })).toBe('2026-11-02')
    expect(bookingDueDay({ pickupDate: null, cutOffAt: null })).toBeNull()
  })

  it('daysBetween / todayVn', () => {
    expect(daysBetween('2026-11-02', '2026-11-05')).toBe(3)
    expect(daysBetween('2026-11-05', '2026-11-02')).toBe(-3)
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1)
    expect(todayVn(new Date('2026-11-01T17:30:00.000Z'))).toBe('2026-11-02')
    expect(todayVn(new Date('2026-11-01T16:00:00.000Z'))).toBe('2026-11-01')
  })
})
