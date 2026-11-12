import { useMemo, useState } from 'react'
import { ClipboardList, FileCheck2, Printer, RotateCcw, X } from 'lucide-react'
import { useInspection, type PurchaseProposalItem } from '../../../context/InspectionContext'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { getMaterials, uploadDocument } from '../../../services/api'
import { getSupplierOrders, type SupplierOrder, type SupplierOrderItem } from '../../../services/supplier-orders-api'
import { buildBuyerByMaterialId, splitItemsByOwner, visibleProposalsFor } from '../../../utils/purchasingRouting'
import EmptyState from '../../../components/EmptyState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import {
  BossApproveModal,
  CancelSupplierOrderModal,
  CloseShortageModal,
  CreateSupplierOrderModal,
  ReviseSupplierOrderModal,
  printSupplierOrderFile,
} from './SupplierOrderModals'

const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)', textAlign: 'left' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13 }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }
const primary: React.CSSProperties = { ...btn, border: 'none', background: 'var(--bg-2563eb)', color: '#fff' }

const isPending = (item: PurchaseProposalItem) => item.status !== 'purchasing' && item.status !== 'purchased'
// Dòng của đơn đã ký mà NCC còn nợ hàng - đối tượng của "Đóng phần thiếu" (Đợt 5e, 7.13).
const isShort = (it: SupplierOrderItem) => it.status === 'PURCHASING' && it.receivedQty < it.purchaseQty
const fmtDay = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—')

interface LooseRow {
  proposalId: string
  piCode: string
  deadline?: string
  item: PurchaseProposalItem
}

const STATUS_LABEL: Record<SupplierOrder['status'], string> = {
  DRAFT: 'Chờ phiếu Sếp ký',
  APPROVED: 'Đã có phiếu ký',
  CANCELLED: 'Đã huỷ',
}

/**
 * "Đơn đặt hàng" (2026-11-04, Đợt 5c - bản v8 mục 7.1–7.8, 7.11): gộp vật tư của NHIỀU lệnh sản xuất
 * vào 1 đơn đặt hàng NCC (cùng 1 nhà cung cấp, 1 số đơn), in phiếu đề xuất theo mẫu, "Sếp đã duyệt"
 * theo đơn, và THAY PHIẾU khi đơn đã ký cần gỡ dòng / sửa số mua. Màn "Lệnh mua vật tư" vẫn tạo được
 * đơn trong phạm vi 1 lệnh như trước.
 */
