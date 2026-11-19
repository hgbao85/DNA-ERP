/**
 * UF4 (tester-unit #4, P1 "KCS tự chuyển"): AC4 phần FE - số đỏ menu của KCS đổi theo sự kiện 'floor', gom 3 giây, xong ≤ 5 giây;
 * QLSX / KHSX / vai khác KHÔNG nghe 'floor' (Q8: chỉ KCS). useWorkQueue.ts gọi đúng 2 hàm thuần này
 * (workQueueTopics + WORK_QUEUE_DEBOUNCE_MS, dòng 68), nên test hàm thuần là test hành vi chọn topic theo vai.
 * Bổ sung cho workQueueTopics.test.ts của Dev, không lặp ca.
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRefetchScheduler } from '../realtime/hooks'
import { KCS_WORK_QUEUE_TOPICS, WORK_QUEUE_DEBOUNCE_MS, WORK_QUEUE_TOPICS, workQueueTopics } from './workQueueTopics'

const ROLES = ['PRODUCTION_MANAGER', 'PHOI', 'HAN', 'SON', 'KCS', 'SPEC_STEEL', 'SPEC_ACCESSORY', 'SPEC_PACKAGING', null, undefined] as const

describe('AC4 / Q8 - chọn topic theo vai', () => {
  it('chỉ KCS có "floor"; mọi vai mfgRole khác (kể cả QLSX, KHSX) không có', () => {
    for (const r of ROLES) {
      const has = workQueueTopics({ mfgRole: r }).includes('floor')
      expect(has, `mfgRole=${String(r)}`).toBe(r === 'KCS')
    }
  })
  it('KCS = danh sách cũ + đúng 1 topic "floor" (không trùng, không mất topic nào)', () => {
    const t = workQueueTopics({ mfgRole: 'KCS' })
    expect(t.filter((x) => x === 'floor')).toHaveLength(1)
    expect(t).toHaveLength(WORK_QUEUE_TOPICS.length + 1)
    expect(new Set(t).size).toBe(t.length)
    expect([...t].sort()).toEqual([...WORK_QUEUE_TOPICS, 'floor'].sort())
    expect(KCS_WORK_QUEUE_TOPICS).toContain('floor')
  })
  it('danh sách cũ KHÔNG bị chèn "floor" (mảng dùng chung không bị sửa tại chỗ)', () => {
    workQueueTopics({ mfgRole: 'KCS' })
    expect(WORK_QUEUE_TOPICS).not.toContain('floor' as never)
  })
  it('QLSX vẫn nghe production-orders / qc-reviews như cũ (không mất topic khi bỏ "floor")', () => {
    const t = workQueueTopics({ mfgRole: 'PRODUCTION_MANAGER' })
    expect(t).toContain('production-orders')
    expect(t).toContain('qc-reviews')
  })
  it('mfgRole viết thường "kcs" không phải KCS (khớp đúng giá trị MfgRole)', () => {
    expect(workQueueTopics({ mfgRole: 'kcs' })).not.toContain('floor')
  })
  it('vai KCS_STAFF thật sự (có trong roles) cũng được; vai khác trong roles thì không', () => {
    expect(workQueueTopics({ roles: ['KCS_STAFF'] })).toContain('floor')
    expect(workQueueTopics({ roles: ['PHOI_STAFF', 'PRODUCTION_MANAGER'] })).not.toContain('floor')
  })
  it('hook useWorkQueue thật sự dùng workQueueTopics và debounce 3 giây (không còn danh sách cứng)', () => {
    const src = readFileSync(new URL('./useWorkQueue.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/useRealtimeRefetch\(workQueueTopics\(/)
    expect(src).toMatch(/debounceMs: WORK_QUEUE_DEBOUNCE_MS/)
  })
})

describe('AC4 - 3 lần Lưu trong 2 giây -> đúng 1 lần tải lại, xong ≤ 5 giây (giờ giả)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sự kiện ở giây 0, 1, 2 -> 1 lần tải ở giây 5 (2 + 3), không sớm hơn', () => {
    const run = vi.fn()
    const s = createRefetchScheduler(run, WORK_QUEUE_DEBOUNCE_MS)
    s.event()
    vi.advanceTimersByTime(1000); s.event()
    vi.advanceTimersByTime(1000); s.event()
    vi.advanceTimersByTime(2999)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    expect(run).toHaveBeenCalledTimes(1)
  })
  it('đợt báo kéo dài (mỗi giây 1 lần): vẫn tải chậm nhất 5 giây từ sự kiện đầu', () => {
    const run = vi.fn()
    const s = createRefetchScheduler(run, WORK_QUEUE_DEBOUNCE_MS)
    s.event()
    for (let i = 0; i < 4; i++) { vi.advanceTimersByTime(1000); s.event() }
    vi.advanceTimersByTime(1000)
    expect(run).toHaveBeenCalledTimes(1)
  })
})
