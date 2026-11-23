import { describe, expect, it } from 'vitest'
import type { BeWorkstation } from '../../../services/floor-api'
import {
  blockedTextOf, countedOf, countNonCutUnassigned, isCutUnassigned, isWorkshopUnassigned, kindWithMachine, qlsxTabForUrl, teamViewForUrl,
  summarizeCutMachines, workshopsMissingSteelReceive,
} from './qlsxUi'

const ws = (o: Partial<BeWorkstation>): BeWorkstation => ({
  id: '1', code: 'C', name: 'x', stage: 'PHOI', kind: 'CUT', processStep: null, qrToken: 't', isActive: true,
  createdAt: '2026-11-13', cutMachineType: 'laser', workshopId: null, workshopName: null, ...o,
})

describe('summarizeCutMachines', () => {
  it('đếm máy cắt đang hoạt động theo xưởng + loại, máy chưa gán gom cuối', () => {
    const list = [
      ...Array.from({ length: 4 }, () => ws({ workshopName: 'Phú An' })),
      ws({ workshopName: 'Phú An', cutMachineType: 'tu_dong' }),
      ws({ workshopName: 'Phước An', cutMachineType: 'tu_dong' }),
      ws({}),
      ws({ workshopName: 'Phú An', isActive: false }),
      ws({ kind: 'STEP', processStep: 'UON', cutMachineType: null, workshopName: 'Phú An' }),
    ]
    expect(summarizeCutMachines(list, ['Phú An', 'Phước An'])).toBe(
      'Phú An: 4 MC Laser, 1 MC Tự động · Phước An: 1 MC Tự động · Chưa gán xưởng: 1',
    )
  })
  it('không có máy cắt -> rỗng', () => {
    expect(summarizeCutMachines([])).toBe('')
  })
})

describe('isCutUnassigned', () => {
  it('chỉ máy cắt chưa có xưởng mới là chưa gán', () => {
    expect(isCutUnassigned(ws({}))).toBe(true)
    expect(isCutUnassigned(ws({ workshopId: 'w1' }))).toBe(false)
    expect(isCutUnassigned(ws({ kind: 'STEP', processStep: 'UON', cutMachineType: null }))).toBe(false)
  })
})

describe('isWorkshopUnassigned', () => {
  it('mọi loại máy đang hoạt động mà chưa có xưởng', () => {
    expect(isWorkshopUnassigned(ws({}))).toBe(true)
    expect(isWorkshopUnassigned(ws({ kind: 'PIECE', cutMachineType: null }))).toBe(true)
    expect(isWorkshopUnassigned(ws({ kind: 'PIECE', cutMachineType: null, workshopId: 'w1' }))).toBe(false)
    expect(isWorkshopUnassigned(ws({ kind: 'STEEL_RECEIVE', cutMachineType: null, isActive: false }))).toBe(false)
  })
})

describe('countNonCutUnassigned', () => {
  it('chỉ đếm máy không phải máy cắt, đang hoạt động, chưa gán xưởng', () => {
    const list = [
      ws({}),
      ws({ kind: 'STEP', processStep: 'UON', cutMachineType: null }),
      ws({ kind: 'PIECE', cutMachineType: null }),
      ws({ kind: 'PIECE', cutMachineType: null, workshopId: 'w1' }),
      ws({ kind: 'STEEL_RECEIVE', cutMachineType: null, isActive: false }),
    ]
    expect(countNonCutUnassigned(list)).toBe(2)
    expect(countNonCutUnassigned([])).toBe(0)
  })
})

describe('kindWithMachine', () => {
  it('máy cắt ghi loại máy, loại khác giữ nhãn gốc', () => {
    expect(kindWithMachine(ws({ cutMachineType: 'tu_dong' }))).toBe('Máy cắt · MC Tự động')
    expect(kindWithMachine(ws({ kind: 'PIECE', cutMachineType: null }))).toBe('Điểm làm việc (Hàn/Sơn)')
  })
})

