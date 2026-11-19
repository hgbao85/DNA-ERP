/**
 * UF1 (tester-unit #4, P1 "KCS tự chuyển"): màn quét - chặn báo vượt (AC25, AC26), nhãn KCS / "Chờ kiểm hàng" (AC41),
 * và Câu 6 (pat / chân nhôm làm vượt số cần: số hiện không bao giờ âm). Bổ sung cho scanModel.test.ts của Dev, không lặp ca.
 * FE KHÔNG tự tính lại maxNow: mọi "còn báo được" lấy nguyên số BE trả.
 */
import { describe, expect, it } from 'vitest'
import type { BeMyOutputRow, BeScanMaterial, BeScanPieceItem, BeScanSegment } from '../../../../services/floor-api'
import {
  anySegmentOverMax, kcsLabel, materialsForSku, pieceAction, pieceConfirmRow, pieceMaxNow, segmentAction, segmentConfirmRows,
  segmentLeft, segmentLeftText, segmentLines, segmentMaxNow, segmentOverMax, STATE_LABEL, workerPendingText,
} from './scanModel'

const seg = (p: Partial<BeScanSegment> & { required: number; done: number }): BeScanSegment =>
  ({ segmentSpecId: 's', cutLengthMm: 355, ...p }) as unknown as BeScanSegment

describe('AC25 - FE lấy nguyên maxNow của BE, không tự tính lại', () => {
  it('maxNow nhỏ hơn (cần - đã tính) vì giới hạn vật lý -> hiện đúng maxNow của BE', () => {
    // cần 10, đã tính 2 -> còn cần 8, nhưng BE nói chỉ còn 3 đoạn thực có ở công đoạn trước
    expect(segmentMaxNow({ required: 10, done: 2, maxNow: 3 })).toBe(3)
    expect(segmentLeftText({ required: 10, done: 2, maxNow: 3 })).toBe('còn báo được 3')
  })
  it('maxNow = 0 dù còn cần > 0 -> "còn báo được 0" (không tự suy ra 8)', () => {
    expect(segmentLeft({ required: 10, done: 2, maxNow: 0 })).toEqual({ kind: 'none', n: 0, over: 0 })
    expect(segmentLeftText({ required: 10, done: 2, maxNow: 0 })).toBe('còn báo được 0')
  })
  it('biên: báo đúng N = maxNow thì qua, maxNow + 1 thì chặn (cắt, cùng dữ liệu)', () => {
    const s = { required: 10, done: 5, maxNow: 5 }
    expect(segmentOverMax(s, 5)).toBe(false)
    expect(segmentOverMax(s, 6)).toBe(true)
  })
  it('biên: maxNow = 0 thì báo 1 là chặn', () => {
    expect(segmentOverMax({ required: 5, done: 5, maxNow: 0 }, 1)).toBe(true)
  })
  it('bảng xác nhận: đúng maxNow không có dòng đỏ, maxNow + 1 có dòng đỏ ghi đúng số của BE', () => {
    const s = seg({ required: 10, done: 5, maxNow: 4 })
    expect(segmentConfirmRows(segmentLines([s], { s: '4' }))[0].block).toBeUndefined()
    const over = segmentConfirmRows(segmentLines([s], { s: '5' }))[0]
    expect(over.block).toBe('Chỉ còn báo được 4 đoạn (cần 10, đã tính 5). Sửa lại số.')
    expect(over.value).toBe('5 đoạn')
  })
  it('nhiều cỡ: chỉ cần 1 cỡ vượt là khoá; cỡ có nhập 0 / rỗng không tính', () => {
    const a = seg({ segmentSpecId: 'a', required: 10, done: 5, maxNow: 4 })
    const b = seg({ segmentSpecId: 'b', required: 10, done: 5, maxNow: 0 })
    expect(anySegmentOverMax(segmentLines([a, b], { a: '4', b: '' }))).toBe(false)
    expect(anySegmentOverMax(segmentLines([a, b], { a: '4', b: '0' }))).toBe(false)
    expect(anySegmentOverMax(segmentLines([a, b], { a: '4', b: '1' }))).toBe(true)
  })
  it('materialsForSku: maxNow của từng SKU đi qua nguyên (không lấy maxNow cả PI, không cộng lại)', () => {
    const mats = [{
      materialId: 'm', hasReceivedSteel: true,
      segments: [{
        segmentSpecId: 's1', cutLengthMm: 355, required: 30, done: 5, maxNow: 25, physicalLeft: 25,
        byOrder: [
          { productionOrderId: 'o1', required: 10, done: 5, maxNow: 5, physicalLeft: 5 },
          { productionOrderId: 'o2', required: 20, done: 0, maxNow: 1, physicalLeft: 1 },
        ],
      }],
    }] as unknown as BeScanMaterial[]
    expect(materialsForSku(mats, 'o1')[0].segments[0].maxNow).toBe(5)
    expect(materialsForSku(mats, 'o2')[0].segments[0].maxNow).toBe(1)
    expect(segmentLeftText(materialsForSku(mats, 'o2')[0].segments[0])).toBe('còn báo được 1')
  })
})

