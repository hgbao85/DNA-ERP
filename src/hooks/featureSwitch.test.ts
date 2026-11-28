import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../services/core/apiError'
import { createFeatureSwitch } from './featureSwitch'

/** Đợt 2 lượt 3 (28/11/2026): lỗi mạng tạm thời không còn bị nhớ là "tắt" cả phiên. */
describe('createFeatureSwitch', () => {
  it('BE trả enabled: nhớ, lần sau không hỏi lại', async () => {
    const fetch = vi.fn().mockResolvedValue({ enabled: true })
    const sw = createFeatureSwitch(fetch)
    await expect(sw.load()).resolves.toBe(true)
    await expect(sw.load()).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('BE cũ chưa có route (404): nhớ là tắt', async () => {
    const fetch = vi.fn().mockRejectedValue(new ApiError('Không tìm thấy', 404, 'Not Found'))
    const sw = createFeatureSwitch(fetch)
    await expect(sw.load()).resolves.toBe(false)
    await expect(sw.load()).resolves.toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('mất mạng: lần này tắt nhưng KHÔNG nhớ - lần sau hỏi lại được bật', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new ApiError('Không kết nối được', 0, 'Error'))
      .mockResolvedValue({ enabled: true })
    const sw = createFeatureSwitch(fetch)
    await expect(sw.load()).resolves.toBe(false)
    await expect(sw.load()).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
