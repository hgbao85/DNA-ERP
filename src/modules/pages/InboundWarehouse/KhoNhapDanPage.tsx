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
import type { ManhOrder, ManhSkuGroup } from '../../../types/manh'

interface WeavingPoint { id: number; name: string; fullName?: string }

const sumXuat = (line: { allocations: { xuatQty: number }[] }) => line.allocations.reduce((s, a) => s + a.xuatQty, 0)
const sumNhap = (line: { allocations: { nhapQty: number }[] }) => line.allocations.reduce((s, a) => s + a.nhapQty, 0)
const skuLines = (sku: ManhSkuGroup) => sku.lines
const orderLines = (order: ManhOrder) => order.skus.flatMap(skuLines)

/**
 * Nhập đan = kho thành phẩm nhận mảnh đã đan từ điểm đan gia công bên ngoài. Mỗi dòng ở đây ứng
 * với 1 (mảnh, điểm đan) — vì 1 loại mảnh có thể được xuất cho nhiều điểm đan khác nhau, kho thành
 * phẩm cần biết chính xác đang nhận về từ điểm đan nào để xác nhận đúng phần đó. Đồng bộ trực tiếp
 * với "Theo dõi xuất đan" — chỉ những điểm đan đã có ít nhất 1 lần xuất mới hiện ở đây.
 *
 * PO là cấp lớn nhất: 1 PO có thể có nhiều SKU, mỗi SKU ứng với 1 mã PI riêng — nên điều hướng có
 * 3 cấp: danh sách PO → danh sách SKU trong PO → chi tiết nhập của 1 SKU.
 */
