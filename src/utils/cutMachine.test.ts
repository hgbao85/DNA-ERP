import { describe, expect, it } from 'vitest';
import {
  fmtBundles, fmtBundleSummary, fmtPercent, groupHint, lineMachine, linesMachine, machineClassSummaryText, machineClassTotals, machineLabel,
  patternGroupColors, patternGroupLabel, patternMachineText, punchedSegmentsText,
} from './cutMachine';
import type { CuttingPatternMachineGroup } from '../services/cutting-proposals-api';

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

describe('Lớp máy của nhóm cây (13/11/2026)', () => {
  const punched = (over: Partial<CuttingPatternMachineGroup['punchedSegments'][number]> = {}) =>
    ({ cutLengthMm: 425, countPerBar: 2, ...over });
  const grp = (machineClass: CuttingPatternMachineGroup['machineClass'], bars = 10, segs = [punched()]): CuttingPatternMachineGroup =>
    ({ bars, machineClass, punchedSegments: machineClass === 'TU_DONG' ? [] : segs });

  it('nhãn theo lớp và theo việc xưởng có laze hay không', () => {
    expect(patternGroupLabel(grp('TU_DONG'), true)).toBe('MC Tự động');
    expect(patternGroupLabel(grp('LASER'), true)).toBe('MC Laser');
    expect(patternGroupLabel(grp('LASER'), false)).toBe('MC Tự động · lỗ làm tay');
    expect(patternGroupLabel(grp('TU_DONG'), false)).toBe('MC Tự động');
  });

  it('câu đoạn dập: nhiều chiều dài, kiểu Việt, không có đoạn dập', () => {
    expect(punchedSegmentsText(grp('LASER'))).toBe('đoạn dập 425 mm × 2');
    expect(punchedSegmentsText(grp('LASER', 5, [punched(), punched({ cutLengthMm: 300, countPerBar: 1 })])))
      .toBe('đoạn dập 425 mm × 2; đoạn dập 300 mm × 1');
    // Chiều dài ghi kiểu Việt như màn Tối ưu cắt sắt: ngăn nghìn bằng dấu chấm, thập phân bằng dấu phẩy.
    expect(punchedSegmentsText(grp('LASER', 5, [punched({ cutLengthMm: 1200 })]))).toBe('đoạn dập 1.200 mm × 2');
    expect(punchedSegmentsText(grp('LASER', 5, [punched({ cutLengthMm: 427.5 })]))).toBe('đoạn dập 427,5 mm × 2');
    expect(punchedSegmentsText(grp('TU_DONG'))).toBe('');
  });

  it('câu phụ', () => {
    expect(groupHint(grp('LASER'), true)).toBe('Có đoạn dập lỗ ô van: không cắt máy tự động');
    expect(groupHint(grp('TU_DONG'), true)).toBeNull();
    expect(groupHint(grp('LASER'), false)).toBe('Xưởng không có laze: lỗ công nhân làm tay');
    expect(groupHint(grp('TU_DONG'), false)).toBeNull();
  });

  it('màu: tự động trung tính, laze đỏ nhạt; không có laze thì trung tính', () => {
    expect(patternGroupColors('TU_DONG', true).bg).toBe('var(--bg-eceff1)');
    expect(patternGroupColors('LASER', true).bg).toBe('var(--bg-fee2e2)');
    expect(patternGroupColors('LASER', false).bg).toBe('var(--bg-eceff1)');
  });

  it('chữ cột Máy: 1 nhóm, nhiều nhóm, chưa phân loại', () => {
    expect(patternMachineText([grp('LASER')])).toBe('MC Laser · đoạn dập 425 mm × 2');
    expect(patternMachineText([grp('TU_DONG')])).toBe('MC Tự động');
    expect(patternMachineText([grp('LASER', 50), grp('TU_DONG', 10)]))
      .toBe('50 cây · MC Laser · đoạn dập 425 mm × 2 | 10 cây · MC Tự động');
    expect(patternMachineText(null)).toBe('');
    expect(patternMachineText([])).toBe('');
  });

  it('tổng số cây theo lớp và dòng tóm tắt (bỏ lớp = 0)', () => {
    const patterns = [
      { machineGroups: [grp('TU_DONG', 40), grp('LASER', 50)] },
      { machineGroups: [grp('TU_DONG', 20), grp('LASER', 30)] },
      { machineGroups: null },
    ];
    expect(machineClassTotals(patterns)).toEqual({ TU_DONG: 60, LASER: 80 });
    expect(machineClassSummaryText(patterns)).toBe('60 cây MC Tự động · 80 cây MC Laser');
    expect(machineClassSummaryText(patterns, false)).toBe('60 cây MC Tự động · 80 cây MC Tự động · lỗ làm tay');
    expect(machineClassSummaryText([{ machineGroups: [grp('LASER', 7)] }])).toBe('7 cây MC Laser');
    expect(machineClassSummaryText([{ machineGroups: null }])).toBeNull();
    expect(machineClassSummaryText(undefined)).toBeNull();
  });
});
