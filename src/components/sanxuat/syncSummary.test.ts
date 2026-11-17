import { describe, expect, it } from 'vitest'
import type { ProcLine } from './core'
import { lechOf, manhFromLine, qtyPerUnitOf, syncSummary } from './syncSummary'

// Dữ liệu giả: 1 SKU 295 bộ, 7 mảnh với SL/bộ 2,2,2,2,4,1,1.
const NAMES = ['TAY TRÁI', 'TAY PHẢI', 'TỰA', 'MÊ', 'CHÂN BÀN', 'MẶT BÀN', 'KỶ']
const PER = [2, 2, 2, 2, 4, 1, 1]
const BO = 295

function lines(done: number[], per: (number | undefined)[] = PER): ProcLine[] {
  return NAMES.map((n, i) => ({
    id: i + 1, itemName: n, spec: `M${i + 1}`, needQty: (per[i] ?? 1) * BO, doneQty: done[i], perManh: per[i], lastInputAt: null,
  }))
}
const fullDone = PER.map((p) => p * BO) // 590,590,590,590,1180,295,295

describe('syncSummary - SL/bộ theo định mức', () => {
  it('AC1: đủ 295 bộ -> đồng bộ 295, không lệch, không mảnh nào cần thêm', () => {
    const ls = lines(fullDone)
    expect(fullDone).toEqual([590, 590, 590, 590, 1180, 295, 295])
    const s = syncSummary(ls)
    expect(s.status).toBe('ok')
    expect(s.db).toBe(295)
    expect(s.lech).toBe(false)
    expect(ls.map((l) => s.shortOf(l))).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(s.needCut).toEqual([])
    expect(lechOf(ls)).toBe(false)
  })

  it('AC2: TAY TRÁI 580/590 -> 290 bộ, lệch, chỉ TAY TRÁI cần thêm 10', () => {
    const done = [...fullDone]
    done[0] = 580
    const ls = lines(done)
    const s = syncSummary(ls)
    expect(s.db).toBe(290)
    expect(s.lech).toBe(true)
    expect(s.needCut).toEqual(['TAY TRÁI +10'])
    expect(ls.map((l) => s.shortOf(l))).toEqual([10, 0, 0, 0, 0, 0, 0])
  })

  it('AC3: mảnh báo dư (592/590) trong khi mảnh khác đủ -> không lệch (chặn trần)', () => {
    const done = [...fullDone]
    done[0] = 592
    const ls = lines(done)
    expect(manhFromLine(ls[0])).toBe(295)
    const s = syncSummary(ls)
    expect(s.lech).toBe(false)
    expect(s.db).toBe(295)
    expect(s.needCut).toEqual([])
  })

  it('mảnh báo dư không bù cho mảnh còn thiếu: vẫn cần thêm đúng phần thiếu', () => {
    const done = [...fullDone]
    done[0] = 700 // dư
    done[4] = 1170 // CHÂN BÀN thiếu 10 (= 2 bộ rưỡi -> 292 bộ)
    const s = syncSummary(lines(done))
    expect(s.db).toBe(292)
    expect(s.lech).toBe(true)
    // maxBo = 295 (TAY TRÁI chặn trần) -> CHÂN BÀN thiếu (295-292)*4 = 12
    expect(s.needCut).toEqual(['CHÂN BÀN +12'])
  })

  it('AC4: mảnh thiếu SL/bộ -> không kết luận lệch, không bịa số cần thêm', () => {
    const per = [...PER] as (number | undefined)[]
    per[0] = undefined
    const done = [...fullDone]
    done[4] = 100 // lệch rõ ràng nếu tính ×1
    const ls = lines(done, per)
    const s = syncSummary(ls)
    expect(s.status).toBe('unknown')
    expect(s.lech).toBe(false)
    expect(s.needCut).toEqual([])
    expect(ls.map((l) => s.shortOf(l)).every((n) => n === 0)).toBe(true)
    expect(lechOf(ls)).toBe(false)
  })

  it('showSync = false -> ẩn hẳn (xem nhiều SKU khác sản phẩm)', () => {
    const done = [...fullDone]
    done[0] = 100
    const s = syncSummary(lines(done), { showSync: false })
    expect(s.status).toBe('hidden')
    expect(s.lech).toBe(false)
    expect(s.needCut).toEqual([])
  })

  it('chỉ 1 mảnh không có chuyện lệch', () => {
    expect(lechOf(lines(fullDone).slice(0, 1))).toBe(false)
  })
})

describe('qtyPerUnitOf', () => {
  it('lấy qtyPerUnit của BE khi có', () => {
    expect(qtyPerUnitOf({ qtyPerUnit: 4, plannedQty: 1180 }, 295)).toBe(4)
  })
  it('AC4: BE cũ không trả -> suy ra plannedQty / quantity khi chia hết', () => {
    expect(qtyPerUnitOf({ plannedQty: 590 }, 295)).toBe(2)
    expect(qtyPerUnitOf({ plannedQty: 295 }, 295)).toBe(1)
  })
  it('không suy được -> undefined (không bịa 1)', () => {
    expect(qtyPerUnitOf({ plannedQty: 591 }, 295)).toBeUndefined()
    expect(qtyPerUnitOf({ plannedQty: 590 }, 0)).toBeUndefined()
    expect(qtyPerUnitOf({ plannedQty: 0 }, 295)).toBeUndefined()
    expect(qtyPerUnitOf({ qtyPerUnit: 0, plannedQty: 590 }, 0)).toBeUndefined()
  })
})
