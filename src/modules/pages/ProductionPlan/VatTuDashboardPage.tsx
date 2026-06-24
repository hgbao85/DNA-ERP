'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, X } from 'lucide-react'
import type { PlanForm } from '../../../types/plan-form'

const CAT_META = {
  sat: { label: 'Sắt', color: '#b45309', bg: '#fef3c7' },
} as const

type Cat = keyof typeof CAT_META

interface FlatItem {
  key: string
  pfId: number
  pfStatus: string
  pfCreatedAt: string
  productName: string
  productCode: string
  poNumber: string
  cat: Cat
  name: string
  spec: string | null
  unitQty: string | null
  createdAt: string | null
}

type ApprovalEntry = { status: 'APPROVED' | 'REJECTED'; reason?: string } | null

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PROPOSED: { label: 'Chờ duyệt', color: '#d97706', bg: '#fef3c7' },
  APPROVED: { label: 'Đã duyệt',  color: '#16a34a', bg: '#dcfce7' },
  REJECTED: { label: 'Từ chối',   color: '#dc2626', bg: '#fee2e2' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.PROPOSED
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, gap: 8 }}>
      <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function flattenItems(planForms: PlanForm[]): FlatItem[] {
  const items: FlatItem[] = []
  for (const pf of planForms) {
    const mt = pf.quotaManagement?.materialType
    if (!mt) continue
    const base = {
      pfId: pf.id,
      pfStatus: pf.status,
      pfCreatedAt: pf.createdAt,
      productName: pf.mfgProduct?.name ?? '—',
      productCode: pf.mfgProduct?.factoryCode ?? '—',
      poNumber: pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`,
    }
    ;(Array.isArray(mt.sat) ? mt.sat : []).forEach((i, idx) => items.push({
      ...base, key: `${pf.id}-sat-${idx}`, cat: 'sat',
      name: i.name,
      spec: [i.specifications, i.thickness != null ? `dày ${i.thickness}mm` : null].filter(Boolean).join(', ') || null,
      unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
      createdAt: i.createdAt ?? null,
    }))
  }
  return items
}

export default function VatTuDashboardPage() {
  const { data: planForms = [], isLoading } = useFetch(() => api.getPlanForms(), [])
  const [approvals, setApprovals] = useState<Record<string, ApprovalEntry>>({})
  const [selected, setSelected] = useState<FlatItem | null>(null)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const items = flattenItems((planForms ?? []) as PlanForm[])

  const approve = (key: string) => {
    setApprovals(p => ({ ...p, [key]: { status: 'APPROVED' } }))
    setShowRejectInput(false)
  }
  const confirmReject = (key: string) => {
    setApprovals(p => ({ ...p, [key]: { status: 'REJECTED', reason: rejectReason.trim() || undefined } }))
    setShowRejectInput(false)
    setRejectReason('')
  }

  const openDetail = (item: FlatItem) => {
    setSelected(item)
    setShowRejectInput(false)
    setRejectReason('')
  }

  const selectedApproval = selected ? (approvals[selected.key] ?? null) : null

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách Vật tư đăng ký</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          Tổng hợp vật tư sắt từ tất cả định mức — {items.length} mục
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
          <Loader2 size={18} /> Đang tải...
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 120 }} />
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>Loại</th>
                <th style={thStyle}>Tên vật tư</th>
                <th style={thStyle}>Quy cách</th>
                <th style={thStyle}>ĐVT / SL</th>
                <th style={thStyle}>Sản phẩm</th>
                <th style={thStyle}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const meta = CAT_META[item.cat]
                const approval = approvals[item.key] ?? null
                return (
                  <tr
                    key={item.key}
                    onClick={() => openDetail(item)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: selected?.key === item.key ? '#f0fdf4' : undefined }}
                    onMouseEnter={e => { if (selected?.key !== item.key) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseLeave={e => { e.currentTarget.style.background = selected?.key === item.key ? '#f0fdf4' : '' }}
                  >
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.spec ?? '—'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{item.unitQty ?? '—'}</td>
                    <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{item.productCode}</span>
                      <span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>
                      {item.productName}
                    </td>
                    <td style={tdStyle}>
                      {approval ? (
                        <StatusBadge status={approval.status} />
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); approve(item.key) }}
                          style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
                        >Duyệt</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    Không có vật tư nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div style={{ background: 'var(--surface)', width: 360, overflow: 'auto', padding: 24, boxShadow: '-4px 0 32px rgba(0,0,0,.14)', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: CAT_META[selected.cat].color, background: CAT_META[selected.cat].bg }}>
                {CAT_META[selected.cat].label}
              </span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 4 }}>
                <X size={18} color="var(--text3)" />
              </button>
            </div>

            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{selected.name}</h3>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>{selected.spec ?? '—'}</div>

            {/* Item fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <InfoRow label="ĐVT / Số lượng" value={selected.unitQty ?? '—'} />
              {selected.createdAt && (
                <InfoRow label="Thời gian nhập" value={format(new Date(selected.createdAt), 'HH:mm · dd/MM/yyyy')} />
              )}
            </div>

            {/* PlanForm info */}
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                Định mức #{selected.pfId}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <InfoRow label="Sản phẩm" value={`${selected.productCode} — ${selected.productName}`} />
                <InfoRow label="Mã lệnh SX" value={selected.poNumber} />
                <InfoRow label="Ngày tạo" value={format(new Date(selected.pfCreatedAt), 'dd/MM/yyyy')} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>Trạng thái</span>
                  <StatusBadge status={selected.pfStatus} />
                </div>
              </div>
            </div>

            {/* Approval */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                Duyệt vật tư
              </div>

              {selectedApproval && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: selectedApproval.status === 'APPROVED' ? '#dcfce7' : '#fee2e2' }}>
                  <StatusBadge status={selectedApproval.status} />
                  {selectedApproval.reason && (
                    <div style={{ marginTop: 5, fontSize: 12, color: '#dc2626', fontStyle: 'italic' }}>{selectedApproval.reason}</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => approve(selected.key)}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: selectedApproval?.status === 'APPROVED' ? '#16a34a' : 'rgba(22,163,74,0.12)',
                    color: selectedApproval?.status === 'APPROVED' ? '#fff' : '#16a34a',
                  }}
                >Duyệt</button>
                <button
                  onClick={() => { setShowRejectInput(v => !v); setRejectReason('') }}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: selectedApproval?.status === 'REJECTED' ? '#dc2626' : 'rgba(220,38,38,0.10)',
                    color: selectedApproval?.status === 'REJECTED' ? '#fff' : '#dc2626',
                  }}
                >Từ chối</button>
              </div>

              {showRejectInput && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Lý do từ chối (không bắt buộc)..."
                    rows={3}
                    autoFocus
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                      style={{ flex: 1, padding: '7px 0', fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                    >Hủy</button>
                    <button
                      onClick={() => confirmReject(selected.key)}
                      style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >Xác nhận</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '12px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties = { padding: '12px 16px' }
