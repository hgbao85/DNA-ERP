/**
 * Phần A – Đợt 9 (YC2): adapter "Sửa kế hoạch + Excel + Sếp duyệt lại" ⇄ BE `/deadline-changes`, `/deadline-plan`. Kiểu dưới đây CHÉP Y HỆT
 * hợp đồng BE `src/modules/production-invoices/deadline-changes/deadline-changes.types.ts` (BE là nguồn đúng; Sếp đã trả lời 4 câu 06/11 - chú thích ở
 * đầu file BE). FE không tự quyết dòng nào sửa thẳng / chờ duyệt - BE trả `kind`.
 */
import { http, withIdempotencyKey } from './core/http';

/** Q9-2 (Sếp chọn B): true = thứ tự mốc ngược là LỖI (chặn dòng); false = chỉ cảnh báo. */
export const ORDER_VIOLATION_BLOCKS = true;

/** Các mốc sửa được, ĐÚNG thứ tự cột Excel / form (Phú An). Hạn giao KHÔNG nằm ở đây (2.4). */
export const DEADLINE_FIELDS = [
  { key: 'materialDeadline', label: 'Mua VT khung & đan' },
  { key: 'stage.PHOI_START', label: 'Bắt đầu Phôi' },
  { key: 'stage.FRAME_PHOI', label: 'Phôi' },
  { key: 'stage.FRAME_HAN', label: 'Hàn' },
  { key: 'stage.FRAME_SON', label: 'Sơn' },
  { key: 'stage.FRAME', label: 'Khung' },
  { key: 'stage.WEAVING', label: 'Nhập đan' },
  { key: 'stage.TRANSFER_CHECK', label: 'Chuyền kiểm' },
  { key: 'finishedMaterialDeadline', label: 'Mua VT còn lại' },
  { key: 'stage.PACKAGING_START', label: 'Bắt đầu đóng gói' },
  { key: 'stage.PACKAGING', label: 'Đóng gói' },
] as const;

export type DeadlineFieldKey = (typeof DEADLINE_FIELDS)[number]['key'];
/** Giá trị mốc theo khoá - chỉ chứa khoá có mặt; null = chưa có mốc. */
export type DeadlineValues = Partial<Record<DeadlineFieldKey, string | null>>;

export interface DeadlineFieldChange {
  key: DeadlineFieldKey;
  label: string;
  from: string | null;
  to: string | null;
  /** Q9-1: true = mốc TỰ DỜI theo mốc sản xuất phía trước (không phải ô KHSX gõ). Chỉ bản xem trước Excel gắn; vắng = KHSX gõ. */
  auto?: boolean;
}

export type DeadlineChangeSource = 'MANUAL' | 'EXCEL';
/** Lô: PENDING còn yêu cầu chờ · DECIDED Sếp đã quyết hết (duyệt / từ chối từng yêu cầu) · CANCELLED KHSX huỷ hết. */
export type DeadlineChangeBatchStatus = 'PENDING' | 'DECIDED' | 'CANCELLED';
export type DeadlineChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface UserRef {
  id: string;
  name: string;
}

export interface DeadlineChangeRequestDto {
  id: string;
  itemId: string;
  piId: string;
  /** Mã lệnh của dòng SKU (số LSX, chưa có thì mã lệnh của PI) - không hiện mã PI. */
  lenhCode: string;
  skuCode: string;
  skuName: string | null;
  quantity: number;
  status: DeadlineChangeRequestStatus;
  oldValues: DeadlineValues;
  newValues: DeadlineValues;
  /** Chỉ các mốc thật sự đổi, theo thứ tự DEADLINE_FIELDS. */
  changes: DeadlineFieldChange[];
  /** Cảnh báo trên giá trị MỚI (vd thứ tự mốc ngược) - tính lúc đọc. */
  warnings: string[];
  /** Lý do khi REJECTED (= decisionNote của lô). */
  rejectReason: string | null;
  /**
   * Q9-3: yêu cầu PENDING mà Sếp KHÔNG duyệt được nữa (tính lúc đọc) - lệnh đã bắt đầu sản xuất (cắt phôi) / Kết thúc / huỷ. Có giá trị → khoá
   * ô chọn, chỉ từ chối được (BE `decide` cũng chặn). null = duyệt được. BE cũ chưa trả → coi như null.
   */
  blockedReason?: string | null;
}

