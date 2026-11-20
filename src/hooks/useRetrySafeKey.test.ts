import { describe, expect, it } from 'vitest'
import { ApiError } from '../services/core/apiError'
import { createRetrySafeKey, keepsRetryKey } from './useRetrySafeKey'

// 20/11/2026 (IDEM-0 / T4-4): chỉ giữ khoá khi không có phản hồi, hoặc BE báo "đang xử lý" (409 IdempotencyKeyInUseException).
describe('keepsRetryKey', () => {
  it('giữ khoá khi mất mạng (statusCode 0)', () => {
    expect(keepsRetryKey(new ApiError('x', 0, ''))).toBe(true)
  })

  it('giữ khoá khi 409 IdempotencyKeyInUseException', () => {
    expect(keepsRetryKey(new ApiError('đang xử lý', 409, 'IdempotencyKeyInUseException'))).toBe(true)
  })

  it('đổi khoá khi 409 thường, 422, 400, 500 hoặc lỗi không phải ApiError', () => {
    expect(keepsRetryKey(new ApiError('x', 409, 'ConflictException'))).toBe(false)
    expect(keepsRetryKey(new ApiError('x', 422, 'IdempotencyKeyReusedException'))).toBe(false)
    expect(keepsRetryKey(new ApiError('x', 400, 'BadRequestException'))).toBe(false)
    expect(keepsRetryKey(new ApiError('x', 500, 'Error'))).toBe(false)
    expect(keepsRetryKey(new Error('x'))).toBe(false)
  })
})

describe('createRetrySafeKey', () => {
  it('cùng nội dung sau khi mất mạng hoặc 409 đang xử lý thì dùng lại khoá', () => {
    const k = createRetrySafeKey()
    const a = k.take({ qty: 2 })
    k.settle(new ApiError('x', 0, ''))
    expect(k.take({ qty: 2 })).toBe(a)
    k.settle(new ApiError('x', 409, 'IdempotencyKeyInUseException'))
    expect(k.take({ qty: 2 })).toBe(a)
  })

  it('đổi khoá khi thành công, 409 thường, 422 hoặc nội dung khác', () => {
    const k = createRetrySafeKey()
    const a = k.take({ qty: 2 })
    k.settle()
    const b = k.take({ qty: 2 })
    expect(b).not.toBe(a)
    k.settle(new ApiError('x', 422, 'IdempotencyKeyReusedException'))
    const c = k.take({ qty: 2 })
    expect(c).not.toBe(b)
    k.settle(new ApiError('x', 409, 'ConflictException'))
    const d = k.take({ qty: 2 })
    expect(d).not.toBe(c)
    expect(k.take({ qty: 3 })).not.toBe(d)
  })
})
