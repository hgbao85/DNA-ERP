'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import type { BeAuditLogEntry } from '../services/audit-log-api'
import { AUDIT_ACTION_META, auditChanges, auditNoVisibleChangeReason, auditRecordName, auditTableLabel } from '../services/audit-log-format'

const PREVIEW_CHANGES = 3

/**
 * Danh sách nhật ký THẬT của BE (`audit_logs`) - Admin "Nhật ký hoạt động" + "Hoạt động gần đây" ở Tổng
 * quan. Mỗi dòng: lúc nào, ai, làm gì (Tạo/Sửa/Xoá), với đối tượng nào, đổi những trường gì.
 * `userNames` tra id người dùng (BE chỉ trả userId) - id lạ hiện "Không rõ", null hiện "Hệ thống".
 */
export default function AuditLogList({ entries, userNames }: {
  entries: BeAuditLogEntry[]
  userNames: Map<string, string>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {entries.map((e, i) => (
        <AuditLogRow key={e.id} entry={e} userNames={userNames} first={i === 0} />
      ))}
    </div>
  )
}

function AuditLogRow({ entry, userNames, first }: { entry: BeAuditLogEntry; userNames: Map<string, string>; first: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const meta = AUDIT_ACTION_META[entry.action]
  const recordName = auditRecordName(entry)
  const changes = auditChanges(entry)
  const shown = expanded ? changes : changes.slice(0, PREVIEW_CHANGES)
  const actor = entry.userId ? (userNames.get(entry.userId) ?? 'Không rõ') : 'Hệ thống'

  return (
    <div style={{ padding: '10px 0', borderTop: first ? 'none' : '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{
        flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
        color: meta?.color ?? 'var(--text2)', background: meta?.bg ?? 'var(--surface2)', marginTop: 1,
      }}>
        {meta?.label ?? entry.action}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', overflowWrap: 'anywhere' }}>
          <span style={{ fontWeight: 600 }}>{auditTableLabel(entry.tableName)}</span>
          {recordName && <span> · {recordName}</span>}
          <span style={{ color: 'var(--text3)' }}> #{entry.recordId}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          {actor} · {format(new Date(entry.createdAt), 'dd/MM/yyyy HH:mm:ss')}
        </div>
        {entry.action === 'UPDATE' && (
          changes.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>
              {auditNoVisibleChangeReason(entry)}
            </div>
          ) : (
            <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', fontSize: 12, color: 'var(--text2)' }}>
              {shown.map(c => (
                <li key={c.field} style={{ overflowWrap: 'anywhere' }}>
                  {c.label}: <span style={{ color: 'var(--text3)', textDecoration: 'line-through' }}>{c.from}</span> → <span style={{ fontWeight: 600 }}>{c.to}</span>
                </li>
              ))}
              {changes.length > PREVIEW_CHANGES && (
                <li>
                  <button
                    type="button"
                    onClick={() => setExpanded(x => !x)}
                    style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--fg-3949ab)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    {expanded ? 'Thu gọn' : `+${changes.length - PREVIEW_CHANGES} trường khác`}
                  </button>
                </li>
              )}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
