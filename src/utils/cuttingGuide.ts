/**
 * Bảng "hướng dẫn cắt" dùng chung — build từ CuttingProposalLine.patterns[] (1 vật tư) thành lưới
 * cỡ-đoạn × kiểu-cắt (Kiểu 1/2/3... × cỡ 460mm/305mm/...) để hiển thị dạng bảng ô-theo-ô và xuất
 * Excel để in. Tách ra từ Admin/businessData/CuttingProposalsPage.tsx (2026-08-25) để dùng chung
 * với Phôi/HuongDanCatPage.tsx — cùng 1 nguồn sự thật (phương án cắt ĐÃ DUYỆT của solver), không
 * lặp lại 2 nơi.
 *
 * 2026-08-25 (đợt 2): layout bản in đồng bộ với "In kết quả" của MC Laser
 * (cat_laser_roi/optimization_logic.py, D:\DNA-DEXUAT) — đã đối chiếu số liệu 2 bên gần như
 * trùng nhau (cùng công thức hao hụt, không tính lưỡi cắt vào %, xem
 * PHAN_TICH_HE_THONG_CatSat.md Phần II.4). Thêm bảng TỔNG KẾT (Tên sắt/Đoạn/SL cần/SL cắt —
 * KHÔNG có cột Tồn kho, Sếp chốt bỏ) trước bảng chi tiết, thêm cột STT và tên mảnh vào header cột
 * cỡ đoạn, đúng 2 bảng MC Laser in ra.
 */
import * as XLSX from 'xlsx';
import type { CuttingPatternMachineGroup, CuttingProposalLine, CuttingProposalPieceSummary, PatternBundles } from '../services/cutting-proposals-api';
import { fmtBundles, fmtBundleSummary, lineMachine, machineClassSummaryText, machineLabel, patternMachineText } from './cutMachine';
import { fmtBars, fmtMm, fmtNum, fmtPct } from './numberFormat';

export interface CuttingGuideRow {
  patternIndex: number;
  counts: number[];
  barCount: number;
  wastePerBarMm: number | null;
  /** Cách cắt theo bó (MC Tự động); null = cắt từng cây (MC Laser / phương án cũ). Định dạng chữ: fmtBundles(). */
  bundles: PatternBundles | null;
  /** Nhóm cây theo lớp máy (13/11/2026); null = chưa phân loại -> không có cột Máy. Định dạng chữ: patternMachineText(). */
  machineGroups: CuttingPatternMachineGroup[] | null;
}

/** cột = mọi cỡ đoạn xuất hiện trong bất kỳ kiểu cắt nào (dài trước, khớp thứ tự thợ nên cắt: cỡ
 *  dài trước để phần đuôi còn lại đủ cho đoạn ngắn). `columnLabels` kèm tên mảnh khi có
 *  (`pieceSummary`) — "chân bàn (660mm)" giống header MC Laser; không có tên thì chỉ "660mm". */
export function buildCuttingGuideTable(
  line: CuttingProposalLine,
): { columns: number[]; columnLabels: string[]; rows: CuttingGuideRow[] } {
  const patterns = line.patterns ?? [];
  const columnSet = new Set<number>();
  for (const p of patterns) for (const s of p.segments) columnSet.add(s.cutLengthMm);
  const columns = [...columnSet].sort((a, b) => b - a);
  const namesBySize = new Map((line.pieceSummary ?? []).map((p) => [p.size, p.names]));
  const columnLabels = columns.map((c) => {
    const names = namesBySize.get(c);
    return names && names.length > 0 ? `${names.join(', ')} (${fmtMm(c)})` : fmtMm(c);
  });
  const rows: CuttingGuideRow[] = patterns.map((p) => {
    const bySize = new Map(p.segments.map((s) => [s.cutLengthMm, s.countPerBar]));
    return {
      patternIndex: p.patternIndex,
      counts: columns.map((c) => bySize.get(c) ?? 0),
      barCount: p.barCount,
      wastePerBarMm: p.wastePerBarMm,
      bundles: p.bundles ?? null,
      machineGroups: p.machineGroups && p.machineGroups.length > 0 ? p.machineGroups : null,
    };
  });
  return { columns, columnLabels, rows };
}

/** Bảng TỔNG KẾT CẮT (Tên sắt / Đoạn / SL cần / SL cắt), khớp bảng đầu "In kết quả" của MC Laser.
 *  Ưu tiên `line.pieceSummary` (đã lưu sẵn lúc solver tính — đúng số đã gửi solver). Khi null
 *  (dòng không khả thi, hoặc phương án tính trước 2026-08-25 chưa backfill) vẫn dựng được SL cắt
 *  từ chính patterns[] đã có, chỉ SL cần/tên mảnh phải chịu "chưa có số" (null/[]). */
