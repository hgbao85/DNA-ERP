// Entity dùng cho AuditLogTimeline — mọi thao tác nhập/duyệt/từ chối/gửi lại trên 1 SKU (PlanForm),
// từ cả 4 account chuyên trách nhập liệu lẫn KHSX/Sếp duyệt.
export const PLANFORM_ENTITY = 'PlanForm'

/** Định mức mảnh (Sắt/Dây) đã được KHSX duyệt xong và gửi bộ phận nhập định mức chi tiết — tức
 *  SKU đã rời khỏi WAITING_PARTS/APPROVED_PARTS. Các trang nhập định mức chi tiết (Sơn/Đinh, Phụ
 *  kiện, Bao bì) chỉ được liệt kê/nhập cho những SKU thỏa điều kiện này — nếu không sẽ cho nhập
 *  chi tiết ngay từ khi mảnh còn chưa xong, sai thứ tự flow hiện tại (mảnh trước, chi tiết sau). */
export function isPartsApproved(status: string): boolean {
  return ['WAITING_DETAIL', 'APPROVED_DETAIL', 'WAITING_QLSX_APPROVAL', 'WAITING_BOSS_APPROVAL', 'APPROVED'].includes(status)
}

/** Trạng thái vòng đời của một SKU (PlanForm) trong luồng Kế hoạch sản xuất. */
export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  WAITING_DETAIL:  { label: 'Chờ nhập định mức chi tiết', color: '#b45309', bg: '#fef3c7' },
  WAITING_PARTS:   { label: 'Chờ nhập định mức mảnh',     color: '#c2410c', bg: '#ffedd5' },
  APPROVED_DETAIL: { label: 'Duyệt ĐM chi tiết', color: '#1d4ed8', bg: '#dbeafe' },
  APPROVED_PARTS:  { label: 'Duyệt mảnh',        color: '#7c3aed', bg: '#ede9fe' },
  WAITING_QLSX_APPROVAL: { label: 'Chờ QLSX duyệt', color: '#c026d3', bg: '#fae8ff' },
  WAITING_BOSS_APPROVAL: { label: 'Chờ sếp duyệt', color: '#0369a1', bg: '#e0f2fe' },
  APPROVED:        { label: 'Đã duyệt',           color: '#16a34a', bg: '#dcfce7' },
  REJECTED:        { label: 'Từ chối',            color: '#dc2626', bg: '#fee2e2' },
}
