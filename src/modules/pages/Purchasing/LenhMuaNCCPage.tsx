import { useState } from 'react'
import { focusAttr } from '../../../utils/notificationLink'
import { Check, ChevronLeft, ClipboardList, FileCheck2, Pencil, Printer, X } from 'lucide-react'
import { useInspection, PROPOSAL_STATUS_LABELS, itemStatusLabel, type PurchaseProposal, type PurchaseProposalItem } from '../../../context/InspectionContext'
import { useAuth, type User } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { getMaterials, uploadDocument } from '../../../services/api'
import { useWarehouseName } from '../../../hooks/useWarehouseName'
import { useIsCompact, useIsMobile } from '../../../hooks/useMediaQuery'
import { visibleProposalsFor, buildBuyerByMaterialId, splitItemsByOwner, rollupStatusOf, type MaterialBuyerMap } from '../../../utils/purchasingRouting'
import PurchaseProposalAuditTrail from '../../../components/PurchaseProposalAuditTrail'
import { ItemCard, ProposalCards } from './mobileCards'
import { BossApproveModal, CancelSupplierOrderModal, CreateSupplierOrderModal, printSupplierOrderFile } from './SupplierOrderModals'
import EmptyState from '../../../components/EmptyState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'

export default function LenhMuaNCCPage() {
  const { user } = useAuth()
  const { proposals: allProposals, createSupplierOrder, approveSupplierOrder, cancelSupplierOrder, removeSupplierOrderItem, updateOrderQty } = useInspection()
  const { data: materials, isLoading: materialsLoading } = useFetch(getMaterials)
  const buyerByMaterialId = buildBuyerByMaterialId(materials ?? [])
  // Purchasing chỉ thấy đề xuất chứa vật tư mình được gán mua (Material.buyerId) — xem purchasingRouting.ts
  // Status 'purchasing' (đang mua hàng, chờ nhận) đã chuyển sang màn "Theo dõi mua hàng", còn 'purchased'
  // (đã nhận đủ hàng) đã chuyển sang màn "Lịch sử đã mua" — cả 2 không còn hiển thị ở đây.
  // materials chưa tải xong -> buyerByMaterialId RỖNG -> mọi đề xuất trông như "chưa gán ai" ->
  // hiện NHẦM cho mọi nhân viên mua hàng rồi biến mất khi tải xong (D.p7-buyer-filter-loading-
  // flash, 2026-08-22). Chặn ở đây - rỗng lúc đang tải thay vì lộ nhầm đề xuất của người khác.
  //
  // Lọc theo ITEM của mình (2026-08-25) - trước đây lọc theo `p.status` (rollup) khiến 1 đề xuất
  // gộp biến mất khỏi màn này ngay khi rollup lên 'purchasing'/'purchased', dù phần vật tư của
  // MÌNH trong đó vẫn còn chờ xử lý.
  const proposals = materialsLoading
    ? []
    : visibleProposalsFor(user, allProposals, buyerByMaterialId).filter(p => {
        const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
        return mine.some(isPending)
      })

  return (
    <div>
      <h2 style={pageTitle}>Lệnh mua vật tư</h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-6)' }}>
        Dựa vào số lượng cần mua dưới đây để làm phiếu so sánh giá, xin Sếp ký duyệt, rồi tải file đã ký lên để Kho được phép nhận hàng. Nhà cung cấp bán theo số tối thiểu thì sửa ô &quot;Số mua&quot; trước khi in phiếu (chỉ được tăng).
      </div>

      {proposals.length > 0 ? (
        <ProposalSection
          user={user}
          buyerByMaterialId={buyerByMaterialId}
          proposals={proposals}
          onCreateOrder={createSupplierOrder}
          onApproveOrder={approveSupplierOrder}
          onCancelOrder={cancelSupplierOrder}
          onRemoveOrderItem={removeSupplierOrderItem}
          onUpdateOrderQty={updateOrderQty}
        />
      ) : (
        <EmptyState icon={<ClipboardList size={28} />} message="Không có lệnh mua nào cần xử lý" />
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 12px' }

/**
 * Dòng CHƯA được duyệt mua - tập mà nút "Sếp đã duyệt" tác động tới.
 *
 * Cố ý tính bằng cách LOẠI TRỪ 'purchasing'/'purchased' thay vì liệt kê 'new': từ 2026-08-27 luồng
 * chỉ còn NEW -> PURCHASING -> PURCHASED, nhưng dữ liệu cũ còn dòng kẹt ở 'quoting'/'submitted'/
 * 'rejected' của luồng báo giá đã gỡ - chúng phải hiện ra và duyệt được ở đây, nếu không sẽ treo
 * vĩnh viễn (BE bossApprove() nhận đúng 4 trạng thái này, xem PENDING_APPROVAL_STATUSES).
 */
const isPending = (item: PurchaseProposalItem) =>
  item.status !== 'purchasing' && item.status !== 'purchased'

/**
 * Ô "Số mua" của 1 dòng chờ duyệt (2026-11-04, YC7 mục 7.2): người mua được TĂNG số mua cho tròn
 * số tối thiểu NCC bán, không được giảm dưới số cần mua (BE chặn lại lần nữa). Phần dư hiện
 * "Mua dư" để Giám đốc thấy rõ khi ký phiếu; sau "Sếp đã duyệt" dòng rời khỏi bảng này nên không
 * còn sửa được ở đây.
 */
function OrderQtyCell({ item, onSave }: {
  item: PurchaseProposalItem
  onSave: (orderQty: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const isSteel = item.stockLengthMm != null
  const extra = item.purchaseQty - item.buyQty

  const start = () => {
    setValue(String(item.purchaseQty))
    setErr('')
    setEditing(true)
  }

  const save = async () => {
    const n = Number(value.replace(',', '.'))
    if (value.trim() === '' || !Number.isFinite(n)) { setErr('Nhập một con số'); return }
    if (n < item.buyQty) { setErr(`Không được nhỏ hơn số cần mua (${item.buyQty})`); return }
    if (isSteel && !Number.isInteger(n)) { setErr('Sắt mua theo cây - nhập số nguyên'); return }
    setBusy(true)
    setErr('')
    try {
      await onSave(n > item.buyQty ? n : null)
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
        <b>{item.purchaseQty}</b>
        {extra > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2563eb)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px' }}>
            Mua dư +{Math.round(extra * 10000) / 10000}
          </span>
        )}
        <button
          onClick={start}
          title="Sửa số mua (tăng cho tròn số tối thiểu nhà cung cấp bán)"
          aria-label="Sửa số mua"
          style={{ display: 'inline-flex', padding: 3, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)' }}
        >
          <Pencil size={12} />
        </button>
      </span>
    )
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          inputMode="decimal"
          aria-label="Số mua"
          min={item.buyQty}
          step={isSteel ? 1 : 'any'}
          value={value}
          autoFocus
          disabled={busy}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') setEditing(false)
          }}
          style={{ width: 90, padding: '4px 6px', fontSize: 13, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}
        />
        <button
          onClick={() => void save()}
          disabled={busy}
          title="Lưu"
          aria-label="Lưu số mua"
          style={{ display: 'inline-flex', padding: 5, border: 'none', borderRadius: 6, background: 'var(--bg-2563eb)', color: '#fff', cursor: busy ? 'default' : 'pointer' }}
        >
          <Check size={13} />
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={busy}
          title="Huỷ"
          aria-label="Huỷ sửa số mua"
          style={{ display: 'inline-flex', padding: 5, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: busy ? 'default' : 'pointer' }}
        >
          <X size={13} />
        </button>
      </span>
      {err && <span style={{ fontSize: 11, color: 'var(--fg-dc2626)', maxWidth: 220, textAlign: 'right' }}>{err}</span>}
    </span>
  )
}

/** Đơn đặt hàng NCC CHƯA duyệt có dòng trong đề xuất đang mở - gom từ các dòng (2026-11-04). */
interface DraftOrderGroup {
  id: string
  label: string
  items: PurchaseProposalItem[]
}

function draftOrdersOf(items: PurchaseProposalItem[]): DraftOrderGroup[] {
  const map = new Map<string, DraftOrderGroup>()
  for (const item of items) {
    if (!item.supplierOrderId) continue
    const g = map.get(item.supplierOrderId) ?? {
      id: item.supplierOrderId,
      label: `${item.supplierName ?? 'NCC'} – Số ${item.supplierOrderCode ?? '?'}`,
      items: [],
    }
    g.items.push(item)
    map.set(item.supplierOrderId, g)
  }
  return [...map.values()]
}

function ProposalSection({ user, buyerByMaterialId, proposals, onCreateOrder, onApproveOrder, onCancelOrder, onRemoveOrderItem, onUpdateOrderQty }: {
  user: User | null
  buyerByMaterialId: MaterialBuyerMap
  proposals: PurchaseProposal[]
  onCreateOrder: (supplierId: string, itemIds: string[], proposalIds: string[]) => Promise<void>
  onApproveOrder: (orderId: string, approvalFileUrl: string, proposalIds: string[]) => Promise<void>
  onCancelOrder: (orderId: string, reason: string, proposalIds: string[]) => Promise<void>
  onRemoveOrderItem: (orderId: string, itemId: string, proposalIds: string[]) => Promise<void>
  onUpdateOrderQty: (proposalId: string, itemId: string, orderQty: number | null) => Promise<void>
}) {
  const warehouseName = useWarehouseName()
  const isCompact = useIsCompact()
  const isMobile = useIsMobile()
  const canViewAudit = user?.role === 'BOSS' || user?.role === 'ADMIN'
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Đơn đặt hàng NCC (2026-11-04): dòng được tick để gom đơn, popup tạo/duyệt/huỷ đơn.
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [approvingOrder, setApprovingOrder] = useState<DraftOrderGroup | null>(null)
  const [cancellingOrder, setCancellingOrder] = useState<DraftOrderGroup | null>(null)
  const openProposal = (id: string | null) => {
    setChecked(new Set())
    setSelectedId(id)
  }

  // Đếm theo ITEM của mình (2026-08-25) - p.status (rollup) không còn phản ánh đúng "còn việc gì
  // của TÔI chưa làm" khi đề xuất gộp nhiều người mua.
  const pendingCount = proposals.filter(p => {
    const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    return mine.some(isPending)
  }).length
  const selected = proposals.find(p => p.id === selectedId) ?? null

  // Rollup CỦA RIÊNG PHẦN MÌNH trong 1 đề xuất (2026-08-25) - KHÔNG dùng thẳng `p.status` (rollup
  // của CẢ đề xuất, gồm cả phần đồng nghiệp khác): 1 đề xuất gộp nhiều người mua có thể rollup
  // 'purchasing' vì đồng nghiệp đã duyệt xong, trong khi phần CỦA TÔI còn chưa duyệt - hiện nhầm
  // trạng thái ở đây khiến người dùng tưởng đã xong (báo cáo thật từ Trâm, 2026-08-25).
  const myRollupStatus = (p: PurchaseProposal): PurchaseProposal['status'] => {
    const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    return mine.length > 0 ? rollupStatusOf(mine) : p.status
  }

  const itemStatusTag = (item: PurchaseProposalItem) => {
    const cfg = itemStatusLabel(item)
    return <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '2px 8px' }}>{cfg.label}</span>
  }

  const statusTag = (p: PurchaseProposal) => {
    const cfg = PROPOSAL_STATUS_LABELS[myRollupStatus(p)]
    return <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '2px 8px' }}>{cfg.label}</span>
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const p = selected
    const { mine, others } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    const pendingItems = mine.filter(isPending)
    const doneItems = mine.filter(item => !isPending(item))
    const looseItems = pendingItems.filter(item => !item.supplierOrderId)
    const draftOrders = draftOrdersOf(pendingItems)
    const checkedLoose = looseItems.filter(item => item.itemId && checked.has(item.itemId))
    const toggle = (itemId: string) => setChecked(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })

    // Bảng dòng chờ duyệt - dùng chung cho khối "Chưa vào đơn" (có ô tick) và từng đơn chưa duyệt
    // (có nút gỡ dòng khỏi đơn). Số mua vẫn sửa được tới lúc "Sếp đã duyệt" (YC7 mục 7.2).
    const renderItems = (items: PurchaseProposalItem[], opts: { selectable?: boolean; orderId?: string }) => {
      const removeBtn = (item: PurchaseProposalItem) => opts.orderId && item.itemId ? (
        <button
          onClick={() => void onRemoveOrderItem(opts.orderId!, item.itemId!, [p.id])}
          title="Gỡ khỏi đơn"
          aria-label={`Gỡ ${item.name} khỏi đơn`}
          style={{ display: 'inline-flex', padding: 4, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text3)' }}
        >
          <X size={12} />
        </button>
      ) : null
      const checkbox = (item: PurchaseProposalItem) => opts.selectable && item.itemId ? (
        <input type="checkbox" aria-label={`Chọn ${item.name}`} checked={checked.has(item.itemId)} onChange={() => toggle(item.itemId!)} />
      ) : null
      if (isMobile) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
            {items.map((item, idx) => (
              <ItemCard
                key={idx}
                name={item.name}
                spec={item.spec}
                stockLengthMm={item.stockLengthMm}
                fields={[
                  { label: 'Tồn thực', value: <span style={{ color: 'var(--fg-dc2626)' }}>{item.actualStock}</span> },
                  { label: 'Cần mua', value: <><b style={{ color: 'var(--fg-d97706)' }}>{item.buyQty}</b> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{item.unit}</span></> },
                  { label: 'Số mua', value: item.itemId ? <OrderQtyCell item={item} onSave={q => onUpdateOrderQty(p.id, item.itemId!, q)} /> : item.purchaseQty },
                  { label: 'Hao hụt', value: item.purchaseWastePercentage ? `+${item.purchaseWastePercentage}%` : '—' },
                  { label: 'Hàng về kho', value: warehouseName(item.warehouseCode, item.khoLabel) },
                ]}
                footer={opts.selectable ? <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>{checkbox(item)} Chọn vào đơn</label> : removeBtn(item)}
              />
            ))}
          </div>
        )
      }
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                {(opts.selectable || opts.orderId) && <th style={{ ...th, width: 32 }} />}
                <th style={th}>Hàng về kho</th>
                <th style={th}>Vật tư</th>
                <th style={th}>Quy cách</th>
                <th style={{ ...th, textAlign: 'right' }}>Chiều dài</th>
                <th style={{ ...th, textAlign: 'right' }}>Tồn thực</th>
                <th style={{ ...th, textAlign: 'right' }}>Cần mua</th>
                <th style={{ ...th, textAlign: 'right' }}>Hao hụt</th>
                <th style={{ ...th, textAlign: 'right' }} title="Được tăng cho tròn số tối thiểu nhà cung cấp bán; Giám đốc duyệt bằng chữ ký trên phiếu">Số mua</th>
                <th style={th}>ĐVT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                  {(opts.selectable || opts.orderId) && <td style={td}>{opts.selectable ? checkbox(item) : removeBtn(item)}</td>}
                  <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{warehouseName(item.warehouseCode, item.khoLabel)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{item.name}</td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{item.spec || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontSize: 12, fontWeight: item.stockLengthMm != null ? 700 : 400, color: item.stockLengthMm != null ? 'var(--fg-e65100)' : 'var(--text3)' }}>
                    {item.stockLengthMm != null ? `${item.stockLengthMm}mm` : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--fg-dc2626)' }}>{item.actualStock}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--fg-d97706)' }}>{item.buyQty}</td>
                  <td style={{ ...td, textAlign: 'right', fontSize: 12, color: 'var(--text3)' }}>{item.purchaseWastePercentage ? `+${item.purchaseWastePercentage}%` : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {item.itemId ? <OrderQtyCell item={item} onSave={q => onUpdateOrderQty(p.id, item.itemId!, q)} /> : item.purchaseQty}
                  </td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 20, alignItems: isCompact ? 'stretch' : 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Back bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <button
            onClick={() => openProposal(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)' }}
          >
            <ChevronLeft size={14} /> Danh sách
          </button>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{p.salesOrderCode ?? '—'}</span>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{p.skuCode}{p.skuName ? ` — ${p.skuName}` : ''}</span>
          <div style={{ flex: 1 }} />
          {statusTag(p)}
          {p.deadline && (
            <span style={{ fontSize: 12, color: 'var(--fg-dc2626)', fontWeight: 600 }}>
              Deadline: {new Date(p.deadline).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
          {others.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--surface2)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                {others.length} vật tư khác trong đề xuất này do đồng nghiệp phụ trách mua:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {others.map((item, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
                    {item.name} {itemStatusTag(item)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Chờ Sếp duyệt (của mình) ── 2026-11-04: dòng phải vào 1 đơn đặt hàng NCC (chọn NCC, hệ
              thống cấp số đơn) rồi mới "Sếp đã duyệt" được - duyệt theo từng đơn, 1 phiếu ký cho 1 đơn. */}
          {pendingItems.length > 0 && (<div style={{ borderTop: others.length > 0 ? '1px solid var(--border)' : 'none' }}>
            {looseItems.length > 0 && (<div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface2)' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Chưa vào đơn đặt hàng</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Tick các vật tư mua cùng 1 nhà cung cấp rồi bấm &quot;Tạo đơn đặt hàng&quot;.</span>
              </div>
              {renderItems(looseItems, { selectable: true })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                {checkedLoose.length > 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Đã chọn {checkedLoose.length}</span>}
                <button
                  onClick={() => setCreatingOrder(true)}
                  disabled={checkedLoose.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? '100%' : undefined, gap: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: checkedLoose.length === 0 ? 'var(--bg-93c5fd)' : 'var(--bg-2563eb)', color: '#fff', cursor: checkedLoose.length === 0 ? 'default' : 'pointer' }}
                >
                  <ClipboardList size={14} /> Tạo đơn đặt hàng
                </button>
              </div>
            </div>)}

            {draftOrders.map(order => (
              <div key={order.id} style={{ borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--bg-fffbeb)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Đơn đặt hàng {order.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>chờ phiếu Sếp ký</span>
                </div>
                {renderItems(order.items, { orderId: order.id })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--fg-fde68a)', background: 'var(--bg-fffbeb)', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => void printSupplierOrderFile(order.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}
                  >
                    <Printer size={14} /> In phiếu
                  </button>
                  <button
                    onClick={() => setCancellingOrder(order)}
                    style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}
                  >
                    Huỷ đơn
                  </button>
                  <button
                    onClick={() => setApprovingOrder(order)}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: 'var(--bg-2563eb)', color: '#fff', cursor: 'pointer' }}
                  >
                    <FileCheck2 size={14} /> Sếp đã duyệt
                  </button>
                </div>
              </div>
            ))}
          </div>)}

          {/* ── Đã duyệt mua / đủ tồn kho (của mình) ── */}
          {doneItems.length > 0 && (<div style={{ borderTop: '1px solid var(--border)' }}>
            {/* Ghi chú "theo dõi ở..." đặt 1 lần ở tiêu đề thay vì lặp lại từng dòng. */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface2)' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Đã xử lý</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>{doneItems.length}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>theo dõi tiếp ở &quot;Theo dõi mua hàng&quot; / &quot;Lịch sử đã mua&quot;</span>
            </div>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
                {doneItems.map((item, idx) => (
                  <ItemCard
                    key={idx}
                    name={item.name}
                    spec={item.spec}
                    stockLengthMm={item.stockLengthMm}
                    fields={[]}
                    footer={itemStatusTag(item)}
                  />
                ))}
              </div>
            ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={th}>Vật tư</th>
                    <th style={th}>Quy cách</th>
                    <th style={{ ...th, textAlign: 'right' }}>Chiều dài</th>
                    <th style={th}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {doneItems.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontWeight: 600 }}>{item.name}</td>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{item.spec || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontSize: 12, fontWeight: item.stockLengthMm != null ? 700 : 400, color: item.stockLengthMm != null ? 'var(--fg-e65100)' : 'var(--text3)' }}>
                        {item.stockLengthMm != null ? `${item.stockLengthMm}mm` : '—'}
                      </td>
                      <td style={td}>{itemStatusTag(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>)}
        </div>
      </div>

      {/* Chỉ BOSS/ADMIN có AUDIT_LOG:VIEW (BE role-permissions.constant.ts) - nhân viên Mua hàng
          chỉ thấy khung báo "không có quyền" chiếm 300px vô ích, nên ẩn hẳn (không gọi API luôn). */}
      {canViewAudit && (
        <div style={isCompact ? {} : { width: 300, flexShrink: 0, position: 'sticky', top: 20 }}>
          <PurchaseProposalAuditTrail proposalId={p.id} />
        </div>
      )}

      {creatingOrder && (
        <CreateSupplierOrderModal
          itemNames={checkedLoose.map(item => item.name)}
          onClose={() => setCreatingOrder(false)}
          onConfirm={async supplierId => {
            await onCreateOrder(supplierId, checkedLoose.map(item => item.itemId!), [p.id])
            setChecked(new Set())
          }}
        />
      )}
      {approvingOrder && (
        <BossApproveModal
          itemCount={approvingOrder.items.length}
          orderLabel={approvingOrder.label}
          onClose={() => setApprovingOrder(null)}
          onConfirm={async file => {
            const url = await uploadDocument(file)
            await onApproveOrder(approvingOrder.id, url, [p.id])
          }}
        />
      )}
      {cancellingOrder && (
        <CancelSupplierOrderModal
          orderLabel={cancellingOrder.label}
          onClose={() => setCancellingOrder(null)}
          onConfirm={reason => onCancelOrder(cancellingOrder.id, reason, [p.id])}
        />
      )}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
        <ClipboardList size={16} color="var(--fg-d97706)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-92400e)' }}>Đề xuất mua từ Quản lý SX</span>
        {pendingCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-fef3c7)', color: 'var(--fg-92400e)', border: '1px solid var(--fg-fde68a)' }}>
            {pendingCount} chờ xử lý
          </span>
        )}
      </div>

      {isMobile ? (
        <ProposalCards
          proposals={proposals}
          onSelect={openProposal}
          badge={statusTag}
          meta={p => p.deadline && <span style={{ color: 'var(--fg-dc2626)', fontWeight: 600 }}>Deadline: {new Date(p.deadline).toLocaleDateString('vi-VN')}</span>}
        />
      ) : (
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto', background: 'var(--surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>PO</th>
              <th style={th}>PI</th>
              <th style={th}>Mã nhà máy</th>
              <th style={th}>Deadline</th>
              <th style={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map(p => {
              return (
                <tr
                  key={p.id}
                  {...focusAttr('PURCHASE_PROPOSAL', p.id)}
                  onClick={() => openProposal(p.id)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{p.salesOrderCode ?? '—'}</td>
                  <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text3)' }}>{p.piCode}</td>
                  <td style={td}>
                    <span style={{ fontWeight: 600 }}>{p.skuCode}</span>
                    {p.skuName && <span style={{ marginLeft: 6, color: 'var(--text3)', fontSize: 12 }}>{p.skuName}</span>}
                  </td>
                  <td style={{ ...td, color: p.deadline ? 'var(--fg-dc2626)' : 'var(--text3)', fontSize: 12, fontWeight: p.deadline ? 600 : 400 }}>
                    {p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={td}>{statusTag(p)}</td>
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
