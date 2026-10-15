import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import type { BeStatRow } from '../../../services/floor-api'
import { buildStatsWorkbook, STATS_SHEETS } from './floorStatsExport'

const rows: BeStatRow[] = [
  { bucket: '2026-10-15', op: 'CAT', workerId: 'u1', workerName: 'Nguyễn An', label: '185mm · Sắt phi 4', passed: 18, failed: 2 },
  { bucket: '2026-10-15', op: 'HAN', workerId: null, workerName: null, label: 'Mê ngồi', passed: 40, failed: 3 },
]

/** Dựng file thật rồi ĐỌC LẠI: tên sheet hợp lệ với Excel, tiếng Việt và con số còn nguyên. */
describe('buildStatsWorkbook', () => {
  const buf = XLSX.write(buildStatsWorkbook(XLSX, { rows, pending: [{ op: 'CAT', notSent: 125, awaitingQc: 136 }] }), { bookType: 'xlsx', type: 'array' })
  const back = XLSX.read(buf, { type: 'array' })
  const table = (name: string) => XLSX.utils.sheet_to_json<unknown[]>(back.Sheets[name], { header: 1 })

  it('3 sheet đúng tên, tên hợp lệ với Excel (≤ 31 ký tự, không có : \\ / ? * [ ])', () => {
    expect(back.SheetNames).toEqual([...STATS_SHEETS])
    for (const n of STATS_SHEETS) {
      expect(n.length).toBeLessThanOrEqual(31)
      expect(n).not.toMatch(/[:\\/?*[\]]/)
    }
  })

  it('sheet Chi tiết: tiêu đề + dòng số liệu tiếng Việt đúng; người trống ghi "Chưa rõ người"', () => {
    const t = table('Chi tiết')
    expect(t[0]).toEqual(['Kỳ', 'Tổ', 'Loại việc', 'Công nhân', 'Cỡ đoạn / mảnh', 'Đơn vị', 'Đạt', 'Lỗi'])
    expect(t[1]).toEqual(['2026-10-15', 'Phôi', 'Cắt', 'Nguyễn An', '185mm · Sắt phi 4', 'đoạn', 18, 2])
    expect(t[2]).toEqual(['2026-10-15', 'Hàn', 'Hàn', 'Chưa rõ người', 'Mê ngồi', 'mảnh', 40, 3])
  })

  it('sheet Tổng gồm số đang chờ KCS; sheet Theo công nhân có tỷ lệ đạt %', () => {
    expect(table('Tổng')[1]).toEqual(['Cắt', 'đoạn', 18, 2, 90, 125, 136])
    expect(table('Theo công nhân')[1]).toEqual(['Cắt', 'Nguyễn An', 'đoạn', 18, 2, 90])
  })
})
