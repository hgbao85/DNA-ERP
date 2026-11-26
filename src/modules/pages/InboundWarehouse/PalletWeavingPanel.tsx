'use client'

/**
 * Xuất đan theo pallet (24/11/2026, docs THIET-KE-PALLET-SON P4/P5) - khối đầu tab "Xuất đan" của kho Sơn, chỉ khi BE bật
 * PALLET_SON_ENABLED. Thủ kho Sơn chọn điểm đan, quét tem (camera) hoặc gõ mã pallet Sơn xong -> phiếu tự điền lệnh / mảnh / số
 * (cùng SKU + mảnh gộp 1 dòng), số mặc định = số trên pallet, chỉ sửa GIẢM (khi đã rút mảnh lỗi). Chặn xuất đan cũ (định mức, số
 * Sơn đạt KCS − đã xuất, tồn mảnh thật) BE vẫn kiểm. Xác nhận phiếu ở tab "Phiếu xuất" -> pallet về Trống; huỷ phiếu -> Sơn xong.
 */
import { useState } from 'react'
import { Printer, ScanLine, X } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeWeavingPoint } from '../../../services/weaving-points-api'
import { createIssueSlip, type IssueSlip } from '../../../services/issue-slips-api'
import { lookupPallet } from '../../../services/pallets-api'
import { errMsg } from '../../../utils/errors'
import QrScanner from '../Floor/scan/QrScanner'
import type { FloorQr } from '../Floor/scan/qrScan'
import { printIssueSlip } from './printIssueSlip'
import {
  addPalletToLines, buildWeavingLines, palletQueryOf, palletWeavingError, qtyDigits, removePalletFromLines, setLineQty,
  type PalletWeavingLine,
} from './palletModel'

const ACCENT = 'var(--fg-4527a0)'
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const th: React.CSSProperties = { padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, verticalAlign: 'middle' }
const input: React.CSSProperties = {
  padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)',
}
const btn = (primary: boolean, disabled = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
  border: primary ? 'none' : '1px solid var(--border)', whiteSpace: 'nowrap',
  background: disabled ? 'var(--surface2)' : primary ? 'var(--bg-d97706)' : 'var(--surface)',
  color: disabled ? 'var(--text3)' : primary ? '#fff' : 'var(--text2)', cursor: disabled ? 'not-allowed' : 'pointer',
})
const ACCEPT_PALLET: readonly FloorQr['kind'][] = ['pallet']

