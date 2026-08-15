// Entity dùng cho AuditLogTimeline — mọi thao tác nhập/duyệt/từ chối/gửi lại trên 1 SKU,
// từ cả 4 account chuyên trách nhập liệu lẫn KHSX/Sếp duyệt. Giá trị 'PlanForm' khớp tên
// Prisma model ở BE (không đổi cùng lúc với route/endpoint) - xem audit-log.extension.ts.
export const SKU_ENTITY = 'PlanForm'

/** Trạng thái vòng đời của một SKU trong luồng duyệt định mức. Mảnh và chi tiết giờ là 2 nhánh
 *  độc lập tiến song song (xem Sku.manhForwardedAt/detailForwardedAt ở types/sku.ts) nên chỉ còn
 *  3 khoá pipeline (IN_PROGRESS/WAITING_BOSS_APPROVAL/APPROVED) - KHÔNG xoá khoá REJECTED dù
 *  pf.status không bao giờ mang giá trị này: StatusBadge dùng chung map này để hiển thị cả trạng
 *  thái tổng lẫn quyết định duyệt/từ chối riêng từng nhánh (manhReviewStatus.status /
 *  quotaManagement.reviewStatus.status, có thể là APPROVED/REJECTED) - xem SKUDetail.tsx. */
export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  IN_PROGRESS:           { label: 'Đang làm định mức', color: '#b45309', bg: '#fef3c7' },
  WAITING_BOSS_APPROVAL: { label: 'Chờ sếp duyệt',      color: '#0369a1', bg: '#e0f2fe' },
  APPROVED:              { label: 'Đã duyệt',           color: '#16a34a', bg: '#dcfce7' },
  REJECTED:              { label: 'Từ chối',            color: '#dc2626', bg: '#fee2e2' },
}
