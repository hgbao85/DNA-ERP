'use client'

/**
 * Chuông thông báo toàn cục — thay hẳn `NotifBell.tsx` (chuông giả cục bộ, không nối BE, xem
 * changelog notification 2026-09-25 mục 2.2/6.1). Gắn 1 lần ở mỗi app shell (`*App.tsx`), cùng vị
 * trí (cạnh nút Đăng xuất) cho mọi phân hệ.
 *
 * Panel dùng `position: fixed` (không đo vị trí nút chuông) vì nút chuông nằm ở nhiều chỗ khác
 * nhau tuỳ sidebar mỗi app (đơn giản, chắc chắn không bị cắt bởi overflow của sidebar cha).
 * Bấm 1 dòng: đánh dấu đã đọc + điều hướng theo `link` (module/page) qua `router.push('/?m=...')`
 * (đồng bộ với `useUrlState('m')` ở app/page.tsx — xem đó để hiểu vì sao KHÔNG cần truyền callback
 * điều hướng xuyên suốt props của 7 tầng *App.tsx).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, CheckCheck, Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { useIsCompact } from '../hooks/useMediaQuery'
import type { NotificationTab } from '../hooks/useNotifications'
import { useNotifications } from '../context/NotificationsContext'
import type { Notification } from '../types/admin'

const SEVERITY_STYLE: Record<string, { color: string; Icon: typeof Info }> = {
  INFO: { color: 'var(--text3)', Icon: Info },
  SUCCESS: { color: '#2e7d32', Icon: CheckCircle2 },
  WARNING: { color: '#e65100', Icon: AlertTriangle },
  CRITICAL: { color: '#c62828', Icon: AlertCircle },
}

const CATEGORY_LABEL: Record<string, string> = {
  ANNOUNCEMENT: 'Thông báo chung',
  ACTION_REQUIRED: 'Cần xử lý',
  RESULT: 'Kết quả',
  ALERT: 'Cảnh báo',
  INFO: 'Thông tin',
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'vừa xong'
  if (min < 60) return `${min} phút trước`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} giờ trước`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

function Row({ n, onOpen }: { n: Notification; onOpen: (n: Notification) => void }) {
  const { color, Icon } = SEVERITY_STYLE[n.severity] ?? SEVERITY_STYLE.INFO
  return (
    <button
      onClick={() => onOpen(n)}
      style={{
        display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px',
        borderTop: '1px solid var(--border)', border: 'none', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--border)',
        background: 'transparent', cursor: 'pointer', opacity: n.isResolved ? 0.6 : 1,
      }}
    >
      <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 700, flex: 1, minWidth: 0 }}>{n.title}</div>
          {!n.isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1976d2', flexShrink: 0 }} />}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {n.message}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>
          <span>{timeAgo(n.createdAt)}</span>
          {n.isResolved && <span style={{ color: '#2e7d32' }}>· Đã xử lý</span>}
        </div>
      </div>
    </button>
  )
}

interface NotificationCenterProps {
  /** Kích thước icon chuông - mặc định 16 (chỗ đặt cạnh avatar/Đăng xuất ở chân sidebar, cùng cỡ
   *  LogOut). Top bar thu gọn (mobile) truyền 20 để bằng cỡ nút Menu bên cạnh - xem 2026-09-25
   *  "chuông để chỗ khó nhìn quá": chân sidebar BỊ GIẤU trong drawer đóng ở màn hẹp, top bar mới là
   *  chỗ luôn hiện ngay không cần bấm gì. */
  size?: number
  /** Màu icon - để trống (mặc định lucide `currentColor`) khi đặt ở top bar để LUÔN rõ như icon
   *  Menu bên cạnh (không truyền color); truyền `var(--text3)` (mờ hơn, đồng bộ icon Đăng xuất)
   *  khi đặt ở chân sidebar. */
  color?: string
}

