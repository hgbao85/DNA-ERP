import { describe, expect, it } from 'vitest'
import type { DeadlineEntryCheck, DeadlineSaveResult } from '../../../services/deadline-changes-api'
import {
  applyFormAutoShift,
  autoShiftLabel,
  projectedOrderErrors,
  type DeadlineFormField,
  fmtChange,
  fmtDateTime,
  fmtDayFull,
  fmtDayShort,
  isRunningPi,
  itemDeadlineState,
  planFileName,
  summarizeSave,
} from './deadlineChange'

const entry = (over: Partial<DeadlineEntryCheck> = {}): DeadlineEntryCheck => ({
  itemId: 'i1', lenhCode: 'MY-313', skuCode: 'SKU1', kind: 'APPLY', changes: [], errors: [], warnings: [], ...over,
})

describe('ngày', () => {
  it('đổi YYYY-MM-DD sang dd/mm', () => {
    expect(fmtDayShort('2026-11-05')).toBe('05/11')
    expect(fmtDayFull('2026-11-05')).toBe('05/11/2026')
    expect(fmtDayShort('2026-11-05T00:00:00.000Z')).toBe('05/11')
  })
  it('rỗng thì ghi chưa có', () => {
    expect(fmtDayShort(null)).toBe('(chưa có)')
    expect(fmtDayFull(undefined)).toBe('(chưa có)')
  })
  it('chuỗi mốc cũ → mới', () => {
    expect(fmtChange({ label: 'Khung', from: '2026-11-10', to: '2026-11-12' })).toBe('Khung: 10/11 → 12/11')
    expect(fmtChange({ label: 'Hàn', from: null, to: '2026-11-12' })).toBe('Hàn: (chưa có) → 12/11')
  })
  it('lúc nào dd/mm/yyyy HH:mm theo giờ máy', () => {
    expect(fmtDateTime(new Date(2026, 10, 5, 9, 7).toISOString())).toBe('05/11/2026 09:07')
    expect(fmtDateTime(null)).toBe('—')
    expect(fmtDateTime('không phải ngày')).toBe('—')
  })
  it('tên file tải về', () => {
    expect(planFileName(new Date(2026, 10, 5, 9, 7))).toBe('ke-hoach-san-xuat-20261105-0907.xlsx')
  })
})

describe('trạng thái dòng SKU', () => {
  it('Kết thúc thắng mọi trạng thái khác', () => {
    expect(itemDeadlineState({ floorStage: 'FINISHED', prodApproval: { status: 'APPROVED' } })).toBe('ENDED')
  })
  it('đang chờ Sếp duyệt lại', () => {
    const pending = { requestId: 'r', batchId: 'b', requestedAt: '2026-11-05T00:00:00Z', changes: [] }
    expect(itemDeadlineState({ prodApproval: { status: 'APPROVED' }, pendingDeadlineChange: pending })).toBe('PENDING')
  })
  it('đã bắt đầu sản xuất (Q9-3): floorStage khác PENDING', () => {
    const ap = { prodApproval: { status: 'APPROVED' } }
    expect(itemDeadlineState({ ...ap, floorStage: 'PHOI' })).toBe('STARTED')
    expect(itemDeadlineState({ ...ap, floorStage: 'PENDING' })).toBe('APPROVED')
    expect(itemDeadlineState({ ...ap, floorStage: 'FINISHED' })).toBe('ENDED')
    const pending = { requestId: 'r', batchId: 'b', requestedAt: '2026-11-05T00:00:00Z', changes: [] }
    expect(itemDeadlineState({ ...ap, floorStage: 'PHOI', pendingDeadlineChange: pending })).toBe('PENDING')
    expect(isRunningPi({ status: 'PRODUCING', items: [{ ...ap, floorStage: 'HAN' }] })).toBe(true)
  })
  it('đã duyệt / chưa duyệt; BE cũ thiếu field vẫn chạy', () => {
    expect(itemDeadlineState({ prodApproval: { status: 'APPROVED' } })).toBe('APPROVED')
    expect(itemDeadlineState({ prodApproval: { status: 'WAITING_BOSS' } })).toBe('FREE')
    expect(itemDeadlineState({})).toBe('FREE')
    expect(itemDeadlineState(null)).toBe('FREE')
  })
  it('PI đang chạy: có dòng đã duyệt chưa Kết thúc', () => {
    const ap = { prodApproval: { status: 'APPROVED' } }
    expect(isRunningPi({ status: 'PRODUCING', items: [ap] })).toBe(true)
    expect(isRunningPi({ status: 'PRODUCING', items: [{ ...ap, floorStage: 'FINISHED' }] })).toBe(false)
    expect(isRunningPi({ status: 'PLANNING', items: [{ prodApproval: { status: 'WAITING_BOSS' } }] })).toBe(false)
    expect(isRunningPi({ status: 'CANCELLED', items: [ap] })).toBe(false)
    expect(isRunningPi({ status: 'PRODUCING', items: [{ floorStage: 'FINISHED' }, ap] })).toBe(true)
    expect(isRunningPi({ status: 'PRODUCING' })).toBe(false)
  })
})

