'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronDown, ScanSearch, Send, ShoppingCart, CheckCircle2, AlertTriangle, Factory, Warehouse, Clock, Truck } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import LoadingState from '../../../components/LoadingState'
import { useConfirm } from '../../../hooks/useConfirm'
import { listTh, listTd } from '../../../styles/table'
import type { Sku } from '../../../types/sku'
import { flattenManhSteel, combinedDaySon, dinhItems } from '../../../utils/manhMaterials'
import { useInspection, khoState, PROPOSAL_ENTITY, PROPOSAL_STATUS_LABELS, type KhoKey, type InspRequest, type PurchaseProposal, type PurchaseProposalItem } from '../../../context/InspectionContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import AuditLogTimeline from '../../../components/AuditLogTimeline'

// ── Types ──────────────────────────────────────────────────────────────────────

type OverallStatus = 'chua-gui' | 'dang-kiem' | 'du-hang' | 'co-thieu' | 'da-de-xuat'
type PurchaseProposalStatus = PurchaseProposal['status']

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

function extractAllMaterials(pf: Sku): AllMat[] {
  const mt = pf.quotaManagement?.materialType
  return [
    ...flattenManhSteel(pf).map(x => ({
      group: 'Sắt', khoKey: 'phoiSonHan' as KhoKey, khoLabel: 'Kho PSH',
      name: x.name, unit: x.unit ?? 'kg', required: x.quantity ?? 0,
    })),
    ...combinedDaySon(pf).map(x => {
      const s = isSon(x.name)
      return {
        group: s ? 'Sơn' : 'Dây',
        khoKey: (s ? 'phoiSonHan' : 'vatTuTP') as KhoKey,
        khoLabel: s ? 'Kho PSH' : 'Kho VTTP',
        name: x.name, unit: x.unit ?? (s ? 'kg' : 'm'), required: x.kg ?? 0,
      }
    }),
    ...dinhItems(pf).map(x => ({
      group: 'Đinh', khoKey: 'vatTuTP' as KhoKey, khoLabel: 'Kho VTTP',
      name: x.name, unit: x.unit ?? 'cây', required: x.kg ?? 0,
    })),
    ...(mt?.vatTuPhuKien ?? []).map(x => ({
      group: 'Phụ kiện', khoKey: 'vatTuTP' as KhoKey, khoLabel: 'Kho VTTP',
      name: x.name, unit: x.unit ?? 'cái', required: x.quantity ?? 0,
    })),
    ...(mt?.baoBiDongGoi ?? []).map(x => ({
      group: 'Bao bì', khoKey: 'thanhPham' as KhoKey, khoLabel: 'Kho TP',
      name: x.name, unit: x.unit ?? 'cái', required: x.quantity ?? 0,
    })),
  ]
}

