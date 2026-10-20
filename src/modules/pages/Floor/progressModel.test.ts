import { describe, expect, it } from 'vitest'
import { bucketLine, isShort, percentOf, pieceLine, remainingQty, sumBuckets } from './progressModel'

// Cùng bộ ca với BE src/modules/floor/floor-progress.util.spec.ts - 2 bên phải ra cùng số.
describe('progressModel', () => {
  it('chia 1 dòng theo thứ tự đạt → chờ KCS → chưa gửi; lỗi chỉ trừ vào phần đã chấm', () => {
    expect(bucketLine({ required: 200, done: 100, failed: 5, open: 20, awaiting: 30 })).toEqual({
      required: 200, reported: 95, passed: 45, awaiting: 30, open: 20, failed: 5,
    })
  })

  it('báo vượt: chặn trần ở số cần, cắt phần chưa gửi trước', () => {
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

  it('mảnh: passedQty đã trừ lỗi, đã báo = đạt + chờ + chưa gửi', () => {
    expect(bucketLine(pieceLine({ plannedQty: 60, passedQty: 40, awaitingQcQty: 10, openQty: 20 }))).toMatchObject({ reported: 60, passed: 40, awaiting: 10, open: 10 })
    expect(pieceLine({ plannedQty: 5, passedQty: 1, awaitingQcQty: 2 })).toEqual({ required: 5, done: 3, failed: 0, open: 0, awaiting: 2 })
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
