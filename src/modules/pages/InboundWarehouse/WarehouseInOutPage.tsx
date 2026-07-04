'use client'
import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, Clock } from 'lucide-react'
import { format } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = 'cho' | 'dang' | 'da'

interface OrderLine {
  id: string
  materialName: string
  unit: string
  plannedQty: number
  confirmedQty: number
  inputQty: string
}

interface Order {
  id: string
  ref: string
  counterpart: string   // tên nhà cung cấp (nhập) hoặc tên lệnh SX (xuất)
  date: string
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

// ── Status helpers ─────────────────────────────────────────────────────────────

function getOrderStatus(order: Order): OrderStatus {
  if (order.lines.every(l => l.confirmedQty >= l.plannedQty)) return 'da'
  if (order.lines.some(l => l.confirmedQty > 0)) return 'dang'
  return 'cho'
}

const STATUS_CFG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  cho:  { label: 'Chờ xử lý',   color: '#92400e', bg: '#fef3c7' },
  dang: { label: 'Đang xử lý',  color: '#1e40af', bg: '#dbeafe' },
  da:   { label: 'Hoàn thành',  color: '#166534', bg: '#dcfce7' },
}

// ── Mock data theo scope ───────────────────────────────────────────────────────

function makeMockOrders(mode: 'nhap' | 'xuat', scope: string): Order[] {
  const line = (id: string, materialName: string, unit: string, plannedQty: number): OrderLine =>
    ({ id, materialName, unit, plannedQty, confirmedQty: 0, inputQty: '' })

  if (scope === 'phoi-son-han') {
    if (mode === 'nhap') return [
      { id: 'pi-psh-1', ref: 'PI-2507-001', counterpart: 'Thép Miền Nam Corp', date: '2025-07-01', lines: [
        line('l1', 'Thép ống D25×1.5',        'm',    500),
        line('l2', 'Thép tấm dày 1.5mm',      'm²',   100),
        line('l3', 'Thép hộp 25×25×1.2mm',    'm',    200),
      ]},
      { id: 'pi-psh-2', ref: 'PI-2507-002', counterpart: 'Jotun Việt Nam', date: '2025-07-02', lines: [
        line('l1', 'Sơn tĩnh điện đen',       'kg',    80),
        line('l2', 'Sơn tĩnh điện trắng',     'kg',    60),
        line('l3', 'Sơn tĩnh điện nâu sồi',  'kg',    40),
      ]},
      { id: 'pi-psh-3', ref: 'PI-2507-003', counterpart: 'Kim Tín Hàn Việt', date: '2025-07-03', lines: [
        line('l1', 'Que hàn điện 3.2mm',      'hộp',   20),
        line('l2', 'Dây hàn MIG 0.8mm',       'cuộn',  10),
        line('l3', 'Đĩa cắt sắt 105mm',       'cái',  100),
        line('l4', 'Đĩa mài sắt 125mm',       'cái',   80),
      ]},
    ]
    return [
      { id: 'po-psh-1', ref: 'PO-2507-001', counterpart: 'LSX GX-001 · Ghế sắt PE trắng (100 cái)', date: '2025-07-01', lines: [
        line('l1', 'Thép ống D25×1.5',        'm',    300),
        line('l2', 'Thép tấm dày 1.5mm',      'm²',    80),
        line('l3', 'Sơn tĩnh điện đen',       'kg',    40),
        line('l4', 'Que hàn điện 3.2mm',      'hộp',   10),
      ]},
      { id: 'po-psh-2', ref: 'PO-2507-002', counterpart: 'LSX GX-004 · Bàn sắt PE Ø80 (50 cái)', date: '2025-07-02', lines: [
        line('l1', 'Thép hộp 25×25×1.2mm',   'm',    150),
        line('l2', 'Thép tấm dày 1.5mm',      'm²',    50),
        line('l3', 'Sơn tĩnh điện trắng',    'kg',    30),
      ]},
    ]
  }

  if (scope === 'vat-tu-tp') {
    if (mode === 'nhap') return [
      { id: 'pi-vt-1', ref: 'PI-2507-004', counterpart: 'Thành Thái Plastic', date: '2025-07-01', lines: [
        line('l1', 'Dây đan PE 2mm – trắng',    'm', 2000),
        line('l2', 'Dây đan PE 2mm – đen',      'm', 1500),
        line('l3', 'Dây đan PE 2mm – xanh lam', 'm', 1000),
        line('l4', 'Dây đan PE 2mm – ghi xám',  'm',  800),
      ]},
      { id: 'pi-vt-2', ref: 'PI-2507-005', counterpart: 'Kim Khí Bình Dương', date: '2025-07-02', lines: [
        line('l1', 'Ốc vít M6×20',   'cái', 2000),
        line('l2', 'Bu lông M8×30',  'cái', 1000),
        line('l3', 'Đai ốc M6',      'cái', 1500),
        line('l4', 'Vòng đệm M6',    'cái', 1500),
      ]},
    ]
    return [
      { id: 'po-vt-1', ref: 'PO-2507-001', counterpart: 'LSX GX-001 · Ghế sắt PE trắng (100 cái)', date: '2025-07-01', lines: [
        line('l1', 'Dây đan PE 2mm – trắng', 'm',   1500),
        line('l2', 'Ốc vít M6×20',           'cái',  400),
        line('l3', 'Nhựa bịt đầu ống D25',  'cái',  200),
        line('l4', 'Vòng đệm M6',            'cái',  400),
      ]},
      { id: 'po-vt-2', ref: 'PO-2507-002', counterpart: 'LSX GX-004 · Bàn sắt PE Ø80 (50 cái)', date: '2025-07-02', lines: [
        line('l1', 'Dây đan PE 2mm – ghi xám', 'm',   800),
        line('l2', 'Bu lông M8×30',             'cái', 200),
        line('l3', 'Đai ốc M6',                'cái', 200),
      ]},
    ]
  }

  if (scope === 'thanh-pham') {
    if (mode === 'nhap') return [
      { id: 'pi-tp-1', ref: 'PI-2507-006', counterpart: 'Dây chuyền SX – Lô 1', date: '2025-07-01', lines: [
        line('l1', 'Ghế sắt mặt đan PE – trắng',    'cái', 50),
        line('l2', 'Ghế sắt mặt đan PE – đen',      'cái', 30),
        line('l3', 'Ghế sắt mặt đan PE – xanh lam', 'cái', 20),
      ]},
      { id: 'pi-tp-2', ref: 'PI-2507-007', counterpart: 'Dây chuyền SX – Lô 2', date: '2025-07-03', lines: [
        line('l1', 'Bàn sắt mặt đan PE tròn Ø80', 'cái', 20),
        line('l2', 'Ghế xếp compact',              'cái', 40),
        line('l3', 'Bộ bàn ghế ngoài trời 4 chỗ', 'bộ',  10),
      ]},
    ]
    return [
      { id: 'po-tp-1', ref: 'ĐH-2507-001', counterpart: 'Nội thất Hải Phòng (giao 30/07)', date: '2025-07-01', lines: [
        line('l1', 'Ghế sắt mặt đan PE – trắng',    'cái', 50),
        line('l2', 'Bàn sắt mặt đan PE tròn Ø80',  'cái', 10),
        line('l3', 'Bao bì carton 5 lớp',           'cái', 60),
      ]},
      { id: 'po-tp-2', ref: 'ĐH-2507-002', counterpart: 'Sunshine Outdoor SG – Xuất khẩu', date: '2025-07-03', lines: [
        line('l1', 'Ghế sắt mặt đan PE – đen',     'cái', 80),
        line('l2', 'Bộ bàn ghế ngoài trời 4 chỗ', 'bộ',  15),
        line('l3', 'Bao bì carton 5 lớp',          'cái', 80),
        line('l4', 'Màng PE bọc sản phẩm',         'cuộn', 5),
      ]},
    ]
  }

  return []
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  mode: 'nhap' | 'xuat'
  scope: string
}

