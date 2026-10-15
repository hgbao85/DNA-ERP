import { describe, expect, it } from 'vitest'
import type { BeStatRow } from '../../../services/floor-api'
import {
  addDays, bucketLabel, byLabelFor, byWorkerFor, canStepForward, detailAoa, filterByWorker, fmtRate, initialPeriod, isPeriodValid,
  labelIndexes, niceTicks, outputRangeDays, passRate, pendingByOp, pendingText, periodLabel, pickOp, ratePct, resolvePeriod, seriesFor, slugName, spanOf,
  statsFileName, stepPeriod, summaryAoa, todayVn, totalsByOp, WORKER_ALL, workerAoa, workerOptions, type Period,
} from './floorStats'

const row = (over: Partial<BeStatRow>): BeStatRow => ({
  bucket: '2026-10-15', op: 'CAT', workerId: 'u1', workerName: 'Nguyễn An', label: '185mm · Sắt phi 4', passed: 10, failed: 0, ...over,
})

describe('kỳ báo cáo (giờ VN)', () => {
  it('todayVn: 17:30 UTC ngày 31/10 đã là 01/11 theo giờ VN, không phụ thuộc múi giờ máy', () => {
    expect(todayVn(new Date('2026-10-31T17:30:00Z'))).toBe('2026-11-01')
    expect(todayVn(new Date('2026-10-15T16:59:59Z'))).toBe('2026-10-15')
  })

  it('initialPeriod: tháng hiện tại, từ mùng 1 đến hôm nay', () => {
    const p = initialPeriod('2026-10-15')
    expect(p.mode).toBe('month')
    expect(resolvePeriod(p)).toEqual({ from: '2026-10-01', to: '2026-10-31', groupBy: 'day' })
  })

  it('resolvePeriod: ngày = 1 ngày; tháng đủ độ dài (kể cả tháng 2 năm nhuận); năm chia theo tháng', () => {
    const base = initialPeriod('2026-10-15')
    expect(resolvePeriod({ ...base, mode: 'day', day: '2026-10-15' })).toEqual({ from: '2026-10-15', to: '2026-10-15', groupBy: 'day' })
    expect(resolvePeriod({ ...base, mode: 'month', month: '2026-02' }).to).toBe('2026-02-28')
    expect(resolvePeriod({ ...base, mode: 'month', month: '2028-02' }).to).toBe('2028-02-29')
    expect(resolvePeriod({ ...base, mode: 'month', month: '2026-12' }).to).toBe('2026-12-31')
    expect(resolvePeriod({ ...base, mode: 'year', year: 2026 })).toEqual({ from: '2026-01-01', to: '2026-12-31', groupBy: 'month' })
  })

  it('khoảng tự chọn: ≤ 92 ngày chia theo ngày, dài hơn chia theo tháng', () => {
    const base = initialPeriod('2026-10-15')
    expect(resolvePeriod({ ...base, mode: 'range', from: '2026-10-01', to: '2026-12-31' }).groupBy).toBe('day') // đúng 92
    expect(resolvePeriod({ ...base, mode: 'range', from: '2026-10-01', to: '2027-01-01' }).groupBy).toBe('month') // 93
  })

  it('isPeriodValid: khoảng ngược hoặc thiếu ngày thì không hợp lệ; chế độ khác luôn hợp lệ', () => {
    const base = initialPeriod('2026-10-15')
    expect(isPeriodValid({ ...base, mode: 'range', from: '2026-10-16', to: '2026-10-15' })).toBe(false)
    expect(isPeriodValid({ ...base, mode: 'range', from: '', to: '2026-10-15' })).toBe(false)
    expect(isPeriodValid({ ...base, mode: 'range', from: '2026-10-15', to: '2026-10-15' })).toBe(true)
    expect(isPeriodValid({ ...base, mode: 'month' })).toBe(true)
  })

  it('stepPeriod: ngày ±1 qua ranh giới tháng; tháng qua ranh giới năm; năm; khoảng nhảy đúng độ dài', () => {
    const base: Period = { ...initialPeriod('2026-10-15') }
    expect(stepPeriod({ ...base, mode: 'day', day: '2026-10-31' }, 1).day).toBe('2026-11-01')
    expect(stepPeriod({ ...base, mode: 'day', day: '2026-03-01' }, -1).day).toBe('2026-02-28')
    expect(stepPeriod({ ...base, mode: 'month', month: '2026-12' }, 1).month).toBe('2027-01')
    expect(stepPeriod({ ...base, mode: 'month', month: '2026-01' }, -1).month).toBe('2025-12')
    expect(stepPeriod({ ...base, mode: 'year', year: 2026 }, -1).year).toBe(2025)
    const r = stepPeriod({ ...base, mode: 'range', from: '2026-10-10', to: '2026-10-16' }, 1) // 7 ngày
    expect([r.from, r.to]).toEqual(['2026-10-17', '2026-10-23'])
    const back = stepPeriod({ ...base, mode: 'range', from: '2026-10-10', to: '2026-10-16' }, -1)
    expect([back.from, back.to]).toEqual(['2026-10-03', '2026-10-09'])
  })

  it('canStepForward: không tiến sang kỳ bắt đầu sau hôm nay', () => {
    const base = initialPeriod('2026-10-15')
    expect(canStepForward({ ...base, mode: 'day', day: '2026-10-14' }, '2026-10-15')).toBe(true)
    expect(canStepForward({ ...base, mode: 'day', day: '2026-10-15' }, '2026-10-15')).toBe(false)
    expect(canStepForward({ ...base, mode: 'month', month: '2026-10' }, '2026-10-15')).toBe(false)
    expect(canStepForward({ ...base, mode: 'month', month: '2026-09' }, '2026-10-15')).toBe(true)
    expect(canStepForward({ ...base, mode: 'year', year: 2026 }, '2026-10-15')).toBe(false)
  })

  it('outputRangeDays: cùng khoảng với nút "7 ngày qua / Tháng này / Tháng trước" ở màn công nhân (giờ VN)', () => {
    expect(outputRangeDays('7d', '2026-10-15')).toEqual({ from: '2026-10-09', to: '2026-10-15' })
    expect(outputRangeDays('7d', '2026-11-03')).toEqual({ from: '2026-10-28', to: '2026-11-03' })
    expect(outputRangeDays('month', '2026-10-15')).toEqual({ from: '2026-10-01', to: '2026-10-15' })
    expect(outputRangeDays('lastMonth', '2026-10-15')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(outputRangeDays('lastMonth', '2027-01-05')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(outputRangeDays('lastMonth', '2028-03-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' }) // năm nhuận
  })

  it('addDays / spanOf', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(spanOf('2026-10-15', '2026-10-15')).toBe(1)
    expect(spanOf('2026-10-16', '2026-10-15')).toBe(0)
  })

  it('periodLabel / bucketLabel', () => {
    const base = initialPeriod('2026-10-15')
    expect(periodLabel({ ...base, mode: 'day', day: '2026-10-05' })).toBe('ngày 05/10/2026')
    expect(periodLabel({ ...base, mode: 'month', month: '2026-10' })).toBe('tháng 10/2026')
    expect(periodLabel({ ...base, mode: 'year', year: 2026 })).toBe('năm 2026')
    expect(periodLabel({ ...base, mode: 'range', from: '2026-10-01', to: '2026-10-15' })).toBe('01/10/2026 – 15/10/2026')
    expect(bucketLabel('2026-10-05', 'day')).toBe('05/10')
    expect(bucketLabel('2026-10', 'month')).toBe('10/2026')
    expect(bucketLabel('2026', 'year')).toBe('2026')
  })
})

describe('cộng số', () => {
  const rows = [
    row({ passed: 18, failed: 2 }),
    row({ bucket: '2026-10-16', passed: 5, failed: 0, label: '60mm · Sắt phi 4' }),
    row({ workerId: 'u2', workerName: 'Trần Bình', passed: 30, failed: 1 }),
    row({ workerId: null, workerName: null, passed: 4, failed: 0 }),
    row({ op: 'UON', passed: 7, failed: 0 }),
    row({ op: 'HAN', label: 'Mê ngồi', passed: 40, failed: 3 }),
  ]

  it('passRate / fmtRate: đạt/(đạt+lỗi), không có số thì "—"', () => {
    expect(passRate({ passed: 18, failed: 2 })).toBeCloseTo(0.9)
    expect(passRate({ passed: 0, failed: 0 })).toBeNull()
    expect(fmtRate(0.9)).toBe('90%')
    expect(fmtRate(0.9944)).toBe('99,4%')
    expect(fmtRate(1)).toBe('100%')
    expect(fmtRate(null)).toBe('—')
  })

  it('ratePct / fmtRate: còn lỗi thì KHÔNG BAO GIỜ hiện 100% (55.541 đạt / 23 lỗi = 99,96% phải ra 99,9%, không phải 100%)', () => {
    expect(ratePct(passRate({ passed: 55541, failed: 23 }))).toBe(99.9)
    expect(fmtRate(passRate({ passed: 55541, failed: 23 }))).toBe('99,9%')
    expect(fmtRate(passRate({ passed: 2820, failed: 2 }))).toBe('99,9%') // 99,93%
    expect(fmtRate(passRate({ passed: 999, failed: 1 }))).toBe('99,9%') // đúng 99,9
    expect(fmtRate(passRate({ passed: 5, failed: 0 }))).toBe('100%') // không lỗi mới 100%
    expect(ratePct(0.9)).toBe(90)
    expect(ratePct(null)).toBeNull()
  })

  it('totalsByOp: theo loại việc, đúng thứ tự quy trình, không gộp chung các loại', () => {
    expect(totalsByOp(rows)).toEqual([
      { op: 'CAT', passed: 57, failed: 3 },
      { op: 'UON', passed: 7, failed: 0 },
      { op: 'HAN', passed: 40, failed: 3 },
    ])
  })

  it('pickOp: giữ lựa chọn còn số liệu, không thì loại nhiều đạt nhất; trống thì null', () => {
    const t = totalsByOp(rows)
    expect(pickOp(t, 'UON')).toBe('UON')
    expect(pickOp(t, 'SON')).toBe('CAT') // SON không có số -> loại nhiều nhất
    expect(pickOp(t, null)).toBe('CAT')
    expect(pickOp([], 'CAT')).toBeNull()
  })

  it('seriesFor: cột nào không có số cũng có mặt (=0), đúng thứ tự thời gian', () => {
    const s = seriesFor(rows, 'CAT', ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'])
    expect(s).toEqual([
      { bucket: '2026-10-14', passed: 0, failed: 0 },
      { bucket: '2026-10-15', passed: 52, failed: 3 },
      { bucket: '2026-10-16', passed: 5, failed: 0 },
      { bucket: '2026-10-17', passed: 0, failed: 0 },
    ])
  })

  it('byWorkerFor: nhiều đạt nhất trước, đợt không có người gom vào "Chưa rõ người"', () => {
    const w = byWorkerFor(rows, 'CAT')
    expect(w.map((x) => [x.name, x.passed, x.failed])).toEqual([
      ['Trần Bình', 30, 1],
      ['Nguyễn An', 23, 2],
      ['Chưa rõ người', 4, 0],
    ])
    expect(byWorkerFor(rows, 'XE')).toEqual([])
  })

  it('byLabelFor: theo cỡ/mảnh, nhiều đạt nhất trước', () => {
    expect(byLabelFor(rows, 'CAT').map((x) => [x.label, x.passed])).toEqual([
      ['185mm · Sắt phi 4', 52],
      ['60mm · Sắt phi 4', 5],
    ])
    expect(byLabelFor(rows, 'HAN')).toEqual([{ label: 'Mê ngồi', passed: 40, failed: 3 }])
  })
})

describe('pendingText - số đang chờ KCS', () => {
  it('ghi rõ chưa gửi / chờ KCS theo từng loại việc, đúng thứ tự quy trình, bỏ loại không có gì chờ', () => {
    expect(pendingText([
      { op: 'HAN', notSent: 0, awaitingQc: 13 },
      { op: 'CAT', notSent: 125, awaitingQc: 136 },
      { op: 'UON', notSent: 3, awaitingQc: 0 },
      { op: 'SON', notSent: 0, awaitingQc: 0 },
    ])).toBe('Cắt: 125 đoạn chưa gửi, 136 đoạn chờ KCS · Uốn: 3 đoạn chưa gửi · Hàn: 13 mảnh chờ KCS')
  })
  it('không có gì chờ thì rỗng', () => {
    expect(pendingText([])).toBe('')
    expect(pendingText([{ op: 'CAT', notSent: 0, awaitingQc: 0 }])).toBe('')
  })
})

describe('lọc theo công nhân (QLSX xem từng người)', () => {
  const rows = [
    row({ workerId: 'u2', workerName: 'Trần Bình', passed: 30 }),
    row({ workerId: 'u1', workerName: 'Nguyễn An', passed: 20 }),
    row({ workerId: null, workerName: null, passed: 4 }),
    row({ workerId: 'u1', workerName: 'Nguyễn An', op: 'UON', passed: 7 }),
  ]
  const pending = [
    { op: 'CAT' as const, workerId: 'u3', workerName: 'Lê Cường', notSent: 5, awaitingQc: 0 }, // chỉ có số chờ, chưa có số đã duyệt
    { op: 'CAT' as const, workerId: 'u1', workerName: 'Nguyễn An', notSent: 2, awaitingQc: 6 },
    { op: 'HAN' as const, workerId: 'u1', workerName: 'Nguyễn An', notSent: 0, awaitingQc: 9 },
  ]

  it('workerOptions: gồm cả người chỉ có số đang chờ, xếp theo tên, "Chưa rõ người" ở cuối, không trùng', () => {
    expect(workerOptions(rows, pending)).toEqual([
      { key: 'u3', name: 'Lê Cường' },
      { key: 'u1', name: 'Nguyễn An' },
      { key: 'u2', name: 'Trần Bình' },
      { key: '', name: 'Chưa rõ người' },
    ])
  })

  it('filterByWorker: 1 người chỉ còn số của người đó; "all" giữ nguyên; "" là đợt chưa rõ người', () => {
    expect(filterByWorker(rows, 'u1').map((r) => r.passed)).toEqual([20, 7])
    expect(filterByWorker(rows, WORKER_ALL)).toHaveLength(4)
    expect(filterByWorker(rows, '').map((r) => r.passed)).toEqual([4])
    expect(filterByWorker(rows, 'khong-co')).toEqual([])
    expect(filterByWorker(pending, 'u1').map((p) => p.op)).toEqual(['CAT', 'HAN'])
  })

  it('lọc rồi cộng: số của 1 người không lẫn người khác', () => {
    expect(totalsByOp(filterByWorker(rows, 'u1'))).toEqual([
      { op: 'CAT', passed: 20, failed: 0 },
      { op: 'UON', passed: 7, failed: 0 },
    ])
  })

  it('pendingByOp: cộng mọi người theo loại việc, đúng thứ tự quy trình', () => {
    expect(pendingByOp(pending)).toEqual([
      { op: 'CAT', notSent: 7, awaitingQc: 6 },
      { op: 'HAN', notSent: 0, awaitingQc: 9 },
    ])
    expect(pendingText(filterByWorker(pending, 'u3'))).toBe('Cắt: 5 đoạn chưa gửi')
  })

  it('slugName / tên file có tên công nhân (không dấu, an toàn cho tên file)', () => {
    expect(slugName('Nguyễn Văn Đức')).toBe('Nguyen-Van-Duc')
    expect(slugName('  Trần / Bình? ')).toBe('Tran-Binh')
    expect(statsFileName('2026-10-01', '2026-10-15', 'Nguyễn An')).toBe('Bao-cao-san-luong_2026-10-01_2026-10-15_Nguyen-An.xlsx')
    expect(statsFileName('2026-10-01', '2026-10-15')).toBe('Bao-cao-san-luong_2026-10-01_2026-10-15.xlsx')
  })
})

describe('trục biểu đồ', () => {
  it('niceTicks: vạch tròn số, ≤ 4 khoảng, vạch cuối ≥ max', () => {
    expect(niceTicks(3)).toEqual([0, 1, 2, 3])
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4])
    expect(niceTicks(5)).toEqual([0, 2, 4, 6])
    expect(niceTicks(120)).toEqual([0, 50, 100, 150])
    expect(niceTicks(1840)).toEqual([0, 500, 1000, 1500, 2000])
    const t = niceTicks(55541)
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(55541)
    expect(t.length - 1).toBeLessThanOrEqual(4)
  })
  it('niceTicks: không có số thì vẫn có trục 0..1', () => {
    expect(niceTicks(0)).toEqual([0, 1])
  })
  it('labelIndexes: ít cột thì ghi hết, nhiều cột thì thưa ra nhưng luôn có cột đầu', () => {
    expect([...labelIndexes(7)]).toEqual([0, 1, 2, 3, 4, 5, 6])
    const many = labelIndexes(31)
    expect(many.has(0)).toBe(true)
    expect(many.size).toBeLessThanOrEqual(11)
  })
})

