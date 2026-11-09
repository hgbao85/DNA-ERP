import type { IssueSlip } from '../../../services/issue-slips-api'
import { box, esc, fmtQty, khoCheckboxes, openSlipPrint } from './slipPrintTemplate'

/**
 * In PHIẾU XUẤT KHO theo Mẫu 02-VT (bổ sung IEA) - Đợt 6. Mỗi dòng ghi LSX + mã hàng; dòng dùng chung ghi "DÙNG CHUNG" (quy định
 * trang 1 của mẫu). SL yêu cầu = SL thực xuất: hệ thống chỉ xuất đúng số trên phiếu.
 */
export function printIssueSlip(slip: IssueSlip): void {
  const kinds = new Set(slip.lines.map(l => (l.kind === 'CONSUMABLE' ? `C-${l.stage}` : l.kind)))
  const xuatCho = [
    `${box(!!slip.weavingPointName)} Điểm đan: ${slip.weavingPointName ? `<b>${esc(slip.weavingPointName)}</b>` : '..................'}`,
    `${box(kinds.has('C-HAN'))} Tổ hàn`,
    `${box(kinds.has('STEEL') || kinds.has('MATERIAL_YIELD') || kinds.has('MATERIAL_YIELD_RECIPE'))} Tổ phôi`,
    `${box(kinds.has('C-SON'))} Sơn`,
    `${box(kinds.has('PACKAGING'))} Chuyền kiểm / đóng gói`,
    `${box(false)} Chuyển kho: ..................`,
    `${box(kinds.has('SHARED'))} Khác: ${kinds.has('SHARED') ? 'Dùng chung' : '..........'}`,
  ].join(' &nbsp;')
  // Mỗi lệnh 1 lần, kèm các mã hàng (SKU) của lệnh đó trên phiếu.
  const skusByLenh = new Map<string, Set<string>>()
  for (const l of slip.lines) {
    if (!l.lenhCode) continue
    const set = skusByLenh.get(l.lenhCode) ?? new Set<string>()
    if (l.sku) set.add(l.sku)
    skusByLenh.set(l.lenhCode, set)
  }
  const lenhLine = skusByLenh.size > 0
    ? [...skusByLenh].map(([lenh, skus]) => `LSX <b>${esc(lenh)}</b>${skus.size > 0 ? ` &nbsp;Mã hàng: <b>${esc([...skus].join(', '))}</b>` : ''}`).join(' &nbsp;·&nbsp; ')
      + (slip.lines.some(l => l.kind === 'SHARED') ? ' &nbsp;·&nbsp; DÙNG CHUNG' : '')
    : 'DÙNG CHUNG'
  openSlipPrint({
    formCode: 'Mẫu 02-VT (bổ sung IEA)',
    title: 'PHIẾU XUẤT KHO',
    slipCode: slip.code,
    date: new Date(slip.createdAt),
    infoRows: [
      ['Kho xuất', khoCheckboxes(slip.warehouseCode, slip.warehouseName), true],
      ['Xuất cho', xuatCho, true],
      ['Người nhận hàng', `${esc(slip.recipientName ?? '..........................................................')} &nbsp;Bộ phận: ....................`, true],
      ['Lệnh sản xuất – mã hàng', lenhLine, true],
      ...(slip.pairedSlipCode ? [['Đi cùng phiếu', `Phiếu xuất mảnh <b>${esc(slip.pairedSlipCode)}</b> (cùng chuyến)`, false] as [string, string, boolean]] : []),
    ],
    columns: [['Mã vật tư', false], ['Tên vật tư (đúng tên file tồn)', true], ['Quy cách', false], ['ĐVT', true], ['SL yêu cầu', false], ['SL thực xuất', true], ['LSX', true], ['Mã hàng', false], ['Ghi chú', false]],
    rows: slip.lines.map(l => [
      esc(l.materialCode),
      esc(l.materialName),
      l.barLengthMm ? `Cây ${l.barLengthMm}mm` : '',
      esc(l.unit),
      fmtQty(l.qty),
      fmtQty(l.qty),
      l.kind === 'SHARED' ? 'DÙNG CHUNG' : esc(l.lenhCode),
      esc(l.sku),
      esc([
        l.kind === 'CONSUMABLE' ? (l.stage === 'HAN' ? 'Tổ hàn' : 'Tổ sơn') : '',
        l.kind === 'WEAVING_PIECE' ? 'Mảnh đi đan' : l.kind === 'WEAVING_MATERIAL' ? `Kèm mảnh ${l.pieceName ?? ''}`.trim() : '',
        l.kind === 'PACKAGING' ? 'Đóng gói' : l.kind === 'MATERIAL_YIELD' || l.kind === 'MATERIAL_YIELD_RECIPE' ? 'Tổ phôi (vật tư TP)' : '',
        l.note,
      ].filter(Boolean).join(' - ')),
    ]),
    signers: ['Người lập phiếu', 'Người nhận hàng', 'Thủ kho', 'Duyệt'],
  })
}
