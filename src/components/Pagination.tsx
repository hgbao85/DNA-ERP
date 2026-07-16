'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number // 1-based
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void // không truyền -> ẩn selector
  pageSizeOptions?: number[]
}

const navBtn = (disabled: boolean) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, padding: 0,
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  background: 'var(--surface2)', color: 'var(--text)',
  cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
  opacity: disabled ? 0.4 : 1,
})

const pageBtn = (active: boolean) => ({
  minWidth: 28, height: 28, padding: '0 6px',
  border: `1px solid ${active ? '#1f2937' : 'var(--border)'}`, borderRadius: 'var(--radius)',
  background: active ? '#1f2937' : 'var(--surface)',
  color: active ? '#fff' : 'var(--text2)',
  fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer' as const,
})

/** Chọn tối đa 5 số trang xung quanh trang hiện tại, thu gọn phần còn lại bằng "…". */
function pageWindow(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const nums = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const sorted = [...nums].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const result: (number | '…')[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - (sorted[i - 1] as number) > 1) result.push('…')
    result.push(n)
  })
  return result
}

export default function Pagination({
  page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  if (total === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
        Hiển thị {from}-{to} trong {total}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            style={{ marginRight: 8, padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}
          >
            {pageSizeOptions.map(n => <option key={n} value={n}>{n} / trang</option>)}
          </select>
        )}

        <button style={navBtn(page <= 1)} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Trang trước">
          <ChevronLeft size={14} />
        </button>

        {pageWindow(page, totalPages).map((p, i) =>
          p === '…'
            ? <span key={`ellipsis-${i}`} style={{ fontSize: 12, color: 'var(--text3)', padding: '0 2px' }}>…</span>
            : <button key={p} style={pageBtn(p === page)} onClick={() => onPageChange(p)}>{p}</button>
        )}

        <button style={navBtn(page >= totalPages)} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Trang sau">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
