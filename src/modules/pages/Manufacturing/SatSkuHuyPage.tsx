'use client'
// Huỷ lệnh đợt 2 - Q3 (nghiệp vụ 24/11/2026): sắt đã xuất cho tổ cắt mà chưa cắt của SKU đã huỷ - QLSX quyết từng trường hợp:
//  - "Cho cắt tiếp": tổ cắt báo cắt được cho SKU đã huỷ - chỉ hết phần sắt đã xuất (nghiệp vụ 26/11 câu 3), đoạn làm đủ công đoạn, qua
//    KCS rồi vào dư kho Phôi.
//  - "Ngưng": cây còn nguyên / cây lẻ trả về kho Phôi của xưởng làm lệnh; thủ kho Phôi đếm + xác nhận rồi mới vào tồn đúng chiều
//    dài (nghiệp vụ 26/11 câu 2; lệnh sau dùng cây lẻ trước).
// "Ngưng" là quyết định cuối; đang cho cắt tiếp vẫn đổi sang ngưng được.
import { useState } from 'react'
import { Scissors } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import {
  decideCutSteel,
  getCutSteel,
  type CutSteelRow,
  type SteelReturnLine,
} from '../../../services/order-cancellations-api'
import EmptyState from '../../../components/EmptyState'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import Modal from '../../../components/Modal'
import RefreshButton from '../../../components/RefreshButton'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { compactTh as th, compactTd as td, tableWrap } from '../../../styles/table'
import { errMsg } from '../../../utils/errors'

const mm = (n: number) => `${n.toLocaleString('vi-VN')} mm`
const btn: React.CSSProperties = { padding: '5px 12px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer' }

