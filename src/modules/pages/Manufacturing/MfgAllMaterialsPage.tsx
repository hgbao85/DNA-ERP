import VatTuDashboardPage from '../ProductionPlan/VatTuDashboardPage'

interface Props {
  warehouseCode?: string
}

/** Tổng hợp vật tư — danh mục Vật tư (Admin > Vật tư) kèm tồn kho thật, lọc theo đúng 1 kho cụ
 *  thể khi có warehouseCode, hoặc toàn bộ mọi kho khi không truyền (Boss/Tổng kho). */
export default function MfgAllMaterialsPage({ warehouseCode }: Props = {}) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tổng hợp vật tư</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>
        {warehouseCode ? `Vật tư của kho hiện tại` : 'Toàn bộ vật tư từ các kho'}
      </p>
      <VatTuDashboardPage warehouseCode={warehouseCode} />
    </div>
  )
}
