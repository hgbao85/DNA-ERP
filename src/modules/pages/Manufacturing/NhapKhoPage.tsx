'use client'
import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { ArrowDownToLine, ArrowLeftRight, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import type { PlanForm } from '../../../types/plan-form'
import { canReceiveAt } from '../../../types/warehouse-transfer'
import { NhapNoiBoSection } from '../InboundWarehouse/InternalTransferSections'
import LoadingState from '../../../components/LoadingState'
import { compactTh as th, compactTd as td } from '../../../styles/table'
import { mockStock } from '../../../utils/warehouse'

// ── Nhập kho flow types ──────────────────────────────────────
interface NhapLine {
  id: string
  name: string
  spec: string | null
  proposedQty: number
  purchased: number
  inputQty: string
}

type NhapStatus = 'cho-nhap' | 'dang-nhap' | 'da-nhap'

const STATUS_NHAP: Record<NhapStatus, { label: string; color: string; bg: string }> = {
  'cho-nhap':  { label: 'Chờ nhập',  color: '#92400e', bg: '#fef3c7' },
  'dang-nhap': { label: 'Đang nhập', color: '#1e40af', bg: '#dbeafe' },
  'da-nhap':   { label: 'Đã nhập',   color: '#166534', bg: '#dcfce7' },
}

// "daySon" gộp chung dây đan và sơn trong 1 mảng, không có field phân loại — tách bằng tên,
// giống hệt cách InspectionContext.tsx (buildKhoItems/isSon) đã tách cho luồng Kiểm vật tư.
const isSon = (name: string) => /sơn|son|primer|lót|phủ|hardener|thinner/i.test(name)

// Kho phôi sơn hàn chỉ nhập sắt/nhôm + sơn; kho vật tư thành phẩm nhập dây + phụ kiện + bao bì.
// Các scope khác (thành phẩm, tổng kho) không thuộc chuỗi nguyên vật liệu này nên vẫn thấy đủ.
function flattenNhapLines(pf: PlanForm, lockedGroup?: string | null): NhapLine[] {
  const lines: NhapLine[] = []
  const mt = pf.quotaManagement?.materialType
  if (!mt) return lines
  const push = (cat: string, arr: any[]) =>
    arr.forEach((item: any, i: number) => {
      const required = item.quantity != null ? Number(item.quantity) : item.kg != null ? Number(item.kg) : null
      const stock = mockStock(item.name, required)
      const proposedQty = required != null && stock < required ? required - stock : 0
      lines.push({
        id: `${pf.id}-${cat}-${i}`,
        name: item.name,
        spec: [item.specifications, item.thickness != null ? `dày ${item.thickness}mm` : null].filter(Boolean).join(', ') || null,
        proposedQty,
        purchased: 0,
        inputQty: '',
      })
    })
  const sat = Array.isArray(mt.sat) ? mt.sat : []
  const daySon = Array.isArray(mt.daySon) ? mt.daySon : []
  const vatTuPhuKien = Array.isArray(mt.vatTuPhuKien) ? mt.vatTuPhuKien : []
  const baoBiDongGoi = Array.isArray(mt.baoBiDongGoi) ? mt.baoBiDongGoi : []

  if (lockedGroup === 'phoi-son-han') {
    push('sat', sat)
    push('day', daySon.filter(x => isSon(x.name)))
  } else if (lockedGroup === 'vat-tu-tp') {
    push('day', daySon.filter(x => !isSon(x.name)))
    push('vtpk', vatTuPhuKien)
    push('bbdg', baoBiDongGoi)
  } else {
    push('sat', sat)
    push('day', daySon)
    push('vtpk', vatTuPhuKien)
    push('bbdg', baoBiDongGoi)
  }
  return lines.filter(l => l.proposedQty > 0)
}

function computeNhapStatus(lines: NhapLine[]): NhapStatus {
  if (lines.length === 0 || lines.every(l => l.purchased === 0)) return 'cho-nhap'
  if (lines.every(l => l.purchased >= l.proposedQty)) return 'da-nhap'
  return 'dang-nhap'
}

// ── NhapKhoSection: list PO → detail nhập ───────────────────
function NhapKhoSection({ lockedGroup }: { lockedGroup?: string | null }) {
  const { data: planForms = [], isLoading } = useFetch(() => api.getPlanForms(), [])
  const [selectedPf, setSelectedPf] = useState<PlanForm | null>(null)
  const [lines, setLines] = useState<NhapLine[]>([])
  const [nhapStatus, setNhapStatus] = useState<Record<number, NhapStatus>>({})

  const active = ((planForms ?? []) as PlanForm[]).filter(p => p.status !== 'DRAFT')

  const openDetail = (pf: PlanForm) => {
    setSelectedPf(pf)
    setLines(flattenNhapLines(pf, lockedGroup))
  }

  const confirmLine = (lineId: string) => {
    setLines(prev => {
      const updated = prev.map(l => {
        if (l.id !== lineId) return l
        const qty = Math.max(0, Number(l.inputQty) || 0)
        return { ...l, purchased: l.purchased + qty, inputQty: '' }
      })
      if (selectedPf) setNhapStatus(p => ({ ...p, [selectedPf.id]: computeNhapStatus(updated) }))
      return updated
    })
  }

  // ── Detail view ──────────────────────────────────────────
  if (selectedPf) {
    const pfStatus = nhapStatus[selectedPf.id] ?? 'cho-nhap'
    const cfg = STATUS_NHAP[pfStatus]
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
                PO: {selectedPf.exportOrder?.poNumber ?? `#${selectedPf.exportOrderId}`}
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
            Không có vật tư nào cần đặt mua cho SKU này
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: 170 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 170 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>Tên vật tư</th>
                  <th style={th}>Quy cách</th>
                  <th style={{ ...th, textAlign: 'right' }}>SL đề xuất mua</th>
                  <th style={{ ...th, textAlign: 'right' }}>Đã mua</th>
                  <th style={th}>Nhập</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const done = line.purchased >= line.proposedQty
                  const partial = line.purchased > 0 && !done
                  const canConfirm = !!line.inputQty && Number(line.inputQty) > 0
                  return (
                    <tr key={line.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {line.name}
                      </td>
                      <td style={{ ...td, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {line.spec ?? '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{line.proposedQty}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? '#16a34a' : partial ? '#d97706' : 'var(--text)' }}>
                        {line.purchased}
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
                            style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: canConfirm ? '#2e7d32' : 'var(--surface2)', color: canConfirm ? '#fff' : 'var(--text3)', cursor: canConfirm ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
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
        Chọn PO để ghi nhận vật tư đã mua vào kho
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
                const status = nhapStatus[pf.id] ?? 'cho-nhap'
                const cfg = STATUS_NHAP[status]
                return (
                  <tr
                    key={pf.id}
                    onClick={() => openDetail(pf)}
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
export default function NhapKhoPage({ lockedGroup }: { lockedGroup?: string | null } = {}) {
  const [nhapTab, setNhapTab] = useState<'nhap' | 'noi-bo'>('nhap')

  const showNoiBo = canReceiveAt(lockedGroup ?? '')

  const tabs = [
    ['nhap',    'Nhập kho',           ArrowDownToLine],
    ...(showNoiBo ? [['noi-bo', 'Nhập nội bộ', ArrowLeftRight] as const] : []),
  ] as const

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Nhập kho</h2>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setNhapTab(id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', fontSize: 13, fontWeight: nhapTab === id ? 700 : 500,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: nhapTab === id ? '#2e7d32' : 'var(--text2)',
            borderBottom: nhapTab === id ? '2px solid #2e7d32' : '2px solid transparent',
            marginBottom: -1,
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {nhapTab === 'nhap'    && <NhapKhoSection lockedGroup={lockedGroup} />}
      {nhapTab === 'noi-bo'  && showNoiBo && <NhapNoiBoSection warehouseCode={lockedGroup ?? ''} />}
    </div>
  )
}
