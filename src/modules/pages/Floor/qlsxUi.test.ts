import { describe, expect, it } from 'vitest'
import type { BeWorkstation } from '../../../services/floor-api'
import { isCutUnassigned, kindWithMachine, summarizeCutMachines } from './qlsxUi'

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

describe('kindWithMachine', () => {
  it('máy cắt ghi loại máy, loại khác giữ nhãn gốc', () => {
    expect(kindWithMachine(ws({ cutMachineType: 'tu_dong' }))).toBe('Máy cắt · MC Tự động')
    expect(kindWithMachine(ws({ kind: 'PIECE', cutMachineType: null }))).toBe('Điểm làm việc (Hàn/Sơn)')
  })
})
