'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowUpFromLine, ChevronLeft, Clock } from 'lucide-react'
import { format } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────

type OrderStatus = 'cho' | 'da'

interface OrderLine {
  id: string
  materialName: string
  unit: string
  plannedQty: number
  availableQty: number
  confirmedQty: number
  inputQty: string
}

interface Order {
  id: string
  ref: string
  counterpart: string
  date: string
  poNumber?: string
  skuCode?: string
  skuName?: string
  lines: OrderLine[]
}

interface Txn {
  id: string
  orderRef: string
  materialName: string
  unit: string
  qty: number
  date: string
}

// ── Status ─────────────────────────────────────────────────────────────────────

function getStatus(order: Order): OrderStatus {
  return order.lines.every(l => l.confirmedQty >= l.plannedQty) ? 'da' : 'cho'
}

const STATUS: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  cho: { label: 'Chờ xử lý',  color: '#92400e', bg: '#fef3c7' },
  da:  { label: 'Hoàn thành', color: '#166534', bg: '#dcfce7' },
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const L = (id: string, materialName: string, unit: string, plannedQty: number, availableQty = plannedQty): OrderLine =>
  ({ id, materialName, unit, plannedQty, availableQty, confirmedQty: 0, inputQty: '' })

const MOCK: Record<string, Order[]> = {
  'phoi-son-han': [
    {
      id: 'po-psh-1', ref: 'PO-2507-001', counterpart: 'LSX GX-001', date: '2025-07-01',
      poNumber: 'PO-MY-001', skuCode: 'JSE-55', skuName: 'Ghế J55',
      lines: [
        L('l1', 'Thép ống D25×1.5',   'm',   300, 280),
        L('l2', 'Thép tấm dày 1.5mm', 'm²',   80,  90),
        L('l3', 'Sơn tĩnh điện đen',  'kg',   40,  35),
        L('l4', 'Que hàn điện 3.2mm', 'hộp',  10,  15),
      ],
    },
    {
      id: 'po-psh-2', ref: 'PO-2507-002', counterpart: 'LSX GX-004', date: '2025-07-02',
      poNumber: 'PO-GP-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3',
      lines: [
        L('l1', 'Thép hộp 25×25×1.2mm', 'm',  150, 120),
        L('l2', 'Thép tấm dày 1.5mm',   'm²',  50,  60),
        L('l3', 'Sơn tĩnh điện trắng',  'kg',  30,  25),
      ],
    },
  ],
  'vat-tu-tp': [
    {
      id: 'po-vt-1', ref: 'PO-2507-001', counterpart: 'LSX GX-001', date: '2025-07-01',
      poNumber: 'LSX-GX-001', skuCode: 'GHE-PE', skuName: 'Ghế sắt PE trắng 100 cái',
      lines: [
        L('l1', 'Dây đan PE 2mm – trắng', 'm',   1500, 1800),
        L('l2', 'Ốc vít M6×20',           'cái',  400,  500),
        L('l3', 'Nhựa bịt đầu ống D25',  'cái',  200,  180),
        L('l4', 'Vòng đệm M6',            'cái',  400,  450),
      ],
    },
    {
      id: 'po-vt-2', ref: 'PO-2507-002', counterpart: 'LSX GX-004', date: '2025-07-02',
      poNumber: 'LSX-GX-004', skuCode: 'BAN-PE', skuName: 'Bàn sắt PE Ø80 50 cái',
      lines: [
        L('l1', 'Dây đan PE 2mm – ghi xám', 'm',   800, 700),
        L('l2', 'Bu lông M8×30',             'cái', 200, 250),
        L('l3', 'Đai ốc M6',                'cái', 200, 200),
      ],
    },
  ],
  'thanh-pham': [
    {
      id: 'po-tp-1', ref: 'ĐH-2507-001', counterpart: 'Nội thất Hải Phòng', date: '2025-07-01',
      poNumber: 'ĐH-2507-001', skuCode: 'GHE-PE', skuName: 'Ghế sắt mặt đan PE',
      lines: [
        L('l1', 'Ghế sắt mặt đan PE – trắng',   'cái', 50, 45),
        L('l2', 'Bàn sắt mặt đan PE tròn Ø80',  'cái', 10, 12),
        L('l3', 'Bao bì carton 5 lớp',           'cái', 60, 80),
      ],
    },
    {
      id: 'po-tp-2', ref: 'ĐH-2507-002', counterpart: 'Sunshine Outdoor SG', date: '2025-07-03',
      poNumber: 'ĐH-2507-002', skuCode: 'SET-OUTDOOR', skuName: 'Bộ bàn ghế ngoài trời',
      lines: [
        L('l1', 'Ghế sắt mặt đan PE – đen',     'cái',  80,  75),
        L('l2', 'Bộ bàn ghế ngoài trời 4 chỗ', 'bộ',   15,  10),
        L('l3', 'Bao bì carton 5 lớp',          'cái',  80, 100),
        L('l4', 'Màng PE bọc sản phẩm',         'cuộn',  5,   6),
      ],
    },
  ],
}

