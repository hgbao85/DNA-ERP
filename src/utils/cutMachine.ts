/**
 * Máy cắt của bộ giải "Đề xuất thanh sắt" (MC Laser / MC Tự động) - nhãn + cách đọc kết quả cắt theo bó.
 * Dùng chung cho Tối ưu cắt sắt (KHSX), Lệnh sản xuất (Sếp/QLSX), Hướng dẫn cắt (Phôi), Admin.
 */
import type { SolverMachine } from '../types/admin';
import type {
  CuttingBundleSummary, CuttingPatternMachineGroup, CuttingProposalPattern, PatternBundles, PatternMachineClass,
} from '../services/cutting-proposals-api';
import { fmtNum } from './numberFormat';

// fmtPercent chuyển sang utils/numberFormat (13/11/2026, hàm ghi số dùng chung); giữ export ở đây cho các nơi đang import.
export { fmtPercent } from './numberFormat';

export const MACHINE_LABEL: Record<SolverMachine, string> = {
  laser: 'MC Laser',
  tu_dong: 'MC Tự động',
};

/** "MC Tự động" - không nhận ra / null thì trả null để nơi gọi tự quyết định có hiện hay không. */
export function machineLabel(m: SolverMachine | null | undefined): string | null {
  return m ? (MACHINE_LABEL[m] ?? null) : null;
}

/**
 * Cách cắt theo bó của MỘT kiểu cắt: "16 cây × 12 bó + 5 cây cắt tay".
 * `bundles` khoá là hệ số bó ("14","16","18","20"), giá trị là số bó; khoá "1" là số CÂY cắt tay.
 * Hệ số sắp giảm dần, bỏ hệ số 0 bó. `bundleWord`: "bó" (mặc định) hoặc "bó cây" ở màn Phôi - nơi đã có
 * "bó đoạn" (bó đoạn đã cắt giao Hàn) nên phải ghi "bó cây" cho khỏi lẫn.
 * Trả null khi không có bundles (máy Laser / phương án cũ) - nơi gọi hiện như cũ.
 */
export function fmtBundles(bundles: PatternBundles | null | undefined, bundleWord = 'bó'): string | null {
  if (!bundles) return null;
  const parts: string[] = [];
  const factors = Object.entries(bundles)
    .map(([k, v]) => [Number(k), Number(v)] as const)
    .filter(([f, n]) => Number.isFinite(f) && f > 1 && n > 0)
    .sort((a, b) => b[0] - a[0]);
  for (const [f, n] of factors) parts.push(`${f} cây × ${n} ${bundleWord}`);
  const manual = Number(bundles['1'] ?? 0);
  if (manual > 0) parts.push(`${manual} cây cắt tay`);
  return parts.length > 0 ? parts.join(' + ') : null;
}

/** Tóm tắt cả loại sắt của MC Tự động: "12 bó + 5 cây cắt tay = 17 lần cắt". */
export function fmtBundleSummary(s: CuttingBundleSummary | null | undefined, bundleWord = 'bó'): string | null {
  if (!s) return null;
  // Bỏ vế bằng 0: không cắt tay thì không ghi "+ 0 cây cắt tay", không có bó nào thì không ghi "0 bó +".
  const parts: string[] = [];
  if (s.totalBundles > 0) parts.push(`${s.totalBundles} ${bundleWord}`);
  if (s.manualBars > 0) parts.push(`${s.manualBars} cây cắt tay`);
  return parts.length > 0 ? `${parts.join(' + ')} = ${s.totalCuts} lần cắt` : `${s.totalCuts} lần cắt`;
}

/**
 * Máy cắt của một dòng loại sắt: máy BE ghi; dòng KHẢ THI mà chưa ghi máy = phương án cũ (trước khi có MC Tự động) = MC Laser.
 * Dòng không khả thi chưa ghi máy thì chưa biết (null). MỘT quy tắc cho mọi màn (KHSX, Sếp, Phôi, Admin, in/Excel).
 */
export function lineMachine(line: { machine?: SolverMachine | null; feasible?: boolean }): SolverMachine | null {
  return line.machine ?? (line.feasible ? 'laser' : null);
}

/**
 * Máy cắt của cả phương án (xem lineMachine). 13/11/2026: phương án MC Tự động có thể có dòng tính theo cắt từng cây (quy cách
 * ngoài bảng số cây/bó -> dòng mang máy laser), nên CÓ dòng MC Tự động thì cả phương án là MC Tự động; không có thì lấy máy của
 * dòng đầu tiên biết máy như trước.
 */
export function linesMachine(lines: { machine?: SolverMachine | null; feasible?: boolean }[] | null | undefined): SolverMachine | null {
  let first: SolverMachine | null = null;
  for (const l of lines ?? []) {
    const m = lineMachine(l);
    if (m === 'tu_dong') return m;
    if (m && !first) first = m;
  }
  return first;
}

