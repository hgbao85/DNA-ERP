'use client'

/**
 * Thông số máy cắt hiện tại - KHSX CHỈ XEM (cần đổi thì liên hệ Admin). Đóng sẵn, bấm mới mở; hiện thông số của ĐÚNG máy sẽ
 * dùng cho đợt (máy chọn riêng, không thì máy mặc định) + phần chung. BE cũ chưa trả các trường này thì không hiện nút.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { SolverMachine } from '../../../../types/admin'
import { MACHINE_LABEL } from '../../../../utils/cutMachine'
import { fmtNum } from '../../../../utils/numberFormat'
import type { MachineParam } from '../gomDotCatUi'
import { mutedBox, textBtn } from './gomDotCatStyles'

export function MachineParamsButton({ open, isMobile, onToggle }: { open: boolean; isMobile: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} aria-controls="machine-params" onClick={onToggle} style={textBtn(isMobile)}>
      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      {open ? 'Ẩn thông số máy cắt' : 'Xem thông số máy cắt'}
    </button>
  )
}

/** Bảng số cây/bó theo quy cách (MC Tự động): quy cách ngoài bảng thì BE chặn tính. */
function BundleTable({ entries, isMobile }: { entries: [string, number[]][]; isMobile: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" aria-expanded={open} aria-controls="bundle-spec-table" onClick={() => setOpen((v) => !v)}
        style={textBtn(isMobile, 11.5, 2)}>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {open ? 'Ẩn bảng số cây/bó' : `Xem bảng số cây/bó (${entries.length} quy cách)`}
      </button>
      {open && (
        <div id="bundle-spec-table" style={{ marginTop: 2 }}>
          {entries.map(([spec, factors]) => (
            <div key={spec} style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.6, fontVariantNumeric: 'tabular-nums' }}>
              <b>{spec}</b>: {factors.map((n) => fmtNum(n)).join(' / ')} cây
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
            Quy cách ngoài bảng không tính được với MC Tự động: hỏi Sếp số cây/bó, nhờ Admin thêm vào bảng rồi tính lại.
          </div>
        </div>
      )}
    </div>
  )
}

export function MachineParamsBody({ params, machine, isDefaultMachine, bundleEntries, isMobile }: {
  params: MachineParam[]
  machine: SolverMachine
  /** true = máy mặc định của hệ thống (KHSX chưa chọn riêng). */
  isDefaultMachine: boolean
  bundleEntries: [string, number[]][]
  isMobile: boolean
}) {
  return (
    <div id="machine-params" style={{ ...mutedBox, marginTop: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
        Thông số {MACHINE_LABEL[machine]}{isDefaultMachine ? ' (máy mặc định)' : ''} đang dùng để tính
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {params.map((p) => (
          <div key={p.label} title={p.hint}
            style={{ ...mutedBox, minWidth: 0, padding: '6px 10px', background: 'var(--surface)' }}>
            <dt style={{ fontSize: 11.5, color: 'var(--text2)' }}>{p.label}</dt>
            <dd style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {p.value}
            </dd>
          </div>
        ))}
      </dl>
      {machine === 'tu_dong' && bundleEntries.length > 0 && <BundleTable entries={bundleEntries} isMobile={isMobile} />}
      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>
        Chỉ xem. Cần đổi thông số thì liên hệ Admin (Cấu hình hệ thống).
      </div>
    </div>
  )
}
