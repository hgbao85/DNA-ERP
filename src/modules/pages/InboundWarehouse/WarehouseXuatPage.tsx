'use client'
import { useState, useEffect } from 'react'
import { ArrowUpFromLine, ChevronLeft, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BePieceTransferPlanItem } from '../../../services/warehouse-transfers-api'
import { TRANSFER_ROUTES, canSendFrom } from '../../../types/warehouse-transfer'
import { safeArr } from '../../../utils/array'
import { errMsg } from '../../../utils/errors'
import { compactTh as th, compactTd as td, tableWrap, tbl, row, badge, emptyBox } from '../../../styles/table'
import { backBtn, tabBtn } from '../../../styles/buttons'

interface Wh { id: string; name: string; code: string }

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
  piCode?: string
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
  // plannedQty > 0 bắt buộc - tránh 1 dòng chưa hề bắt đầu (plannedQty=confirmedQty=0, vd mảnh
  // "phoi-son-han" chưa qua KCS lần nào) bị tính "đủ" (0 >= 0) khiến cả PO hiện nhầm "Hoàn thành".
  return order.lines.length > 0 && order.lines.every(l => l.plannedQty > 0 && l.confirmedQty >= l.plannedQty) ? 'da' : 'cho'
}

const STATUS: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  cho: { label: 'Chờ xử lý',  color: '#92400e', bg: '#fef3c7' },
  da:  { label: 'Hoàn thành', color: '#166534', bg: '#dcfce7' },
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const L = (id: string, materialName: string, unit: string, plannedQty: number, availableQty = plannedQty): OrderLine =>
  ({ id, materialName, unit, plannedQty, availableQty, confirmedQty: 0, inputQty: '' })

