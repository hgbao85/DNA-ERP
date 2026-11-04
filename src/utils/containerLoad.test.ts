import { describe, expect, it } from 'vitest'
import { computeContainerLoad, contEquivalent, fmtCont, fmtM3, type ContainerLoadInput } from './containerLoad'

const input = (l: number | null, w: number | null, h: number | null, boxesPerSet = 1, loadContManual: number | null = null): ContainerLoadInput => ({
  boxLengthCm: l, boxWidthCm: w, boxHeightCm: h, boxesPerSet, loadContManual,
})

describe('computeContainerLoad - bộ ví dụ dùng chung với BE', () => {
  const cases: Array<[string, number, number, number, number, number, number | null, number]> = [
    // [tên, dài, rộng, cao, số thùng/bộ, m³ cont, thể tích thùng mong đợi, load cont mong đợi]
    ['J55 thùng 90x75x125', 90, 75, 125, 1, 68, 0.8438, 80],
    ['85x80x100 (không bị lỗi số thực 99,999)', 85, 80, 100, 1, 68, 0.68, 100],
    ['50x40x85', 50, 40, 85, 1, 68, 0.17, 400],
    ['J55 bộ 2 thùng', 90, 75, 125, 2, 68, 0.8438, 40],
    ['kích thước lẻ 60,5x40,2x30,1', 60.5, 40.2, 30.1, 1, 68, 0.0732, 928],
    ['thùng 200x200x200', 200, 200, 200, 1, 68, 8, 8],
    ['thùng lớn hơn cont', 500, 500, 500, 1, 68, 125, 0],
  ]
  it.each(cases)('%s', (_name, l, w, h, n, cont, vol, load) => {
    const r = computeContainerLoad(input(l, w, h, n), cont)
    expect(r.boxVolumeM3).toBe(vol)
    expect(r.loadContFormula).toBe(load)
    expect(r.loadCont).toBe(load)
    expect(r.source).toBe('FORMULA')
  })

  it('số nhập tay thắng công thức nhưng công thức vẫn được tính', () => {
    const r = computeContainerLoad(input(90, 75, 125, 1, 75), 68)
    expect(r.loadCont).toBe(75)
    expect(r.source).toBe('MANUAL')
    expect(r.loadContFormula).toBe(80)
  })

  it('có số nhập tay mà chưa có kích thước thì vẫn dùng số nhập tay', () => {
    const r = computeContainerLoad(input(null, null, null, 1, 60), 68)
    expect(r.loadCont).toBe(60)
    expect(r.source).toBe('MANUAL')
    expect(r.loadContFormula).toBeNull()
  })

  it('thiếu một kích thước và không nhập tay thì chưa tính được', () => {
    const r = computeContainerLoad(input(90, 75, null), 68)
    expect(r.boxVolumeM3).toBeNull()
    expect(r.loadContFormula).toBeNull()
    expect(r.loadCont).toBeNull()
    expect(r.source).toBeNull()
  })

  it('thể tích cont 67,5 m³', () => {
    expect(computeContainerLoad(input(90, 75, 125), 67.5).loadCont).toBe(80)
    expect(computeContainerLoad(input(85, 80, 100), 67.5).loadCont).toBe(99)
  })
})

describe('contEquivalent / định dạng', () => {
  it('cont tương đương = số bộ ÷ load cont', () => {
    expect(contEquivalent(200, 80)).toBe(2.5)
    expect(contEquivalent(200, null)).toBeNull()
    expect(contEquivalent(200, 0)).toBeNull()
  })

  it('fmtCont dùng dấu phẩy, 1 số lẻ', () => {
    expect(fmtCont(2.5)).toBe('2,5')
    expect(fmtCont(3)).toBe('3')
  })

  it('fmtM3 dùng dấu phẩy, tối đa 4 số lẻ', () => {
    expect(fmtM3(0.8438)).toBe('0,8438')
  })
})
