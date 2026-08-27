import { useEffect, useState } from 'react'
import { ChevronLeft, Send, ClipboardList, CheckCircle2, X } from 'lucide-react'
import { useInspection, PROPOSAL_STATUS_LABELS, type PurchaseProposal, type PurchaseProposalItem, type ProposalQuote } from '../../../context/InspectionContext'
import { useAuth, type User } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { getMaterials, getMaterialSuppliers } from '../../../services/api'
import { visibleProposalsFor, buildBuyerByMaterialId, splitItemsByOwner, rollupStatusOf, type MaterialBuyerMap } from '../../../utils/purchasingRouting'
import PurchaseProposalAuditTrail from '../../../components/PurchaseProposalAuditTrail'
import { format } from 'date-fns'

/** Tên vật tư kèm chiều dài cây phải đặt (CHỈ vật tư sắt có, xem
 *  PurchaseProposalItem.stockLengthMm) - buyQty vô nghĩa nếu Purchasing không biết đặt cây dài
 *  bao nhiêu, nhất là từ khi solver có thể đề xuất cây KHÁC 6000mm mặc định (2026-08-26, Sếp mở
 *  lại auto_scan). Dùng chung cho mọi chỗ hiện tên vật tư trong màn này. */
function ItemName({ item }: { item: PurchaseProposalItem }) {
  return (
    <>
      {item.name}
      {item.stockLengthMm != null && (
        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#e65100' }}>
          · cây {item.stockLengthMm}mm
        </span>
      )}
    </>
  )
}

