'use client'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { PlanForm } from '../../../types/plan-form'
import LoadingState from '../../../components/LoadingState'
import { listTh as thStyle, listTd as tdStyle } from '../../../styles/table'

interface StockLine {
  id: string
  name: string
  spec: string | null
  required: number | null
  stock: number
  checked: boolean
}

type InvStatus = 'cho-kiem' | 'cho-mua' | 'da-mua'

const STATUS_CFG: Record<InvStatus, { label: string; color: string; bg: string }> = {
  'cho-kiem': { label: 'Chờ kiểm', color: '#92400e', bg: '#fef3c7' },
  'cho-mua':  { label: 'Chờ mua',  color: '#991b1b', bg: '#fee2e2' },
  'da-mua':   { label: 'Đã mua',   color: '#166534', bg: '#dcfce7' },
}

function mockStock(name: string, required: number | null): number {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const base = required ?? 10
  // ~1 in 5 items sẽ thiếu hàng để demo rõ cả 2 tình huống
  return hash % 5 === 0
    ? Math.floor(base * 0.6)
    : Math.ceil(base * (1.1 + (hash % 4) * 0.25))
}

function flattenMaterial(pf: PlanForm): StockLine[] {
  const lines: StockLine[] = []
  const mt = pf.quotaManagement?.materialType
  if (!mt) return lines
  const push = (cat: string, arr: any[]) =>
    arr.forEach((item: any, i: number) => {
      const required =
        item.quantity != null ? Number(item.quantity) :
        item.kg       != null ? Number(item.kg)       : null
      lines.push({
        id: `${pf.id}-${cat}-${i}`,
        name: item.name,
        spec: [
          item.specifications,
          item.thickness != null ? `dày ${item.thickness}mm` : null,
        ].filter(Boolean).join(', ') || null,
        required,
        stock: mockStock(item.name, required),
        checked: false,
      })
    })
  if (Array.isArray(mt.sat))          push('sat',  mt.sat)
  if (Array.isArray(mt.daySon))       push('day',  mt.daySon)
  if (Array.isArray(mt.vatTuPhuKien)) push('vtpk', mt.vatTuPhuKien)
  if (Array.isArray(mt.baoBiDongGoi)) push('bbdg', mt.baoBiDongGoi)
  return lines
}

