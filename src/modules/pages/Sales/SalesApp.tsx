import { useState } from 'react'
import { ClipboardList, Users, History, LogOut, Grid, Menu, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useIsCompact, useIsMobile } from '../../../hooks/useMediaQuery'
import OrderManagementPage from './OrderManagementPage'
import CustomerManagementPage from './CustomerManagementPage'
import PurchaseHistoryPage from './PurchaseHistoryPage'

interface Props { onBack?: () => void }

type TabId = 'orders' | 'customers' | 'history'

export default function SalesApp({ onBack }: Props) {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<TabId>('orders')
  // Màn hình hẹp (< 900px): sidebar ẩn thành drawer mở qua nút ☰ trên thanh đầu trang.
  const isCompact = useIsCompact()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'orders',    label: 'Quản lí đơn hàng',  icon: <ClipboardList size={16} /> },
    { id: 'customers', label: 'Quản lí khách hàng', icon: <Users size={16} /> },
    { id: 'history',   label: 'Lịch sử mua hàng',   icon: <History size={16} /> },
  ]

  const selectTab = (id: TabId) => { setTab(id); setDrawerOpen(false) }

  const sidebar = (
    <div style={{ width: 210, flexShrink: 0, height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {onBack && (
            <button onClick={onBack} style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }} title="Trở về trang chủ">
              <Grid size={16} color="var(--text)" />
            </button>
          )}
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Bán hàng</div>
          {isCompact && (
            <button onClick={() => setDrawerOpen(false)} aria-label="Đóng menu" style={{ padding: 4, background: 'transparent', border: 'none', display: 'flex' }}>
              <X size={18} />
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Đông Nam Á Corp</div>
      </div>

      <nav style={{ flex: 1, padding: '4px 8px' }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => selectTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: isCompact ? '11px 10px' : '8px 10px', marginBottom: 2,
              border: 'none', borderRadius: 'var(--radius)', background: active ? '#e8f5e9' : 'transparent',
              color: active ? '#2e7d32' : 'var(--text2)', fontWeight: active ? 600 : 400, fontSize: 13, textAlign: 'left', cursor: 'pointer',
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >{t.icon}{t.label}</button>
          )
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Bán hàng</div>
          </div>
          <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất"><LogOut size={16} color="var(--text3)" /></button>
        </div>
      </div>
    </div>
  )

  const content = (
    <>
      {tab === 'orders'    && <OrderManagementPage />}
      {tab === 'customers' && <CustomerManagementPage />}
      {tab === 'history'   && <PurchaseHistoryPage />}
    </>
  )

  if (!isCompact) {
    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {sidebar}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>{content}</div>
      </div>
    )
  }

  const activeTab = TABS.find(t => t.id === tab)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => setDrawerOpen(true)} aria-label="Mở menu" style={{ padding: 6, background: 'transparent', border: 'none', display: 'flex' }}>
          <Menu size={20} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Bán hàng <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {activeTab?.label}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '14px 12px 80px' : '18px 20px 80px' }}>{content}</div>

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} />
          <div style={{ position: 'relative', height: '100%', boxShadow: '4px 0 20px rgba(0,0,0,.15)' }}>{sidebar}</div>
        </div>
      )}
    </div>
  )
}
