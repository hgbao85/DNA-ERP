'use client'

/**
 * Chuông thông báo dùng chung (vd: thông báo định mức đã duyệt).
 * Tự quản trạng thái mở/đóng và "đã xem" (tắt từng thông báo).
 */

import { useState } from 'react'
import { Bell, X } from 'lucide-react'

export interface NotifBellItem {
  id: string | number
  title: string
  subtitle: string
}

export default function NotifBell({ items, heading = 'Thông báo duyệt', emptyText = 'Chưa có thông báo nào.' }: {
  items: NotifBellItem[]
  heading?: string
  emptyText?: string
}) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<(string | number)[]>([])
  const visible = items.filter(i => !dismissed.includes(i.id))

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title={heading}
        style={{ position: 'relative', padding: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex' }}>
        <Bell size={18} color="var(--text2)" />
        {visible.length > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, padding: '0 4px', background: '#c62828', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{visible.length}</span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 290, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 30px rgba(0,0,0,.15)', zIndex: 50, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>{heading}</div>
          {visible.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text3)' }}>{emptyText}</div>
          ) : visible.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 30px 10px 14px', borderTop: '1px solid var(--border)', position: 'relative' }}>
              <span style={{ color: '#2e7d32', fontSize: 15 }}>✓</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{n.subtitle}</div>
              </div>
              <button onClick={() => setDismissed(d => [...d, n.id])} title="Đã xem — tắt thông báo"
                style={{ position: 'absolute', top: 6, right: 6, padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
