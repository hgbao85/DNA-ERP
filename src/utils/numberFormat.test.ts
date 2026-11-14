import { describe, expect, it } from 'vitest';
import { fmtBars, fmtMm, fmtNum, fmtPct, fmtPercent } from './numberFormat';

describe('numberFormat - ghi số kiểu Việt dùng chung', () => {
  it('fmtNum: dấu chấm ngăn nghìn, dấu phẩy thập phân, không ICU', () => {
    expect(fmtNum(5030)).toBe('5.030');
    expect(fmtNum(6000)).toBe('6.000');
    expect(fmtNum(427.5)).toBe('427,5');
    expect(fmtNum(1234567)).toBe('1.234.567');
    expect(fmtNum(-1200)).toBe('-1.200');
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum('5850')).toBe('5.850');
  });

  it('fmtNum: số lẻ cố định và làm tròn', () => {
    expect(fmtNum(0.3, 2)).toBe('0,30');
    expect(fmtNum(16.746, 2)).toBe('16,75');
    expect(fmtNum(2.5, 0)).toBe('3');
    expect(fmtNum(1.23456)).toBe('1,235');
    expect(fmtNum(-0.001, 2)).toBe('0,00');
  });

  it('thiếu số -> "—"', () => {
    expect(fmtNum(null)).toBe('—');
    expect(fmtNum(undefined)).toBe('—');
    expect(fmtNum('')).toBe('—');
    expect(fmtNum('abc')).toBe('—');
    expect(fmtMm(null)).toBe('—');
    expect(fmtBars(undefined)).toBe('—');
    expect(fmtPct(null)).toBe('—');
  });

  it('fmtMm / fmtBars', () => {
    expect(fmtMm(5030)).toBe('5.030 mm');
    expect(fmtMm(2.5)).toBe('2,5 mm');
    expect(fmtBars(6)).toBe('6 cây');
    expect(fmtBars(1200)).toBe('1.200 cây');
  });

  it('fmtPercent / fmtPct giữ cách cũ (vi-VN)', () => {
    expect(fmtPercent(0.38)).toBe('0,38');
    expect(fmtPct(0.38)).toBe('0,38%');
    expect(fmtPct(1, 0)).toBe('1%');
    expect(fmtPct(16.75)).toBe('16,75%');
  });
});
