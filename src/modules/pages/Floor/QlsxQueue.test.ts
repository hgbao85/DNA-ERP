import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/core/apiError'
import { isStaleConflict, phoiAwaitingAutoClose, queueActorText } from './QlsxQueue'

describe('isStaleConflict', () => {
  it('ApiError 409 -> true (máy chủ báo lệnh đang chạy đã đổi, phải tải lại)', () =>
    expect(isStaleConflict(new ApiError('Lệnh đang chạy đã đổi', 409, 'Conflict'))).toBe(true))
  it('ApiError khác 409 -> false', () => expect(isStaleConflict(new ApiError('Lỗi', 400, 'Bad Request'))).toBe(false))
  it('lỗi thường / không phải lỗi -> false', () => {
    expect(isStaleConflict(new Error('x'))).toBe(false)
    expect(isStaleConflict(null)).toBe(false)
  })
})

describe('queueActorText', () => {
  it('có tên người bấm thì ghi tên', () => expect(queueActorText('PHOI', 'Nguyễn A', '2026-11-14T01:00:00Z')).toBe(' · Nguyễn A'))
  it('tổ Phôi không ai bấm (hệ thống tự đóng / tự chạy lệnh kế) thì ghi rõ', () =>
    expect(queueActorText('PHOI', null, '2026-11-14T01:00:00Z')).toBe(' · hệ thống tự chuyển'))
  it('tổ Phôi chưa có giờ thì không ghi gì', () => expect(queueActorText('PHOI', null, null)).toBe(''))
  it('tổ Hàn / Sơn vẫn do QLSX bấm - thiếu tên thì không đoán', () => expect(queueActorText('HAN', null, '2026-11-14T01:00:00Z')).toBe(''))
})

describe('phoiAwaitingAutoClose', () => {
  const run = (required: number, passed: number) => ({ progress: { required, passed } as never })
  it('đạt đủ (passed ≥ required > 0) ở tổ Phôi -> true', () => {
    expect(phoiAwaitingAutoClose('PHOI', run(10, 10))).toBe(true)
    expect(phoiAwaitingAutoClose('PHOI', run(10, 12))).toBe(true)
  })
  it('passed < required (dù đã báo đủ) -> false', () => expect(phoiAwaitingAutoClose('PHOI', run(10, 9))).toBe(false))
  it('required = 0 -> false', () => expect(phoiAwaitingAutoClose('PHOI', run(0, 0))).toBe(false))
  it('tổ Hàn / Sơn -> false', () => {
    expect(phoiAwaitingAutoClose('HAN', run(10, 10))).toBe(false)
    expect(phoiAwaitingAutoClose('SON', run(10, 10))).toBe(false)
  })
  it('không có lệnh chạy hoặc không có progress -> false', () => {
    expect(phoiAwaitingAutoClose('PHOI', null)).toBe(false)
    expect(phoiAwaitingAutoClose('PHOI', { progress: null })).toBe(false)
  })
})
