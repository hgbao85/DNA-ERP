// Entity dùng cho AuditLogTimeline — mọi thao tác nhập/duyệt/từ chối/gửi lại trên 1 SKU (PlanForm),
// từ cả 4 account chuyên trách nhập liệu lẫn KHSX/Sếp duyệt.
export const PLANFORM_ENTITY = 'PlanForm'

/** Trạng thái vòng đời của một SKU (PlanForm) trong luồng Kế hoạch sản xuất. */
export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  WAITING_DETAIL:  { label: 'Chờ nhập định mức chi tiết', color: '#b45309', bg: '#fef3c7' },
  WAITING_PARTS:   { label: 'Chờ nhập định mức mảnh',     color: '#c2410c', bg: '#ffedd5' },
  APPROVED_DETAIL: { label: 'Duyệt ĐM chi tiết', color: '#1d4ed8', bg: '#dbeafe' },
  APPROVED_PARTS:  { label: 'Duyệt mảnh',        color: '#7c3aed', bg: '#ede9fe' },
  WAITING_BOSS_APPROVAL: { label: 'Chờ sếp duyệt', color: '#0369a1', bg: '#e0f2fe' },
  APPROVED:        { label: 'Đã duyệt',           color: '#16a34a', bg: '#dcfce7' },
  REJECTED:        { label: 'Từ chối',            color: '#dc2626', bg: '#fee2e2' },
}