function overallStatus(req: InspRequest | undefined): OverallStatus {
  if (!req) return 'chua-gui'
  if (req.proposalCreated) return 'da-de-xuat'
  if (req.phoiSonHan.status === 'pending' || req.vatTuTP.status === 'pending' || req.thanhPham.status === 'pending') return 'dang-kiem'
  const hasShortage = [...req.phoiSonHan.items, ...req.vatTuTP.items, ...req.thanhPham.items]
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

// Các mốc tiến độ mua hàng — quy đổi từ PurchaseProposal.status sang vị trí trên thanh bước,
// giúp KHSX nhìn thoáng qua là biết lệnh đang ở giai đoạn nào (thay vì chỉ 1 badge trạng thái).
const PROGRESS_STEPS = ['Báo giá NCC', 'Giám đốc duyệt', 'Đang mua hàng', 'Đã nhận hàng'] as const
function doneStepCount(status: PurchaseProposalStatus): number {
  return { new: 0, quoting: 0, submitted: 1, purchasing: 2, purchased: 4, rejected: 1 }[status]
}

function ProposalStepper({ status }: { status: PurchaseProposalStatus }) {
  const done = doneStepCount(status)
  const rejected = status === 'rejected'
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {PROGRESS_STEPS.map((label, i) => {
        const isRejectedStep = rejected && i === 1
        const isDone = !isRejectedStep && i < done
        const isCurrent = !isRejectedStep && i === done && done < 4
        const color = isRejectedStep ? '#dc2626' : isDone || isCurrent ? '#2563eb' : 'var(--border)'
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < PROGRESS_STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isRejectedStep ? '#fee2e2' : isDone ? '#2563eb' : isCurrent ? '#dbeafe' : 'var(--surface2)',
                border: `2px solid ${color}`,
              }}>
                {isRejectedStep ? (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>✕</span>
                ) : isDone ? (
                  <CheckCircle2 size={11} color="#fff" />
                ) : null}
              </div>
              <span style={{ fontSize: 10, fontWeight: isCurrent || isRejectedStep ? 700 : 500, color: isRejectedStep ? '#dc2626' : isDone || isCurrent ? 'var(--text)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                {isRejectedStep ? 'Từ chối' : label}
              </span>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, marginBottom: 15, background: i < done && !rejected ? '#2563eb' : 'var(--border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function KiemTraVatTuPage() {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT')

  const { requests, proposals, sendRequest, markProposalCreated, startProduction } = useInspection()
  const { getLogsFor } = useAuditLog()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [proposing,  setProposing]  = useState(false)
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null)
  const { ask, confirmModal } = useConfirm()

  const selected = active.find(p => p.id === selectedId) ?? null
  const request  = selected ? requests.find(r => r.skuId === selected.id) ?? null : null

  // ── Detail view ──────────────────────────────────────────────────────────────

  if (selected) {
    const allMats   = extractAllMaterials(selected)
    const phoiDone  = request?.phoiSonHan.status === 'done'
    const vattuDone = request?.vatTuTP.status === 'done'
    const tpDone    = request?.thanhPham.status === 'done'
    const bothDone  = phoiDone && vattuDone && tpDone

    const missingItems = !bothDone ? [] : [
      ...request!.phoiSonHan.items
        .filter(i => i.actualStock != null && i.required > 0 && i.actualStock < i.required)
        .map(i => ({ ...i, khoKey: 'phoiSonHan' as KhoKey, khoLabel: 'Kho Phôi Sơn Hàn' })),
      ...request!.vatTuTP.items
        .filter(i => i.actualStock != null && i.required > 0 && i.actualStock < i.required)
        .map(i => ({ ...i, khoKey: 'vatTuTP' as KhoKey, khoLabel: 'Kho Vật tư thành phẩm' })),
      ...request!.thanhPham.items
        .filter(i => i.actualStock != null && i.required > 0 && i.actualStock < i.required)
        .map(i => ({ ...i, khoKey: 'thanhPham' as KhoKey, khoLabel: 'Kho Thành phẩm' })),
    ]
    const hasShortage = missingItems.length > 0

    // Tiến độ mua vật tư theo từng kho — mỗi kho liên quan có đúng 1 PurchaseProposal
    // (xem markProposalCreated, InspectionContext.tsx), theo dõi độc lập nhau tại đây.
    const requestProposals = request ? proposals.filter(p => p.requestId === request.id) : []
    const allPurchased = requestProposals.length > 0 && requestProposals.every(p => p.status === 'purchased')

    const findInspItem = (name: string, khoKey: KhoKey) => {
      if (!request) return null
      return khoState(request, khoKey).items.find(i => i.name === name) ?? null
    }

    const khoStatusCard = (khoKey: KhoKey, label: string) => {
      if (!request) return null
      const state = khoState(request, khoKey)

      let cfg: { color: string; bg: string; border: string; icon: React.ReactNode; text: string }
      if (state.status === 'pending') {
        cfg = { color: '#92400e', bg: '#fffbeb', border: '#fde68a', icon: <Clock size={15} />, text: 'Đang chờ kho phản hồi' }
      } else {
        const shortCount = state.items.filter(i => i.actualStock != null && i.required > 0 && i.actualStock < i.required).length
        cfg = shortCount > 0
          ? { color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', icon: <AlertTriangle size={15} />, text: `Thiếu ${shortCount} mặt hàng` }
          : { color: '#166534', bg: '#f0fdf4', border: '#86efac', icon: <CheckCircle2 size={15} />, text: 'Đủ hàng' }
      }

      return (
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <div style={{ color: cfg.color, flexShrink: 0 }}>{cfg.icon}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.text}</div>
          </div>
        </div>
      )
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
                PO: {selected.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng'}
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

        {/* Kho status cards */}
        {request && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {khoStatusCard('phoiSonHan', 'Kho Phôi Sơn Hàn')}
              {khoStatusCard('vatTuTP', 'Kho Vật tư thành phẩm')}
              {khoStatusCard('thanhPham', 'Kho Thành phẩm')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
              Đã gửi yêu cầu kiểm tra lúc {format(new Date(request.sentAt), 'HH:mm dd/MM/yyyy')}
            </div>
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
                  const matKhoState = request ? khoState(request, mat.khoKey) : null
                  const inspItem    = findInspItem(mat.name, mat.khoKey)
                  const pending     = matKhoState?.status === 'pending'
                  const unknown     = !request || pending || inspItem?.actualStock == null
                  const shortage    = !unknown && mat.required > 0 ? mat.required - inspItem!.actualStock! : 0
                  const accentColor = unknown ? 'transparent' : shortage > 0 ? '#dc2626' : '#16a34a'

                  const stockCell = () => {
                    if (!request) return <span style={{ color: 'var(--text3)' }}>—</span>
                    if (pending) return <span style={{ color: '#92400e', fontSize: 11 }}>...</span>
                    if (inspItem?.actualStock == null) return <span style={{ color: 'var(--text3)' }}>—</span>
                    const ok = inspItem.actualStock >= mat.required
                    return <span style={{ fontWeight: 700, color: ok ? '#16a34a' : '#dc2626' }}>{inspItem.actualStock}</span>
                  }

                  const statusCell = () => {
                    if (!request)
                      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>Chưa gửi</span>
                    if (pending)
                      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#92400e' }}><Clock size={12} /> Đang chờ</span>
                    if (inspItem?.actualStock == null)
                      return <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                    return shortage > 0
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#dc2626' }}><AlertTriangle size={12} /> Thiếu {shortage} {mat.unit}</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#16a34a' }}><CheckCircle2 size={12} /> Đủ</span>
                  }

                  return (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)', boxShadow: `inset 3px 0 0 ${accentColor}` }}>
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

        {/* Bắt đầu sản xuất — luôn hiển thị, không phụ thuộc điều kiện kiểm tra vật tư */}
        {request && (
          request.productionStarted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', border: '1px solid #86efac', borderRadius: 10, background: '#f0fdf4', fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 16 }}>
              <Factory size={16} /> Đã bắt đầu sản xuất lúc {request.productionStartedAt ? format(new Date(request.productionStartedAt), 'HH:mm dd/MM/yyyy') : '—'}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={() => ask(
                  { message: `Xác nhận bắt đầu sản xuất cho lệnh ${selected.mfgProduct?.factoryCode ?? ''}?` },
                  () => startProduction(request!.id)
                )}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer' }}
              >
                <Factory size={14} /> Bắt đầu sản xuất
              </button>
            </div>
          )
        )}

        {/* "Chưa gửi" notice */}
        {!request && (
          <div style={{ padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
            Nhấn &ldquo;Gửi đề xuất kiểm tra vật tư&rdquo; để yêu cầu ba kho kiểm tra tồn kho cho lệnh này
          </div>
        )}

        {/* All sufficient — đủ hàng ngay từ đầu, không cần qua đề xuất mua hàng */}
        {bothDone && !hasShortage && !request?.proposalCreated && (
          <div style={{ border: '1px solid #86efac', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#f0fdf4', fontSize: 13, fontWeight: 600, color: '#166534' }}>
              <CheckCircle2 size={16} /> Tất cả vật tư đủ hàng — có thể tiến hành sản xuất
            </div>
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
                        khoKey: i.khoKey,
                        khoLabel: i.khoLabel,
                      }))
                      markProposalCreated(request!.id, proposalItems, {
                        skuId: selected.id,
                        poNumber:   selected.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng',
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

        {/* Tiến độ mua vật tư theo từng kho + chốt bắt đầu sản xuất */}
        {requestProposals.length > 0 && (
          <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              <Truck size={14} color="var(--text2)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Tiến độ mua vật tư</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: allPurchased ? '#166534' : '#1e40af', background: allPurchased ? '#dcfce7' : '#dbeafe' }}>
                {requestProposals.filter(p => p.status === 'purchased').length}/{requestProposals.length} kho đã nhận hàng
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {requestProposals.map(p => {
                const cfg = PROPOSAL_STATUS_LABELS[p.status]
                const khoLabel = p.items[0]?.khoLabel ?? p.warehouseScope
                const expanded = expandedProposalId === p.id
                const logEntries = getLogsFor(PROPOSAL_ENTITY, p.id)
                return (
                  <div key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Warehouse size={14} color="var(--text3)" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{khoLabel}</span>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{p.items.length} vật tư</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>
                          {cfg.label}
                        </span>
                      </div>

                      <div style={{ padding: '2px 4px 0' }}>
                        <ProposalStepper status={p.status} />
                      </div>

                      <button
                        onClick={() => setExpandedProposalId(expanded ? null : p.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start', padding: 0, border: 'none', background: 'none', fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}
                      >
                        <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
                        {expanded ? 'Ẩn lịch sử hoạt động' : `Xem lịch sử hoạt động${logEntries.length > 0 ? ` (${logEntries.length})` : ''}`}
                      </button>

                      {expanded && (
                        <div style={{ paddingTop: 4, borderTop: '1px dashed var(--border)' }}>
                          <AuditLogTimeline entries={logEntries} bare />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {confirmModal}
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
          Gửi yêu cầu kiểm tra tồn kho đến Kho Phôi Sơn Hàn, Kho Vật tư thành phẩm và Kho Thành phẩm
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
                const req = requests.find(r => r.skuId === pf.id)
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
                      {pf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng'}
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
