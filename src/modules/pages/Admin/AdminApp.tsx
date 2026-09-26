'use client'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Users, History, Database, Bell, Settings, Briefcase, Activity, LogOut, Warehouse, Image as ImageIcon, PenLine, Wrench, Menu, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useIsCompact, useIsMobile } from '../../../hooks/useMediaQuery'
import { useUrlState } from '../../../hooks/useUrlState'
import NotificationCenter from '../../../components/NotificationCenter'
import DashboardPage from './DashboardPage'
import UsersPage from './UsersPage'
import AuditLogPage from './AuditLogPage'
import MasterDataPage from './MasterDataPage'
import BusinessDataPage from './BusinessDataPage'
import AttachmentsPage from './AttachmentsPage'
import NotificationsPage from './NotificationsPage'
import SystemConfigPage from './SystemConfigPage'
import SystemStatusPage from './SystemStatusPage'
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'
import OfficeSuppliesAdminPage from './OfficeSuppliesAdminPage'
import PhoiSkuAdminPage from './PhoiSkuAdminPage'
import ThemeToggle from '../../../components/ThemeToggle'

const ACCENT    = 'var(--fg-3949ab)'
const ACCENT_BG = 'var(--bg-e8eaf6)'

type AdminPage = 'dashboard' | 'users' | 'warehouses' | 'office-supplies' | 'phoi-sku' | 'audit-log' | 'master-data' | 'business-data' | 'attachments' | 'notifications' | 'system-config' | 'system-status'

const ADMIN_PAGE_VALUES: AdminPage[] = ['dashboard', 'users', 'warehouses', 'office-supplies', 'phoi-sku', 'audit-log', 'master-data', 'business-data', 'attachments', 'notifications', 'system-config', 'system-status']
const isAdminPage = (v: string | null): v is AdminPage => !!v && (ADMIN_PAGE_VALUES as string[]).includes(v)

const NAV_ITEMS: { id: AdminPage; label: string; icon: React.ReactNode; enabled: boolean }[] = [
  { id: 'dashboard',      label: 'Tổng quan',               icon: <LayoutDashboard size={16} />, enabled: true },
  { id: 'users',          label: 'Người dùng & Phân quyền', icon: <Users size={16} />,           enabled: true },
  { id: 'warehouses',     label: 'Quản lý kho',           icon: <Warehouse size={16} />,       enabled: true },
  { id: 'office-supplies', label: 'Văn phòng phẩm',        icon: <PenLine size={16} />,         enabled: true },
  { id: 'phoi-sku',       label: 'Sửa SKU đợt Phôi',         icon: <Wrench size={16} />,          enabled: true },
  { id: 'audit-log',      label: 'Nhật ký hoạt động',        icon: <History size={16} />,         enabled: true },
  { id: 'master-data',    label: 'Danh mục hệ thống',        icon: <Database size={16} />,        enabled: true },
  { id: 'business-data',  label: 'Module nghiệp vụ',         icon: <Briefcase size={16} />,       enabled: true },
  { id: 'attachments',    label: 'Quản lý tệp đính kèm',     icon: <ImageIcon size={16} />,       enabled: true },
  { id: 'notifications',  label: 'Thông báo',                icon: <Bell size={16} />,            enabled: true },
  { id: 'system-config',  label: 'Cấu hình hệ thống',        icon: <Settings size={16} />,        enabled: true },
  { id: 'system-status',  label: 'Tình trạng hệ thống',      icon: <Activity size={16} />,        enabled: true },
]

export default function AdminApp() {
  const { user, logout } = useAuth()
  // `p` trong query string - cho NotificationCenter mở đúng tab (xem changelog notification
  // 2026-09-25 mục 6.2/12) - cùng cơ chế ProductionPlanApp/MfgApp đã làm.
  const [urlPage, setUrlPage] = useUrlState('p')
  const [page, setPageState] = useState<AdminPage>(() => (isAdminPage(urlPage) ? urlPage : 'dashboard'))
  const setPage = (id: AdminPage) => { setPageState(id); setUrlPage(id) }
  useEffect(() => {
    if (isAdminPage(urlPage) && urlPage !== page) setPageState(urlPage)
  }, [urlPage])
  // Màn hình hẹp (< 900px): sidebar ẩn thành drawer mở qua nút ☰ - cùng idiom BossApp/SalesApp/PurchasingApp.
  const isCompact = useIsCompact()
  const isMobile  = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const selectPage = (id: AdminPage) => { setPage(id); setDrawerOpen(false) }

  const sidebar = (
      <div style={{ width: 210, flexShrink: 0, height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Quản trị hệ thống</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Đông Nam Á Corp</div>
          </div>
          {isCompact && (
            <button onClick={() => setDrawerOpen(false)} aria-label="Đóng menu" style={{ padding: 4, background: 'transparent', border: 'none', display: 'flex' }}>
              <X size={18} />
            </button>
          )}
        </div>

        <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => item.enabled && selectPage(item.id)}
                disabled={!item.enabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: isCompact ? '11px 10px' : '8px 10px', marginBottom: 2, border: 'none',
                  borderRadius: 'var(--radius)', textAlign: 'left', fontSize: 13,
                  cursor: item.enabled ? 'pointer' : 'not-allowed',
                  opacity: item.enabled ? 1 : 0.45,
                  background: active ? ACCENT_BG : 'transparent',
                  color: active ? ACCENT : 'var(--text)',
                  fontWeight: active ? 600 : 400,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!active && item.enabled) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {!item.enabled && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text3)' }}>
                    Sắp ra mắt
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: ACCENT_BG, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Quản trị viên</div>
            </div>
            <ThemeToggle />
            <NotificationCenter color="var(--text3)" />
            <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
              <LogOut size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      </div>
  )

  const content = (
    <>
      {page === 'dashboard'      && <DashboardPage onViewAuditLog={() => setPage('audit-log')} />}
      {page === 'users'          && <UsersPage />}
      {page === 'warehouses'     && <MfgWarehousesPage />}
      {page === 'office-supplies' && <OfficeSuppliesAdminPage />}
      {page === 'phoi-sku'       && <PhoiSkuAdminPage />}
      {page === 'audit-log'      && <AuditLogPage />}
      {page === 'master-data'    && <MasterDataPage />}
      {page === 'business-data'  && <BusinessDataPage />}
      {page === 'attachments'    && <AttachmentsPage />}
      {page === 'notifications'  && <NotificationsPage />}
      {page === 'system-config'  && <SystemConfigPage />}
      {page === 'system-status'  && <SystemStatusPage />}
    </>
  )

  if (!isCompact) {
    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {sidebar}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 24px' }}>{content}</div>
      </div>
    )
  }

  const activeItem = NAV_ITEMS.find(n => n.id === page)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => setDrawerOpen(true)} aria-label="Mở menu" style={{ padding: 6, background: 'transparent', border: 'none', display: 'flex' }}>
          <Menu size={20} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Quản trị <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {activeItem?.label}</span>
        </div>
        <NotificationCenter size={20} />
      </div>

      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: isMobile ? '14px 12px 80px' : '18px 20px 80px' }}>{content}</div>

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} />
          <div style={{ position: 'relative', height: '100%', boxShadow: '4px 0 20px rgba(0,0,0,.15)' }}>{sidebar}</div>
        </div>
      )}
    </div>
  )
}
