'use client'

/**
 * Lịch sử nhận sắt (Phôi) — mục sidebar, READ-ONLY.
 *
 * List: PO · SKU · Thời gian nhận (kho xuất qua) · Thời gian hoàn thành (cắt xong hết).
 * Bấm 1 PO → chi tiết kho đã xuất qua những gì: bao nhiêu cây theo từng chiều dài
 * (6000mm, 5850mm…) và từng loại sắt.
 */

import { useMemo, useState } from 'react'
import { ArrowDownToLine, ChevronLeft, Check, Clock } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { SatIssueView } from '../../../services/api'
import LoadingState from '../../../components/LoadingState'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

interface PoGroup { po: string; sku: string; items: SatIssueView[]; thoiGianNhan: string; hoanThanh: string | null }

export default function LichSuNhanSatPage() {
  const { data: lines, isLoading } = useFetch<SatIssueView[]>(() => api.getDotXuatSat(), [])
  const [selPo, setSelPo] = useState<string | null>(null)

  const groups: PoGroup[] = useMemo(() => {
    const map = new Map<string, SatIssueView[]>()
    for (const l of lines ?? []) {
      if (!map.has(l.poNumber)) map.set(l.poNumber, [])
      map.get(l.poNumber)!.push(l)
    }
    return [...map.entries()].map(([po, items]) => {
      const nhan = items.map(i => i.dotThoiGian).sort()[0] ?? ''
      const allDone = items.every(i => i.status === 'DA_CAT')
      const hoanThanh = allDone ? (items.map(i => i.hoanThanhAt ?? '').sort().at(-1) || null) : null
      return { po, sku: items[0].sku, items, thoiGianNhan: nhan, hoanThanh }
    })
  }, [lines])

  if (isLoading || !lines) return <LoadingState />

  const sel = selPo ? groups.find(g => g.po === selPo) ?? null : null
  if (sel) return <Detail g={sel} onBack={() => setSelPo(null)} />

  // ── List view ──────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <ArrowDownToLine size={20} /> Lịch sử nhận sắt
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Kho xuất sắt qua theo từng PO — Phôi tự động nhận. Bấm 1 PO để xem kho đã xuất bao nhiêu cây theo từng chiều dài.
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: 150 }} /><col /><col style={{ width: 190 }} /><col style={{ width: 190 }} /></colgroup>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO</th>
              <th style={th}>SKU</th>
              <th style={th}>Thời gian nhận</th>
              <th style={th}>Thời gian hoàn thành</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.po}
                onClick={() => setSelPo(g.po)}
                style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{g.po}</td>
                <td style={{ ...td, fontWeight: 600 }}>{g.sku}</td>
                <td style={{ ...td, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} />{g.thoiGianNhan}</span>
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {g.hoanThanh
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#16a34a', fontWeight: 600 }}><Check size={14} />{g.hoanThanh}</span>
                    : <span style={{ color: '#e65100', fontWeight: 600 }}>Đang cắt</span>}
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa nhận đợt sắt nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Detail: kho đã xuất gì cho PO này ────────────────────────
function Detail({ g, onBack }: { g: PoGroup; onBack: () => void }) {
  // Tổng cây theo chiều dài nguyên cây (6000mm, 5850mm…)
  const byLen = new Map<number, number>()
  for (const it of g.items) byLen.set(it.barLen, (byLen.get(it.barLen) ?? 0) + it.soCay)
  const lenRows = [...byLen.entries()].sort((a, b) => b[0] - a[0])
  const rows = [...g.items].sort((a, b) => a.dotThoiGian.localeCompare(b.dotThoiGian) || a.loaiSat.localeCompare(b.loaiSat))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          <span style={{ fontFamily: 'monospace' }}>{g.po}</span> <span style={{ fontWeight: 400, color: 'var(--text2)' }}>— {g.sku}</span>
        </h2>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16, marginLeft: 2 }}>
        Thời gian nhận: {g.thoiGianNhan} · Hoàn thành: {g.hoanThanh ?? 'đang cắt'}
      </div>

      {/* Tổng cây theo chiều dài — kho xuất qua bao nhiêu cây 6m / 5m */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Kho đã xuất qua:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {lenRows.map(([len, cay]) => (
          <div key={len} style={{ ...card, padding: '12px 18px', minWidth: 150 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Cây {len.toLocaleString('vi-VN')}mm <span style={{ color: 'var(--text3)' }}>(~{(len / 1000).toFixed(2)}m)</span></div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e65100' }}>{cay} <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 400 }}>cây</span></div>
          </div>
        ))}
      </div>

      {/* Chi tiết từng đợt / loại sắt */}
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Loại sắt</th>
              <th style={th}>Quy cách</th>
              <th style={thR}>Chiều dài (mm)</th>
              <th style={thR}>Số cây</th>
              <th style={th}>Thời gian xuất</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(l => (
              <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600 }}>{l.loaiSat}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{l.quyCach}</td>
                <td style={tdR}>{l.barLen.toLocaleString('vi-VN')}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{l.soCay}</td>
                <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{l.dotThoiGian}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
