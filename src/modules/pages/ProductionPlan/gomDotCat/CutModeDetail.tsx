'use client'

/** Phần chi tiết của ô "Chế độ cắt": dòng nhắc khi vượt ngưỡng, 2 lựa chọn chế độ, và ô lý do khi chọn "Chấp nhận hao hụt cao hơn". */

import type { RefObject } from 'react'
import { AlertTriangle } from 'lucide-react'
import { fmtPct } from '../../../../utils/numberFormat'
import { CUT_MODES, type CutModeKey } from '../gomDotCatUi'
import { amberNote, iconTop, mutedBox } from './gomDotCatStyles'

export interface CutModeDetailProps {
  /** Có loại sắt ước tính vượt ngưỡng (mới cần nhắc chọn đơn gấp). */
  overrideNeeded: boolean
  open: boolean
  stdLenLabel: string
  cutMode: CutModeKey
  onCutMode: (mode: CutModeKey) => void
  reason: string
  onReason: (v: string) => void
  /** Lỗi thiếu lý do chỉ hiện sau khi KHSX đã bấm Tính mà chưa điền. */
  touched: boolean
  reasonMissing: boolean
  invalid: boolean
  suggestedPct: number | null
  suggestedDriver: string | null
  reasonBoxRef: RefObject<HTMLDivElement>
}

function ModeOption({ m, active, onPick }: { m: (typeof CUT_MODES)[number]; active: boolean; onPick: () => void }) {
  return (
    <label
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 'var(--radius)', cursor: 'pointer',
        border: `1px solid ${active ? 'var(--fg-e65100)' : 'var(--border)'}`,
        background: active ? 'rgba(230,81,0,0.06)' : 'var(--surface)',
      }}
    >
      <input
        type="radio"
        name="cutMode"
        checked={active}
        onChange={onPick}
        // Ghim kích thước: để trình duyệt tự co giãn thì ở khung hẹp nút radio phình to bằng cả dòng.
        style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1, accentColor: 'var(--fg-e65100)' }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{m.label}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{m.desc}</div>
      </div>
    </label>
  )
}

function ReasonBox({ p, boxRef }: { p: Omit<CutModeDetailProps, 'reasonBoxRef'>; boxRef: RefObject<HTMLDivElement> }) {
  const flagged = p.touched && p.reasonMissing
  return (
    <div ref={boxRef} style={{
      display: 'flex', flexDirection: 'column', gap: 8, padding: '9px 11px', background: 'var(--bg-fffbeb)',
      border: '1px solid var(--fg-fcd34d)', borderRadius: 'var(--radius)',
    }}>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
        Chỉ cắt trên đúng chiều dài cây đã định (không dò cây khác), không đặt trần hao hụt — hệ thống tự tìm phương án
        hao hụt nhỏ nhất trên cây đó.
        {p.suggestedPct != null && (
          <span style={{ color: 'var(--text3)' }}>
            {' '}Ước tính đợt này cần ≥ {fmtPct(p.suggestedPct, 1)}{p.suggestedDriver ? ` (${p.suggestedDriver})` : ''};
            {' '}số thật hiện sau khi tính.
          </span>
        )}
      </div>
      <label htmlFor="override-reason" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>Lý do để Sếp duyệt</label>
      <input
        id="override-reason"
        value={p.reason}
        onChange={(e) => p.onReason(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder="Lý do để Sếp duyệt (vd: PO-4 giao gấp, không kịp chờ cán cây riêng)"
        style={{
          width: '100%', padding: '6px 9px', fontSize: 12.5, borderRadius: 'var(--radius)', background: 'var(--surface)',
          border: `1px solid ${flagged ? 'var(--fg-dc2626)' : 'var(--border)'}`, color: 'var(--text)',
        }}
      />
      {p.touched && p.invalid && <div style={{ fontSize: 12, color: 'var(--fg-b91c1c)' }}>Nhập lý do thì Sếp mới có căn cứ duyệt.</div>}
    </div>
  )
}

export default function CutModeDetail({ reasonBoxRef, ...p }: CutModeDetailProps) {
  return (
    <>
      {p.overrideNeeded && !p.open && (
        <div style={{ ...amberNote, background: 'none', padding: 0, marginTop: 6, gap: 7 }}>
          <AlertTriangle size={14} style={iconTop} />
          <span>
            <b>Ước tính ở cây chuẩn {p.stdLenLabel}: đợt này có thể vượt ngưỡng hao hụt.</b> Kết quả thật có sau khi Tính.
            Cần hao hụt cao hơn: mở “Chế độ cắt”, chọn “Chấp nhận hao hụt cao hơn”.
          </span>
        </div>
      )}
      {p.open && (
        <div style={{ ...mutedBox, marginTop: 8, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {p.overrideNeeded && (
            <div style={{ ...amberNote, border: '1px solid var(--fg-fcd34d)' }}>
              <AlertTriangle size={14} style={iconTop} />
              <span>
                <b>Ước tính ở cây chuẩn {p.stdLenLabel}: đợt này có thể vượt ngưỡng hao hụt.</b> Kết quả thật có sau khi bấm Tính.
                Đợt gấp cần hao hụt cao hơn mức mặc định: chọn <b>“Chấp nhận hao hụt cao hơn”</b> bên dưới (Sếp duyệt riêng).
              </span>
            </div>
          )}
          {CUT_MODES.map((m) => (
            <ModeOption key={m.value} m={m} active={p.cutMode === m.value} onPick={() => p.onCutMode(m.value)} />
          ))}
          {p.cutMode === 'ACCEPT_OVER' && <ReasonBox p={p} boxRef={reasonBoxRef} />}
        </div>
      )}
    </>
  )
}
