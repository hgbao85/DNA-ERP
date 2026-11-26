'use client'
import { LogOut, Grid, ClipboardList, MapPin } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useIsCompact } from '../../../hooks/useMediaQuery'
import { useUrlState } from '../../../hooks/useUrlState'
import { useDieuPhoiDanEnabled } from '../../../hooks/useDieuPhoiDanEnabled'
import NotificationCenter from '../../../components/NotificationCenter'
import ThemeToggle from '../../../components/ThemeToggle'
import LoadingState from '../../../components/LoadingState'
import WeavingPointsPage from '../Admin/masterData/WeavingPointsPage'
import TheoDoiDiemDanPage from './TheoDoiDiemDanPage'

interface Props { onBack?: () => void }

type Tab = 'theo-doi' | 'diem-dan'
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'theo-doi', label: 'Theo dõi điểm đan', icon: <ClipboardList size={14} /> },
  { id: 'diem-dan', label: 'Điểm đan', icon: <MapPin size={14} /> },
]

/**
 * Phân hệ "Điều phối đan" (25/11/2026, docs THIET-KE-DIEU-PHOI-DAN) - tài khoản văn phòng (vai BE WEAVING_COORDINATOR) theo dõi các
 * điểm đan gia công bên ngoài: bảng đã gửi / đã trả / còn giữ / hạn trả + ghi chú, lời hẹn trả (Đ1, Đ2) và danh sách điểm đan (Đ3,
 * chỉ tài khoản này + Admin sửa). Không xuất / nhập kho. Chỉ hiện khi BE bật DIEU_PHOI_DAN_ENABLED; tắt thì báo chưa mở.
 * Tab ở query `p`; thông báo nhắc hẹn trỏ `p=theo-doi&point=<id điểm đan>`.
 */
export default function WeavingCoordinationApp({ onBack }: Props) {
  const { user, logout } = useAuth()
  const isCompact = useIsCompact()
  const enabled = useDieuPhoiDanEnabled()
  const [urlTab, setUrlTab] = useUrlState('p')
  const tab: Tab = urlTab === 'diem-dan' ? 'diem-dan' : 'theo-doi'
  const canWrite = !!user?.isWeavingCoordinator || user?.role === 'ADMIN'

  const header = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: isCompact ? '10px 12px' : '12px 24px', flexWrap: isCompact ? 'wrap' : 'nowrap',
      background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0,
    }}>
      {onBack && (
        <button onClick={onBack} style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }} title="Trở về trang chủ">
          <Grid size={16} color="var(--text)" />
        </button>
      )}
      <div style={{ fontWeight: 700, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: isCompact ? 1 : undefined }}>
        Điều phối đan
      </div>
      {/* Màn hẹp: tab xuống dòng riêng, chiếm hết chiều ngang - tránh bị bóp cùng tiêu đề + nút. */}
      <div role="tablist" aria-label="Màn hình" style={{
        display: 'flex', gap: 4, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none',
        ...(isCompact ? { order: 10, flexBasis: '100%' } : { flex: 1, marginLeft: 16 }),
      }}>
        {enabled === true && TABS.map((t) => {
          const on = t.id === tab
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setUrlTab(t.id === 'theo-doi' ? null : t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: isCompact ? '6px 9px' : '6px 12px', fontSize: 13, cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0, border: 'none', borderRadius: 'var(--radius)',
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
      <NotificationCenter color="var(--text3)" />
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
        {enabled === null && <LoadingState />}
        {enabled === false && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}>
            Tính năng Điều phối đan chưa được bật. Liên hệ Admin.
          </div>
        )}
        {enabled === true && tab === 'theo-doi' && <TheoDoiDiemDanPage canWrite={canWrite} />}
        {enabled === true && tab === 'diem-dan' && <WeavingPointsPage readOnly={!canWrite} />}
      </div>
    </div>
  )
}
