'use client'

/**
 * Màn XUẤT ĐAN (kho khung dây) — role Quản lý xuất đan (WEAVING_EXPORT)
 * 3 cấp drill-down:
 *   1) Danh sách lệnh: PO | SKU | Đã xuất | Còn lại | Tiến độ | Deadline
 *   2) Mảnh của lệnh: Mảnh | Đã xuất | Còn lại | Số điểm đan
 *   3) Phân bổ mảnh cho các điểm đan: Điểm đan | Số lượng | Deadline  (+ thêm dòng)
 *
 * Đan chỉ là lớp theo dõi tiến độ giao–nhận, KHÔNG trừ tồn kho.
 * Ràng buộc logic: tổng phân bổ ≤ số lượng cần. ĐANG DÙNG DATA MOCK.
 */

import { useMemo, useState } from 'react'
import {
  ArrowUpFromLine, ChevronLeft, Plus, Trash2, CheckCircle2, CalendarClock, Lock, MapPin,
} from 'lucide-react'

const ACCENT = '#e65100'

// Danh mục điểm đan (mock — khớp seed weavingPoints)
const WEAVING_POINTS = [
  { id: 1, name: 'DD-A — Anh Tuấn' },
  { id: 2, name: 'DD-B — Chị Hà' },
  { id: 3, name: 'DD-C — Anh Phú' },
  { id: 4, name: 'DD-D — Chị Loan' },
]

interface Alloc { id: number; pointId: number; qty: number; deadline: string }
interface ManhRow {
  id: number
  ten: string
  code: string
  need: number          // số lượng cần đan (mảnh)
  allocs: Alloc[]
}
interface DanRow {
  id: number
  poNumber: string
  sku: string
  productName: string
  deadline: string
  arrangedAt: string | null
  manh: ManhRow[]
}

let _seq = 900
const uid = () => _seq++
const ISO = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(17, 0, 0, 0); return x.toISOString() }
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const fmt = (n: number) => n.toLocaleString('vi-VN')
const dateVN = (iso: string) => new Date(iso).toLocaleDateString('vi-VN')
const timeVN = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
const dateInput = (iso: string) => iso.slice(0, 10)

// ── DATA MOCK ──────────────────────────────────────────────────────
function seed(): DanRow[] {
  return [
    {
      id: 1, poNumber: 'PO-2026-001', sku: 'GHE-J55', productName: 'Ghế J55', deadline: ISO(12), arrangedAt: minsAgo(120),
      manh: [
        { id: 11, ten: 'Mặt ghế', code: 'MAT-GHE', need: 500, allocs: [
          { id: uid(), pointId: 1, qty: 300, deadline: ISO(7) },
          { id: uid(), pointId: 2, qty: 120, deadline: ISO(10) },
        ] },
        { id: 12, ten: 'Tựa lưng đan', code: 'TUA-DAN', need: 500, allocs: [] },
      ],
    },
    {
      id: 2, poNumber: 'PO-2026-002', sku: 'GHE-IEA3', productName: 'Ghế IEA-3', deadline: ISO(15), arrangedAt: minsAgo(20),
      manh: [
        { id: 21, ten: 'Mặt đan', code: 'IEA3-MAT', need: 200, allocs: [] },
      ],
    },
    {
      id: 3, poNumber: 'PO-2026-003', sku: 'BAN-TB45', productName: 'Bàn TB-45', deadline: ISO(6), arrangedAt: null,
      manh: [
        { id: 31, ten: 'Mặt bàn đan', code: 'TB45-DAN', need: 120, allocs: [] },
      ],
    },
  ]
}

const allocSum = (m: ManhRow) => m.allocs.reduce((s, a) => s + a.qty, 0)

