'use client'

/**
 * Xuất sắt cho Phôi (kho Phôi Sơn Hàn) — mục sidebar dưới "Xuất kho".
 *
 * Bảng MASTER liệt kê NHIỀU PO cùng lúc, mỗi PO một dòng kèm tiến độ + trạng thái
 * (Đã xong / Đang thực hiện / Chờ). Kho xuất TUẦN TỰ nên chỉ PO "Đang thực hiện"
 * mới bấm được; PO trước đã xuất đủ, PO sau bị khóa tới khi PO này xong.
 *
 * Click dòng PO đang thực hiện → BUNG chi tiết xuất sắt NGAY TRONG dòng đó (accordion):
 * xuất từng loại sắt, ưu tiên loại CHƯA ĐỒNG BỘ (Phôi cắt chậm hơn loại khác cùng
 * mảnh). Bấm "Xuất" → tạo đợt DA_NHAN trong mock service dùng chung → hiện NGAY bên Phôi.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpFromLine, Check, AlertTriangle, Lock, Circle, ChevronDown, ChevronRight, Info, Undo2, X, Zap, PackagePlus, Layers } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { KeHoachSatView, CapLaiSatItem } from '../../../services/api'
import LoadingState from '../../../components/LoadingState'
import ProgressBar from '../../../components/ProgressBar'

const ACCENT = '#4527A0'
const LARGE_XUAT = 40 // ≥ ngần này cây → hỏi xác nhận trước khi xuất (chống bấm nhầm số lớn)
const NCOLS = 7       // số cột bảng master (colSpan cho dòng chi tiết bung ra)
const DONG_BO_HINT = 'Chưa đồng bộ: Phôi cắt loại này chậm hơn loại khác cùng mảnh → đang kéo cả bộ lại, cần ưu tiên xuất.'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '9px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const tdMuted: React.CSSProperties = { ...tdR, color: 'var(--text3)' } // số phụ (mờ để mắt bám số chính)
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

// Thanh "Phôi cắt" (đồng bộ) — tỷ lệ đã cắt/cần của 1 loại trong mảnh; thanh ngắn nhất = nghẽn.
function dongBoBar(daCat: number, planCay: number, lech: boolean) {
  const pct = planCay > 0 ? Math.round((daCat / planCay) * 100) : 0
  const color = lech ? '#dc2626' : '#16a34a'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, minWidth: 60, height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, fontSize: 11, fontWeight: 700, color, minWidth: 42 }}>
        {pct}%{lech && <AlertTriangle size={11} />}
      </span>
    </div>
  )
}

type PoState = 'done' | 'active' | 'wait'
interface PoRow {
  po: string
  sku: string
  ngayLenh: string
  items: KeHoachSatView[]
  planCay: number
  daXuat: number
  conXuat: number
  state: PoState
}

export default function XuatSatPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: plan, isLoading, refetch } = useFetch<KeHoachSatView[]>(() => api.getKeHoachXuatSat(), [])
  const { data: capLai, refetch: refetchCap } = useFetch<CapLaiSatItem[]>(() => api.getDeXuatCapLaiSat(), [])
  const [qty, setQty] = useState<Record<string, string>>({})
  const [qtyCap, setQtyCap] = useState<Record<string, string>>({})
  const [openPo, setOpenPo] = useState<string | null | undefined>(undefined)
  const [pending, setPending] = useState<{ id: string; n: number } | null>(null) // xác nhận xuất số lớn
  const [bulkConfirm, setBulkConfirm] = useState<string | null>(null)             // xác nhận xuất hàng loạt ưu tiên
  const [toast, setToast] = useState<{ msg: string; undoId?: string } | null>(null)
  const toastTimer = useRef<number | null>(null)

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const showToast = (msg: string, undoId?: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, undoId })
    toastTimer.current = window.setTimeout(() => setToast(null), 6000)
  }

  // Gom theo PO (giữ thứ tự = thứ tự thực hiện) và gán trạng thái tuần tự.
  const poRows = useMemo<PoRow[]>(() => {
    const order: string[] = []
    const map = new Map<string, KeHoachSatView[]>()
    for (const p of plan ?? []) {
      if (!map.has(p.poNumber)) { map.set(p.poNumber, []); order.push(p.poNumber) }
      map.get(p.poNumber)!.push(p)
    }
    let activeTaken = false
    return order.map(po => {
      const items = map.get(po)!
      const planCay = items.reduce((s, p) => s + p.planCay, 0)
      const daXuat = items.reduce((s, p) => s + p.daXuat, 0)
      const conXuat = items.reduce((s, p) => s + p.conXuat, 0)
      let state: PoState
      if (conXuat <= 0) state = 'done'
      else if (!activeTaken) { state = 'active'; activeTaken = true }
      else state = 'wait'
      return { po, sku: items[0].sku, ngayLenh: items[0].ngayLenh, items, planCay, daXuat, conXuat, state }
    })
  }, [plan])

  const activePo = poRows.find(r => r.state === 'active')?.po ?? null
  const expandedPo = (openPo === undefined ? activePo : openPo)
  const isOpen = (po: string) => po === expandedPo && po === activePo

  if (isLoading || !plan) return <LoadingState />

  const clampN = (p: KeHoachSatView) =>
    Math.max(0, Math.min(p.conXuat, Math.floor(Number(qty[p.id] ?? p.conXuat) || 0)))

  const doXuat = async (p: KeHoachSatView, n: number) => {
    const res = await api.xuatSatChoPhoi(p.id, n)
    setQty(q => { const { [p.id]: _, ...rest } = q; return rest })
    setPending(null)
    refetch()
    showToast(`Đã xuất ${n} cây ${p.loaiSat} ${p.quyCach} cho Phôi`, res?.id)
  }

  const onXuatClick = (p: KeHoachSatView) => {
    const n = clampN(p)
    if (n <= 0) return
    if (n >= LARGE_XUAT) setPending({ id: p.id, n }) // số lớn → xác nhận
    else doXuat(p, n)
  }

  const doXuatUuTien = async (items: KeHoachSatView[]) => {
    const list = items.filter(p => p.conXuat > 0)
    let tong = 0
    for (const p of list) { await api.xuatSatChoPhoi(p.id, p.conXuat); tong += p.conXuat }
    setBulkConfirm(null)
    refetch()
    showToast(`Đã xuất ưu tiên: ${list.length} loại · ${tong} cây cho Phôi`)
  }

  const undo = async (id: string) => {
    await api.huyXuatDot(id)
    setToast(null)
    refetch()
  }

  // Cấp bù phần PHẾ (KCS đề xuất) → tạo đợt DA_NHAN cho Phôi cắt lại.
  const doCapLai = async (c: CapLaiSatItem) => {
    const n = Math.max(1, Math.floor(Number(qtyCap[c.id] ?? c.soCay) || 0))
    await api.capLaiSatChoPhoi(c.id, n)
    setQtyCap(q => { const { [c.id]: _, ...rest } = q; return rest })
    refetchCap(); refetch()
    showToast(`Đã cấp lại ${n} cây ${c.loaiSat} ${c.quyCach} cho Phôi cắt lại`)
  }

  const badge = (s: PoState) => {
    if (s === 'done') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#16a34a' }}><Check size={14} /> Đã xong</span>
    if (s === 'active') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: ACCENT }}><Circle size={9} fill={ACCENT} /> Đang thực hiện</span>
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}><Lock size={13} /> Chờ</span>
  }

  // Điểm nghẽn đồng bộ: trong 1 mảnh, loại sắt nào có tỷ lệ đã-cắt/kế-hoạch THẤP hơn
  // loại dẫn đầu → đang kéo mảnh lại → ưu tiên xuất.
  const nghenOf = (items: KeHoachSatView[]) => {
    const set = new Set<string>()
    const byManh = new Map<string, KeHoachSatView[]>()
    for (const p of items) {
      if (!byManh.has(p.manhTen)) byManh.set(p.manhTen, [])
      byManh.get(p.manhTen)!.push(p)
    }
    for (const arr of byManh.values()) {
      const frac = arr.map(p => p.planCay > 0 ? p.daCat / p.planCay : 0)
      const leader = Math.max(...frac)
      arr.forEach((p, i) => { if (frac[i] < leader - 1e-9) set.add(p.id) })
    }
    return set
  }

  // ── Chi tiết xuất sắt của 1 PO (bung ra trong dòng master) ──────────
  const renderDetail = (r: PoRow) => {
    const nghen = nghenOf(r.items)
    const uuTien = r.items.filter(p => nghen.has(p.id) && p.conXuat > 0)
    const sumCon = r.items.reduce((s, p) => s + p.conXuat, 0)
    // Gom loại sắt theo MẢNH — đồng bộ tính trong 1 mảnh nên hiển thị theo nhóm.
    const byManh = new Map<string, KeHoachSatView[]>()
    const manhOrder: string[] = []
    for (const p of r.items) {
      if (!byManh.has(p.manhTen)) { byManh.set(p.manhTen, []); manhOrder.push(p.manhTen) }
      byManh.get(p.manhTen)!.push(p)
    }

    return (
      <div style={{ padding: '14px 16px', background: 'var(--surface2)' }}>
        {uuTien.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 14px', marginBottom: 10, borderRadius: 10, background: 'var(--red-bg, #fef2f2)', color: '#b91c1c', fontSize: 13 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 200 }}>Ưu tiên xuất (đang chưa đồng bộ): <b>{uuTien.map(p => `${p.loaiSat} ${p.quyCach}`).join(', ')}</b></span>
            {bulkConfirm === r.po ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Xuất hết {uuTien.reduce((s, p) => s + p.conXuat, 0)} cây?
                <button onClick={() => doXuatUuTien(uuTien)} style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', cursor: 'pointer' }}>Xác nhận</button>
                <button onClick={() => setBulkConfirm(null)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>Hủy</button>
              </span>
            ) : (
              <button onClick={() => setBulkConfirm(r.po)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Zap size={13} /> Xuất tất cả ưu tiên
              </button>
            )}
          </div>
        )}
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                <th style={th}>Loại sắt</th>
                <th style={th}>Quy cách</th>
                <th style={thR}>Đã xuất / Tổng</th>
                <th style={{ ...th, width: 170 }}>Phôi cắt (đồng bộ)</th>
                <th style={thR}>Còn phải xuất (cây)</th>
                <th style={{ ...th, textAlign: 'center', width: 220 }}>Xuất cho Phôi</th>
              </tr>
            </thead>
            <tbody>
              {manhOrder.map(manh => {
                const arr = byManh.get(manh)!
                const manhNghen = arr.some(p => nghen.has(p.id))
                return (
                  <Fragment key={manh}>
                    {/* Tiêu đề nhóm mảnh — đồng bộ xét trong nhóm này */}
                    <tr style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
                      <td colSpan={6} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Layers size={13} style={{ color: 'var(--text3)' }} /> {manh}
                          {manhNghen
                            ? <span title={DONG_BO_HINT} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#dc2626', cursor: 'help' }}><AlertTriangle size={11} /> chưa đồng bộ <Info size={11} /></span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--green)' }}><Check size={11} /> cân đối</span>}
                        </span>
                      </td>
                    </tr>
                    {arr.map(p => {
                      const du = p.conXuat <= 0
                      const lech = nghen.has(p.id)
                      const isPending = pending?.id === p.id
                      return (
                        <tr key={p.id} style={{ borderTop: '1px solid var(--border)', background: lech ? 'var(--red-bg, #fef2f2)' : 'var(--surface)' }}>
                          <td style={{ ...td, fontWeight: 600, borderLeft: `3px solid ${lech ? '#dc2626' : 'transparent'}` }}>{p.loaiSat}</td>
                          <td style={{ ...td, color: 'var(--text3)' }}>{p.quyCach}</td>
                          <td style={tdMuted}>{p.daXuat} / {p.planCay}</td>
                          <td style={td}>{dongBoBar(p.daCat, p.planCay, lech)}</td>
                          <td style={{ ...tdR, fontWeight: 700, color: du ? 'var(--green)' : '#dc2626' }}>{p.conXuat}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            {du ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                                <Check size={14} /> đã xuất đủ
                              </span>
                            ) : isPending ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                Xuất <b>{pending!.n}</b> cây?
                                <button onClick={() => doXuat(p, pending!.n)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer' }}><Check size={13} /> Xác nhận</button>
                                <button onClick={() => setPending(null)} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>Hủy</button>
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                <input type="number" min={1} max={p.conXuat}
                                  value={qty[p.id] ?? String(p.conXuat)}
                                  onChange={e => {
                                    const raw = e.target.value
                                    if (raw === '') { setQty(q => ({ ...q, [p.id]: '' })); return }
                                    const v = Math.max(0, Math.min(p.conXuat, Math.floor(Number(raw) || 0)))
                                    setQty(q => ({ ...q, [p.id]: String(v) }))
                                  }}
                                  style={{ width: 62, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                                <button onClick={() => onXuatClick(p)}
                                  style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  Xuất
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                <td style={{ ...td, fontWeight: 700 }} colSpan={2}>Tổng — {r.po}</td>
                <td style={{ ...tdMuted, fontWeight: 700, color: 'var(--text2)' }}>{r.daXuat} / {r.planCay}</td>
                <td style={td}></td>
                <td style={{ ...tdR, fontWeight: 700, color: sumCon > 0 ? '#dc2626' : 'var(--green)' }}>{sumCon}</td>
                <td style={td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto' }}>
      {!embedded && (
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ArrowUpFromLine size={20} /> Xuất sắt cho Phôi
        </h2>
      )}
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Kho xuất sắt <b>tuần tự</b> theo PO. Chỉ PO <b style={{ color: ACCENT }}>đang thực hiện</b> mới bấm được — <b>click để mở chi tiết xuất sắt</b>. PO sau bị khóa tới khi PO này xuất đủ.
      </div>

      {/* ── Cần cấp lại (KCS phế) — dòng gọn, chỉ hiện khi có ──────────── */}
      {capLai && capLai.length > 0 && (
        <div style={{ border: '1px solid #fca5a5', borderRadius: 12, background: 'var(--red-bg, #fef2f2)', padding: '10px 14px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            <PackagePlus size={16} /> Cần cấp lại — KCS chấm phế ({capLai.reduce((s, c) => s + c.soCay, 0)} cây)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {capLai.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <span style={{ flex: 1, minWidth: 240 }}>
                  <b style={{ fontFamily: 'monospace' }}>{c.poNumber}</b>
                  <span style={{ color: 'var(--text2)' }}> · {c.loaiSat} {c.quyCach} · </span>
                  <b style={{ color: '#c62828' }}>{c.soCay} cây phế</b>
                  {c.reason && <span style={{ color: 'var(--text3)' }}> · {c.reason}</span>}
                </span>
                <input type="number" min={1} value={qtyCap[c.id] ?? String(c.soCay)}
                  onChange={e => setQtyCap(q => ({ ...q, [c.id]: e.target.value }))}
                  style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                <button onClick={() => doCapLai(c)}
                  style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Cấp lại
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ ...th, width: 36 }}></th>
              <th style={th}>Lệnh sản xuất</th>
              <th style={th}>Sản phẩm</th>
              <th style={th}>Ngày lệnh</th>
              <th style={thR}>Còn phải xuất (cây)</th>
              <th style={{ ...th, width: 190 }}>Tiến độ (đã xuất / tổng)</th>
              <th style={{ ...th, width: 160 }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {poRows.map(r => {
              const open = isOpen(r.po)
              const clickable = r.state === 'active'
              const toggle = () => clickable && setOpenPo(open ? null : r.po)
              return (
                <Fragment key={r.po}>
                  <tr
                    onClick={toggle}
                    onKeyDown={clickable ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }) : undefined}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    aria-expanded={clickable ? open : undefined}
                    title={r.state === 'wait' && activePo ? `Chờ ${activePo} xuất đủ mới tới lượt` : undefined}
                    style={{
                      borderTop: '1px solid var(--border)',
                      cursor: clickable ? 'pointer' : 'not-allowed',
                      background: open ? 'var(--accent-soft, #EDE7F6)' : undefined,
                      opacity: r.state === 'wait' ? 0.55 : 1,
                    }}>
                    <td style={{ ...td, textAlign: 'center', color: clickable ? ACCENT : 'var(--text3)' }}>
                      {clickable ? (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}
                    </td>
                    <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{r.po}</td>
                    <td style={{ ...td, color: 'var(--text2)' }}>{r.sku}</td>
                    <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{r.ngayLenh}</td>
                    <td style={{ ...tdR, fontWeight: 700, color: r.conXuat > 0 ? '#dc2626' : 'var(--green)' }}>{r.conXuat}</td>
                    <td style={td}>
                      <ProgressBar value={r.daXuat} max={r.planCay} />
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{r.daXuat} / {r.planCay} cây</div>
                    </td>
                    <td style={td}>{badge(r.state)}</td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={NCOLS} style={{ padding: 0, borderTop: '1px solid var(--border)' }}>
                        {renderDetail(r)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {poRows.length === 0 && (
              <tr><td colSpan={NCOLS} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 28 }}>Không có kế hoạch xuất sắt</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Toast phản hồi + Hoàn tác ─────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
          background: '#1f2937', color: '#fff', borderRadius: 10, fontSize: 13,
          boxShadow: '0 8px 24px rgba(0,0,0,.25)', maxWidth: 'calc(100vw - 32px)',
        }}>
          <Check size={16} color="#4ade80" />
          <span>{toast.msg}</span>
          {toast.undoId && (
            <button onClick={() => undo(toast.undoId!)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12, fontWeight: 700, border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#fff', cursor: 'pointer' }}>
              <Undo2 size={13} /> Hoàn tác
            </button>
          )}
          <button onClick={() => setToast(null)} style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: '#9ca3af' }} title="Đóng">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
