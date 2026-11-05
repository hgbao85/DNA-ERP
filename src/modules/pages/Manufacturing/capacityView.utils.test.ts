import { describe, expect, it } from 'vitest'
import { addDays, ddmm, fmtCont, groupRows, limitWarnings, todayKey, weekdayLabel } from './capacityView.utils'
import type { CapacityRow, CapacityWarning } from '../../../services/production-capacity-api'

const row = (groupCode: string, stage: CapacityRow['stage']): CapacityRow => ({
  groupKind: 'WORKSHOP', groupCode, groupName: groupCode, stage, stageLabel: stage, mode: 'CONT_PER_DAY', capacity: 1.3, days: [],
})

describe('capacityView.utils', () => {
  it('addDays qua tháng/năm', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-11-04', 14)).toBe('2026-11-18')
  })
  it('todayKey / ddmm / weekdayLabel', () => {
    expect(todayKey(new Date(2026, 10, 4))).toBe('2026-11-04')
    expect(ddmm('2026-11-04')).toBe('04/11')
    expect(weekdayLabel('2026-11-04')).toBe('T4')
    expect(weekdayLabel('2026-11-08')).toBe('CN')
  })
  it('fmtCont dấu phẩy, 1 số lẻ', () => {
    expect(fmtCont(1.3)).toBe('1,3')
    expect(fmtCont(2)).toBe('2')
    expect(fmtCont(0.26)).toBe('0,3')
  })
  it('groupRows gom liền nhau', () => {
    const g = groupRows([row('A', 'PHOI'), row('A', 'HAN'), row('B', 'PHOI')])
    expect(g.map((x) => x.rows.length)).toEqual([2, 1])
  })
  it('limitWarnings bỏ trùng và đếm phần còn lại', () => {
    const w = (message: string) => ({ message }) as CapacityWarning
    const r = limitWarnings([w('a'), w('a'), w('b'), w('c')], 2)
    expect(r.shown).toEqual(['a', 'b'])
    expect(r.rest).toBe(1)
  })
})
