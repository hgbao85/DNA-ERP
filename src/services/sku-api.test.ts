import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}))

import { http } from './core/http'
import { deleteSkus } from './sku-api'

const del = http.del as ReturnType<typeof vi.fn>

// 20/11/2026 (XOA-SKU phần A): xoá nhiều SKU phải đi hết cả danh sách, rồi báo đủ "Đã xoá x/y" + câu của BE.
describe('deleteSkus', () => {
  beforeEach(() => del.mockReset())

  it('xoá hết thì không ném lỗi', async () => {
    del.mockResolvedValue(undefined)
    await expect(deleteSkus(['1', '2'])).resolves.toBeUndefined()
    expect(del).toHaveBeenCalledTimes(2)
  })

  it('có SKU bị chặn thì vẫn xoá các SKU còn lại và báo "Đã xoá 2/3" kèm câu của BE', async () => {
    del.mockImplementation(async (path: string) => {
      if (path === '/skus/2') throw new Error('SKU "A-1" còn 1 lệnh kiểm tra vật tư - không xoá được')
    })
    await expect(deleteSkus(['1', '2', '3'])).rejects.toThrow(
      /Đã xoá 2\/3 SKU[\s\S]*SKU "A-1" còn 1 lệnh kiểm tra vật tư - không xoá được/,
    )
    expect(del).toHaveBeenCalledTimes(3)
  })
})
