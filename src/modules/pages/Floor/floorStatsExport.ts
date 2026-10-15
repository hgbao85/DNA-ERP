/**
 * Dựng file Excel "Báo cáo sản lượng đạt KCS" (2026-10-15). Nhận module `xlsx` làm tham số để màn hình chỉ nạp thư viện
 * (khá nặng) khi người dùng bấm "Xuất Excel", còn test thì dùng thẳng thư viện để đọc lại file đã dựng.
 */
import type * as XlsxNs from 'xlsx'
import type { BeStatPending, BeStatRow } from '../../../services/floor-api'
import { detailAoa, summaryAoa, workerAoa } from './floorStats'

type Xlsx = typeof XlsxNs
interface ExportData {
  rows: BeStatRow[]
  /** Chỉ cần loại việc + số chờ (đã cộng theo loại việc khi ghi sheet "Tổng"). */
  pending: Pick<BeStatPending, 'op' | 'notSent' | 'awaitingQc'>[]
}

/** Tên sheet: ≤ 31 ký tự và không chứa : \ / ? * [ ] (giới hạn của Excel). */
export const STATS_SHEETS = ['Tổng', 'Theo công nhân', 'Chi tiết'] as const

export function buildStatsWorkbook(XLSX: Xlsx, data: ExportData): XlsxNs.WorkBook {
  const wb = XLSX.utils.book_new()
  const aoas = [summaryAoa(data.rows, data.pending), workerAoa(data.rows), detailAoa(data.rows)]
  STATS_SHEETS.forEach((name, i) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoas[i]), name))
  return wb
}
