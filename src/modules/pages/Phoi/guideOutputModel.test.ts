import { describe, expect, it } from 'vitest'
import type { BePhoiProgressItem } from '../../../services/steel-issues-api'
import type { BeStageProgressRow } from '../../../services/floor-api'
import {
  chunkIds, cutOutputsOf, needShown, outputKey, phoiDoneLabel, piecesSummaryText, progressByCode, progressById, segmentOutputOf, stepLinesOf, stepLinesText, waitingText,
} from './guideOutputModel'

const seg = (cutLengthMm: number, o: Partial<{ required: number; done: number; failed: number; openQty: number; awaitingQcQty: number }>) => ({
  segmentSpecId: String(cutLengthMm), cutLengthMm, required: 0, done: 0, failed: 0, byOrder: [], ...o,
})

describe('segmentOutputOf (công thức spec 5.2 / Hình 4)', () => {
  it('cần 40, cắt 8, KCS đạt 6, lỗi 2 (không chờ KCS) -> KCS đạt 6, còn thiếu 34', () => {
    expect(segmentOutputOf({ required: 40, done: 8, failed: 2 })).toEqual({ required: 40, cut: 8, passed: 6, failed: 2, waiting: 0, open: 0, awaiting: 0, missing: 34 })
  })
  it('chốt 23/11: cắt thêm 5 chưa chấm -> Đã cắt 13, KCS đạt vẫn 6, còn thiếu 29 (phần chưa chấm tính tạm)', () => {
    const o = segmentOutputOf({ required: 40, done: 13, failed: 2, awaitingQcQty: 5 })
    expect(o).toMatchObject({ cut: 13, passed: 6, waiting: 5, awaiting: 5, open: 0, missing: 29 })
  })
  it('đợt đang mở (chưa gửi KCS) cũng tính là chờ, không vào KCS đạt', () => {
    expect(segmentOutputOf({ required: 20, done: 10, failed: 0, openQty: 4, awaitingQcQty: 2 })).toMatchObject({ passed: 4, waiting: 6, open: 4, awaiting: 2, missing: 10 })
  })
  it('KCS đạt không âm; còn thiếu không âm khi đã đủ / vượt', () => {
    expect(segmentOutputOf({ required: 10, done: 3, failed: 5, awaitingQcQty: 1 }).passed).toBe(0)
    expect(segmentOutputOf({ required: 10, done: 12, failed: 0 })).toMatchObject({ passed: 12, missing: 0 })
  })
  it('BE cũ chưa trả openQty / awaitingQcQty -> coi là 0', () => {
    expect(segmentOutputOf({ required: 5, done: 5, failed: 0 })).toMatchObject({ waiting: 0, passed: 5, missing: 0 })
  })
})

describe('cutOutputsOf / stepLinesOf', () => {
  const items = [{
    materialId: 'M1', materialCode: 'S1', materialName: 'Sắt 1', issuedBarCount: 1,
    segments: [seg(420, { required: 40, done: 8, failed: 2 }), seg(650, { required: 20, done: 4 })],
    steps: [
      { step: 'UON', segments: [seg(420, { required: 20, done: 6 })] },
      { step: 'DAP', segments: [seg(420, { required: 20, done: 0 }), seg(650, { required: 0, done: 0 })] },
    ],
  }] as unknown as BePhoiProgressItem[]

  it('khoá theo (loại sắt, cỡ đoạn)', () => {
    const m = cutOutputsOf(items)
    expect(m.get(outputKey('M1', 420))?.missing).toBe(34)
    expect(m.get(outputKey('M1', 650))?.passed).toBe(4)
    expect(m.get(outputKey('M2', 420))).toBeUndefined()
    expect(cutOutputsOf(null).size).toBe(0)
  })
  it('dòng nhỏ công đoạn phụ "Uốn 6/20 · Dập 0/20"; cỡ không có công đoạn phụ thì rỗng', () => {
    const m = stepLinesOf(items)
    expect(stepLinesText(m.get(outputKey('M1', 420)))).toBe('Uốn 6/20 · Dập 0/20')
    expect(stepLinesText(m.get(outputKey('M1', 650)))).toBe('')
  })
})

describe('needShown (SL cần = required của phoi-progress)', () => {
  it('có phoi-progress: lấy required, vượt phương án thì ghi cắt lại', () => {
    expect(needShown(20, { required: 23 })).toEqual({ value: 23, recut: 3 })
    expect(needShown(20, { required: 20 })).toEqual({ value: 20, recut: 0 })
    expect(needShown(NaN, { required: 20 })).toEqual({ value: 20, recut: 0 })
  })
  it('chưa có phoi-progress: giữ số phương án; NaN -> null', () => {
    expect(needShown(20, undefined)).toEqual({ value: 20, recut: 0 })
    expect(needShown(NaN, undefined)).toEqual({ value: null, recut: 0 })
  })
})

describe('piecesSummaryText / progressById', () => {
  it('tổng còn thiếu các mảnh; đủ hết thì "đủ"; không có mảnh thì null', () => {
    expect(piecesSummaryText([{ remaining: 3 }, { remaining: 0 }, { remaining: 1200 }])).toBe('Mảnh Phôi: còn thiếu 1.203 · xem ↓')
    expect(piecesSummaryText([{ remaining: 0 }])).toBe('Mảnh Phôi: đủ')
    expect(piecesSummaryText([])).toBeNull()
  })
  it('ghép tiến độ theo id lệnh', () => {
    const rows = [{ productionInvoiceId: '5', percent: 40 }] as BeStageProgressRow[]
    expect(progressById(rows).get('5')?.percent).toBe(40)
    expect(progressById(null).size).toBe(0)
  })
})

describe('chunkIds', () => {
  it('chia lô tối đa 200', () => {
    const ids = Array.from({ length: 450 }, (_, i) => String(i))
    expect(chunkIds(ids).map(c => c.length)).toEqual([200, 200, 50])
    expect(chunkIds([])).toEqual([])
  })
})

describe('nhãn', () => {
  it('chữ nhỏ dưới Đã cắt: đang mở / KCS đang chấm, chỉ phần > 0', () => {
    expect(waitingText(0, 5)).toBe('5 KCS đang chấm')
    expect(waitingText(2, 5)).toBe('2 đang mở · 5 KCS đang chấm')
    expect(waitingText(3, 0)).toBe('3 đang mở')
    expect(waitingText(0, 0)).toBe('')
  })
  it('"Xong Phôi dd/mm" theo giờ Việt Nam; thiếu / sai thì null', () => {
    expect(phoiDoneLabel('2026-11-22T20:00:00.000Z')).toBe('Xong Phôi 23/11')
    expect(phoiDoneLabel(null)).toBeNull()
    expect(phoiDoneLabel('không phải ngày')).toBeNull()
  })
  it('ghép tiến độ theo mã lệnh', () => {
    const rows = [{ code: 'GP-1', percent: 40 }, { code: 'GP-2', percent: 100 }] as BeStageProgressRow[]
    expect(progressByCode(rows).get('GP-2')?.percent).toBe(100)
    expect(progressByCode(rows).get('GP-9')).toBeUndefined()
    expect(progressByCode(undefined).size).toBe(0)
  })
})
