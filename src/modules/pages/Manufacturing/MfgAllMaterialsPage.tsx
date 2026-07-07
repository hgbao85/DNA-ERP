import VatTuDashboardPage, { type Cat } from '../ProductionPlan/VatTuDashboardPage'

interface Props {
  limitCats?: Cat[]
  combinedCats?: { id: string; label: string; cats: Cat[] }[]
  manhWarehouseCode?: string
}

/** Tổng hợp vật tư — hiển thị toàn bộ vật tư từ các kho, hoặc lọc theo nhóm kho cụ thể. */
export default function MfgAllMaterialsPage({ limitCats, combinedCats, manhWarehouseCode }: Props = {}) {
  const CAT_LABEL: Record<string, string> = { sat: 'Sắt', daySon: 'Dây/Sơn', vatTuPhuKien: 'Phụ kiện', baoBiDongGoi: 'Bao bì', manh: 'Mảnh', thanhPham: 'Thành phẩm', vatTuThanhPham: 'Vật tư thành phẩm', manhChuaDan: 'Mảnh chưa đan', manhDaDan: 'Mảnh đã đan' }
  const subtitle = limitCats
    ? `Vật tư kho: ${limitCats.map(c => CAT_LABEL[c] ?? c).join(', ')}`
    : 'Toàn bộ vật tư từ các kho'

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tổng hợp vật tư</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>{subtitle}</p>
      <VatTuDashboardPage limitCats={limitCats} combinedCats={combinedCats} manhWarehouseCode={manhWarehouseCode} />
    </div>
  )
}
