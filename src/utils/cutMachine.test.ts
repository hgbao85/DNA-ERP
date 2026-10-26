import { describe, expect, it } from 'vitest';
import { fmtBundles, fmtBundleSummary, fmtPercent, lineMachine, linesMachine, machineLabel } from './cutMachine';

describe('fmtBundles - cách cắt theo bó của một kiểu cắt', () => {
  it('sắp hệ số giảm dần, thêm cây cắt tay', () => {
    expect(fmtBundles({ '14': 2, '16': 12, '1': 5 })).toBe('16 cây × 12 bó + 14 cây × 2 bó + 5 cây cắt tay');
  });
  it('bỏ hệ số 0 bó và cắt tay bằng 0', () => {
    expect(fmtBundles({ '14': 0, '20': 3, '1': 0 })).toBe('20 cây × 3 bó');
  });
  it('chỉ cắt tay', () => {
    expect(fmtBundles({ '1': 4 })).toBe('4 cây cắt tay');
  });
  it('màn Phôi ghi "bó cây"', () => {
    expect(fmtBundles({ '16': 12, '1': 5 }, 'bó cây')).toBe('16 cây × 12 bó cây + 5 cây cắt tay');
  });
  it('không có bundles hoặc rỗng -> null (hiện như cũ)', () => {
    expect(fmtBundles(null)).toBeNull();
    expect(fmtBundles(undefined)).toBeNull();
    expect(fmtBundles({})).toBeNull();
    expect(fmtBundles({ '16': 0 })).toBeNull();
  });
});

describe('fmtBundleSummary / machineLabel', () => {
  it('x bó + y cây cắt tay = z lần cắt', () => {
    expect(fmtBundleSummary({ factors: [14, 16], totalBundles: 12, manualBars: 5, totalCuts: 17, maxSizesPerPattern: 5 }))
      .toBe('12 bó + 5 cây cắt tay = 17 lần cắt');
    expect(fmtBundleSummary(null)).toBeNull();
    // Không cắt tay thì bỏ vế "+ 0 cây cắt tay"
    expect(fmtBundleSummary({ factors: [16], totalBundles: 12, manualBars: 0, totalCuts: 12, maxSizesPerPattern: 5 }))
      .toBe('12 bó = 12 lần cắt');
    // Không có bó nào: bỏ vế "0 bó +"
    expect(fmtBundleSummary({ factors: [16], totalBundles: 0, manualBars: 5, totalCuts: 5, maxSizesPerPattern: 5 }))
      .toBe('5 cây cắt tay = 5 lần cắt');
  });
  it('nhãn máy', () => {
    expect(machineLabel('laser')).toBe('MC Laser');
    expect(machineLabel('tu_dong')).toBe('MC Tự động');
    expect(machineLabel(null)).toBeNull();
  });
});

describe('lineMachine / linesMachine - dòng khả thi chưa ghi máy = MC Laser', () => {
  it('quy tắc máy của dòng', () => {
    expect(lineMachine({ machine: 'tu_dong', feasible: true })).toBe('tu_dong');
    expect(lineMachine({ feasible: true })).toBe('laser');
    expect(lineMachine({ machine: null, feasible: true })).toBe('laser');
    expect(lineMachine({ feasible: false })).toBeNull();
  });
  it('máy của cả phương án', () => {
    expect(linesMachine([{ feasible: false }, { feasible: true }])).toBe('laser');
    expect(linesMachine([{ feasible: false }])).toBeNull();
    expect(linesMachine(undefined)).toBeNull();
  });
});

describe('fmtPercent - dấu phẩy thập phân', () => {
  it('0,27 và 12,50', () => {
    expect(fmtPercent(0.274)).toBe('0,27');
    expect(fmtPercent('12.5')).toBe('12,50');
  });
});
