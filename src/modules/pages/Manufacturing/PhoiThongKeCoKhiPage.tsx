'use client'

/**
 * Màn LỆNH SẢN XUẤT theo công đoạn (Phôi / Hàn / Sơn… dùng chung khuôn)
 * - Danh sách lệnh: PO | SKU | Số lượng | Đã <làm> | Còn lại | Tiến độ | Deadline
 * - Nhấn 1 dòng (đã được chủ chuyền sắp xếp) → drill-down theo hạng mục công đoạn
 * - Nhập sản lượng (0 → còn lại): tự lưu mốc thời gian; nhắc nhập 1 tiếng/lần (chưa khóa cứng)
 *
 * ĐANG DÙNG DATA MOCK (state nội bộ) — chưa nối backend/service thật.
 */

import { useState } from 'react'
import {
  Wrench, Flame, ChevronLeft, Clock, AlertTriangle, Plus, CheckCircle2, CalendarClock, Lock,
} from 'lucide-react'

const ACCENT = '#e65100'
const REMIND_MINUTES = 60

export type PhoiStage = 'PHOI' | 'HAN'

interface StageCfg {
  label: string       // tên công đoạn
  done: string        // nhãn cột "đã làm"
  verb: string        // động từ: cắt / hàn
  itemLabel: string   // nhãn hạng mục drill-down
  unit: string        // đơn vị nhập
  Icon: typeof Wrench
}
const STAGE_CFG: Record<PhoiStage, StageCfg> = {
  PHOI: { label: 'Phôi', done: 'Đã cắt', verb: 'cắt', itemLabel: 'Loại sắt', unit: 'cây', Icon: Wrench },
  HAN: { label: 'Hàn', done: 'Đã hàn', verb: 'hàn', itemLabel: 'Mảnh', unit: 'cái', Icon: Flame },
}

interface ProcLine {
  id: number
  itemName: string      // loại sắt (Phôi) / tên mảnh (Hàn)
  spec: string          // quy cách
  needQty: number       // định mức tổng cần làm
  doneQty: number       // đã làm
  lastInputAt: string | null
}
interface ProcRow {
  id: number
  poNumber: string
  sku: string
  productName: string
  soLuong: number
  deadline: string
  arrangedAt: string | null
  lines: ProcLine[]
}

const ISO = (daysFromNow: number, h = 17, m = 0) => {
  const d = new Date(); d.setDate(d.getDate() + daysFromNow); d.setHours(h, m, 0, 0); return d.toISOString()
}
const minsAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString()

