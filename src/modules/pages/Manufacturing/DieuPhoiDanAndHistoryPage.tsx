import { useState } from 'react'
import DieuPhoiDanPage from './DieuPhoiDanPage'
import LichSuNhapDanPage from './LichSuNhapDanPage'

type SubTab = 'dieu-phoi' | 'lich-su'

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'dieu-phoi', label: 'Điều phối đan' },
  { id: 'lich-su',   label: 'Lịch sử nhập đan' },
]

interface Props { readOnly?: boolean }

export default function DieuPhoiDanAndHistoryPage({ readOnly }: Props) {
  const [sub, setSub] = useState<SubTab>('dieu-phoi')

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
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

      {sub === 'dieu-phoi' && <DieuPhoiDanPage readOnly={readOnly} />}
      {sub === 'lich-su'   && <LichSuNhapDanPage />}
    </div>
  )
}
