import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCuttingGuideTable, buildPieceSummary, printCuttingGuide } from './cuttingGuide';
import type { CuttingProposalLine } from '../services/cutting-proposals-api';

// Fixture tối giản khớp số liệu ví dụ "500 bộ J55" đã đối chiếu với MC Laser
// (PHAN_TICH_HE_THONG_CatSat.md Phần II.3): sắt hộp 25×50, 2 kiểu cắt, cỡ 930/765.
function makeLine(overrides: Partial<CuttingProposalLine> = {}): CuttingProposalLine {
  return {
    materialId: '200',
    materialCode: 'SH25x50',
    materialName: 'Sắt hộp 25x50',
    unit: 'cây',
    feasible: true,
    bestStockLengthMm: 6000,
    totalBars: 200,
    totalWasteMm: 2000,
    wastePercentage: 0.18,
    mauNguyenMm: 0,
    lengthComparison: null,
    reason: null,
    bestAchievable: null,
    timedOut: null,
    maxWastePctThreshold: 1,
    overThreshold: false,
    displayReason: null,
    pieceSummary: null,
    patterns: [
      {
        id: 'p1',
        patternIndex: 0,
        barCount: 200,
        wastePerBarMm: 10,
        mauNguyenMm: 0,
        segments: [
          { segmentSpecId: 's930', cutLengthMm: 930, countPerBar: 4 },
          { segmentSpecId: 's765', cutLengthMm: 765, countPerBar: 1 },
        ],
      },
      {
        id: 'p2',
        patternIndex: 1,
        barCount: 67,
        wastePerBarMm: 15,
        mauNguyenMm: 0,
        segments: [
          { segmentSpecId: 's765', cutLengthMm: 765, countPerBar: 6 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('buildCuttingGuideTable — cột theo cỡ đoạn, dài trước (khớp thứ tự thợ cắt)', () => {
  it('cột sort giảm dần, không có pieceSummary -> label chỉ có mm', () => {
    const { columns, columnLabels } = buildCuttingGuideTable(makeLine());
    expect(columns).toEqual([930, 765]);
    expect(columnLabels).toEqual(['930mm', '765mm']);
  });

  it('có pieceSummary với tên mảnh -> label kèm tên, đúng thứ tự cột', () => {
    const line = makeLine({
      pieceSummary: [
        { size: 930, demand: 1000, produced: 1000, names: ['đoạn dài'] },
        { size: 765, demand: 1000, produced: 1000, names: ['đoạn dài', 'đoạn ngắn'] },
      ],
    });
    const { columnLabels } = buildCuttingGuideTable(line);
    expect(columnLabels).toEqual(['đoạn dài (930mm)', 'đoạn dài, đoạn ngắn (765mm)']);
  });

  it('dựng đúng số ô theo cỡ cho từng kiểu cắt', () => {
    const { rows } = buildCuttingGuideTable(makeLine());
    expect(rows).toEqual([
      { patternIndex: 0, counts: [4, 1], barCount: 200, wastePerBarMm: 10, mauNguyenMm: 0 },
      { patternIndex: 1, counts: [0, 6], barCount: 67, wastePerBarMm: 15, mauNguyenMm: 0 },
    ]);
  });
});

describe('buildPieceSummary — bảng TỔNG KẾT (SL cần/SL cắt), ưu tiên pieceSummary đã lưu', () => {
  it('có pieceSummary -> trả nguyên văn, không tự tính lại', () => {
    const line = makeLine({
      pieceSummary: [
        { size: 930, demand: 1000, produced: 1000, names: ['đoạn dài'] },
        { size: 765, demand: 1000, produced: 1000, names: ['đoạn ngắn'] },
      ],
    });
    expect(buildPieceSummary(line)).toEqual([
      { size: 930, demand: 1000, produced: 1000, names: ['đoạn dài'] },
      { size: 765, demand: 1000, produced: 1000, names: ['đoạn ngắn'] },
    ]);
  });

  it('pieceSummary = null (phương án cũ chưa backfill) -> tự tính SL cắt từ patterns, SL cần = NaN (hiện "—")', () => {
    const result = buildPieceSummary(makeLine({ pieceSummary: null }));
    // SL cắt 930 = 4×200 = 800 ; SL cắt 765 = 1×200 + 6×67 = 602
    expect(result).toEqual([
      { size: 930, demand: NaN, produced: 800, names: [] },
      { size: 765, demand: NaN, produced: 602, names: [] },
    ]);
  });

  it('dòng không có pattern nào (infeasible) -> mảng rỗng, không throw', () => {
    expect(buildPieceSummary(makeLine({ pieceSummary: null, patterns: [] }))).toEqual([]);
  });
});

describe('printCuttingGuide — mở cửa sổ xem trước với HTML+CSS giống "In kết quả" MC Laser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('viết HTML hợp lệ: đủ 2 bảng, thẻ <tr> không bị vỡ (cắt dở tô màu), nút In không tự bấm', () => {
    const written: string[] = [];
    const fakeWindow = {
      document: { write: (s: string) => written.push(s), close: vi.fn() },
      print: vi.fn(),
    };
    vi.stubGlobal('window', { open: vi.fn(() => fakeWindow) });

    printCuttingGuide('PO-49', [makeLine()]);

    const html = written.join('');
    expect(fakeWindow.document.close).toHaveBeenCalled();
    expect(fakeWindow.print).not.toHaveBeenCalled(); // xem trước trước - không tự bật hộp thoại in
    expect(html).toContain('<button onclick="window.print()">In / Lưu PDF</button>');
    expect(html).toContain('TỔNG KẾT CẮT');
    expect(html).toContain('KẾ HOẠCH CẮT CHI TIẾT');
    // Mọi <tr đều đóng đúng bằng '>' ngay sau (không còn lỗi cũ: <tr>...style="..."> lẫn ra ngoài thẻ).
    expect(html).not.toMatch(/<tr>[^<]*style=/);
  });

  it('trình duyệt chặn popup (window.open trả null) -> không throw', () => {
    vi.stubGlobal('window', { open: vi.fn(() => null) });
    expect(() => printCuttingGuide('PO-49', [makeLine()])).not.toThrow();
  });
});
