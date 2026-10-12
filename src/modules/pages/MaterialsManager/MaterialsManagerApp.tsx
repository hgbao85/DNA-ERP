import { LogOut, Grid, Package, BookOpen } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useIsCompact } from '../../../hooks/useMediaQuery'
import { useUrlState } from '../../../hooks/useUrlState'
import MaterialsPage from '../Admin/masterData/MaterialsPage'
import ThemeToggle from '../../../components/ThemeToggle'
import EmbeddedGuide from '../Guide/EmbeddedGuide'
import { materialsGroup } from '../Guide/content/materials'

interface Props { onBack?: () => void }

type Tab = 'materials' | 'guide'
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'materials', label: 'Vật tư', icon: <Package size={14} /> },
  // Hướng dẫn riêng của vai trò này (2026-10-12, theo yêu cầu) - tách khỏi trang /guide công khai,
  // cùng cách làm với tab "Hướng dẫn quản trị" của Admin (xem Guide/EmbeddedGuide.tsx).
  { id: 'guide', label: 'Hướng dẫn', icon: <BookOpen size={14} /> },
]
const guideLinkFor = (id: string) => `/?m=materials_manager&p=guide&a=${id}`

// Phân hệ "Quản lý vật tư" (2026-09-28) - tài khoản chuyên biệt chỉ có 1 màn nghiệp vụ: danh mục Vật
// tư (tái dùng nguyên MaterialsPage.tsx của Admin > Danh mục hệ thống, KHÔNG viết lại). Không có
// sidebar nhiều tab như PurchasingApp/InboundWarehouseApp vì role này chỉ được cấp đúng 1 quyền -
// 2 tab trên thanh tiêu đề là đủ: màn Vật tư và Hướng dẫn. Tab lưu ở query `p` để F5 không mất chỗ.
export default function MaterialsManagerApp({ onBack }: Props) {
  const { user, logout } = useAuth()
  const isCompact = useIsCompact()
  const [urlTab, setUrlTab] = useUrlState('p')
  const tab: Tab = urlTab === 'guide' ? 'guide' : 'materials'

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
      <div style={{ fontWeight: 700, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Quản lý vật tư
      </div>
      <div role="tablist" aria-label="Màn hình" style={{ display: 'flex', gap: 4, flex: 1, minWidth: 0, marginLeft: isCompact ? 4 : 16 }}>
        {TABS.map((t) => {
          const on = t.id === tab
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setUrlTab(t.id === 'materials' ? null : t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
                border: 'none', borderRadius: 'var(--radius)',
                background: on ? 'var(--surface2)' : 'transparent',
                color: on ? 'var(--text)' : 'var(--text2)', fontWeight: on ? 600 : 500,
              }}
            >
              {t.icon}{t.label}
            </button>
          )
        })}
      </div>
      {!isCompact && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{user?.name}</span>}
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
        {tab === 'materials' && <MaterialsPage />}
        {tab === 'guide' && (
          <EmbeddedGuide
            group={materialsGroup}
            title="Hướng dẫn quản lý vật tư"
            note="Phần này chỉ tài khoản Quản lý vật tư xem được."
            linkFor={guideLinkFor}
            tocMinWidth={1400}
          />
        )}
      </div>
    </div>
  )
}
