import { buildCutSheetsDocument, type MachineGroup } from '../cutAllocationModel'

/** Mở cửa sổ in phiếu cắt; trả false khi trình duyệt chặn cửa sổ. */
export function printSheets(groups: MachineGroup[], workshopName: string, skipEmpty: boolean): boolean {
  const w = window.open('', '', 'height=800,width=1200')
  if (!w) return false
  w.document.write(buildCutSheetsDocument(groups, workshopName, new Date().toLocaleDateString('vi-VN'), skipEmpty))
  w.document.close()
  return true
}
