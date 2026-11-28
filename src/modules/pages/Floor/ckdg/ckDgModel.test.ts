import { describe, expect, it } from 'vitest'
import type { CkBatch, DgReport } from '../../../../services/ck-dg-api'
import {
  batchKcsText, batchReportText, cancelReasonOk, ckReportCheck, isCkBatch, isCkDgRole, kcsDefaults, kcsExtraDefect,
  kcsGradeCheck, kcsSetPassed, matchesQuery, monitorTotals, packingCheck, reconcileTotals, toQty,
} from './ckDgModel'

const batch = (over: Partial<CkBatch> = {}): CkBatch => ({
  id: '1', status: 'AWAITING_KCS', itemId: '10', productionInvoiceId: '5', piCode: 'PI-1', lenhCode: 'LSX-1', sku: 'GHE-1',
  productName: 'Ghế', pieceId: '7', pieceName: 'Mảnh tay', workstationCode: 'CK-01', warehouseCode: 'thanh-pham',
  warehouseName: 'Kho TP', reportedById: 'u', reportedByName: 'Nguyễn An', reportedAt: '2026-11-24T08:00:00Z',
  passedQty: 8, defectQty: 2, defectReasonId: '3', defectReason: 'Trầy', photoUrls: ['https://x/a.jpg'], note: null, kcs: null,
  ...over,
})

const report = (over: Partial<DgReport> = {}): DgReport => ({
  id: '1', itemId: '10', productionInvoiceId: '5', piCode: 'PI-1', lenhCode: 'LSX-1', sku: 'GHE-1', productName: 'Ghế', qty: 3,
  note: null, workstationCode: 'DG-01', warehouseCode: null, warehouseName: null, reportedById: 'u', reportedByName: 'Bình',
  reportedAt: '2026-11-24T08:00:00Z', cancelled: false, cancelledAt: null, cancelledByName: null, cancelReason: null, ...over,
})

