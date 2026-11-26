import { describe, expect, it } from 'vitest'
import type { WeavingBoardRow } from '../../../services/weaving-coordination-api'
import {
  countByStatus,
  dueHint,
  filterRows,
  fmtDay,
  followUpPayload,
  lenhLabel,
  promiseLine,
  validateFollowUpForm,
} from './dieuPhoiDanModel'

const TODAY = '2026-11-25'
const row = (over: Partial<WeavingBoardRow> = {}): WeavingBoardRow => ({
  key: '1:10:100',
  weavingPointId: '1',
  weavingPointCode: 'DD-01',
  weavingPointName: 'Điểm đan Chị Lan',
  productionOrderId: '10',
  poNumber: 'PO-SYS-10',
  salesOrderCode: 'SO-77',
  lsxCode: 'GP-200',
  piCode: 'PI-01',
  productName: 'Ghế đan',
  pieceId: '100',
  pieceCode: 'M1',
  pieceName: 'Mặt ngồi',
  sent: 15,
  returned: 4,
  held: 11,
  dueDate: '2026-11-24',
  daysLeft: -1,
  status: 'LATE',
  lastIssuedAt: null,
  lastReceivedAt: null,
  latestPromise: null,
  followUpCount: 0,
  ...over,
})

describe('dieuPhoiDanModel', () => {
  it('fmtDay / lenhLabel / dueHint', () => {
    expect(fmtDay('2026-11-28')).toBe('28/11/2026')
    expect(fmtDay(null)).toBe('—')
    expect(lenhLabel(row())).toBe('GP-200')
    expect(lenhLabel(row({ lsxCode: null }))).toBe('PI-01')
    expect(lenhLabel(row({ lsxCode: null, piCode: null }))).toBe('PO-SYS-10')
    expect(dueHint(row())).toBe('Trễ 1 ngày')
    expect(dueHint(row({ status: 'DUE_SOON', daysLeft: 0 }))).toBe('Hạn hôm nay')
    expect(dueHint(row({ status: 'ON_TRACK', daysLeft: 5 }))).toBe('Còn 5 ngày')
    expect(dueHint(row({ status: 'DONE', daysLeft: -3 }))).toBeNull()
  })

  it('promiseLine: lời hẹn mới nhất hiện dưới trạng thái', () => {
    const p = { followUpId: '9', promisedQty: 5, promisedDate: '2026-11-28', status: 'OPEN' as const, returnedSince: 2, createdAt: '' }
    expect(promiseLine(null, TODAY)).toBeNull()
    expect(promiseLine(p, TODAY)).toEqual({ text: 'Hẹn 5 mảnh · 28/11/2026 · đã về 2/5', tone: 'muted' })
    expect(promiseLine({ ...p, promisedDate: TODAY }, TODAY)?.text).toContain('hôm nay')
    expect(promiseLine({ ...p, status: 'REMINDED', promisedDate: '2026-11-24' }, TODAY)).toMatchObject({ tone: 'warn' })
    expect(promiseLine({ ...p, status: 'KEPT', returnedSince: 5 }, TODAY)).toMatchObject({ tone: 'ok' })
  })

  it('filterRows + countByStatus', () => {
    const rows = [
      row(),
      row({ key: 'b', weavingPointId: '2', status: 'ON_TRACK', daysLeft: 6, pieceName: 'Tựa lưng' }),
      row({ key: 'c', status: 'DONE', held: 0 }),
    ]
    expect(filterRows(rows, { status: 'OPEN' }).map((r) => r.key)).toEqual(['1:10:100', 'b'])
    expect(filterRows(rows, { status: 'OPEN', pointId: '2' }).map((r) => r.key)).toEqual(['b'])
    expect(filterRows(rows, { status: 'LATE' }).map((r) => r.key)).toEqual(['1:10:100'])
    expect(filterRows(rows, { status: 'OPEN', search: 'tựa' }).map((r) => r.key)).toEqual(['b'])
    expect(filterRows(rows, { status: 'DONE' }).map((r) => r.key)).toEqual(['c'])
    expect(countByStatus(rows)).toMatchObject({ OPEN: 2, LATE: 1, ON_TRACK: 1, DUE_SOON: 0 })
    expect(countByStatus(rows, '2')).toMatchObject({ OPEN: 1, LATE: 0 })
  })

  it('validateFollowUpForm: cùng luật BE', () => {
    const f = { content: 'Gọi chị Lan', promisedQty: '', promisedDate: '' }
    expect(validateFollowUpForm({ ...f, content: '  ' }, 11, TODAY)).toMatch(/nội dung/)
    expect(validateFollowUpForm(f, 11, TODAY)).toBeNull()
    expect(validateFollowUpForm({ ...f, promisedQty: '3' }, 11, TODAY)).toMatch(/cả số mảnh và ngày/)
    expect(validateFollowUpForm({ ...f, promisedQty: '0', promisedDate: TODAY }, 11, TODAY)).toMatch(/lớn hơn 0/)
    expect(validateFollowUpForm({ ...f, promisedQty: '2.5', promisedDate: TODAY }, 11, TODAY)).toMatch(/nguyên/)
    expect(validateFollowUpForm({ ...f, promisedQty: '12', promisedDate: TODAY }, 11, TODAY)).toMatch(/vượt/)
    expect(validateFollowUpForm({ ...f, promisedQty: '1', promisedDate: TODAY }, 0, TODAY)).toMatch(/đã trả đủ/)
    expect(validateFollowUpForm({ ...f, promisedQty: '5', promisedDate: '2026-11-24' }, 11, TODAY)).toMatch(/trước hôm nay/)
    expect(validateFollowUpForm({ ...f, promisedQty: '11', promisedDate: TODAY }, 11, TODAY)).toBeNull()
  })

  it('followUpPayload: chỉ gửi hẹn khi đủ cả số và ngày, cắt khoảng trắng', () => {
    expect(followUpPayload(row(), { content: ' gọi ', promisedQty: '', promisedDate: '' })).toEqual({
      weavingPointId: '1', productionOrderId: '10', pieceId: '100', content: 'gọi',
    })
    expect(followUpPayload(row(), { content: 'hẹn', promisedQty: ' 5 ', promisedDate: '2026-11-28' })).toMatchObject({
      promisedQty: 5, promisedDate: '2026-11-28',
    })
  })
})

