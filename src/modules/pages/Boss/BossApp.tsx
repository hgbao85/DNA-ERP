'use client'
import { useState } from 'react'
import { LayoutDashboard, Package, LogOut, CalendarClock, Warehouse, ClipboardCheck, Check, X, ChevronLeft, User as UserIcon } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useInspection, PROPOSAL_STATUS_LABELS, type PurchaseProposal, type PurchaseProposalItem, type ProposalQuote } from '../../../context/InspectionContext'
import PurchaseProposalAuditTrail from '../../../components/PurchaseProposalAuditTrail'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import { getMaterials, getUsers } from '../../../services/api'
import { buildBuyerByMaterialId, groupItemsByBuyer, rollupStatusOf, UNASSIGNED_BUYER } from '../../../utils/purchasingRouting'
import SKUReviewPage from '../ProductionPlan/SKUReviewPage'
import SKUListPage from '../ProductionPlan/SKUListPage'
import VatTuDashboardPage from '../ProductionPlan/VatTuDashboardPage'
import ThongKePagePlan from '../Manufacturing/ThongKePagePlan'
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'
import LenhSXPage from '../ProductionPlan/LenhSXPage'


const ACCENT    = '#2e7d32'
const ACCENT_BG = '#e8f5e9'

type Page           = 'cho-duyet' | 'thong-ke' | 'sku-list' | 'vat-tu' | 'kho'
type ChoDuyetFilter = 'sku-moi' | 'so-sanh-gia' | 'lenh-sx'


// ── So sánh giá section ───────────────────────────────────────────────────────

// Các PurchaseProposal con của cùng 1 đơn gốc chia sẻ chung requestId (xem toProposal(),
// purchasing-api.ts) — nhóm lại để Boss duyệt 1 lần/đơn.
function groupByRequestId(proposals: PurchaseProposal[]): PurchaseProposal[][] {
  const map = new Map<string, PurchaseProposal[]>()
  proposals.forEach(p => {
    if (!map.has(p.requestId)) map.set(p.requestId, [])
    map.get(p.requestId)!.push(p)
  })
  return [...map.values()]
}

