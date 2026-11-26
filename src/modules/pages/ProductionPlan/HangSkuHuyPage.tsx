'use client'
// Huỷ lệnh đợt 2 - Q5 / Q6 (anh Nhân 24/11/2026): KHSX chuyển hàng đã làm của SKU đã huỷ sang 1 dòng SKU đang chạy.
//  - Q5 hàng đã đóng gói: được giao cho đơn khách khác, điều kiện cùng sản phẩm + màu dây + vải nệm. Dòng nhận coi như đã đóng gói
//    thêm số đó (booking giao được).
//  - Q6 khung đã đan (anh Nhân trả lời lại 26/11/2026, câu 1b/2a/3a): KHÔNG chuyển tay nữa - khung đã nhận về (kể cả phần điểm đan
//    trả sau khi huỷ) thành tồn khung đan ở kho thành phẩm của lệnh bị huỷ, theo mảnh + màu dây; lệnh đang chạy cần đúng loại tự lấy
//    tồn trước, chỉ xuất đan phần còn thiếu. Ở đây chỉ hiện để biết.
import { useState } from 'react'
import { PackageOpen } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import {
  getCancelledGoods,
  transferCancelledGoods,
  type CancelledGoodsRow,
  type CancelledGoodsKind,
} from '../../../services/order-cancellations-api'
import EmptyState from '../../../components/EmptyState'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import Modal from '../../../components/Modal'
import RefreshButton from '../../../components/RefreshButton'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { compactTh as th, compactTd as td, tableWrap } from '../../../styles/table'
import { errMsg } from '../../../utils/errors'
import { fmtDateTimeVN } from '../Boss/duyetDoiMoc'

const btn: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)' }

type Target = { row: CancelledGoodsRow; kind: CancelledGoodsKind; available: number; label: string }

