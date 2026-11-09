/** Adapter "Đồng bộ Phôi – Hàn" (2026-11-04, changelog BE 2026-10-08 mục 59): FE ⇄ BE `GET /piece-sync-board`. BE tính số mảnh
 *  Phôi đã đồng bộ (ƯỚC TÍNH, vì Phôi báo theo cỡ đoạn chứ không theo mảnh) - FE chỉ hiển thị, không tự tính lại.
 *  Khuôn dữ liệu là bản sao của BE src/modules/piece-sync-board/piece-sync-board.types.ts - sửa 1 bên thì sửa cả bên kia. */
import { http } from './core/http';

import type { ProcessStep } from '../types/sku';

// ĐỦ CÔNG ĐOẠN (anh Nhân 04/11, changelog BE 2026-10-08 mục 63 ý 2 → mục 64; thay "chỉ Cắt" của mục 61): 1 đoạn chỉ vào đồng bộ khi
// đã qua Cắt + mọi công đoạn phụ của dòng định mức (uốn, dập, tán, nhấn…).

/** Chép y hệt BE: 'PASSED_QC' = chỉ đếm đoạn đã ĐẠT KCS (đề xuất IT, câu 1.4 chờ anh Nhân) · 'REPORTED' = đã báo − KCS lỗi. Dùng để đổi
 *  chữ giải thích trên màn (BE mới là nơi tính). */
export const PIECE_SYNC_COUNT_MODE: 'PASSED_QC' | 'REPORTED' = 'PASSED_QC';

export interface PieceSyncLine {
  segmentSpecId: string;
  materialCode: string;
  materialName: string;
  /** Quy cách xưởng dùng để gọi tên (vd "15" = V15, "10x20" = hộp 10x20); null nếu vật tư chưa khai. */
  materialSpec: string | null;
  cutLengthMm: number;
  /** Số đoạn trên 1 mảnh. */
  qtyPerPiece: number;
  /** Cắt + công đoạn phụ của dòng, đúng thứ tự nghiệp vụ - luôn có 'CAT' đứng đầu. */
  steps: ProcessStep[];
  /** Số đoạn đã qua ĐỦ mọi công đoạn của dòng (đếm theo PIECE_SYNC_COUNT_MODE) chia được cho dòng này. */
  usableQty: number;
  makeablePieces: number;
  /** Công đoạn ít đoạn nhất khi dòng CHƯA đủ ("nghẽn ở"); null khi đã đủ. */
  limitingStep: ProcessStep | null;
}

export interface PieceSyncRow {
  productionInvoiceId: string;
  piCode: string;
  productionOrderId: string;
  skuCode: string;
  skuName: string | null;
  orderQuantity: number;
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  qtyPerUnit: number;
  requiredQty: number;
  /** Đủ công đoạn, đếm theo PIECE_SYNC_COUNT_MODE. null = không có định mức Phôi cho mảnh này hoặc không tải được tiến độ Phôi của PI. */
  phoiSyncedQty: number | null;
  /** "Chưa qua KCS": số mảnh sẽ đồng bộ thêm nếu phần đã báo mà chưa có kết quả KCS đều đạt (≥ 0); null khi phoiSyncedQty null.
   *  BE cũ chưa trả → undefined, coi như null. */
  phoiPendingQcQty?: number | null;
  syncPercent: number | null;
  /** Hàn đã báo (đạt + chờ KCS + chưa gửi KCS), chặn trần ở requiredQty. */
  hanDoneQty: number;
  /** Hàn báo trong hôm nay (giờ VN). */
  hanTodayQty: number;
  /** Còn chưa hàn (phôi đã đồng bộ) = max(0, phoiSyncedQty − hanDoneQty). */
  notWeldedQty: number | null;
  /** Phôi chưa đồng bộ = max(0, requiredQty − phoiSyncedQty). */
  phoiNotSyncedQty: number | null;
  /** Hàn đã báo nhiều hơn số Phôi đồng bộ ước tính. */
  hanAheadOfPhoi: boolean;
  /** Mảnh có Sắt tự tính (vd PAT): số mảnh Phôi tự báo ở Vật tư TP; null nếu mảnh không có. */
  selfCalcPieceQty: number | null;
  lines: PieceSyncLine[];
}

export interface PieceSyncBoard {
  today: string;
  generatedAt: string;
  failedSources: string[];
  unassignedPhoiPiIds: string[];
  rows: PieceSyncRow[];
}

/** Không truyền = mọi lệnh đang chạy (cùng tập với Bảng mốc). Có = chỉ các PI đó (màn Hàn dùng để lấy "Thực có"). */
export async function getPieceSyncBoard(productionInvoiceIds?: string[]): Promise<PieceSyncBoard> {
  return http.get<PieceSyncBoard>('/piece-sync-board', {
    params: productionInvoiceIds?.length ? { productionInvoiceIds: productionInvoiceIds.join(',') } : undefined,
  });
}
