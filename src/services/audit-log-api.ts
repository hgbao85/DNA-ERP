/**
 * Adapter AUDIT LOG THẬT: FE ⇄ BE `GET /audit-logs` (khác `services/api.ts#getAllAuditLogs`,
 * vốn đọc mockStore trong trình duyệt - dùng cho mọi entity KHÁC chưa cutover sang BE thật).
 *
 * Dùng riêng cho PurchaseProposal (Phase 8/9, 2026-08-15, D.c1-no-audit-on-money-path): BE ghi
 * mọi chuyển trạng thái của PurchaseProposal tự động (AUDITED_MODELS) + quyết định chọn NCC/giá
 * ghi tay dưới tableName='PurchaseProposalQuote' (bảng con không auto-audit, xem
 * PurchaseProposalsService.auditQuoteDecision). BE chỉ trả `userId` (uuid) chứ không kèm tên -
 * FE tự tra qua getUsers().
 */
import { http } from './core/http';

export interface BeAuditLogEntry {
  id: string;
  userId: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  tableName: string;
  recordId: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

async function fetchAuditLogs(tableName: string, recordId: string): Promise<BeAuditLogEntry[]> {
  const res = await http.get<BeAuditLogEntry[] | { data: BeAuditLogEntry[] }>(
    `/audit-logs?tableName=${encodeURIComponent(tableName)}&recordId=${encodeURIComponent(recordId)}&limit=100`,
  );
  return Array.isArray(res) ? res : res.data;
}

/**
 * Gộp vết của chính đề xuất mua (PurchaseProposal, ghi tự động mọi chuyển trạng thái) + vết
 * quyết định NCC/giá (PurchaseProposalQuote, ghi tay ở approve()/requote() - xem service BE) -
 * cả hai đều dùng recordId = PurchaseProposal.id vì quote là con của item, không có id riêng dễ
 * tra ngược. Sắp theo thời gian tăng dần, đúng thứ tự AuditLogTimeline (component cũ) đang dùng.
 */
export async function getPurchaseProposalAuditTrail(proposalId: string): Promise<BeAuditLogEntry[]> {
  const [proposalLogs, quoteLogs] = await Promise.all([
    fetchAuditLogs('PurchaseProposal', proposalId),
    fetchAuditLogs('PurchaseProposalQuote', proposalId),
  ]);
  return [...proposalLogs, ...quoteLogs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