// ── Lớp máy của nhóm cây trong kiểu cắt (13/11/2026): MC Tự động / MC Laser (cây có đoạn dập lỗ ô van) ─────────────

/** Xưởng không có laze (laserAllowed=false, vd Phước An): mọi cây đều lên MC Tự động, lỗ ô van công nhân làm tay. */
const MANUAL_HOLE_LABEL = 'MC Tự động · lỗ làm tay';

/** Nhãn lớp máy của một nhóm cây: TU_DONG -> "MC Tự động"; LASER -> "MC Laser", hoặc "MC Tự động · lỗ làm tay" khi xưởng không có laze. */
export function patternGroupLabel(group: Pick<CuttingPatternMachineGroup, 'machineClass'>, laserAllowed: boolean): string {
  if (group.machineClass === 'TU_DONG') return MACHINE_LABEL.tu_dong;
  return laserAllowed ? 'MC Laser' : MANUAL_HOLE_LABEL;
}

/** Chiều dài mm kiểu Việt, không phụ thuộc ICU: 1200 -> "1.200", 427.5 -> "427,5" (khớp cách ghi mm ở màn Tối ưu cắt sắt). */
function fmtMmVi(n: number): string {
  return fmtNum(n);
}

/** "đoạn dập 425 mm × 2"; nhiều chiều dài nối "; ". Không có đoạn dập -> "". */
export function punchedSegmentsText(group: Pick<CuttingPatternMachineGroup, 'punchedSegments'>): string {
  return (group.punchedSegments ?? [])
    .map((s) => `đoạn dập ${fmtMmVi(s.cutLengthMm)} mm × ${s.countPerBar}`)
    .join('; ');
}

/** Câu phụ ngắn giải thích vì sao nhóm nằm ở máy đó; null khi không cần (cây không có đoạn dập). */
export function groupHint(group: Pick<CuttingPatternMachineGroup, 'machineClass' | 'punchedSegments'>, laserAllowed: boolean): string | null {
  if (laserAllowed) return group.machineClass === 'LASER' ? 'Có đoạn dập lỗ ô van: không cắt máy tự động' : null;
  return (group.punchedSegments ?? []).length > 0 ? 'Xưởng không có laze: lỗ công nhân làm tay' : null;
}

/** Tên biến màu CSS của huy hiệu lớp máy (đã có sẵn trong theme): tự động trung tính, laze đỏ nhạt.
 *  Xưởng không có laze thì mọi nhóm là MC Tự động -> màu trung tính. */
export function patternGroupColors(machineClass: PatternMachineClass, laserAllowed: boolean): { bg: string; color: string } {
  if (machineClass === 'TU_DONG' || !laserAllowed) return { bg: 'var(--bg-eceff1)', color: 'var(--fg-546e7a)' };
  return { bg: 'var(--bg-fee2e2)', color: 'var(--fg-b91c1c)' };
}

/** Chữ thuần của cột Máy cho 1 kiểu cắt (in, Excel, bảng gọn): 1 nhóm -> "Ưu tiên laze · đoạn dập 425 mm × 2 (1 lỗ ô van)";
 *  nhiều nhóm -> "50 cây · Bắt buộc laze · đoạn dập ... | 10 cây · MC Tự động". Chưa phân loại -> "". */
export function patternMachineText(groups: CuttingPatternMachineGroup[] | null | undefined, laserAllowed = true): string {
  const list = groups ?? [];
  const parts = list.map((g) => {
    const items = [patternGroupLabel(g, laserAllowed), punchedSegmentsText(g)].filter((x) => x !== '');
    if (list.length > 1) items.unshift(`${g.bars} cây`);
    return items.join(' · ');
  });
  return parts.join(' | ');
}

/** Tổng số cây theo lớp máy của cả loại sắt (dòng tóm tắt "Theo loại cây"). Kiểu cắt chưa có machineGroups thì không tính. */
export function machineClassTotals(patterns: Pick<CuttingProposalPattern, 'machineGroups'>[] | null | undefined): Record<PatternMachineClass, number> {
  const totals: Record<PatternMachineClass, number> = { TU_DONG: 0, LASER: 0 };
  for (const p of patterns ?? []) for (const g of p.machineGroups ?? []) totals[g.machineClass] += g.bars;
  return totals;
}

/** "60 cây MC Tự động · 50 cây MC Laser" (bỏ lớp = 0); xưởng không có laze: "N cây MC Tự động · lỗ làm tay". null khi không có nhóm nào. */
export function machineClassSummaryText(patterns: Pick<CuttingProposalPattern, 'machineGroups'>[] | null | undefined, laserAllowed = true): string | null {
  const t = machineClassTotals(patterns);
  const parts: string[] = [];
  if (t.TU_DONG > 0) parts.push(`${t.TU_DONG} cây ${MACHINE_LABEL.tu_dong}`);
  if (t.LASER > 0) parts.push(laserAllowed ? `${t.LASER} cây MC Laser` : `${t.LASER} cây ${MANUAL_HOLE_LABEL}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
