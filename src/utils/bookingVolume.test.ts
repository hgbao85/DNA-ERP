import { describe, expect, it } from 'vitest'
import { bookingTotalsPreview } from './bookingVolume'

const line = (qty: number, boxVolumeM3: number | null, boxesPerSet = 1, factoryCode = 'A') => ({ qty, boxVolumeM3, boxesPerSet, factoryCode })

describe('bookingTotalsPreview', () => {
  it('0,844 × 80 = 67,52 m³ (99,3%)', () => {
    const r = bookingTotalsPreview([line(80, 0.844)], 68, 1)
    expect(r.totalM3).toBe(67.52)
    expect(r.capacityM3).toBe(68)
    expect(r.fillPct).toBe(99.3)
    expect(r.missingVolumeSkus).toEqual([])
  })

  it('0,68 × 2 thùng/bộ × 50 = 68 (100,0%)', () => {
    const r = bookingTotalsPreview([line(50, 0.68, 2)], 68, 1)
    expect(r.totalM3).toBe(68)
    expect(r.fillPct).toBe(100)
  })

  it('SKU thiếu kích thước được liệt kê một lần, dòng qty 0 bỏ qua', () => {
    const r = bookingTotalsPreview([line(10, null, 1, 'X1'), line(5, null, 1, 'X1'), line(0, null, 1, 'X2'), line(10, 0.5, 1, 'B')], 68, 1)
    expect(r.missingVolumeSkus).toEqual(['X1'])
    expect(r.totalM3).toBe(5)
  })

  it('2 cont -> sức chứa 136', () => {
    const r = bookingTotalsPreview([line(80, 0.844)], 68, 2)
    expect(r.capacityM3).toBe(136)
    expect(r.fillPct).toBe(49.6)
  })

  it('sức chứa 0 -> fillPct null', () => {
    expect(bookingTotalsPreview([line(1, 1)], 68, 0).fillPct).toBeNull()
  })
})