describe('workshopsMissingSteelReceive', () => {
  const shops = [{ id: 'w1', name: 'Xưởng 1' }, { id: 'w2', name: 'Xưởng 2' }, { id: 'w3', name: 'Xưởng 3' }]
  it('xưởng đang dùng mà thiếu khu nhận sắt đang dùng thì bị liệt kê', () => {
    const list = [
      ws({ kind: 'CUT', workshopId: 'w1' }),
      ws({ kind: 'STEEL_RECEIVE', cutMachineType: null, workshopId: 'w1' }),
      ws({ kind: 'PIECE', cutMachineType: null, workshopId: 'w2' }),
    ]
    expect(workshopsMissingSteelReceive(list, shops)).toEqual(['Xưởng 2'])
  })
  it('khu nhận sắt đã tắt hoặc chưa gán xưởng không tính; xưởng không có máy nào thì bỏ qua', () => {
    const list = [
      ws({ kind: 'CUT', workshopId: 'w1' }),
      ws({ kind: 'STEEL_RECEIVE', cutMachineType: null, workshopId: 'w1', isActive: false }),
      ws({ kind: 'STEEL_RECEIVE', cutMachineType: null, workshopId: null }),
    ]
    expect(workshopsMissingSteelReceive(list, shops)).toEqual(['Xưởng 1'])
    expect(workshopsMissingSteelReceive([], shops)).toEqual([])
  })
})

describe('blockedTextOf / countedOf (S5: dòng xám không đếm)', () => {
  it('BE mới: theo blockedReason của BE; null = chấm được', () => {
    expect(blockedTextOf('LENH_DUNG')).toBe('Lệnh đang tạm dừng / đã kết thúc - chưa chấm được')
    expect(blockedTextOf('CHUA_GAN_SKU')).toBe('Dữ liệu cũ chưa gắn SKU - chưa chấm được, báo IT')
    expect(blockedTextOf(null)).toBeNull()
    // BE mới đã nói chấm được (null) thì KHÔNG suy lại từ order = null
    expect(blockedTextOf(null, true)).toBeNull()
  })
  it('BE cũ chưa có trường (undefined): chỉ khi order = null mới suy ra chưa gắn SKU', () => {
    expect(blockedTextOf(undefined, true)).toBe('Dữ liệu cũ chưa gắn SKU - chưa chấm được, báo IT')
    expect(blockedTextOf(undefined, false)).toBeNull()
    expect(blockedTextOf(undefined)).toBeNull()
  })
  it('chỉ đếm dòng không xám', () => {
    const rows = [{ blocked: null }, { blocked: 'x' }, { blocked: null }]
    expect(countedOf(rows)).toHaveLength(2)
  })
})

describe('QLSX mở link màn của tổ (trước đây ra màn trắng)', () => {
  it('?p=phoi-huong-dan-cat / han-khung-han / son-manh-cho-dan / phoi-kho-phoi -> xem-cac-to + tab con đúng', () => {
    expect(qlsxTabForUrl('phoi-huong-dan-cat', true)).toBe('xem-cac-to')
    expect(teamViewForUrl('phoi-huong-dan-cat')).toBe('huong-dan-cat')
    expect(teamViewForUrl('han-khung-han')).toBe('khung-han')
    expect(teamViewForUrl('son-manh-cho-dan')).toBe('manh-cho-dan')
    expect(teamViewForUrl('phoi-kho-phoi')).toBe('kho-phoi')
    expect(teamViewForUrl('ke-hoach')).toBeNull()
    expect(teamViewForUrl(null)).toBeNull()
  })
  it('vai khác QLSX giữ nguyên p (quyền như cũ)', () => {
    expect(qlsxTabForUrl('phoi-huong-dan-cat', false)).toBe('phoi-huong-dan-cat')
  })
})

describe('qlsxTabForUrl (MF1: tin KCS_BATCH_STALE)', () => {
  it('QLSX mở ?p=kcs-* thì chuyển sang san-luong-xuong', () => {
    expect(qlsxTabForUrl('kcs-han', true)).toBe('san-luong-xuong')
    expect(qlsxTabForUrl('kcs-phoi', true)).toBe('san-luong-xuong')
    expect(qlsxTabForUrl('kcs-son', true)).toBe('san-luong-xuong')
  })
  it('KCS giữ nguyên; tab khác và không có p của QLSX giữ nguyên', () => {
    expect(qlsxTabForUrl('kcs-han', false)).toBe('kcs-han')
    expect(qlsxTabForUrl('ke-hoach', true)).toBe('ke-hoach')
    expect(qlsxTabForUrl(null, true)).toBeNull()
  })
})
