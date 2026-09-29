import { LogOut, Grid } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useIsCompact } from '../../../hooks/useMediaQuery'
import MaterialsPage from '../Admin/masterData/MaterialsPage'
import ThemeToggle from '../../../components/ThemeToggle'

interface Props { onBack?: () => void }

// Phân hệ "Quản lý vật tư" (2026-09-28) - tài khoản chuyên biệt CHỈ có 1 màn hình: danh mục Vật
// tư (tái dùng nguyên MaterialsPage.tsx của Admin > Danh mục hệ thống, KHÔNG viết lại). Không có
// sidebar nhiều tab như PurchasingApp/InboundWarehouseApp vì role này chỉ được cấp đúng 1 quyền.
export default function MaterialsManagerApp({ onBack }: Props) {
  const { user, logout } = useAuth()
  const isCompact = useIsCompact()

  const header = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: isCompact ? '10px 12px' : '12px 24px',
      background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0,
    }}>
      {onBack && (
        <button onClick={onBack} style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }} title="Trở về trang chủ">
          <Grid size={16} color="var(--text)" />
        </button>
      )}
      <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Quản lý vật tư
      </div>
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{user?.name}</span>
      <ThemeToggle />
      <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
        <LogOut size={16} color="var(--text3)" />
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {header}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: isCompact ? '16px 14px 24px' : 'var(--space-6) var(--space-7)' }}>
        <MaterialsPage />
      </div>
    </div>
  )
}