describe('tài khoản Điều phối đan -> phân hệ weaving_coordination', () => {
  it('normalizeUser suy cờ từ vai BE, resolveDefaultModule mở đúng phân hệ, thông báo nhắc hẹn mở được', async () => {
    const { normalizeUser } = await import('../../../utils/normalizeUser')
    const { resolveDefaultModule } = await import('../../../utils/resolveDefaultModule')
    const { resolveNotificationUrl } = await import('../../../utils/notificationLink')
    const u = normalizeUser({ id: 'x', firstName: 'Điều phối', lastName: 'đan', roles: ['WEAVING_COORDINATOR'] })
    expect(u.isWeavingCoordinator).toBe(true)
    expect(u.role).toBe('WAREHOUSE_STAFF')
    expect(resolveDefaultModule(u)).toBe('weaving_coordination')
    // Khôi phục từ localStorage (đã phẳng, không còn roles[]) vẫn giữ cờ.
    expect(resolveDefaultModule(normalizeUser({ ...u, id: 1 }))).toBe('weaving_coordination')
    // Thủ kho thường không bị đổi phân hệ.
    expect(resolveDefaultModule(normalizeUser({ id: 'y', roles: ['WAREHOUSE_STAFF'], warehouseScope: 'vat-tu-tp' }))).toBe('inbound_warehouse')
    const url = resolveNotificationUrl(
      { link: { module: 'weaving_coordination', page: 'theo-doi', params: { point: '7' } }, entityType: 'WEAVING_FOLLOW_UP', entityId: '9' } as never,
      u,
    )
    expect(url).toBe('/?m=weaving_coordination&p=theo-doi&point=7&focus=WEAVING_FOLLOW_UP%3A9')
  })
})
