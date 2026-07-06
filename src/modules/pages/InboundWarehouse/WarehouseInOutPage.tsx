'use client'
import { useState, useEffect } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useInspection, type PurchaseProposal } from '../../../context/InspectionContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = 'cho' | 'da'

interface OrderLine {
  id: string
  materialName: string
  unit: string
  plannedQty: number
  availableQty: number   // thực có trong kho (dùng cho xuất)
  confirmedQty: number
  inputQty: string
}

interface Order {
  id: string
  ref: string
  counterpart: string   // tên nhà cung cấp (nhập) hoặc tên lệnh SX (xuất)
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

// ── Status helpers ─────────────────────────────────────────────────────────────

function getOrderStatus(order: Order): OrderStatus {
  if (order.lines.every(l => l.confirmedQty >= l.plannedQty)) return 'da'
  return 'cho'
}

const STATUS_CFG: Record<'nhap' | 'xuat', Record<OrderStatus, { label: string; color: string; bg: string }>> = {
  nhap: {
    cho:  { label: 'Chờ nhập',    color: '#92400e', bg: '#fef3c7' },
    da:   { label: 'Hoàn thành',  color: '#166534', bg: '#dcfce7' },
  },
  xuat: {
    cho:  { label: 'Chờ xử lý',  color: '#92400e', bg: '#fef3c7' },
    da:   { label: 'Hoàn thành', color: '#166534', bg: '#dcfce7' },
  },
}

// ── Mock data theo scope ───────────────────────────────────────────────────────

function makeMockOrders(mode: 'nhap' | 'xuat', scope: string): Order[] {
  const line = (id: string, materialName: string, unit: string, plannedQty: number, availableQty = plannedQty): OrderLine =>
    ({ id, materialName, unit, plannedQty, availableQty, confirmedQty: 0, inputQty: '' })

  if (scope === 'phoi-son-han') {
    if (mode === 'nhap') return [
      {
        id: 'pi-psh-1', ref: 'PI-2507-001', counterpart: 'Thép Miền Nam Corp', date: '2025-07-01',
        poNumber: 'PO-MY-001', skuCode: 'JSE-55', skuName: 'Ghế J55', deadline: '2026-10-15',
        lines: [
          line('l1', 'Thép ống D25×1.5',     'm',  500),
          line('l2', 'Thép tấm dày 1.5mm',   'm²', 100),
          line('l3', 'Thép hộp 25×25×1.2mm', 'm',  200),
        ],
      },
      {
        id: 'pi-psh-2', ref: 'PI-2507-002', counterpart: 'Jotun Việt Nam', date: '2025-07-02',
        poNumber: 'PO-GP-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3', deadline: '2026-11-01',
        lines: [
          line('l1', 'Sơn tĩnh điện đen',      'kg', 80),
          line('l2', 'Sơn tĩnh điện trắng',    'kg', 60),
          line('l3', 'Sơn tĩnh điện nâu sồi', 'kg', 40),
        ],
      },
      {
        id: 'pi-psh-3', ref: 'PI-2507-003', counterpart: 'Kim Tín Hàn Việt', date: '2025-07-03',
        poNumber: 'PO-IK-003', skuCode: 'JSE-55', skuName: 'Ghế J55', deadline: '2026-12-20',
        lines: [
          line('l1', 'Que hàn điện 3.2mm', 'hộp',  20),
          line('l2', 'Dây hàn MIG 0.8mm',  'cuộn', 10),
          line('l3', 'Đĩa cắt sắt 105mm',  'cái',  100),
          line('l4', 'Đĩa mài sắt 125mm',  'cái',  80),
        ],
      },
    ]
    return [
      {
        id: 'po-psh-1', ref: 'PO-2507-001', counterpart: 'LSX GX-001', date: '2025-07-01',
        poNumber: 'PO-MY-001', skuCode: 'JSE-55', skuName: 'Ghế J55',
        lines: [
          line('l1', 'Thép ống D25×1.5',   'm',   300, 280),
          line('l2', 'Thép tấm dày 1.5mm', 'm²',   80,  90),
          line('l3', 'Sơn tĩnh điện đen',  'kg',   40,  35),
          line('l4', 'Que hàn điện 3.2mm', 'hộp',  10,  15),
        ],
      },
      {
        id: 'po-psh-2', ref: 'PO-2507-002', counterpart: 'LSX GX-004', date: '2025-07-02',
        poNumber: 'PO-GP-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3',
        lines: [
          line('l1', 'Thép hộp 25×25×1.2mm',  'm',  150, 120),
          line('l2', 'Thép tấm dày 1.5mm',    'm²',  50,  60),
          line('l3', 'Sơn tĩnh điện trắng',   'kg',  30,  25),
        ],
      },
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
        line('l1', 'Dây đan PE 2mm – trắng', 'm',   1500, 1800),
        line('l2', 'Ốc vít M6×20',           'cái',  400,  500),
        line('l3', 'Nhựa bịt đầu ống D25',  'cái',  200,  180),
        line('l4', 'Vòng đệm M6',            'cái',  400,  450),
      ]},
      { id: 'po-vt-2', ref: 'PO-2507-002', counterpart: 'LSX GX-004 · Bàn sắt PE Ø80 (50 cái)', date: '2025-07-02', lines: [
        line('l1', 'Dây đan PE 2mm – ghi xám', 'm',   800, 700),
        line('l2', 'Bu lông M8×30',             'cái', 200, 250),
        line('l3', 'Đai ốc M6',                'cái', 200, 200),
      ]},
    ]
  }

  if (scope === 'thanh-pham') {
    if (mode === 'nhap') return [
      {
        id: 'pi-tp-1', ref: 'PI-2507-006', counterpart: 'Dây chuyền SX – Lô 1', date: '2025-07-01',
        poNumber: 'LSX-2507-001', skuCode: 'GHE-PE', skuName: 'Ghế sắt mặt đan PE', deadline: '2026-07-30',
        lines: [
          line('l1', 'Ghế sắt mặt đan PE – trắng',    'cái', 50),
          line('l2', 'Ghế sắt mặt đan PE – đen',      'cái', 30),
          line('l3', 'Ghế sắt mặt đan PE – xanh lam', 'cái', 20),
        ],
      },
      {
        id: 'pi-tp-2', ref: 'PI-2507-007', counterpart: 'Dây chuyền SX – Lô 2', date: '2025-07-03',
        poNumber: 'LSX-2507-002', skuCode: 'BAN-NGOAI', skuName: 'Bàn/Ghế ngoài trời', deadline: '2026-08-15',
        lines: [
          line('l1', 'Bàn sắt mặt đan PE tròn Ø80', 'cái', 20),
          line('l2', 'Ghế xếp compact',              'cái', 40),
          line('l3', 'Bộ bàn ghế ngoài trời 4 chỗ', 'bộ',  10),
        ],
      },
    ]
    return [
      {
        id: 'po-tp-1', ref: 'ĐH-2507-001', counterpart: 'Nội thất Hải Phòng', date: '2025-07-01',
        poNumber: 'ĐH-2507-001', skuCode: 'GHE-PE', skuName: 'Ghế sắt mặt đan PE',
        lines: [
          line('l1', 'Ghế sắt mặt đan PE – trắng',    'cái', 50, 45),
          line('l2', 'Bàn sắt mặt đan PE tròn Ø80',  'cái', 10, 12),
          line('l3', 'Bao bì carton 5 lớp',           'cái', 60, 80),
        ],
      },
      {
        id: 'po-tp-2', ref: 'ĐH-2507-002', counterpart: 'Sunshine Outdoor SG', date: '2025-07-03',
        poNumber: 'ĐH-2507-002', skuCode: 'SET-OUTDOOR', skuName: 'Bộ bàn ghế ngoài trời',
        lines: [
          line('l1', 'Ghế sắt mặt đan PE – đen',     'cái', 80, 75),
          line('l2', 'Bộ bàn ghế ngoài trời 4 chỗ', 'bộ',  15, 10),
          line('l3', 'Bao bì carton 5 lớp',          'cái', 80, 100),
          line('l4', 'Màng PE bọc sản phẩm',         'cuộn', 5,   6),
        ],
      },
    ]
  }

  return []
}

