/** Adapter "Bảng mốc" (2026-10-29, changelog BE 2026-09-25 mục 32.24): FE ⇄ BE `GET /milestone-board`. BE tính trạng thái
 *  từng mốc của mỗi dòng SKU đang chạy so với hạn đã lưu - FE chỉ hiển thị, không tự tính lại. */
import { http } from './core/http';

export type MilestoneKey =
  | 'MUA_VT_KHUNG'
  | 'PHOI'
  | 'HAN'
  | 'SON'
  | 'KHUNG'
  | 'DAN'
  | 'MUA_VT_CON_LAI'
  | 'DONG_GOI'
  | 'HAN_GIAO';

export type MilestoneStatus = 'DONE' | 'NA' | 'UNKNOWN' | 'NO_DEADLINE' | 'ON_TRACK' | 'DUE_SOON' | 'LATE';

export interface MilestoneCell {
  key: MilestoneKey;
  label: string;
  /** Hạn đã lưu 'YYYY-MM-DD' (ngày VN) - null = chưa đặt hạn. */
  deadline: string | null;
  status: MilestoneStatus;
  /** Âm = đã trễ chừng ấy ngày. */
  daysLeft: number | null;
  percent: number;
  need: number | null;
  done: number | null;
  reason: string | null;
}

export interface MilestoneRow {
  itemId: string;
  piId: string;
  piCode: string;
  productionOrderId: string;
  skuCode: string;
  skuName: string | null;
  quantity: number;
  floorStage: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
  milestones: MilestoneCell[];
  worst: MilestoneStatus;
}

export interface MilestoneBoard {
  today: string;
  generatedAt: string;
  /** Nguồn tiến độ BE tải lỗi - mốc phụ thuộc nguồn đó hiện "Chưa biết". */
  failedSources: string[];
  rows: MilestoneRow[];
}

export async function getMilestoneBoard(): Promise<MilestoneBoard> {
  return http.get<MilestoneBoard>('/milestone-board');
}
