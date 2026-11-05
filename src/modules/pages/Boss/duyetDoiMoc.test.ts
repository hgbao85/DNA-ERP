import { describe, expect, it } from 'vitest'
import type { DeadlineChangeBatchDto, DeadlineChangeRequestDto } from '../../../services/deadline-changes-api'
import { changeText, fmtDateTimeVN, fmtDay, planApprove, planRejectAll, reasonValid, resultMessage, sortOldestFirst, skuCount } from './duyetDoiMoc'

const req = (id: string, itemId = id, status: DeadlineChangeRequestDto['status'] = 'PENDING'): DeadlineChangeRequestDto => ({
  id, itemId, piId: 'p', lenhCode: 'L1', skuCode: 'S', skuName: null, quantity: 1, status,
  oldValues: {}, newValues: {}, changes: [], warnings: [], rejectReason: null,
})
const batch = (requests: DeadlineChangeRequestDto[], requestedAt = '2026-11-05T01:00:00Z'): DeadlineChangeBatchDto => ({
  id: 'b', source: 'MANUAL', status: 'PENDING', requestedBy: { id: 'u', name: 'A' }, requestedAt, decidedBy: null, decidedAt: null, decisionNote: null, note: null,
  counts: { total: requests.length, pending: requests.length, approved: 0, rejected: 0, cancelled: 0 }, requests,
})

describe('duyetDoiMoc', () => {
  it('định dạng ngày và mốc', () => {
    expect(fmtDay('2026-11-13')).toBe('13/11')
    expect(fmtDay(null)).toBe('chưa có')
    expect(changeText({ key: 'stage.FRAME_PHOI', label: 'Phôi', from: '2026-11-10', to: '2026-11-13' })).toBe('Phôi 10/11 → 13/11')
  })
  it('giờ Việt Nam', () => {
    expect(fmtDateTimeVN('2026-11-05T17:30:00Z')).toBe('06/11/2026 00:30')
    expect(fmtDateTimeVN(null)).toBe('')
  })
  it('cũ nhất trước, không đổi mảng gốc', () => {
    const a = batch([], '2026-11-05T03:00:00Z')
    const b = batch([], '2026-11-05T01:00:00Z')
    const src = [a, b]
    expect(sortOldestFirst(src)[0]).toBe(b)
    expect(src[0]).toBe(a)
  })
  it('duyệt hết khi chọn đủ: không cần lý do', () => {
    const b = batch([req('1'), req('2')])
    const p = planApprove(b, new Set(['1', '2']), true)
    expect(p).toMatchObject({ approveCount: 2, rejectCount: 0, needsReason: false })
  })
  it('bỏ chọn bớt: phần bỏ chọn bị từ chối, bắt buộc lý do', () => {
    const b = batch([req('1'), req('2'), req('3')])
    const p = planApprove(b, new Set(['1']), true)
    expect(p).toMatchObject({ approveRequestIds: ['1'], approveCount: 1, rejectCount: 2, needsReason: true })
    expect(resultMessage(p)).toBe('Đã duyệt 1 yêu cầu, từ chối 2 yêu cầu.')
  })
  it('không cho duyệt từng phần thì luôn duyệt hết; bỏ qua yêu cầu không còn chờ', () => {
    const b = batch([req('1'), req('2', '2', 'CANCELLED')])
    expect(planApprove(b, new Set(), false).approveRequestIds).toEqual(['1'])
  })
  it('từ chối cả lô', () => {
    const p = planRejectAll(batch([req('1'), req('2')]))
    expect(p).toMatchObject({ approveRequestIds: [], rejectCount: 2, needsReason: true })
  })
  it('lý do ≥ 3 ký tự sau khi cắt', () => {
    expect(reasonValid('  ab ')).toBe(false)
    expect(reasonValid(' abc ')).toBe(true)
  })
  it('đếm SKU theo dòng', () => {
    expect(skuCount(batch([req('1', 'i1'), req('2', 'i1'), req('3', 'i2')]))).toBe(2)
  })
})