describe('ckDgModel', () => {
  it('isCkDgRole / toQty', () => {
    expect(isCkDgRole('CHUYEN_KIEM')).toBe(true)
    expect(isCkDgRole('KCS_CHUYEN_KIEM')).toBe(true)
    expect(isCkDgRole('HAN')).toBe(false)
    expect(isCkDgRole(null)).toBe(false)
    expect(toQty('')).toBe(0)
    expect(toQty('12a')).toBe(12)
  })

  describe('ckReportCheck (C1, C3)', () => {
    const base = { pieceChosen: true, passed: 3, defect: 0, reasonId: null, photoCount: 0, available: 5 }
    it('hợp lệ', () => expect(ckReportCheck(base)).toEqual({ ok: true, reason: null }))
    it('chưa chọn mảnh / số 0', () => {
      expect(ckReportCheck({ ...base, pieceChosen: false }).reason).toBe('Chọn mảnh trước')
      expect(ckReportCheck({ ...base, passed: 0 }).reason).toBe('Nhập số đạt hoặc số lỗi')
    })
    it('vượt còn kiểm được', () => {
      expect(ckReportCheck({ ...base, passed: 4, defect: 2 }).reason).toMatch(/vượt số còn kiểm được \(5\)/)
      expect(ckReportCheck({ ...base, available: 0 }).reason).toMatch(/chưa còn hàng/)
    })
    it('có lỗi: bắt buộc nguyên nhân + ảnh', () => {
      expect(ckReportCheck({ ...base, defect: 1 }).reason).toMatch(/nguyên nhân/)
      expect(ckReportCheck({ ...base, defect: 1, reasonId: '3' }).reason).toMatch(/ảnh/)
      expect(ckReportCheck({ ...base, defect: 1, reasonId: '3', photoCount: 1 }).ok).toBe(true)
    })
    it('đang lưu khoá nút', () => expect(ckReportCheck({ ...base, busy: true }).ok).toBe(false))
  })

  describe('packingCheck (D1, D2)', () => {
    it('chặn theo số còn đóng được', () => {
      expect(packingCheck({ itemChosen: true, qty: 2, available: 2 }).ok).toBe(true)
      expect(packingCheck({ itemChosen: true, qty: 3, available: 2 }).reason).toMatch(/\(2\)/)
      expect(packingCheck({ itemChosen: true, qty: 1, available: 0 }).reason).toMatch(/qua KCS chuyền kiểm/)
      expect(packingCheck({ itemChosen: false, qty: 1, available: 5 }).reason).toBe('Chọn lệnh trước')
      expect(packingCheck({ itemChosen: true, qty: 0, available: 5 }).reason).toMatch(/Nhập số/)
    })
  })

  describe('KCS chuyền kiểm (C2)', () => {
    const b = batch()
    it('mặc định tin số báo', () => {
      expect(kcsDefaults(b)).toEqual({ passed: 8, rework: 2, scrap: 0 })
      expect(kcsGradeCheck(b, kcsDefaults(b), null).ok).toBe(true)
    })
    it('hạ số đạt: lỗi dồn sang làm lại, cần nguyên nhân', () => {
      const g = kcsSetPassed(b, kcsDefaults(b), 6)
      expect(g).toEqual({ passed: 6, rework: 4, scrap: 0 })
      expect(kcsExtraDefect(b, 6)).toBe(2)
      expect(kcsGradeCheck(b, g, null).reason).toMatch(/nguyên nhân/)
      expect(kcsGradeCheck(b, g, '3').ok).toBe(true)
    })
    it('đạt không vượt số báo đạt (kẹp lại)', () => {
      expect(kcsSetPassed(b, kcsDefaults(b), 99).passed).toBe(8)
      expect(kcsGradeCheck(b, { passed: 9, rework: 1, scrap: 0 }, '3').reason).toMatch(/không quá/)
    })
    it('câu 9a (25/11): không còn chấm bỏ - lỗi đều là làm lại; tổng phải khớp', () => {
      expect(kcsGradeCheck(b, { passed: 8, rework: 1, scrap: 1 }, null).reason).toMatch(/Không còn chấm/)
      expect(kcsGradeCheck(b, { passed: 8, rework: 0, scrap: 0 }, null).reason).toMatch(/phải bằng 10/)
      // Đợt mở từ dữ liệu cũ có bỏ: đổi đạt thì bỏ về 0, dồn hết sang làm lại.
      expect(kcsSetPassed(b, { passed: 8, rework: 1, scrap: 1 }, 5)).toEqual({ passed: 5, rework: 5, scrap: 0 })
    })
  })

  it('chữ hiển thị đợt', () => {
    expect(batchReportText(batch())).toBe('Báo đạt 8 · lỗi 2 (Trầy)')
    expect(batchReportText(batch({ defectQty: 0 }))).toBe('Báo đạt 8')
    expect(batchKcsText(batch())).toBe('Chờ KCS chuyền kiểm')
    const done = batch({
      status: 'KCS_DONE',
      kcs: { passedQty: 7, reworkQty: 2, scrapQty: 1, defectReason: null, photoUrl: null, note: null, reviewedByName: 'K', reviewedAt: null, transferCheckResultId: '9' },
    })
    expect(batchKcsText(done)).toBe('KCS: đạt 7 · làm lại 2 · bỏ 1')
    expect(monitorTotals([batch(), done])).toEqual({ awaiting: 1, awaitingQty: 10, passed: 7, rework: 2, scrap: 1 })
  })

  it('đối chiếu đóng gói + lý do huỷ', () => {
    expect(reconcileTotals([report(), report({ id: '2', qty: 2, cancelled: true })])).toEqual({
      active: 1, activeQty: 3, cancelled: 1, cancelledQty: 2,
    })
    expect(cancelReasonOk('  ab ')).toBe(false)
    expect(cancelReasonOk('đếm nhầm')).toBe(true)
  })

  it('phân loại lần báo + lọc chữ', () => {
    expect(isCkBatch(batch())).toBe(true)
    expect(isCkBatch(report())).toBe(false)
    expect(matchesQuery(batch(), 'tay')).toBe(true)
    expect(matchesQuery(batch(), 'lsx-1')).toBe(true)
    expect(matchesQuery(report(), 'zzz')).toBe(false)
    expect(matchesQuery(report(), ' ')).toBe(true)
  })
})
