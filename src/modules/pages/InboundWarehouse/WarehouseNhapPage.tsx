'use client'
import { useState, useEffect } from 'react'
import { ArrowDownToLine, ChevronLeft, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useInspection, type PurchaseProposal } from '../../../context/InspectionContext'
import { compactTh as th, compactTd as td, tableWrap, tbl, row, badge, emptyBox } from '../../../styles/table'
import { backBtn, tabBtn } from '../../../styles/buttons'

// ── Types ──────────────────────────────────────────────────────────────────────

type OrderStatus = 'cho' | 'da'

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
  counterpart: string
  date: string
  poNumber?: string
  skuCode?: string
  skuName?: string
  deadline?: string
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
  cho: { label: 'Chờ nhập',   color: '#92400e', bg: '#fef3c7' },
  da:  { label: 'Hoàn thành', color: '#166534', bg: '#dcfce7' },
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const L = (id: string, materialName: string, unit: string, plannedQty: number): OrderLine =>
  ({ id, materialName, unit, plannedQty, confirmedQty: 0, inputQty: '' })

const MOCK: Record<string, Order[]> = {
  'phoi-son-han': [
    {
      id: 'pi-psh-1', ref: 'PI-2507-001', counterpart: 'Thép Miền Nam Corp', date: '2025-07-01',
      poNumber: 'PO-MY-001', skuCode: 'JSE-55', skuName: 'Ghế J55', deadline: '2026-10-15',
      lines: [
        L('l1', 'Thép ống D25×1.5',     'm',  500),
        L('l2', 'Thép tấm dày 1.5mm',   'm²', 100),
        L('l3', 'Thép hộp 25×25×1.2mm', 'm',  200),
      ],
    },
    {
      id: 'pi-psh-2', ref: 'PI-2507-002', counterpart: 'Jotun Việt Nam', date: '2025-07-02',
      poNumber: 'PO-GP-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3', deadline: '2026-11-01',
      lines: [
        L('l1', 'Sơn tĩnh điện đen',     'kg', 80),
        L('l2', 'Sơn tĩnh điện trắng',   'kg', 60),
        L('l3', 'Sơn tĩnh điện nâu sồi', 'kg', 40),
      ],
    },
    {
      id: 'pi-psh-3', ref: 'PI-2507-003', counterpart: 'Kim Tín Hàn Việt', date: '2025-07-03',
      poNumber: 'PO-IK-003', skuCode: 'JSE-55', skuName: 'Ghế J55', deadline: '2026-12-20',
      lines: [
        L('l1', 'Que hàn điện 3.2mm', 'hộp',  20),
        L('l2', 'Dây hàn MIG 0.8mm',  'cuộn', 10),
        L('l3', 'Đĩa cắt sắt 105mm',  'cái',  100),
        L('l4', 'Đĩa mài sắt 125mm',  'cái',  80),
      ],
    },
  ],
  'vat-tu-tp': [
    {
      id: 'pi-vt-1', ref: 'PI-2507-004', counterpart: 'Thành Thái Plastic', date: '2025-07-01',
      poNumber: 'PI-2507-004', skuCode: 'PE-2MM', skuName: 'Dây đan PE 2mm (4 màu)', deadline: '2026-08-10',
      lines: [
        L('l1', 'Dây đan PE 2mm – trắng',    'm', 2000),
        L('l2', 'Dây đan PE 2mm – đen',      'm', 1500),
        L('l3', 'Dây đan PE 2mm – xanh lam', 'm', 1000),
        L('l4', 'Dây đan PE 2mm – ghi xám',  'm',  800),
      ],
    },
    {
      id: 'pi-vt-2', ref: 'PI-2507-005', counterpart: 'Kim Khí Bình Dương', date: '2025-07-02',
      poNumber: 'PI-2507-005', skuCode: 'PHU-KIEN', skuName: 'Phụ kiện ốc vít & bu lông', deadline: '2026-08-15',
      lines: [
        L('l1', 'Ốc vít M6×20',  'cái', 2000),
        L('l2', 'Bu lông M8×30', 'cái', 1000),
        L('l3', 'Đai ốc M6',     'cái', 1500),
        L('l4', 'Vòng đệm M6',   'cái', 1500),
      ],
    },
  ],
  'thanh-pham': [
    {
      id: 'pi-tp-1', ref: 'PI-2507-006', counterpart: 'Dây chuyền SX – Lô 1', date: '2025-07-01',
      poNumber: 'LSX-2507-001', skuCode: 'GHE-PE', skuName: 'Ghế sắt mặt đan PE', deadline: '2026-07-30',
      lines: [
        L('l1', 'Ghế sắt mặt đan PE – trắng',    'cái', 50),
        L('l2', 'Ghế sắt mặt đan PE – đen',      'cái', 30),
        L('l3', 'Ghế sắt mặt đan PE – xanh lam', 'cái', 20),
      ],
    },
    {
      id: 'pi-tp-2', ref: 'PI-2507-007', counterpart: 'Dây chuyền SX – Lô 2', date: '2025-07-03',
      poNumber: 'LSX-2507-002', skuCode: 'BAN-NGOAI', skuName: 'Bàn/Ghế ngoài trời', deadline: '2026-08-15',
      lines: [
        L('l1', 'Bàn sắt mặt đan PE tròn Ø80', 'cái', 20),
        L('l2', 'Ghế xếp compact',              'cái', 40),
        L('l3', 'Bộ bàn ghế ngoài trời 4 chỗ', 'bộ',  10),
      ],
    },
  ],
}

// ── Purchasing proposal → nhập order ──────────────────────────────────────────

const KHO_SCOPE: Record<string, string> = {
  'Kho Phôi Sơn Hàn':       'phoi-son-han',
  'Kho Vật tư thành phẩm':  'vat-tu-tp',
  'Kho Thành Phẩm':         'thanh-pham',
}