export default function NotificationCenter({ size = 16, color }: NotificationCenterProps) {
  const router = useRouter()
  const isCompact = useIsCompact()
  const [open, setOpen] = useState(false)
  const { unread, items, listLoading, tab, toast, openWithTab, switchTab, markRead, markAllRead, dismissToast } = useNotifications()

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) openWithTab(tab)
  }

  // Bấm ra ngoài đóng panel - dùng chung 1 cơ chế cho cả 2 layout (backdrop trong suốt/mờ bọc
  // ngoài panel, xem `panel` bên dưới) thay vì riêng document-listener cho desktop.

  const openNotification = async (n: Notification) => {
    if (!n.isRead) markRead(n.id)
    setOpen(false)
    if (n.link?.module) {
      const params = new URLSearchParams()
      params.set('m', n.link.module)
      if (n.link.page) params.set('p', n.link.page)
      router.push(`/?${params.toString()}`)
    }
  }

  const openToast = () => { if (toast) openNotification(toast); dismissToast() }

  const tabBtn = (id: NotificationTab, label: string, count?: number) => (
    <button
      onClick={() => switchTab(id)}
      style={{
        flex: 1, padding: '9px 0', fontSize: 12, fontWeight: tab === id ? 700 : 500,
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: tab === id ? '#1976d2' : 'var(--text2)',
        borderBottom: tab === id ? '2px solid #1976d2' : '2px solid transparent',
      }}
    >
      {label}{count !== undefined && count > 0 ? ` (${count})` : ''}
    </button>
  )

  // Vị trí panel PHẢI khớp với chỗ nút chuông thực sự nằm, không phải 1 vị trí cố định chung
  // (2026-09-25, phản hồi "bấm chuông sao thông báo lại xổ dưới, phải nằm dọc cạnh bên phải chứ" -
  // trước đó panel compact luôn là bottom-sheet dù chuông đã chuyển lên góc phải top bar):
  //  - compact (top bar, chuông góc phải trên): panel xổ XUỐNG bên phải, sát top bar.
  //  - desktop (chân sidebar, chuông góc trái dưới): panel xổ LÊN bên trái, sát chân sidebar.
  // Cả 2 dùng chung 1 backdrop trong suốt phủ toàn màn hình để bấm ra ngoài là đóng - thay cho
  // document-mousedown-listener riêng trước đây (đơn giản hơn, không phụ thuộc DOM ref).
  const panel = (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: isCompact ? 'rgba(0,0,0,.25)' : 'transparent' }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={isCompact ? {
          position: 'absolute', top: 56, right: 12,
          width: 'min(360px, calc(100vw - 24px))', maxHeight: '75vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,.25)', overflow: 'hidden',
        } : {
          position: 'absolute', bottom: 68, left: 16,
          width: 340, maxHeight: '70vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,.2)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Thông báo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {unread.total > 0 && (
              <button onClick={() => markAllRead()} title="Đánh dấu đã đọc tất cả" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer' }}>
                <CheckCheck size={13} /> Đọc tất cả
              </button>
            )}
            <button onClick={() => setOpen(false)} style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
              <X size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {tabBtn('action', 'Cần xử lý', unread.byCategory.ACTION_REQUIRED)}
          {tabBtn('all', 'Tất cả')}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {listLoading ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>Đang tải...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
              {tab === 'action' ? 'Không có việc nào cần xử lý.' : 'Chưa có thông báo nào.'}
            </div>
          ) : (
            items.map(n => <Row key={n.id} n={n} onOpen={openNotification} />)
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={toggle}
        title="Thông báo"
        style={{ position: 'relative', padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
      >
        <Bell size={size} color={color} />
        {unread.total > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, padding: '0 3px',
            background: '#c62828', color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>
            {unread.total > 99 ? '99+' : unread.total}
          </span>
        )}
      </button>

      {open && panel}

      {toast && (
        <div
          onClick={openToast}
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 1300, width: 300, cursor: 'pointer',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.25)', padding: '12px 14px', display: 'flex', gap: 10,
          }}
        >
          {(() => {
            const { color, Icon } = SEVERITY_STYLE[toast.severity] ?? SEVERITY_STYLE.INFO
            return <Icon size={17} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
          })()}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{CATEGORY_LABEL[toast.category] ?? toast.category}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{toast.title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{toast.message}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); dismissToast() }} style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', height: 'fit-content' }}>
            <X size={14} color="var(--text3)" />
          </button>
        </div>
      )}
    </div>
  )
}
