import { box, esc, fmtQty, khoCheckboxes, openSlipPrint } from '../InboundWarehouse/slipPrintTemplate'

/**
 * In PHIẾU NHẬP KHO theo Mẫu 01-VT (bổ sung IEA) - Đợt 6. 1 lần nhận = 1 dòng vật tư; đơn gộp nhiều lệnh thì cột LSX ghi từng lệnh
 * và số chia cho lệnh đó. SL theo phiếu giao phải bằng SL thực nhận (hệ thống chặn lệch), nên Chênh lệch luôn trống.
 */
export interface ReceiptSlipPrint {
  code: string
  warehouseCode: string
  warehouseName: string
  supplierName: string
  orderCode: string
  materialCode: string
  materialName: string
  spec: string
  unit: string
  isSteel: boolean
  deliveredQty: number
  receivedQty: number
  parts: { lenhCode: string; qty: number }[]
}

export function printReceiptSlip(p: ReceiptSlipPrint): void {
  const lsx = p.parts.filter(x => x.qty > 0).map(x => (p.parts.length > 1 ? `${esc(x.lenhCode)}: ${fmtQty(x.qty)}` : esc(x.lenhCode))).join('<br>')
  openSlipPrint({
    formCode: 'Mẫu 01-VT (bổ sung IEA)',
    title: 'PHIẾU NHẬP KHO',
    slipCode: p.code,
    date: new Date(),
    infoRows: [
      ['Kho nhận', khoCheckboxes(p.warehouseCode, p.warehouseName), true],
      ['Nhà cung cấp', `<b>${esc(p.supplierName || '..........................................................')}</b> &nbsp;MST: ....................`, true],
      ['Số đơn đặt hàng', `<b>${esc(p.orderCode || '....................')}</b> &nbsp;Số phiếu giao hàng NCC: .................... &nbsp;Phiếu cân xe (sắt): ${box(p.isSteel)} Có`, true],
      ['Người giao hàng', '.......................................................... &nbsp;Biển số xe: ....................', false],
    ],
    columns: [['Mã vật tư', false], ['Tên vật tư (đúng tên file tồn)', true], ['Quy cách', false], ['ĐVT', true], ['SL theo phiếu giao', true], ['SL thực nhận', true], ['Chênh lệch', false], ['LSX (nếu có)', false], ['Ghi chú', false]],
    rows: [[
      esc(p.materialCode),
      esc(p.materialName),
      esc(p.spec),
      esc(p.unit),
      fmtQty(p.deliveredQty),
      fmtQty(p.receivedQty),
      '',
      lsx,
      p.deliveredQty !== p.receivedQty ? 'Có quy đổi đơn vị' : '',
    ]],
    signers: ['Người giao hàng', 'QC kiểm tra', 'Thủ kho', 'Người lập phiếu'],
  })
}
