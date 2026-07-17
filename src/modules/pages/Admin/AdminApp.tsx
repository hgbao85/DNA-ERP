'use client'
import { useState } from 'react'
import { LayoutDashboard, Users, History, Database, Bell, Settings, Briefcase, Activity, LogOut, Warehouse } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import DashboardPage from './DashboardPage'
import UsersPage from './UsersPage'
import AuditLogPage from './AuditLogPage'
import MasterDataPage from './MasterDataPage'
import BusinessDataPage from './BusinessDataPage'
import NotificationsPage from './NotificationsPage'
import SystemConfigPage from './SystemConfigPage'
import SystemStatusPage from './SystemStatusPage'
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'

const ACCENT    = '#3949ab'
const ACCENT_BG = '#e8eaf6'

type AdminPage = 'dashboard' | 'users' | 'warehouses' | 'audit-log' | 'master-data' | 'business-data' | 'notifications' | 'system-config' | 'system-status'

const NAV_ITEMS: { id: AdminPage; label: string; icon: React.ReactNode; enabled: boolean }[] = [
  { id: 'dashboard',      label: 'Tổng quan',               icon: <LayoutDashboard size={16} />, enabled: true },
  { id: 'users',          label: 'Người dùng & Phân quyền', icon: <Users size={16} />,           enabled: true },
  { id: 'warehouses',     label: 'Quản lý kho thành phẩm',           icon: <Warehouse size={16} />,       enabled: true },
  { id: 'audit-log',      label: 'Nhật ký hoạt động',        icon: <History size={16} />,         enabled: true },
  { id: 'master-data',    label: 'Danh mục hệ thống',        icon: <Database size={16} />,        enabled: true },
  { id: 'business-data',  label: 'Module nghiệp vụ',         icon: <Briefcase size={16} />,       enabled: true },
  { id: 'notifications',  label: 'Thông báo',                icon: <Bell size={16} />,            enabled: true },
  { id: 'system-config',  label: 'Cấu hình hệ thống',        icon: <Settings size={16} />,        enabled: true },
  { id: 'system-status',  label: 'Tình trạng hệ thống',      icon: <Activity size={16} />,        enabled: true },
]

export default function AdminApp() {
  const { user, logout } = useAuth()
  const [page, setPage] = useState<AdminPage>('dashboard')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Quản trị hệ thống</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Đông Nam Á Corp</div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {NAV_ITEMS.map(item => {
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => item.enabled && setPage(item.id)}
                disabled={!item.enabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '8px 10px', marginBottom: 2, border: 'none',
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
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT_BG, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Quản trị viên</div>
            </div>
            <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
              <LogOut size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {page === 'dashboard'      && <DashboardPage onViewAuditLog={() => setPage('audit-log')} />}
        {page === 'users'          && <UsersPage />}
        {page === 'warehouses'     && <MfgWarehousesPage />}
        {page === 'audit-log'      && <AuditLogPage />}
        {page === 'master-data'    && <MasterDataPage />}
        {page === 'business-data'  && <BusinessDataPage />}
        {page === 'notifications'  && <NotificationsPage />}
        {page === 'system-config'  && <SystemConfigPage />}
        {page === 'system-status'  && <SystemStatusPage />}
      </div>
    </div>
  )
}
