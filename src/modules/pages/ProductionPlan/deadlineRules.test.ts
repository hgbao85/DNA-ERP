import { describe, expect, it } from 'vitest'
import type { DeadlineValues } from '../../../services/deadline-changes-api'
import { AUTO_SHIFT_KEYS, addDays, daysBetween, isFloorStarted, milestoneOrderErrors, resolveAutoShift } from './deadlineRules'

// Cùng ca với BE deadline-values.util.spec.ts + milestone-order.util.spec.ts - 2 bên phải ra y hệt.
const OLD: DeadlineValues = {
  materialDeadline: '2026-11-09',
  'stage.PHOI_START': '2026-11-10',
  'stage.FRAME_PHOI': '2026-11-11',
  'stage.FRAME_HAN': '2026-11-12',
  'stage.FRAME_SON': '2026-11-13',
  'stage.FRAME': '2026-11-13',
  'stage.WEAVING': '2026-11-16',
  'stage.TRANSFER_CHECK': '2026-11-20',
  finishedMaterialDeadline: '2026-11-15',
  'stage.PACKAGING_START': '2026-11-22',
  'stage.PACKAGING': '2026-11-24',
}

describe('resolveAutoShift (Q9-1)', () => {
  it('daysBetween / addDays', () => {
    expect(daysBetween('2026-11-10', '2026-11-13')).toBe(3)
    expect(daysBetween('2026-11-13', '2026-11-10')).toBe(-3)
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('dời Bắt đầu Phôi +3 → mọi mốc sản xuất sau +3, Mua VT giữ nguyên', () => {
    const r = resolveAutoShift(OLD, { 'stage.PHOI_START': '2026-11-13' })
    expect(r.values['stage.FRAME_HAN']).toBe('2026-11-15')
    expect(r.values['stage.PACKAGING']).toBe('2026-11-27')
    expect(r.values.materialDeadline).toBe('2026-11-09')
    expect(r.values.finishedMaterialDeadline).toBe('2026-11-15')
    expect(r.autoKeys).toEqual(AUTO_SHIFT_KEYS.slice(1))
  })

  it('nhiều ô gõ: theo ô gõ gần nhất phía trước; gõ lại ngày cũ = đứng yên', () => {
    const r = resolveAutoShift(OLD, {
      'stage.PHOI_START': '2026-11-13',
      'stage.FRAME': '2026-11-18',
      'stage.PACKAGING': '2026-11-24',
    })
    expect(r.values['stage.FRAME_HAN']).toBe('2026-11-15')
    expect(r.values['stage.WEAVING']).toBe('2026-11-21')
    expect(r.values['stage.PACKAGING_START']).toBe('2026-11-27')
    expect(r.values['stage.PACKAGING']).toBe('2026-11-24')
    expect(r.autoKeys).not.toContain('stage.PACKAGING')
  })

  it('mốc chưa có ngày không tự sinh; gõ mốc chưa có ngày không dời mốc sau', () => {
    const old: DeadlineValues = { ...OLD, 'stage.FRAME_HAN': null, 'stage.FRAME_SON': null }
    expect(resolveAutoShift(old, { 'stage.PHOI_START': '2026-11-12' }).values['stage.FRAME_HAN']).toBeNull()
    expect(resolveAutoShift(old, { 'stage.FRAME_HAN': '2026-11-20' }).autoKeys).toEqual([])
  })

  it('chỉ gõ Mua VT: không dời mốc nào', () => {
    expect(resolveAutoShift(OLD, { materialDeadline: '2026-11-05' }).autoKeys).toEqual([])
  })
})

describe('milestoneOrderErrors (Q9-2)', () => {
  it('đúng thứ tự, bỏ qua mốc trống', () => {
    expect(milestoneOrderErrors({ materialDeadline: '2026-11-01', 'stage.FRAME_PHOI': '2026-11-10', 'stage.FRAME_HAN': null, deliveryDeadline: '2026-11-25' })).toEqual([])
  })
  it('Hàn sớm hơn Phôi', () => {
    expect(milestoneOrderErrors({ 'stage.FRAME_PHOI': '2026-11-13', 'stage.FRAME_HAN': '2026-11-12', 'stage.FRAME_SON': '2026-11-14' }))
      .toEqual(['Hàn (12/11) sớm hơn Phôi (13/11)'])
  })
  it('Đóng gói sau hạn giao + Mua VT còn lại sau Bắt đầu đóng gói', () => {
    expect(milestoneOrderErrors({
      'stage.PACKAGING_START': '2026-11-10', 'stage.PACKAGING': '2026-11-12', finishedMaterialDeadline: '2026-11-11', deliveryDeadline: '2026-11-11',
    })).toEqual(['Hạn giao (11/11) sớm hơn Đóng gói (12/11)', 'Mua VT còn lại (11/11) muộn hơn Bắt đầu đóng gói (10/11)'])
  })
  it('nhiều mốc sau cùng sớm hơn 1 mốc → gộp 1 câu', () => {
    expect(milestoneOrderErrors({
      'stage.FRAME_PHOI': '2026-11-05', 'stage.FRAME_HAN': '2026-12-07', 'stage.FRAME_SON': '2026-11-09', 'stage.FRAME': '2026-11-09', deliveryDeadline: '2026-11-30',
    })).toEqual(['Hàn (07/12) muộn hơn các mốc sau nó: Sơn (09/11), Khung (09/11), Hạn giao (30/11)'])
  })
})

describe('isFloorStarted (Q9-3)', () => {
  it('chỉ PENDING / chưa có lệnh SX là chưa bắt đầu', () => {
    expect(isFloorStarted(null)).toBe(false)
    expect(isFloorStarted('PENDING')).toBe(false)
    expect(isFloorStarted('ACTIVE')).toBe(true)
    expect(isFloorStarted('PAUSED')).toBe(true)
    expect(isFloorStarted('FINISHED')).toBe(true)
  })
})
