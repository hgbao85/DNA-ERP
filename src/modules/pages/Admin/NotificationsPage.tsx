'use client'

/**
 * "Thông báo chung" — trước 2026-09-25 đây là NotificationsPage dựng trên AdminEntityPage (CRUD
 * chung), nhưng GET /notifications lúc đó lọc theo audience của CHÍNH admin nên admin không thấy
 * lại thông báo mình vừa tạo cho BOSS/WAREHOUSE_STAFF/PRODUCTION_MANAGER (xem changelog notification
 * 2026-09-25 mục 2.2). Từ nay dùng GET /notifications/sent (mục 5.4/6.4 changelog đó) — admin xem
 * lại MỌI thông báo chung đã phát + tỉ lệ đã đọc trên MỌI người nhận, không phải "của riêng mình".
 * Viết thành trang riêng (không còn AdminEntityConfig) vì shape khác hẳn (readCount/recipientCount
 * thay vì isRead của 1 người) và BE vẫn chỉ có create + list — không update/delete.
 */
import { useMemo, useState } from 'react'
import { Bell, Plus, X } from 'lucide-react'
import { useAuditLog } from '../../../context/AuditLogContext'
import { useFetch } from '../../../hooks/useFetch'
import { getSentAnnouncements, createNotification } from '../../../services/api'
import type { Announcement } from '../../../types/admin'
import Modal from '../../../components/Modal'
import SearchInput from '../../../components/SearchInput'
import EmptyState from '../../../components/EmptyState'
import LoadingState from '../../../components/LoadingState'
import Pagination from '../../../components/Pagination'
import { btnSecondary } from '../../../styles/buttons'
import { tableWrap, tbl, th, td, row } from '../../../styles/table'

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'Tất cả',
  boss: 'Giám đốc',
  warehouse_staff: 'Nhân viên kho',
  production_manager: 'Quản lý sản xuất',
}

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'boss', label: 'Giám đốc' },
  { value: 'warehouse_staff', label: 'Nhân viên kho' },
  { value: 'production_manager', label: 'Quản lý sản xuất' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)',
  borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', outline: 'none',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }

function CreateAnnouncementModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (n: Announcement) => void }) {
  const { logAction } = useAuditLog()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setTitle(''); setMessage(''); setAudience('all'); setError('') }
  const close = () => { reset(); onClose() }

  const submit = async () => {
    if (!title.trim() || !message.trim()) { setError('Nhập đủ tiêu đề và nội dung.'); return }
    setSaving(true)
    setError('')
    try {
      const created = await createNotification({ title: title.trim(), message: message.trim(), audience })
      logAction('notification', String(created.id), 'notification.created', created.title)
      onCreated({
        id: created.id, title: created.title, message: created.message,
        audience: created.audience ?? null, createdBy: created.createdBy ?? null,
        createdAt: created.createdAt, recipientCount: 0, readCount: 0,
      })
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo thông báo thất bại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={close}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tạo thông báo chung</h3>
        <button onClick={close} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} color="var(--text3)" /></button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Tiêu đề</label>
        <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Vd: Nghỉ lễ Quốc khánh" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Nội dung</label>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={message} onChange={e => setMessage(e.target.value)} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Đối tượng nhận</label>
        <select style={inputStyle} value={audience} onChange={e => setAudience(e.target.value)}>
          {AUDIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {error && <div style={{ fontSize: 12, color: '#c62828', marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={btnSecondary} onClick={close}>Hủy</button>
        <button
          onClick={submit}
          disabled={saving}
          style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#3949ab', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Đang gửi...' : 'Gửi thông báo'}
        </button>
      </div>
    </Modal>
  )
}

export default function NotificationsPage() {
  const { data, isLoading, refetch } = useFetch(() => getSentAnnouncements(1, 200))
  const announcements = useMemo(() => data?.data ?? [], [data])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const pageSize = 10

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi')
    const list = [...announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (!q) return list
    return list.filter(n => n.title.toLocaleLowerCase('vi').includes(q) || n.message.toLocaleLowerCase('vi').includes(q))
  }, [announcements, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <Bell size={18} color="#3949ab" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Thông báo chung</h2>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>({filtered.length})</span>
        </div>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Tìm theo tiêu đề hoặc nội dung..." />
        <button
          onClick={() => setShowCreate(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#3949ab', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          <Plus size={14} /> Tạo thông báo
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        Chỉ dùng cho tin nhắn chung (thông báo lịch nghỉ, thay đổi quy trình...) — thông báo về từng
        lệnh sản xuất/đơn hàng cụ thể do hệ thống tự phát khi có việc cần xử lý, không tạo tay ở đây.
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Bell size={32} style={{ marginBottom: 8, opacity: 0.4 }} />} message={search ? 'Không tìm thấy thông báo nào khớp.' : 'Chưa có thông báo chung nào.'} />
      ) : (
        <>
          <div style={tableWrap}>
            <table style={tbl}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>Tiêu đề</th>
                  <th style={th}>Nội dung</th>
                  <th style={{ ...th, width: 130 }}>Đối tượng</th>
                  <th style={{ ...th, width: 110, textAlign: 'right' }}>Đã đọc</th>
                  <th style={{ ...th, width: 160 }}>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(n => (
                  <tr key={n.id} style={row}>
                    <td style={{ ...td, fontWeight: 600 }}>{n.title}</td>
                    <td style={{ ...td, color: 'var(--text2)' }}>{n.message}</td>
                    <td style={td}>{n.audience ? (AUDIENCE_LABEL[n.audience] ?? n.audience) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{n.readCount}/{n.recipientCount}</td>
                    <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{new Date(n.createdAt).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12 }}>
            <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
          </div>
        </>
      )}

      <CreateAnnouncementModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => refetch()} />
    </div>
  )
}
