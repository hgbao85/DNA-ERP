// Phần A – Đợt 9 (YC2): hộp xem trước khi tải lên Excel kế hoạch. BE đọc file + so với giá trị lúc xuất (không ghi gì);
// KHSX xem bảng cũ → mới, dòng lỗi (đỏ) bị bỏ qua, bấm Xác nhận mới ghi (dòng chưa duyệt ghi thẳng, dòng đã duyệt gửi Sếp duyệt lại).
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { errMsg } from '../../../utils/errors'
import {
  commitDeadlinePlan,
  previewDeadlinePlan,
  type DeadlineImportPreview,
  type DeadlineSaveResult,
} from '../../../services/deadline-changes-api'
import { ENTRY_KIND_LABEL, ENTRY_KIND_TONE, TONE_STYLE, fmtDayShort, summarizeSave, type SaveSummary } from './deadlineChange'

const cellHead: React.CSSProperties = { fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.4px', textAlign:'left', padding:'8px 10px', background:'var(--surface2)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }
const cell: React.CSSProperties = { fontSize:12.5, padding:'8px 10px', borderBottom:'1px solid var(--border)', verticalAlign:'top', color:'var(--text)' }

function Count({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONE_STYLE }) {
  const t = TONE_STYLE[tone]
  return (
    <div style={{ flex:'1 1 110px', background:t.background, borderRadius:8, padding:'8px 12px', minWidth:0 }}>
      <div style={{ fontSize:20, fontWeight:800, color:t.color, lineHeight:1.2, fontVariantNumeric:'tabular-nums' }}>{value}</div>
      <div style={{ fontSize:11.5, color:t.color, fontWeight:600 }}>{label}</div>
    </div>
  )
}

