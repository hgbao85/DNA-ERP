'use client'

/**
 * Chiều dài cây theo TỪNG QUY CÁCH. Đổi ô nào thì mọi con số của đúng loại sắt đó trong bảng tính lại, các loại khác không
 * đụng tới. Đóng sẵn: cây chuẩn là ca gần như luôn xảy ra, mở ra chỉ khi thật sự cần đổi.
 */

import { Fragment } from 'react'
import { fmtMm } from '../../../../utils/numberFormat'
import {
  DEFAULT_STOCK_LENGTH_MM, fmtBarMm, isBadStockLength, MAX_STOCK_LENGTH_MM, MIN_STOCK_LENGTH_MM, roundUp5cm,
  type MaterialInTable,
} from '../gomDotCatUi'
import { ghostBtn, statusLine } from './gomDotCatStyles'

export interface StockLengthProps {
  /** Mọi loại sắt có trong bảng SKU. */
  materials: MaterialInTable[]
  /** Các loại đã đổi khỏi cây chuẩn. */
  changed: MaterialInTable[]
  /** Chiều dài hợp lệ đã gõ (materialId -> mm). */
  lengths: Record<string, number>
  /** Chuỗi đang gõ (materialId -> text). */
  inputs: Record<string, string>
  onInput: (materialId: string, value: string) => void
  onReset: () => void
}

const HEAD: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.3,
}

function inputStyle(bad: boolean, changed: boolean): React.CSSProperties {
  return {
    width: 78, padding: '4px 8px', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
    fontWeight: changed ? 700 : 400, borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text)',
    border: `1px solid ${bad ? 'var(--fg-dc2626)' : changed ? 'var(--fg-e65100)' : 'var(--border)'}`,
  }
}

/** Dòng "Chiều dài đã đổi: ..." khi đã đổi mà chưa mở khung sửa. */
export function LengthChangedLine({ p }: { p: StockLengthProps }) {
  return (
    <div style={statusLine('var(--text2)')}>
      Chiều dài đã đổi:{' '}
      {p.changed.map((m, i) => (
        <span key={m.id}>
          {i > 0 && ' · '}
          <span title={m.code}>{m.label}</span> <b>{fmtBarMm(roundUp5cm(p.lengths[m.id]))}</b>
        </span>
      ))}
      {p.changed.length < p.materials.length && (
        <span style={{ color: 'var(--text3)' }}> · còn lại {fmtBarMm(DEFAULT_STOCK_LENGTH_MM)}</span>
      )}
    </div>
  )
}

function Notes({ p }: { p: StockLengthProps }) {
  // Ghi chú/lỗi để NGOÀI lưới: câu dài nằm trong lưới (span 2 cột) kéo giãn cột ô nhập, bóp cột tên sắt xuống dòng.
  return (
    <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span>Bỏ trống = cây chuẩn {fmtBarMm(DEFAULT_STOCK_LENGTH_MM)}.</span>
      {p.materials.some((m) => isBadStockLength(p.inputs[m.id] ?? '')) && (
        <span style={{ color: 'var(--fg-b91c1c)' }}>
          Chiều dài phải từ {fmtMm(MIN_STOCK_LENGTH_MM)} đến {fmtMm(MAX_STOCK_LENGTH_MM)} — nhập theo mm (6000, không phải 6).
        </span>
      )}
      {p.changed.map((m) => {
        const mm = p.lengths[m.id]
        return roundUp5cm(mm) !== mm ? (
          <span key={m.id} style={{ color: 'var(--fg-b45309)' }}>
            {m.label}: {mm} mm sẽ tính và đặt mua là {fmtBarMm(roundUp5cm(mm))} (cây luôn tròn 5 cm).
          </span>
        ) : null
      })}
      <span>Số gõ không tròn 5 cm được làm tròn lên khi tính, vd 5.830 → 5.850 mm.</span>
    </div>
  )
}

export default function StockLengthEditor({ p }: { p: StockLengthProps }) {
  return (
    <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Chiều dài cây theo từng loại sắt</span>
        {p.changed.length > 0 && <button onClick={p.onReset} style={ghostBtn}>Về cây chuẩn</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto max-content', gap: '5px 12px', alignItems: 'center', maxWidth: 360 }}>
        <span style={HEAD}>Loại sắt</span>
        {/* "mm" nêu MỘT lần ở tiêu đề cột thay vì lặp sau từng ô. */}
        <span style={{ ...HEAD, textAlign: 'right' }}>Chiều dài (mm)</span>
        {p.materials.map((m) => {
          const changed = p.lengths[m.id] != null
          return (
            <Fragment key={m.id}>
              <label htmlFor={`len-${m.id}`} title={m.code}
                style={{ fontSize: 12.5, color: changed ? 'var(--text)' : 'var(--text2)', fontWeight: changed ? 600 : 400 }}>
                {m.label}
              </label>
              <input
                id={`len-${m.id}`}
                value={p.inputs[m.id] ?? ''}
                onChange={(e) => p.onInput(m.id, e.target.value)}
                inputMode="numeric"
                placeholder={String(DEFAULT_STOCK_LENGTH_MM)}
                aria-label={`Chiều dài cây cho ${m.label}, tính bằng mm`}
                title="Bỏ trống = dùng cây chuẩn của công ty. Nhập mm, vd 5850 cho cây 5.850 mm."
                style={inputStyle(isBadStockLength(p.inputs[m.id] ?? ''), changed)}
              />
            </Fragment>
          )
        })}
      </div>
      <Notes p={p} />
    </div>
  )
}