export default function PalletWeavingPanel() {
  const { data: pointsData } = useFetch<BeWeavingPoint[]>(() => api.getWeavingPoints(), [])
  const points = (pointsData ?? []).filter(p => p.isActive !== false)
  const [pointId, setPointId] = useState('')
  const [code, setCode] = useState('')
  const [lines, setLines] = useState<PalletWeavingLine[]>([])
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [created, setCreated] = useState<IssueSlip | null>(null)

  const addByQuery = async (text: string) => {
    const q = palletQueryOf(text)
    if (!q) return
    setMsg(null)
    try {
      const p = await lookupPallet(q)
      const why = palletWeavingError(p, lines)
      if (why) { setMsg({ ok: false, text: why }); return }
      setLines(prev => addPalletToLines(prev, p))
      setCode('')
      setMsg({ ok: true, text: `Đã thêm pallet ${p.code}: ${p.load?.paintedQty ?? 0} mảnh ${p.load?.pieceName ?? ''} (${p.load?.sku ?? ''})` })
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e, 'Không tìm thấy pallet') })
    }
  }

  const onScanned = (qr: FloorQr) => {
    setScanning(false)
    if (qr.kind === 'pallet') void addByQuery(qr.pallet)
  }
  const closeScanner = () => setScanning(false)

  const total = lines.reduce((s, l) => s + l.qty, 0)
  const canCreate = !busy && !!pointId && lines.length > 0
  const submit = async () => {
    if (!canCreate) return
    setBusy(true); setMsg(null)
    try {
      const slip = await createIssueSlip({ weavingPointId: pointId, lines: buildWeavingLines(lines) })
      setCreated(slip); setLines([])
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e, 'Không lập được phiếu xuất đan') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...card, marginBottom: 18 }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14, color: ACCENT }}>Xuất đan theo pallet</b>
        <select value={pointId} onChange={e => setPointId(e.target.value)} aria-label="Điểm đan nhận (pallet)" style={{ ...input, minWidth: 190 }}>
          <option value="">Chọn điểm đan…</option>
          {points.map(w => <option key={w.id} value={String(w.id)}>{w.fullName ?? w.code}</option>)}
        </select>
        <form onSubmit={e => { e.preventDefault(); void addByQuery(code) }} style={{ display: 'inline-flex', gap: 6 }}>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="Mã pallet (PL-001) hoặc quét" aria-label="Mã pallet"
            style={{ ...input, width: 190 }} />
          <button type="submit" disabled={!code.trim()} style={btn(false, !code.trim())}>Thêm</button>
        </form>
        <button type="button" onClick={() => setScanning(true)} style={btn(false)}><ScanLine size={15} /> Quét tem pallet</button>
      </div>
      <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text3)' }}>
        Chỉ pallet <b>Sơn xong</b>. Số mặc định = số trên pallet, chỉ sửa giảm (đã rút mảnh lỗi ra). Xác nhận phiếu ở tab “Phiếu xuất” thì pallet tự về Trống.
      </div>
      {created && (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '0 14px 10px', padding: '9px 12px', borderRadius: 10, background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', fontSize: 13 }}>
          <span>Đã lập phiếu <b style={{ fontFamily: 'monospace' }}>{created.code}</b> cho {created.weavingPointName}. In phiếu → điểm đan ký → tải ảnh ở tab <b>Phiếu xuất</b> rồi xác nhận.</span>
          <button type="button" onClick={() => printIssueSlip(created)} style={btn(false)}><Printer size={13} /> In phiếu</button>
        </div>
      )}
      {msg && (
        <div role={msg.ok ? 'status' : 'alert'} style={{ margin: '0 14px 10px', fontSize: 12.5, color: msg.ok ? 'var(--fg-16a34a)' : 'var(--fg-dc2626)' }}>{msg.text}</div>
      )}
      {lines.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}>Lệnh</th><th style={th}>SKU</th><th style={th}>Mảnh</th><th style={th}>Pallet</th>
                  <th style={{ ...th, textAlign: 'right' }}>Số xuất</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.key} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{l.lenhCode}</td>
                    <td style={td}>{l.sku}</td>
                    <td style={td}><b>{l.pieceName}</b></td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                        {l.pallets.map(p => (
                          <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 4px 2px 8px', borderRadius: 999, background: 'var(--surface2)', fontSize: 12 }}>
                            <span style={{ fontFamily: 'monospace' }}>{p.code}</span> · {p.qty}
                            <button type="button" onClick={() => setLines(prev => removePalletFromLines(prev, p.id))} aria-label={`Bỏ pallet ${p.code}`}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)', display: 'inline-flex' }}><X size={12} /></button>
                          </span>
                        ))}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <input value={String(l.qty)} onChange={e => setLines(prev => setLineQty(prev, l.key, qtyDigits(e.target.value)))} inputMode="numeric"
                        aria-label={`Số xuất ${l.pieceName}`} style={{ ...input, width: 70, textAlign: 'right' }} />
                      <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 6 }}>/ {l.maxQty}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
            {!pointId && <span style={{ fontSize: 12, color: 'var(--fg-dc2626)' }}>Chọn điểm đan</span>}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setLines([])} style={btn(false)}>Bỏ hết</button>
            <button type="button" onClick={() => void submit()} disabled={!canCreate} style={btn(true, !canCreate)}>
              {busy ? 'Đang lập…' : `Lập phiếu xuất đan (${total} mảnh)`}
            </button>
          </div>
        </>
      )}
      {scanning && <QrScanner accept={ACCEPT_PALLET} title="Đưa tem pallet vào khung" onScanned={onScanned} onClose={closeScanner} />}
    </div>
  )
}
