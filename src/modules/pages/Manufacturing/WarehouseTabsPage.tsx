import { useState } from 'react'
import MfgWarehousesPage, { WAREHOUSE_GROUPS } from './MfgWarehousesPage'

export default function WarehouseTabsPage() {
  const [key, setKey] = useState(WAREHOUSE_GROUPS[0].key)

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {WAREHOUSE_GROUPS.map(g => (
          <button
            key={g.key}
            onClick={() => setKey(g.key)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: key === g.key ? 700 : 400,
              border: 'none', borderRadius: 0, cursor: 'pointer', background: 'transparent',
              color: key === g.key ? '#e65100' : 'var(--text2)',
              borderBottom: key === g.key ? '2px solid #e65100' : '2px solid transparent',
              marginBottom: -1,
            }}
          >{g.label}</button>
        ))}
      </div>

      <MfgWarehousesPage groupKey={key} />
    </div>
  )
}
