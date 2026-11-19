import { describe, expect, it } from 'vitest'
import { WORK_QUEUE_DEBOUNCE_MS, WORK_QUEUE_TOPICS, isKcsAccount, workQueueTopics } from './workQueueTopics'

describe('workQueueTopics', () => {
  it('KCS (mfgRole) nghe thêm floor', () => {
    expect(workQueueTopics({ mfgRole: 'KCS' })).toContain('floor')
  })
  it('có vai KCS_STAFF (không có mfgRole) cũng nghe thêm floor', () => {
    expect(workQueueTopics({ mfgRole: null, roles: ['KCS_STAFF'] })).toContain('floor')
  })
  it('KCS vẫn giữ nguyên mọi topic cũ', () => {
    const t = workQueueTopics({ mfgRole: 'KCS' })
    for (const x of WORK_QUEUE_TOPICS) expect(t).toContain(x)
  })
  it('QLSX không nghe floor (đã có /floor/summary riêng, AC4)', () => {
    expect(workQueueTopics({ mfgRole: 'PRODUCTION_MANAGER' })).not.toContain('floor')
    expect(workQueueTopics({ roles: ['PRODUCTION_MANAGER'] })).not.toContain('floor')
  })
  it('vai khác / chưa đăng nhập giữ danh sách cũ', () => {
    expect(workQueueTopics({ mfgRole: 'PHOI' })).toEqual([...WORK_QUEUE_TOPICS])
    expect(workQueueTopics({})).toEqual([...WORK_QUEUE_TOPICS])
    expect(workQueueTopics({ mfgRole: undefined, roles: undefined })).toEqual([...WORK_QUEUE_TOPICS])
  })
  it('vừa QLSX vừa KCS_STAFF thì tính là KCS', () => {
    expect(isKcsAccount({ mfgRole: 'PRODUCTION_MANAGER', roles: ['KCS_STAFF'] })).toBe(true)
  })
  it('gom sự kiện 3 giây', () => expect(WORK_QUEUE_DEBOUNCE_MS).toBe(3000))
})