describe('bảng cho Excel', () => {
  const rows = [
    row({ passed: 18, failed: 2 }),
    row({ workerId: null, workerName: null, op: 'HAN', label: 'Mê ngồi', passed: 40, failed: 3 }),
  ]
  it('detailAoa: tiêu đề + mỗi dòng đủ tổ, loại việc, đơn vị; người trống ghi "Chưa rõ người"', () => {
    const a = detailAoa(rows)
    expect(a[0]).toEqual(['Kỳ', 'Tổ', 'Loại việc', 'Công nhân', 'Cỡ đoạn / mảnh', 'Đơn vị', 'Đạt', 'Lỗi'])
    expect(a[1]).toEqual(['2026-10-15', 'Phôi', 'Cắt', 'Nguyễn An', '185mm · Sắt phi 4', 'đoạn', 18, 2])
    expect(a[2]).toEqual(['2026-10-15', 'Hàn', 'Hàn', 'Chưa rõ người', 'Mê ngồi', 'mảnh', 40, 3])
  })
  it('workerAoa: theo (loại việc, công nhân) kèm tỷ lệ đạt %', () => {
    const a = workerAoa(rows)
    expect(a[1]).toEqual(['Cắt', 'Nguyễn An', 'đoạn', 18, 2, 90])
    expect(a[2]).toEqual(['Hàn', 'Chưa rõ người', 'mảnh', 40, 3, 93])
  })
  it('summaryAoa: gồm cả loại việc chỉ có số đang chờ (chưa có số đạt)', () => {
    const a = summaryAoa(rows, [{ op: 'CAT', notSent: 125, awaitingQc: 136 }, { op: 'UON', notSent: 3, awaitingQc: 7 }])
    expect(a[0]).toHaveLength(7)
    expect(a[1]).toEqual(['Cắt', 'đoạn', 18, 2, 90, 125, 136])
    expect(a[2]).toEqual(['Uốn', 'đoạn', 0, 0, '', 3, 7])
    expect(a[3]).toEqual(['Hàn', 'mảnh', 40, 3, 93, 0, 0])
  })
  it('tên file', () => {
    expect(statsFileName('2026-10-01', '2026-10-15')).toBe('Bao-cao-san-luong_2026-10-01_2026-10-15.xlsx')
  })
})
