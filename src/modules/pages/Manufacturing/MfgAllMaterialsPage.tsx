import VatTuDashboardPage from '../ProductionPlan/VatTuDashboardPage'

interface Props {
  warehouseCode?: string
}

/** Tổng hợp vật tư — danh mục Vật tư (Admin > Vật tư) kèm tồn kho thật, lọc theo đúng 1 kho cụ
 *  thể khi có warehouseCode, hoặc toàn bộ mọi kho khi không truyền (Boss/Tổng kho).
 *  Không tự vẽ tiêu đề riêng (2026-09-29, sửa trùng tiêu đề) — VatTuDashboardPage đã tự có tiêu đề
 *  + subtitle động (tên kho thật + tổng số vật tư), thêm 1 tiêu đề tĩnh ở đây chỉ bị lặp lại vô ích. */
export default function MfgAllMaterialsPage({ warehouseCode }: Props = {}) {
  return <VatTuDashboardPage warehouseCode={warehouseCode} />
}
