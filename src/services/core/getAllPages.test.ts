import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./http', () => ({ http: { get: vi.fn() } }))

import { http } from './http'
import { getAllPages, MAX_PAGES, PAGE_LIMIT } from './getAllPages'

const get = http.get as ReturnType<typeof vi.fn>

const page = (ids: number[], totalPages: number) => ({ data: ids.map((id) => ({ id })), meta: { totalPages } })

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getAllPages', () => {
  it('endpoint trả mảng thẳng -> 1 request, trả nguyên mảng', async () => {
    get.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])

    expect(await getAllPages('/x')).toEqual([{ id: 1 }, { id: 2 }])
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('/x', { params: { limit: PAGE_LIMIT, page: 1 } })
  })

  it('1 trang -> không gọi thêm', async () => {
    get.mockResolvedValueOnce(page([1, 2], 1))

    expect(await getAllPages('/x', { stage: 'HAN' })).toEqual([{ id: 1 }, { id: 2 }])
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('/x', { params: { stage: 'HAN', limit: PAGE_LIMIT, page: 1 } })
  })

  it('nhiều trang -> tải đủ, đúng thứ tự trang, giữ tham số lọc', async () => {
    get.mockImplementation((_p: string, cfg: { params: { page: number } }) =>
      Promise.resolve(page([cfg.params.page * 10, cfg.params.page * 10 + 1], 5)),
    )

    const rows = await getAllPages<{ id: number }>('/x', { status: 'OPEN' })

    expect(rows.map((r) => r.id)).toEqual([10, 11, 20, 21, 30, 31, 40, 41, 50, 51])
    expect(get).toHaveBeenCalledTimes(5)
    for (let p = 1; p <= 5; p++) {
      expect(get).toHaveBeenCalledWith('/x', { params: { status: 'OPEN', limit: PAGE_LIMIT, page: p } })
    }
  })

  it('bỏ trùng theo id khi 1 dòng trôi sang trang sau', async () => {
    get.mockResolvedValueOnce(page([1, 2], 2)).mockResolvedValueOnce(page([2, 3], 2))

    expect((await getAllPages<{ id: number }>('/x')).map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('dòng không có id thì giữ nguyên, không bỏ trùng', async () => {
    get.mockResolvedValueOnce({ data: [{ v: 1 }, { v: 1 }], meta: { totalPages: 1 } })

    expect(await getAllPages('/x')).toEqual([{ v: 1 }, { v: 1 }])
  })

  it('vượt MAX_PAGES -> chỉ tải tới trần và cảnh báo', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    get.mockImplementation((_p: string, cfg: { params: { page: number } }) =>
      Promise.resolve(page([cfg.params.page], MAX_PAGES + 10)),
    )

    const rows = await getAllPages('/x')

    expect(rows).toHaveLength(MAX_PAGES)
    expect(get).toHaveBeenCalledTimes(MAX_PAGES)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
