'use client'

/**
 * Trang "Thông báo của tôi" — việc còn treo cuối cùng của Phase 2 (xem changelog notification
 * 2026-09-25 mục 6.1 "Chân panel: Xem tất cả → trang Thông báo của tôi", mục 12.4/20.5). Panel
 * chuông (`NotificationCenter`) giới hạn 50 dòng, không lọc/tìm kiếm/phân trang thật - trang này
 * dùng ĐÚNG endpoint `GET /notifications` nhưng với phân trang + lọc THẬT từ BE (không tải hết rồi
 * cắt ở FE như `Admin/NotificationsPage` làm cho danh sách "Thông báo chung").
 *
 * Không phải 1 "trang" trong `*App.tsx` nào (không thuộc riêng module nào) - render dạng overlay
 * toàn màn hình từ `app/page.tsx`, mở qua query `?notif=all` (giữ nguyên `m`/`p` bên dưới để đóng
 * lại đúng chỗ đang xem, xem `MainERP`).
 */
import { emitNotificationNavigate } from '../hooks/useCloseNavOnNotification'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, CheckCheck, Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { getNotifications } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { useNotifications } from '../context/NotificationsContext'
import type { Notification, NotificationCategory } from '../types/admin'
import { isLinkUnreachable, resolveNotificationUrl } from '../utils/notificationLink'
import { useAuth } from '../context/AuthContext'
import SearchInput from './SearchInput'
import EmptyState from './EmptyState'
import LoadingState from './LoadingState'
import Pagination from './Pagination'

const SEVERITY_STYLE: Record<string, { color: string; Icon: typeof Info }> = {
  INFO: { color: 'var(--text3)', Icon: Info },
  SUCCESS: { color: 'var(--fg-2e7d32)', Icon: CheckCircle2 },
  WARNING: { color: 'var(--fg-e65100)', Icon: AlertTriangle },
  CRITICAL: { color: 'var(--fg-c62828)', Icon: AlertCircle },
}

const CATEGORY_LABEL: Record<string, string> = {
  ANNOUNCEMENT: 'Thông báo chung',
  ACTION_REQUIRED: 'Cần xử lý',
  RESULT: 'Kết quả',
  ALERT: 'Cảnh báo',
  INFO: 'Thông tin',
}

const CATEGORY_OPTIONS: { value: NotificationCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Mọi loại' },
  { value: 'ACTION_REQUIRED', label: 'Cần xử lý' },
  { value: 'RESULT', label: 'Kết quả' },
  { value: 'ALERT', label: 'Cảnh báo' },
  { value: 'INFO', label: 'Thông tin' },
  { value: 'ANNOUNCEMENT', label: 'Thông báo chung' },
]

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', outline: 'none',
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN')
}

function Row({ n, onOpen }: { n: Notification; onOpen: (n: Notification) => void }) {
  const { color, Icon } = SEVERITY_STYLE[n.severity] ?? SEVERITY_STYLE.INFO
  const { user } = useAuth()
  const unreachable = isLinkUnreachable(n, user)
  return (
    <button
      onClick={() => onOpen(n)}
      style={{
        display: 'flex', gap: 12, width: '100%', textAlign: 'left', padding: '14px 16px',
        border: 'none', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', cursor: 'pointer', opacity: n.isResolved ? 0.65 : 1,
      }}
    >
      <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: n.isRead ? 500 : 700, flex: 1, minWidth: 0 }}>{n.title}</div>
          {!n.isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fg-1976d2)', flexShrink: 0 }} />}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>{n.message}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11.5, color: 'var(--text3)' }}>
          <span style={{ padding: '1px 7px', borderRadius: 20, background: 'var(--surface2)' }}>
            {CATEGORY_LABEL[n.category] ?? n.category}
          </span>
          <span>{fmtDateTime(n.createdAt)}</span>
          {n.isResolved && <span style={{ color: 'var(--fg-2e7d32)', fontWeight: 600 }}>· Đã xử lý</span>}
          {unreachable && <span title="Thông báo này trỏ tới màn của phân hệ khác, vai trò của bạn không mở được">· Chỉ để xem</span>}
        </div>
      </div>
    </button>
  )
}