export default function KiemTraVatTuPage() {
  const { data: planForms = [], isLoading } = useFetch(() => api.getPlanForms(), [])
  const [selectedPf, setSelectedPf] = useState<PlanForm | null>(null)
  const [lines, setLines]           = useState<StockLine[]>([])
  const [invStatus, setInvStatus]   = useState<Record<number, InvStatus>>({})
  const [proposeQty, setProposeQty]         = useState<Record<string, number>>({})
  const [proposeConfirming, setProposeConfirming] = useState(false)
  const [proposeSent, setProposeSent]       = useState(false)

  const active = ((planForms ?? []) as PlanForm[]).filter(p => p.status !== 'DRAFT')

  const commitStatus = (pf: PlanForm, updated: StockLine[]) => {
    if (updated.every(l => l.checked)) {
      const hasShort = updated.some(l => l.required != null && l.stock < l.required)
      // Nếu đủ hàng → đánh dấu da-mua; nếu thiếu → giữ cho-kiem, chờ xác nhận đề xuất mua
      if (!hasShort) setInvStatus(prev => ({ ...prev, [pf.id]: 'da-mua' }))
    }
  }

  const openDetail = (pf: PlanForm) => {
    setSelectedPf(pf)
    setLines(flattenMaterial(pf))
    setProposeSent(false)
    setProposeConfirming(false)
    setProposeQty({})
  }

  const checkLine = (id: string) => {
    const line = lines.find(l => l.id === id)
    if (!line) return
    const updated = lines.map(l => l.id === id ? { ...l, checked: true } : l)
    setLines(updated)
    if (selectedPf) commitStatus(selectedPf, updated)
    if (line.required != null && line.stock < line.required && !(id in proposeQty)) {
      setProposeQty(p => ({ ...p, [id]: line.required! - line.stock }))
    }
  }

  const checkAll = () => {
    const updated = lines.map(l => ({ ...l, checked: true }))
    setLines(updated)
    if (selectedPf) commitStatus(selectedPf, updated)
    const newQty: Record<string, number> = {}
    updated.forEach(l => {
      if (l.required != null && l.stock < l.required && !(l.id in proposeQty))
        newQty[l.id] = l.required - l.stock
    })
    if (Object.keys(newQty).length) setProposeQty(p => ({ ...p, ...newQty }))
  }

  const handlePropose = () => {
    if (selectedPf) setInvStatus(prev => ({ ...prev, [selectedPf.id]: 'cho-mua' }))
    setProposeSent(true)
    setProposeConfirming(false)
  }

  // ─── Detail view ────────────────────────────────────────────────────────────
  if (selectedPf) {
    const allChecked = lines.length > 0 && lines.every(l => l.checked)
    const pfStatus   = invStatus[selectedPf.id] ?? 'cho-kiem'
    const cfg        = STATUS_CFG[pfStatus]

    return (
      <div>
        {/* Header */}
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
                {selectedPf.mfgProduct?.name && <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>— {selectedPf.mfgProduct.name}</span>}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
                PO: {selectedPf.exportOrder?.poNumber ?? `#${selectedPf.exportOrderId}`}
                {selectedPf.exportOrder?.deliveryDate && (
                  <> · Hạn giao: {format(new Date(selectedPf.exportOrder.deliveryDate), 'dd/MM/yyyy')}</>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Table */}
        {lines.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}>
            Chưa có dữ liệu vật tư cho SKU này
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: 180 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={thStyle}>Tên vật tư</th>
                  <th style={thStyle}>Quy cách</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Tồn</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cần</th>
                  <th style={thStyle}>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const sufficient = line.required == null || line.stock >= line.required
                  return (
                    <tr key={line.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {line.name}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {line.spec ?? '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: line.checked ? (sufficient ? '#16a34a' : '#dc2626') : 'var(--text)' }}>
                        {line.stock}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text2)' }}>
                        {line.required ?? '—'}
                      </td>
                      <td style={tdStyle}>
                        {line.checked ? (
                          sufficient
                            ? <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ Đủ</span>
                            : <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>⚠ Thiếu {line.required! - line.stock}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            {lines.filter(l => l.checked).length} / {lines.length} vật tư đã kiểm tra
          </div>
          <button
            onClick={checkAll}
            disabled={allChecked}
            style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 7, background: allChecked ? 'var(--surface2)' : '#facc15', color: allChecked ? 'var(--text3)' : '#fff', cursor: allChecked ? 'not-allowed' : 'pointer' }}
          >
            {allChecked ? 'Đã kiểm tra' : 'Kiểm tra'}
          </button>
        </div>

        {/* Inline propose panel — hiện ngay khi có vật tư thiếu sau kiểm */}
        {/* Confirm popup */}
        {proposeConfirming && (() => {
          const shortLines = lines.filter(l => l.checked && l.required != null && l.stock < l.required)
          return (
            <div
              onClick={e => { if (e.target === e.currentTarget) setProposeConfirming(false) }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ background: 'var(--surface)', borderRadius: 14, width: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Xác nhận đề xuất mua</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                    Gửi đề xuất mua {shortLines.length} vật tư thiếu cho đơn hàng này?
                  </div>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    onClick={() => setProposeConfirming(false)}
                    style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
                  >Hủy</button>
                  <button
                    onClick={handlePropose}
                    style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: '#d97706', color: '#fff', cursor: 'pointer' }}
                  >Xác nhận</button>
                </div>
              </div>
            </div>
          )
        })()}

        {(() => {
          const shortLines = lines.filter(l => l.checked && l.required != null && l.stock < l.required)
          if (shortLines.length === 0) return null
          return (
            <div style={{ marginTop: 20, border: '1px solid #fde68a', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
              <div style={{ padding: '12px 16px', background: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>Vật tư thiếu — cần đặt mua</span>
              </div>

              {proposeSent ? (
                <div style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#166534' }}>
                  ✓ Đã gửi đề xuất mua {shortLines.length} vật tư
                </div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                        <th style={thStyle}>Tên vật tư</th>
                        <th style={thStyle}>Quy cách</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>SL đề xuất mua</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shortLines.map(line => (
                        <tr key={line.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ ...tdStyle, fontWeight: 500 }}>{line.name}</td>
                          <td style={{ ...tdStyle, color: 'var(--text3)' }}>{line.spec ?? '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <input
                              type="number" min={1}
                              value={proposeQty[line.id] ?? (line.required! - line.stock)}
                              onChange={e => setProposeQty(p => ({ ...p, [line.id]: Math.max(1, Number(e.target.value)) }))}
                              style={{ width: 72, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setProposeConfirming(true)}
                      style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 7, background: '#d97706', color: '#fff', cursor: 'pointer' }}
                    >Đề xuất mua</button>
                  </div>
                </>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  // ─── List view ──────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Kiểm tra tồn kho SKU</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Nhấn vào một SKU để kiểm tra tình trạng tồn kho vật tư
        </p>
      </div>

      {isLoading ? <LoadingState /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 140 }} />
              <col />
              <col style={{ width: 120 }} />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Hạn giao</th>
                <th style={thStyle}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {active.map(pf => {
                const status = invStatus[pf.id] ?? 'cho-kiem'
                const cfg    = STATUS_CFG[status]
                return (
                  <tr
                    key={pf.id}
                    onClick={() => openDetail(pf)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`}
                    </td>
                    <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                      {pf.mfgProduct?.name && (
                        <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{pf.mfgProduct.name}</>
                      )}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                      {pf.exportOrder?.deliveryDate
                        ? format(new Date(pf.exportOrder.deliveryDate), 'dd/MM/yyyy')
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {active.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    Không có SKU nào
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
