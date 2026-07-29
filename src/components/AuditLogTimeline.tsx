'use client'
import type { LucideIcon } from 'lucide-react'
import { FilePlus, Inbox, Send, RotateCcw, Check, X, History, PackageCheck, Factory, UserPlus, UserCog, Trash2, Pencil, Bell, Settings, RefreshCcw, KeyRound, Lock, LockOpen } from 'lucide-react'
import { format } from 'date-fns'
import { AUDIT_ACTIONS, type AuditAction, type AuditLogEntry } from '../context/AuditLogContext'

// Icon theo action chỉ là mối quan tâm hiển thị (UI) — cố tình để ở đây thay vì trong
// AuditLogContext.tsx để context không phải phụ thuộc lucide-react.
const ACTION_ICON: Record<AuditAction, LucideIcon> = {
  'proposal.created':            FilePlus,
  'proposal.acknowledged':       Inbox,
  'proposal.quote_submitted':    Send,
  'proposal.requoted':           RotateCcw,
  'proposal.approved':           Check,
  'proposal.rejected':           X,
  'proposal.purchased':          PackageCheck,
  'request.production_started':  Factory,

  'planform.created':                FilePlus,
  'planform.detail_submitted':        FilePlus,
  'planform.manh_submitted':          FilePlus,
  'planform.detail_section_approved': Check,
  'planform.detail_section_rejected': X,
  'planform.detail_approved':         Send,
  'planform.parts_section_approved':  Check,
  'planform.parts_section_rejected':  X,
  'planform.parts_approved':          Send,
  'planform.qlsx_approved':           Check,
  'planform.sent_for_boss_approval':  Send,
  'planform.qlsx_rejected':           X,
  'planform.boss_approved':           Factory,
  'planform.boss_rejected':           X,

  'kcs.issued':   Send,
  'kcs.reported': Inbox,
  'kcs.approved': Check,

  'user.created':      UserPlus,
  'user.updated':      UserCog,
  'user.role_changed': UserCog,
  'user.password_reset': KeyRound,
  'user.locked':       Lock,
  'user.unlocked':     LockOpen,
  'user.deleted':      Trash2,

  'masterdata.created': FilePlus,
  'masterdata.updated': Pencil,
  'masterdata.deleted': Trash2,

  'notification.created': Bell,
  'notification.updated': Pencil,
  'notification.deleted': Trash2,
  'system_config.updated': Settings,
  'system.data_reset':     RefreshCcw,
}

function TimelineList({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có hoạt động nào</div>
  }
  return (
    <>
      {entries.map((e, idx) => {
        const cfg = AUDIT_ACTIONS[e.action]
        const Icon = ACTION_ICON[e.action]
        const isLast = idx === entries.length - 1
        return (
          <div key={e.id} style={{ display: 'flex', gap: 10 }}>
            {/* Chấm + đường nối */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: `${cfg.color}1a`, color: cfg.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={13} />
              </div>
              {!isLast && <div style={{ width: 2, flex: 1, minHeight: 18, background: 'var(--border)', marginTop: 2 }} />}
            </div>

            {/* Nội dung */}
            <div style={{ paddingBottom: isLast ? 0 : 16, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>
                <strong>{e.actorName}</strong> <span style={{ color: 'var(--text2)' }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace' }}>
                {format(new Date(e.at), 'HH:mm dd/MM/yyyy')}
              </div>
              {e.note && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>
                  &quot;{e.note}&quot;
                </div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

// Panel "Hoạt động" dạng timeline dọc, dùng chung cho mọi entity có audit log — chỉ cần
// truyền entries lấy từ useAuditLog().getLogsFor(...). Luôn hiển thị đầy đủ, không cần bấm mở.
// `bare`: bỏ khung/tiêu đề riêng — dùng khi nhúng vào 1 card đã có tiêu đề sẵn (tránh khung lồng khung).
export default function AuditLogTimeline({ entries, title = 'Hoạt động', bare = false }: {
  entries: AuditLogEntry[]
  title?: string
  bare?: boolean
}) {
  if (bare) {
    return <TimelineList entries={entries} />
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <History size={13} color="var(--text3)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{title}</span>
      </div>

      <div style={{ padding: '14px' }}>
        <TimelineList entries={entries} />
      </div>
    </div>
  )
}