export default function DeadlinePlanImportModal({ file, onClose, onCommitted }: {
  file: File
  onClose: () => void
  /** Gọi ngay sau khi Xác nhận ghi xong: nơi gọi tải lại danh sách + hiện thông báo. */
  onCommitted: (summary: SaveSummary, result: DeadlineSaveResult) => void
}) {
  const isMobile = useIsMobile()
  const [preview, setPreview] = useState<DeadlineImportPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [committing, setCommitting] = useState(false)
  const [done, setDone] = useState<SaveSummary | null>(null)
  const [commitError, setCommitError] = useState('')

  useEffect(() => {
    let alive = true
    previewDeadlinePlan(file)
      .then((p) => { if (alive) { setPreview(p); setError('') } })
      .catch((e) => { if (alive) setError(errMsg(e, 'Không đọc được file Excel')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [file])

  const rows = preview && Array.isArray(preview.rows) ? preview.rows : []
  const counts = preview?.counts ?? { apply: 0, needsApproval: 0, noChange: 0, error: 0 }
  const writable = counts.apply + counts.needsApproval

  const confirm = async () => {
    if (!preview || committing || writable === 0) return
    setCommitting(true)
    setCommitError('')
    try {
      const res = await commitDeadlinePlan(preview.commitPayload)
      // Dòng lỗi lúc xem trước không nằm trong commitPayload (không vào `skipped`) -> nói thêm cho đủ "bỏ K".
      const base = summarizeSave(res)
      const summary = counts.error > 0 ? { ...base, message: `${base.message} ${counts.error} dòng lỗi ở bản xem trước đã bỏ qua.` } : base
      setDone(summary)
      onCommitted(summary, res)
    } catch (e) {
      setCommitError(errMsg(e, 'Lỗi ghi kế hoạch từ Excel'))
    } finally {
      setCommitting(false)
    }
  }

  const close = () => { if (!committing) onClose() }

  return (
    <div onClick={close}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Xem trước Excel kế hoạch"
        style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding: isMobile ? 16 : 24, width:980, maxWidth:'100%', maxHeight:'90dvh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:12, flexShrink:0 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', minWidth:0 }}>
            <FileSpreadsheet size={16} color="var(--fg-1976d2)"/> Xem trước Excel kế hoạch
          </h3>
          <button onClick={close} disabled={committing} aria-label="Đóng" style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
            <X size={18} color="var(--text3)"/>
          </button>
        </div>

        <div style={{ fontSize:12.5, color:'var(--text2)', marginBottom:12, flexShrink:0, overflowWrap:'anywhere' }}>
          File: <b>{preview?.fileName ?? file.name}</b>
          {preview && <> · đọc được <b>{preview.totalRows}</b> dòng</>}
        </div>

        <div style={{ flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <Loader2 size={16} className="spin"/> Đang đọc file...
            </div>
          ) : error ? (
            <div role="alert" style={{ padding:'10px 14px', background:'var(--bg-fef2f2)', border:'1px solid var(--fg-fca5a5)', borderRadius:6, fontSize:13, color:'var(--fg-b91c1c)', display:'flex', gap:8, alignItems:'flex-start' }}>
              <AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }}/> <span style={{ overflowWrap:'anywhere' }}>{error}</span>
            </div>
          ) : preview && (
            <>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Count label="Ghi ngay" value={counts.apply} tone="green"/>
                <Count label="Chờ Sếp duyệt lại" value={counts.needsApproval} tone="yellow"/>
                <Count label="Lỗi" value={counts.error} tone="red"/>
                <Count label="Không đổi" value={counts.noChange} tone="gray"/>
              </div>

              {counts.error > 0 && (
                <div style={{ fontSize:12.5, color:'var(--fg-b91c1c)' }}>Dòng lỗi sẽ bị bỏ qua — các dòng còn lại vẫn xác nhận được.</div>
              )}

              {rows.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', color:'var(--text3)', fontSize:13, border:'1px dashed var(--border)', borderRadius:8 }}>
                  File không có dòng nào đổi mốc.
                </div>
              ) : (
                <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
                  <table style={{ width:'100%', minWidth:760, borderCollapse:'collapse' }}>
                    <thead>
                      <tr>
                        <th style={cellHead}>Dòng Excel</th>
                        <th style={cellHead}>Lệnh</th>
                        <th style={cellHead}>SKU</th>
                        <th style={cellHead}>Loại</th>
                        <th style={cellHead}>Mốc cũ → mới</th>
                        <th style={cellHead}>Lỗi / Cảnh báo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const tone = TONE_STYLE[ENTRY_KIND_TONE[r.kind] ?? 'gray']
                        const isError = r.kind === 'ERROR'
                        return (
                          <tr key={`${r.rowNumber}-${r.itemId}`} style={{ background: isError ? 'var(--bg-fef2f2)' : undefined }}>
                            <td style={{ ...cell, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{r.rowNumber}</td>
                            <td style={{ ...cell, fontFamily:'monospace', fontWeight:700, whiteSpace:'nowrap' }}>{r.lenhCode || '—'}</td>
                            <td style={{ ...cell, fontFamily:'monospace', whiteSpace:'nowrap' }}>{r.skuCode || '—'}</td>
                            <td style={cell}>
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:10, color:tone.color, background:tone.background, whiteSpace:'nowrap' }}>
                                {ENTRY_KIND_LABEL[r.kind] ?? r.kind}
                              </span>
                            </td>
                            <td style={cell}>
                              {r.changes.length === 0 ? <span style={{ color:'var(--text3)' }}>—</span> : r.changes.map((c) => (
                                <div key={c.key} style={{ whiteSpace:'nowrap' }}>
                                  <span style={{ color:'var(--text3)' }}>{c.label}: </span>
                                  {fmtDayShort(c.from)} → <b>{fmtDayShort(c.to)}</b>
                                </div>
                              ))}
                            </td>
                            <td style={{ ...cell, minWidth:180, overflowWrap:'anywhere' }}>
                              {r.errors.map((m, i) => <div key={`e${i}`} style={{ color:'var(--fg-b91c1c)', fontWeight:600 }}>{m}</div>)}
                              {r.warnings.map((m, i) => <div key={`w${i}`} style={{ color:'var(--fg-b45309)' }}>{m}</div>)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {done && (
            <div role="status" style={{ padding:'10px 14px', background:'var(--bg-dcfce7)', borderRadius:6, fontSize:13, color:'var(--fg-2e7d32)', display:'flex', gap:8, alignItems:'flex-start' }}>
              <CheckCircle2 size={16} style={{ flexShrink:0, marginTop:1 }}/>
              <div style={{ overflowWrap:'anywhere' }}>
                <b>{done.message}</b>
                {done.warnings.length > 0 && (
                  <div style={{ marginTop:4, color:'var(--fg-b45309)' }}>{done.warnings.map((w) => <div key={w}>{w}</div>)}</div>
                )}
              </div>
            </div>
          )}
          {commitError && (
            <div role="alert" style={{ padding:'8px 12px', background:'var(--bg-fef2f2)', border:'1px solid var(--fg-fca5a5)', borderRadius:6, fontSize:12.5, color:'var(--fg-b91c1c)', overflowWrap:'anywhere' }}>
              {commitError}
            </div>
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:14, flexShrink:0, flexWrap:'wrap' }}>
          <button onClick={close} disabled={committing}
            style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor: committing ? 'not-allowed' : 'pointer', color:'var(--text2)' }}>
            {done ? 'Đóng' : 'Huỷ'}
          </button>
          {!done && (
            <button onClick={confirm} disabled={committing || loading || !!error || writable === 0}
              title={writable === 0 && !loading && !error ? 'Không có dòng nào ghi được' : undefined}
              style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', background:'var(--bg-1976d2)', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, color:'#fff',
                cursor: (committing || loading || error || writable === 0) ? 'not-allowed' : 'pointer', opacity: (committing || loading || error || writable === 0) ? 0.5 : 1 }}>
              {committing ? <><Loader2 size={13} className="spin"/> Đang ghi...</> : `Xác nhận${writable > 0 ? ` (${writable} SKU)` : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