export default function LenhMuaNCCPage() {
  const { user } = useAuth()
  const { proposals: allProposals, acknowledgeProposal, saveProposalQuotes, submitProposalToDirector, requoteProposal } = useInspection()
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
  // MÌNH trong đó vẫn còn NEW/QUOTING/SUBMITTED/REJECTED cần xử lý (vd Trâm còn báo giá dở trong
  // khi phần của Nhàn đã được duyệt xong). Giữ đề xuất trong queue chừng nào còn ít nhất 1 dòng
  // của mình CHƯA xong (khác purchasing/purchased).
  const proposals = materialsLoading
    ? []
    : visibleProposalsFor(user, allProposals, buyerByMaterialId).filter(p => {
        const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
        return mine.some(item => item.status !== 'purchasing' && item.status !== 'purchased')
      })

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Lệnh mua — chọn NCC & báo giá</h2>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Nhập báo giá của nhiều nhà cung cấp cho từng vật tư (tối thiểu 1 NCC/vật tư), sau đó gửi Giám đốc so sánh và chọn duyệt.
      </div>

      {proposals.length > 0 ? (
        <ProposalSection
          user={user}
          buyerByMaterialId={buyerByMaterialId}
          proposals={proposals}
          onAcknowledge={acknowledgeProposal}
          onSaveQuotes={saveProposalQuotes}
          onSubmitToDirector={submitProposalToDirector}
          onRequote={requoteProposal}
        />
      ) : (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
          Không có lệnh mua nào cần xử lý
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 12px' }
const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', width: '100%' }

/** 1 dòng báo giá được tính là hợp lệ để gửi Giám đốc khi đủ cả 3: NCC + đơn giá + ngày dự kiến về. */
function isValidQuote(r: ProposalQuote): boolean {
  return r.supplierName.trim() !== '' && r.unitPrice != null && r.unitPrice > 0 && !!r.expectedDate
}

/** Mốc gửi Sếp duyệt MỚI NHẤT trong 1 nhóm item (2026-08-25) - `submittedAt` giờ ở cấp item, 1
 *  nhóm "submitted" của mình có thể gồm nhiều dòng gửi ở các thời điểm khác nhau (lưu rồi gửi
 *  từng đợt) nên hiện mốc gần nhất thay vì mốc của 1 dòng bất kỳ. */
function formatLatest(dates: (string | undefined)[]): string {
  const valid = dates.filter((d): d is string => !!d).sort()
  const latest = valid[valid.length - 1]
  return latest ? format(new Date(latest), 'HH:mm dd/MM/yyyy') : '—'
}

/**
 * Chọn NCC cho 1 dòng báo giá — BẮT BUỘC chọn từ danh sách NCC đã gắn sẵn cho đúng vật tư này
 * (Admin > Vật tư-NCC), tự điền giá tham khảo lần gần nhất. KHÔNG cho nhập tay - NCC mới phải
 * đăng ký trước ở màn "Vật tư-NCC" (Quản lý nhà cung cấp -> Gắn nhà cung cấp) rồi mới báo giá
 * được ở đây - tránh trùng tên do gõ lệch chính tả, đảm bảo mọi NCC đã báo giá đều có supplierId
 * thật để tra cứu/thống kê sau này.
 */
function SupplierPicker({ materialId, value, price, usedByOtherRows, onChange }: {
  materialId?: number
  value: string
  price: number | null
  /** Tên NCC đã chọn ở CÁC DÒNG KHÁC của cùng vật tư này - ẩn khỏi lựa chọn, tránh báo giá
   *  trùng 1 NCC 2 lần (không có ý nghĩa so sánh, "rẻ nhất" cũng bị trùng vô lý theo). */
  usedByOtherRows: string[]
  onChange: (patch: Partial<ProposalQuote>) => void
}) {
  const { data: registered } = useFetch(
    () => (materialId != null ? getMaterialSuppliers(materialId) : Promise.resolve([])),
    [materialId],
  )
  const allOptions = registered ?? []
  const options = allOptions.filter(s => s.supplierName === value || !usedByOtherRows.includes(s.supplierName))

  if (allOptions.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#c62828', maxWidth: 200 }}>
        Chưa có NCC nào cho vật tư này — vào &quot;Vật tư – NCC&quot; đăng ký trước.
      </div>
    )
  }
  if (options.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 200 }}>
        Đã dùng hết NCC có sẵn ở các dòng khác.
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={e => {
        const picked = options.find(s => s.supplierName === e.target.value)
        // Luôn gửi supplierId (kể cả undefined khi bỏ chọn về "— Chọn NCC —") - không được để
        // trống key này, nếu không id của lần chọn trước sẽ bị merge sót lại (xem updateRow).
        onChange({
          supplierName: e.target.value,
          supplierId: picked ? String(picked.supplierId) : undefined,
          unitPrice: price ?? picked?.price ?? null,
        })
      }}
      style={{ ...inp, width: 180 }}
    >
      <option value="">— Chọn NCC —</option>
      {options.map(s => (
        <option key={s.id} value={s.supplierName}>{s.supplierName} — {s.price.toLocaleString('vi-VN')}đ</option>
      ))}
    </select>
  )
}

// ─── Đề xuất mua từ Quản lý SX ───────────────────────────────────────────────