export default function HangSkuHuyPage() {
  const { data, isLoading, error, refetch } = useFetch(() => getCancelledGoods(), [])
  useRealtimeRefetch(['production-orders'], refetch)
  const [target, setTarget] = useState<Target | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const rows = data ?? []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ ...pageTitle, margin: 0 }}>Hàng của SKU đã huỷ</h2>
        <span style={{ flex: 1 }} />
        <RefreshButton onRefresh={refetch} loading={isLoading} />
      </div>
      <p style={{ ...pageSubtitle, marginTop: 0 }}>
        Hàng đã đóng gói chuyển sang dòng SKU khác cùng sản phẩm, màu dây và vải nệm. Khung đã đan nằm ở tồn khung đan kho thành phẩm
        (theo mảnh + màu dây), lệnh sau cần đúng loại tự lấy trước - không cần chuyển tay.
      </p>
      {notice && <div style={{ margin: '10px 0', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', fontSize: 13 }}>{notice}</div>}
      {error && !data ? (
        <LoadErrorState error={error} onRetry={refetch} />
      ) : isLoading && !data ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState icon={<PackageOpen size={28} style={{ opacity: 0.4, marginBottom: 8 }} />} message="Không có SKU đã huỷ nào còn hàng đã đóng gói hoặc khung đã đan." />
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {rows.map(r => (
            <div key={r.requestId} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong>Lệnh {r.lenhCode}</strong>
                <span>· SKU {r.factoryCode}</span>
                {r.wireName && <span style={{ fontSize: 12, color: 'var(--text2)' }}>· Dây {r.wireName}</span>}
                {r.cushionName && <span style={{ fontSize: 12, color: 'var(--text2)' }}>· Nệm {r.cushionName}</span>}
              </div>
              <div style={tableWrap}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={th}>Hàng</th>
                      <th style={{ ...th, textAlign: 'right' }}>Còn</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.packedAvailable > 0 && (
                      <tr>
                        <td style={td}>Đã đóng gói</td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.packedAvailable} bộ</td>
                        <td style={td}><button style={btn} onClick={() => setTarget({ row: r, kind: 'PACKED', available: r.packedAvailable, label: 'hàng đã đóng gói' })}>Chuyển</button></td>
                      </tr>
                    )}
                    {r.woven.map(w => (
                      <tr key={w.pieceId}>
                        <td style={td}>Khung đã đan · {w.pieceCode} {w.pieceName}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{w.available}</td>
                        <td style={{ ...td, fontSize: 12, color: 'var(--text2)' }}>Tồn ở {r.warehouseName} - lệnh sau cùng mảnh + màu dây tự lấy</td>
                      </tr>
                    ))}
                    {r.packedAvailable === 0 && r.woven.length === 0 && (
                      <tr><td style={td} colSpan={3}>Đã chuyển hết.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {r.transfers.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>
                  Đã chuyển / đã lấy tồn: {r.transfers.map(t => `${t.qty} ${t.kind === 'PACKED' ? 'bộ' : `khung ${t.pieceName ?? ''}`} → lệnh ${t.targetLenhCode} (${fmtDateTimeVN(t.createdAt)})`).join('; ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {target && (
        <TransferModal
          t={target}
          onClose={() => setTarget(null)}
          onDone={(msg) => { setTarget(null); setNotice(msg); refetch() }}
        />
      )}
    </div>
  )
}

function TransferModal({ t, onClose, onDone }: { t: Target; onClose: () => void; onDone: (msg: string) => void }) {
  const eligible = t.row.targets.filter(x => x.sameWire && x.sameCushion)
  const [targetId, setTargetId] = useState(eligible[0]?.itemId ?? '')
  const [qty, setQty] = useState(String(t.available))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const n = Math.round(Number(qty))
  const ok = !!targetId && n > 0 && n <= t.available

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await transferCancelledGoods(t.row.requestId, { kind: t.kind, targetItemId: targetId, qty: n, note: note.trim() || undefined })
      const dest = eligible.find(x => x.itemId === targetId)
      onDone(`Đã chuyển ${n} ${t.kind === 'PACKED' ? 'bộ' : 'khung'} ${t.label} sang lệnh ${dest?.lenhCode ?? ''}.`)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} maxWidth={640}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Chuyển {t.label} - lệnh {t.row.lenhCode} · {t.row.factoryCode}</h3>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--text2)' }}>
        Còn chuyển được {t.available}. Chỉ hiện dòng SKU đang chạy cùng sản phẩm, cùng màu dây và vải nệm.
      </p>
      {eligible.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Không có dòng SKU nào đủ điều kiện nhận.</div>
      ) : (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}></th>
                <th style={th}>Lệnh</th>
                <th style={th}>Đơn / khách</th>
                <th style={{ ...th, textAlign: 'right' }}>SL</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã đóng gói</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map(x => (
                <tr key={x.itemId} onClick={() => setTargetId(x.itemId)} style={{ cursor: 'pointer' }}>
                  <td style={td}><input type="radio" checked={targetId === x.itemId} onChange={() => setTargetId(x.itemId)} /></td>
                  <td style={td}>{x.lenhCode}</td>
                  <td style={td}>{x.orderCode ?? '—'}{x.customerName ? ` · ${x.customerName}` : ''}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{x.quantity}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{x.packedQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12.5 }}>Số lượng</label>
        <input type="number" min={1} max={t.available} value={qty} onChange={e => setQty(e.target.value)} style={{ width: 100, padding: 6 }} />
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="Ghi chú (không bắt buộc)" style={{ flex: 1, minWidth: 180, padding: 6 }} />
      </div>
      {error && <div style={{ marginTop: 10, color: 'var(--fg-c62828)', fontSize: 12.5 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={btn}>Hủy</button>
        <button className="primary" onClick={() => void save()} disabled={busy || !ok} style={!ok || busy ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
          {busy ? 'Đang chuyển...' : 'Chuyển'}
        </button>
      </div>
    </Modal>
  )
}
