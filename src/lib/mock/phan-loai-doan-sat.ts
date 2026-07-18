/**
 * Selector THUẦN cho "Kho phôi" — quy đoạn KCS-đạt (Phôi) về 2 xô theo nhu cầu Hàn:
 *   - CẦN (chờ chuyển Hàn) = đoạn tồn còn PHỤC VỤ cho phần Hàn chưa xong.
 *   - THỪA (đầu mẩu / dôi ra) = đoạn tồn mà KHÔNG chi tiết nào còn dùng (BOM không cần,
 *     vd 200mm, hoặc chi tiết dùng nó đã hàn đủ) → chờ xử lý sau.
 *
 * Cùng công thức với "thực có (đoạn)" bên màn Hàn (core.tsx):
 *   tồn      = KCS-đạt (getDoanTonKho) − tiêu hao (Σ mọi lô báo sản lượng × đoạn/chi tiết)
 *   remainNeed = Σ (SL chi tiết CHƯA hàn × đoạn/chi tiết) qua mọi dòng dùng đúng đoạn đó
 *   cần = min(tồn, remainNeed) · thừa = max(0, tồn − remainNeed)
 *
 * Chỉ xét các PO có sẵn kế hoạch Hàn (tránh coi đoạn của PO chưa mô hình hoá là "thừa").
 */
import type { ProcRow } from '../../components/sanxuat/core'
import type { SanLuongBatch, DoanTon } from '../../services/api'

export interface DoanKhoRow {
  key: string
  poNumber: string
  loaiSat: string
  quyCach: string
  len: number
  soDoan: number
}
export interface DoanKhoView { duyet: DoanKhoRow[]; thua: DoanKhoRow[] }

export function computeDoanKho(hanRows: ProcRow[], batches: SanLuongBatch[], doanTon: DoanTon[]): DoanKhoView {
  // Σ đã báo (done + chờ-KCS) theo từng dòng Hàn (khớp cách màn Hàn cộng tiêu hao & còn lại).
  const reportedByLine = new Map<number, number>()
  for (const b of batches) {
    if (b.stage !== 'HAN') continue
    reportedByLine.set(b.lineId, (reportedByLine.get(b.lineId) ?? 0) + b.qty)
  }

  const poCoKeHoach = new Set(hanRows.map(r => r.poNumber))
  const consumed = new Map<string, number>()   // đoạn đã tiêu hao (mọi lô)
  const remainNeed = new Map<string, number>() // đoạn còn cần cho phần Hàn chưa xong
  for (const r of hanRows) {
    for (const l of r.lines ?? []) {
      if (!l.parts) continue
      const reported = reportedByLine.get(l.id) ?? 0
      const remainCai = Math.max(0, l.needQty - reported)
      for (const pt of l.parts) {
        const key = `${r.poNumber}|${pt.loaiSat}|${pt.quyCach}|${pt.len}`
        consumed.set(key, (consumed.get(key) ?? 0) + reported * pt.perChiTiet)
        remainNeed.set(key, (remainNeed.get(key) ?? 0) + remainCai * pt.perChiTiet)
      }
    }
  }

  const duyet: DoanKhoRow[] = []
  const thua: DoanKhoRow[] = []
  for (const d of doanTon) {
    if (!poCoKeHoach.has(d.poNumber)) continue
    const key = `${d.poNumber}|${d.loaiSat}|${d.quyCach}|${d.len}`
    const ton = Math.max(0, d.soDoan - (consumed.get(key) ?? 0))
    if (ton <= 0) continue
    const need = remainNeed.get(key) ?? 0
    const can = Math.min(ton, need)
    const du = Math.max(0, ton - need)
    const base = { key, poNumber: d.poNumber, loaiSat: d.loaiSat, quyCach: d.quyCach, len: d.len }
    if (can > 0) duyet.push({ ...base, soDoan: can })
    if (du > 0) thua.push({ ...base, soDoan: du })
  }
  const byLen = (a: DoanKhoRow, b: DoanKhoRow) => a.loaiSat.localeCompare(b.loaiSat) || b.len - a.len
  return { duyet: duyet.sort(byLen), thua: thua.sort(byLen) }
}
