import { describe, expect, it } from 'vitest'
import type { DeadlineEntryCheck, DeadlineSaveResult } from '../../../services/deadline-changes-api'
import {
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
