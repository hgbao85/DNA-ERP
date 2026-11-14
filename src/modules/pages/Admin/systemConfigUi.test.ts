import { describe, expect, it } from 'vitest'
import { describeSpecCode, summarizeBundle } from './systemConfigUi'

describe('describeSpecCode', () => {
  it('giải nghĩa ba dạng mã', () => {
    expect(describeSpecCode('FI10')).toBe('Phi 10')
    expect(describeSpecCode('H13-26')).toBe('Hộp 13×26')
    expect(describeSpecCode('V15')).toBe('Vuông 15')
  })
  it('chịu chữ thường và khoảng trắng', () => {
    expect(describeSpecCode(' fi 19 ')).toBe('Phi 19')
    expect(describeSpecCode('h20-40')).toBe('Hộp 20×40')
  })
  it('mã sai dạng thì không hiện', () => {
    for (const bad of ['', 'X10', 'V', 'H13', 'H13-', 'FI', 'V1.5', 'V15A', 'HH13-26']) {
      expect(describeSpecCode(bad)).toBeNull()
    }
  })
})

describe('summarizeBundle', () => {
  it('bảng có dòng thì ghi theo quy cách', () => {
    expect(summarizeBundle([14, 16, 18, 20], 14)).toBe('Bó theo 14 quy cách')
  })
  it('bảng rỗng thì theo hệ số chung', () => {
    expect(summarizeBundle([14, 16, 18, 20], 0)).toBe('Bó 14–20 cây')
    expect(summarizeBundle([16], 0)).toBe('Bó 16 cây')
    expect(summarizeBundle([], 0)).toBe('')
  })
})