// ── DATA MOCK theo công đoạn ───────────────────────────────────────
function seed(stage: PhoiStage): ProcRow[] {
  if (stage === 'HAN') {
    return [
      {
        id: 1, poNumber: 'PO-2026-001', sku: 'GHE-J55', productName: 'Ghế J55 (khung 40×40)',
        soLuong: 500, deadline: ISO(6), arrangedAt: minsAgo(150),
        lines: [
          { id: 11, itemName: 'Chân ghế', spec: 'J55-CHAN', needQty: 500, doneQty: 320, lastInputAt: minsAgo(80) },
          { id: 12, itemName: 'Tựa lưng', spec: 'J55-TUA', needQty: 500, doneQty: 500, lastInputAt: minsAgo(35) },
          { id: 13, itemName: 'Giằng ngang', spec: 'J55-GIANG', needQty: 1000, doneQty: 250, lastInputAt: minsAgo(20) },
        ],
      },
      {
        id: 2, poNumber: 'PO-2026-002', sku: 'GHE-IEA3', productName: 'Ghế IEA-3 (khung 30×30)',
        soLuong: 200, deadline: ISO(9), arrangedAt: minsAgo(25),
        lines: [
          { id: 21, itemName: 'Khung chính', spec: 'IEA3-KHUNG', needQty: 200, doneQty: 0, lastInputAt: null },
          { id: 22, itemName: 'Chân tròn', spec: 'IEA3-CHAN', needQty: 800, doneQty: 0, lastInputAt: null },
        ],
      },
      {
        id: 3, poNumber: 'PO-2026-003', sku: 'BAN-TB45', productName: 'Bàn TB-45 (vuông)',
        soLuong: 120, deadline: ISO(4), arrangedAt: null,
        lines: [
          { id: 31, itemName: 'Khung mặt bàn', spec: 'TB45-MAT', needQty: 120, doneQty: 0, lastInputAt: null },
        ],
      },
    ]
  }
  // PHOI
  return [
    {
      id: 1, poNumber: 'PO-2026-001', sku: 'GHE-J55', productName: 'Ghế J55 (khung 40×40)',
      soLuong: 500, deadline: ISO(5), arrangedAt: minsAgo(190),
      lines: [
        { id: 11, itemName: 'Sắt Vuông 6 zem', spec: '40×40', needQty: 150, doneQty: 90, lastInputAt: minsAgo(95) },
        { id: 12, itemName: 'Sắt Hộp 6 zem', spec: '25×50', needQty: 100, doneQty: 100, lastInputAt: minsAgo(40) },
        { id: 13, itemName: 'Sắt dẹt', spec: '20×3', needQty: 60, doneQty: 20, lastInputAt: minsAgo(25) },
      ],
    },
    {
      id: 2, poNumber: 'PO-2026-002', sku: 'GHE-IEA3', productName: 'Ghế IEA-3 (khung 30×30)',
      soLuong: 200, deadline: ISO(8), arrangedAt: minsAgo(30),
      lines: [
        { id: 21, itemName: 'Sắt Vuông 6 zem', spec: '30×30', needQty: 80, doneQty: 0, lastInputAt: null },
        { id: 22, itemName: 'Ống sắt tròn', spec: 'Φ16', needQty: 40, doneQty: 0, lastInputAt: null },
      ],
    },
    {
      id: 3, poNumber: 'PO-2026-003', sku: 'BAN-TB45', productName: 'Bàn TB-45 (vuông)',
      soLuong: 120, deadline: ISO(3), arrangedAt: null,
      lines: [
        { id: 31, itemName: 'Sắt Vuông 6 zem', spec: '50×50', needQty: 60, doneQty: 0, lastInputAt: null },
      ],
    },
  ]
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
const dateVN = (iso: string) => new Date(iso).toLocaleDateString('vi-VN')
const timeVN = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
const minutesSince = (iso: string | null) => iso == null ? Infinity : Math.floor((Date.now() - new Date(iso).getTime()) / 60000)

export default function PhoiThongKeCoKhiPage({ readOnly = false, stage = 'PHOI' }: { readOnly?: boolean; stage?: PhoiStage }) {
  const cfg = STAGE_CFG[stage]
  const [rows, setRows] = useState<ProcRow[]>(() => seed(stage))
  const [selId, setSelId] = useState<number | null>(null)
  const sel = rows.find(r => r.id === selId) ?? null

  const summary = (r: ProcRow) => {
    const need = r.lines.reduce((s, x) => s + x.needQty, 0)
    const done = r.lines.reduce((s, x) => s + x.doneQty, 0)
    const pct = need > 0 ? Math.round((done / need) * 100) : 0
    const daLam = Math.floor((pct / 100) * r.soLuong)
    return { pct, daLam, conLai: r.soLuong - daLam }
  }

  if (sel) return <DrillDown row={sel} cfg={cfg} readOnly={readOnly} onBack={() => setSelId(null)} onUpdate={u => setRows(rs => rs.map(r => r.id === u.id ? u : r))} />

  return (
    <div>
      <Header cfg={cfg} />
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={tbl}>
          <thead><tr style={trh}>
            <th style={th}>PO</th><th style={th}>SKU</th><th style={th}>Sản phẩm</th>
            <th style={thR}>Số lượng</th><th style={thR}>{cfg.done}</th><th style={thR}>Còn lại</th>
            <th style={{ ...th, width: 160 }}>Tiến độ</th><th style={th}>Deadline</th><th style={th}>Sắp xếp</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const s = summary(r)
              const arranged = !!r.arrangedAt
              return (
                <tr key={r.id}
                  onClick={() => arranged && setSelId(r.id)}
                  style={{ ...trb, cursor: arranged ? 'pointer' : 'not-allowed', opacity: arranged ? 1 : 0.55 }}
                  onMouseEnter={e => { if (arranged) e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  title={arranged ? `Nhấn để nhập sản lượng ${cfg.verb} theo ${cfg.itemLabel.toLowerCase()}` : 'Chủ chuyền chưa sắp xếp lệnh này'}
                >
                  <td style={{ ...td, fontWeight: 700 }}>{r.poNumber}</td>
                  <td style={td}>{r.sku}</td>
                  <td style={{ ...td, color: 'var(--text2)' }}>{r.productName}</td>
                  <td style={tdR}>{fmt(r.soLuong)}</td>
                  <td style={tdR}>{fmt(s.daLam)}</td>
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
        <CalendarClock size={14} /> Lệnh chỉ mở nhập sau khi <b style={{ color: 'var(--text2)' }}>chủ chuyền sắp xếp</b> (đã lưu mốc thời gian). Nhấn dòng để nhập sản lượng {cfg.verb} theo {cfg.itemLabel.toLowerCase()}.
      </div>
    </div>
  )
}

// ── Drill-down ─────────────────────────────────────────────────────
function DrillDown({ row, cfg, readOnly, onBack, onUpdate }: { row: ProcRow; cfg: StageCfg; readOnly: boolean; onBack: () => void; onUpdate: (r: ProcRow) => void }) {
  const [draft, setDraft] = useState<Record<number, string>>({})
  const staleLines = row.lines.filter(l => minutesSince(l.lastInputAt) >= REMIND_MINUTES)

  const submit = (lineId: number) => {
    const add = Number(draft[lineId])
    if (!add || add <= 0) return
    const updated: ProcRow = {
      ...row,
      lines: row.lines.map(l => l.id === lineId
        ? { ...l, doneQty: Math.min(l.needQty, l.doneQty + add), lastInputAt: new Date().toISOString() }
        : l),
    }
    onUpdate(updated)
    setDraft(d => ({ ...d, [lineId]: '' }))
  }

  return (
    <div>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 14, fontSize: 13 }}>
        <ChevronLeft size={15} /> Quay lại danh sách
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800 }}>{row.poNumber} · {row.sku}</h2>
        <span style={{ color: 'var(--text3)', fontSize: 13 }}>{row.productName} · SL {fmt(row.soLuong)} · hạn {dateVN(row.deadline)}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Nhập số <b>{cfg.unit} đã {cfg.verb}</b> theo từng {cfg.itemLabel.toLowerCase()} — hệ thống tự lưu mốc thời gian.</div>

      {staleLines.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 'var(--radius)', background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 13 }}>
          <AlertTriangle size={16} />
          <span>Nhắc nhập định kỳ: có <b>{staleLines.length}</b> {cfg.itemLabel.toLowerCase()} đã quá <b>{REMIND_MINUTES} phút</b> chưa cập nhật sản lượng {cfg.verb}.</span>
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={tbl}>
          <thead><tr style={trh}>
            <th style={th}>{cfg.itemLabel}</th><th style={th}>Quy cách</th><th style={thR}>Định mức ({cfg.unit})</th>
            <th style={thR}>{cfg.done} ({cfg.unit})</th><th style={thR}>Còn lại</th><th style={th}>Cập nhật lúc</th>
            {!readOnly && <th style={{ ...th, width: 220 }}>Nhập số {cfg.unit} vừa {cfg.verb}</th>}
          </tr></thead>
          <tbody>
            {row.lines.map(l => {
              const remain = l.needQty - l.doneQty
              const stale = minutesSince(l.lastInputAt) >= REMIND_MINUTES
              const done = remain <= 0
              return (
                <tr key={l.id} style={trb}>
                  <td style={{ ...td, fontWeight: 600 }}>{l.itemName}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{l.spec}</td>
                  <td style={tdR}>{fmt(l.needQty)}</td>
                  <td style={tdR}>{fmt(l.doneQty)}</td>
                  <td style={{ ...tdR, fontWeight: 600, color: done ? 'var(--green)' : ACCENT }}>{fmt(Math.max(remain, 0))}</td>
                  <td style={td}>
                    {l.lastInputAt
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: stale ? 'var(--amber)' : 'var(--text3)' }}>
                          <Clock size={12} /> {timeVN(l.lastInputAt)}
                        </span>
                      : <span style={{ color: 'var(--text3)' }}>— chưa nhập —</span>}
                  </td>
                  {!readOnly && (
                    <td style={td}>
                      {done ? <span className="badge green">đủ định mức</span> : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="number" min={0} max={remain} placeholder={`tối đa ${fmt(remain)}`} value={draft[l.id] ?? ''}
                            onChange={e => {
                              const v = e.target.value
                              if (v === '') return setDraft(d => ({ ...d, [l.id]: '' }))
                              let n = Math.floor(Number(v))
                              if (isNaN(n)) return
                              if (n < 0) n = 0
                              if (n > remain) n = remain
                              setDraft(d => ({ ...d, [l.id]: String(n) }))
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') submit(l.id) }}
                            style={{ width: 110 }}
                          />
                          <button className="primary" onClick={() => submit(l.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }}>
                            <Plus size={13} /> Ghi nhận
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Header({ cfg }: { cfg: StageCfg }) {
  const Icon = cfg.Icon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: '#fff3e0', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} />
      </div>
      <div>
        <h2 style={{ fontSize: 19, fontWeight: 800 }}>Lệnh sản xuất — Công đoạn {cfg.label}</h2>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Theo dõi tiến độ {cfg.verb} theo PO/SKU · nhập sản lượng theo {cfg.itemLabel.toLowerCase()}</div>
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

const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const trh: React.CSSProperties = { background: 'var(--surface2)', textAlign: 'left' }
const trb: React.CSSProperties = { borderTop: '1px solid var(--border)', transition: 'background .1s' }
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