export default function KhoNhapDanPage() {
  const { data: allOrders, refetch } = useFetch<ManhOrder[]>(() => (api as any).getManhOrders(), [])
  const { data: weavingPoints } = useFetch<WeavingPoint[]>(() => (api as any).getWeavingPoints(), [])
  const pointLabel = (id: number) => {
    const p = safeArr(weavingPoints).find(w => w.id === id)
    return p?.fullName ?? p?.name ?? `#${id}`
  }

  // Chỉ giữ lại các PO có ít nhất 1 SKU đã xuất đan (còn SKU chưa xuất gì thì lọc bỏ khỏi SKU list bên dưới)
  const orders = safeArr(allOrders)
    .map(o => ({ ...o, skus: o.skus.filter(sku => sku.lines.some(l => sumXuat(l) > 0)) }))
    .filter(o => o.skus.length > 0)

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [selectedSkuId, setSelectedSkuId] = useState<number | null>(null)
  const selectedOrder = orders.find(o => o.id === selectedOrderId) ?? null
  const selectedSku = selectedOrder?.skus.find(s => s.id === selectedSkuId) ?? null

  const [qty, setQty] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [msgs, setMsgs] = useState<Record<number, string>>({})
  const { ask, confirmModal } = useConfirm()

  const handleNhap = (lineId: number, weavingPointId: number, allocId: number, max: number) => {
    const q = Number(qty[allocId])
    if (!q || q <= 0 || q > max) { setMsgs(p => ({ ...p, [allocId]: 'Số lượng không hợp lệ' })); return }
    ask(
      { message: `Xác nhận đã nhận ${q} mảnh này từ ${pointLabel(weavingPointId)}? Tồn kho thành phẩm sẽ được cộng ngay.` },
      async () => {
        setBusy(allocId)
        setMsgs(p => ({ ...p, [allocId]: '' }))
        try {
          await (api as any).nhapManh(lineId, weavingPointId, q)
          setQty(p => ({ ...p, [allocId]: '' }))
          refetch()
        } catch (e) {
          setMsgs(p => ({ ...p, [allocId]: errMsg(e, 'Không thể xác nhận nhập đan') }))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  // ── Cấp 3: chi tiết nhập của 1 SKU ───────────────────────────────────────────
  if (selectedOrder && selectedSku) {
    const total  = selectedSku.lines.reduce((s, l) => s + l.totalQty, 0)
    const daXuat = selectedSku.lines.reduce((s, l) => s + sumXuat(l), 0)
    const daNhap = selectedSku.lines.reduce((s, l) => s + sumNhap(l), 0)
    const rows = selectedSku.lines.flatMap(l => l.allocations.filter(a => a.xuatQty > 0).map(a => ({ line: l, alloc: a })))

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setSelectedSkuId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
          >
            <ChevronLeft size={15} /> Quay lại
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {selectedSku.skuCode}
              <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>— {selectedSku.skuName}</span>
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
              PO: {selectedOrder.poCode} · PI: {selectedSku.piCode}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{total}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Tổng</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>{daXuat}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Đã xuất</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{daNhap}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Đã nhập</div>
          </div>
        </div>

        <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 10 }}>
          Mỗi dòng ứng với 1 điểm đan — 1 loại mảnh có thể xuất hiện nhiều lần nếu đã xuất cho nhiều điểm đan khác nhau.
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 190 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>Tên mảnh</th>
                <th style={thStyle}>Điểm đan</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SL đã xuất</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SL đã nhập</th>
                <th style={thStyle}>Nhập</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ line, alloc }) => {
                const remaining = alloc.xuatQty - alloc.nhapQty
                const done = remaining <= 0
                return (
                  <tr key={alloc.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{line.name}</td>
                    <td style={tdStyle}>{pointLabel(alloc.weavingPointId)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{alloc.xuatQty}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: alloc.nhapQty > 0 ? '#16a34a' : 'var(--text3)' }}>{alloc.nhapQty}</td>
                    <td style={tdStyle}>
                      {done ? (
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã nhận đủ</span>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number" min={1} max={remaining}
                              value={qty[alloc.id] ?? ''}
                              onChange={e => setQty(p => ({ ...p, [alloc.id]: e.target.value }))}
                              placeholder="SL"
                              style={{ width: 64, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                            />
                            <button
                              onClick={() => handleNhap(line.id, alloc.weavingPointId, alloc.id, remaining)}
                              disabled={busy === alloc.id}
                              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#166534', color: '#fff', cursor: busy === alloc.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                            >
                              {busy === alloc.id ? 'Đang lưu...' : 'Nhập'}
                            </button>
                          </div>
                          {msgs[alloc.id] && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{msgs[alloc.id]}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {confirmModal}
      </div>
    )
  }

  // ── Cấp 2: danh sách SKU trong 1 PO ─────────────────────────────────────────
  if (selectedOrder) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setSelectedOrderId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
          >
            <ChevronLeft size={15} /> Quay lại
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedOrder.poCode}</h2>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
              {selectedOrder.skus.length} SKU đã xuất đan trong PO này — mỗi SKU ứng với 1 mã PI riêng
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 130 }} /><col /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PI</th>
                <th style={thStyle}>SKU</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SL</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                <th style={thStyle}>Tiến độ nhận</th>
              </tr>
            </thead>
            <tbody>
              {selectedOrder.skus.map(sku => {
                const total  = sku.lines.reduce((s, l) => s + l.totalQty, 0)
                const daXuat = sku.lines.reduce((s, l) => s + sumXuat(l), 0)
                const daNhap = sku.lines.reduce((s, l) => s + sumNhap(l), 0)
                return (
                  <tr
                    key={sku.id}
                    onClick={() => setSelectedSkuId(sku.id)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, color: 'var(--text3)' }}>{sku.piCode}</td>
                    <td style={{ ...tdStyle, overflow: 'hidden' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>{sku.skuCode}</span>
                        <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{sku.skuName}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{total}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{daXuat}</td>
                    <td style={tdStyle}><ProgressBar value={daNhap} max={daXuat} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Cấp 1: danh sách PO ──────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Theo dõi nhập đan</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Nhận mảnh đã đan từ điểm đan gia công bên ngoài, theo từng PO đã xuất đan — 1 PO có thể có nhiều SKU
        </p>
      </div>

      {orders.length === 0 ? (
        <div style={emptyBox}>Chưa có PO nào được xuất đan</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 150 }} /><col style={{ width: 80 }} /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Số SKU</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SL</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                <th style={thStyle}>Tiến độ nhận</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const lines = orderLines(order)
                const total  = lines.reduce((s, l) => s + l.totalQty, 0)
                const daXuat = lines.reduce((s, l) => s + sumXuat(l), 0)
                const daNhap = lines.reduce((s, l) => s + sumNhap(l), 0)
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{order.poCode}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{order.skus.length}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{total}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{daXuat}</td>
                    <td style={tdStyle}><ProgressBar value={daNhap} max={daXuat} /></td>
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
