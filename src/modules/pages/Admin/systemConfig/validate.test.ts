import { describe, expect, it } from 'vitest'
import type { SystemConfig } from '../../../../types/admin'
import type { SpecRow } from './mcFields'
import {
  checkSpecRows, lsxPrefixError, parseNumberList, requiredFieldError, validateConfig, type McText, type ValidateInput,
} from './validate'

const base = {
  companyName: 'DNA', defaultCurrency: 'VND', solverMinLengthMm: 4000, solverMaxLengthMm: 6500, solverMaxSizesPerBarByWorkshop: { PA: 2 },
} as unknown as SystemConfig

const run = (mcText: McText, over: Partial<ValidateInput> = {}) =>
  validateConfig({ values: base, mcText, specRows: null, workshops: [{ code: 'PA' }, { code: 'TS' }], ...over })

describe('requiredFieldError', () => {
  it('thiếu tên công ty hoặc tiền tệ', () => {
    expect(requiredFieldError({ companyName: ' ', defaultCurrency: 'VND' })).toBe('Tên công ty là bắt buộc')
    expect(requiredFieldError({ companyName: 'A', defaultCurrency: '' })).toBe('Đơn vị tiền tệ là bắt buộc')
    expect(requiredFieldError({ companyName: 'A', defaultCurrency: 'VND' })).toBeNull()
  })
})

describe('lsxPrefixError / parseNumberList', () => {
  it('tiền tố 1-6 chữ cái; để trống hợp lệ', () => {
    expect(lsxPrefixError('MY, GP')).toBeNull()
    expect(lsxPrefixError('')).toBeNull()
    expect(lsxPrefixError('MY, G1')).toContain('G1')
  })
  it('tách số theo dấu cách, phẩy, chấm phẩy', () => {
    expect(parseNumberList('14 16, 18;20')).toEqual([14, 16, 18, 20])
    expect(parseNumberList('')).toEqual([])
  })
})

describe('validateConfig: ô số', () => {
  it('đổi chữ thành số, nhận dấu phẩy thập phân, làm tròn hao hụt 3 số lẻ và cont 2 số lẻ', () => {
    const r = run({ solverMaxWastePercentage: '1,23456', containerVolumeM3: '67,456', solverMaxSurplus: '7' })
    expect(r.errs).toEqual({})
    expect(r.next.solverMaxWastePercentage).toBe(1.235)
    expect(r.next.containerVolumeM3).toBe(67.46)
    expect(r.next.solverMaxSurplus).toBe(7)
  })
  it('ngoài khoảng, rỗng hoặc sai kiểu thì báo lỗi tại ô', () => {
    const r = run({ solverMaxSurplus: '2000', solverTrimStartMm: '1,5', solverMctdTrimStartMm: '' })
    expect(r.errs.solverMaxSurplus).toBe('Phải là số nguyên từ 0 đến 1000')
    expect(r.errs.solverTrimStartMm).toBe('Phải là số nguyên từ 0 đến 100')
    expect(r.errs.solverMctdTrimStartMm).toBeDefined()
  })
  it('bước dò chiều dài phải là bội 50', () => {
    expect(run({ solverLengthStepMm: '75' }).errs.solverLengthStepMm).toContain('bội 50')
    expect(run({ solverLengthStepMm: '100' }).errs).toEqual({})
  })
  it('cây ngắn nhất lớn hơn dài nhất thì báo ở ô dài nhất', () => {
    const r = run({ solverMinLengthMm: '7000' })
    expect(r.errs.solverMaxLengthMm).toContain('Cây đặt riêng ngắn nhất')
  })
  it('không sửa gì thì next giống values', () => {
    const r = run({})
    expect(r.next).toEqual(base)
    expect(r.specRowErrors).toBeNull()
  })
})

describe('validateConfig: danh sách số và xưởng', () => {
  it('cây chuẩn: bỏ trùng, sắp tăng, sai thì báo lỗi', () => {
    expect(run({ solverStockLengths: '6000 5850 6000' }).next.solverStockLengths).toEqual([5850, 6000])
    expect(run({ solverStockLengths: '60' }).errs.solverStockLengths).toBeDefined()
    expect(run({ solverStockLengths: '' }).errs.solverStockLengths).toBeDefined()
  })
  it('hệ số bó: số nguyên lớn hơn 1, tối đa 8 số', () => {
    expect(run({ solverBundleFactors: '20 14 16' }).next.solverBundleFactors).toEqual([14, 16, 20])
    expect(run({ solverBundleFactors: '1 2' }).errs.solverBundleFactors).toBeDefined()
    expect(run({ solverBundleFactors: '2 3 4 5 6 7 8 9 10' }).errs.solverBundleFactors).toBeDefined()
  })
  it('số cỡ đoạn theo xưởng: để trống = bỏ luật, sai thì báo, khoá xưởng khác giữ nguyên', () => {
    const r = run({ 'wsSizes:PA': '', 'wsSizes:TS': '3' })
    expect(r.errs).toEqual({})
    expect(r.next.solverMaxSizesPerBarByWorkshop).toEqual({ TS: 3 })
    expect(run({ 'wsSizes:TS': '11' }).errs['wsSizes:TS']).toContain('từ 1 đến 10')
    expect(run({ 'wsSizes:TS': '4' }).next.solverMaxSizesPerBarByWorkshop).toEqual({ PA: 2, TS: 4 })
  })
})

describe('bảng số cây/bó theo quy cách', () => {
  const row = (key: number, code: string, factors: string): SpecRow => ({ key, code, factors })
  it('chuẩn hoá mã, sắp số, bỏ dòng trống hẳn', () => {
    const { map, rowErrs } = checkSpecRows([row(1, ' v 20 ', '64 60'), row(2, '', ''), row(3, 'h13-26', '60,64')])
    expect(rowErrs).toEqual({})
    expect(map).toEqual({ V20: [60, 64], 'H13-26': [60, 64] })
  })
  it('báo lỗi từng dòng: mã sai, trùng mã, số sai, số trùng', () => {
    const { rowErrs } = checkSpecRows([
      row(1, 'X1', '60'), row(2, 'V20', '60 64'), row(3, 'v20', '60'), row(4, 'FI19', '1'), row(5, 'FI10', '60 60'),
    ])
    expect(rowErrs[1]).toContain('Mã quy cách phải dạng')
    expect(rowErrs[2]).toBeUndefined()
    expect(rowErrs[3]).toBe('Mã V20 bị trùng')
    expect(rowErrs[4]).toContain('Gồm 1 đến 12 số nguyên từ 2 đến 500')
    expect(rowErrs[5]).toBe('Các số cây/bó không được trùng nhau')
  })
  it('có dòng sai thì lỗi chung ở ô bảng và không ghi vào next', () => {
    const r = run({}, { specRows: [row(1, 'X1', '60')] })
    expect(r.errs.solverBundleFactorsBySpec).toContain('xem thông báo dưới từng dòng')
    expect(r.specRowErrors?.[1]).toBeDefined()
    expect(r.next.solverBundleFactorsBySpec).toBeUndefined()
  })
  it('bảng hợp lệ thì ghi vào next', () => {
    const r = run({}, { specRows: [row(1, 'V20', '64 60')] })
    expect(r.errs).toEqual({})
    expect(r.next.solverBundleFactorsBySpec).toEqual({ V20: [60, 64] })
  })
})