export function buildPieceSummary(line: CuttingProposalLine): CuttingProposalPieceSummary[] {
  if (line.pieceSummary) return line.pieceSummary;
  const producedBySize = new Map<number, number>();
  for (const p of line.patterns ?? []) {
    for (const s of p.segments) {
      producedBySize.set(s.cutLengthMm, (producedBySize.get(s.cutLengthMm) ?? 0) + s.countPerBar * p.barCount);
    }
  }
  return [...producedBySize.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, produced]) => ({ size, demand: NaN, produced, names: [] }));
}

/** "MC Tự động · 12 bó cây + 5 cây cắt tay = 17 lần cắt" - dòng máy cắt của bản hướng dẫn (màn Phôi, in, Excel). null khi
 *  dòng không khả thi chưa ghi máy; MC Laser không có tóm tắt bó thì chỉ nêu tên máy. */
export function machineSummaryText(line: CuttingProposalLine, bundleWord = 'bó cây'): string | null {
  // Dòng khả thi mà chưa ghi máy = phương án cũ, từ trước khi có MC Tự động -> MC Laser (quy tắc chung: lineMachine).
  const machine = lineMachine(line);
  const name = machineLabel(machine);
  if (!name) return null;
  const sum = machine === 'tu_dong' ? fmtBundleSummary(line.bundleSummary, bundleWord) : null;
  return sum ? `${name} · ${sum}` : name;
}

/** Dòng "Máy cắt: …" của bản hướng dẫn (màn Phôi, in, Excel) - MỘT dòng duy nhất (13/11/2026): ưu tiên tổng theo lớp máy của từng cây
 *  ("6 cây MC Tự động", "10 cây MC Laser · 2 cây MC Tự động", xưởng không có laze "5 cây MC Tự động · lỗ làm tay") để khớp cột Máy;
 *  phương án cũ chưa có dữ liệu lớp máy thì rơi về nhãn máy lúc tính (machineSummaryText). Trả phần SAU "Máy cắt: ", null = không có dòng. */
export function cutMachineLineText(line: CuttingProposalLine, laserAllowed = true, bundleWord = 'bó cây'): string | null {
  return machineClassSummaryText(line.patterns, laserAllowed) ?? machineSummaryText(line, bundleWord);
}

const fmtDemand = (n: number): string | number => (Number.isNaN(n) ? '—' : n);

/** Cột "Máy" (nhãn lớp máy + đoạn dập) chỉ có khi ít nhất một kiểu cắt có machineGroups - không có dữ liệu thì giữ nguyên bảng như cũ. */
export function hasMachineColumn(rows: CuttingGuideRow[]): boolean {
  return rows.some((r) => r.machineGroups !== null);
}

/** `laserAllowed=false` (xưởng không có laze, vd Phước An): nhóm laze ghi "MC Tự động · lỗ làm tay". */
export function buildSheetAoa(line: CuttingProposalLine, laserAllowed = true): (string | number)[][] {
  const { columnLabels, rows } = buildCuttingGuideTable(line);
  const pieces = buildPieceSummary(line);
  const summaryHeader = ['Tên sắt', 'Đoạn (mm)', 'SL cần', 'SL cắt'];
  const summaryRows = pieces.map((p) => [
    p.names.length > 0 ? p.names.join(', ') : '',
    p.size,
    fmtDemand(p.demand),
    p.produced,
  ]);
  // Cột "Cách cắt theo bó cây" chỉ có khi phương án tính bằng MC Tự động - MC Laser/phương án cũ giữ nguyên bảng như cũ.
  const hasBundles = rows.some((r) => fmtBundles(r.bundles) !== null);
  const hasMachine = hasMachineColumn(rows);
  const machineText = cutMachineLineText(line, laserAllowed);
  const header = ['STT', ...(hasMachine ? ['Máy'] : []), ...columnLabels, 'HH/cây (mm)', 'Số cây', ...(hasBundles ? ['Cách cắt theo bó cây'] : [])];
  const dataRows = rows.map((r, i) => [
    i + 1,
    ...(hasMachine ? [patternMachineText(r.machineGroups, laserAllowed)] : []),
    ...r.counts.map((c) => (c > 0 ? c : '')),
    r.wastePerBarMm ?? '',
    r.barCount,
    ...(hasBundles ? [fmtBundles(r.bundles, 'bó cây') ?? ''] : []),
  ]);
  return [
    [`${line.materialCode} — ${line.materialName}`],
    [`Mua ${fmtMm(line.bestStockLengthMm)} × ${line.totalBars != null ? fmtBars(line.totalBars) : '—'}, hao hụt ${fmtPct(line.wastePercentage)}`],
    ...(machineText ? [[`Máy cắt: ${machineText}`]] : []),
    // Cỡ đặt riêng (auto_scan mở lại 2026-08-26) - phải in rõ trên giấy, thợ/Mua hàng không được
    // tưởng nhầm đây là cây chuẩn 6000mm.
    ...(line.lengthSource === 'scan'
      ? [[`⚠ CỠ ĐẶT RIÊNG ${fmtMm(line.bestStockLengthMm)} — KHÔNG PHẢI CÂY CHUẨN`]]
      : []),
    [`Tổng khúc thừa (phế liệu): ${fmtMm(line.totalWasteMm ?? 0)}`],
    [],
    ['TỔNG KẾT CẮT'],
    summaryHeader,
    ...summaryRows,
    [],
    ['KẾ HOẠCH CẮT CHI TIẾT'],
    header,
    ...dataRows,
  ];
}