export default function WarehouseInOutPage({ mode, scope }: Props) {
  const [orders, setOrders]         = useState<Order[]>(() => makeMockOrders(mode, scope))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [txns, setTxns]             = useState<Txn[]>([])
  const [view, setView]             = useState<'orders' | 'history'>('orders')

  const accent  = mode === 'nhap' ? '#2e7d32' : '#e65100'
  const Icon    = mode === 'nhap' ? ArrowDownToLine : ArrowUpFromLine
  const title   = mode === 'nhap' ? 'Nhập kho' : 'Xuất kho'
  const refLabel = mode === 'nhap' ? 'Mã PI' : 'Mã PO / ĐH'

  const selected = orders.find(o => o.id === selectedId) ?? null

  // ── Confirm a single line ──────────────────────────────────────────────────
  const confirmLine = (orderId: string, lineId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const newLines = o.lines.map(l => {
        if (l.id !== lineId) return l
        const qty = Math.max(0, Number(l.inputQty) || 0)
        if (qty <= 0) return l
        const newConfirmed = l.confirmedQty + qty
        setTxns(t => [{
          id:           `txn-${Date.now()}-${lineId}`,
          orderRef:     o.ref,
          materialName: l.materialName,
          unit:         l.unit,
          qty,
          date:         new Date().toISOString(),
        }, ...t])
        return { ...l, confirmedQty: newConfirmed, inputQty: '' }
      })
      return { ...o, lines: newLines }
    }))
  }

  const updateInput = (orderId: string, lineId: string, val: string) => {
    setOrders(prev => prev.map(o =>
      o.id !== orderId ? o : {
        ...o,
        lines: o.lines.map(l => l.id !== lineId ? l : { ...l, inputQty: val }),
      }
    ))
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selected) {
    const status = getOrderStatus(selected)
    const cfg = STATUS_CFG[status]
    return (
      <div>
        {/* Detail header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSelectedId(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
            >
              <ChevronLeft size={15} /> Quay lại
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                <span style={{ color: accent }}>{selected.ref}</span>
                <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 8, fontSize: 15 }}>{selected.counterpart}</span>
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
                Ngày: {format(new Date(selected.date), 'dd/MM/yyyy')}
                {' · '}{selected.lines.length} vật tư
                {' · '}đã xác nhận {selected.lines.filter(l => l.confirmedQty > 0).length}/{selected.lines.length} dòng
              </div>
            </div>
          </div>
          <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20, color: cfg.color, background: cfg.bg, alignSelf: 'center' }}>
            {cfg.label}
          </span>
        </div>

        {/* Lines table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col style={{ width: 56 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 186 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Vật tư</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>Kế hoạch</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã xác nhận</th>
                <th style={th}>{mode === 'nhap' ? 'Nhập' : 'Xuất'}</th>
              </tr>
            </thead>
            <tbody>
              {selected.lines.map(line => {
                const done    = line.confirmedQty >= line.plannedQty
                const partial = line.confirmedQty > 0 && !done
                const canConfirm = !!line.inputQty && Number(line.inputQty) > 0
                return (
                  <tr key={line.id} style={{ borderTop: '1px solid var(--border)', background: done ? 'rgba(22,101,52,.04)' : undefined }}>
                    <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {line.materialName}
                    </td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{line.unit}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{line.plannedQty.toLocaleString('vi-VN')}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? '#16a34a' : partial ? '#d97706' : 'var(--text)' }}>
                      {done && <span style={{ marginRight: 4, fontSize: 11 }}>✓</span>}
                      {line.confirmedQty.toLocaleString('vi-VN')}
                    </td>
                    <td style={td}>
                      {done ? (
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã xong</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number" min={1}
                            value={line.inputQty}
                            onChange={e => updateInput(selected.id, line.id, e.target.value)}
                            placeholder="SL"
                            style={{ width: 72, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                          />
                          <button
                            onClick={() => confirmLine(selected.id, line.id)}
                            disabled={!canConfirm}
                            style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: canConfirm ? accent : 'var(--surface2)', color: canConfirm ? '#fff' : 'var(--text3)', cursor: canConfirm ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                          >
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

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header + sub-tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={20} color={accent} /> {title}
        </h2>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {([['orders', mode === 'nhap' ? 'Lệnh mua (PI)' : 'Lệnh SX (PO)'], ['history', 'Lịch sử']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', fontSize: 13, fontWeight: view === v ? 700 : 500, background: 'transparent', border: 'none', cursor: 'pointer', color: view === v ? accent : 'var(--text2)', borderBottom: view === v ? `2px solid ${accent}` : '2px solid transparent', marginBottom: -1 }}
            >
              {v === 'history' && <Clock size={13} />}{label}
            </button>
          ))}
        </div>
      </div>

      {view === 'orders' && (
        orders.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}>
            Không có lệnh nào đang chờ xử lý
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 140 }} />
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>{refLabel}</th>
                  <th style={th}>{mode === 'nhap' ? 'Nhà cung cấp' : 'Lệnh / Đơn hàng'}</th>
                  <th style={th}>Ngày</th>
                  <th style={{ ...th, textAlign: 'right' }}>Vật tư</th>
                  <th style={th}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const status = getOrderStatus(order)
                  const cfg = STATUS_CFG[status]
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ ...td, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>{order.ref}</td>
                      <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.counterpart}</td>
                      <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {format(new Date(order.date), 'dd/MM/yyyy')}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{order.lines.length}</td>
                      <td style={td}>
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>
                          {cfg.label}
                        </span>
                      </td>
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
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}>
            Chưa có giao dịch nào trong phiên này
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 130 }} />
                <col style={{ width: 110 }} />
                <col />
                <col style={{ width: 56 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>Thời gian</th>
                  <th style={th}>{refLabel}</th>
                  <th style={th}>Vật tư</th>
                  <th style={th}>ĐVT</th>
                  <th style={{ ...th, textAlign: 'right' }}>{mode === 'nhap' ? 'SL nhập' : 'SL xuất'}</th>
                </tr>
              </thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {format(new Date(t.date), 'HH:mm · dd/MM')}
                    </td>
                    <td style={{ ...td, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>{t.orderRef}</td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{t.materialName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{t.unit}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: accent }}>
                      {mode === 'nhap' ? '+' : '−'}{t.qty.toLocaleString('vi-VN')}
                    </td>
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

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '8px 12px', color: 'var(--text)' }
