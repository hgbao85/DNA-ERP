'use client'
import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { ArrowUpFromLine, Check, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import type { Sku } from '../../../types/sku'
import type { BeStockQuant } from '../../../services/stock-api'
import LoadingState from '../../../components/LoadingState'
import { compactTh as th, compactTd as td } from '../../../styles/table'
import { flattenManhSteel, combinedDaySon, dinhItems } from '../../../utils/manhMaterials'

// ── Xuất kho flow types ──────────────────────────────────────
interface XuatLine {
  id: string
  name: string
  spec: string | null
  purchased: number   // SL đã mua (mock từ propose flow)
  exported: number    // SL đã xuất (tích lũy)
  inputQty: string
}

type XuatStatus = 'cho-xuat' | 'dang-xuat' | 'da-xuat'

const STATUS_XUAT: Record<XuatStatus, { label: string; color: string; bg: string }> = {
  'cho-xuat':  { label: 'Chờ xuất',  color: '#92400e', bg: '#fef3c7' },
  'dang-xuat': { label: 'Đang xuất', color: '#1e40af', bg: '#dbeafe' },
  'da-xuat':   { label: 'Đã xuất',   color: '#166534', bg: '#dcfce7' },
}

// Tồn kho materialize từ mọi kho (GET /stock-quant, không lọc warehouseId - trang này không có
// scope 1 kho cụ thể, xem InboundWarehouseApp.tsx dùng XuatKhoPage làm fallback "Tổng kho" khi
// !scope). Cộng dồn theo materialId - 1 vật tư có thể tồn ở nhiều kho vật lý cùng lúc.
function buildStockByMaterial(quants: BeStockQuant[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const q of quants) {
    if (!q.materialId) continue
    map.set(q.materialId, (map.get(q.materialId) ?? 0) + q.qty)
  }
  return map
}

function flattenXuatLines(pf: Sku, stockByMaterial: Map<string, number>): XuatLine[] {
  const lines: XuatLine[] = []
  const mt = pf.quotaManagement?.materialType
  if (!mt) return lines
  const push = (cat: string, arr: any[]) =>
    arr.forEach((item: any, i: number) => {
      const required = item.quantity != null ? Number(item.quantity) : item.kg != null ? Number(item.kg) : null
      // Tồn kho thật theo materialId - null nếu dòng này chưa gắn materialId thật (dữ liệu định
      // mức cũ nhập tay chỉ có tên tự do, không có gì để tra cứu thật). KHÔNG bịa số khi thiếu
      // materialId (khác trước đây dùng mockStock() băm theo tên - luôn ra 1 số giả).
      const stock: number | null = item.materialId ? (stockByMaterial.get(item.materialId) ?? 0) : null
      const purchased = required != null && stock != null && stock < required ? required - stock : 0
      lines.push({
        id: `${pf.id}-${cat}-${i}`,
        name: item.name,
        spec: [item.specifications, item.thickness != null ? `dày ${item.thickness}mm` : null].filter(Boolean).join(', ') || null,
        purchased,
        exported: 0,
        inputQty: '',
      })
    })
  push('sat',  flattenManhSteel(pf))
  push('day',  combinedDaySon(pf))
  push('dinh', dinhItems(pf))
  if (Array.isArray(mt.vatTuPhuKien)) push('vtpk', mt.vatTuPhuKien)
  if (Array.isArray(mt.baoBiDongGoi)) push('bbdg', mt.baoBiDongGoi)
  return lines.filter(l => l.purchased > 0)
}

function computeXuatStatus(lines: XuatLine[]): XuatStatus {
  if (lines.length === 0 || lines.every(l => l.exported === 0)) return 'cho-xuat'
  if (lines.every(l => l.exported >= l.purchased)) return 'da-xuat'
  return 'dang-xuat'
}

// ── XuatKhoSection: list PO → detail xuất ───────────────────
function XuatKhoSection() {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const { data: stockQuants } = useFetch<BeStockQuant[]>(() => api.getStockQuants(), [])
  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)
  const [lines, setLines] = useState<XuatLine[]>([])
  const [xuatStatus, setXuatStatus] = useState<Record<number, XuatStatus>>({})

  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT')
  const stockByMaterial = buildStockByMaterial(stockQuants ?? [])

  const openDetail = (pf: Sku) => {
    setSelectedPf(pf)
    setLines(flattenXuatLines(pf, stockByMaterial))
  }

  const confirmLine = (lineId: string) => {
    setLines(prev => {
      const updated = prev.map(l => {
        if (l.id !== lineId) return l
        const qty = Math.max(0, Number(l.inputQty) || 0)
        return { ...l, exported: l.exported + qty, inputQty: '' }
      })
      if (selectedPf) setXuatStatus(p => ({ ...p, [selectedPf.id]: computeXuatStatus(updated) }))
      return updated
    })
  }

  // ── Detail view ──────────────────────────────────────────
  if (selectedPf) {
    const pfStatus = xuatStatus[selectedPf.id] ?? 'cho-xuat'
    const cfg = STATUS_XUAT[pfStatus]
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSelectedPf(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
            >
              <ChevronLeft size={15} /> Quay lại
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {selectedPf.mfgProduct?.factoryCode}
                {selectedPf.mfgProduct?.name && (
                  <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>— {selectedPf.mfgProduct.name}</span>
                )}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
                PO: {selectedPf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng'}
                {selectedPf.exportOrder?.deliveryDate && (
                  <> · Hạn giao: {format(new Date(selectedPf.exportOrder.deliveryDate), 'dd/MM/yyyy')}</>
                )}
              </div>
            </div>
          </div>
          <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, color: cfg.color, background: cfg.bg, alignSelf: 'center' }}>
            {cfg.label}
          </span>
        </div>

        {lines.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}>
            Không có vật tư nào cần xuất kho cho SKU này
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: 170 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 170 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>Tên vật tư</th>
                  <th style={th}>Quy cách</th>
                  <th style={{ ...th, textAlign: 'right' }}>SL đã mua</th>
                  <th style={{ ...th, textAlign: 'right' }}>Đã xuất</th>
                  <th style={th}>Xuất</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const done = line.exported >= line.purchased
                  const partial = line.exported > 0 && !done
                  const canConfirm = !!line.inputQty && Number(line.inputQty) > 0
                  return (
                    <tr key={line.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {line.name}
                      </td>
                      <td style={{ ...td, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {line.spec ?? '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{line.purchased}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? '#16a34a' : partial ? '#d97706' : 'var(--text)' }}>
                        {line.exported}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number" min={1}
                            value={line.inputQty}
                            onChange={e => setLines(prev => prev.map(l => l.id === line.id ? { ...l, inputQty: e.target.value } : l))}
                            placeholder="SL"
                            style={{ width: 64, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                          />
                          <button
                            onClick={() => confirmLine(line.id)}
                            disabled={!canConfirm}
                            style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: canConfirm ? '#e65100' : 'var(--surface2)', color: canConfirm ? '#fff' : 'var(--text3)', cursor: canConfirm ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                          >Xác nhận</button>
                        </div>
                      </td>
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

  // ── List view ────────────────────────────────────────────
  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Chọn PO để xuất vật tư ra khỏi kho
      </div>
      {isLoading ? <LoadingState /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 140 }} />
              <col />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>PO</th>
                <th style={th}>SKU</th>
                <th style={th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {active.map(pf => {
                const status = xuatStatus[pf.id] ?? 'cho-xuat'
                const cfg = STATUS_XUAT[status]
                return (
                  <tr
                    key={pf.id}
                    onClick={() => openDetail(pf)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng'}
                    </td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                      {pf.mfgProduct?.name && (
                        <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{pf.mfgProduct.name}</>
                      )}
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {active.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    Không có PO nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────
export default function XuatKhoPage({ lockedGroup: _lockedGroup }: { lockedGroup?: string | null } = {}) {
  const [xuatTab, setXuatTab] = useState<'xuat' | 'history'>('xuat')

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Xuất kho</h2>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([
          ['xuat',    'Xuất vật tư/thành phẩm',           ArrowUpFromLine],
          ['history', 'Lịch sử xuất kho',   Check],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setXuatTab(id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', fontSize: 13, fontWeight: xuatTab === id ? 700 : 500,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: xuatTab === id ? '#e65100' : 'var(--text2)',
            borderBottom: xuatTab === id ? '2px solid #e65100' : '2px solid transparent',
            marginBottom: -1,
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {xuatTab === 'xuat'    && <XuatKhoSection />}
      {xuatTab === 'history' && <LichSuXuatSection />}
    </div>
  )
}

// ── LichSuXuatSection ─────────────────────────────────────────
// Thay MOCK_HISTORY cũ bằng stock_ledger thật (cùng nguồn MfgWarehousesPage.tsx đã dùng) — gộp cả
// 3 kho trong chuỗi chuyển nội bộ (phoi-son-han → vat-tu-tp → thanh-pham). BeStockLedgerEntry
// không có cột PO/người xuất (mock cũ bịa ra) nên bảng đổi cột theo đúng dữ liệu thật có: kho
// nguồn→đích, vật tư, SL, loại bút toán (refType), ghi chú.
const REF_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  WAREHOUSE_TRANSFER: { label: 'Chuyển kho',      color: '#1e40af', bg: '#dbeafe' },
  MATERIAL_ISSUE:     { label: 'Xuất vật tư',     color: '#b45309', bg: '#fef3c7' },
  SEGMENT_CONSUME:    { label: 'Tiêu hao đoạn',   color: '#065f46', bg: '#d1fae5' },
  FRAME_OUTPUT:       { label: 'Ra khung',        color: '#0e7490', bg: '#cffafe' },
  FINISHED:           { label: 'Ra thành phẩm',   color: '#166534', bg: '#dcfce7' },
  ADJUST:             { label: 'Điều chỉnh tay',  color: '#6b21a8', bg: '#f3e8ff' },
}

function LichSuXuatSection() {
  const { data: warehouses } = useFetch(() => api.getWarehouses(), [])
  const relevantCodes = ['phoi-son-han', 'vat-tu-tp', 'thanh-pham']
  const relevantIds = (warehouses ?? []).filter(w => relevantCodes.includes(w.code)).map(w => w.id)
  const { data: entries, isLoading } = useFetch(
    () => Promise.all(relevantIds.map(warehouseId => api.getStockLedger({ warehouseId }))).then(lists => lists.flat()),
    [relevantIds.join(',')],
  )
  const rows = [...(entries ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Các lần xuất kho vật tư, thành phẩm và mảnh (kho Phôi-Sơn-Hàn / Vật tư thành phẩm / Thành phẩm)
      </div>
      {isLoading ? <LoadingState /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 100 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 200 }} />
              <col />
              <col style={{ width: 72 }} />
              <col />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Ngày</th>
                <th style={th}>Loại</th>
                <th style={th}>Kho nguồn → đích</th>
                <th style={th}>Vật tư</th>
                <th style={{ ...th, textAlign: 'right' }}>SL</th>
                <th style={th}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const meta = REF_TYPE_META[r.refType] ?? { label: r.refType, color: '#475569', bg: '#f1f5f9' }
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{r.fromWarehouseCode} → {r.toWarehouseCode}</td>
                    <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.materialCode ?? r.segmentSpecLabel ?? '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#e65100' }}>{r.qty}</td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>{r.note ?? '—'}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa có lần xuất kho nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