function ProposalSection({ user, buyerByMaterialId, proposals, onAcknowledge, onSaveQuotes, onSubmitToDirector, onRequote }: {
  user: User | null
  buyerByMaterialId: MaterialBuyerMap
  proposals: PurchaseProposal[]
  onAcknowledge: (id: string) => void
  onSaveQuotes: (id: string, quotes: Record<string, ProposalQuote[]>) => Promise<PurchaseProposal>
  onSubmitToDirector: (id: string, quotes: Record<string, ProposalQuote[]>) => void
  onRequote: (id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quoteEdits, setQuoteEdits] = useState<Record<string, Record<string, ProposalQuote[]>>>({})

  // Đếm theo ITEM của mình (2026-08-25) - p.status (rollup) không còn phản ánh đúng "còn việc gì
  // của TÔI chưa làm" khi đề xuất gộp nhiều người mua (vd rollup 'quoting' vì Trâm còn báo giá dở,
  // trong khi phần của tôi chưa ai tiếp nhận - vẫn cần đếm là "mới").
  const newCount = proposals.filter(p => {
    const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    return mine.some(item => item.status === 'new')
  }).length
  const selected = proposals.find(p => p.id === selectedId) ?? null

  // Key theo itemId (2026-08-26, L6) - KHÔNG phải materialId lẫn item.name. Lịch sử: từng key theo
  // item.name (2 vật tư trùng tên hiển thị đè mất nhau, D.p6-quote-key-collision), đổi sang
  // materialId, rồi materialId cũng KHÔNG còn duy nhất trong 1 đề xuất từ khi "gộp 1 PI = 1 form"
  // (1 vật tư đã PURCHASED phát sinh thiếu thêm tách DÒNG MỚI cùng materialId) - xem
  // purchasing-api.ts đầu file.
  const itemKey = (item: PurchaseProposalItem) => item.itemId ?? String(item.materialId)

  const getRows = (proposalId: string, key: string): ProposalQuote[] =>
    quoteEdits[proposalId]?.[key] ?? []

  const setRows = (proposalId: string, key: string, rows: ProposalQuote[]) =>
    setQuoteEdits(prev => ({
      ...prev,
      [proposalId]: { ...(prev[proposalId] ?? {}), [key]: rows },
    }))

  // Tự tạo sẵn dòng báo giá cho MỌI vật tư ĐANG QUOTING của mình ngay khi vào màn báo giá - không
  // còn nút "+" thủ công. Vật tư đã có NCC đăng ký (Vật tư-NCC) -> 1 dòng/NCC, tự điền giá tham
  // khảo. Vật tư CHƯA có NCC nào -> vẫn tạo đúng 1 dòng rỗng, để SupplierPicker tự hiện cảnh báo
  // "Chưa có NCC..." ngay lập tức thay vì phải bấm gì mới thấy. Chỉ tự điền khi dòng đó CHƯA có gì
  // (tránh ghi đè báo giá đang sửa/đã nhập, kể cả lúc "Báo giá lại" seed sẵn từ p.quotes cũ).
  //
  // Xét theo item.status === 'quoting' (2026-08-25), KHÔNG còn theo `selected.status` (rollup) -
  // 1 đề xuất gộp có thể rollup 'submitted' (phần của tôi đã gửi) trong khi 1 dòng khác của tôi
  // vừa bị Sếp từ chối rồi requote quay lại 'quoting' và cần seed lại form. `quotingKey` (danh
  // sách materialId đang quoting nối chuỗi) làm dependency ổn định thay vì mảng items (literal mới
  // mỗi render) - cùng kỹ thuật `idsKey` đã dùng ở PurchaseProposalAuditTrail.tsx.
  const { mine: mineForSeed } = selected
    ? splitItemsByOwner(user, selected.items, buyerByMaterialId)
    : { mine: [] as PurchaseProposalItem[] }
  const quotingKey = mineForSeed.filter(item => item.status === 'quoting').map(itemKey).join(',')

  useEffect(() => {
    if (!selected) return
    // Gợi ý sẵn "Ngày dự kiến về" = deadline mua hàng đã duyệt của KHSX (p.deadline, xem
    // frameDeadlineOf ở BE) - Mua hàng vẫn gõ tay sửa lại được nếu NCC hẹn ngày khác, đây chỉ là
    // giá trị khởi tạo để đỡ phải gõ tay lặp lại cho từng dòng NCC/từng vật tư.
    const defaultExpectedDate = selected.deadline ? format(new Date(selected.deadline), 'yyyy-MM-dd') : undefined
    const emptyRow: ProposalQuote = { supplierName: '', unitPrice: null, expectedDate: defaultExpectedDate }
    const { mine } = splitItemsByOwner(user, selected.items, buyerByMaterialId)
    mine.filter(item => item.status === 'quoting').forEach(item => {
      const key = itemKey(item)
      if (getRows(selected.id, key).length > 0) return
      if (item.materialId == null) {
        setRows(selected.id, key, [emptyRow])
        return
      }
      getMaterialSuppliers(item.materialId).then(suppliers => {
        if (getRows(selected.id, key).length > 0) return // đã có dữ liệu trong lúc chờ fetch
        setRows(
          selected.id, key,
          suppliers.length > 0
            ? suppliers.map(s => ({ supplierName: s.supplierName, supplierId: String(s.supplierId), unitPrice: s.price, expectedDate: defaultExpectedDate }))
            : [emptyRow],
        )
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, quotingKey])

  const removeRow = (proposalId: string, key: string, idx: number) =>
    setRows(proposalId, key, getRows(proposalId, key).filter((_, i) => i !== idx))

  const updateRow = (proposalId: string, key: string, idx: number, patch: Partial<ProposalQuote>) =>
    setRows(proposalId, key, getRows(proposalId, key).map((r, i) => i === idx ? { ...r, ...patch } : r))

  // Gửi Sếp duyệt giờ chỉ còn phụ thuộc PHẦN CỦA MÌNH (2026-08-25) - không còn phải đợi đồng
  // nghiệp phụ trách phần khác trong cùng đề xuất gộp xong trước (BE submit() cũng chỉ xét đúng
  // các item QUOTING của actor, xem purchase-proposals.service.ts). Chỉ xét các dòng ĐANG quoting
  // của mình - dòng đã submitted/purchasing/purchased/rejected không cần (và không được, xem
  // addQuote() BE) báo giá lại ở đây.
  const canSubmit = (p: PurchaseProposal) => {
    const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    const quotingMine = mine.filter(item => item.status === 'quoting')
    return quotingMine.length > 0 && quotingMine.every(item => getRows(p.id, itemKey(item)).some(isValidQuote))
  }

  const myQuotesOf = (p: PurchaseProposal) => {
    const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    const quotes: Record<string, ProposalQuote[]> = {}
    mine.filter(item => item.status === 'quoting').forEach(item => {
      quotes[itemKey(item)] = getRows(p.id, itemKey(item)).filter(isValidQuote)
    })
    return quotes
  }

  // Lưu phần báo giá của mình mà KHÔNG gửi Sếp duyệt - cần thiết khi đề xuất gộp nhiều người mua
  // và phần của đồng nghiệp chưa xong (canSubmit false): lưu trước, ai xong sau cùng mới gửi.
  // Re-seed lại form từ đề xuất mới nhất trả về (có `quote.id` thật) để lần lưu/gửi tiếp theo
  // không gửi trùng các dòng đã lưu (xem purchasing-api.ts#postNewQuotes).
  const handleSave = async (p: PurchaseProposal) => {
    const updated = await onSaveQuotes(p.id, myQuotesOf(p))
    const { mine } = splitItemsByOwner(user, updated.items, buyerByMaterialId)
    setQuoteEdits(prev => ({
      ...prev,
      [p.id]: {
        ...(prev[p.id] ?? {}),
        ...Object.fromEntries(mine.map(item => [itemKey(item), updated.quotes?.[itemKey(item)] ?? []])),
      },
    }))
  }

  const handleSubmit = (p: PurchaseProposal) => {
    onSubmitToDirector(p.id, myQuotesOf(p))
    setSelectedId(null)
  }

  // Báo giá lại sau khi bị từ chối — seed lại đúng các dòng NCC/giá đã báo trước đó để sửa tiếp,
  // không bắt nhập lại từ đầu (quoteEdits và p.quotes cùng shape Record<materialId, ProposalQuote[]>).
  // Bỏ `id` cũ khi seed: BE requote() XOÁ SẠCH báo giá cũ trước khi mở lại QUOTING, giữ `id` cũ
  // sẽ khiến postNewQuotes() ở lượt lưu/gửi tiếp theo TƯỞNG NHẦM đã lưu rồi nên bỏ qua, không gửi
  // lại được - mất trắng báo giá dù form vẫn hiện đủ.
  const handleRequote = (p: PurchaseProposal) => {
    if (p.quotes) {
      const stripped = Object.fromEntries(
        Object.entries(p.quotes).map(([key, rows]) => [key, rows.map(r => ({ ...r, id: undefined }))]),
      )
      setQuoteEdits(prev => ({ ...prev, [p.id]: stripped }))
    }
    onRequote(p.id)
  }

  // Rollup CỦA RIÊNG PHẦN MÌNH trong 1 đề xuất (2026-08-25) - KHÔNG dùng thẳng `p.status` (rollup
  // của CẢ đề xuất, gồm cả phần đồng nghiệp khác) nữa cho màn hình này: 1 đề xuất gộp nhiều người
  // mua có thể rollup 'quoting' vì đồng nghiệp còn NEW, trong khi phần CỦA TÔI đã SUBMITTED xong
  // xuôi từ lâu - hiện "Đang báo giá" ở đây khiến người vừa bấm "Gửi Giám đốc duyệt" tưởng thao tác
  // của mình thất bại dù BE đã ghi nhận đúng (báo cáo thật từ Trâm, 2026-08-25: gửi xong quay về
  // danh sách vẫn thấy "Đang báo giá" - kiểm tra DB thật thì item của Trâm đã SUBMITTED, chỉ là
  // rollup cả đề xuất chưa lên vì Nhàn chưa động tới phần của Nhàn). Cùng thứ tự ưu tiên với
  // recomputeProposalStatus() ở BE, chỉ khác input là tập item nào được xét (mine, không phải all).
  const myRollupStatus = (p: PurchaseProposal): PurchaseProposal['status'] => {
    const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    return mine.length > 0 ? rollupStatusOf(mine) : p.status
  }

  const statusTag = (p: PurchaseProposal) => itemStatusTag(myRollupStatus(p))

  // Dùng chung cho tag trạng thái CỦA 1 DÒNG (item.status) - "others" panel + từng nhóm mine bên
  // dưới (2026-08-25). statusTag(p) ở trên tái dùng luôn hàm này (cùng bảng nhãn
  // PROPOSAL_STATUS_LABELS, chỉ khác input là status nào).
  const itemStatusTag = (status: PurchaseProposal['status']) => {
    const cfg = PROPOSAL_STATUS_LABELS[status]
    return <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '2px 8px' }}>{cfg.label}</span>
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const p = selected
    return (
      <div style={{ marginBottom: 24, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Back bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setSelectedId(null)}
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
            <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
              Deadline: {new Date(p.deadline).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
          {(() => {
            const { mine, others } = splitItemsByOwner(user, p.items, buyerByMaterialId)
            // Nhóm PHẦN CỦA MÌNH theo status RIÊNG DÒNG (2026-08-25) - 1 đề xuất gộp nhiều người
            // mua có thể có vật tư của TÔI ở nhiều trạng thái khác nhau CÙNG LÚC (vd Sếp vừa duyệt
            // 2 dòng lên PURCHASING và từ chối 1 dòng, trong khi dòng thứ 4 tôi chưa kịp báo giá) -
            // không còn giả định cả đề xuất chỉ có đúng 1 status như trước, xem p.status (rollup).
            const newItems        = mine.filter(item => item.status === 'new')
            const quotingItems    = mine.filter(item => item.status === 'quoting')
            const submittedItems  = mine.filter(item => item.status === 'submitted')
            const rejectedItems   = mine.filter(item => item.status === 'rejected')
            const purchasingItems = mine.filter(item => item.status === 'purchasing')
            const purchasedItems  = mine.filter(item => item.status === 'purchased')
            let sectionIdx = 0
            const topBorder = () => (others.length > 0 || sectionIdx++ > 0) ? '1px solid var(--border)' : 'none'

            // Bảng báo giá read-only dùng chung cho SUBMITTED/REJECTED - mỗi dòng vật tư kèm mọi
            // NCC đã báo (p.quotes, key theo materialId - xem D.p6-quote-key-collision đầu file).
            const renderQuotesTable = (rowItems: PurchaseProposalItem[]) => (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                      <th style={th}>Vật tư</th>
                      <th style={{ ...th, textAlign: 'right' }}>Cần mua</th>
                      <th style={th}>ĐVT</th>
                      <th style={th}>Nhà cung cấp</th>
                      <th style={{ ...th, textAlign: 'right' }}>Đơn giá</th>
                      <th style={th}>Dự kiến về</th>
                      <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowItems.flatMap((item, idx) => {
                      const offers: ProposalQuote[] = p.quotes?.[itemKey(item)] ?? []
                      const prices = offers.map(q => q.unitPrice).filter((x): x is number => x != null && x > 0)
                      const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null
                      if (offers.length === 0) {
                        return [(
                          <tr key={`${idx}-empty`} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ ...td, fontWeight: 600 }}><ItemName item={item} /></td>
                            <td style={{ ...td, textAlign: 'right' }}>{item.buyQty}</td>
                            <td style={{ ...td, color: 'var(--text3)' }}>{item.unit}</td>
                            <td colSpan={4} style={{ ...td, color: 'var(--text3)' }}>—</td>
                          </tr>
                        )]
                      }
                      return offers.map((q, qi) => {
                        const isCheap = cheapestPrice != null && q.unitPrice === cheapestPrice
                        const total = q.unitPrice != null && q.unitPrice > 0 ? q.unitPrice * item.buyQty : null
                        return (
                          <tr key={`${idx}-${qi}`} style={{ borderTop: '1px solid var(--border)', background: isCheap ? '#f1f8e9' : undefined }}>
                            {qi === 0 && <td style={{ ...td, fontWeight: 600 }} rowSpan={offers.length}><ItemName item={item} /></td>}
                            {qi === 0 && <td style={{ ...td, textAlign: 'right' }} rowSpan={offers.length}>{item.buyQty}</td>}
                            {qi === 0 && <td style={{ ...td, color: 'var(--text3)' }} rowSpan={offers.length}>{item.unit}</td>}
                            <td style={td}>
                              {q.supplierName}
                              {isCheap && offers.length > 1 && <span style={{ marginLeft: 6, fontSize: 10, color: '#2e7d32', fontWeight: 700 }}>★ rẻ nhất</span>}
                            </td>
                            <td style={{ ...td, textAlign: 'right' }}>{q.unitPrice ? q.unitPrice.toLocaleString('vi-VN') + 'đ' : '—'}</td>
                            <td style={{ ...td, color: 'var(--text3)' }}>{q.expectedDate ? new Date(q.expectedDate).toLocaleDateString('vi-VN') : '—'}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#4527a0' }}>{total ? total.toLocaleString('vi-VN') + 'đ' : '—'}</td>
                          </tr>
                        )
                      })
                    })}
                  </tbody>
                </table>
              </div>
            )

            return (<>
              {others.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--surface2)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                    {others.length} vật tư khác trong đề xuất này do đồng nghiệp phụ trách mua:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {others.map((item, idx) => (
                      <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
                        {item.name} {itemStatusTag(item.status)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── NEW (của mình) ── */}
              {newItems.length > 0 && (<div style={{ borderTop: topBorder() }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                        <th style={th}>Kho</th>
                        <th style={th}>Vật tư</th>
                        <th style={{ ...th, textAlign: 'right' }}>Tồn thực</th>
                        <th style={{ ...th, textAlign: 'right' }}>Cần mua</th>
                        <th style={th}>ĐVT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newItems.map((item, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{item.khoLabel}</td>
                          <td style={{ ...td, fontWeight: 600 }}><ItemName item={item} /></td>
                          <td style={{ ...td, textAlign: 'right', color: '#dc2626' }}>{item.actualStock}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#d97706' }}>{item.buyQty}</td>
                          <td style={{ ...td, color: 'var(--text3)' }}>{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px', borderTop: '1px solid #fde68a', background: '#fffbeb' }}>
                  <button
                    onClick={() => onAcknowledge(p.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer' }}
                  >
                    Tiếp nhận & Báo giá
                  </button>
                </div>
              </div>)}

              {/* ── QUOTING (của mình) ── */}
              {quotingItems.length > 0 && (
            <div style={{ borderTop: topBorder(), padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {quotingItems.map((item, idx) => {
                const rows = getRows(p.id, itemKey(item))
                const prices = rows.map(r => r.unitPrice).filter((x): x is number => x != null && x > 0)
                const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null
                return (
                  <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}><ItemName item={item} /></span>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.khoLabel}</span>
                      <span style={{ fontSize: 12, color: '#c62828', fontWeight: 600 }}>Cần mua: {item.buyQty} {item.unit}</span>
                    </div>
                    {rows.length > 0 && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ textAlign: 'left', background: 'var(--surface)' }}>
                              <th style={th}>NCC</th>
                              <th style={{ ...th, minWidth: 130 }}>Đơn giá (đ)</th>
                              <th style={{ ...th, minWidth: 140 }}>Ngày dự kiến về</th>
                              <th style={th}>Ghi chú</th>
                              <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
                              <th style={th}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, ri) => {
                              const price = r.unitPrice ?? null
                              const total = price != null && price > 0 ? price * item.buyQty : null
                              const isCheap = cheapestPrice != null && price === cheapestPrice
                              return (
                                <tr key={ri} style={{ borderTop: '1px solid var(--border)', background: isCheap ? '#f1f8e9' : undefined }}>
                                  <td style={{ ...td, fontWeight: 600 }}>
                                    <SupplierPicker
                                      materialId={item.materialId}
                                      value={r.supplierName}
                                      price={r.unitPrice ?? null}
                                      usedByOtherRows={rows.filter((_, i) => i !== ri).map(o => o.supplierName)}
                                      onChange={patch => updateRow(p.id, itemKey(item), ri, patch)}
                                    />
                                    {isCheap && rows.length > 1 && (
                                      <span style={{ marginLeft: 6, fontSize: 10, color: '#2e7d32', fontWeight: 700 }}>★ rẻ nhất</span>
                                    )}
                                  </td>
                                  <td style={td}>
                                    <input
                                      type="number" min={0}
                                      value={r.unitPrice ?? ''}
                                      onChange={e => updateRow(p.id, itemKey(item), ri, { unitPrice: e.target.value ? Number(e.target.value) : null })}
                                      placeholder="VD: 85000"
                                      style={{ ...inp, width: 120 }}
                                    />
                                  </td>
                                  <td style={td}>
                                    <input
                                      type="date"
                                      value={r.expectedDate ?? ''}
                                      onChange={e => updateRow(p.id, itemKey(item), ri, { expectedDate: e.target.value || undefined })}
                                      style={{
                                        ...inp, width: 130,
                                        borderColor: !r.expectedDate && r.supplierName.trim() !== '' && r.unitPrice != null && r.unitPrice > 0 ? '#c62828' : undefined,
                                      }}
                                    />
                                  </td>
                                  <td style={td}>
                                    <input
                                      type="text"
                                      value={r.note ?? ''}
                                      onChange={e => updateRow(p.id, itemKey(item), ri, { note: e.target.value || undefined })}
                                      placeholder="Ghi chú..."
                                      style={inp}
                                    />
                                  </td>
                                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: total ? '#4527a0' : 'var(--text3)' }}>
                                    {total ? total.toLocaleString('vi-VN') + 'đ' : '—'}
                                  </td>
                                  <td style={td}>
                                    {rows.length > 1 && (
                                      <button
                                        onClick={() => removeRow(p.id, itemKey(item), ri)}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: '#c62828' }}
                                      >
                                        <X size={13} />
                                      </button>
                                    )}
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
              })}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                {!canSubmit(p) && (
                  <span style={{ fontSize: 12, color: '#e65100' }}>
                    {others.length > 0
                      ? 'Mỗi vật tư của bạn cần đủ NCC/đơn giá/ngày dự kiến về, và đồng nghiệp cần báo giá xong phần của họ'
                      : 'Mỗi vật tư cần ít nhất 1 dòng đủ NCC, đơn giá và ngày dự kiến về'}
                  </span>
                )}
                <button
                  onClick={() => handleSave(p)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer',
                  }}
                >
                  Lưu báo giá
                </button>
                <button
                  onClick={() => handleSubmit(p)}
                  disabled={!canSubmit(p)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                    background: canSubmit(p) ? '#4527a0' : '#e5e7eb',
                    color: canSubmit(p) ? '#fff' : '#9ca3af',
                    cursor: canSubmit(p) ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Send size={14} /> Gửi Giám đốc duyệt
                </button>
              </div>
            </div>
              )}

              {/* ── SUBMITTED (của mình) ── */}
              {submittedItems.length > 0 && (<div style={{ borderTop: topBorder() }}>
                {renderQuotesTable(submittedItems)}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid #86efac', background: '#f0fdf4', fontSize: 13, color: '#166534' }}>
                  <CheckCircle2 size={15} />
                  <span>Đã gửi Giám đốc duyệt lúc {formatLatest(submittedItems.map(i => i.submittedAt))}</span>
                </div>
              </div>)}

              {/* ── REJECTED (của mình) ── */}
              {rejectedItems.length > 0 && (<div style={{ borderTop: topBorder() }}>
                {renderQuotesTable(rejectedItems)}
                <div style={{ padding: '10px 14px', borderTop: '1px solid #f48fb1', background: '#fce4ec' }}>
                  {rejectedItems.map((item, idx) => (
                    <div key={idx} style={{ fontSize: 13, color: '#c62828', marginBottom: idx === rejectedItems.length - 1 ? 8 : 4 }}>
                      <strong>{item.name}</strong> — Giám đốc từ chối lúc {item.rejectedAt ? format(new Date(item.rejectedAt), 'HH:mm dd/MM/yyyy') : '—'}: {item.rejectionReason || 'Không có lý do'}
                    </div>
                  ))}
                  <button
                    onClick={() => handleRequote(p)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: '#c62828', color: '#fff', cursor: 'pointer' }}
                  >
                    Báo giá lại
                  </button>
                </div>
              </div>)}

              {/* ── PURCHASING / PURCHASED (của mình) ── */}
              {(purchasingItems.length + purchasedItems.length) > 0 && (<div style={{ borderTop: topBorder(), padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...purchasingItems, ...purchasedItems].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}><ItemName item={item} /></span>
                    {itemStatusTag(item.status)}
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sếp đã duyệt — theo dõi ở &quot;Theo dõi mua hàng&quot;/&quot;Lịch sử đã mua&quot;</span>
                  </div>
                ))}
              </div>)}
            </>)
          })()}
        </div>
      </div>

      <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 20 }}>
        <PurchaseProposalAuditTrail proposalId={p.id} />
      </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ClipboardList size={16} color="#d97706" />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>Đề xuất mua từ Quản lý SX</span>
        {newCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
            {newCount} mới
          </span>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>PO</th>
              <th style={th}>PI</th>
              <th style={th}>Mã nhà máy</th>
              <th style={th}>Kho phụ trách</th>
              <th style={th}>Deadline</th>
              <th style={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map(p => {
              const khos = [...new Set(p.items.map(i => i.khoLabel))].join(', ')
              return (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
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
                  <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{khos}</td>
                  <td style={{ ...td, color: p.deadline ? '#dc2626' : 'var(--text3)', fontSize: 12, fontWeight: p.deadline ? 600 : 400 }}>
                    {p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={td}>{statusTag(p)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
