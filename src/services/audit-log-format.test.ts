import { describe, expect, it } from 'vitest'
import type { BeAuditLogEntry } from './audit-log-api'
import { auditChanges, auditNoVisibleChangeReason, auditRecordName, auditTableLabel, formatAuditValue } from './audit-log-format'

function entry(partial: Partial<BeAuditLogEntry>): BeAuditLogEntry {
  return {
    id: 'a1', userId: null, action: 'UPDATE', tableName: 'Material', recordId: '53',
    oldValue: null, newValue: null, createdAt: '2026-11-16T03:00:00.000Z', ...partial,
  }
}

describe('auditChanges', () => {
  it('chỉ liệt kê trường đơn đã đổi, bỏ trường hệ thống và quan hệ lồng, trạng thái lên đầu', () => {
    const changes = auditChanges(entry({
      oldValue: { id: '1', name: 'Thép', status: 'DRAFT', updatedAt: 'x', mfgProduct: { a: 1 }, unit: 'kg' },
      newValue: { id: '1', name: 'Thép ống', status: 'APPROVED', updatedAt: 'y', mfgProduct: { a: 2 }, unit: 'kg' },
    }))
    expect(changes.map(c => c.field)).toEqual(['status', 'name'])
    expect(changes[0]).toMatchObject({ label: 'Trạng thái', from: 'DRAFT', to: 'APPROVED' })
  })

  it('coi null và thiếu trường là như nhau, null -> giá trị hiện "trống"', () => {
    const changes = auditChanges(entry({
      oldValue: { note: null, buyerId: null },
      newValue: { buyerId: 'u-2' },
    }))
    expect(changes).toEqual([{ field: 'buyerId', label: 'Người mua', from: 'trống', to: 'u-2' }])
  })

  it('không tính thay đổi cho CREATE/DELETE', () => {
    expect(auditChanges(entry({ action: 'CREATE', newValue: { name: 'A' } }))).toEqual([])
  })
})

describe('auditNoVisibleChangeReason', () => {
  it('phân biệt ghi lại y nguyên với chỉ đổi dữ liệu lồng', () => {
    expect(auditNoVisibleChangeReason(entry({ oldValue: { a: 1, updatedAt: 'x' }, newValue: { a: 1, updatedAt: 'y' } })))
      .toMatch(/Không có giá trị nào đổi/)
    expect(auditNoVisibleChangeReason(entry({ oldValue: { draft: { a: 1 } }, newValue: { draft: { a: 2 } } })))
      .toMatch(/dữ liệu lồng/)
    expect(auditNoVisibleChangeReason(entry({ tableName: 'User' }))).toMatch(/mật khẩu/)
  })
})

describe('auditRecordName', () => {
  it('ưu tiên mã, rồi tên', () => {
    expect(auditRecordName(entry({ newValue: { code: 'VT-1', name: 'Thép' } }))).toBe('VT-1')
    expect(auditRecordName(entry({ newValue: { name: 'Thép' } }))).toBe('Thép')
  })

  it('người dùng hiện họ tên, bản ghi đã xoá lấy từ ảnh chụp cũ', () => {
    expect(auditRecordName(entry({ tableName: 'User', newValue: { firstName: 'Nhàn', lastName: 'Trần', username: 'nhan' } }))).toBe('Trần Nhàn')
    expect(auditRecordName(entry({ action: 'DELETE', oldValue: { name: 'Cũ' } }))).toBe('Cũ')
  })

  it('không có gì để gọi tên thì null', () => {
    expect(auditRecordName(entry({ newValue: { quantity: 3 } }))).toBeNull()
  })
})

describe('formatAuditValue / auditTableLabel', () => {
  it('định dạng giá trị', () => {
    expect(formatAuditValue(true)).toBe('Có')
    expect(formatAuditValue('')).toBe('trống')
    expect(formatAuditValue('x'.repeat(70))).toHaveLength(58)
  })

  it('bảng lạ giữ nguyên tên', () => {
    expect(auditTableLabel('Material')).toBe('Vật tư')
    expect(auditTableLabel('LaLa')).toBe('LaLa')
  })
})