export default function XuatDanPage({ readOnly = false }: { readOnly?: boolean }) {
  const [rows, setRows] = useState<DanRow[]>(seed)
  const [selPo, setSelPo] = useState<number | null>(null)
  const [selManh, setSelManh] = useState<number | null>(null)

  const po = rows.find(r => r.id === selPo) ?? null
  const manh = po?.manh.find(m => m.id === selManh) ?? null

  const poSummary = (r: DanRow) => {
    const need = r.manh.reduce((s, m) => s + m.need, 0)
    const out = r.manh.reduce((s, m) => s + allocSum(m), 0)
    const pct = need > 0 ? Math.round((out / need) * 100) : 0
    return { need, out, conLai: need - out, pct }
  }

  const updateManh = (poId: number, manhId: number, fn: (m: ManhRow) => ManhRow) =>
    setRows(rs => rs.map(r => r.id !== poId ? r : { ...r, manh: r.manh.map(m => m.id === manhId ? fn(m) : m) }))

  // ── Cấp 3: phân bổ cho điểm đan ──
  if (po && manh) {
    const used = allocSum(manh)
    const remain = manh.need - used
    const addAlloc = () => {
      const taken = manh.allocs.map(a => a.pointId)
      const point = WEAVING_POINTS.find(p => !taken.includes(p.id)) ?? WEAVING_POINTS[0]
      updateManh(po.id, manh.id, m => ({ ...m, allocs: [...m.allocs, { id: uid(), pointId: point.id, qty: 0, deadline: ISO(7) }] }))
    }
    const setAlloc = (aid: number, patch: Partial<Alloc>) =>
      updateManh(po.id, manh.id, m => ({ ...m, allocs: m.allocs.map(a => a.id === aid ? { ...a, ...patch } : a) }))
    const delAlloc = (aid: number) =>
      updateManh(po.id, manh.id, m => ({ ...m, allocs: m.allocs.filter(a => a.id !== aid) }))

    return (
      <div>
        <button onClick={() => setSelManh(null)} style={backBtn}><ChevronLeft size={15} /> Quay lại danh sách mảnh</button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>{po.poNumber} · {manh.ten}</h2>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>{po.sku} · cần đan {fmt(manh.need)} mảnh</span>
        </div>
        <div style={{ fontSize: 13, marginBottom: 14 }}>
          Đã phân bổ <b>{fmt(used)}</b> / {fmt(manh.need)} · còn được xuất <b style={{ color: remain > 0 ? ACCENT : 'var(--green)' }}>{fmt(remain)}</b> mảnh
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table style={tbl}>
            <thead><tr style={trh}>
              <th style={th}>Điểm đan</th><th style={th}>Số lượng (mảnh)</th><th style={th}>Deadline</th>{!readOnly && <th style={{ ...th, width: 60 }}></th>}
            </tr></thead>
            <tbody>
              {manh.allocs.map(a => {
                // trần cho dòng này = còn lại + chính nó
                const maxForRow = remain + a.qty
                return (
                  <tr key={a.id} style={trb}>
                    <td style={td}>
                      {readOnly
                        ? <span><MapPin size={12} /> {WEAVING_POINTS.find(p => p.id === a.pointId)?.name}</span>
                        : <select value={a.pointId} onChange={e => setAlloc(a.id, { pointId: Number(e.target.value) })} style={{ width: 220 }}>
                            {WEAVING_POINTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>}
                    </td>
                    <td style={td}>
                      {readOnly ? fmt(a.qty) : (
                        <input type="number" min={0} max={maxForRow} value={a.qty || ''} placeholder="0"
                          onChange={e => {
                            let n = Math.floor(Number(e.target.value)); if (isNaN(n) || n < 0) n = 0
                            if (n > maxForRow) n = maxForRow
                            setAlloc(a.id, { qty: n })
                          }}
                          style={{ width: 120 }} />
                      )}
                    </td>
                    <td style={td}>
                      {readOnly ? dateVN(a.deadline) : (
                        <input type="date" value={dateInput(a.deadline)}
                          onChange={e => setAlloc(a.id, { deadline: new Date(e.target.value).toISOString() })}
                          style={{ width: 160 }} />
                      )}
                    </td>
                    {!readOnly && <td style={{ ...td, textAlign: 'center' }}>
                      <button onClick={() => delAlloc(a.id)} title="Xoá" style={{ padding: 5, color: 'var(--red)' }}><Trash2 size={14} /></button>
                    </td>}
                  </tr>
                )
              })}
              {manh.allocs.length === 0 && (
                <tr><td colSpan={readOnly ? 3 : 4} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Chưa phân bổ điểm đan nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <button className="primary" onClick={addAlloc} disabled={remain <= 0 && manh.allocs.length > 0}
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> Thêm điểm đan
          </button>
        )}
      </div>
    )
  }

  // ── Cấp 2: danh sách mảnh của lệnh ──
  if (po) {
    return (
      <div>
        <button onClick={() => setSelPo(null)} style={backBtn}><ChevronLeft size={15} /> Quay lại danh sách lệnh</button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>{po.poNumber} · {po.sku}</h2>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>{po.productName} · hạn {dateVN(po.deadline)}</span>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table style={tbl}>
            <thead><tr style={trh}>
              <th style={th}>Mảnh</th><th style={th}>Mã</th><th style={thR}>Cần đan</th><th style={thR}>Đã xuất</th><th style={thR}>Còn lại</th>
              <th style={{ ...th, width: 160 }}>Tiến độ</th><th style={thR}>Số điểm đan</th>
            </tr></thead>
            <tbody>
              {po.manh.map(m => {
                const out = allocSum(m); const conLai = m.need - out
                const pct = m.need > 0 ? Math.round((out / m.need) * 100) : 0
                return (
                  <tr key={m.id} onClick={() => setSelManh(m.id)} style={{ ...trb, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Nhấn để phân bổ cho điểm đan">
                    <td style={{ ...td, fontWeight: 600 }}>{m.ten}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{m.code}</td>
                    <td style={tdR}>{fmt(m.need)}</td>
                    <td style={tdR}>{fmt(out)}</td>
                    <td style={{ ...tdR, color: conLai > 0 ? ACCENT : 'var(--green)', fontWeight: 600 }}>{fmt(conLai)}</td>
                    <td style={td}><Progress pct={pct} /></td>
                    <td style={tdR}>{m.allocs.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Cấp 1: danh sách lệnh ──
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: '#fff3e0', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowUpFromLine size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>Xuất đan (kho khung dây)</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Phân bổ mảnh ra các điểm đan theo PO/SKU · chỉ theo dõi số lượng, không trừ tồn kho</div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 10 }}>
        <table style={tbl}>
          <thead><tr style={trh}>
            <th style={th}>PO</th><th style={th}>SKU</th><th style={th}>Sản phẩm</th>
            <th style={thR}>Đã xuất</th><th style={thR}>Còn lại</th><th style={{ ...th, width: 160 }}>Tiến độ</th>
            <th style={th}>Deadline</th><th style={th}>Sắp xếp</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const s = poSummary(r); const arranged = !!r.arrangedAt
              return (
                <tr key={r.id}
                  onClick={() => arranged && setSelPo(r.id)}
                  style={{ ...trb, cursor: arranged ? 'pointer' : 'not-allowed', opacity: arranged ? 1 : 0.55 }}
                  onMouseEnter={e => { if (arranged) e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  title={arranged ? 'Nhấn để xem mảnh & phân bổ điểm đan' : 'Chủ chuyền chưa sắp xếp lệnh này'}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.poNumber}</td>
                  <td style={td}>{r.sku}</td>
                  <td style={{ ...td, color: 'var(--text2)' }}>{r.productName}</td>
                  <td style={tdR}>{fmt(s.out)}</td>
                  <td style={{ ...tdR, color: s.conLai > 0 ? ACCENT : 'var(--green)', fontWeight: 600 }}>{fmt(s.conLai)}</td>
                  <td style={td}><Progress pct={s.pct} /></td>
                  <td style={td}>{dateVN(r.deadline)}</td>
                  <td style={td}>
                    {arranged
                      ? <span className="badge green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> {timeVN(r.arrangedAt!)}</span>
                      : <span className="badge amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={12} /> Chưa sắp xếp</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <CalendarClock size={14} /> Lệnh chỉ mở phân bổ sau khi chủ chuyền sắp xếp. Tổng phân bổ cho các điểm đan không vượt quá số cần.
      </div>
    </div>
  )
}

function Progress({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'var(--green)' : pct >= 50 ? ACCENT : '#b45309'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 5, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, transition: 'width .2s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, width: 34, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

const backBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 14, fontSize: 13 }
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const trh: React.CSSProperties = { background: 'var(--surface2)', textAlign: 'left' }
const trb: React.CSSProperties = { borderTop: '1px solid var(--border)', transition: 'background .1s' }
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
