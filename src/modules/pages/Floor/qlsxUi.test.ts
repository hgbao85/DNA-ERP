import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BeWorkstation } from '../../../services/floor-api'
import {
  blockedTextOf, countedOf, countNonCutUnassigned, isCutUnassigned, isWorkshopUnassigned, kindWithMachine, qlsxStageFromFocus, qlsxTabForUrl, staleTotal,
  startPolling, SUMMARY_POLL_MS, summarizeCutMachines, summaryPillText, workshopsMissingSteelReceive,
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

describe('summaryPillText', () => {
  it('chỉ ghi phần khác 0', () => {
    expect(summaryPillText({ open: 3, awaitingKcs: 1, stale: 2 })).toBe('3 đang mở · 1 KCS đang chấm · 2 quá 4 giờ')
    expect(summaryPillText({ open: 0, awaitingKcs: 1, stale: 0 })).toBe('1 KCS đang chấm')
    expect(summaryPillText({ open: 2, awaitingKcs: 0, stale: 0 })).toBe('2 đang mở')
  })
  it('toàn 0 / thiếu dữ liệu / BE cũ chưa trả awaitingKcs, stale -> rỗng hoặc chỉ phần có', () => {
    expect(summaryPillText({ open: 0, awaitingKcs: 0, stale: 0 })).toBe('')
    expect(summaryPillText(undefined)).toBe('')
    expect(summaryPillText({ open: 4 })).toBe('4 đang mở')
  })
})

describe('staleTotal (số đỏ menu Sản lượng xưởng)', () => {
  it('Σ stale của 3 tổ', () => {
    expect(staleTotal({ PHOI: { open: 3, awaitingKcs: 1, stale: 2 }, HAN: { open: 1, stale: 1 }, SON: { open: 0, awaitingKcs: 0, stale: 0 } })).toBe(3)
  })
  it('BE cũ chưa trả stale, hoặc chưa có dữ liệu -> 0', () => {
    expect(staleTotal({ PHOI: { open: 5 }, HAN: { open: 1 }, SON: { open: 2 } })).toBe(0)
    expect(staleTotal(null)).toBe(0)
    expect(staleTotal(undefined)).toBe(0)
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

describe('startPolling (hỏi lại 5 phút, giờ giả)', () => {
  afterEach(() => { vi.useRealTimers() })

  it('mỗi 5 phút gọi 1 lần; dừng thì không gọi nữa', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const stop = startPolling(run, { isHidden: () => false })
    vi.advanceTimersByTime(SUMMARY_POLL_MS - 1)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(SUMMARY_POLL_MS)
    expect(run).toHaveBeenCalledTimes(2)
    stop()
    vi.advanceTimersByTime(SUMMARY_POLL_MS * 3)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('tab trình duyệt đang ẩn thì bỏ qua lượt đó, hiện lại thì chạy tiếp', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    let hidden = true
    startPolling(run, { isHidden: () => hidden })
    vi.advanceTimersByTime(SUMMARY_POLL_MS * 2)
    expect(run).not.toHaveBeenCalled()
    hidden = false
    vi.advanceTimersByTime(SUMMARY_POLL_MS)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('mặc định chu kỳ đúng 5 phút', () => {
    expect(SUMMARY_POLL_MS).toBe(300_000)
  })
})

describe('qlsxStageFromFocus (P1 19/11: bấm tin quá 4 giờ mở đúng tab tổ)', () => {
  it('lấy tổ từ focus FLOOR_STAGE:<tổ>:<xưởng>', () => {
    expect(qlsxStageFromFocus('FLOOR_STAGE:HAN:1')).toBe('HAN')
    expect(qlsxStageFromFocus('FLOOR_STAGE:SON:2')).toBe('SON')
    expect(qlsxStageFromFocus('FLOOR_STAGE:PHOI:none')).toBe('PHOI')
    expect(qlsxStageFromFocus('FLOOR_STAGE:HAN')).toBe('HAN')
  })
  it('không khớp mẫu thì null (giữ tab đang nhớ)', () => {
    expect(qlsxStageFromFocus(null)).toBeNull()
    expect(qlsxStageFromFocus('')).toBeNull()
    expect(qlsxStageFromFocus('PI:79')).toBeNull()
    expect(qlsxStageFromFocus('FLOOR_STAGE:DONG_GOI:1')).toBeNull()
    expect(qlsxStageFromFocus('FLOOR_STAGE:HANX:1')).toBeNull()
  })
})
