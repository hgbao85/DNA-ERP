'use client'
import type { LucideIcon } from 'lucide-react'
import { FilePlus, Inbox, Send, RotateCcw, Check, X, History, PackageCheck, Factory } from 'lucide-react'
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
}

// Panel "Hoạt động" dạng timeline dọc, dùng chung cho mọi entity có audit log — chỉ cần
// truyền entries lấy từ useAuditLog().getLogsFor(...). Luôn hiển thị đầy đủ, không cần bấm mở.
export default function AuditLogTimeline({ entries, title = 'Hoạt động' }: {
  entries: AuditLogEntry[]
  title?: string
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <History size={13} color="var(--text3)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{title}</span>
      </div>

      <div style={{ padding: '14px' }}>
        {entries.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có hoạt động nào</div>
        ) : (
          entries.map((e, idx) => {
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
          })
        )}
      </div>
    </div>
  )
}