export interface DeadlineChangeBatchDto {
  id: string;
  source: DeadlineChangeSource;
  status: DeadlineChangeBatchStatus;
  requestedBy: UserRef;
  requestedAt: string;
  decidedBy: UserRef | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** Ghi chú KHSX lúc gửi (vd tên file Excel). */
  note: string | null;
  counts: { total: number; pending: number; approved: number; rejected: number; cancelled: number };
  requests: DeadlineChangeRequestDto[];
}

/** 1 dòng nhập (form hoặc Excel): mốc mới của 1 dòng SKU. `expectedOld` (Excel) = giá trị lúc xuất file - khác hiện tại thì lỗi (V9-1). */
export interface DeadlineEntryInput {
  itemId: string;
  newValues: DeadlineValues;
  expectedOld?: DeadlineValues;
}

export type DeadlineEntryKind = 'APPLY' | 'NEEDS_APPROVAL' | 'NO_CHANGE' | 'ERROR';

export interface DeadlineEntryCheck {
  itemId: string;
  lenhCode: string;
  skuCode: string;
  kind: DeadlineEntryKind;
  changes: DeadlineFieldChange[];
  errors: string[];
  warnings: string[];
}

/** Kết quả 1 lần lưu (form "Sửa thời hạn" hoặc Xác nhận Excel). */
export interface DeadlineSaveResult {
  /** Dòng ghi thẳng (chưa duyệt). */
  applied: DeadlineEntryCheck[];
  /** Lô chờ Sếp duyệt lại cho các dòng đã duyệt (null = không có dòng nào). */
  batch: DeadlineChangeBatchDto | null;
  /** Dòng bị bỏ vì lỗi (chỉ Excel - form thì lỗi là 400 cả lần). */
  skipped: DeadlineEntryCheck[];
}

/** Sếp quyết 1 lô: yêu cầu có trong `approveRequestIds` → APPROVED (áp mốc), yêu cầu PENDING còn lại → REJECTED (cần `rejectReason`). */
export interface DecideDeadlineBatchInput {
  approveRequestIds: string[];
  rejectReason?: string;
}

/** Trạng thái đổi mốc đang chờ của 1 dòng SKU - gắn vào item trong response PI (`pendingDeadlineChange`). */
export interface PendingDeadlineChangeRef {
  requestId: string;
  batchId: string;
  requestedAt: string;
  changes: DeadlineFieldChange[];
}

/** Lịch sử đổi mốc của 1 dòng SKU (audit + các yêu cầu), mới nhất trước. */
export interface DeadlineHistoryEntry {
  at: string;
  by: UserRef | null;
  /** DIRECT sửa thẳng · REQUESTED gửi chờ Sếp · APPROVED Sếp duyệt (đã áp) · REJECTED Sếp từ chối · CANCELLED KHSX huỷ. */
  kind: 'DIRECT' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  source: DeadlineChangeSource | null;
  changes: DeadlineFieldChange[];
  note: string | null;
}

// ─── Excel (`/deadline-plan`) ─────────────────────────────────────────────────────────────────────

/** Q9-3: 'all' = mọi lệnh CHƯA BẮT ĐẦU sản xuất (chưa duyệt + đã duyệt chưa cắt) · 'approved' = chỉ phần đã duyệt chưa cắt. */
export type DeadlinePlanScope = 'all' | 'approved';

export interface DeadlineImportRow extends DeadlineEntryCheck {
  /** Số dòng trong file Excel (dòng tiêu đề = 1). */
  rowNumber: number;
}

