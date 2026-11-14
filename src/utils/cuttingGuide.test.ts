import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCuttingGuideTable, buildPieceSummary, buildPrintSectionHtml, buildSheetAoa, cutMachineLineText, machineSummaryText, printCuttingGuide } from './cuttingGuide';
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
    lengthSource: 'fixed',
    totalBars: 200,
    totalWasteMm: 2000,
    wastePercentage: 0.18,
    lengthComparison: null,
    reason: null,
    bestAchievable: null,
    timedOut: null,
    maxWastePctThreshold: 1,
    overThreshold: false,
    normalWastePctThreshold: 1,
    usedWasteOverride: false,
    displayReason: null,
    solveSeconds: null,
    pieceSummary: null,
    patterns: [
      {
        id: 'p1',
        patternIndex: 0,
        barCount: 200,
        wastePerBarMm: 10,
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
        segments: [
          { segmentSpecId: 's765', cutLengthMm: 765, countPerBar: 6 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('buildCuttingGuideTable — cột theo cỡ đoạn, dài trước (khớp thứ tự thợ cắt)', () => {
  it('cột sort giảm dần, không có pieceSummary -> label chỉ có "930 mm"', () => {
    const { columns, columnLabels } = buildCuttingGuideTable(makeLine());
    expect(columns).toEqual([930, 765]);
    expect(columnLabels).toEqual(['930 mm', '765 mm']);
  });

  it('có pieceSummary với tên mảnh -> label kèm tên, đúng thứ tự cột', () => {
    const line = makeLine({
      pieceSummary: [
        { size: 930, demand: 1000, produced: 1000, names: ['đoạn dài'] },
        { size: 765, demand: 1000, produced: 1000, names: ['đoạn dài', 'đoạn ngắn'] },
      ],
    });
    const { columnLabels } = buildCuttingGuideTable(line);
    expect(columnLabels).toEqual(['đoạn dài (930 mm)', 'đoạn dài, đoạn ngắn (765 mm)']);
  });

  it('dựng đúng số ô theo cỡ cho từng kiểu cắt', () => {
    const { rows } = buildCuttingGuideTable(makeLine());
    expect(rows).toEqual([
      { patternIndex: 0, counts: [4, 1], barCount: 200, wastePerBarMm: 10, bundles: null, machineGroups: null },
      { patternIndex: 1, counts: [0, 6], barCount: 67, wastePerBarMm: 15, bundles: null, machineGroups: null },
    ]);
  });

  it('MC Tự động: kiểu cắt mang theo bundles, chữ in/Excel dùng "bó cây"', () => {
    const line = makeLine({
      machine: 'tu_dong',
      bundleSummary: { factors: [14, 16], totalBundles: 12, manualBars: 5, totalCuts: 17, maxSizesPerPattern: 5 },
    });
    line.patterns[0].bundles = { '16': 12, '1': 5 };
    const { rows } = buildCuttingGuideTable(line);
    expect(rows[0].bundles).toEqual({ '16': 12, '1': 5 });
    expect(rows[1].bundles).toBeNull();
    expect(machineSummaryText(line)).toBe('MC Tự động · 12 bó cây + 5 cây cắt tay = 17 lần cắt');
    // Phương án cũ (khả thi, chưa ghi máy) = MC Laser; dòng không khả thi chưa ghi máy thì không nêu.
    expect(machineSummaryText(makeLine())).toBe('MC Laser');
    expect(machineSummaryText(makeLine({ feasible: false }))).toBeNull();
  });
});

describe('Hướng dẫn cắt MC Tự động - bản Excel và bản in có cột "Cách cắt theo bó cây"', () => {
  const bundled = () => {
    const line = makeLine({
      machine: 'tu_dong',
      bundleSummary: { factors: [16], totalBundles: 12, manualBars: 5, totalCuts: 17, maxSizesPerPattern: 5 },
    });
    line.patterns[0].bundles = { '16': 12, '1': 5 };
    return line;
  };

  it('Excel: thêm cột cuối + dòng Máy cắt', () => {
    const aoa = buildSheetAoa(bundled());
    const header = aoa.find((r) => r[0] === 'STT')!;
    expect(header[header.length - 1]).toBe('Cách cắt theo bó cây');
    const row1 = aoa[aoa.indexOf(header) + 1];
    expect(row1[row1.length - 1]).toBe('16 cây × 12 bó cây + 5 cây cắt tay');
    expect(aoa.some((r) => r[0] === 'Máy cắt: MC Tự động · 12 bó cây + 5 cây cắt tay = 17 lần cắt')).toBe(true);
  });

  it('Bản in: thêm cột + dòng Máy cắt', () => {
    const html = buildPrintSectionHtml(bundled(), false);
    expect(html).toContain('<th class="l">Cách cắt theo bó cây</th>');
    expect(html).toContain('<td class="l">16 cây × 12 bó cây + 5 cây cắt tay</td>');
    expect(html).toContain('Máy cắt: <b>MC Tự động');
    // Bản in chia cột đều (table-layout: fixed) -> cột bó có colgroup ~18%, STT 5%.
    expect(html).toContain('<colgroup><col style="width:5%"><col><col>');
    expect(html).toContain('<col style="width:18%">');
  });

  it('MC Laser / phương án cũ: không có cột bó, dòng máy ghi MC Laser', () => {
    const aoa = buildSheetAoa(makeLine());
    const header = aoa.find((r) => r[0] === 'STT')!;
    expect(header).not.toContain('Cách cắt theo bó cây');
    expect(buildPrintSectionHtml(makeLine(), false)).not.toContain('Cách cắt theo bó');
    expect(buildPrintSectionHtml(makeLine(), false)).not.toContain('<colgroup>');
    expect(buildPrintSectionHtml(makeLine(), false)).toContain('Máy cắt: <b>MC Laser</b>');
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

  it('viết HTML hợp lệ: đủ 2 bảng, thẻ <tr> không bị vỡ, nút In không tự bấm', () => {
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

describe('Hướng dẫn cắt có nhóm máy - cột "Máy" ở Excel và bản in', () => {
  const withGroups = () => {
    const line = makeLine();
    line.patterns[0].machineGroups = [
      { bars: 50, machineClass: 'LASER', punchedSegments: [{ cutLengthMm: 930, countPerBar: 2 }] },
      { bars: 150, machineClass: 'TU_DONG', punchedSegments: [] },
    ];
    line.patterns[1].machineGroups = [
      { bars: 67, machineClass: 'LASER', punchedSegments: [{ cutLengthMm: 765, countPerBar: 1 }] },
    ];
    return line;
  };

  it('Excel: cột Máy ngay sau STT, nhiều nhóm nối " | "', () => {
    const aoa = buildSheetAoa(withGroups());
    const header = aoa.find((r) => r[0] === 'STT')!;
    expect(header[1]).toBe('Máy');
    const row1 = aoa[aoa.indexOf(header) + 1];
    expect(row1[1]).toBe('50 cây · MC Laser · đoạn dập 930 mm × 2 | 150 cây · MC Tự động');
    const row2 = aoa[aoa.indexOf(header) + 2];
    expect(row2[1]).toBe('MC Laser · đoạn dập 765 mm × 1');
  });

  it('Excel: xưởng không có laze -> "MC Tự động · lỗ làm tay"', () => {
    const aoa = buildSheetAoa(withGroups(), false);
    const header = aoa.find((r) => r[0] === 'STT')!;
    expect(String(aoa[aoa.indexOf(header) + 2][1])).toContain('MC Tự động · lỗ làm tay');
  });

  it('Bản in: thêm cột Máy + colgroup', () => {
    const html = buildPrintSectionHtml(withGroups(), false);
    expect(html).toContain('<th>STT</th><th class="l">Máy</th>');
    expect(html).toContain('<td class="l">MC Laser · đoạn dập 765 mm × 1</td>');
    expect(html).toContain('<colgroup><col style="width:5%"><col style="width:18%">');
  });

  it('Không có machineGroups: không có cột Máy ở cả Excel và bản in', () => {
    const header = buildSheetAoa(makeLine()).find((r) => r[0] === 'STT')!;
    expect(header).not.toContain('Máy');
    expect(buildPrintSectionHtml(makeLine(), false)).not.toContain('<th class="l">Máy</th>');
  });
});

describe('Dòng "Máy cắt: …" - MỘT dòng, theo lớp máy của từng cây (13/11/2026)', () => {
  const grouped = (laser = 10, auto = 2) => {
    const line = makeLine({ machine: 'laser' });
    line.patterns[0].machineGroups = [{ bars: auto, machineClass: 'TU_DONG', punchedSegments: [] }];
    line.patterns[1].machineGroups = [{ bars: laser, machineClass: 'LASER', punchedSegments: [{ cutLengthMm: 765, countPerBar: 1 }] }];
    return line;
  };
  const machineRows = (aoa: (string | number)[][]) => aoa.filter((r) => typeof r[0] === 'string' && (r[0] as string).startsWith('Máy cắt:'));

  it('có lớp máy: bỏ nhãn máy lúc tính, chỉ còn tổng theo lớp máy (Excel + bản in)', () => {
    const line = grouped();
    expect(cutMachineLineText(line)).toBe('2 cây MC Tự động · 10 cây MC Laser');
    expect(machineRows(buildSheetAoa(line))).toEqual([['Máy cắt: 2 cây MC Tự động · 10 cây MC Laser']]);
    const html = buildPrintSectionHtml(line, false);
    expect(html).toContain('Máy cắt: <b>2 cây MC Tự động · 10 cây MC Laser</b>');
    expect(html.match(/Máy cắt:/g)).toHaveLength(1);
  });

  it('chỉ một lớp máy: "6 cây MC Tự động", không còn "MC Laser" lúc tính', () => {
    const line = makeLine({ machine: 'laser' });
    line.patterns[0].machineGroups = [{ bars: 6, machineClass: 'TU_DONG', punchedSegments: [] }];
    expect(machineRows(buildSheetAoa(line))).toEqual([['Máy cắt: 6 cây MC Tự động']]);
    expect(buildPrintSectionHtml(line, true)).toContain('Máy cắt: <b>6 cây MC Tự động</b>');
  });

  it('không có dữ liệu lớp máy: rơi về nhãn máy lúc tính như cũ', () => {
    expect(machineRows(buildSheetAoa(makeLine()))).toEqual([['Máy cắt: MC Laser']]);
    expect(buildPrintSectionHtml(makeLine(), false)).toContain('Máy cắt: <b>MC Laser</b>');
  });

  it('xưởng không có laze: "N cây MC Tự động · lỗ làm tay"', () => {
    const line = grouped(5, 0);
    expect(cutMachineLineText(line, false)).toBe('5 cây MC Tự động · lỗ làm tay');
    expect(machineRows(buildSheetAoa(line, false))).toEqual([['Máy cắt: 5 cây MC Tự động · lỗ làm tay']]);
    expect(buildPrintSectionHtml(line, false, false)).toContain('Máy cắt: <b>5 cây MC Tự động · lỗ làm tay</b>');
  });
});

describe('Ghi số thống nhất (dấu chấm nghìn, dấu phẩy thập phân)', () => {
  const big = () => makeLine({
    bestStockLengthMm: 5030, totalBars: 6, wastePercentage: 0.38, totalWasteMm: 1200, lengthSource: 'scan',
    pieceSummary: [{ size: 1200, demand: 1500, produced: 1500, names: ['chân'] }],
  });

  it('bản in: "5.030 mm × 6 cây · hao hụt 0,38%", đoạn/HH ghi fmtNum, cột chữ căn trái', () => {
    const line = big();
    line.patterns[0].segments[0].cutLengthMm = 1200;
    line.patterns[0].wastePerBarMm = 1200;
    const html = buildPrintSectionHtml(line, false);
    expect(html).toContain('<b>5.030 mm</b> × <b>6 cây</b>');
    expect(html).toContain('hao hụt 0,38%');
    expect(html).not.toContain('0.38');
    expect(html).toContain('CỠ ĐẶT RIÊNG 5.030 mm');
    expect(html).toContain('<td class="l">chân</td><td>1.200</td><td>1.500</td><td>1.500</td>');
    expect(html).toContain('<td>1.200</td><td>200</td>');
    expect(html).toContain('<th class="l">Tên sắt</th>');
  });

  it('Excel: dòng chữ dùng chuỗi đã định dạng, ô số giữ là số', () => {
    const aoa = buildSheetAoa(big());
    expect(aoa[1][0]).toBe('Mua 5.030 mm × 6 cây, hao hụt 0,38%');
    expect(aoa.some((r) => r[0] === '⚠ CỠ ĐẶT RIÊNG 5.030 mm — KHÔNG PHẢI CÂY CHUẨN')).toBe(true);
    expect(aoa.some((r) => r[0] === 'Tổng khúc thừa (phế liệu): 1.200 mm')).toBe(true);
    const sum = aoa[aoa.findIndex((r) => r[0] === 'Tên sắt') + 1];
    expect(sum).toEqual(['chân', 1200, 1500, 1500]);
    const header = aoa.find((r) => r[0] === 'STT')!;
    const row = aoa[aoa.indexOf(header) + 1];
    expect(typeof row[row.length - 1]).toBe('number');
  });
});
