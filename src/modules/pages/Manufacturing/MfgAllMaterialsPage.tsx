import VatTuDashboardPage, { type Cat } from '../ProductionPlan/VatTuDashboardPage'

interface Props {
  limitCats?: Cat[]
}

/** Tổng hợp vật tư — hiển thị toàn bộ vật tư từ các kho, hoặc lọc theo nhóm kho cụ thể. */
export default function MfgAllMaterialsPage({ limitCats }: Props = {}) {
  const CAT_LABEL: Record<string, string> = { sat: 'Sắt', daySon: 'Dây/Sơn', vatTuPhuKien: 'Phụ kiện', baoBiDongGoi: 'Bao bì', manh: 'Mảnh', thanhPham: 'Thành phẩm', vatTuThanhPham: 'Vật tư thành phẩm' }
  const subtitle = limitCats
    ? `Vật tư kho: ${limitCats.map(c => CAT_LABEL[c] ?? c).join(', ')}`
    : 'Toàn bộ vật tư từ các kho'

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tổng hợp vật tư</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>{subtitle}</p>
      <VatTuDashboardPage limitCats={limitCats} />
    </div>
  )
}
