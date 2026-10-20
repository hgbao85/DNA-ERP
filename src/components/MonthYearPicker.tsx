import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { monthKey, YEAR_PAGE, yearPageEnd } from './monthYearLogic'

/**
 * Ô chọn THÁNG và ô chọn NĂM cùng kiểu với `DatePicker` (ô bấm + lịch nổi tự dịch vào trong màn hình) thay cho hai ô
 * <select> rời. `max` / `current` là chuỗi cùng định dạng với `value`: kỳ sau `max` bị mờ không chọn được (báo cáo không có
 * số của tương lai), `current` được viền xanh và có nút tắt "Tháng này / Năm nay".
 */

const POPUP_WIDTH = 264
const GAP = 4
const EDGE = 8
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

interface MonthPickerProps {
  /** 'yyyy-MM' */
  value: string
  onChange: (value: string) => void
  max?: string
  current?: string
  title?: string
}

interface YearPickerProps {
  value: number
  onChange: (value: number) => void
  max?: number
  current?: number
  title?: string
}

export function MonthPicker({ value, onChange, max, current, title }: MonthPickerProps) {
  return (
    <Popover triggerLabel={`Tháng ${Number(value.slice(5, 7))}/${value.slice(0, 4)}`} dialogLabel="Chọn tháng" title={title}>
      {(close) => <MonthGrid value={value} max={max} current={current} onPick={(v) => { onChange(v); close() }} />}
    </Popover>
  )
}

export function YearPicker({ value, onChange, max, current, title }: YearPickerProps) {
  return (
    <Popover triggerLabel={`Năm ${value}`} dialogLabel="Chọn năm" title={title}>
      {(close) => <YearGrid value={value} max={max} current={current} onPick={(v) => { onChange(v); close() }} />}
    </Popover>
  )
}

// ─── lưới chọn ───────────────────────────────────────────────────────────────

function MonthGrid({ value, max, current, onPick }: { value: string; max?: string; current?: string; onPick: (v: string) => void }) {
  const [year, setYear] = useState(Number(value.slice(0, 4)))
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity
  const keyOf = (m: number) => monthKey(year, m)
  return (
    <>
      <Header label={String(year)} prevLabel="Năm trước" nextLabel="Năm sau" nextDisabled={year >= maxYear}
        onPrev={() => setYear((y) => y - 1)} onNext={() => setYear((y) => y + 1)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {MONTHS.map((m) => (
          <Cell key={m} label={`Tháng ${m}`} ariaLabel={`Tháng ${m}/${year}`} selected={keyOf(m) === value} isCurrent={keyOf(m) === current}
            disabled={!!max && keyOf(m) > max} onClick={() => onPick(keyOf(m))} />
        ))}
      </div>
      {current && (!max || current <= max) && <Footer label="Tháng này" onClick={() => onPick(current)} />}
    </>
  )
}

function YearGrid({ value, max, current, onPick }: { value: number; max?: number; current?: number; onPick: (v: number) => void }) {
  const [end, setEnd] = useState(() => yearPageEnd(value, max))
  const years = Array.from({ length: YEAR_PAGE }, (_, i) => end - YEAR_PAGE + 1 + i)
  return (
    <>
      <Header label={`${years[0]} – ${end}`} prevLabel="12 năm trước" nextLabel="12 năm sau" nextDisabled={max !== undefined && end >= max}
        onPrev={() => setEnd((e) => e - YEAR_PAGE)} onNext={() => setEnd((e) => e + YEAR_PAGE)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {years.map((y) => (
          <Cell key={y} label={String(y)} ariaLabel={`Năm ${y}`} selected={y === value} isCurrent={y === current}
            disabled={max !== undefined && y > max} onClick={() => onPick(y)} />
        ))}
      </div>
      {current !== undefined && (max === undefined || current <= max) && <Footer label="Năm nay" onClick={() => onPick(current)} />}
    </>
  )
}

function Header({ label, prevLabel, nextLabel, nextDisabled, onPrev, onNext }: {
  label: string; prevLabel: string; nextLabel: string; nextDisabled: boolean; onPrev: () => void; onNext: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <NavButton label={prevLabel} onClick={onPrev}><ChevronLeft size={16} /></NavButton>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
      <NavButton label={nextLabel} onClick={onNext} disabled={nextDisabled}><ChevronRight size={16} /></NavButton>
    </div>
  )
}

function Cell({ label, ariaLabel, selected, isCurrent, disabled, onClick }: {
  label: string; ariaLabel: string; selected: boolean; isCurrent: boolean; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={selected}
      style={{
        height: 40, padding: 0, fontSize: 13, borderRadius: 6,
        border: isCurrent && !selected ? '1px solid var(--blue)' : '1px solid transparent',
        background: selected ? 'var(--blue)' : 'transparent',
        color: selected ? '#fff' : 'var(--text)',
        fontWeight: selected || isCurrent ? 700 : 400,
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!selected && !disabled) e.currentTarget.style.background = 'var(--surface2)' }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      {label}
    </button>
  )
}

function NavButton({ label, onClick, disabled = false, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      style={{ display: 'flex', padding: 6, border: 'none', background: 'transparent', opacity: disabled ? 0.35 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  )
}

function Footer({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
      <button type="button" onClick={onClick} style={{ border: 'none', background: 'transparent', color: 'var(--blue)', fontWeight: 600, padding: '6px 8px' }}>{label}</button>
    </div>
  )
}

// ─── ô bấm + lịch nổi (cùng cách đặt vị trí như DatePicker: position fixed, dịch vào trong viewport, lật lên khi hết chỗ) ───

function Popover({ triggerLabel, dialogLabel, title, children }: {
  triggerLabel: string; dialogLabel: string; title?: string; children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const place = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const r = trigger.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const h = popupRef.current?.offsetHeight ?? 260
    const left = Math.max(EDGE, Math.min(r.left, vw - POPUP_WIDTH - EDGE))
    const below = r.bottom + GAP
    const top = below + h > vh - EDGE && r.top - GAP - h >= EDGE ? r.top - GAP - h : Math.min(below, Math.max(EDGE, vh - h - EDGE))
    setPos({ top, left })
  }

  useLayoutEffect(() => { if (open) place() }, [open])
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

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: 'auto', minWidth: 150, minHeight: 36,
          padding: '0 12px', fontSize: 13, textAlign: 'left',
          border: `1px solid ${open ? 'var(--blue)' : 'var(--border2)'}`, borderRadius: 8,
          background: 'var(--surface)', color: 'var(--text)',
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>{triggerLabel}</span>
        <Calendar size={14} color="var(--text3)" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div
          ref={popupRef}
          role="dialog"
          aria-label={dialogLabel}
          style={{
            position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: 1000,
            width: POPUP_WIDTH, maxWidth: `calc(100vw - ${EDGE * 2}px)`, padding: 10,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,.18)',
          }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </>
  )
}
