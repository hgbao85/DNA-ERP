'use client'
import { useState } from 'react'
import { ChevronLeft, ScanSearch, Send, ShoppingCart, CheckCircle2, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import LoadingState from '../../../components/LoadingState'
import { listTh, listTd } from '../../../styles/table'
import type { PlanForm } from '../../../types/plan-form'
import { useInspection, type KhoKey, type InspRequest, type PurchaseProposalItem } from '../../../context/InspectionContext'

// ── Types ──────────────────────────────────────────────────────────────────────

type OverallStatus = 'chua-gui' | 'dang-kiem' | 'du-hang' | 'co-thieu' | 'da-de-xuat'

type AllMat = {
  group: string
  khoKey: KhoKey
  khoLabel: string
  name: string
  unit: string
  required: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const isSon = (name: string) => /sơn|son|primer|lót|phủ|hardener|thinner/i.test(name)

function extractAllMaterials(pf: PlanForm): AllMat[] {
  const mt = pf.quotaManagement?.materialType
  if (!mt) return []
  return [
    ...(mt.sat ?? []).map(x => ({
      group: 'Sắt', khoKey: 'phoiSonHan' as KhoKey, khoLabel: 'Kho PSH',
      name: x.name, unit: x.unit ?? 'kg', required: x.quantity ?? 0,
    })),
    ...(mt.daySon ?? []).map(x => {
      const s = isSon(x.name)
      return {
        group: s ? 'Sơn' : 'Dây',
        khoKey: (s ? 'phoiSonHan' : 'vatTuTP') as KhoKey,
        khoLabel: s ? 'Kho PSH' : 'Kho VTTP',
        name: x.name, unit: x.unit ?? (s ? 'kg' : 'm'), required: x.kg ?? 0,
      }
    }),
    ...(mt.vatTuPhuKien ?? []).map(x => ({
      group: 'Phụ kiện', khoKey: 'vatTuTP' as KhoKey, khoLabel: 'Kho VTTP',
      name: x.name, unit: x.unit ?? 'cái', required: x.quantity ?? 0,
    })),
    ...(mt.baoBiDongGoi ?? []).map(x => ({
      group: 'Bao bì', khoKey: 'vatTuTP' as KhoKey, khoLabel: 'Kho VTTP',
      name: x.name, unit: x.unit ?? 'cái', required: x.quantity ?? 0,
    })),
  ]
}

function overallStatus(req: InspRequest | undefined): OverallStatus {
  if (!req) return 'chua-gui'
  if (req.proposalCreated) return 'da-de-xuat'
  if (req.phoiSonHan.status === 'pending' || req.vatTuTP.status === 'pending') return 'dang-kiem'
  const hasShortage = [...req.phoiSonHan.items, ...req.vatTuTP.items]
    .some(i => i.actualStock != null && i.required > 0 && i.actualStock < i.required)
  return hasShortage ? 'co-thieu' : 'du-hang'
}

const OVERALL_CFG: Record<OverallStatus, { label: string; color: string; bg: string }> = {
  'chua-gui':   { label: 'Chưa gửi',       color: '#6b7280', bg: '#f3f4f6' },
  'dang-kiem':  { label: 'Đang kiểm',      color: '#92400e', bg: '#fef3c7' },
  'du-hang':    { label: 'Đủ hàng',        color: '#166534', bg: '#dcfce7' },
  'co-thieu':   { label: 'Thiếu vật tư',   color: '#991b1b', bg: '#fee2e2' },
  'da-de-xuat': { label: 'Đã đề xuất mua', color: '#1e40af', bg: '#dbeafe' },
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LenhKiemTraPage() {
  const { data: planForms = [], isLoading } = useFetch(() => api.getPlanForms(), [])
  const active = ((planForms ?? []) as PlanForm[]).filter(p => p.status !== 'DRAFT')

  const { requests, sendRequest, markProposalCreated } = useInspection()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [proposing,  setProposing]  = useState(false)

  const selected = active.find(p => p.id === selectedId) ?? null
  const request  = selected ? requests.find(r => r.planFormId === selected.id) ?? null : null

  // ── Detail view ──────────────────────────────────────────────────────────────

  if (selected) {
    const allMats   = extractAllMaterials(selected)
    const phoiDone  = request?.phoiSonHan.status === 'done'
    const vattuDone = request?.vatTuTP.status === 'done'
    const bothDone  = phoiDone && vattuDone

    const missingItems = !bothDone ? [] : [
      ...request!.phoiSonHan.items
        .filter(i => i.actualStock != null && i.required > 0 && i.actualStock < i.required)
        .map(i => ({ ...i, khoLabel: 'Kho Phôi Sơn Hàn' })),
      ...request!.vatTuTP.items
        .filter(i => i.actualStock != null && i.required > 0 && i.actualStock < i.required)
        .map(i => ({ ...i, khoLabel: 'Kho Vật tư thành phẩm' })),
    ]
    const hasShortage = missingItems.length > 0

    const findInspItem = (name: string, khoKey: KhoKey) => {
      if (!request) return null
      const state = khoKey === 'phoiSonHan' ? request.phoiSonHan : request.vatTuTP
      return state.items.find(i => i.name === name) ?? null
    }

    const khoStatusBadge = (khoKey: KhoKey, label: string) => {
      if (!request) return null
      const state = khoKey === 'phoiSonHan' ? request.phoiSonHan : request.vatTuTP
      if (state.status === 'pending') {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a' }}>
            ⏳ {label}: Đang chờ
          </span>
        )
      }
      const shortCount = state.items.filter(i => i.actualStock != null && i.required > 0 && i.actualStock < i.required).length
      return shortCount > 0
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5' }}>
            ⚠ {label}: Thiếu {shortCount} mặt hàng
          </span>
        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: '#166534', background: '#dcfce7', border: '1px solid #86efac' }}>
            ✓ {label}: Đủ hàng
          </span>
    }

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => { setSelectedId(null); setProposing(false) }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
            >
              <ChevronLeft size={15} /> Quay lại
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {selected.mfgProduct?.factoryCode}
                {selected.mfgProduct?.name && (
                  <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>— {selected.mfgProduct.name}</span>
                )}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
                PO: {selected.exportOrder?.poNumber ?? `#${selected.exportOrderId}`}
                {selected.exportOrder?.deliveryDate && (
                  <> · Hạn giao: {format(new Date(selected.exportOrder.deliveryDate), 'dd/MM/yyyy')}</>
                )}
              </div>
            </div>
          </div>

          {!request && (
            <button
              onClick={() => sendRequest(selected)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: 'none', borderRadius: 8, background: '#4527a0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
            >
              <Send size={14} /> Gửi đề xuất kiểm tra vật tư
            </button>
          )}
        </div>

        {/* Kho status badges */}
        {request && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            {khoStatusBadge('phoiSonHan', 'Kho Phôi Sơn Hàn')}
            {khoStatusBadge('vatTuTP', 'Kho Vật tư thành phẩm')}
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              · Đã gửi lúc {format(new Date(request.sentAt), 'HH:mm dd/MM/yyyy')}
            </span>
          </div>
        )}

        {/* Materials table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {allMats.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Chưa có dữ liệu vật tư cho SKU này
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 76 }} />
                <col />
                <col style={{ width: 46 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={listTh}>Nhóm</th>
                  <th style={listTh}>Tên vật tư</th>
                  <th style={listTh}>ĐVT</th>
                  <th style={{ ...listTh, textAlign: 'right' }}>Cần</th>
                  <th style={listTh}>Kho</th>
                  <th style={{ ...listTh, textAlign: 'right' }}>Tồn thực</th>
                  <th style={listTh}>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {allMats.map((mat, idx) => {
                  const khoState  = request ? (mat.khoKey === 'phoiSonHan' ? request.phoiSonHan : request.vatTuTP) : null
                  const inspItem  = findInspItem(mat.name, mat.khoKey)

                  const stockCell = () => {
                    if (!request) return <span style={{ color: 'var(--text3)' }}>—</span>
                    if (khoState?.status === 'pending') return <span style={{ color: '#92400e', fontSize: 11 }}>...</span>
                    if (inspItem?.actualStock == null) return <span style={{ color: 'var(--text3)' }}>—</span>
                    const ok = inspItem.actualStock >= mat.required
                    return <span style={{ fontWeight: 700, color: ok ? '#16a34a' : '#dc2626' }}>{inspItem.actualStock}</span>
                  }

                  const statusCell = () => {
                    if (!request)
                      return <span style={{ fontSize: 11, color: 'var(--text3)' }}>Chưa gửi</span>
                    if (khoState?.status === 'pending')
                      return <span style={{ fontSize: 11, color: '#92400e' }}>⏳ Đang chờ</span>
                    if (inspItem?.actualStock == null)
                      return <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                    const shortage = mat.required > 0 ? mat.required - inspItem.actualStock : 0
                    return shortage > 0
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>⚠ Thiếu {shortage} {mat.unit}</span>
                      : <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ Đủ</span>
                  }

                  return (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...listTd, fontSize: 11, color: 'var(--text3)' }}>{mat.group}</td>
                      <td style={{ ...listTd, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.name}</td>
                      <td style={{ ...listTd, color: 'var(--text3)' }}>{mat.unit}</td>
                      <td style={{ ...listTd, textAlign: 'right' }}>{mat.required > 0 ? mat.required : '—'}</td>
                      <td style={{ ...listTd, fontSize: 11, color: 'var(--text3)' }}>{mat.khoLabel}</td>
                      <td style={{ ...listTd, textAlign: 'right' }}>{stockCell()}</td>
                      <td style={listTd}>{statusCell()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* "Chưa gửi" notice */}
        {!request && (
          <div style={{ padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
            Nhấn &ldquo;Gửi đề xuất kiểm tra vật tư&rdquo; để yêu cầu hai kho kiểm tra tồn kho cho lệnh này
          </div>
        )}

        {/* All sufficient */}
        {bothDone && !hasShortage && !request?.proposalCreated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', border: '1px solid #86efac', borderRadius: 10, background: '#f0fdf4', fontSize: 13, fontWeight: 600, color: '#166534' }}>
            <CheckCircle2 size={16} /> Tất cả vật tư đủ hàng — có thể tiến hành sản xuất
          </div>
        )}

        {/* Shortage panel */}
        {bothDone && hasShortage && !request?.proposalCreated && (
          <div style={{ border: '1px solid #fde68a', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#fef3c7', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <AlertTriangle size={15} color="#92400e" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                  {missingItems.length} vật tư cần đặt mua
                </span>
              </div>
              {!proposing && (
                <button
                  onClick={() => setProposing(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: 'none', borderRadius: 7, background: '#d97706', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  <ShoppingCart size={13} /> Tạo đề xuất mua hàng
                </button>
              )}
            </div>

            {proposing && (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <colgroup>
                    <col style={{ width: 160 }} /><col /><col style={{ width: 130 }} /><col style={{ width: 80 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                      <th style={listTh}>Kho</th>
                      <th style={listTh}>Vật tư</th>
                      <th style={{ ...listTh, textAlign: 'right' }}>SL đề xuất mua</th>
                      <th style={listTh}>ĐVT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingItems.map((itm, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ ...listTd, color: 'var(--text3)', fontSize: 12 }}>{itm.khoLabel}</td>
                        <td style={{ ...listTd, fontWeight: 500 }}>{itm.name}</td>
                        <td style={{ ...listTd, textAlign: 'right', fontWeight: 700, color: '#d97706' }}>
                          {itm.required - (itm.actualStock ?? 0)}
                        </td>
                        <td style={{ ...listTd, color: 'var(--text3)' }}>{itm.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setProposing(false)}
                    style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
                  >Hủy</button>
                  <button
                    onClick={() => {
                      const proposalItems: PurchaseProposalItem[] = missingItems.map(i => ({
                        name: i.name, unit: i.unit, required: i.required,
                        actualStock: i.actualStock ?? 0,
                        buyQty: i.required - (i.actualStock ?? 0),
                        khoLabel: i.khoLabel,
                      }))
                      markProposalCreated(request!.id, proposalItems, {
                        planFormId: selected.id,
                        poNumber:   selected.exportOrder?.poNumber ?? `#${selected.exportOrderId}`,
                        skuCode:    selected.mfgProduct?.factoryCode ?? `#${selected.mfgProductId}`,
                        skuName:    selected.mfgProduct?.name,
                        deadline:   selected.exportOrder?.deliveryDate,
                      })
                      setProposing(false)
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: '#d97706', color: '#fff', cursor: 'pointer' }}
                  >
                    <ShoppingCart size={13} /> Xác nhận tạo đề xuất
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {request?.proposalCreated && hasShortage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', border: '1px solid #93c5fd', borderRadius: 10, background: '#eff6ff', fontSize: 13, fontWeight: 600, color: '#1e40af' }}>
            <CheckCircle2 size={16} /> Đã tạo đề xuất mua hàng cho {missingItems.length} vật tư thiếu
          </div>
        )}
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScanSearch size={20} color="#4527a0" /> Lệnh kiểm tra vật tư
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Gửi yêu cầu kiểm tra tồn kho đến Kho Phôi Sơn Hàn và Kho Vật tư thành phẩm
        </p>
      </div>

      {isLoading ? <LoadingState /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 145 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={listTh}>PO</th>
                <th style={listTh}>SKU</th>
                <th style={listTh}>Hạn giao</th>
                <th style={listTh}>Trạng thái kiểm</th>
              </tr>
            </thead>
            <tbody>
              {active.map(pf => {
                const req = requests.find(r => r.planFormId === pf.id)
                const os  = overallStatus(req)
                const cfg = OVERALL_CFG[os]
                return (
                  <tr
                    key={pf.id}
                    onClick={() => { setSelectedId(pf.id); setProposing(false) }}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...listTd, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`}
                    </td>
                    <td style={{ ...listTd, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                      {pf.mfgProduct?.name && (
                        <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{pf.mfgProduct.name}</>
                      )}
                    </td>
                    <td style={{ ...listTd, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {pf.exportOrder?.deliveryDate
                        ? format(new Date(pf.exportOrder.deliveryDate), 'dd/MM/yyyy')
                        : '—'}
                    </td>
                    <td style={listTd}>
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
                    Không có lệnh sản xuất nào
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
