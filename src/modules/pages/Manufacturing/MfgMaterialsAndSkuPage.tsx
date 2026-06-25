import { useState } from 'react'
import MfgAllMaterialsPage from './MfgAllMaterialsPage'
import SkuListPage from './SkuListPage'
import PlanFormDashboardPage from '../../../modules/pages/ProductionPlan/PlanFormDashboardPage'

type SubTab = 'materials' | 'sku' | 'ds-sku'

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'materials', label: 'Tổng hợp vật tư' },
  { id: 'sku',       label: 'SKU' },
  { id: 'ds-sku',    label: 'Danh sách SKU' },
]

export default function MfgMaterialsAndSkuPage() {
  const [sub, setSub] = useState<SubTab>('materials')

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {SUBTABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: sub === t.id ? 700 : 400,
              border: 'none', borderRadius: 0, cursor: 'pointer', background: 'transparent',
              color: sub === t.id ? '#e65100' : 'var(--text2)',
              borderBottom: sub === t.id ? '2px solid #e65100' : '2px solid transparent',
              marginBottom: -1,
            }}
          >{t.label}</button>
        ))}
      </div>

      {sub === 'materials' && <MfgAllMaterialsPage />}
      {sub === 'sku'       && <SkuListPage />}
      {sub === 'ds-sku'    && <PlanFormDashboardPage />}
    </div>
  )
}
