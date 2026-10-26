/**
 * Máy cắt của bộ giải "Đề xuất thanh sắt" (MC Laser / MC Tự động) - nhãn + cách đọc kết quả cắt theo bó.
 * Dùng chung cho Tối ưu cắt sắt (KHSX), Lệnh sản xuất (Sếp/QLSX), Hướng dẫn cắt (Phôi), Admin.
 */
import type { SolverMachine } from '../types/admin';
import type { CuttingBundleSummary, PatternBundles } from '../services/cutting-proposals-api';

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

/** Máy cắt của cả phương án: máy của dòng đầu tiên biết máy (xem lineMachine). */
export function linesMachine(lines: { machine?: SolverMachine | null; feasible?: boolean }[] | null | undefined): SolverMachine | null {
  for (const l of lines ?? []) {
    const m = lineMachine(l);
    if (m) return m;
  }
  return null;
}

/** Số thập phân kiểu Việt (dấu phẩy) cho % hao hụt trên các màn kết quả cắt: 0,27% - cùng cách số mm đang hiển thị. */
export function fmtPercent(n: number | string, digits = 2): string {
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