/** Escape tối thiểu cho nội dung chèn vào HTML (tên mảnh/vật tư đều do người dùng nhập ở màn định
 *  mức, không được tin tưởng tuyệt đối khi ghép thẳng vào chuỗi HTML). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** HTML 1 vật tư cho bản in - CÙNG layout+CSS với "In kết quả" của MC Laser
 *  (cat_laser_roi/templates/cat_laser_roi/index.html::printDiv, D:\DNA-DEXUAT) để thợ cắt quen mắt:
 *  bảng viền #ccc, header nền #f2f2f2, chữ giữa ô, font-size 0.8rem. `pageBreakBefore` chỉ dùng khi
 *  in nhiều vật tư trong 1 lần (mỗi vật tư 1 trang), vật tư đầu tiên không set. */
export function buildPrintSectionHtml(line: CuttingProposalLine, pageBreakBefore: boolean, laserAllowed = true): string {
  const { columnLabels, rows } = buildCuttingGuideTable(line);
  const pieces = buildPieceSummary(line);
  const summaryRows = pieces
    .map(
      (p) => `<tr><td class="l">${escapeHtml(p.names.join(', ') || '—')}</td><td>${fmtNum(p.size)}</td>` +
        `<td>${Number.isNaN(p.demand) ? '—' : fmtNum(p.demand)}</td><td>${fmtNum(p.produced)}</td></tr>`,
    )
    .join('');
  const hasBundles = rows.some((r) => fmtBundles(r.bundles) !== null);
  const hasMachine = hasMachineColumn(rows);
  const detailRows = rows
    .map((r, i) => {
      const counts = r.counts.map((c) => `<td>${c > 0 ? fmtNum(c) : ''}</td>`).join('');
      return `<tr><td>${i + 1}</td>` +
        (hasMachine ? `<td class="l">${escapeHtml(patternMachineText(r.machineGroups, laserAllowed))}</td>` : '') +
        `${counts}` +
        `<td>${fmtNum(r.wastePerBarMm)}</td><td>${fmtNum(r.barCount)}</td>` +
        (hasBundles ? `<td class="l">${escapeHtml(fmtBundles(r.bundles, 'bó cây') ?? '')}</td>` : '') +
        `</tr>`;
    })
    .join('');
  // Bản in dùng table-layout: fixed (các cột chia đều) -> có cột "Cách cắt theo bó cây" thì cho nó ~18% để chữ không bị bẻ vụn.
  const machineText = cutMachineLineText(line, laserAllowed);
  const colgroup = hasBundles || hasMachine
    ? `<colgroup><col style="width:5%">${hasMachine ? '<col style="width:18%">' : ''}${columnLabels.map(() => '<col>').join('')}<col style="width:8%"><col style="width:8%">${hasBundles ? '<col style="width:18%">' : ''}</colgroup>`
    : '';
  return `
    <div${pageBreakBefore ? ' style="page-break-before: always"' : ''}>
      <h3>${escapeHtml(line.materialCode)} — ${escapeHtml(line.materialName)}</h3>
      <p>Mua <b>${fmtMm(line.bestStockLengthMm)}</b> × <b>${line.totalBars != null ? fmtBars(line.totalBars) : '—'}</b>
        ${line.wastePercentage != null ? `· hao hụt ${fmtPct(line.wastePercentage)}` : ''}</p>
      ${machineText ? `<p>Máy cắt: <b>${escapeHtml(machineText)}</b></p>` : ''}
      ${line.lengthSource === 'scan'
        ? `<div style="background:#fff3e0;color:#e65100;font-weight:700;padding:8px 12px;margin-bottom:8px;border-left:4px solid #e65100">⚠ CỠ ĐẶT RIÊNG ${fmtMm(line.bestStockLengthMm)} — KHÔNG PHẢI CÂY CHUẨN</div>`
        : ''}
      <h4>TỔNG KẾT CẮT</h4>
      <table><thead><tr><th class="l">Tên sắt</th><th>Đoạn (mm)</th><th>SL cần</th><th>SL cắt</th></tr></thead>
        <tbody>${summaryRows}</tbody></table>
      <h4>KẾ HOẠCH CẮT CHI TIẾT</h4>
      <table>${colgroup}<thead><tr><th>STT</th>${hasMachine ? '<th class="l">Máy</th>' : ''}${columnLabels.map((l) => `<th>${escapeHtml(l)}</th>`).join('')}` +
        `<th>HH/cây</th><th>Số cây</th>${hasBundles ? '<th class="l">Cách cắt theo bó cây</th>' : ''}</tr></thead>
        <tbody>${detailRows}</tbody></table>
    </div>`;
}

