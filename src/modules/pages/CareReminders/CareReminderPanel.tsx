import { useState } from 'react'
import { format, isToday, isPast, isFuture } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import { getCareReminders, updateCareReminder, getWholesaleCareReminders, updateWholesaleCareReminder } from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import type { CareReminder, WholesaleCareReminder } from '../../../types'
import { CheckCircle2, Clock, AlertTriangle, Users, Building2 } from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────────────────────

type ReminderStatus = 'overdue' | 'today' | 'upcoming' | 'done'

function getStatus(dueDate: string, isCompleted: boolean): ReminderStatus {
  if (isCompleted) return 'done'
  const d = new Date(dueDate)
  if (isPast(d) && !isToday(d)) return 'overdue'
  if (isToday(d)) return 'today'
  return 'upcoming'
}

const STATUS_CONFIG = {
  overdue:  { label: 'Quá hạn',    bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', icon: <AlertTriangle size={13} /> },
  today:    { label: 'Hôm nay',    bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: <Clock size={13} /> },
  upcoming: { label: 'Sắp tới',    bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe', icon: <Clock size={13} /> },
  done:     { label: 'Hoàn thành', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', icon: <CheckCircle2 size={13} /> },
}

// ─── Retail Reminders Tab ────────────────────────────────────────────────────

function RetailRemindersTab() {
  const { data: reminders, isLoading, error, refetch } = useFetch<CareReminder[]>(getCareReminders)
  const [completing, setCompleting] = useState<number | null>(null)

  const handleComplete = async (id: number) => {
    setCompleting(id)
    try {
      await updateCareReminder(id, { isCompleted: true })
      await refetch()
    } finally { setCompleting(null) }
  }

  if (isLoading) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ padding: 20, color: '#E24B4A' }}>Lỗi: {error}</div>

  const list = reminders ?? []
  const groups: Record<ReminderStatus, CareReminder[]> = { overdue: [], today: [], upcoming: [], done: [] }
  list.forEach(r => groups[getStatus(r.dueDate, r.isCompleted)].push(r))

  const sections: { status: ReminderStatus; items: CareReminder[] }[] = [
    { status: 'overdue',  items: groups.overdue },
    { status: 'today',    items: groups.today },
    { status: 'upcoming', items: groups.upcoming },
    { status: 'done',     items: groups.done },
  ]

  if (list.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>
        <CheckCircle2 size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
        <div style={{ fontSize: 14 }}>Không có nhắc nhở nào</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.filter(s => s.items.length > 0).map(({ status, items }) => {
        const cfg = STATUS_CONFIG[status]
        return (
          <div key={status}>
            <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              {cfg.icon} {cfg.label} ({items.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((r: CareReminder) => (
                <div key={r.id} style={{ background: 'var(--surface)', border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.retailCustomer?.name ?? `KH #${r.retailCustomerId}`}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      Hạn: <strong style={{ color: cfg.color }}>{format(new Date(r.dueDate), 'dd/MM/yyyy')}</strong>
                      {r.note && <> · {r.note}</>}
                    </div>
                  </div>
                  {status !== 'done' && (
                    <button
                      onClick={() => handleComplete(r.id)}
                      disabled={completing === r.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                      <CheckCircle2 size={12} />
                      {completing === r.id ? '...' : 'Hoàn thành'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Wholesale Reminders Tab ─────────────────────────────────────────────────

function WholesaleRemindersTab() {
  const { data: reminders, isLoading, error, refetch } = useFetch<WholesaleCareReminder[]>(getWholesaleCareReminders)
  const [completing, setCompleting] = useState<number | null>(null)

  const handleComplete = async (id: number) => {
    setCompleting(id)
    try {
      await updateWholesaleCareReminder(id, { isCompleted: true })
      await refetch()
    } finally { setCompleting(null) }
  }

  if (isLoading) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ padding: 20, color: '#E24B4A' }}>Lỗi: {error}</div>

  const list = reminders ?? []
  const groups: Record<ReminderStatus, WholesaleCareReminder[]> = { overdue: [], today: [], upcoming: [], done: [] }
  list.forEach(r => groups[getStatus(r.dueDate, r.isCompleted)].push(r))

  const sections: { status: ReminderStatus; items: WholesaleCareReminder[] }[] = [
    { status: 'overdue',  items: groups.overdue },
    { status: 'today',    items: groups.today },
    { status: 'upcoming', items: groups.upcoming },
    { status: 'done',     items: groups.done },
  ]

  if (list.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>
        <CheckCircle2 size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
        <div style={{ fontSize: 14 }}>Không có nhắc nhở nào</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.filter(s => s.items.length > 0).map(({ status, items }) => {
        const cfg = STATUS_CONFIG[status]
        return (
          <div key={status}>
            <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              {cfg.icon} {cfg.label} ({items.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((r: WholesaleCareReminder) => (
                <div key={r.id} style={{ background: 'var(--surface)', border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.wholesaleCustomer?.businessName ?? `KH #${r.wholesaleCustomerId}`}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      Hạn: <strong style={{ color: cfg.color }}>{format(new Date(r.dueDate), 'dd/MM/yyyy')}</strong>
                      {r.note && <> · {r.note}</>}
                    </div>
                  </div>
                  {status !== 'done' && (
                    <button
                      onClick={() => handleComplete(r.id)}
                      disabled={completing === r.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                      <CheckCircle2 size={12} />
                      {completing === r.id ? '...' : 'Hoàn thành'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CareReminderPanel() {
  const { user } = useAuth()
  const isManager = user?.role === 'MANAGER'
  const [activeTab, setActiveTab] = useState<'retail' | 'wholesale'>('retail')

  const tabs = [
    { id: 'retail' as const,    label: 'Khách lẻ',  icon: <Users size={14} /> },
    ...(isManager ? [{ id: 'wholesale' as const, label: 'Khách sỉ', icon: <Building2 size={14} /> }] : []),
  ]

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Nhắc nhở Chăm sóc</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Danh sách nhắc nhở theo mức độ ưu tiên</div>
      </div>

      {isManager && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: 'none', borderBottom: activeTab === t.id ? '2px solid var(--blue)' : '2px solid transparent', background: 'transparent', color: activeTab === t.id ? 'var(--blue)' : 'var(--text3)', fontWeight: activeTab === t.id ? 600 : 400, fontSize: 13, cursor: 'pointer' }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'retail' && <RetailRemindersTab />}
      {activeTab === 'wholesale' && isManager && <WholesaleRemindersTab />}
    </div>
  )
}
