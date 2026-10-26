import { describe, expect, it } from 'vitest';
import type { CuttingBatchCandidate, CuttingBatchCandidateList } from '../services/cutting-batch-api';
import { chipStatus, countBySku, mergeVerified } from './mergeHints';

type Mat = CuttingBatchCandidate['materials'][number];
const mat = (materialId: string, over: boolean, verified = true, pct = 0.5) =>
  ({ materialId, materialCode: `SAT-${materialId}`, overThreshold: over, verified, standaloneWastePct: pct, thresholdPct: 1 }) as Mat;
const item = (id: string, code: string, deadline: string | null, mats: Mat[]) =>
  ({ productionInvoiceItemId: id, mfgProductCode: code, salesOrderCode: `PO-${id}`, deadline, materials: mats }) as CuttingBatchCandidate;
const ids = (xs: CuttingBatchCandidate[]) => xs.map((x) => x.productionInvoiceItemId);

describe('chipStatus', () => {
  it('đỏ khi vượt ngưỡng (đã xác minh, hoặc cận dưới ước tính đã vượt); xanh chỉ khi ĐÃ xác minh đạt; còn lại "chưa kiểm"', () => {
    expect(chipStatus(mat('A', true, true))).toBe('over');
    expect(chipStatus(mat('A', true, false))).toBe('over');
    expect(chipStatus(mat('A', false, true))).toBe('ok');
    // SAT-PHI-6 GHE-J55 ×20 (2026-10-24): ước tính "≥0,17%" chưa xác minh từng hiện XANH trong khi cây 6m tốt nhất 19,67 %
    expect(chipStatus(mat('A', false, false, 0.167))).toBe('unknown');
  });
});

describe('mergeVerified', () => {
  it('chỉ thay loại sắt lượt bù xác minh được, giữ thứ tự dòng và loại đã xác minh', () => {
    const prev = {
      items: [item('2', 'B', null, [mat('A', false, false, 0.1), mat('C', false, true, 0.3)]), item('1', 'X', null, [mat('A', false, false)])],
      recommendedItemIds: ['2'],
    } as unknown as CuttingBatchCandidateList;
    const deep = {
      items: [item('1', 'X', null, [mat('A', false, false)]), item('2', 'B', null, [mat('A', true, true, 19.67), mat('C', false, true, 9)])],
      recommendedItemIds: [],
    } as unknown as CuttingBatchCandidateList;
    const out = mergeVerified(prev, deep);
    expect(ids(out.items)).toEqual(['2', '1']);
    expect(out.recommendedItemIds).toEqual([]); // của lượt bù
    expect(out.items[0].materials[0]).toMatchObject({ verified: true, overThreshold: true, standaloneWastePct: 19.67 });
    expect(out.items[0].materials[1].standaloneWastePct).toBe(0.3); // đã xác minh từ trước - giữ
    expect(out.items[1]).toBe(prev.items[1]); // không đổi gì -> giữ nguyên object
  });

  it('tick sẵn lấy của lượt bù (chip xác minh lại có thể đổi đơn gấp nhất)', () => {
    const prev = { items: [], recommendedItemIds: ['1'] } as unknown as CuttingBatchCandidateList;
    const deep = { items: [], recommendedItemIds: ['3'] } as unknown as CuttingBatchCandidateList;
    expect(mergeVerified(prev, deep).recommendedItemIds).toEqual(['3']);
  });
});

describe('countBySku', () => {
  it('đếm mã trùng, nhiều nhất trước, mã đơn lẻ không có ×1', () => {
    const ps = ['GHE-TINH-YEU', 'GHE-J55', 'GHE-J55', 'BAN-8', 'GHE-TINH-YEU', 'GHE-J55'].map((c, i) => item(String(i), c, null, []));
    expect(countBySku(ps)).toBe('GHE-J55 ×3 · GHE-TINH-YEU ×2 · BAN-8');
  });
});