function SoSanhGiaSection({ proposals, onApprove, onReject }: {
  proposals: PurchaseProposal[]
  onApprove: (id: string, chosen: Record<string, string>) => void
  onReject:  (id: string, reason: string, itemIds?: string[]) => void
}) {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  // Người đề xuất đang xem chi tiết (2026-08-25) - null = còn ở màn "danh sách người đề xuất" của
  // đơn, chưa chọn ai. Xem UNASSIGNED_BUYER cho ca vật tư chưa gán người mua nào.
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null)
  const [rejectMode,   setRejectMode]   = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  // chosen[materialId] = quoteId đã chọn (KHÔNG phải supplierName - trùng tên NCC hoặc còn báo giá
  // cũ chưa dọn sau 1 vòng "Báo giá lại" sẽ khớp nhầm nếu dùng tên, xem D.h3-quote-id-not-name).
  // Key theo materialId (KHÔNG phải item.name - 2 vật tư khác nhau có thể trùng tên hiển thị, vd
  // nhiều loại "Sắt phi" khác đường kính - xem purchasing-api.ts D.p6-quote-key-collision).
  // Gộp item của mọi kho trong đơn.
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const itemKey = (item: PurchaseProposalItem) => String(item.materialId)
  const fmt = (n: number) => n.toLocaleString('vi-VN')

  // Material.buyerId + tên hiển thị của từng người mua - cần để tách "danh sách người đề xuất"
  // (2026-08-25, báo cáo thật: Sếp bấm Từ chối trên màn cũ vô tình từ chối LUÔN cả phần của người
  // khác đang cùng SUBMITTED trong 1 đơn gộp, dù handleReject đã lọc theo status - vì màn cũ gộp
  // phẳng mọi người mua vào 1 danh sách/1 cặp nút Duyệt-Từ chối duy nhất).
  const { data: materials } = useFetch(getMaterials)
  const { data: users } = useFetch(getUsers)
  const buyerByMaterialId = buildBuyerByMaterialId(materials ?? [])
  const nameByBuyerId = new Map((users ?? []).map(u => [String(u.id), u.name]))
  const buyerName = (buyerId: string) => buyerId === UNASSIGNED_BUYER ? 'Chưa gán người mua' : (nameByBuyerId.get(buyerId) ?? 'Người dùng đã xoá')

  const groups = groupByRequestId(proposals)
  // Đơn hiện trong hàng chờ duyệt ngay khi có ít nhất 1 VẬT TƯ báo giá xong và gửi lên — không cần
  // chờ đủ mọi vật tư/mọi người mua hàng trong đơn (2026-08-25, "duyệt riêng từng người mua hàng").
  // p.status (rollup) không còn phản ánh đúng: 1 đề xuất gộp có thể rollup 'quoting' (Trâm còn báo
  // giá dở) trong khi phần của Nhàn đã SUBMITTED và cần Sếp xử lý ngay.
  const visibleGroups = groups.filter(g => g.some(p => p.items.some(i => i.status === 'submitted')))
  const pendingCount = visibleGroups.length
  const selectedGroup = visibleGroups.find(g => g[0].requestId === selectedRequestId) ?? null

  const openDetail = (group: PurchaseProposal[]) => {
    setSelectedRequestId(group[0].requestId)
    setSelectedBuyerId(null)
    setRejectMode(false)
    setRejectReason('')
    // Pre-fill chosen (theo quoteId) từ chosenSuppliers cũ hoặc NCC rẻ nhất, gộp item của mọi kho
    // trong đơn. Nhánh chosenSuppliers vẫn phải tra theo tên (BE chỉ trả lại tên NCC đã chọn ở
    // đó, không phải quoteId) - nhưng đây chỉ là giá trị GỢI Ý ban đầu, Sếp vẫn thấy đúng dòng
    // nào đang highlight và tự bấm lại nếu sai trước khi Duyệt; điểm mất an toàn thật (gửi thẳng
    // id lên BE lúc bấm Duyệt mà không tra lại theo tên) đã bỏ ở approveProposal().
    const init: Record<string, string> = {}
    group.forEach(p => {
      p.items.forEach(item => {
        const key = itemKey(item)
        const offers: ProposalQuote[] = p.quotes?.[key] ?? []
        if (p.chosenSuppliers?.[key]) {
          const match = offers.find(q => q.supplierName === p.chosenSuppliers![key])
          if (match?.id) init[key] = match.id
        } else {
          const cheapest = offers
            .filter(q => q.unitPrice != null && q.unitPrice > 0)
            .sort((a, b) => (a.unitPrice ?? 0) - (b.unitPrice ?? 0))[0]
          if (cheapest?.id) init[key] = cheapest.id
        }
      })
    })
    setChosen(init)
  }

  const openBuyer = (buyerId: string) => {
    setSelectedBuyerId(buyerId)
    setRejectMode(false)
    setRejectReason('')
  }

  // `chosen` chỉ được coi là hợp lệ khi quoteId trỏ tới đúng 1 báo giá CÓ GIÁ - không chỉ "có chọn
  // gì đó". Nhận `mergedQuotes` của đúng group đang xem (không tự suy từ `proposals` để tránh dò
  // nhầm sang báo giá trùng id ở đơn khác - quoteId là duy nhất toàn cục nên về logic không sai,
  // nhưng truyền tường minh rõ ràng hơn). Phòng thủ kép với chặn click ở dòng bảng bên dưới, để
  // không lệ thuộc duy nhất vào việc user không bao giờ click nhầm - phát hiện qua browser thật
  // 2026-08-15: trước đây không có chặn nào ở đây, Sếp chọn nhầm dòng rỗng vẫn bấm "Duyệt" được,
  // chỉ bị BE trả 400 sau khi đã round-trip (C2 vẫn đúng, nhưng trải nghiệm là "bấm xong mới biết
  // sai" thay vì thấy ngay tại chỗ, D.c2-boss-quote-picker-no-guard).
  // 2026-08-25: chỉ soi các dòng ĐANG submitted (`items` truyền vào phải là submittedItems, không
  // phải toàn bộ item của đơn) - vật tư còn NEW/QUOTING của đồng nghiệp khác không cần chọn NCC
  // mới duyệt được phần đã sẵn sàng.
  const allChosen = (items: PurchaseProposalItem[], mergedQuotes: Record<string, ProposalQuote[]>) =>
    items.length > 0 && items.every(item => {
      const offer = (mergedQuotes[itemKey(item)] ?? []).find(q => q.id === chosen[itemKey(item)])
      return !!offer && offer.unitPrice != null && offer.unitPrice > 0
    })

  // Duyệt/Từ chối giờ luôn nhận kèm `buyerItems` - đúng tập item CỦA 1 NGƯỜI ĐỀ XUẤT đang xem, để
  // không đụng tới báo giá của người khác dù họ CÙNG LÚC cũng đang SUBMITTED trong cùng đơn gộp
  // (2026-08-25, báo cáo thật: màn cũ gộp phẳng mọi người mua vào 1 cặp nút Duyệt/Từ chối - từ chối
  // 1 người thành ra từ chối luôn người khác nếu cả 2 đang cùng chờ duyệt). So khớp bằng
  // `item.itemId` (id thật, ổn định) thay vì object reference - `buyerItems` và `p.items` trỏ tới
  // cùng object nên reference cũng đúng, nhưng itemId rõ ràng hơn khi đọc lại code sau này.
  const handleApprove = (group: PurchaseProposal[], buyerItems: PurchaseProposalItem[]) => {
    const targetIds = new Set(
      buyerItems.filter(item => item.status === 'submitted').map(item => item.itemId).filter((id): id is string => !!id),
    )
    group.forEach(p => {
      const chosenForP: Record<string, string> = {}
      // Chỉ duyệt đúng các dòng ĐANG submitted CỦA NGƯỜI NÀY trong proposal này - không gửi kèm
      // materialId của dòng còn NEW/QUOTING hay của đồng nghiệp khác (BE approve() coi các key
      // trong dto LÀ batch đang duyệt, xem purchase-proposals.service.ts#approve).
      p.items.forEach(item => {
        if (!item.itemId || !targetIds.has(item.itemId)) return
        const key = itemKey(item)
        if (chosen[key]) chosenForP[key] = chosen[key]
      })
      if (Object.keys(chosenForP).length > 0) onApprove(p.id, chosenForP)
    })
    setSelectedBuyerId(null)
  }

  const handleReject = (group: PurchaseProposal[], buyerItems: PurchaseProposalItem[]) => {
    const reason = rejectReason || 'Không có lý do'
    const targetIds = new Set(
      buyerItems.filter(item => item.status === 'submitted').map(item => item.itemId).filter((id): id is string => !!id),
    )
    // Chỉ từ chối đúng batch item đang SUBMITTED CỦA NGƯỜI NÀY - vật tư của đồng nghiệp khác
    // (kể cả đang CÙNG submitted) không bị đụng tới.
    group.forEach(p => {
      const itemIds = p.items.filter(item => !!item.itemId && targetIds.has(item.itemId)).map(item => item.itemId!)
      if (itemIds.length > 0) onReject(p.id, reason, itemIds)
    })
    setSelectedBuyerId(null)
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selectedGroup) {
    const group = selectedGroup
    const meta = group[0]
    const items = group.flatMap(p => p.items)
    const submittedItemsAll = items.filter(item => item.status === 'submitted')
    const readyAll = submittedItemsAll.length > 0
    const buyerGroups = groupItemsByBuyer(items, buyerByMaterialId)
    const selectedBuyer = buyerGroups.find(g => g.buyerId === selectedBuyerId) ?? null

    const mergedQuotes: Record<string, ProposalQuote[]> = {}
    group.forEach(p => { Object.entries(p.quotes ?? {}).forEach(([name, offers]) => { mergedQuotes[name] = offers }) })

    const headerBar = (
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => (selectedBuyer ? setSelectedBuyerId(null) : setSelectedRequestId(null))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)', marginBottom: 10 }}
        >
          <ChevronLeft size={13} /> {selectedBuyer ? 'Người đề xuất' : 'Danh sách'}
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{meta.salesOrderCode ?? '—'}</h2>
          <span style={{ fontSize: 14, color: 'var(--text2)' }}>{meta.skuCode}{meta.skuName ? ` — ${meta.skuName}` : ''}</span>
          {selectedBuyer && (
            <>
              <span style={{ fontSize: 14, color: 'var(--text3)' }}>/</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{buyerName(selectedBuyer.buyerId)}</span>
            </>
          )}
          <div style={{ flex: 1 }} />
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            border: `1px solid ${readyAll ? 'var(--border)' : '#fde68a'}`,
            color: readyAll ? 'var(--text2)' : '#92400e',
            background: readyAll ? 'var(--surface2)' : '#fffbeb',
          }}>
            {submittedItemsAll.length}/{items.length} vật tư đã gửi
          </span>
        </div>
        {meta.deadline && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)' }}>
            Deadline: <strong style={{ color: 'var(--text2)' }}>{new Date(meta.deadline).toLocaleDateString('vi-VN')}</strong>
          </div>
        )}
      </div>
    )

    // ── Level 2: đã chọn 1 người đề xuất - xem/duyệt/từ chối đúng phần của họ ──────
    if (selectedBuyer) {
      const buyerItems = selectedBuyer.items
      const submittedItems = buyerItems.filter(item => item.status === 'submitted')
      const otherItems = buyerItems.filter(item => item.status !== 'submitted')
      const submittedAts = buyerItems.map(i => i.submittedAt).filter((d): d is string => !!d).sort()
      const latestSubmittedAt = submittedAts[submittedAts.length - 1]
      const ready = submittedItems.length > 0

      const totalChosen = submittedItems.reduce((sum, item) => {
        const quoteId = chosen[itemKey(item)]
        const offer = (mergedQuotes[itemKey(item)] ?? []).find(q => q.id === quoteId)
        return sum + (offer?.unitPrice ?? 0) * item.buyQty
      }, 0)

      return (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {headerBar}
          <div style={{ marginTop: -10, marginBottom: 16, fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 16 }}>
            <span>Gửi lúc {latestSubmittedAt ? format(new Date(latestSubmittedAt), 'HH:mm dd/MM/yyyy') : '—'}</span>
            {totalChosen > 0 && <span>Tổng dự kiến: <strong style={{ color: 'var(--text)' }}>{fmt(totalChosen)}đ</strong></span>}
          </div>

          {/* Vật tư khác CỦA CÙNG NGƯỜI NÀY chưa/đã qua lượt duyệt (còn QUOTING, hoặc đã
              PURCHASING/PURCHASED/REJECTED từ 1 lượt trước) - chỉ để biết còn gì chưa xong, KHÔNG
              tham gia chọn NCC/duyệt ở đây. */}
          {otherItems.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, background: 'var(--surface2)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                {otherItems.length} vật tư khác của {buyerName(selectedBuyer.buyerId)} chưa tới lượt duyệt hôm nay:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {otherItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 6,
                      color: PROPOSAL_STATUS_LABELS[item.status].color,
                      background: PROPOSAL_STATUS_LABELS[item.status].bg,
                      border: `1px solid ${PROPOSAL_STATUS_LABELS[item.status].border}`,
                    }}>
                      {PROPOSAL_STATUS_LABELS[item.status].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-item NCC selection - chỉ các dòng ĐANG submitted của người này */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {submittedItems.map((item, idx) => {
              const offers: ProposalQuote[] = mergedQuotes[itemKey(item)] ?? []
              const prices = offers.map(q => q.unitPrice).filter((x): x is number => x != null && x > 0)
              const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null
              const chosenQuoteId = chosen[itemKey(item)]
              const chosenOffer = offers.find(q => q.id === chosenQuoteId)
              const chosenName = chosenOffer?.supplierName

              return (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                  {/* Item header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                    {/* Chỉ vật tư sắt có (2026-08-26, xem PurchaseProposalItem.stockLengthMm) - Sếp
                        cần biết cây dài bao nhiêu khi so giá, nhất là từ khi có thể ra cây đặt riêng
                        khác 6000mm mặc định (auto_scan). */}
                    {item.stockLengthMm != null && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#e65100' }}>· cây {item.stockLengthMm}mm</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.khoLabel}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>·</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Cần mua <strong>{item.buyQty} {item.unit}</strong></span>
                    {chosenName && (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>·</span>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Đã chọn: <strong>{chosenName}</strong></span>
                      </>
                    )}
                  </div>

                  {offers.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>Chưa có báo giá — kho phụ trách chưa gửi</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: 'left' }}>
                          <th style={{ ...th, width: 36 }}></th>
                          <th style={th}>Nhà cung cấp</th>
                          <th style={{ ...th, textAlign: 'right' }}>Đơn giá</th>
                          <th style={th}>Dự kiến về</th>
                          <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
                          <th style={th}>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((q, qi) => {
                          const isChosen  = !!q.id && q.id === chosenQuoteId
                          const isCheapest = cheapestPrice != null && q.unitPrice === cheapestPrice && offers.length > 1
                          const total = q.unitPrice != null && q.unitPrice > 0 ? q.unitPrice * item.buyQty : null
                          // Báo giá chưa có đơn giá không chọn được - BE (approve()) chặn cứng ca này
                          // (D.c2-approve-without-price), chặn từ đây để Sếp thấy ngay tại chỗ thay vì
                          // bấm "Duyệt" xong mới nhận banner lỗi (D.c2-boss-quote-picker-no-guard).
                          const selectable = q.unitPrice != null && q.unitPrice > 0
                          return (
                            <tr
                              key={qi}
                              onClick={() => { if (q.id && selectable) setChosen(prev => ({ ...prev, [itemKey(item)]: q.id! })) }}
                              style={{
                                borderTop: '1px solid var(--border)',
                                cursor: selectable ? 'pointer' : 'not-allowed',
                                opacity: selectable ? 1 : 0.5,
                                background: isChosen ? 'var(--surface2)' : undefined,
                              }}
                              onMouseEnter={e => { if (!isChosen && selectable) e.currentTarget.style.background = 'var(--surface2)' }}
                              onMouseLeave={e => { if (!isChosen) e.currentTarget.style.background = '' }}
                            >
                              <td style={{ ...td, width: 36, paddingRight: 0 }}>
                                <div style={{
                                  width: 16, height: 16, borderRadius: '50%',
                                  border: `2px solid ${isChosen ? '#18181b' : 'var(--border)'}`,
                                  background: isChosen ? '#18181b' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isChosen && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                                </div>
                              </td>
                              <td style={{ ...td, fontWeight: isChosen ? 600 : 400 }}>
                                {q.supplierName}
                                {isCheapest && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)' }}>↓ rẻ nhất</span>}
                                {!selectable && <span style={{ marginLeft: 6, fontSize: 11, color: '#c62828' }}>chưa có giá - không chọn được</span>}
                              </td>
                              <td style={{ ...td, textAlign: 'right', fontWeight: isChosen ? 600 : 400 }}>
                                {q.unitPrice ? fmt(q.unitPrice) + 'đ' : '—'}
                              </td>
                              <td style={{ ...td, color: 'var(--text3)' }}>
                                {q.expectedDate ? new Date(q.expectedDate).toLocaleDateString('vi-VN') : '—'}
                              </td>
                              <td style={{ ...td, textAlign: 'right', fontWeight: isChosen ? 600 : 400 }}>
                                {total ? fmt(total) + 'đ' : '—'}
                              </td>
                              <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{q.note ?? '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer actions - chỉ áp dụng cho đúng người đề xuất đang xem */}
          <div style={{ marginTop: 14 }}>
            {!rejectMode ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setRejectMode(true)}
                  disabled={!ready}
                  title={!ready ? 'Chưa có vật tư nào gửi báo giá để từ chối' : undefined}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 16px', fontSize: 13, fontWeight: 500,
                    border: '1px solid var(--border)', borderRadius: 6,
                    background: ready ? 'var(--surface)' : 'var(--surface2)',
                    color: ready ? 'var(--text2)' : 'var(--text3)',
                    cursor: ready ? 'pointer' : 'not-allowed',
                  }}
                >
                  <X size={13} /> Từ chối
                </button>
                <button
                  onClick={() => handleApprove(group, buyerItems)}
                  disabled={!ready || !allChosen(submittedItems, mergedQuotes)}
                  title={!ready ? 'Chưa có vật tư nào gửi báo giá' : undefined}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '7px 20px', fontSize: 13, fontWeight: 600,
                    border: 'none', borderRadius: 6,
                    background: ready && allChosen(submittedItems, mergedQuotes) ? '#18181b' : 'var(--surface2)',
                    color: ready && allChosen(submittedItems, mergedQuotes) ? '#fff' : 'var(--text3)',
                    cursor: ready && allChosen(submittedItems, mergedQuotes) ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Check size={13} /> Duyệt{!ready ? ' (chưa có vật tư nào gửi)' : !allChosen(submittedItems, mergedQuotes) ? ' (chọn đủ NCC)' : ''}
                </button>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--surface)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Lý do từ chối</div>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Nhập lý do..."
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => { setRejectMode(false); setRejectReason('') }}
                    style={{ padding: '6px 14px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)' }}
                  >Hủy</button>
                  <button
                    onClick={() => handleReject(group, buyerItems)}
                    style={{ padding: '6px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', cursor: 'pointer' }}
                  >Xác nhận từ chối</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 20 }}>
          <PurchaseProposalAuditTrail proposalId={group.map(p => p.id)} />
        </div>
        </div>
      )
    }

    // ── Level 1: danh sách người đề xuất trong đơn này ────────────────────────────
    return (
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {headerBar}

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
          {buyerGroups.map(bg => {
            const status = rollupStatusOf(bg.items)
            const cfg = PROPOSAL_STATUS_LABELS[status]
            const submittedCount = bg.items.filter(i => i.status === 'submitted').length
            return (
              <div
                key={bg.buyerId}
                onClick={() => openBuyer(bg.buyerId)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserIcon size={14} color="var(--text3)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{buyerName(bg.buyerId)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {bg.items.length} vật tư{submittedCount > 0 ? ` · ${submittedCount} đã gửi` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                }}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 20 }}>
        <PurchaseProposalAuditTrail proposalId={group.map(p => p.id)} />
      </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  if (visibleGroups.length === 0) {
    return (
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>So sánh giá</h2>
        <div style={{ marginTop: 40, padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 14 }}>
          Chưa có đề xuất mua hàng nào được gửi lên
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>So sánh giá</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>
          {pendingCount > 0 ? `${pendingCount} đơn chờ phê duyệt` : 'Tất cả đã được xử lý'}
        </p>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>PO</th>
              <th style={th}>Mã nhà máy</th>
              <th style={{ ...th, textAlign: 'right' }}>Vật tư</th>
              <th style={th}>Deadline</th>
              <th style={th}>Vật tư đã gửi</th>
              <th style={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map(group => {
              const meta = group[0]
              const groupItems = group.flatMap(p => p.items)
              const submittedCount = groupItems.filter(i => i.status === 'submitted').length
              const ready = submittedCount > 0
              return (
                <tr
                  key={meta.requestId}
                  onClick={() => openDetail(group)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{meta.salesOrderCode ?? '—'}</td>
                  <td style={td}>
                    <span style={{ fontWeight: 600 }}>{meta.skuCode}</span>
                    {meta.skuName && <span style={{ marginLeft: 6, color: 'var(--text3)', fontSize: 12 }}>{meta.skuName}</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{group.reduce((n, p) => n + p.items.length, 0)}</td>
                  <td style={{ ...td, fontSize: 12, color: meta.deadline ? 'var(--text2)' : 'var(--text3)' }}>
                    {meta.deadline ? new Date(meta.deadline).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{submittedCount}/{groupItems.length}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      border: `1px solid ${ready ? 'var(--border)' : '#fde68a'}`,
                      color: ready ? 'var(--text2)' : '#92400e',
                      background: ready ? 'var(--surface2)' : '#fffbeb',
                    }}>
                      {ready ? 'Chờ duyệt' : 'Chưa có vật tư nào gửi'}
                    </span>
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

const th: React.CSSProperties = { padding: '9px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 14px' }

// ── Tổng hợp chờ duyệt section ────────────────────────────────────────────────

const CHO_DUYET_FILTERS: { key: ChoDuyetFilter; label: string }[] = [
  { key: 'sku-moi',    label: 'SKU mới'       },
  { key: 'so-sanh-gia', label: 'So sánh giá'    },
  { key: 'lenh-sx',     label: 'Lệnh sản xuất'  },
]

function ChoDuyetSection({ proposals, onApprove, onReject }: {
  proposals: PurchaseProposal[]
  onApprove: (id: string, chosen: Record<string, string>) => void
  onReject:  (id: string, reason: string, itemIds?: string[]) => void
}) {
  const [filter, setFilter] = useState<ChoDuyetFilter>('so-sanh-gia')

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {CHO_DUYET_FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? ACCENT : 'var(--border)'}`,
                borderRadius: 20, cursor: 'pointer',
                background: active ? ACCENT_BG : 'var(--surface)',
                color: active ? ACCENT : 'var(--text2)',
                transition: 'all .15s',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {filter === 'sku-moi'    && <SKUReviewPage />}
      {filter === 'so-sanh-gia' && <SoSanhGiaSection proposals={proposals} onApprove={onApprove} onReject={onReject} />}
      {filter === 'lenh-sx'     && <LenhSXPage />}
    </div>
  )
}

// ── Main app ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'cho-duyet', label: 'Tổng hợp chờ duyệt', icon: <ClipboardCheck  size={16} /> },
  { id: 'thong-ke',  label: 'Tổng hợp lệnh SX',   icon: <CalendarClock   size={16} /> },
  { id: 'sku-list',  label: 'Danh sách SKU',       icon: <LayoutDashboard size={16} /> },
  { id: 'vat-tu',    label: 'Tổng hợp vật tư',     icon: <Package         size={16} /> },
  { id: 'kho',       label: 'Tổng hợp kho',        icon: <Warehouse       size={16} /> },
]

export default function BossApp() {
  const { user, logout } = useAuth()
  const { proposals, approveProposal, rejectProposal } = useInspection()
  const [page, setPage]  = useState<Page>('cho-duyet')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Giám đốc</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Đông Nam Á Corp</div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {NAV_ITEMS.map(item => {
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '8px 10px', marginBottom: 2, border: 'none',
                  borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                  background: active ? ACCENT_BG : 'transparent',
                  color: active ? ACCENT : 'var(--text)',
                  fontWeight: active ? 600 : 400,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT_BG, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Giám đốc</div>
            </div>
            <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
              <LogOut size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {page === 'cho-duyet' && <ChoDuyetSection proposals={proposals} onApprove={approveProposal} onReject={rejectProposal} />}
        {page === 'thong-ke'  && <ThongKePagePlan />}
        {page === 'sku-list'  && <SKUListPage readOnly />}
        {page === 'vat-tu'    && <VatTuDashboardPage />}
        {page === 'kho'       && <MfgWarehousesPage />}
      </div>
    </div>
  )
}
