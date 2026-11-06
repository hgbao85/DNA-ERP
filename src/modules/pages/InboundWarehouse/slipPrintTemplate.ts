/**
 * Khung in phiếu nhập / xuất kho theo mẫu PHIEU_NHAP_XUAT_KHO_MAU_MOI_IEA (anh Nhân gửi 30/10, Mẫu 01-VT / 02-VT "bổ sung IEA"):
 * A4 ngang, đầu công ty + MST, số phiếu góc phải, tiêu đề, ngày, các dòng thông tin có dấu *, bảng ít nhất 9 dòng, 4 ô ký. Mở cửa
 * sổ in của trình duyệt (Đợt 6).
 */
export const esc = (s: string | number | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const fmtQty = (n: number) => String(Math.round(n * 10_000) / 10_000)

/** 7 kho in sẵn trên mẫu. */
const KHO_OPTIONS = ['Phôi – sơn – hàn (Phú An)', 'Dây – gỗ', 'Phụ kiện', 'Thành phẩm 1', 'Thành phẩm 2', 'Thành phẩm 3', 'Phước An']

/** Ô chọn kho: chỉ đánh dấu kho đối chiếu chắc được với mã kho hệ thống; kho khác ghi tên thật ở cuối (9 kho mới làm ở Đợt 7). */
export function khoCheckboxes(warehouseCode: string, warehouseName: string): string {
  const known = warehouseCode.startsWith('phoi-son-han') ? 0 : -1
  const boxes = KHO_OPTIONS.map((o, i) => `${i === known ? '[x]' : '[ ]'} ${esc(o)}`).join(' &nbsp;')
  return known >= 0 ? boxes : `${boxes} &nbsp;[x] ${esc(warehouseName)}`
}

export const box = (on: boolean) => (on ? '[x]' : '[ ]')

export function vnDateLine(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `Ngày ${p(d.getDate())} tháng ${p(d.getMonth() + 1)} năm ${d.getFullYear()}`
}

export interface SlipPrintInput {
  formCode: string
  title: string
  slipCode: string
  date: Date
  /** [nhãn, giá trị HTML đã escape, bắt buộc?] */
  infoRows: [string, string, boolean][]
  /** [tên cột, bắt buộc?] */
  columns: [string, boolean][]
  /** Ô đã escape. */
  rows: string[][]
  signers: string[]
}

export function openSlipPrint(p: SlipPrintInput): void {
  const minRows = 9
  const body = [...p.rows]
  while (body.length < minRows) body.push(p.columns.map(() => ''))
  const star = (on: boolean) => (on ? ' <span class="req">*</span>' : '')
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(p.slipCode)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  @media screen { body { padding: 16px 24px; } }
  body { font-family: 'Times New Roman', Times, serif; font-size: 13px; color: #111; margin: 0; }
  .top { display: flex; justify-content: space-between; }
  .co b { font-size: 14px; } .co div, .form { font-size: 11px; color: #555; }
  .form { text-align: right; }
  h1 { text-align: center; font-size: 22px; margin: 14px 0 2px; letter-spacing: .5px; }
  .date { text-align: center; color: #555; margin-bottom: 12px; }
  .info { display: grid; grid-template-columns: 200px 1fr; row-gap: 6px; margin-bottom: 10px; font-size: 14px; }
  .req { color: #c00; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: #e8edf5; font-weight: bold; padding: 5px 4px; border: 1px solid #555; }
  td { border: 1px solid #555; padding: 4px 5px; height: 22px; }
  td.n { text-align: right; } td.c { text-align: center; }
  .sign { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; margin-top: 22px; }
  .sign i { font-size: 11px; color: #555; } .sign div { min-height: 90px; }
</style></head><body>
<div class="top">
  <div class="co"><b>CÔNG TY TNHH DỊCH VỤ XUẤT NHẬP KHẨU ĐÔNG NAM Á</b><div>MST: 4101451729</div></div>
  <div class="form">${esc(p.formCode)}<br>Số phiếu: <b style="color:#111">${esc(p.slipCode)}</b></div>
</div>
<h1>${esc(p.title)}</h1>
<div class="date">${esc(vnDateLine(p.date))}</div>
<div class="info">${p.infoRows.map(([label, value, req]) => `<div>${esc(label)}${star(req)}</div><div>${value}</div>`).join('')}</div>
<table><thead><tr><th>STT</th>${p.columns.map(([c, req]) => `<th>${esc(c)}${star(req)}</th>`).join('')}</tr></thead>
<tbody>${body.map((r, i) => `<tr><td class="c">${i + 1}</td>${r.map((cell, j) => `<td${/^SL|Chênh/.test(p.columns[j][0]) ? ' class="n"' : ''}>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>
<div class="sign">${p.signers.map(s => `<div><b>${esc(s)}</b><br><i>(Ký, ghi rõ họ tên)</i></div>`).join('')}</div>
<script>window.onload = () => window.print()</script>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
}