function proposalToOrder(p: PurchaseProposal, scope: string): Order | null {
  const items = p.items.filter(item => KHO_SCOPE[item.khoLabel] === scope)
  if (items.length === 0) return null
  const suppliers = [...new Set(
    items.map(item => p.chosenSuppliers?.[item.name]).filter((x): x is string => !!x)
  )]
  return {
    id:          `prop-order-${p.id}`,
    ref:         p.poNumber,
    counterpart: suppliers.join(' · ') || '—',
    date:        (p.approvedAt ?? p.createdAt).slice(0, 10),
    poNumber:    p.poNumber,
    skuCode:     p.skuCode,
    skuName:     p.skuName,
    deadline:    p.deadline,
    lines: items.map((item, i) => ({
      id:           `${p.id}-line-${i}`,
      materialName: item.name,
      unit:         item.unit,
      plannedQty:   item.buyQty,
      confirmedQty: 0,
      inputQty:     '',
    })),
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

const ACCENT = '#2e7d32'

export default function WarehouseNhapPage({ scope }: { scope: string }) {
  const { proposals } = useInspection()
  const [orders, setOrders]         = useState<Order[]>(() => MOCK[scope] ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [txns, setTxns]             = useState<Txn[]>([])
  const [view, setView]             = useState<'orders' | 'history'>('orders')

  // Inject nhập orders from approved purchasing proposals
  useEffect(() => {
    const propOrders = proposals
      .filter(p => p.status === 'purchasing')
      .map(p => proposalToOrder(p, scope))
      .filter((o): o is Order => o !== null)
    if (propOrders.length === 0) return
    setOrders(prev => {
      const newOnes = propOrders.filter(po => !prev.some(o => o.id === po.id))
      return newOnes.length > 0 ? [...prev, ...newOnes] : prev
    })
  }, [proposals, scope])

  const selected = orders.find(o => o.id === selectedId) ?? null

  const confirmLine = (orderId: string, lineId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      return {
        ...o,
        lines: o.lines.map(l => {
          if (l.id !== lineId) return l
          const qty = Math.max(0, Number(l.inputQty) || 0)
          if (qty <= 0) return l
          setTxns(t => [{
            id: `txn-${Date.now()}-${lineId}`, orderRef: o.ref,
            materialName: l.materialName, unit: l.unit, qty, date: new Date().toISOString(),
          }, ...t])
          return { ...l, confirmedQty: l.confirmedQty + qty, inputQty: '' }
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
                    {selected.deadline && <>Deadline: <strong style={{ color: 'var(--text2)' }}>{format(new Date(selected.deadline), 'dd/MM/yyyy')}</strong> · </>}
                    NCC: {selected.counterpart} · {selected.lines.length} mặt hàng · đã xác nhận {selected.lines.filter(l => l.confirmedQty > 0).length}/{selected.lines.length} dòng
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
          <span style={{ ...badge, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col style={{ width: 56 }} /><col style={{ width: 96 }} /><col style={{ width: 80 }} /><col style={{ width: 186 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Vật tư</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>Kế hoạch</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã xác nhận</th>
                <th style={th}>Nhập</th>
              </tr>
            </thead>
            <tbody>
              {selected.lines.map(l => {
                const done    = l.confirmedQty >= l.plannedQty
                const partial = l.confirmedQty > 0 && !done
                const qty     = Number(l.inputQty)
                const can     = !!l.inputQty && qty > 0
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)', background: done ? 'rgba(22,101,52,.04)' : undefined }}>
                    <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.materialName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{l.unit}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.plannedQty.toLocaleString('vi-VN')}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? '#16a34a' : partial ? '#d97706' : 'var(--text)' }}>
                      {done && <span style={{ marginRight: 4, fontSize: 11 }}>✓</span>}
                      {l.confirmedQty.toLocaleString('vi-VN')}
                    </td>
                    <td style={td}>
                      {done ? (
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã xong</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number" min={1} value={l.inputQty}
                            onChange={e => updateInput(selected.id, l.id, e.target.value)}
                            placeholder="SL"
                            style={{ width: 72, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
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
          <ArrowDownToLine size={20} color={ACCENT} /> Nhập kho
        </h2>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['orders', 'history'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={tabBtn(view === v, ACCENT)}>
              {v === 'history' && <Clock size={13} />}
              {v === 'orders' ? 'Lệnh mua (PI)' : 'Lịch sử'}
            </button>
          ))}
        </div>
      </div>

      {view === 'orders' && (
        orders.length === 0 ? (
          <div style={emptyBox}>Không có lệnh nhập nào đang chờ xử lý</div>
        ) : (
          // PO | SKU | Số lượng vật tư | Hạn giao | Trạng thái — mọi kho
          <div style={tableWrap}>
            <table style={tbl}>
              <colgroup>
                <col style={{ width: 130 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 110 }} /><col style={{ width: 130 }} />
              </colgroup>
              <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>PO</th>
                <th style={th}>SKU</th>
                <th style={{ ...th, textAlign: 'right' }}>Số lượng vật tư</th>
                <th style={th}>Hạn giao</th>
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
                      <td style={{ ...td, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{order.deadline ? format(new Date(order.deadline), 'dd/MM/yyyy') : '—'}</td>
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
                <th style={th}>Mã PI</th>
                <th style={th}>Vật tư</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>SL nhập</th>
              </tr></thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{format(new Date(t.date), 'HH:mm · dd/MM')}</td>
                    <td style={{ ...td, fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' }}>{t.orderRef}</td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{t.materialName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{t.unit}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: ACCENT }}>+{t.qty.toLocaleString('vi-VN')}</td>
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

