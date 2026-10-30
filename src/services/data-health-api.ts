/** Adapter "Kiểm tra dữ liệu" (2026-10-28): FE ⇄ BE module `data-health` - phép kiểm chỉ đọc, tự chạy mỗi ngày 1 lần + nút "Kiểm ngay". */
import { http } from './core/http';

export type DataHealthSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DataHealthFinding {
  id: string;
  entityKey: string;
  /** Các cột của phép kiểm, khoá theo `DataHealthCheck.columns[].key`. */
  detail: Record<string, string | number | boolean | null>;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Thấy lần đầu (hoặc thấy lại sau khi đã hết) ở lần kiểm gần nhất. */
  isNew: boolean;
}

export interface DataHealthCheck {
  code: string;
  title: string;
  severity: DataHealthSeverity;
  description: string;
  hint: string;
  columns: { key: string; label: string }[];
  /** Số dòng của lần kiểm gần nhất; -1 = phép kiểm lỗi; null = chưa kiểm lần nào. */
  lastCount: number | null;
  /** Lần kiểm gần nhất chạm trần số dòng - còn dòng chưa hiện. */
  truncated: boolean;
  findings: DataHealthFinding[];
}

export interface DataHealthRun {
  id: string;
  trigger: 'CRON' | 'MANUAL';
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

export interface DataHealthReport {
  /** Lần kiểm ĐÃ XONG gần nhất - số liệu các thẻ theo lần này. */
  lastRun: DataHealthRun | null;
  /** Lần mới hơn mà chưa xong (2026-10-29): đang chạy (error null) hoặc dừng giữa chừng (có error). Thiếu ở BE cũ. */
  pendingRun?: DataHealthRun | null;
  totalOpen: number;
  newCount: number;
  checks: DataHealthCheck[];
}

export async function getDataHealthReport(): Promise<DataHealthReport> {
  return http.get<DataHealthReport>('/data-health');
}

export async function runDataHealth(): Promise<DataHealthReport> {
  return http.post<DataHealthReport>('/data-health/run');
}