/** In (PDF) - mở cửa sổ mới với HTML + CSS y hệt "In kết quả" của MC Laser để XEM TRƯỚC, có nút
 *  "In / Lưu PDF" riêng để người dùng tự bấm khi đã ưng ý (2026-08-25, theo yêu cầu Sếp: xem trước
 *  rồi mới in, không tự bật hộp thoại in ngay như bản đầu). Nút này ẩn khi in thật (`.no-print`) -
 *  window.print() vẫn KHÔNG tự dựng file PDF, người dùng tự "Lưu thành PDF" từ hộp thoại in của
 *  trình duyệt, đúng cách MC Laser đang làm (cat_laser_roi/templates/cat_laser_roi/index.html). */
export function printCuttingGuide(poNumber: string, lines: CuttingProposalLine[], laserAllowed = true): void {
  const printWindow = window.open('', '', 'height=800,width=1200');
  if (!printWindow) return; // trình duyệt chặn popup - im lặng, nút Excel vẫn dùng được
  const sections = lines.map((line, i) => buildPrintSectionHtml(line, i > 0, laserAllowed)).join('');
  printWindow.document.write(`<html><head><title>Hướng dẫn cắt — ${escapeHtml(poNumber)}</title>`);
  printWindow.document.write(`<style>
    @media print { @page { size: A4 landscape; margin: 1cm; } .no-print { display: none; } }
    body { font-family: Arial, sans-serif; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: fixed; margin-bottom: 16px; }
    th, td { border: 1px solid #ccc; padding: 5px; text-align: right; vertical-align: middle; word-wrap: break-word; }
    th.l, td.l { text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    h3, h4 { page-break-after: avoid; }
    .no-print { margin-bottom: 12px; }
    .no-print button { padding: 8px 16px; font-size: 14px; font-weight: 600; border: none; border-radius: 6px; background: #e65100; color: #fff; cursor: pointer; }
  </style></head><body>`);
  printWindow.document.write(
    `<div class="no-print"><button onclick="window.print()">In / Lưu PDF</button></div>` +
      `<h2>${escapeHtml(poNumber)}</h2>${sections}`,
  );
  printWindow.document.write('</body></html>');
  printWindow.document.close();
}

function appendLineSheet(wb: XLSX.WorkBook, line: CuttingProposalLine, laserAllowed: boolean): void {
  const ws = XLSX.utils.aoa_to_sheet(buildSheetAoa(line, laserAllowed));
  const sheetName = line.materialCode.replace(/[\\/*?[\]:]/g, '-').slice(0, 31) || 'VatTu';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

/** `poNumber` chỉ dùng để đặt tên file (không hiển thị trong sheet) - gọi nơi có mã PO/PI đang
 *  xem, không phụ thuộc kiểu `CuttingProposal` đầy đủ. Xuất ĐÚNG 1 vật tư - dùng khi chỉ cần in
 *  riêng loại sắt đó (Admin/businessData/CuttingProposalsPage.tsx, hoặc Phôi cần in bù 1 loại). */
export function exportCuttingGuideExcel(poNumber: string, line: CuttingProposalLine, laserAllowed = true): void {
  const wb = XLSX.utils.book_new();
  appendLineSheet(wb, line, laserAllowed);
  XLSX.writeFile(wb, `Huong-dan-cat-${poNumber}-${line.materialCode}.xlsx`);
}

/** Xuất TOÀN BỘ vật tư của 1 PO/PI vào CHUNG 1 file (mỗi vật tư 1 sheet) - in 1 lần cho cả lệnh
 *  sản xuất thay vì bấm từng vật tư (2026-08-25, Phôi/HuongDanCatPage.tsx: 1 PO thường có nhiều
 *  loại sắt, tách file rời không có lý do gì khi đều cùng treo lên cho 1 ca cắt). */
export function exportCuttingGuideExcelAll(poNumber: string, lines: CuttingProposalLine[], laserAllowed = true): void {
  const wb = XLSX.utils.book_new();
  for (const line of lines) appendLineSheet(wb, line, laserAllowed);
  XLSX.writeFile(wb, `Huong-dan-cat-${poNumber}.xlsx`);
}
