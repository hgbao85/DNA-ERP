import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { format } from 'date-fns'
import { AlertCircle, Check, X, Send, Layers, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import MfgFailReviewModal, { type FailPayload } from './MfgFailReviewModal'

const fmt = (n: number) => n.toLocaleString('vi-VN')
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

interface StagePiece {
  id: number; code: string; name: string
  target: number; passed: number; pending: number; failed: number; remaining: number
  upstreamDone: number; available: number
}
interface StagePat {
  id: number; framePieceMaterialId: number
  pieceName: string; name: string; spec?: string | null; unit: string
  target: number; passed: number; pending: number; failed: number; remaining: number
}
interface StagePending {
  id: number; piFramePieceId: number; framePieceMaterialId?: number | null
  pieceName: string; materialName?: string | null; quantity: number
  reportedBy?: { id: number; name: string }; reportedAt?: string; createdAt: string; note?: string
}
interface StageItem { quantity: number; productName: string; factoryCode: string; colorCode?: string | null }
interface StageFailed {
  id: number; pieceName: string; materialName?: string | null; quantity: number
  defectReason?: { id: number; label: string } | null; reviewNote?: string | null; defectPhotoUrl?: string | null
  reviewedBy?: { id: number; name: string } | null; reviewedAt?: string | null
}
interface StageData {
  piId: number; code: string; poNumber?: string | null; deadline: string; stageType: string
  items: StageItem[]; pieces: StagePiece[]; pats: StagePat[]
  piecePercent: number; patPercent: number; hasPat: boolean
  pendingReports: StagePending[]; failedReports: StageFailed[]
}

interface Props {
  piId: number
  stageType: 'HAN' | 'SON'
  readOnly?: boolean
}

const STAGE_LABEL: Record<string, string> = { HAN: 'Hàn', SON: 'Sơn' }
const STAGE_COLOR: Record<string, string> = { HAN: '#e65100', SON: '#6a1b9a' }

// Dòng gộp chung cho cả MẢNH và PÁT trong 1 bảng
interface Row {
  key: string
  kind: 'piece' | 'pat'
  name: string
  sub: string
  piFramePieceId: number
  framePieceMaterialId?: number
  target: number
  available: number | null // null = pát (nhảy cóc, không giới hạn theo công đoạn trước)
  passed: number
  pending: number
  remaining: number
  max: number              // trần được phép báo
}

export default function MfgStagePage({ piId, stageType, readOnly = false }: Props) {
  const { user } = useAuth()
  // Giám đốc (BOSS không mfgRole) chỉ XEM — không báo/duyệt (đồng bộ MfgRolesGuard backend).
  const canReport = !readOnly && (user?.mfgRole === stageType || user?.mfgRole === 'PRODUCTION_MANAGER')
  const canReview = !readOnly && (user?.mfgRole === 'QC' || user?.mfgRole === 'PRODUCTION_MANAGER')

  const { data, isLoading, error, refetch } = useFetch<StageData>(() => api.getStageExec(piId, stageType) as Promise<StageData>, [piId, stageType])

  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [form, setForm] = useState<{ key: string; qty: string; time: string }>({ key: '', qty: '', time: '' })
  const [failTarget, setFailTarget] = useState<StagePending | null>(null) // báo cáo đang đánh "không đạt"

  const pieces = Array.isArray(data?.pieces) ? data!.pieces : []
  const pats = Array.isArray(data?.pats) ? data!.pats : []
  const pending = Array.isArray(data?.pendingReports) ? data!.pendingReports : []
  const failed = Array.isArray(data?.failedReports) ? data!.failedReports : []
  const piItems = Array.isArray(data?.items) ? data!.items : []
  const label = STAGE_LABEL[stageType]
  const accent = STAGE_COLOR[stageType]
  const piecePct = data?.piecePercent ?? 0
  const patPct = data?.patPercent ?? 0
  const hasPat = !!data?.hasPat

  // ── Gộp MẢNH + PÁT thành 1 danh sách dòng ──
  const rows: Row[] = [
    ...pieces.map<Row>(p => ({
      key: `piece:${p.id}`, kind: 'piece', name: p.name, sub: p.code,
      piFramePieceId: p.id, target: p.target, available: p.available,
      passed: p.passed, pending: p.pending, remaining: p.remaining, max: p.available,
    })),
    ...pats.map<Row>(p => ({
      key: `pat:${p.id}:${p.framePieceMaterialId}`, kind: 'pat',
      name: p.name, sub: `mảnh ${p.pieceName}${p.spec ? ` · ${p.spec}` : ''}`,
      piFramePieceId: p.id, framePieceMaterialId: p.framePieceMaterialId,
      target: p.target, available: null,
      passed: p.passed, pending: p.pending, remaining: p.remaining,
      max: Math.max(0, p.target - p.passed - p.pending),
    })),
  ]

  const selRow = rows.find(r => r.key === form.key) ?? null
  const maxQty = selRow ? selRow.max : 0
  const overLimit = !!selRow && Number(form.qty) > maxQty

  const handleReport = async () => {
    if (!selRow || !form.qty || Number(form.qty) <= 0) { setFormErr('Chọn hạng mục và nhập số lượng > 0'); return }
    const when = form.time ? new Date(form.time) : new Date()
    const now = Date.now()
    if (when.getTime() > now + 60_000) { setFormErr('Thời gian không được ở tương lai'); return }
    if (when.getTime() < now - 24 * 60 * 60 * 1000) { setFormErr('Thời gian chỉ được trong vòng 24 giờ gần nhất'); return }
    try {
      setBusy(true); setFormErr('')
      await api.submitStageReport({
        piFramePieceId: selRow.piFramePieceId,
        ...(selRow.kind === 'pat' ? { framePieceMaterialId: selRow.framePieceMaterialId } : {}),
        stageType, quantity: Number(form.qty), reportedAt: when.toISOString(),
      })
      setForm({ key: '', qty: '', time: '' })
      refetch()
    } catch (e: any) {
      setFormErr(e?.response?.data?.error ?? 'Lỗi gửi báo cáo')
    } finally { setBusy(false) }
  }

  const handlePass = async (id: number) => {
    try { setBusy(true); await api.reviewStageReport(id, { status: 'PASSED' }); refetch() }
    catch (e: any) { setFormErr(e?.response?.data?.error ?? 'Lỗi duyệt') }
    finally { setBusy(false) }
  }

  const handleFail = async (payload: FailPayload) => {
    if (!failTarget) return
    await api.reviewStageReport(failTarget.id, payload)
    setFailTarget(null); refetch()
  }

  if (isLoading) return <div style={{ padding: 24, color: 'var(--text3)' }}>Đang tải dữ liệu {label}...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu {label}</div>

  if (rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '48px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
          <Layers size={26} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text2)', marginBottom: 4 }}>Chưa có dữ liệu {label}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 380, lineHeight: 1.5 }}>
            Sản phẩm trong lệnh này chưa được khai báo định mức mảnh để theo dõi {label}.
          </div>
        </div>
      </div>
    )
  }

  const KindBadge = ({ kind }: { kind: 'piece' | 'pat' }) => (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
      background: kind === 'pat' ? '#f3e5f5' : '#fff3e0',
      color: kind === 'pat' ? '#6a1b9a' : '#e65100',
    }}>{kind === 'pat' ? 'Pát' : 'Mảnh'}</span>
  )

  return (
    <div>
      {formErr && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: 14, fontSize: 13 }}>{formErr}</div>
      )}

      {/* Header: No PO + sản phẩm + % (tách Mảnh / Pát) */}
      <div style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {piItems.map((it, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 17 }}>{it.productName}</span>
                  {it.colorCode && <span style={{ fontSize: 13, color: 'var(--text3)' }}>{it.colorCode}</span>}
                  <span style={{ fontSize: 12, fontWeight: 700, color: accent, background: 'var(--surface2)', padding: '2px 10px', borderRadius: 20 }}>×{fmt(it.quantity)} bộ</span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text3)' }}>
              <span>PO: <strong style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>{data?.poNumber ?? '—'}</strong></span>
              <span>Lệnh SX: <strong style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>{data?.code}</strong></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mảnh</span>
              <span style={{ fontWeight: 800, fontSize: 30, lineHeight: 1, color: piecePct >= 100 ? '#2e7d32' : accent }}>{piecePct}%</span>
            </div>
            {hasPat && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pát</span>
                <span style={{ fontWeight: 800, fontSize: 30, lineHeight: 1, color: patPct >= 100 ? '#2e7d32' : accent }}>{patPct}%</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${piecePct}%`, background: piecePct >= 100 ? '#2e7d32' : accent, transition: 'width .3s' }} />
        </div>
      </div>

      {/* ── 1 BẢNG GỘP: Mảnh + Pát ── */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: accent }}>Tiến độ {label}</span>
          {hasPat && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Pát cho làm trước, không chờ công đoạn trước</span>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>
              <th style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600 }}>Hạng mục</th>
              <th style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 600 }}>Cần làm</th>
              <th style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 600 }}>Sẵn để làm</th>
              <th style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 600 }}>Đạt</th>
              <th style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 600 }}>⏳ Chờ</th>
              <th style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 600 }}>Còn lại</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <KindBadge kind={r.kind} />
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r.sub}</span>
                  </div>
                </td>
                <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text3)' }}>{fmt(r.target)}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: r.available == null ? 'var(--text3)' : r.available > 0 ? '#1565c0' : 'var(--text3)' }}>
                  {r.available == null ? '—' : fmt(r.available)}
                </td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: r.passed > 0 ? '#2e7d32' : 'var(--text3)' }}>{fmt(r.passed)}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', color: r.pending > 0 ? '#e65100' : 'var(--text3)' }}>{fmt(r.pending)}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: r.remaining > 0 ? '#e65100' : '#2e7d32' }}>{r.remaining > 0 ? fmt(r.remaining) : '✓ đủ'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 1 FORM báo sản lượng (chọn mảnh hoặc pát trong cùng dropdown) */}
      {canReport && (
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>Báo sản lượng {label}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 220 }}>
              <span style={lblText}>Hạng mục</span>
              <select value={form.key}
                onChange={e => {
                  const key = e.target.value
                  const r = rows.find(x => x.key === key)
                  setForm(f => ({ ...f, key, qty: r ? String(r.max) : '', time: key ? toLocalInput(new Date()) : '' }))
                }}
                style={inputS}>
                <option value="">— chọn —</option>
                <optgroup label="Mảnh">
                  {pieces.map(p => <option key={`piece:${p.id}`} value={`piece:${p.id}`}>{p.name} ({p.code})</option>)}
                </optgroup>
                {hasPat && (
                  <optgroup label="Pát">
                    {pats.map(p => <option key={`pat:${p.id}:${p.framePieceMaterialId}`} value={`pat:${p.id}:${p.framePieceMaterialId}`}>{p.name}{p.spec ? ` (${p.spec})` : ''} — mảnh {p.pieceName}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={lblText}>Số lượng{selRow ? ` (tối đa ${fmt(maxQty)})` : ''}</span>
              <input type="number" value={form.qty} min={0} max={maxQty || undefined}
                onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                placeholder="0" style={{ ...inputS, width: 130, borderColor: overLimit ? '#c62828' : 'var(--border)' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={lblText}>Thời gian (trong 24h)</span>
              <input type="datetime-local" value={form.time}
                min={toLocalInput(new Date(Date.now() - 24 * 60 * 60 * 1000))} max={toLocalInput(new Date())}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                style={{ ...inputS, width: 200 }} />
            </label>
            <button onClick={handleReport} disabled={busy || overLimit || !selRow}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: accent, opacity: (busy || overLimit || !selRow) ? 0.5 : 1 }}>
              <Send size={13} /> {busy ? 'Đang gửi...' : 'Gửi → chờ KCS'}
            </button>
          </div>
          {overLimit && <div style={{ fontSize: 12, color: '#c62828', marginTop: 6 }}>Không được nhập quá số lượng (còn {fmt(maxQty)})</div>}
        </div>
      )}

      {/* KCS duyệt (gộp mảnh + pát) */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>
          Chờ KCS duyệt {pending.length > 0 && <span style={{ color: '#e65100' }}>({pending.length})</span>}
        </div>
        {pending.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có báo cáo nào đang chờ</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '8px 12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {r.materialName
                      ? <>Pát {r.materialName} <span style={{ fontSize: 11, color: 'var(--text3)' }}>(mảnh {r.pieceName})</span> · <span style={{ color: accent }}>{fmt(r.quantity)} cái</span></>
                      : <>Mảnh {r.pieceName} · <span style={{ color: accent }}>{fmt(r.quantity)} mảnh</span></>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {r.reportedBy?.name ?? '—'} · lúc {format(new Date(r.reportedAt ?? r.createdAt), 'dd/MM HH:mm')}
                  </div>
                </div>
                {canReview ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handlePass(r.id)} disabled={busy} style={btnPass}><Check size={13} /> Đạt</button>
                    <button onClick={() => setFailTarget(r)} disabled={busy} style={btnFail}><X size={13} /> Không đạt</button>
                  </div>
                ) : <span style={{ fontSize: 11, color: 'var(--text3)' }}>Chờ duyệt…</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── KHÔNG ĐẠT: nguyên nhân (quản lý + thợ xem để cải thiện) ── */}
      {failed.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#c62828', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> Không đạt ({failed.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {failed.map(f => (
              <div key={f.id} style={{ display: 'flex', gap: 10, background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: 'var(--radius)', padding: '8px 12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {f.materialName ? <>Pát {f.materialName} <span style={{ fontSize: 11, color: 'var(--text3)' }}>(mảnh {f.pieceName})</span></> : <>Mảnh {f.pieceName}</>}
                    {' · '}<span style={{ color: '#c62828' }}>{fmt(f.quantity)} không đạt</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    <strong style={{ color: '#c62828' }}>{f.defectReason?.label ?? 'Không rõ'}</strong>
                    {f.reviewNote && <span style={{ color: 'var(--text3)' }}> — {f.reviewNote}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    KCS: {f.reviewedBy?.name ?? '—'}{f.reviewedAt ? ` · ${format(new Date(f.reviewedAt), 'dd/MM HH:mm')}` : ''}
                  </div>
                </div>
                {f.defectPhotoUrl && (
                  <a href={f.defectPhotoUrl} target="_blank" rel="noreferrer" title="Xem ảnh lỗi">
                    <img src={f.defectPhotoUrl} alt="lỗi" style={{ height: 44, width: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #ffcdd2' }} />
                  </a>
                )}
                {!f.defectPhotoUrl && <ImageIcon size={18} color="var(--text3)" style={{ opacity: 0.4 }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {failTarget && (
        <MfgFailReviewModal
          stageType={stageType}
          title={`Không đạt — ${label}`}
          onClose={() => setFailTarget(null)}
          onSubmit={handleFail}
        />
      )}
    </div>
  )
}

const lblText: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', fontWeight: 600 }
const inputS: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', fontSize: 13 }
const btnPass: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius)', color: '#2e7d32', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const btnFail: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 'var(--radius)', color: '#c62828', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