export default function SatSkuHuyPage() {
  const { data, isLoading, error, refetch } = useFetch(() => getCutSteel(), [])
  useRealtimeRefetch(['production-orders'], refetch)
  const [notice, setNotice] = useState<string | null>(null)
  const [stopTarget, setStopTarget] = useState<CutSteelRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null)

  const cont = async (r: CutSteelRow) => {
    setBusyId(r.request.id)
    setRowError(null)
    try {
      await decideCutSteel(r.request.id, { decision: 'CONTINUE' })
      setNotice(`Đã cho tổ cắt cắt tiếp SKU ${r.request.factoryCode} (lệnh ${r.request.lenhCode}). Đoạn ra vào dư kho Phôi.`)
      refetch()
    } catch (e) {
      setRowError({ id: r.request.id, msg: errMsg(e) })
    } finally {
      setBusyId(null)
    }
  }

  const rows = data ?? []
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ ...pageTitle, margin: 0 }}>Sắt của SKU đã huỷ</h2>
        <span style={{ flex: 1 }} />
        <RefreshButton onRefresh={refetch} loading={isLoading} />
      </div>
      <p style={{ ...pageSubtitle, marginTop: 0 }}>
        SKU Sếp đã duyệt huỷ mà lệnh đã xuất sắt cho tổ cắt. Chọn cho cắt tiếp (đoạn vào dư kho Phôi) hoặc ngưng và nhập trả cây
        còn lại về kho Phôi.
      </p>
      {notice && (
        <div style={{ margin: '10px 0', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', fontSize: 13 }}>{notice}</div>
      )}
      {error && !data ? (
        <LoadErrorState error={error} onRetry={refetch} />
      ) : isLoading && !data ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Scissors size={28} style={{ opacity: 0.4, marginBottom: 8 }} />} message="Không có SKU đã huỷ nào còn sắt ở tổ cắt." />
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {rows.map(r => (
            <div key={r.request.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <strong>Lệnh {r.request.lenhCode}</strong>
                <span>· SKU {r.request.factoryCode} ({r.request.quantity} cái)</span>
                {r.request.cutDecision === 'CONTINUE' && (
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'var(--bg-fef3c7)', color: 'var(--fg-a32d2d)' }}>Đang cho cắt tiếp</span>
                )}
                {r.otherSkuActive && (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Lệnh còn SKU khác đang chạy - sắt còn lại có thể vẫn cần cho SKU đó.</span>
                )}
              </div>
              <div style={tableWrap}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={th}>Sắt</th>
                      <th style={th}>Cây đã xuất (mm)</th>
                      <th style={{ ...th, textAlign: 'right' }}>Chưa xác nhận nhận</th>
                      <th style={{ ...th, textAlign: 'right' }}>Tổ cắt còn (chưa cắt)</th>
                      <th style={{ ...th, textAlign: 'right' }}>Đã nhập trả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.materials.map(m => (
                      <tr key={m.materialId}>
                        <td style={td}>{m.materialCode} <span style={{ color: 'var(--text3)' }}>{m.materialName}</span></td>
                        <td style={td}>{m.barLengthsMm.map(x => x.toLocaleString('vi-VN')).join(', ')}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{m.unreceivedBars > 0 ? `${m.unreceivedBars} cây` : '—'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{mm(m.leftoverMm)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{m.returnedMm > 0 ? mm(m.returnedMm) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rowError?.id === r.request.id && <div style={{ color: 'var(--fg-c62828)', fontSize: 12.5, marginTop: 8 }}>{rowError.msg}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {r.request.cutDecision !== 'CONTINUE' && (
                  <button disabled={busyId === r.request.id} onClick={() => void cont(r)}
                    style={{ ...btn, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>Cho cắt tiếp</button>
                )}
                <button disabled={busyId === r.request.id} onClick={() => { setRowError(null); setStopTarget(r) }}
                  style={{ ...btn, border: 'none', background: 'var(--bg-c62828)', color: '#fff', fontWeight: 600 }}>Ngưng - nhập trả cây</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {stopTarget && (
        <StopModal
          row={stopTarget}
          onClose={() => setStopTarget(null)}
          onDone={(msg) => { setStopTarget(null); setNotice(msg); refetch() }}
        />
      )}
    </div>
  )
}

type DraftLine = { materialId: string; lengthMm: string; bars: string }

function StopModal({ row, onClose, onDone }: { row: CutSteelRow; onClose: () => void; onDone: (msg: string) => void }) {
  const first = row.materials[0]
  const [lines, setLines] = useState<DraftLine[]>(
    row.materials.map(m => ({ materialId: m.materialId, lengthMm: String(m.barLengthsMm[0] ?? ''), bars: '' })),
  )
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Review IT 26/11 mục 2.7: không cây nào nhập trả thì hỏi lại 1 lần (ngưng là quyết định cuối).
  const [confirmNoReturn, setConfirmNoReturn] = useState(false)
  const set = (i: number, p: Partial<DraftLine>) => setLines(ls => ls.map((l, idx) => (idx === i ? { ...l, ...p } : l)))
  const parsed: SteelReturnLine[] = lines
    .filter(l => Number(l.bars) > 0 && Number(l.lengthMm) > 0)
    .map(l => ({ materialId: l.materialId, lengthMm: Math.round(Number(l.lengthMm)), bars: Math.round(Number(l.bars)) }))
  // Dòng điền dở (có số cây mà thiếu / sai chiều dài, hoặc số cây không phải số nguyên dương) - không bỏ im lặng.
  const incomplete = lines.filter(l => l.bars.trim() !== '' && !(Number(l.bars) > 0 && Number(l.lengthMm) > 0))
  const matName = (id: string) => row.materials.find(m => m.materialId === id)?.materialCode ?? id

  const save = async () => {
    if (incomplete.length > 0) {
      setError(`Còn ${incomplete.length} dòng điền dở (có số cây nhưng thiếu chiều dài hoặc số không hợp lệ) - sửa hoặc bấm Bỏ dòng đó.`)
      return
    }
    if (parsed.length === 0 && !confirmNoReturn) {
      setConfirmNoReturn(true)
      setError(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await decideCutSteel(row.request.id, { decision: 'STOP', returns: parsed, note: note.trim() || undefined })
      onDone(parsed.length > 0
        ? `Đã ngưng cắt SKU ${row.request.factoryCode}; ghi trả ${parsed.reduce((s, l) => s + l.bars, 0)} cây - chờ thủ kho Phôi đếm và xác nhận rồi mới vào tồn kho.`
        : `Đã ngưng cắt SKU ${row.request.factoryCode} (không có cây nhập trả).`)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} maxWidth={620}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Ngưng cắt - lệnh {row.request.lenhCode} · {row.request.factoryCode}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--text2)' }}>
        Ghi số cây tổ cắt trả về kho Phôi: cây nguyên ghi đúng chiều dài cây xuất, cây cắt dở ghi chiều dài phần còn lại (cây lẻ). Thủ kho Phôi đếm và xác nhận thì cây mới vào tồn kho.
        Để trống nếu không có cây trả. Ngưng rồi thì không cho cắt tiếp lại được.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {lines.map((l, i) => {
          const m = row.materials.find(x => x.materialId === l.materialId) ?? first
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={l.materialId} onChange={e => {
                const next = row.materials.find(x => x.materialId === e.target.value)
                set(i, { materialId: e.target.value, lengthMm: String(next?.barLengthsMm[0] ?? '') })
                setConfirmNoReturn(false)
              }} style={{ padding: 6, minWidth: 140 }}>
                {row.materials.map(x => <option key={x.materialId} value={x.materialId}>{x.materialCode}</option>)}
              </select>
              <input type="number" min={1} value={l.lengthMm} onChange={e => set(i, { lengthMm: e.target.value })} placeholder="Dài (mm)" style={{ width: 110, padding: 6 }} />
              <span style={{ fontSize: 12 }}>mm ×</span>
              <input type="number" min={0} value={l.bars} onChange={e => { set(i, { bars: e.target.value }); setConfirmNoReturn(false) }} placeholder="Số cây" style={{ width: 90, padding: 6 }} />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>cây · tổ cắt còn {mm(m?.leftoverMm ?? 0)}</span>
              {lines.length > 1 && (
                <button onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))} style={{ ...btn, border: 'none', background: 'none', color: 'var(--fg-c62828)' }}>Bỏ</button>
              )}
            </div>
          )
        })}
        <button onClick={() => setLines(ls => [...ls, { materialId: first?.materialId ?? '', lengthMm: '', bars: '' }])}
          style={{ ...btn, justifySelf: 'start', border: '1px dashed var(--border)', background: 'var(--surface)' }}>+ Thêm dòng (cây lẻ)</button>
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="Ghi chú (không bắt buộc)" style={{ padding: 6 }} />
      </div>
      {parsed.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5 }}>
          Nhập trả: {parsed.map(p => `${matName(p.materialId)} ${p.lengthMm.toLocaleString('vi-VN')} mm × ${p.bars}`).join('; ')}
        </div>
      )}
      {confirmNoReturn && parsed.length === 0 && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-fef3c7)', fontSize: 12.5 }}>
          Không có cây nào nhập trả. Sau khi ngưng, SKU này biến mất khỏi danh sách và không nhập trả bù được nữa. Bấm Ngưng cắt lần
          nữa nếu tổ cắt thật sự không còn cây nào.
        </div>
      )}
      {error && <div style={{ marginTop: 10, color: 'var(--fg-c62828)', fontSize: 12.5 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{ ...btn, border: '1px solid var(--border)', background: 'var(--surface)' }}>Hủy</button>
        <button onClick={() => void save()} disabled={busy}
          style={{ ...btn, border: 'none', background: 'var(--bg-c62828)', color: '#fff', fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Đang lưu...' : confirmNoReturn && parsed.length === 0 ? 'Ngưng cắt (không nhập trả)' : 'Ngưng cắt'}
        </button>
      </div>
    </Modal>
  )
}
