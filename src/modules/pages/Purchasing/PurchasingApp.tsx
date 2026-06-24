import { useState } from 'react'
import { LayoutList, ShoppingCart, Building2, LogOut, Grid } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import VatTuNCCPage from './VatTuNCCPage'
import TongQuanPage from './TongQuanPage'
import VatTuCanMuaPage from './VatTuCanMuaPage'

interface Props { onBack?: () => void }

type TabId = 'overview' | 'need' | 'suppliers'

export default function PurchasingApp({ onBack }: Props) {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<TabId>('suppliers')

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Tổng quan', icon: <LayoutList size={16} /> },
    { id: 'need', label: 'Vật tư cần mua', icon: <ShoppingCart size={16} /> },
    { id: 'suppliers', label: 'Vật tư – NCC', icon: <Building2 size={16} /> },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{ width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {onBack && (
              <button onClick={onBack} style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }} title="Trở về trang chủ">
                <Grid size={16} color="var(--text)" />
              </button>
            )}
            <div style={{ fontWeight: 700, fontSize: 14 }}>Mua hàng</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Đông Nam Á Corp</div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', marginBottom: 2,
                border: 'none', borderRadius: 'var(--radius)', background: active ? '#ede7f6' : 'transparent',
                color: active ? '#4527a0' : 'var(--text2)', fontWeight: active ? 600 : 400, fontSize: 13, textAlign: 'left', cursor: 'pointer',
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >{t.icon}{t.label}</button>
            )
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ede7f6', color: '#4527a0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Mua hàng</div>
            </div>
            <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất"><LogOut size={16} color="var(--text3)" /></button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {tab === 'suppliers' && <VatTuNCCPage />}
        {tab === 'overview' && <TongQuanPage />}
        {tab === 'need' && <VatTuCanMuaPage />}
      </div>
    </div>
  )
}
