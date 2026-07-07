'use client'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import { safeArr } from '../../../utils/array'
import { errMsg } from '../../../utils/errors'
import { listTh as thStyle, listTd as tdStyle, emptyBox } from '../../../styles/table'
import ProgressBar from '../../../components/ProgressBar'
import type { ManhOrder } from '../../../types/manh'

interface WeavingPoint { id: number; name: string; fullName?: string }

const sumXuat = (line: { allocations: { xuatQty: number }[] }) => line.allocations.reduce((s, a) => s + a.xuatQty, 0)

/**
 * Xuất đan = xuất mảnh chưa đan (của 1 PO, tại kho vật tư thành phẩm) cho điểm đan gia công bên
 * ngoài — bắt buộc chọn điểm đan vì 1 loại mảnh có thể xuất cho nhiều điểm đan khác nhau. Số lượng
 * xuất không được vượt quá tồn thực hiện có. Đồng bộ trực tiếp với "Theo dõi nhập đan" ở kho thành
 * phẩm — cùng đọc/ghi ManhAllocation qua manh.service.ts, không phải 2 danh sách độc lập.
 */
export default function KhoXuatDanPage() {
  const { data: orders, refetch } = useFetch<ManhOrder[]>(() => (api as any).getManhOrders(), [])
  const { data: weavingPoints } = useFetch<WeavingPoint[]>(() => (api as any).getWeavingPoints(), [])
  const pointLabel = (id: number) => {
    const p = safeArr(weavingPoints).find(w => w.id === id)
    return p?.fullName ?? p?.name ?? `#${id}`
  }

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = safeArr(orders).find(o => o.id === selectedId) ?? null

  const [qty, setQty] = useState<Record<number, string>>({})
  const [pointId, setPointId] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [msgs, setMsgs] = useState<Record<number, string>>({})
  const { ask, confirmModal } = useConfirm()

  const handleXuat = (lineId: number, max: number) => {
    const q = Number(qty[lineId])
    const pid = pointId[lineId] ? Number(pointId[lineId]) : null
    if (!q || q <= 0 || q > max) { setMsgs(p => ({ ...p, [lineId]: 'Số lượng không hợp lệ (không được vượt quá tồn thực)' })); return }
    if (!pid) { setMsgs(p => ({ ...p, [lineId]: 'Chọn điểm đan' })); return }
    ask(
      { message: `Xuất đan ${q} mảnh này cho ${pointLabel(pid)}? Số lượng sẽ được trừ khỏi tồn thực ngay.` },
      async () => {
        setBusy(lineId)
        setMsgs(p => ({ ...p, [lineId]: '' }))
        try {
          await (api as any).xuatManh(lineId, pid, q)
          setQty(p => ({ ...p, [lineId]: '' }))
          refetch()
        } catch (e) {
          setMsgs(p => ({ ...p, [lineId]: errMsg(e, 'Không thể xuất đan') }))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selected) {
    const total  = selected.lines.reduce((s, l) => s + l.totalQty, 0)
    const daXuat = selected.lines.reduce((s, l) => s + sumXuat(l), 0)
    const tonThuc = selected.lines.reduce((s, l) => s + l.tonThuc, 0)
    const allocRows = selected.lines.flatMap(l => l.allocations.map(a => ({ line: l, alloc: a })))

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
          >
            <ChevronLeft size={15} /> Quay lại
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {selected.skuCode}
              <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>— {selected.skuName}</span>
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
              PI: {selected.piCode} · PO: {selected.poCode}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{total}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Tổng</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{tonThuc}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Tồn thực</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>{daXuat}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Đã xuất</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 80 }} /><col style={{ width: 280 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>Tên mảnh</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SL</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Tồn thực</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                <th style={thStyle}>Xuất đan</th>
              </tr>
            </thead>
            <tbody>
              {selected.lines.map(line => {
                const xuat = sumXuat(line)
                const noStock = line.tonThuc <= 0
                return (
                  <tr key={line.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{line.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{line.totalQty}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: line.tonThuc > 0 ? '#2563eb' : 'var(--text3)' }}>{line.tonThuc}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: xuat > 0 ? '#d97706' : 'var(--text3)' }}>{xuat}</td>
                    <td style={tdStyle}>
                      {noStock ? (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Hết tồn thực</span>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <select
                              value={pointId[line.id] ?? ''}
                              onChange={e => setPointId(p => ({ ...p, [line.id]: e.target.value }))}
                              style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', maxWidth: 120 }}
                            >
                              <option value="">— điểm đan —</option>
                              {safeArr(weavingPoints).map(w => <option key={w.id} value={w.id}>{w.fullName ?? w.name}</option>)}
                            </select>
                            <input
                              type="number" min={1} max={line.tonThuc}
                              value={qty[line.id] ?? ''}
                              onChange={e => setQty(p => ({ ...p, [line.id]: e.target.value }))}
                              placeholder="SL"
                              style={{ width: 56, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                            />
                            <button
                              onClick={() => handleXuat(line.id, line.tonThuc)}
                              disabled={busy === line.id}
                              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#d97706', color: '#fff', cursor: busy === line.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                            >
                              {busy === line.id ? '...' : 'Xuất'}
                            </button>
                          </div>
                          {msgs[line.id] && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{msgs[line.id]}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Chi tiết theo điểm đan</h3>
        {allocRows.length === 0 ? (
          <div style={emptyBox}>Chưa xuất đan cho điểm đan nào</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col /><col /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 150 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={thStyle}>Tên mảnh</th>
                  <th style={thStyle}>Điểm đan</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Đã nhập</th>
                  <th style={thStyle}>Tiến độ nhận</th>
                </tr>
              </thead>
              <tbody>
                {allocRows.map(({ line, alloc }) => (
                  <tr key={alloc.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{line.name}</td>
                    <td style={tdStyle}>{pointLabel(alloc.weavingPointId)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{alloc.xuatQty}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: alloc.nhapQty > 0 ? '#16a34a' : 'var(--text3)' }}>{alloc.nhapQty}</td>
                    <td style={tdStyle}><ProgressBar value={alloc.nhapQty} max={alloc.xuatQty} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {confirmModal}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Theo dõi xuất đan</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Xuất mảnh chưa đan cho các điểm đan gia công bên ngoài, theo từng PO
        </p>
      </div>

      {safeArr(orders).length === 0 ? (
        <div style={emptyBox}>Không có PO nào</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 130 }} /><col style={{ width: 130 }} /><col /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PI</th>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>SKU</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SL</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                <th style={thStyle}>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {safeArr(orders).map(order => {
                const total  = order.lines.reduce((s, l) => s + l.totalQty, 0)
                const daXuat = order.lines.reduce((s, l) => s + sumXuat(l), 0)
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, color: 'var(--text3)' }}>{order.piCode}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{order.poCode}</td>
                    <td style={{ ...tdStyle, overflow: 'hidden' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>{order.skuCode}</span>
                        <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{order.skuName}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{total}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: daXuat > 0 ? '#d97706' : 'var(--text3)' }}>{daXuat}</td>
                    <td style={tdStyle}><ProgressBar value={daXuat} max={total} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
