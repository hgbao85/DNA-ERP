import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isValid, parse, startOfMonth, startOfWeek } from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  /** 'yyyy-MM-dd' (cùng định dạng <input type="date">) hoặc '' khi chưa chọn. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Hiện nút "Xoá" - chỉ bật cho ô không bắt buộc. */
  clearable?: boolean
  title?: string
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const POPUP_WIDTH = 280
const GAP = 4
const EDGE = 8

/**
 * Ô chọn ngày tự vẽ thay <input type="date">: lịch gốc do trình duyệt vẽ theo kích thước cửa sổ,
 * không theo layout trang nên tràn ra ngoài khung màn hình hẹp. Lịch ở đây dùng position: fixed,
 * tự dịch trái/lật lên để luôn nằm trong viewport, kể cả khi ô nằm trong modal có cuộn.
 */
export default function DatePicker({ value, onChange, placeholder = 'dd/mm/yyyy', clearable = false, title }: DatePickerProps) {
  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : null
  const selectedValid = selected && isValid(selected) ? selected : null
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(selectedValid ?? new Date()))
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const place = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const r = trigger.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const h = popupRef.current?.offsetHeight ?? 330
    const left = Math.max(EDGE, Math.min(r.left, vw - POPUP_WIDTH - EDGE))
    const below = r.bottom + GAP
    const top = below + h > vh - EDGE && r.top - GAP - h >= EDGE ? r.top - GAP - h : Math.min(below, Math.max(EDGE, vh - h - EDGE))
    setPos({ top, left })
  }

  const openPicker = () => {
    setMonth(startOfMonth(selectedValid ?? new Date()))
    setOpen(true)
  }

  // Đo lại sau khi popup đã render (biết chiều cao thật) và mỗi khi cuộn/đổi kích thước.
  useLayoutEffect(() => { if (open) place() }, [open, month])
  useEffect(() => {
    if (!open) return
    const onScroll = () => place()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!popupRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (d: Date) => { onChange(format(d, 'yyyy-MM-dd')); setOpen(false) }
  const today = new Date()
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%',
          padding: '7px 10px', fontSize: 13, textAlign: 'left',
          border: `1px solid ${open ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 'var(--radius)',
          background: 'var(--surface)', color: selectedValid ? 'var(--text)' : 'var(--text3)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedValid ? format(selectedValid, 'dd/MM/yyyy') : placeholder}
        </span>
        <Calendar size={14} color="var(--text3)" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div
          ref={popupRef}
          role="dialog"
          aria-label="Chọn ngày"
          style={{
            position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: 1000,
            width: POPUP_WIDTH, maxWidth: `calc(100vw - ${EDGE * 2}px)`, padding: 10,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <NavButton label="Tháng trước" onClick={() => setMonth(m => addMonths(m, -1))}><ChevronLeft size={16} /></NavButton>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Tháng {format(month, 'M/yyyy')}</div>
            <NavButton label="Tháng sau" onClick={() => setMonth(m => addMonths(m, 1))}><ChevronRight size={16} /></NavButton>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {WEEKDAYS.map(w => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text3)', padding: '4px 0' }}>{w}</div>
            ))}
            {days.map(d => {
              const isSel = !!selectedValid && isSameDay(d, selectedValid)
              const isToday = isSameDay(d, today)
              const inMonth = isSameMonth(d, month)
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pick(d)}
                  aria-label={format(d, 'dd/MM/yyyy')}
                  aria-pressed={isSel}
                  style={{
                    height: 34, padding: 0, fontSize: 12, borderRadius: 6,
                    border: isToday && !isSel ? '1px solid var(--blue)' : '1px solid transparent',
                    background: isSel ? 'var(--blue)' : 'transparent',
                    color: isSel ? '#fff' : inMonth ? 'var(--text)' : 'var(--text3)',
                    fontWeight: isSel || isToday ? 700 : 400,
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >
                  {format(d, 'd')}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => pick(today)} style={{ border: 'none', background: 'transparent', color: 'var(--blue)', fontWeight: 600, padding: '6px 8px' }}>Hôm nay</button>
            {clearable && value && (
              <button type="button" onClick={() => { onChange(''); setOpen(false) }} style={{ border: 'none', background: 'transparent', color: 'var(--text3)', padding: '6px 8px' }}>Xoá</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} style={{ display: 'flex', padding: 6, border: 'none', background: 'transparent' }}>
      {children}
    </button>
  )
}