// Kho phôi sơn hàn: "Lệnh SX (PO)" liệt kê KHUNG (mảnh vừa gia công/sơn xong theo từng PI) cần xuất
// nội bộ sang kho vật tư thành phẩm. Số lượng khớp với tồn kho "Khung..." đã seed (id 95) để lúc xác
// nhận, tồn kho khả dụng thật và số hiển thị ở đây khớp nhau.
// Kho vật tư thành phẩm: KHÔNG còn xuất mảnh nội bộ (mảnh chưa đan giờ đi qua "Xuất đan" tới điểm đan
// ngoài — xem KhoXuatDanPage.tsx) — "Lệnh SX (PO)" ở đây chỉ xuất vật tư thành phẩm cho kho thành phẩm.
const MOCK: Record<string, Order[]> = {
  'phoi-son-han': [
    {
      id: 'pi-2026-001', ref: 'PI-2026-001', counterpart: 'Kho Vật tư thành phẩm', date: '2026-06-28',
      poNumber: 'PI-2026-001', skuCode: 'JSE-55', skuName: 'Ghế J55', piCode: 'PI-2026-001',
      lines: [
        L('l1', 'Khung JSE-55 — PI-2026-001', 'cái', 80, 80),
      ],
    },
  ],
  'vat-tu-tp': [
    {
      id: 'pi-2026-002', ref: 'PI-2026-002', counterpart: 'Kho Thành phẩm', date: '2026-06-29',
      poNumber: 'PI-2026-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3', piCode: 'PI-2026-002',
      lines: [
        L('l1', 'Tem nhãn sản phẩm — PI-2026-002', 'tờ', 500, 500),
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

// Piece transfer (mảnh/vật tư thành phẩm) chỉ áp dụng cho chặng phoi-son-han → vat-tu-tp - đơn
// vị là PO (không phải PI, xem docs/review-2026-08-17-sanxuat-stage-v16-va-chuyen-kho-manh.md
// mục 6/7 ở BE). Chặng vat-tu-tp → thanh-pham vẫn dùng vật tư tiêu hao tự do (mock) như cũ.
const PIECE_TRANSFER_SCOPE = 'phoi-son-han'

function pieceLabelToUnit(label: BePieceTransferPlanItem['label']): string {
  return label === 'MANH' ? 'Mảnh' : 'Vật tư TP'
}

// item.readyQty/suggestedQty/transferredQty map vào đúng plannedQty/availableQty/confirmedQty
// sẵn có của OrderLine (không cần shape riêng) - "Kế hoạch" ở đây đọc là "đã qua KCS tính đến
// nay", "Thực có" đọc là "còn có thể chuyển" (đã trừ phần đã nằm trong phiếu PENDING/CONFIRMED
// trước đó - xem WarehouseTransfersService.getPieceTransferPlan ở BE).
function pieceItemsToOrders(summaries: { id: string; poNumber: string; salesOrderCode: string | null }[], plan: BePieceTransferPlanItem[]): Order[] {
  const byPo = new Map<string, BePieceTransferPlanItem[]>()
  for (const item of plan) {
    const arr = byPo.get(item.productionOrderId) ?? []
    arr.push(item)
    byPo.set(item.productionOrderId, arr)
  }
  return summaries
    .filter(o => (byPo.get(o.id)?.length ?? 0) > 0)
    .map(o => {
      const items = byPo.get(o.id) ?? []
      const displayCode = o.salesOrderCode ?? '—'
      return {
        id: o.id,
        ref: displayCode,
        counterpart: 'Kho Vật tư thành phẩm',
        date: new Date().toISOString(),
        poNumber: displayCode,
        skuName: items[0]?.productName,
        lines: items.map(it => ({
          id: it.pieceId,
          materialName: `${it.pieceCode} — ${it.pieceName}`,
          unit: pieceLabelToUnit(it.label),
          plannedQty: it.readyQty,
          availableQty: it.suggestedQty,
          confirmedQty: it.transferredQty,
          inputQty: '',
        })),
      }
    })
}

export default function WarehouseXuatPage({ scope }: { scope: string }) {
  const isPieceScope = scope === PIECE_TRANSFER_SCOPE

  const [orders, setOrders]         = useState<Order[]>(() => isPieceScope ? [] : (MOCK[scope] ?? []))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [txns, setTxns]             = useState<Txn[]>([])
  const [view, setView]             = useState<'orders' | 'history'>('orders')

  // Kho này có nằm trong chuỗi chuyển kho nội bộ không (phôi sơn hàn, vật tư thành phẩm) —
  // nếu có, nút "Xác nhận" ở bảng dưới sẽ tạo phiếu chuyển kho nội bộ thật thay vì chỉ cập nhật cục bộ.
  const { data: warehouses } = useFetch<Wh[]>(() => api.getWarehouses(), [])
  const myWarehouse = safeArr(warehouses).find(w => w.code === scope) ?? null
  const nextHopCode = myWarehouse ? TRANSFER_ROUTES[myWarehouse.code] : undefined
  const nextHopWh = safeArr(warehouses).find(w => w.code === nextHopCode) ?? null
  const isInternalChain = canSendFrom(scope) && !!myWarehouse && !!nextHopWh

  // Danh sách PO + kế hoạch chuyển thật (mảnh/vật tư TP) — thay MOCK cho đúng chặng phoi-son-han.
  const { data: pieceOrders, refetch: refetchPieceOrders } = useFetch<Order[]>(async () => {
    if (!isPieceScope) return []
    const summaries = await api.listProductionOrdersForStage()
    if (summaries.length === 0) return []
    const plan = await api.getPieceTransferPlan(summaries.map(o => o.id))
    return pieceItemsToOrders(summaries, plan)
  }, [isPieceScope])

  // Merge dữ liệu vừa fetch vào state cục bộ, giữ nguyên inputQty đang gõ dở của từng dòng (cùng
  // idiom TwoTierScreen ở components/sanxuat/core.tsx - merge đè lên overlay cục bộ khi refetch).
  useEffect(() => {
    if (!isPieceScope) return
    const next = pieceOrders ?? []
    setOrders(prev => next.map(o => {
      const old = prev.find(p => p.id === o.id)
      if (!old) return o
      return { ...o, lines: o.lines.map(l => {
        const oldLine = old.lines.find(pl => pl.id === l.id)
        return oldLine ? { ...l, inputQty: oldLine.inputQty } : l
      }) }
    }))
  }, [pieceOrders, isPieceScope])

  const [transferBusyLine, setTransferBusyLine] = useState<string | null>(null)
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({})

  const selected = orders.find(o => o.id === selectedId) ?? null

  const confirmLine = async (orderId: string, lineId: string) => {
    const order = orders.find(o => o.id === orderId)
    const line = order?.lines.find(l => l.id === lineId)
    if (!order || !line) return
    const raw = Math.max(0, Number(line.inputQty) || 0)
    if (raw <= 0) return
    const qty = Math.min(raw, line.availableQty)
    if (qty <= 0) return

    // Chặng phoi-son-han: tạo phiếu chuyển kho piece-only thật (mảnh/vật tư TP theo PO), số lượng
    // đã được BE tự clamp theo kế hoạch (đã qua KCS trừ đã chuyển trước đó) tại thời điểm tạo.
    if (isPieceScope && myWarehouse && nextHopWh) {
      setTransferBusyLine(lineId)
      setTransferErrors(prev => ({ ...prev, [lineId]: '' }))
      try {
        await api.createPieceWarehouseTransfer({
          fromWarehouseId: myWarehouse.id,
          toWarehouseId: nextHopWh.id,
          pieceItems: [{ productionOrderId: order.id, pieceId: line.id, quantity: qty }],
        })
      } catch (e) {
        setTransferErrors(prev => ({ ...prev, [lineId]: errMsg(e, 'Không thể tạo phiếu chuyển kho nội bộ') }))
        setTransferBusyLine(null)
        return
      }
      setTxns(t => [{
        id: `txn-${Date.now()}-${lineId}`, orderRef: order.ref,
        materialName: line.materialName, unit: line.unit, qty, date: new Date().toISOString(),
      }, ...t])
      setTransferBusyLine(null)
      refetchPieceOrders() // đọc lại suggestedQty/transferredQty thật từ BE thay vì tự trừ cục bộ
      return
    }

    // Kho thuộc chuỗi chuyển kho nội bộ (vat-tu-tp → thanh-pham): "Xác nhận" = tạo phiếu chuyển
    // kho thật sang kho kế tiếp, tồn kho chỉ đổi sau khi kho nhận xác nhận.
    if (isInternalChain && myWarehouse && nextHopWh) {
      setTransferBusyLine(lineId)
      setTransferErrors(prev => ({ ...prev, [lineId]: '' }))
      try {
        await api.createWarehouseTransfer({
          fromWarehouseId: myWarehouse.id,
          toWarehouseId: nextHopWh.id,
          items: [{ materialName: line.materialName, unit: line.unit, quantity: qty }],
          // BE không có field piCode riêng (chỉ note tự do hoặc planFormId thật) - giữ lại thông
          // tin PI cho thủ kho nhận hàng thấy được bằng cách nhồi vào note, dán nhãn rõ ràng thay
          // vì giả vờ đây là 1 field có cấu trúc.
          note: order.piCode ? `PI: ${order.piCode}` : undefined,
        })
      } catch (e) {
        setTransferErrors(prev => ({ ...prev, [lineId]: errMsg(e, 'Không thể tạo phiếu chuyển kho nội bộ') }))
        setTransferBusyLine(null)
        return
      }
      setTransferBusyLine(null)
    }

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      return {
        ...o,
        lines: o.lines.map(l => {
          if (l.id !== lineId) return l
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

        {isInternalChain && nextHopWh && (
          <div style={{ marginBottom: 14, padding: '8px 14px', background: '#ede7f6', border: '1px solid #d1c4e9', borderRadius: 8, fontSize: 12, color: '#4527a0' }}>
            Bấm &quot;Xác nhận&quot; sẽ tạo phiếu chuyển kho nội bộ sang <strong>{nextHopWh.name}</strong> — tồn kho chỉ cập nhật sau khi kho nhận xác nhận.
          </div>
        )}

        {/* 7-column xuất table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col style={{ width: 56 }} /><col style={{ width: 84 }} /><col style={{ width: 72 }} /><col style={{ width: 72 }} /><col style={{ width: 72 }} /><col style={{ width: 170 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>{isPieceScope ? 'Mảnh / Vật tư TP' : 'Vật tư'}</th>
                <th style={th}>{isPieceScope ? 'Loại' : 'ĐVT'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{isPieceScope ? 'Đã qua KCS' : 'Kế hoạch'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{isPieceScope ? 'Có thể chuyển' : 'Thực có'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{isPieceScope ? 'Đã chuyển' : 'Đã xuất'}</th>
                <th style={{ ...th, textAlign: 'right' }}>Còn lại</th>
                <th style={th}>Xuất</th>
              </tr>
            </thead>
            <tbody>
              {selected.lines.map(l => {
                // plannedQty > 0 bắt buộc - cùng lý do getStatus() (tránh dòng chưa hề bắt đầu bị
                // tính "đủ" do 0 >= 0).
                const done      = l.plannedQty > 0 && l.confirmedQty >= l.plannedQty
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
                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{isPieceScope ? 'Chưa có hàng' : 'Hết hàng'}</span>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number" min={1} max={l.availableQty} value={l.inputQty}
                              onChange={e => updateInput(selected.id, l.id, e.target.value)}
                              placeholder="SL"
                              disabled={transferBusyLine === l.id}
                              style={{ width: 72, padding: '4px 8px', border: `1px solid ${overAvail ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                            />
                            <button onClick={() => confirmLine(selected.id, l.id)} disabled={!can || transferBusyLine === l.id}
                              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: can ? ACCENT : 'var(--surface2)', color: can ? '#fff' : 'var(--text3)', cursor: can && transferBusyLine !== l.id ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                              {transferBusyLine === l.id ? 'Đang gửi...' : 'Xác nhận'}
                            </button>
                          </div>
                          {transferErrors[l.id] && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{transferErrors[l.id]}</div>
                          )}
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
              {v === 'orders' ? 'Xuất kho' : 'Lịch sử'}
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

