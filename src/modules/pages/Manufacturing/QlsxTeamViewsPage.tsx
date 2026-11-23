'use client'

/** QLSX xem các màn của tổ Phôi / Hàn / Sơn (chỉ đọc): Hướng dẫn cắt, Kho phôi, Khung hàn, Mảnh chờ đan. */

import { useState } from 'react'
import HuongDanCatPage from '../Phoi/HuongDanCatPage'
import KhoPhoiPage from '../Phoi/KhoPhoiPage'
import KhungHanPage from '../Han/KhungHanPage'
import ManhChoDanPage from '../Son/ManhChoDanPage'

export type TeamViewTab = 'huong-dan-cat' | 'kho-phoi' | 'khung-han' | 'manh-cho-dan'

export const TEAM_VIEW_TABS: { id: TeamViewTab; label: string }[] = [
  { id: 'huong-dan-cat', label: 'Hướng dẫn cắt' },
  { id: 'kho-phoi', label: 'Kho phôi' },
  { id: 'khung-han', label: 'Khung hàn' },
  { id: 'manh-cho-dan', label: 'Mảnh chờ đan' },
]

export default function QlsxTeamViewsPage({ initialSub = 'huong-dan-cat' }: { initialSub?: TeamViewTab }) {
  const [sub, setSub] = useState<TeamViewTab>(initialSub)
  return (
    <div>
      <div role="tablist" aria-label="Xem các tổ" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-4)' }}>
        {TEAM_VIEW_TABS.map(t => {
          const active = sub === t.id
          return (
            <button key={t.id} role="tab" aria-selected={active} onClick={() => setSub(t.id)}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: '1px solid',
                borderColor: active ? 'var(--fg-e65100)' : 'var(--border)',
                background: active ? 'var(--bg-fff3e0)' : 'var(--surface)',
                color: active ? 'var(--fg-e65100)' : 'var(--text2)',
              }}>
              {t.label}
            </button>
          )
        })}
      </div>
      {/* Chỉ xem: KhoPhoiPage không bật kiểm kê (canStocktake mặc định false). */}
      {sub === 'huong-dan-cat' && <HuongDanCatPage />}
      {sub === 'kho-phoi' && <KhoPhoiPage />}
      {sub === 'khung-han' && <KhungHanPage />}
      {sub === 'manh-cho-dan' && <ManhChoDanPage />}
    </div>
  )
}
