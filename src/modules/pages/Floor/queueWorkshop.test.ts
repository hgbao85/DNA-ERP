import { describe, expect, it } from 'vitest'
import { pickEffectiveWorkshop } from './queueWorkshop'

describe('pickEffectiveWorkshop', () => {
  const list = [{ id: 'a' }, { id: 'b' }]
  it('giữ xưởng đã nhớ khi còn trong danh sách', () => expect(pickEffectiveWorkshop(list, 'b')).toBe('b'))
  it('xưởng đã nhớ không còn thì lấy xưởng đầu', () => expect(pickEffectiveWorkshop(list, 'x')).toBe('a'))
  it('không có xưởng nào thì null', () => expect(pickEffectiveWorkshop([], 'a')).toBeNull())
})
