'use client'
import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import type { PlanForm } from '../../../types/plan-form'
import LoadingState from '../../../components/LoadingState'

interface MockPiece {
  id: string
  name: string
  totalQty: number
  choThucThi: number
}

const MANH_PARTS = ['Thân trên', 'Thân dưới', 'Hông', 'Đế', 'Nắp', 'Khung']

function strHash(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

function mockTotalQty(pf: PlanForm): number {
  const code = pf.mfgProduct?.factoryCode ?? `#${pf.id}`
  return 50 + (strHash(code) % 100)
}

function mockPieces(pf: PlanForm): MockPiece[] {
  const code = pf.mfgProduct?.factoryCode ?? `#${pf.id}`
  const h = strHash(code)
  const count = 3 + (h % 3)
  const pfTotal = mockTotalQty(pf)
  return Array.from({ length: count }, (_, i) => {
    const totalQty = Math.floor(pfTotal / count) + (i === 0 ? pfTotal % count : 0)
    const choThucThi = Math.min(Math.floor(totalQty * ((h + i * 13) % 4 + 1) / 12), totalQty)
    return {
      id: `${pf.id}-m-${i}`,
      name: MANH_PARTS[(h + i) % MANH_PARTS.length],
      totalQty,
      choThucThi,
    }
  })
}

function mockChoDoyet(pf: PlanForm): number {
  const code = pf.mfgProduct?.factoryCode ?? `#${pf.id}`
  const total = mockTotalQty(pf)
  return Math.floor(total * (strHash(code) % 4) / 22)
}

export default function KhoChuyenKiemPage() {
  const { data: planForms = [], isLoading } = useFetch(() => api.getPlanForms(), [])
  const [selectedPf, setSelectedPf] = useState<PlanForm | null>(null)

  const active = ((planForms ?? []) as PlanForm[]).filter(p => p.status !== 'DRAFT')

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (selectedPf) {
    const pieces = mockPieces(selectedPf)

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
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
              PO: {selectedPf.exportOrder?.poNumber ?? `#${selectedPf.exportOrderId}`}
              {selectedPf.exportOrder?.deliveryDate && (
                <> · Hạn giao: {format(new Date(selectedPf.exportOrder.deliveryDate), 'dd/MM/yyyy')}</>
              )}
            </div>
          </div>
        </div>

        {/* Detail table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col style={{ width: 100 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 72 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Mảnh</th>
                <th style={{ ...th, textAlign: 'right' }}>Chờ thực thi</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã kiểm</th>
                <th style={{ ...th, textAlign: 'right' }}>Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {pieces.map(piece => {
                const conLai = Math.max(0, piece.totalQty - piece.choThucThi)
                return (
                  <tr key={piece.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {piece.name}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text2)' }}>{piece.choThucThi}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>0</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: conLai > 0 ? '#d97706' : '#16a34a' }}>{conLai}</td>
                  </tr>
                )
              })}
              {pieces.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    Không có mảnh nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Chuyền kiểm</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Nhấn vào dòng để xem chi tiết mảnh
      </p>

      {isLoading ? <LoadingState /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 120 }} />
                <col />
                <col style={{ width: 78 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 84 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>PO</th>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign: 'right' }}>Số lượng</th>
                  <th style={{ ...th, textAlign: 'right' }}>Chờ thực thi</th>
                  <th style={{ ...th, textAlign: 'right' }}>Đã kiểm</th>
                  <th style={{ ...th, textAlign: 'right' }}>Chờ duyệt</th>
                  <th style={{ ...th, textAlign: 'right' }}>Còn lại</th>
                  <th style={th}>Tiến độ</th>
                  <th style={th}>Hạn giao</th>
                </tr>
              </thead>
              <tbody>
                {active.map(pf => {
                  const pieces        = mockPieces(pf)
                  const total         = mockTotalQty(pf)
                  const sumChoThucThi = pieces.reduce((s, p) => s + p.choThucThi, 0)
                  const sumDaKiem     = 0
                  const choDuyet      = mockChoDoyet(pf)
                  const conLai        = Math.max(0, total - sumChoThucThi - sumDaKiem - choDuyet)
                  const pct           = Math.min(100, Math.round(sumDaKiem / total * 100))
                  return (
                    <tr
                      key={pf.id}
                      onClick={() => setSelectedPf(pf)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ ...td, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`}
                      </td>
                      <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                        {pf.mfgProduct?.name && (
                          <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{pf.mfgProduct.name}</>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{total}</td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--text2)' }}>{sumChoThucThi}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: sumDaKiem > 0 ? '#16a34a' : 'var(--text)' }}>{sumDaKiem}</td>
                      <td style={{ ...td, textAlign: 'right', color: choDuyet > 0 ? '#d97706' : 'var(--text3)' }}>{choDuyet}</td>
                      <td style={{ ...td, textAlign: 'right', color: conLai > 0 ? 'var(--text)' : '#16a34a' }}>{conLai}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#e65100', borderRadius: 3, transition: 'width .3s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                        {pf.exportOrder?.deliveryDate
                          ? format(new Date(pf.exportOrder.deliveryDate), 'dd/MM/yyyy')
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
                {active.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                      Không có PO nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '8px 12px', color: 'var(--text)' }