// ── Component ──────────────────────────────────────────────────────────────────

const ACCENT = '#e65100'

export default function WarehouseXuatPage({ scope }: { scope: string }) {
  const [orders, setOrders]         = useState<Order[]>(() => MOCK[scope] ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [txns, setTxns]             = useState<Txn[]>([])
  const [view, setView]             = useState<'orders' | 'history'>('orders')

  const selected = orders.find(o => o.id === selectedId) ?? null

  const confirmLine = (orderId: string, lineId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      return {
        ...o,
        lines: o.lines.map(l => {
          if (l.id !== lineId) return l
          const raw = Math.max(0, Number(l.inputQty) || 0)
          if (raw <= 0) return l
          const qty = Math.min(raw, l.availableQty)
          if (qty <= 0) return l
          setTxns(t => [{
            id: `txn-${Date.now()}-${lineId}`, orderRef: o.ref,
            materialName: l.materialName, unit: l.unit, qty, date: new Date().toISOString(),
          }, ...t])
          return { ...l, confirmedQty: l.confirmedQty + qty, availableQty: l.availableQty - qty, inputQty: '' }
        }),
      }
    }))
  }

  const updateInput = (orderId: string, lineId: string, val: string) =>
    setOrders(prev => prev.map(o =>
      o.id !== orderId ? o : { ...o, lines: o.lines.map(l => l.id !== lineId ? l : { ...l, inputQty: val }) }
    ))

  const usePOLayout = scope === 'phoi-son-han' || scope === 'thanh-pham'

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const cfg = STATUS[getStatus(selected)]
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setSelectedId(null)} style={backBtn}>
              <ChevronLeft size={15} /> Quay lại
            </button>
            <div>
              {usePOLayout && selected.poNumber ? (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text3)' }}>{selected.poNumber}</span>
                    <span style={{ fontWeight: 600, marginLeft: 10 }}>{selected.skuCode}</span>
                    {selected.skuName && <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6, fontSize: 15 }}>— {selected.skuName}</span>}
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
                    Đối tác: {selected.counterpart} · {selected.lines.length} mặt hàng · đã xác nhận {selected.lines.filter(l => l.confirmedQty > 0).length}/{selected.lines.length} dòng
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    <span style={{ color: ACCENT }}>{selected.ref}</span>
                    <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 8, fontSize: 15 }}>{selected.counterpart}</span>
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
                    Ngày: {format(new Date(selected.date), 'dd/MM/yyyy')} · {selected.lines.length} vật tư · đã xác nhận {selected.lines.filter(l => l.confirmedQty > 0).length}/{selected.lines.length} dòng
                  </div>
                </>
              )}
            </div>
          </div>
          <span style={{ ...badge, fontSize: 12, padding: '4px 14px', alignSelf: 'center', color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
        </div>

        {/* 7-column xuất table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col style={{ width: 56 }} /><col style={{ width: 84 }} /><col style={{ width: 72 }} /><col style={{ width: 72 }} /><col style={{ width: 72 }} /><col style={{ width: 170 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Vật tư</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>Kế hoạch</th>
                <th style={{ ...th, textAlign: 'right' }}>Thực có</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã xuất</th>
                <th style={{ ...th, textAlign: 'right' }}>Còn lại</th>
                <th style={th}>Xuất</th>
              </tr>
            </thead>
            <tbody>
              {selected.lines.map(l => {
                const done      = l.confirmedQty >= l.plannedQty
                const partial   = l.confirmedQty > 0 && !done
                const conLai    = l.plannedQty - l.confirmedQty
                const noStock   = l.availableQty <= 0
                const inputNum  = Number(l.inputQty)
                const overAvail = !!l.inputQty && inputNum > l.availableQty
                const can       = !!l.inputQty && inputNum > 0 && !overAvail
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)', background: done ? 'rgba(22,101,52,.04)' : undefined }}>
                    <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.materialName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{l.unit}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.plannedQty.toLocaleString('vi-VN')}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: l.availableQty > 0 ? '#2563eb' : '#dc2626' }}>
                      {l.availableQty.toLocaleString('vi-VN')}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? '#16a34a' : partial ? '#d97706' : 'var(--text)' }}>
                      {done && <span style={{ marginRight: 4, fontSize: 11 }}>✓</span>}
                      {l.confirmedQty.toLocaleString('vi-VN')}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: conLai > 0 ? '#d97706' : '#16a34a' }}>
                      {conLai.toLocaleString('vi-VN')}
                    </td>
                    <td style={td}>
                      {done ? (
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã xong</span>
                      ) : noStock ? (
                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Hết hàng</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number" min={1} max={l.availableQty} value={l.inputQty}
                            onChange={e => updateInput(selected.id, l.id, e.target.value)}
                            placeholder="SL"
                            style={{ width: 72, padding: '4px 8px', border: `1px solid ${overAvail ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                          />
                          <button onClick={() => confirmLine(selected.id, l.id)} disabled={!can}
                            style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: can ? ACCENT : 'var(--surface2)', color: can ? '#fff' : 'var(--text3)', cursor: can ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                            Xác nhận
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowUpFromLine size={20} color={ACCENT} /> Xuất kho
        </h2>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['orders', 'history'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={tabBtn(view === v, ACCENT)}>
              {v === 'history' && <Clock size={13} />}
              {v === 'orders' ? 'Lệnh SX (PO)' : 'Lịch sử'}
            </button>
          ))}
        </div>
      </div>

      {view === 'orders' && (
        orders.length === 0 ? (
          <div style={emptyBox}>Không có lệnh xuất nào đang chờ xử lý</div>
        ) : (
          // PO | SKU | Số lượng vật tư | Trạng thái — mọi kho (không có hạn giao)
          <div style={tableWrap}>
            <table style={tbl}>
              <colgroup>
                <col style={{ width: 130 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 130 }} />
              </colgroup>
              <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>PO</th>
                <th style={th}>SKU</th>
                <th style={{ ...th, textAlign: 'right' }}>Số lượng vật tư</th>
                <th style={th}>Trạng thái</th>
              </tr></thead>
              <tbody>
                {orders.map(order => {
                  const cfg = STATUS[getStatus(order)]
                  return (
                    <tr key={order.id} onClick={() => setSelectedId(order.id)} style={row}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ ...td, fontWeight: 700, color: 'var(--text3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{order.poNumber ?? order.ref}</td>
                      <td style={{ ...td, overflow: 'hidden' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 600 }}>{order.skuCode ?? '—'}</span>
                          {order.skuName && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{order.skuName}</span>}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{order.lines.length}</td>
                      <td style={td}><span style={{ ...badge, color: cfg.color, background: cfg.bg }}>{cfg.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {view === 'history' && (
        txns.length === 0 ? (
          <div style={emptyBox}>Chưa có giao dịch nào trong phiên này</div>
        ) : (
          <div style={tableWrap}>
            <table style={tbl}>
              <colgroup>
                <col style={{ width: 130 }} /><col style={{ width: 110 }} /><col /><col style={{ width: 56 }} /><col style={{ width: 80 }} />
              </colgroup>
              <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Thời gian</th>
                <th style={th}>Mã PO / ĐH</th>
                <th style={th}>Vật tư</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>SL xuất</th>
              </tr></thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{format(new Date(t.date), 'HH:mm · dd/MM')}</td>
                    <td style={{ ...td, fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' }}>{t.orderRef}</td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{t.materialName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{t.unit}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: ACCENT }}>−{t.qty.toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const th: CSSProperties      = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: CSSProperties      = { padding: '8px 12px', color: 'var(--text)' }
const tableWrap: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const tbl: CSSProperties     = { width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }
const row: CSSProperties     = { borderTop: '1px solid var(--border)', cursor: 'pointer' }
const badge: CSSProperties   = { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }
const emptyBox: CSSProperties  = { padding: 48, textAlign: 'center', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }
const backBtn: CSSProperties   = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }

const tabBtn = (active: boolean, accent: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', fontSize: 13,
  fontWeight: active ? 700 : 500, background: 'transparent', border: 'none', cursor: 'pointer',
  color: active ? accent : 'var(--text2)', borderBottom: active ? `2px solid ${accent}` : '2px solid transparent', marginBottom: -1,
})
