import { useState } from 'react'
import SKUListPage from '../ProductionPlan/SKUListPage'
import VatTuDashboardPage from '../ProductionPlan/VatTuDashboardPage'

type Section = 'materials' | 'sku'

/** Tổng hợp vật tư/SKU — hai mục: Vật tư (VatTuDashboardPage) và SKU (danh sách đã duyệt). */
export default function MfgAllMaterialsPage() {
  const [section, setSection] = useState<Section>('materials')

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tổng hợp vật tư/SKU</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>
        Toàn bộ vật tư từ các kho và danh sách SKU đã duyệt
      </p>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {(['materials', 'sku'] as Section[]).map(s => {
          const labels: Record<Section, string> = { materials: 'Vật tư', sku: 'SKU' }
          const active = section === s
          return (
            <button
              key={s}
              onClick={() => setSection(s)}
              style={{
                padding: '7px 18px', fontSize: 13, fontWeight: active ? 700 : 400,
                border: 'none', background: 'none', cursor: 'pointer',
                color: active ? '#e65100' : 'var(--text3)',
                borderBottom: active ? '2px solid #e65100' : '2px solid transparent',
                marginBottom: -1,
              }}
            >{labels[s]}</button>
          )
        })}
      </div>

      {section === 'materials' && <VatTuDashboardPage />}
      {section === 'sku' && <SKUListPage />}
    </div>
  )
}
