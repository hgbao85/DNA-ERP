/**
 * Ghi số kiểu Việt dùng chung cho các màn cắt sắt và bản in (13/11/2026, review UI mục 8 + 21):
 * chiều dài cây "5.030 mm", phần trăm "0,38%", số cây "6 cây". Dấu chấm ngăn nghìn, dấu phẩy thập phân.
 *
 * - `fmtNum` / `fmtMm` / `fmtBars` không phụ thuộc ICU của máy (cùng cách các màn cũ đang làm bằng regex).
 * - `fmtPercent` / `fmtPct` giữ đúng cách cũ của `fmtPercent` (toLocaleString 'vi-VN') để số % không đổi so với trước.
 * - Thiếu số (null / undefined / chuỗi rỗng / NaN) -> "—".
 */

const DASH = '—';

function toNumber(n: number | string | null | undefined): number | null {
  if (n == null || n === '') return null;
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : null;
}

/**
 * 5030 -> "5.030"; 427.5 -> "427,5"; -1200 -> "-1.200".
 * `digits` = số chữ số thập phân cố định (làm tròn); bỏ trống = giữ tối đa 3 số lẻ, bỏ số 0 thừa.
 */
export function fmtNum(n: number | string | null | undefined, digits?: number): string {
  const v = toNumber(n);
  if (v == null) return DASH;
  const abs = Math.abs(v);
  const s = digits != null ? abs.toFixed(digits) : String(Math.round(abs * 1000) / 1000);
  const [int, dec] = s.split('.');
  const out = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? `,${dec}` : '');
  // Không ghi "-0" / "-0,00" khi số âm làm tròn về 0.
  return v < 0 && /[1-9]/.test(out) ? `-${out}` : out;
}

/** 5030 -> "5.030 mm"; 2.5 -> "2,5 mm". */
export function fmtMm(n: number | string | null | undefined): string {
  const v = toNumber(n);
  return v == null ? DASH : `${fmtNum(v)} mm`;
}

/** 6 -> "6 cây"; 1200 -> "1.200 cây". */
export function fmtBars(n: number | string | null | undefined): string {
  const v = toNumber(n);
  return v == null ? DASH : `${fmtNum(v)} cây`;
}

/** 0.3 -> "0,30" (chỉ phần số, không kèm %). Giữ nguyên cách cũ của `fmtPercent` ở utils/cutMachine. */
export function fmtPercent(n: number | string, digits = 2): string {
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 0.3 -> "0,30%"; (1, 0) -> "1%". */
export function fmtPct(n: number | string | null | undefined, digits = 2): string {
  const v = toNumber(n);
  return v == null ? DASH : `${fmtPercent(v, digits)}%`;
}