describe('summarizeSave', () => {
  it('BE cũ chưa trả deadlineSave', () => {
    expect(summarizeSave(null)).toEqual({ message: 'Đã lưu thời hạn.', warnings: [], tone: 'green' })
  })
  it('chỉ ghi thẳng', () => {
    const r: DeadlineSaveResult = { applied: [entry(), entry({ itemId: 'i2' })], batch: null, skipped: [] }
    const s = summarizeSave(r)
    expect(s.message).toBe('Đã lưu 2 SKU.')
    expect(s.tone).toBe('green')
  })
  it('vừa ghi vừa gửi Sếp', () => {
    const r = {
      applied: [entry()],
      batch: { requests: [{ skuCode: 'SKU2', warnings: [] }, { skuCode: 'SKU3', warnings: [] }] },
      skipped: [],
    } as unknown as DeadlineSaveResult
    const s = summarizeSave(r)
    expect(s.message).toBe('Đã lưu 1 SKU. 2 SKU đã gửi Sếp duyệt lại (mốc cũ vẫn chạy tới khi Sếp duyệt).')
    expect(s.tone).toBe('yellow')
  })
  it('chỉ gửi Sếp, không câu "Đã lưu 0"', () => {
    const r = { applied: [], batch: { requests: [{ skuCode: 'SKU2', warnings: [] }] }, skipped: [] } as unknown as DeadlineSaveResult
    expect(summarizeSave(r).message).toBe('1 SKU đã gửi Sếp duyệt lại (mốc cũ vẫn chạy tới khi Sếp duyệt).')
  })
  it('Excel có dòng bỏ vì lỗi', () => {
    const r: DeadlineSaveResult = { applied: [entry()], batch: null, skipped: [entry({ kind: 'ERROR', errors: ['x'] })] }
    expect(summarizeSave(r).message).toBe('Đã lưu 1 SKU. 1 SKU bị bỏ vì lỗi.')
  })
  it('không có gì đổi', () => {
    expect(summarizeSave({ applied: [], batch: null, skipped: [] }).message).toBe('Không có mốc nào thay đổi.')
  })
  it('gom cảnh báo, kèm mã SKU, bỏ trùng', () => {
    const w = 'Khung sau Nhập đan'
    const r = {
      applied: [entry({ warnings: [w] }), entry({ skuCode: 'SKU9', warnings: [w] })],
      batch: { requests: [{ skuCode: 'SKU1', warnings: [w] }] },
      skipped: [],
    } as unknown as DeadlineSaveResult
    expect(summarizeSave(r).warnings).toEqual([`SKU1: ${w}`, `SKU9: ${w}`])
  })
})

const NONE: Record<DeadlineFormField, string | null> = {
  materialDeadline: null, finishedMaterialDeadline: null, PHOI_START: null, PHOI: null, HAN: null, SON: null, FRAME: null,
  WEAVING: null, TRANSFER_CHECK: null, PACKAGING_START: null, PACKAGING: null,
}
const toVals = (s: Record<DeadlineFormField, string | null>) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? ''])) as Record<DeadlineFormField, string>
const SAVED = {
  ...NONE, materialDeadline: '2026-11-01', PHOI_START: '2026-11-05', PHOI: '2026-11-08', HAN: '2026-11-10', SON: '2026-11-12', FRAME: '2026-11-14',
  WEAVING: '2026-11-15', finishedMaterialDeadline: '2026-11-16', PACKAGING_START: '2026-11-18', PACKAGING: '2026-11-20',
}