// ── Purchasing proposal → nhập kho order ──────────────────────────────────────

const KHO_SCOPE: Record<string, string> = {
  'Kho Phôi Sơn Hàn': 'phoi-son-han',
  'Kho Vật tư thành phẩm': 'vat-tu-tp',
  'Kho Thành Phẩm': 'thanh-pham',
}

function proposalToNhapOrder(p: PurchaseProposal, scope: string): Order | null {
  const scopeItems = p.items.filter(item => KHO_SCOPE[item.khoLabel] === scope)
  if (scopeItems.length === 0) return null
  const suppliers = [...new Set(
    scopeItems.map(item => p.chosenSuppliers?.[item.name]).filter((x): x is string => !!x)
  )]
  return {
    id: `prop-order-${p.id}`,
    ref: p.poNumber,
    counterpart: suppliers.join(' · ') || '—',
    date: (p.approvedAt ?? p.createdAt).slice(0, 10),
    poNumber: p.poNumber,
    skuCode: p.skuCode,
    skuName: p.skuName,
    deadline: p.deadline,
    lines: scopeItems.map((item, i) => ({
      id: `${p.id}-line-${i}`,
      materialName: item.name,
      unit: item.unit,
      plannedQty: item.buyQty,
      availableQty: item.buyQty,
      confirmedQty: 0,
      inputQty: '',
    })),
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  mode: 'nhap' | 'xuat'
  scope: string
}

export default function WarehouseInOutPage({ mode, scope }: Props) {
  const { proposals } = useInspection()
  const [orders, setOrders]         = useState<Order[]>(() => makeMockOrders(mode, scope))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [txns, setTxns]             = useState<Txn[]>([])
  const [view, setView]             = useState<'orders' | 'history'>('orders')

  // When a proposal reaches 'purchasing', inject it as a nhập kho order for the relevant scope
  useEffect(() => {
    if (mode !== 'nhap') return
    const propOrders = proposals
      .filter(p => p.status === 'purchasing')
      .map(p => proposalToNhapOrder(p, scope))
      .filter((o): o is Order => o !== null)
    if (propOrders.length === 0) return
    setOrders(prev => {
      const newOnes = propOrders.filter(po => !prev.some(o => o.id === po.id))
      return newOnes.length > 0 ? [...prev, ...newOnes] : prev
    })
  }, [proposals, mode, scope])

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
        const raw = Math.max(0, Number(l.inputQty) || 0)
        if (raw <= 0) return l
        const effectiveQty = mode === 'xuat' ? Math.min(raw, l.availableQty) : raw
        if (effectiveQty <= 0) return l
        setTxns(t => [{
          id:           `txn-${Date.now()}-${lineId}`,
          orderRef:     o.ref,
          materialName: l.materialName,
          unit:         l.unit,
          qty:          effectiveQty,
          date:         new Date().toISOString(),
        }, ...t])
        return {
          ...l,
          confirmedQty: l.confirmedQty + effectiveQty,
          availableQty: mode === 'xuat' ? l.availableQty - effectiveQty : l.availableQty,
          inputQty: '',
        }
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
    const cfg = STATUS_CFG[mode][status]
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
              {(scope === 'phoi-son-han' || scope === 'thanh-pham') && selected.poNumber ? (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text3)' }}>{selected.poNumber}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)', marginLeft: 10 }}>{selected.skuCode}</span>
                    {selected.skuName && <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6, fontSize: 15 }}>— {selected.skuName}</span>}
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
                    {selected.deadline && <>Deadline: <strong style={{ color: 'var(--text2)' }}>{format(new Date(selected.deadline), 'dd/MM/yyyy')}</strong> · </>}
                    {mode === 'nhap' ? 'NCC' : 'Đối tác'}: {selected.counterpart}
                    {' · '}{selected.lines.length} mặt hàng
                    {' · '}đã xác nhận {selected.lines.filter(l => l.confirmedQty > 0).length}/{selected.lines.length} dòng
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    <span style={{ color: accent }}>{selected.ref}</span>
                    <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 8, fontSize: 15 }}>{selected.counterpart}</span>
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
                    Ngày: {format(new Date(selected.date), 'dd/MM/yyyy')}
                    {' · '}{selected.lines.length} vật tư
                    {' · '}đã xác nhận {selected.lines.filter(l => l.confirmedQty > 0).length}/{selected.lines.length} dòng
                  </div>
                </>
              )}
            </div>
          </div>
          <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20, color: cfg.color, background: cfg.bg, alignSelf: 'center' }}>
            {cfg.label}
          </span>
        </div>

        {/* Lines table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            {mode === 'xuat' ? (
              <colgroup>
                <col />
                <col style={{ width: 56 }} />
                <col style={{ width: 84 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 170 }} />
              </colgroup>
            ) : (
              <colgroup>
                <col />
                <col style={{ width: 56 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 186 }} />
              </colgroup>
            )}
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Vật tư</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>Kế hoạch</th>
                {mode === 'xuat' && <th style={{ ...th, textAlign: 'right' }}>Thực có</th>}
                <th style={{ ...th, textAlign: 'right' }}>{mode === 'nhap' ? 'Đã xác nhận' : 'Đã xuất'}</th>
                {mode === 'xuat' && <th style={{ ...th, textAlign: 'right' }}>Còn lại</th>}
                <th style={th}>{mode === 'nhap' ? 'Nhập' : 'Xuất'}</th>
              </tr>
            </thead>
            <tbody>
              {selected.lines.map(line => {
                const done       = line.confirmedQty >= line.plannedQty
                const partial    = line.confirmedQty > 0 && !done
                const conLai     = line.plannedQty - line.confirmedQty
                const noStock    = mode === 'xuat' && line.availableQty <= 0
                const inputNum   = Number(line.inputQty)
                const overAvail  = mode === 'xuat' && !!line.inputQty && inputNum > line.availableQty
                const canConfirm = !!line.inputQty && inputNum > 0 && !overAvail
                return (
                  <tr key={line.id} style={{ borderTop: '1px solid var(--border)', background: done ? 'rgba(22,101,52,.04)' : undefined }}>
                    <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {line.materialName}
                    </td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{line.unit}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{line.plannedQty.toLocaleString('vi-VN')}</td>
                    {mode === 'xuat' && (
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: line.availableQty > 0 ? '#2563eb' : '#dc2626' }}>
                        {line.availableQty.toLocaleString('vi-VN')}
                      </td>
                    )}
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? '#16a34a' : partial ? '#d97706' : 'var(--text)' }}>
                      {done && <span style={{ marginRight: 4, fontSize: 11 }}>✓</span>}
                      {line.confirmedQty.toLocaleString('vi-VN')}
                    </td>
                    {mode === 'xuat' && (
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: conLai > 0 ? '#d97706' : '#16a34a' }}>
                        {conLai.toLocaleString('vi-VN')}
                      </td>
                    )}
                    <td style={td}>
                      {done ? (
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã xong</span>
                      ) : noStock ? (
                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Hết hàng</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number" min={1} max={mode === 'xuat' ? line.availableQty : undefined}
                            value={line.inputQty}
                            onChange={e => updateInput(selected.id, line.id, e.target.value)}
                            placeholder="SL"
                            style={{ width: 72, padding: '4px 8px', border: `1px solid ${overAvail ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
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
        ) : (scope === 'phoi-son-han' || scope === 'thanh-pham') ? (
          /* ── Phôi Sơn Hàn / Thành Phẩm: PO / SKU / Số lượng / [Deadline nhập] / Trạng thái ── */
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 120 }} />
                <col />
                <col style={{ width: 80 }} />
                {mode === 'nhap' && <col style={{ width: 110 }} />}
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>PO</th>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign: 'right' }}>Số lượng vật tư</th>
                  {mode === 'nhap' && <th style={th}>Deadline</th>}
                  <th style={th}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const status = getOrderStatus(order)
                  const cfg = STATUS_CFG[mode][status]
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ ...td, fontWeight: 700, color: 'var(--text3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {order.poNumber ?? '—'}
                      </td>
                      <td style={{ ...td, overflow: 'hidden' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 600 }}>{order.skuCode ?? '—'}</span>
                          {order.skuName && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{order.skuName}</span>}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{order.lines.length}</td>
                      {mode === 'nhap' && (
                        <td style={{ ...td, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                          {order.deadline ? format(new Date(order.deadline), 'dd/MM/yyyy') : '—'}
                        </td>
                      )}
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
        ) : (
          /* ── Default list view ── */
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
                  const cfg = STATUS_CFG[mode][status]
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