describe('AC26 - đã đủ (vượt N), không số âm, báo thêm bị chặn', () => {
  it('vượt 10: "đã đủ (vượt 10)", còn báo được 0, báo 1 bị chặn', () => {
    const s = { required: 20, done: 30, maxNow: 0 }
    expect(segmentLeftText(s)).toBe('đã đủ (vượt 10)')
    expect(segmentMaxNow(s)).toBe(0)
    expect(segmentOverMax(s, 1)).toBe(true)
    expect(segmentLeft(s).over).toBe(10)
  })
  it('đúng bằng số cần: "đã đủ" không có "(vượt 0)"', () => {
    expect(segmentLeftText({ required: 20, done: 20, maxNow: 0 })).toBe('đã đủ')
    expect(segmentLeftText({ required: 20, done: 20, maxNow: 0 })).not.toMatch(/vượt/)
  })
  it('mọi tổ hợp cần / đã tính / maxNow đều không ra số âm trong chữ hiện', () => {
    for (const required of [0, 1, 5, 20]) {
      for (const done of [0, 1, 5, 20, 35]) {
        for (const maxNow of [undefined, 0, 3]) {
          const t = segmentLeftText({ required, done, maxNow })
          expect(t, `required=${required} done=${done} maxNow=${maxNow}`).not.toMatch(/-\d/)
        }
      }
    }
  })
  it('nút Lưu khi báo vượt: khoá kèm lý do, nút Hàn / Sơn cũng vậy', () => {
    expect(segmentAction({ busy: false, total: 1, blocked: false, over: true }).disabled).toBe(true)
    expect(pieceAction({ busy: false, pieceName: 'Chân', n: 1, over: true }).disabled).toBe(true)
  })
  it('chặn vượt mảnh Hàn / Sơn GIỮ: maxNow 0 thì báo 1 bị chặn kèm câu', () => {
    const p = { pieceId: 'p', pieceCode: 'P', pieceName: 'Mảnh', plannedQty: 10, awaitingQcQty: 0, passedQty: 10, openQty: 0, maxNow: 0 } as BeScanPieceItem
    expect(pieceMaxNow(p)).toBe(0)
    expect(pieceConfirmRow(p, 1).block).toBe('Chỉ còn báo được 0 mảnh (cần 10). Sửa lại số.')
  })
})

describe('Câu 6 - pat / chân nhôm làm vượt số cần: số hiện không âm', () => {
  it('số cần 0 mà đã làm 3 (pat làm sẵn): "đã đủ (vượt 3)", không số âm', () => {
    expect(segmentLeftText({ required: 0, done: 3, maxNow: 0 })).toBe('đã đủ (vượt 3)')
    expect(segmentLeftText({ required: 0, done: 0 })).toBe('đã đủ')
  })
  it('BE cũ chưa trả maxNow, mảnh đã đạt vượt kế hoạch: còn báo được = 0 chứ không âm', () => {
    const p = { pieceId: 'p', pieceCode: 'P', pieceName: 'Pat', plannedQty: 10, awaitingQcQty: 2, passedQty: 12, openQty: 3 } as BeScanPieceItem
    expect(pieceMaxNow(p)).toBe(0)
    expect(pieceConfirmRow(p, 1).block).not.toMatch(/-\d/)
  })
  it('kế hoạch mảnh bằng 0: không số âm trong câu chặn', () => {
    const p = { pieceId: 'p', pieceCode: 'P', pieceName: 'Pat', plannedQty: 0, awaitingQcQty: 0, passedQty: 0, openQty: 0 } as BeScanPieceItem
    expect(pieceMaxNow(p)).toBe(0)
    expect(pieceConfirmRow(p, 2).block).toBe('Chỉ còn báo được 0 mảnh (cần 0). Sửa lại số.')
  })
})

describe('AC41 - nhãn KCS và "Chờ kiểm hàng"', () => {
  const row = (state: BeMyOutputRow['state'], kcs: BeMyOutputRow['kcs']) => ({ state, kcs }) as BeMyOutputRow
  it('đợt đang mở: kcs null -> không nhãn KCS, trạng thái "Chờ kiểm hàng"', () => {
    const r = row('OPEN', null)
    expect(kcsLabel(r.kcs)).toBeNull()
    expect(STATE_LABEL[r.state][0]).toBe('Chờ kiểm hàng')
  })
  it('đợt đã chấm thiếu 5 lỗi 3 -> "KCS: thiếu 5 · lỗi 3" (thiếu trước, lỗi sau)', () => {
    const r = row('QC_DONE', { failedQty: 3, shortQty: 5 })
    expect(kcsLabel(r.kcs)).toBe('KCS: thiếu 5 · lỗi 3')
    expect(STATE_LABEL[r.state][0]).toBe('Đã kiểm xong')
  })
  it('chỉ có lỗi (thiếu 0) vẫn ghi cả 2 vế', () => {
    expect(kcsLabel({ failedQty: 4, shortQty: 0 })).toBe('KCS: thiếu 0 · lỗi 4')
  })
  it('số lớn có dấu phân cách vi-VN', () => {
    expect(kcsLabel({ failedQty: 1200, shortQty: 3400 })).toBe(`KCS: thiếu ${(3400).toLocaleString('vi-VN')} · lỗi ${(1200).toLocaleString('vi-VN')}`)
  })
  it('đợt đã bị hủy (REMOVED) không có nhãn trạng thái của công nhân gây nhầm', () => {
    expect(STATE_LABEL.REMOVED[0]).toBe('—')
  })
  it('chữ công nhân không còn "gửi KCS" / "KCS đang chấm" sau khi đổi', () => {
    const t = workerPendingText('Cắt: 3 đoạn đang mở · Hàn: 2 mảnh KCS đang chấm')
    expect(t).toBe('Cắt: 3 đoạn chờ kiểm hàng · Hàn: 2 mảnh đang kiểm hàng')
    expect(t).not.toMatch(/KCS|gửi/)
  })
  it('mọi nhãn trạng thái không nhắc "gửi"', () => {
    for (const v of Object.values(STATE_LABEL)) expect(v[0]).not.toMatch(/gửi/i)
  })
})
