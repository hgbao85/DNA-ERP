'use client'

/**
 * Thẻ một lệnh dùng chung (23/11/2026): mã lệnh, dòng trạng thái ("còn thiếu N mảnh" / "Xong Phôi dd/mm"), hạn giao (cam khi sắp
 * tới hạn, đỏ khi quá hạn), thanh tiến độ %, mũi tên mở. Dùng ở "Sản lượng theo lệnh" (Khung hàn / Mảnh chờ đan) và danh sách lệnh
 * của Hướng dẫn cắt. Thiếu `percent` thì chỉ có mã lệnh + mũi tên.
 */

import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { DEADLINE_COLOR, deadlineInfo } from './stageOutputModel'

export default function PiProgressCard({ title, status, statusTone = 'amber', deadline, percent, onClick }: {
  title: ReactNode
  /** Chữ trạng thái cạnh mã lệnh, vd "còn thiếu 12 mảnh", "Đủ số", "Xong Phôi 23/11". */
  status?: string | null
  statusTone?: 'amber' | 'green'
  deadline?: string | null
  percent?: number | null
  onClick: () => void
}) {
  const dl = deadlineInfo(deadline)
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', background: 'var(--surface)', color: 'var(--text)',
      border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 48,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px 10px', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 14 }}>{title}</b>
          {status && <span style={{ fontSize: 12, fontWeight: 600, color: statusTone === 'green' ? 'var(--green)' : 'var(--amber)' }}>{status}</span>}
          {dl && (
            <span style={{ fontSize: 12, color: DEADLINE_COLOR[dl.tone], fontWeight: dl.tone === 'normal' ? 400 : 700 }}>
              Hạn {dl.date}{dl.tone === 'late' ? ' · quá hạn' : ''}
            </span>
          )}
        </div>
        {percent != null && (
          <div role="progressbar" aria-label={`Tiến độ ${percent}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
            style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', background: 'var(--green)' }} />
          </div>
        )}
      </div>
      {percent != null && <b style={{ fontSize: 15, minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{percent}%</b>}
      <ChevronRight size={16} aria-hidden style={{ color: 'var(--text3)', flexShrink: 0 }} />
    </button>
  )
}
