import type { BeCutMachineStats } from '../../../../services/floor-api'
import { CUT_STATS_SHEETS, cutStatsFileName, dayAoa, machineAoa, materialAoa, methodAoa, typeAoa } from '../cutMachineStats'

/** Xuất 5 sheet (theo loại máy, theo máy, theo ngày, theo loại sắt, cách tính) ra file Excel. */
export async function exportCutStatsXlsx(data: BeCutMachineStats): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const aoas = [typeAoa(data), machineAoa(data), dayAoa(data), materialAoa(data), methodAoa(data)]
  CUT_STATS_SHEETS.forEach((name, i) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoas[i]), name))
  XLSX.writeFile(wb, cutStatsFileName(data.workshop.code, data.range.from, data.range.to))
}
