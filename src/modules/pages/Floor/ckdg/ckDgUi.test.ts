import { describe, expect, it } from 'vitest'
import type { BeWorkstation } from '../../../../services/floor-api'
import { countNonCutUnassigned, KIND_LABEL, kindWithMachine, STAGE_LABEL } from '../qlsxUi'
import { kindCaption } from '../qrPrint'

/** 24/11/2026 (CK_DG_QR): nhãn / tem / cảnh báo xưởng cho điểm chuyền kiểm / khu đóng gói của kho Thành phẩm. */
const ws = (o: Partial<BeWorkstation>): BeWorkstation => ({
  id: '1', code: 'CK-01', name: 'x', stage: 'CHUYEN_KIEM', kind: 'TRANSFER_CHECK', processStep: null, qrToken: 't', isActive: true,
  createdAt: '2026-11-24', cutMachineType: null, workshopId: null, workshopName: null, warehouseId: '9', warehouseName: 'Kho TP', ...o,
})

describe('điểm chuyền kiểm / khu đóng gói (QLSX "Máy & tem QR")', () => {
  it('nhãn tổ + loại điểm', () => {
    expect(STAGE_LABEL.CHUYEN_KIEM).toBe('Chuyền kiểm')
    expect(STAGE_LABEL.DONG_GOI).toBe('Đóng gói')
    expect(STAGE_LABEL.KCS_CHUYEN_KIEM).toBe('KCS chuyền kiểm')
    expect(KIND_LABEL.TRANSFER_CHECK).toBe('Điểm chuyền kiểm')
    expect(kindWithMachine(ws({ kind: 'PACKING', stage: 'DONG_GOI' }))).toBe('Khu đóng gói')
  })
  it('chữ trên tem', () => {
    expect(kindCaption(ws({}))).toBe('BÁO CHUYỀN KIỂM')
    expect(kindCaption(ws({ kind: 'PACKING' }))).toBe('BÁO ĐÓNG GÓI')
  })
  it('không cảnh báo "chưa gán xưởng" cho điểm của kho Thành phẩm', () => {
    expect(countNonCutUnassigned([ws({}), ws({ kind: 'PACKING', stage: 'DONG_GOI' })])).toBe(0)
    expect(countNonCutUnassigned([ws({ kind: 'PIECE', stage: 'HAN' })])).toBe(1)
  })
})
