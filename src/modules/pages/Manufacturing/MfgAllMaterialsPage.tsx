import VatTuDashboardPage from '../ProductionPlan/VatTuDashboardPage'

/** Tổng hợp vật tư — hiển thị toàn bộ vật tư từ các kho. */
export default function MfgAllMaterialsPage() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tổng hợp vật tư</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>
        Toàn bộ vật tư từ các kho
      </p>

      <VatTuDashboardPage />
    </div>
  )
}
