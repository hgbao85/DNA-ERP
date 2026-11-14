import { describe, expect, it } from 'vitest'
import type { BeCutMachineStats } from '../../../services/floor-api'
import {
  CUT_STATS_SHEETS, cutStatsFileName, dayAoa, defaultRange, fmt1, fmtDayShort, fmtOrDash, fmtTimeVn, machineAoa, machineRows,
  machineTypeLabel, materialAoa, methodAoa, methodLines, rangeError, topMaterialLabel, typeAoa,
  machineNameSuffix, reportWindowText, sortedDays, statsErrorText, statsSummaryParts, typeCardView,
} from './cutMachineStats'

const DATA: BeCutMachineStats = {
  workshop: { id: 'w1', code: 'X1', name: 'Xưởng 1' },
  range: { from: '2026-11-01', to: '2026-11-14', timezone: 'Asia/Ho_Chi_Minh' },
  method: {
    lunchBreak: { from: '11:30', to: '13:00' }, maxGapMinutes: 120, minRateMinutes: 30, defaultBarLengthMm: 6000,
    blade: { laser: 2, tu_dong: 4 }, trim: { laser: 50, tu_dong: 100 },
  },
  machines: [
    { id: 'm2', code: 'MC2', name: 'Máy 2', machineType: 'tu_dong', isActive: true },
    { id: 'm1', code: 'MC1', name: 'Máy 1', machineType: 'laser', isActive: true },
  ],
  days: [{
    machineId: 'm1', day: '2026-11-12', reports: 5, firstAt: '2026-11-12T01:05:00.000Z', lastAt: '2026-11-12T09:30:00.000Z',
    segments: 120, meters: 240.5, bars: 41.2, rateBars: 30, rateMinutes: 200, barsPerHour: 9,
    materials: [{ materialId: 'a', label: 'Phi 10', bars: 10 }, { materialId: 'b', label: 'Phi 12', bars: 31.2 }],
  }, {
    machineId: 'm1', day: '2026-11-13', reports: 1, firstAt: '2026-11-13T01:00:00.000Z', lastAt: '2026-11-13T01:00:00.000Z',
    segments: 1, meters: 1, bars: 1, rateBars: 0, rateMinutes: 0, barsPerHour: null, materials: [],
  }],
  byMachine: [{ machineId: 'm1', daysWithData: 2, totalBars: 42.2, barsPerDayAvg: 21.1, barsPerDayMedian: 21.1, barsPerHour: null }],
  byMachineType: [{ machineType: 'laser', machines: 1, machineDays: 2, barsPerDayAvg: 21.1, barsPerDayMedian: 21.1, barsPerHour: 9 }],
  byMaterial: [{ machineType: 'laser', materialId: 'b', label: 'Phi 12', bars: 31.2, rateBars: 30, rateMinutes: 200, barsPerHour: null }],
  generatedAt: '2026-11-14T03:00:00.000Z',
}

describe('định dạng', () => {
  it('số vi-VN 1 chữ số lẻ, null -> "—"', () => {
    expect(fmt1(1234.56)).toBe('1.234,6')
    expect(fmt1(3)).toBe('3,0')
    expect(fmtOrDash(null)).toBe('—')
    expect(fmtOrDash(9)).toBe('9,0')
  })
  it('giờ HH:mm theo giờ VN', () => {
    expect(fmtTimeVn('2026-11-12T01:05:00.000Z')).toBe('08:05')
    expect(fmtTimeVn('2026-11-12T17:30:00.000Z')).toBe('00:30')
    expect(fmtTimeVn('hỏng')).toBe('—')
  })
  it('ngày ngắn và nhãn loại máy', () => {
    expect(fmtDayShort('2026-11-12')).toBe('12/11')
    expect(machineTypeLabel('laser')).toBe('MC Laser')
    expect(machineTypeLabel('tu_dong')).toBe('MC Tự động')
  })
})

describe('khoảng ngày', () => {
  it('mặc định 14 ngày tới hôm nay (giờ VN)', () => {
    expect(defaultRange('2026-11-14')).toEqual({ from: '2026-11-01', to: '2026-11-14' })
    expect(defaultRange('2026-03-05')).toEqual({ from: '2026-02-20', to: '2026-03-05' })
  })
  it('kiểm khoảng: đủ ngày, từ ≤ đến, tối đa 62 ngày', () => {
    expect(rangeError('2026-11-01', '2026-11-14')).toBeNull()
    expect(rangeError('2026-11-14', '2026-11-14')).toBeNull()
    expect(rangeError('', '2026-11-14')).not.toBeNull()
    expect(rangeError('2026-11-15', '2026-11-14')).toMatch(/trước hoặc bằng/)
    expect(rangeError('2026-09-13', '2026-11-13')).toBeNull() // đúng 62 ngày
    expect(rangeError('2026-09-12', '2026-11-13')).toMatch(/62/) // 63 ngày
  })
})