describe('applyFormAutoShift (Q9-1)', () => {
  it('dời Phôi +3 thì Hàn, Sơn, Khung... dời theo, Mua VT không dời', () => {
    const vals = { ...toVals(SAVED), PHOI: '2026-11-11' }
    const r = applyFormAutoShift({ saved: SAVED, vals, touched: new Set(['PHOI']), prevAuto: new Set() })
    expect(r.vals.HAN).toBe('2026-11-13')
    expect(r.vals.SON).toBe('2026-11-15')
    expect(r.vals.PACKAGING).toBe('2026-11-23')
    expect(r.vals.materialDeadline).toBe('2026-11-01')
    expect(r.vals.finishedMaterialDeadline).toBe('2026-11-16')
    expect(r.vals.PHOI_START).toBe('2026-11-05')
    expect(r.auto.HAN).toBe(3)
    expect(r.auto.PHOI).toBeUndefined()
    expect(r.auto.finishedMaterialDeadline).toBeUndefined()
  })
  it('KHSX sửa tay lại Sơn thì Sơn không còn tự dời; Khung dời theo Sơn', () => {
    const vals = { ...toVals(SAVED), PHOI: '2026-11-11', HAN: '2026-11-13', SON: '2026-11-13' }
    const r = applyFormAutoShift({ saved: SAVED, vals, touched: new Set(['PHOI', 'SON']), prevAuto: new Set(['HAN', 'SON', 'FRAME']) })
    expect(r.vals.SON).toBe('2026-11-13')
    expect(r.auto.SON).toBeUndefined()
    expect(r.auto.FRAME).toBe(1)
    expect(r.vals.FRAME).toBe('2026-11-15')
  })
  it('gõ lại đúng ngày cũ → ô tự dời trước đó về ngày đã lưu', () => {
    const vals = { ...toVals(SAVED), PHOI: '2026-11-08', HAN: '2026-11-13' }
    const r = applyFormAutoShift({ saved: SAVED, vals, touched: new Set(['PHOI']), prevAuto: new Set(['HAN']) })
    expect(r.vals.HAN).toBe('2026-11-10')
    expect(r.auto).toEqual({})
  })
  it('ô chạm mà để trống coi như dời 0', () => {
    const vals = { ...toVals(SAVED), PHOI: '' }
    const r = applyFormAutoShift({ saved: SAVED, vals, touched: new Set(['PHOI']), prevAuto: new Set() })
    expect(r.auto).toEqual({})
  })
  it('ô chưa lưu (chỉ là đề xuất) không bao giờ tự dời', () => {
    const saved = { ...SAVED, HAN: null }
    const vals = { ...toVals(saved), HAN: '2026-11-10', PHOI: '2026-11-11' }
    const r = applyFormAutoShift({ saved, vals, touched: new Set(['PHOI']), prevAuto: new Set() })
    expect(r.vals.HAN).toBe('2026-11-10')
    expect(r.auto.HAN).toBeUndefined()
    expect(r.auto.SON).toBe(3)
  })
  it('nhãn tự dời', () => {
    expect(autoShiftLabel(3)).toBe('tự dời +3')
    expect(autoShiftLabel(-2)).toBe('tự dời −2')
  })
})

describe('projectedOrderErrors (Q9-2)', () => {
  const saved = { 'stage.PHOI_START': '2026-11-05', 'stage.FRAME_PHOI': '2026-11-08', 'stage.FRAME': '2026-11-14' } as const
  it('không đổi gì so với đã lưu thì không kiểm', () => {
    expect(projectedOrderErrors(saved, { 'stage.FRAME': '2026-11-14' }, '2026-11-30')).toEqual([])
  })
  it('đổi làm mốc ngược → có câu lỗi', () => {
    const e = projectedOrderErrors(saved, { 'stage.FRAME_PHOI': '2026-11-16' }, '2026-11-30')
    expect(e.length).toBe(1)
    expect(e[0]).toContain('Khung')
  })
  it('hạn giao sớm hơn mốc cuối → lỗi', () => {
    expect(projectedOrderErrors(saved, { 'stage.FRAME': '2026-11-20' }, '2026-11-10').length).toBeGreaterThan(0)
  })
  it('đúng thứ tự → không lỗi', () => {
    expect(projectedOrderErrors(saved, { 'stage.FRAME_PHOI': '2026-11-09' }, '2026-11-30')).toEqual([])
  })
})