interface MyNotificationsPageProps {
  onClose: () => void
}

export default function MyNotificationsPage({ onClose }: MyNotificationsPageProps) {
  const router = useRouter()
  const { user } = useAuth()
  // Dùng chung context với NotificationCenter (không gọi thẳng service) - để badge/unread-count ở
  // chuông cập nhật NGAY khi đọc/đọc-tất-cả từ trang này, không phải chờ tới lần poll 30s kế tiếp.
  const { markRead: markReadInContext, markAllRead: markAllReadInContext } = useNotifications()
  const [status, setStatus] = useState<'all' | 'unread'>('all')
  const [resolved, setResolved] = useState<'all' | 'true' | 'false'>('all')
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  // Gõ tới đâu tải lại tới đó, chờ 400ms - cùng idiom debounce đã dùng ở GomDotCatPage (không debounce
  // thì mỗi phím gõ bắn 1 request, kết quả về không theo thứ tự có thể đè kết quả đúng bằng kết quả cũ).
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, refetch } = useFetch(
    () => getNotifications({
      status,
      resolved: resolved === 'all' ? undefined : resolved,
      category: category === 'all' ? undefined : category,
      search: search || undefined,
      page,
      limit,
    }),
    [status, resolved, category, search, page],
  )
  const items = data?.data ?? []
  const total = data?.meta.total ?? 0
  const hasUnread = items.some(n => !n.isRead)

  const changeFilter = (fn: () => void) => { fn(); setPage(1) }

  const openNotification = async (n: Notification) => {
    if (!n.isRead) await markReadInContext(n.id)
    const url = resolveNotificationUrl(n, user)
    if (url) {
      emitNotificationNavigate()
      router.push(url)
      return
    }
    // Không có link để điều hướng - chỉ cần cập nhật lại dòng vừa đọc trong danh sách đang xem.
    refetch()
  }

  const markAllRead = async () => {
    await markAllReadInContext()
    refetch()
  }

  return (
    // zIndex cao hơn cả panel chuông (1200) lẫn toast (1300, NotificationCenter.tsx) - trang này chỉ
    // mở TỪ nút "Xem tất cả" trong panel nên panel đã tự đóng trước đó, nhưng đặt cao để chắc chắn
    // phủ kín màn hình trong mọi trường hợp (vd mở lại bằng URL/bookmark khi có modal khác còn mở).
    <div style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Đóng, quay lại màn trước" style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <Bell size={18} color="var(--fg-1976d2)" />
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, flex: 1 }}>Thông báo của tôi</h1>
        {hasUnread && (
          <button onClick={markAllRead} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: 'var(--fg-1976d2)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
            <CheckCheck size={14} /> Đọc tất cả
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Tìm theo tiêu đề hoặc nội dung..." />
        <select style={selectStyle} value={category} onChange={e => changeFilter(() => setCategory(e.target.value as NotificationCategory | 'all'))}>
          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select style={selectStyle} value={status} onChange={e => changeFilter(() => setStatus(e.target.value as 'all' | 'unread'))}>
          <option value="all">Đã đọc lẫn chưa đọc</option>
          <option value="unread">Chưa đọc</option>
        </select>
        <select style={selectStyle} value={resolved} onChange={e => changeFilter(() => setResolved(e.target.value as 'all' | 'true' | 'false'))}>
          <option value="all">Mọi tình trạng xử lý</option>
          <option value="false">Chưa xử lý xong</option>
          <option value="true">Đã xử lý xong</option>
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <div style={{ padding: '24px 20px' }}>
            <EmptyState
              icon={<Bell size={32} style={{ marginBottom: 8, opacity: 0.4 }} />}
              message={search || category !== 'all' || status !== 'all' || resolved !== 'all'
                ? 'Không tìm thấy thông báo nào khớp bộ lọc.'
                : 'Chưa có thông báo nào.'}
            />
          </div>
        ) : (
          items.map(n => <Row key={n.id} n={n} onOpen={openNotification} />)
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <Pagination page={page} pageSize={limit} total={total} onPageChange={setPage} />
      </div>
    </div>
  )
}
