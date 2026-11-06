import { describe, expect, it } from 'vitest'
import type { DeadlineChangeBatchDto, DeadlineChangeRequestDto } from '../../../services/deadline-changes-api'
import { approvablePending, BLOCKED_REJECT_REASON, canApproveAny, changeText, confirmApproveText, defaultSelection, isBlocked, reasonDescription, fmtDateTimeVN, fmtDay, planApprove, planRejectAll, reasonValid, resultMessage, sortOldestFirst, skuCount } from './duyetDoiMoc'

const req = (id: string, itemId = id, status: DeadlineChangeRequestDto['status'] = 'PENDING'): DeadlineChangeRequestDto => ({
  id, itemId, piId: 'p', lenhCode: 'L1', skuCode: 'S', skuName: null, quantity: 1, status,
  oldValues: {}, newValues: {}, changes: [], warnings: [], rejectReason: null,
})
const blk = (id: string, reason: string | null = 'Lệnh đã bắt đầu sản xuất (cắt phôi) – không đổi mốc được nữa, chỉ từ chối được'): DeadlineChangeRequestDto => ({ ...req(id), blockedReason: reason })
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

  // Phần A – Đợt 9 phần 2 (Q9-3)
  it('isBlocked: chỉ yêu cầu chờ có blockedReason; BE cũ (undefined) hoặc rỗng = không chặn', () => {
    expect(isBlocked(blk('1'))).toBe(true)
    expect(isBlocked(req('1'))).toBe(false)
    expect(isBlocked(blk('1', null))).toBe(false)
    expect(isBlocked(blk('1', '  '))).toBe(false)
    expect(isBlocked({ ...blk('1'), status: 'APPROVED' })).toBe(false)
  })
  it('lựa chọn mặc định bỏ yêu cầu bị chặn', () => {
    const b = batch([req('1'), blk('2'), req('3')])
    expect([...defaultSelection(b)]).toEqual(['1', '3'])
    expect(approvablePending(b).map(r => r.id)).toEqual(['1', '3'])
    expect(canApproveAny(b)).toBe(true)
  })
  it('planApprove loại yêu cầu bị chặn dù lỡ nằm trong selected, kể cả khi không cho duyệt từng phần', () => {
    const b = batch([req('1'), blk('2'), req('3')])
    const p = planApprove(b, new Set(['1', '2', '3']), true)
    expect(p).toMatchObject({ approveRequestIds: ['1', '3'], rejectCount: 1, rejectBlockedCount: 1, needsReason: true, suggestedReason: BLOCKED_REJECT_REASON })
    expect(planApprove(b, new Set(), false).approveRequestIds).toEqual(['1', '3'])
  })
  it('mọi yêu cầu chờ đều bị chặn: không duyệt được, chỉ từ chối, gợi ý lý do', () => {
    const b = batch([blk('1'), blk('2')])
    expect(canApproveAny(b)).toBe(false)
    const p = planApprove(b, new Set(['1', '2']), true)
    expect(p).toMatchObject({ approveCount: 0, rejectCount: 2, rejectBlockedCount: 2, suggestedReason: BLOCKED_REJECT_REASON })
    expect(planRejectAll(b).suggestedReason).toBe(BLOCKED_REJECT_REASON)
  })
  it('không gợi ý lý do khi có yêu cầu bị từ chối vì bỏ chọn', () => {
    const b = batch([req('1'), req('2'), blk('3')])
    expect(planApprove(b, new Set(['1']), true).suggestedReason).toBe('')
    expect(planRejectAll(batch([req('1'), blk('2')])).suggestedReason).toBe('')
  })
  it('câu xác nhận / kết quả / mô tả có nhắc yêu cầu bị chặn', () => {
    const b = batch([req('1'), req('2'), req('3'), blk('4'), blk('5')])
    const p = planApprove(b, new Set(['1', '2', '3']), true)
    expect(confirmApproveText(p)).toBe('Duyệt 3 yêu cầu, từ chối 2 yêu cầu (2 yêu cầu của lệnh đã bắt đầu sản xuất, không duyệt được)?')
    expect(resultMessage(p)).toContain('từ chối 2 yêu cầu (2 yêu cầu của lệnh')
    expect(reasonDescription(p)).toContain('yêu cầu không duyệt được')
    expect(resultMessage(planRejectAll(batch([blk('1')])))).toContain('Đã từ chối 1 yêu cầu (1 yêu cầu của lệnh')
  })
})
