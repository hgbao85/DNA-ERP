import type { WarehouseTransfer } from '../../../types/warehouse-transfer'
import { box, esc, fmtQty, khoCheckboxes, openSlipPrint } from './slipPrintTemplate'

/**
 * In PHIẾU CHUYỂN KHO theo Mẫu 02-VT (bổ sung IEA) - 09/11/2026, v8 4.1/4.2/4.8: số CK-<mã kho giao>-NNN, ô "Chuyển kho: <kho
 * nhận>". Kho giao in, người nhận ký; kho nhận ghi số thực nhận và chụp phiếu đã ký khi xác nhận nhận hàng. Phiếu đã nhận thiếu
 * in lại thì cột Ghi chú ghi "Thực nhận ...".
 */
export function printTransferSlip(t: WarehouseTransfer, target?: Window | null): void {
  const xuatCho = [
    `${box(false)} Điểm đan: ..................`,
    `${box(false)} Tổ hàn`,
    `${box(false)} Tổ phôi`,
    `${box(false)} Sơn`,
    `${box(false)} Chuyền kiểm / đóng gói`,
    `${box(true)} Chuyển kho: <b>${esc(t.toWarehouseName)}</b>`,
    `${box(false)} Khác: ..........`,
  ].join(' &nbsp;')
  const lenhs = new Map<string, Set<string>>()
  for (const l of t.pieceItems) {
    const key = l.lenhCode ?? l.salesOrderCode ?? l.poNumber
    const set = lenhs.get(key) ?? new Set<string>()
    if (l.sku) set.add(l.sku)
    lenhs.set(key, set)
  }
  const lenhLine = lenhs.size > 0
    ? [...lenhs].map(([lenh, skus]) => `LSX <b>${esc(lenh)}</b>${skus.size > 0 ? ` &nbsp;Mã hàng: <b>${esc([...skus].join(', '))}</b>` : ''}`).join(' &nbsp;·&nbsp; ')
    : t.productionInvoiceId
      ? `LSX <b>${esc(t.lenhCode ?? '')}</b> (hàng của lệnh đổi xưởng)`
      : 'DÙNG CHUNG (chuyển kho ngoài đơn hàng)'
  const shortNote = (sent: number | null | undefined, received: number) =>
    t.status === 'CONFIRMED' && sent != null && sent > received ? `Thực nhận ${fmtQty(received)}` : ''
  const sentOf = (sent: number | null | undefined, q: number) => (sent ?? q)

  openSlipPrint({
    formCode: 'Mẫu 02-VT (bổ sung IEA)',
    title: 'PHIẾU XUẤT KHO – CHUYỂN KHO',
    slipCode: t.code,
    date: new Date(t.createdAt),
    infoRows: [
      ['Kho xuất', khoCheckboxes(t.fromWarehouseCode, t.fromWarehouseName), true],
      ['Xuất cho', xuatCho, true],
      ['Người nhận hàng', `.......................................................... &nbsp;Bộ phận: <b>${esc(t.toWarehouseName)}</b>`, true],
      ['Lệnh sản xuất – mã hàng', lenhLine, true],
      ...(t.note ? [['Ghi chú phiếu', esc(t.note), false] as [string, string, boolean]] : []),
    ],
    columns: [['Mã vật tư', false], ['Tên vật tư (đúng tên file tồn)', true], ['Quy cách', false], ['ĐVT', true], ['SL yêu cầu', false], ['SL thực xuất', true], ['LSX', true], ['Mã hàng', false], ['Ghi chú', false]],
    rows: [
      ...t.items.map(l => [
        esc(l.materialCode ?? ''),
        esc(l.materialName),
        esc([l.materialSpec ?? '', l.stockLengthMm ? `Cây ${l.stockLengthMm}mm` : ''].filter(Boolean).join(' · ')),
        esc(l.unit),
        fmtQty(sentOf(l.sentQty, l.quantity)),
        fmtQty(sentOf(l.sentQty, l.quantity)),
        t.productionInvoiceId ? esc(t.lenhCode ?? 'Hàng của lệnh') : 'DÙNG CHUNG',
        '',
        esc([shortNote(l.sentQty, l.quantity), l.note].filter(Boolean).join(' - ')),
      ]),
      ...t.pieceItems.map(l => [
        esc(l.pieceCode),
        esc(l.pieceName),
        '',
        'mảnh',
        fmtQty(sentOf(l.sentQty, l.quantity)),
        fmtQty(sentOf(l.sentQty, l.quantity)),
        esc(l.lenhCode ?? l.salesOrderCode ?? l.poNumber),
        esc(l.sku ?? ''),
        esc([shortNote(l.sentQty, l.quantity), l.note].filter(Boolean).join(' - ')),
      ]),
    ],
    signers: ['Người lập phiếu', 'Người nhận hàng', 'Thủ kho', 'Duyệt'],
  }, target)
}
