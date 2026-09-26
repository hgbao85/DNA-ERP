import { useEffect, useState } from 'react'
import { LogOut, Grid, ClipboardList, Truck, History, Menu, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useIsCompact, useIsMobile } from '../../../hooks/useMediaQuery'
import { useUrlState } from '../../../hooks/useUrlState'
import NotificationCenter from '../../../components/NotificationCenter'
import LenhMuaNCCPage from './LenhMuaNCCPage'
import TheoDoiMuaHangPage from './TheoDoiMuaHangPage'
import LichSuMuaHangPage from './LichSuMuaHangPage'
import ThemeToggle from '../../../components/ThemeToggle'

interface Props { onBack?: () => void }

// Tab "Vật tư – NCC" đã gỡ 2026-08-27 cùng luồng báo giá: nó chỉ phục vụ việc gắn NCC + giá tham
// khảo cho SupplierPicker lúc nhập báo giá, mà giá/NCC nay nằm trong file Excel Sếp ký. Danh mục
// NCC vẫn quản lý ở Admin › Nhà cung cấp, gán người mua vẫn ở Admin › Vật tư - không mất chức năng.
type TabId = 'lenh-mua-ncc' | 'theo-doi-mua-hang' | 'lich-su-mua-hang'
const TAB_VALUES: TabId[] = ['lenh-mua-ncc', 'theo-doi-mua-hang', 'lich-su-mua-hang']
const isTabId = (v: string | null): v is TabId => !!v && (TAB_VALUES as string[]).includes(v)

export default function PurchasingApp({ onBack }: Props) {
  const { user, logout } = useAuth()
  // `p` trong query string - cho NotificationCenter mở đúng tab (vd PURCHASE_PROPOSAL_CREATED trỏ
  // tới module 'purchasing' + page 'lenh-mua-ncc', xem notification-types.ts bên BE) - cùng cơ chế
  // ProductionPlanApp/MfgApp/BossApp đã làm (mục 6.2/12/12.5.B/16 changelog notification).
  const [urlTab, setUrlTab] = useUrlState('p')
  const [tab, setTabState] = useState<TabId>(() => (isTabId(urlTab) ? urlTab : 'lenh-mua-ncc'))
  // Màn hình hẹp (< 900px): sidebar ẩn thành drawer mở qua nút ☰ - cùng idiom SalesApp.
  const isCompact = useIsCompact()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'lenh-mua-ncc',      label: 'Lệnh mua vật tư',   icon: <ClipboardList size={16} /> },
    { id: 'theo-doi-mua-hang', label: 'Theo dõi mua hàng', icon: <Truck size={16} /> },
    { id: 'lich-su-mua-hang',  label: 'Lịch sử đã mua',    icon: <History size={16} /> },
  ]

  const setTab = (id: TabId) => { setTabState(id); setUrlTab(id) }
  const selectTab = (id: TabId) => { setTab(id); setDrawerOpen(false) }
  // Điều hướng TỪ BÊN NGOÀI (NotificationCenter gọi router.push('/?m=purchasing&p=...')).
  useEffect(() => {
    if (isTabId(urlTab) && urlTab !== tab) setTabState(urlTab)
  }, [urlTab])

  const sidebar = (
    <div style={{ width: 210, flexShrink: 0, height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {onBack && (
            <button onClick={onBack} style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }} title="Trở về trang chủ">
              <Grid size={16} color="var(--text)" />
            </button>
          )}
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Mua hàng</div>
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
              border: 'none', borderRadius: 'var(--radius)', background: active ? 'var(--bg-ede7f6)' : 'transparent',
              color: active ? 'var(--fg-4527a0)' : 'var(--text2)', fontWeight: active ? 600 : 400, fontSize: 13, textAlign: 'left', cursor: 'pointer',
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >{t.icon}{t.label}</button>
          )
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-ede7f6)', color: 'var(--fg-4527a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Mua hàng</div>
          </div>
          <ThemeToggle />
          <NotificationCenter color="var(--text3)" />
          <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất"><LogOut size={16} color="var(--text3)" /></button>
        </div>
      </div>
    </div>
  )

  const content = (
    <>
      {tab === 'lenh-mua-ncc'      && <LenhMuaNCCPage />}
      {tab === 'theo-doi-mua-hang' && <TheoDoiMuaHangPage />}
      {tab === 'lich-su-mua-hang'  && <LichSuMuaHangPage />}
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
          Mua hàng <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {activeTab?.label}</span>
        </div>
        <NotificationCenter size={20} />
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