describe('bảng Excel', () => {
  it('tên sheet hợp lệ', () => {
    for (const n of CUT_STATS_SHEETS) {
      expect(n.length).toBeLessThanOrEqual(31)
      expect(n).not.toMatch(/[:\\/?*[\]]/)
    }
  })
  it('theo loại máy', () => {
    const a = typeAoa(DATA)
    expect(a[0]).toEqual(['Loại máy', 'Số máy', 'Số ngày-máy', 'Cây/ngày TB', 'Cây/ngày trung vị', 'Cây/giờ'])
    expect(a[1]).toEqual(['MC Laser', 1, 2, 21.1, 21.1, 9])
  })
  it('theo máy: máy chưa có số vẫn có dòng, null -> ô trống', () => {
    const a = machineAoa(DATA)
    expect(a[0][0]).toBe('Mã máy')
    expect(a[1]).toEqual(['MC1', 'Máy 1', 'MC Laser', 2, 42.2, 21.1, 21.1, ''])
    expect(a[2]).toEqual(['MC2', 'Máy 2', 'MC Tự động', 0, '', '', '', ''])
    expect(machineRows(DATA).map((r) => r.machine.code)).toEqual(['MC1', 'MC2'])
  })
  it('theo ngày', () => {
    const a = dayAoa(DATA)
    expect(a[0]).toHaveLength(12)
    expect(a[1]).toEqual(['2026-11-12', 'MC1', 'MC Laser', 5, '08:05', '16:30', 200, 120, 240.5, 41.2, 9, 'Phi 12'])
    expect(a[2][10]).toBe('')
    expect(a[2][11]).toBe('')
  })
  it('theo loại sắt', () => {
    expect(materialAoa(DATA)).toEqual([
      ['Loại máy', 'Loại sắt', 'Cây', 'Phút tính', 'Cây/giờ'],
      ['MC Laser', 'Phi 12', 31.2, 200, ''],
    ])
  })
  it('loại sắt nhiều nhất', () => {
    expect(topMaterialLabel(DATA.days[0].materials)).toBe('Phi 12')
    expect(topMaterialLabel([])).toBe('')
  })
})

describe('cách tính', () => {
  it('dòng chữ có đúng số từ method', () => {
    const t = methodLines(DATA.method).join('\n')
    expect(t).toContain('2 mm')
    expect(t).toContain('4 mm')
    expect(t).toContain('50 mm')
    expect(t).toContain('100 mm')
    expect(t).toContain('6.000 mm')
    expect(t).toContain('120 phút')
    expect(t).toContain('dưới 30 phút')
    expect(t).toContain('11:30–13:00')
  })
  it('sheet Cách tính có xưởng, khoảng và các dòng', () => {
    const a = methodAoa(DATA)
    expect(a[1]).toEqual(['Xưởng', 'Xưởng 1'])
    expect(a[2]).toEqual(['Từ ngày', '2026-11-01'])
    expect(a.length).toBe(4 + methodLines(DATA.method).length)
  })
})

describe('tên file', () => {
  it('đúng mẫu', () => {
    expect(cutStatsFileName('X1', '2026-11-01', '2026-11-14')).toBe('nang-suat-may-cat_X1_2026-11-01_2026-11-14.xlsx')
    expect(cutStatsFileName('X 1/2', '2026-11-01', '2026-11-14')).toBe('nang-suat-may-cat_X-1-2_2026-11-01_2026-11-14.xlsx')
  })
})

describe('trình bày khối năng suất', () => {
  it('hậu tố tên máy: bỏ tên trùng mã, ghi máy đã tắt', () => {
    expect(machineNameSuffix({ code: 'MC1', name: 'Máy 1', isActive: true })).toBe(' · Máy 1')
    expect(machineNameSuffix({ code: 'MC1', name: 'MC1', isActive: true })).toBe('')
    expect(machineNameSuffix({ code: 'MC1', name: '', isActive: false })).toBe(' (đã tắt)')
  })

  it('ngày mới lên trước, cùng ngày theo mã máy; không đổi mảng gốc', () => {
    const d = (machineId: string, day: string) => ({ ...DATA.days[0], machineId, day })
    const data = { machines: DATA.machines, days: [d('m1', '2026-11-12'), d('m2', '2026-11-13'), d('m1', '2026-11-13')] }
    expect(sortedDays(data).map((x) => `${x.day}|${x.machineId}`)).toEqual(['2026-11-13|m1', '2026-11-13|m2', '2026-11-12|m1'])
    expect(data.days[0].day).toBe('2026-11-12')
  })

  it('giờ báo đầu-cuối theo giờ Việt Nam', () => {
    expect(reportWindowText(DATA.days[0])).toBe('08:05–16:30')
  })

  it('thẻ loại máy: số to là trung vị, chi tiết có trung bình và cây/giờ', () => {
    expect(typeCardView(DATA.byMachineType[0])).toEqual({
      title: 'MC Laser', value: '21,1', unit: 'cây/ngày (trung vị)',
      detail: 'TB 21,1 cây/ngày · 9,0 cây/giờ · 1 máy, 2 ngày-máy',
    })
  })

  it('dòng tóm tắt và chữ lỗi', () => {
    expect(statsSummaryParts(DATA)).toEqual({ workshop: 'Xưởng 1', range: '01/11 – 14/11', updated: 'cập nhật lúc 10:00' })
    expect(statsErrorText(new Error('Hỏng'), 'x')).toBe('Hỏng')
    expect(statsErrorText('lạ', 'Dự phòng')).toBe('Dự phòng')
    expect(statsErrorText(new Error(''), 'Dự phòng')).toBe('Dự phòng')
  })
})
