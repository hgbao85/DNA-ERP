import { describe, expect, it } from 'vitest'
import { bucketLine, isShort, percentOf, pieceLine, remainingQty, steelShortHint, sumBuckets } from './progressModel'

// Cùng bộ ca với BE src/modules/floor/floor-progress.util.spec.ts - 2 bên phải ra cùng số.
describe('progressModel', () => {
  it('chia 1 dòng theo thứ tự đạt → KCS đang chấm → đang mở; lỗi chỉ trừ vào phần đã chấm', () => {
    expect(bucketLine({ required: 200, done: 100, failed: 5, open: 20, awaiting: 30 })).toEqual({
      required: 200, reported: 95, passed: 45, awaiting: 30, open: 20, failed: 5,
    })
  })

  it('báo vượt: chặn trần ở số cần, cắt phần đang mở trước', () => {
    expect(bucketLine({ required: 60, done: 78, failed: 0, open: 10, awaiting: 18 })).toMatchObject({ reported: 60, passed: 50, awaiting: 10, open: 0 })
  })

  it('dữ liệu lệch (lỗi lớn hơn phần đã chấm): tổng 3 ngăn vẫn = Đã báo − Lỗi', () => {
    expect(bucketLine({ required: 50, done: 10, failed: 8, open: 5, awaiting: 0 })).toMatchObject({ reported: 2, passed: 0, open: 2 })
  })

  it('còn thiếu do KCS chấm lỗi', () => {
    const line = { required: 720, done: 720, failed: 1, open: 0, awaiting: 0 }
    expect(isShort(line)).toBe(true)
    expect(remainingQty(line)).toBe(1)
  })

  it('mảnh: passedQty đã trừ lỗi, đã báo = đạt + KCS đang chấm + đang mở', () => {
    expect(bucketLine(pieceLine({ plannedQty: 60, passedQty: 40, awaitingQcQty: 10, openQty: 20 }))).toMatchObject({ reported: 60, passed: 40, awaiting: 10, open: 10 })
    expect(pieceLine({ plannedQty: 5, passedQty: 1, awaitingQcQty: 2 })).toEqual({ required: 5, done: 3, failed: 0, open: 0, awaiting: 2 })
  })

  it('mảnh có failedQty: đã báo gồm cả lỗi, được tính vẫn = đạt + KCS đang chấm + đang mở', () => {
    const line = pieceLine({ plannedQty: 40, passedQty: 36, awaitingQcQty: 0, failedQty: 4 })
    expect(line).toEqual({ required: 40, done: 40, failed: 4, open: 0, awaiting: 0 })
    expect(remainingQty(line)).toBe(4)
    expect(bucketLine(line)).toMatchObject({ reported: 36, passed: 36, failed: 4 })
  })

  it('cộng nhiều dòng; % làm tròn xuống, có làm thì ≥ 1, chưa đủ không hiện 100', () => {
    const t = sumBuckets([bucketLine({ required: 10, done: 10, failed: 0, open: 10, awaiting: 0 }), bucketLine({ required: 5, done: 1, failed: 0, open: 0, awaiting: 1 })])
    expect(t).toEqual({ required: 15, reported: 11, passed: 0, awaiting: 1, open: 10, failed: 0 })
    expect(percentOf(840, 2820)).toBe(29)
    expect(percentOf(2819, 2820)).toBe(99)
    expect(percentOf(1, 2820)).toBe(1)
    expect(percentOf(0, 0)).toBe(0)
  })
})

describe('steelShortHint (AC51)', () => {
  const base = { remainingSegments: 10, recutSegments: 10, leftoverReceivedMm: 2000, issuableMm: 0, shortMm: 2800 }
  it('thiếu sắt: ghi số đoạn còn phải cắt (gồm cắt lại), sắt còn ước và thiếu khoảng', () => {
    expect(steelShortHint(base)).toBe('Còn phải cắt 10 đoạn (gồm 10 đoạn cắt lại) - sắt còn ước 2,0 m, thiếu khoảng 2,8 m')
  })
  it('không có đoạn cắt lại thì bỏ cụm "gồm"', () => {
    expect(steelShortHint({ ...base, recutSegments: 0 })).toBe('Còn phải cắt 10 đoạn - sắt còn ước 2,0 m, thiếu khoảng 2,8 m')
  })
  it('số lớn có dấu ngăn nghìn kiểu Việt (QA nghiệm thu 19/11)', () => {
    expect(steelShortHint({ ...base, remainingSegments: 2899, recutSegments: 1200, shortMm: 1242500 })).toBe(
      'Còn phải cắt 2.899 đoạn (gồm 1.200 đoạn cắt lại) - sắt còn ước 2,0 m, thiếu khoảng 1.242,5 m',
    )
  })
  it('không biết chiều dài cây (issuableMm null) thì ghi thêm chưa tính sắt kho còn xuất', () => {
    expect(steelShortHint({ ...base, issuableMm: null })).toMatch(/\(chưa tính sắt kho còn xuất\)$/)
  })
  it('đủ sắt (thiếu 0) hoặc không còn đoạn nào phải cắt -> không có dòng', () => {
    expect(steelShortHint({ ...base, shortMm: 0 })).toBeNull()
    expect(steelShortHint({ ...base, remainingSegments: 0 })).toBeNull()
  })
  it('BE cũ chưa trả trường / chưa nhận sắt -> không có dòng', () => {
    expect(steelShortHint({ remainingSegments: 3 })).toBeNull()
    expect(steelShortHint(null)).toBeNull()
    expect(steelShortHint(undefined)).toBeNull()
  })
})