export interface DeadlineImportPreview {
  fileName: string;
  /** Số dòng dữ liệu đọc được trong file. */
  totalRows: number;
  counts: { apply: number; needsApproval: number; noChange: number; error: number };
  /** Chỉ dòng có đổi hoặc có lỗi / cảnh báo (dòng NO_CHANGE không cảnh báo thì bỏ). */
  rows: DeadlineImportRow[];
  /** Gửi lại nguyên cho `POST /deadline-plan/commit` (BE kiểm lại hết). Chỉ gồm dòng APPLY + NEEDS_APPROVAL. */
  commitPayload: { fileName: string; items: DeadlineEntryInput[] };
}

/** Q9-4 (Sếp chọn B 06/11): true = Sếp được bỏ chọn từng yêu cầu trong lô; false = chỉ Duyệt / Từ chối cả lô (đúng v8). */
export const DEADLINE_PARTIAL_APPROVAL = true;

// ─── Sếp duyệt / KHSX xem lô ─────────────────────────────────────────────────────────────────────

/** `status`: 'PENDING' (mặc định) | 'DECIDED' | 'CANCELLED' | 'ALL'; `mine`: chỉ lô do mình gửi (KHSX). */
export async function getDeadlineChangeBatches(q: { status?: DeadlineChangeBatchStatus | 'ALL'; mine?: boolean } = {}): Promise<DeadlineChangeBatchDto[]> {
  return http.get<DeadlineChangeBatchDto[]>('/deadline-changes', { params: q });
}

export async function getDeadlineChangeBatch(batchId: string): Promise<DeadlineChangeBatchDto> {
  return http.get<DeadlineChangeBatchDto>(`/deadline-changes/${batchId}`);
}

/** Sếp quyết: yêu cầu trong danh sách → duyệt (áp mốc), yêu cầu chờ còn lại → từ chối (cần lý do). */
export async function decideDeadlineChangeBatch(batchId: string, input: DecideDeadlineBatchInput): Promise<DeadlineChangeBatchDto> {
  return http.post<DeadlineChangeBatchDto>(`/deadline-changes/${batchId}/decide`, input);
}

/** KHSX huỷ 1 yêu cầu còn chờ của mình (dòng SKU sửa lại được ngay). */
export async function cancelDeadlineChangeRequest(requestId: string): Promise<DeadlineChangeBatchDto> {
  return http.post<DeadlineChangeBatchDto>(`/deadline-changes/requests/${requestId}/cancel`);
}

/** Lịch sử đổi mốc của 1 dòng SKU (mới nhất trước). */
export async function getDeadlineHistory(itemId: string): Promise<DeadlineHistoryEntry[]> {
  return http.get<DeadlineHistoryEntry[]>(`/deadline-changes/items/${itemId}/history`);
}

// ─── Excel ─────────────────────────────────────────────────────────────────────────────────────────

/** File .xlsx kế hoạch (BE dựng) - FE chỉ tải về, không đọc. */
export async function downloadDeadlinePlan(scope: DeadlinePlanScope = 'all'): Promise<Blob> {
  return http.get<Blob>('/deadline-plan/export', { params: { scope }, responseType: 'blob' });
}

/** Tải file KHSX đã sửa lên để BE đọc + so (không ghi gì). */
export async function previewDeadlinePlan(file: File): Promise<DeadlineImportPreview> {
  const form = new FormData();
  form.append('file', file);
  // Client mặc định gửi JSON - phải nói rõ multipart (như uploads-api.ts), không thì axios biến FormData thành JSON.
  return http.post<DeadlineImportPreview>('/deadline-plan/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** Xác nhận: gửi lại đúng `commitPayload` của bản xem trước. */
export async function commitDeadlinePlan(payload: DeadlineImportPreview['commitPayload']): Promise<DeadlineSaveResult> {
  return http.post<DeadlineSaveResult>('/deadline-plan/commit', payload, withIdempotencyKey());
}