export default function DonDatHangPage() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const { proposals, createSupplierOrder, approveSupplierOrder, cancelSupplierOrder, removeSupplierOrderItem, reviseSupplierOrder, closeSupplierOrderShortage } = useInspection()
  const { data: materials, isLoading: materialsLoading } = useFetch(getMaterials)
  const { data: orders, refetch: refetchOrders } = useFetch(() => getSupplierOrders())
  useRealtimeRefetch(['purchase-proposals'], refetchOrders)
  const buyerByMaterialId = buildBuyerByMaterialId(materials ?? [])

  const [filter, setFilter] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [approving, setApproving] = useState<SupplierOrder | null>(null)
  const [cancelling, setCancelling] = useState<SupplierOrder | null>(null)
  const [revising, setRevising] = useState<SupplierOrder | null>(null)
  const [closingShort, setClosingShort] = useState<SupplierOrder | null>(null)
  const [printErr, setPrintErr] = useState('')

  // Vật tư CỦA TÔI chờ vào đơn, của MỌI lệnh - sắp theo ngày cần về (7.1: hệ thống gợi ý dòng cùng
  // vật tư bằng cách xếp chúng cạnh nhau).
  const looseRows: LooseRow[] = useMemo(() => {
    if (materialsLoading) return []
    const rows: LooseRow[] = []
    for (const p of visibleProposalsFor(user, proposals, buyerByMaterialId)) {
      const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
      for (const item of mine) {
        if (isPending(item) && !item.supplierOrderId && item.itemId) {
          rows.push({ proposalId: p.id, piCode: p.lenhCode, deadline: item.deadline ?? p.deadline, item })
        }
      }
    }
    return rows.sort((a, b) =>
      a.item.name.localeCompare(b.item.name, 'vi') || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'),
    )
  }, [proposals, user, buyerByMaterialId, materialsLoading])

  const q = filter.trim().toLowerCase()
  const shown = q ? looseRows.filter(r => r.item.name.toLowerCase().includes(q) || r.piCode.toLowerCase().includes(q)) : looseRows
  const checkedRows = looseRows.filter(r => checked.has(r.item.itemId!))
  const activeOrders = (orders ?? []).filter(o => o.status !== 'CANCELLED')
  const labelOf = (o: SupplierOrder) => `${o.supplierName} – Số ${o.code}`
  const proposalIdsOf = (o: SupplierOrder) => [...new Set(o.items.map(it => it.proposalId))]

  const toggle = (itemId: string) => setChecked(prev => {
    const next = new Set(prev)
    if (next.has(itemId)) next.delete(itemId)
    else next.add(itemId)
    return next
  })

  const print = async (o: SupplierOrder) => {
    setPrintErr('')
    try {
      await printSupplierOrderFile(o.id)
    } catch (e) {
      setPrintErr(`In phiếu đơn ${labelOf(o)} thất bại: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const afterOrderChange = () => { refetchOrders() }

  return (
    <div>
      <h2 style={pageTitle}>Đơn đặt hàng</h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-6)' }}>
        Gộp vật tư của nhiều lệnh sản xuất vào 1 đơn đặt hàng cho cùng nhà cung cấp, in phiếu đề xuất, xin Giám đốc ký rồi bấm &quot;Sếp đã duyệt&quot; ở đúng đơn đó.
      </div>

      {/* ── Vật tư chờ vào đơn ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          <ClipboardList size={16} color="var(--fg-d97706)" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Vật tư chờ vào đơn</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{looseRows.length} dòng, xếp theo vật tư rồi ngày cần về</span>
          <div style={{ flex: 1 }} />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Lọc theo vật tư hoặc lệnh…"
            aria-label="Lọc vật tư chờ vào đơn"
            style={{ width: isMobile ? '100%' : 240, padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
          />
        </div>
        {shown.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: 'var(--text3)' }}>{looseRows.length === 0 ? 'Không có vật tư nào chờ vào đơn.' : 'Không có vật tư khớp bộ lọc.'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 32 }} />
                  <th style={th}>Vật tư</th>
                  <th style={th}>Quy cách</th>
                  <th style={th}>Lệnh</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cần mua</th>
                  <th style={{ ...th, textAlign: 'right' }}>Số mua</th>
                  <th style={th}>ĐVT</th>
                  <th style={th}>Cần về</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, idx) => {
                  const sameAsPrev = idx > 0 && shown[idx - 1].item.name === r.item.name
                  return (
                    <tr key={r.item.itemId} style={{ borderTop: sameAsPrev ? '1px dashed var(--border)' : '1px solid var(--border)' }}>
                      <td style={td}>
                        <input type="checkbox" aria-label={`Chọn ${r.item.name} của ${r.piCode}`} checked={checked.has(r.item.itemId!)} onChange={() => toggle(r.item.itemId!)} />
                      </td>
                      <td style={{ ...td, fontWeight: 600, color: sameAsPrev ? 'var(--text3)' : 'var(--text)' }}>
                        {r.item.name}
                        {r.item.stockLengthMm != null && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--fg-e65100)' }}>· cây {r.item.stockLengthMm}mm</span>}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{r.item.spec || '—'}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{r.piCode}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{r.item.buyQty}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{r.item.purchaseQty}</td>
                      <td style={{ ...td, color: 'var(--text3)' }}>{r.item.unit}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDay(r.deadline)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          {checkedRows.length > 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Đã chọn {checkedRows.length} dòng của {new Set(checkedRows.map(r => r.proposalId)).size} lệnh</span>}
          <button
            onClick={() => setCreating(true)}
            disabled={checkedRows.length === 0}
            style={{ ...primary, padding: '7px 16px', fontSize: 13, background: checkedRows.length === 0 ? 'var(--bg-93c5fd)' : 'var(--bg-2563eb)', cursor: checkedRows.length === 0 ? 'default' : 'pointer' }}
          >
            <ClipboardList size={14} /> Tạo đơn đặt hàng
          </button>
        </div>
      </div>

      {/* ── Đơn của tôi ── */}
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--space-3)' }}>Đơn của tôi</div>
      {printErr && (
        <div style={{ marginBottom: 12, padding: '8px 10px', fontSize: 12, color: 'var(--fg-991b1b)', background: 'var(--bg-fee2e2)', border: '1px solid var(--fg-fca5a5)', borderRadius: 8 }}>{printErr}</div>
      )}
      {activeOrders.length === 0 ? (
        <EmptyState icon={<ClipboardList size={28} />} message="Chưa có đơn đặt hàng nào" />
      ) : activeOrders.map(o => {
        const draft = o.status === 'DRAFT'
        return (
          <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: draft ? 'var(--bg-fffbeb)' : 'var(--surface2)' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{labelOf(o)}</span>
              {o.revision > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-dc2626)' }}>THAY PHIẾU lần {o.revision}</span>}
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{STATUS_LABEL[o.status]}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => void print(o)} style={btn}><Printer size={13} /> In phiếu</button>
              {draft && <button onClick={() => setCancelling(o)} style={btn}>Huỷ đơn</button>}
              {draft && <button onClick={() => setApproving(o)} style={primary}><FileCheck2 size={13} /> Sếp đã duyệt</button>}
              {!draft && <button onClick={() => setRevising(o)} style={btn}><RotateCcw size={13} /> Thay phiếu</button>}
              {!draft && o.items.some(isShort) && <button onClick={() => setClosingShort(o)} style={btn}>Đóng phần thiếu</button>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Vật tư</th>
                    <th style={th}>Lệnh</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cần mua</th>
                    <th style={{ ...th, textAlign: 'right' }}>Số mua</th>
                    <th style={{ ...th, textAlign: 'right' }}>Đã nhận</th>
                    <th style={th}>ĐVT</th>
                    {draft && <th style={{ ...th, width: 40 }} />}
                  </tr>
                </thead>
                <tbody>
                  {o.items.map(it => (
                    <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontWeight: 600 }}>{it.materialName}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{it.orderCode ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{it.buyQty}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                        {it.purchaseQty}
                        {it.purchaseQty > it.buyQty && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--fg-2563eb)' }}>mua dư +{Math.round((it.purchaseQty - it.buyQty) * 10000) / 10000}</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {it.receivedQty}
                        {it.shortClosedQty != null && (
                          <span title={it.shortCloseReason ?? ''} style={{ display: 'block', fontSize: 11, color: 'var(--fg-dc2626)' }}>
                            đã đóng thiếu {it.shortClosedQty}{it.shortCloseReason ? `: ${it.shortCloseReason}` : ''}
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, color: 'var(--text3)' }}>{it.unit}</td>
                      {draft && (
                        <td style={td}>
                          {it.receivedQty === 0 && (
                            <button
                              onClick={() => void removeSupplierOrderItem(o.id, it.id, [it.proposalId]).then(afterOrderChange)}
                              title="Gỡ khỏi đơn"
                              aria-label={`Gỡ ${it.materialName} khỏi đơn`}
                              style={{ display: 'inline-flex', padding: 4, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text3)' }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {o.revision > 0 && o.reviseReason && (
              <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>Lý do thay phiếu: {o.reviseReason}</div>
            )}
          </div>
        )
      })}

      {creating && (
        <CreateSupplierOrderModal
          itemNames={checkedRows.map(r => `${r.item.name} (${r.piCode})`)}
          onClose={() => setCreating(false)}
          onConfirm={async supplierId => {
            await createSupplierOrder(supplierId, checkedRows.map(r => r.item.itemId!), checkedRows.map(r => r.proposalId))
            setChecked(new Set())
            afterOrderChange()
          }}
        />
      )}
      {approving && (
        <BossApproveModal
          itemCount={approving.items.length}
          orderLabel={labelOf(approving)}
          onClose={() => setApproving(null)}
          onConfirm={async file => {
            const url = await uploadDocument(file)
            await approveSupplierOrder(approving.id, url, proposalIdsOf(approving))
            afterOrderChange()
          }}
        />
      )}
      {cancelling && (
        <CancelSupplierOrderModal
          orderLabel={labelOf(cancelling)}
          everSigned={cancelling.revision > 0}
          onClose={() => setCancelling(null)}
          onConfirm={async reason => {
            await cancelSupplierOrder(cancelling.id, reason, proposalIdsOf(cancelling))
            afterOrderChange()
          }}
        />
      )}
      {closingShort && (
        <CloseShortageModal
          orderLabel={labelOf(closingShort)}
          lines={closingShort.items.filter(isShort)}
          onClose={() => setClosingShort(null)}
          onConfirm={async (itemIds, reason) => {
            await closeSupplierOrderShortage(closingShort.id, itemIds, reason, proposalIdsOf(closingShort))
            afterOrderChange()
          }}
        />
      )}
      {revising && (
        <ReviseSupplierOrderModal
          orderLabel={labelOf(revising)}
          onClose={() => setRevising(null)}
          onConfirm={async reason => {
            await reviseSupplierOrder(revising.id, reason, proposalIdsOf(revising))
            afterOrderChange()
          }}
        />
      )}
    </div>
  )
}
