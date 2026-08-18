import { useEffect, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { errMsg } from '../../../utils/errors'
import { StatusBadge } from '../Sales/StatusBadge'
import type { SalesOrderStatus } from '../../../types/sales'
import { format } from 'date-fns'
import { AlertCircle, Check, CheckCircle2, X, CalendarClock, Pencil, Play, ChevronRight, ChevronLeft, Search, Clock, XCircle, ThumbsUp, ThumbsDown, Warehouse, Loader2 } from 'lucide-react'
import SearchableSelect from '../../../components/SearchableSelect'
import { isThanhPhamScope } from '../Manufacturing/MfgWarehousesPage'

/**
 * "Đang tính phương án cắt... (đã chạy X phút)" - thời gian solve dao động rất lớn (đo thật:
 * 4,7 phút -> hơn 15 phút tuỳ vật tư), không hiện gì thì Sếp/KHSX/QLSX duyệt xong không biết đang
 * chờ hay đã xong. Tự đếm phút bằng interval riêng (không phụ thuộc refetch cha) để số luôn đúng
 * dù danh sách PI có tự làm mới hay không.
 */
function CalculatingBadge({ requestedAt }: { requestedAt: string }) {
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 15000)
    return () => clearInterval(id)
  }, [])
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 60000))
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#1d4ed8', background:'#dbeafe', padding:'2px 8px', borderRadius:10 }}>
      <Loader2 size={10} className="spin" /> Đang tính phương án cắt... (đã chạy {minutes} phút)
    </span>
  )
}

export default function LenhSXPage() {
  const { user, isBoss } = useAuth()
  const isQlsx = user?.mfgRole === 'PRODUCTION_MANAGER'
  const [confirmingProdId, setConfirmingProdId] = useState<number | null>(null)
  const [confirmProdTarget, setConfirmProdTarget] = useState<any | null>(null)
  // Gửi QLSX: chọn NHIỀU SKU 1 lần (2026-08-18) — trước đây là radio chọn đúng 1, phải mở lại hộp
  // thoại cho từng SKU của phiếu gộp. Giữ id thật (không phải index) để khớp thẳng itemIds mà BE
  // nhận ở /send-to-qlsx-batch.
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [approvingKey, setApprovingKey] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<{ pi: any; idx: number } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<{ pi: any; idx: number } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [qlsxTarget, setQlsxTarget] = useState<{ pi: any; idx: number } | null>(null)
  const [qlsxWarehouseCode, setQlsxWarehouseCode] = useState<string | null>(null)
  // Gửi Sếp cả phiếu 1 lần (2026-08-18) — mặc định BẬT khi phiếu còn >1 SKU chờ QLSX (ca thường:
  // cả đợt gộp cùng về 1 kho thành phẩm). Tắt đi thì quay về gửi đúng SKU đang mở như trước.
  const [qlsxApplyAll, setQlsxApplyAll] = useState(false)
  const [sendingToBoss, setSendingToBoss] = useState(false)
  const [editingPI, setEditingPI] = useState<any | null>(null)
  const [editValues, setEditValues] = useState<{ deadline: string; items: { materialDeadline: string; deliveryDeadline: string; FRAME: string; WEAVING: string; PACKAGING: string }[] }>({ deadline: '', items: [] })
  // Field nào lúc mở modal chỉ là ngày "ước tính" (chưa có giá trị thật lưu ở SKU) — map vào ô
  // nhập để tham khảo, nhưng KHÔNG được tự "chốt" thành ngày chính thức nếu người dùng không đụng
  // vào (xem editTouched bên dưới) — bấm Lưu mà không sửa gì thì SKU vẫn giữ trạng thái ước tính.
  const [editEstimated, setEditEstimated] = useState<{ materialDeadline: boolean; deliveryDeadline: boolean; FRAME: boolean; WEAVING: boolean; PACKAGING: boolean }[]>([])
  const [editTouched, setEditTouched] = useState<Set<string>>(new Set())
  const [savingPI, setSavingPI] = useState(false)
  const [viewingPIId, setViewingPIId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const { data: pis, isLoading, error, refetch } = useFetch(
    () => api.getProductionInvoices(),
    []
  )
  // Tự làm mới danh sách trong lúc có SKU đang CALCULATING - KHSX/Sếp không phải tự bấm F5 để biết
  // solver đã trả lời chưa. Dừng poll ngay khi không còn SKU nào đang tính (đỡ tốn request vô ích).
  const hasCalculating = (Array.isArray(pis) ? pis : []).some((p: any) =>
    (Array.isArray(p.items) ? p.items : []).some((it: any) => it.cuttingProposalStatus === 'CALCULATING'),
  )
  useEffect(() => {
    if (!hasCalculating) return
    const id = setInterval(refetch, 20000)
    return () => clearInterval(id)
  }, [hasCalculating, refetch])
  const hasItemWithStatus = (p: any, status: string) => (Array.isArray(p.items) ? p.items : []).some((it: any) => it.prodApproval?.status === status)
  const hasCalculatingItem = (p: any) => (Array.isArray(p.items) ? p.items : []).some((it: any) => it.cuttingProposalStatus === 'CALCULATING')
  // Boss/QLSX chỉ cần thấy PO có SKU đang chờ mình xử lý — không quan tâm PO chưa gửi/đã xử lý xong.
  // NGOẠI LỆ: duyệt xong PI chuyển PRODUCING NGAY (trước khi solver chạy xong) nên bị lọc mất khỏi
  // danh sách đúng lúc cần xem "đang tính" nhất - vẫn cho KHSX bấm vào xem PI đó CHỪNG NÀO còn SKU
  // CALCULATING; tự rớt khỏi danh sách lại khi solver trả lời (DRAFT/FAILED/APPROVED).
  const safeList = (Array.isArray(pis) ? pis : []).filter((p: any) => (p.status === 'PLANNING' || hasCalculatingItem(p)) && (
    isBoss ? hasItemWithStatus(p, 'WAITING_BOSS') : isQlsx ? hasItemWithStatus(p, 'WAITING_QLSX') : true
  ))
  const filteredList = search.trim()
    ? safeList.filter((p: any) => (p.code ?? '').toLowerCase().includes(search.trim().toLowerCase()) || (p.exportOrder?.poNumber ?? '').toLowerCase().includes(search.trim().toLowerCase()))
    : safeList
  const viewingPI = viewingPIId ? (Array.isArray(pis) ? pis : []).find((p: any) => p.id === viewingPIId) ?? null : null
  const getDisplayCode = (item: any) => item?.exportOrder?.poNumber || item?.poNumber || item?.code || '—'

  // Boss/QLSX xử lý thẳng theo SKU, không cần chui vào từng PO — gộp phẳng tất cả SKU đang chờ
  // mình xử lý từ mọi PO thành 1 bảng duy nhất.
  const relevantStatus = isBoss ? 'WAITING_BOSS' : 'WAITING_QLSX'
  const flatRows = (isBoss || isQlsx)
    ? filteredList.flatMap((pi: any) => (Array.isArray(pi.items) ? pi.items : [])
        .map((item: any, idx: number) => ({ pi, item, idx }))
        .filter(({ item }: any) => item.prodApproval?.status === relevantStatus))
    : []

  // Kho thành phẩm — QLSX chọn làm điểm cuối trước khi gửi sếp duyệt. Mỗi kho thành phẩm (1, 2, 3...)
  // gắn với 1 tài khoản thủ kho riêng (warehouseScope) — đây mới là danh sách kho thành phẩm thật
  // (có thể tạo thêm ở trang "Tổng hợp kho"), khác với `getMfgWarehouses()` chỉ có đúng 1 bản ghi cố định.
  const { data: warehouseUsers } = useFetch(
    () => (isQlsx ? api.getUsers() : Promise.resolve([])),
    []
  )
  const finishedGoodsWarehouses = (Array.isArray(warehouseUsers) ? warehouseUsers : [])
    // Nhân viên mua hàng (isPurchaser) cũng được gán warehouseScope 'thanh-pham' để theo dõi mua hàng
    // theo phạm vi kho — không phải thủ kho, phải loại ra khỏi danh sách kho thành phẩm thật.
    .filter((u: any) => u.role === 'WAREHOUSE_STAFF' && !u.isPurchaser && isThanhPhamScope(u.warehouseScope))
    .map((u: any) => ({ code: u.warehouseScope as string, name: (u.name as string).replace(/^Thủ kho /, 'Kho ') }))

  // KHSX gửi CẢ PHIẾU (mọi SKU đang tick) cho QLSX xử lý trong 1 lần gọi — chưa cho sản xuất, QLSX
  // sẽ chọn kho thành phẩm rồi mới trình sếp. Trước 2026-08-18 phải gửi lẻ từng SKU: phiếu gộp 5
  // SKU = mở hộp thoại 5 lần.
  const handleSendForApproval = async (id: number) => {
    if (selectedItemIds.size === 0) return
    setConfirmingProdId(id)
    try {
      await api.sendPiToQlsx(id, [...selectedItemIds])
      refetch()
      setConfirmProdTarget(null)
    } catch (e: any) {
      alert(errMsg(e, 'Lỗi gửi QLSX'))
    } finally {
      setConfirmingProdId(null)
    }
  }

  // QLSX chọn kho thành phẩm làm điểm cuối rồi gửi sếp duyệt lần cuối.
  const handleQlsxSendToBoss = async () => {
    if (!qlsxTarget || qlsxWarehouseCode === null) return
    const wh = finishedGoodsWarehouses.find((w: any) => w.code === qlsxWarehouseCode)
    if (!wh) return
    const item = (qlsxTarget.pi.items ?? [])[qlsxTarget.idx]
    if (!item) return
    setSendingToBoss(true)
    try {
      // Cả phiếu: 1 lần gọi cho MỌI SKU đang chờ QLSX, dùng chung kho vừa chọn (BE tự lọc đúng
      // trạng thái). Lẻ: giữ nguyên đường cũ cho ca cần kho khác nhau theo từng SKU.
      if (qlsxApplyAll) {
        await api.sendPiToBoss(qlsxTarget.pi.id, { code: wh.code, name: wh.name })
      } else {
        await api.sendItemToBoss(qlsxTarget.pi.id, item.id, { code: wh.code, name: wh.name }, user?.name)
      }
      refetch()
      setQlsxTarget(null)
      setQlsxWarehouseCode(null)
      setQlsxApplyAll(false)
    } catch (e: any) {
      alert(errMsg(e, 'Lỗi gửi sếp duyệt'))
    } finally {
      setSendingToBoss(false)
    }
  }

  // Sếp duyệt 1 SKU đang chờ — SKU đó mới thực sự bắt đầu sản xuất (hiện ở "Lệnh kiểm tra vật tư").
  // Đợt gộp (pi.isMerged) duyệt CẢ CỤM một lần: các SKU trong đó nằm chung một cây sắt nên duyệt
  // lẻ là vô nghĩa — BE cũng chỉ chạy solver một lần cho cả nhóm ở đường này.
  const handleApproveItem = async (pi: any, idx: number) => {
    const items: any[] = pi.items ?? []
    const item = items[idx]
    if (!item && !pi.isMerged) return
    setApprovingKey(`${pi.id}-${idx}`)
    try {
      if (pi.isMerged) {
        await api.approveBatchByBoss(pi.id)
      } else {
        await api.approveItemByBoss(pi.id, item.id, user?.name)
      }
      refetch()
      setApproveTarget(null)
    } catch (e: any) {
      alert(errMsg(e, 'Lỗi duyệt sản xuất'))
    } finally {
      setApprovingKey(null)
    }
  }

  // Sếp từ chối 1 SKU đang chờ — KHSX sẽ sửa lại thời hạn rồi gửi lại.
  const handleRejectItem = async () => {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) { alert('Vui lòng nhập lý do từ chối'); return }
    const { pi, idx } = rejectTarget
    const item = (pi.items ?? [])[idx]
    if (!item && !pi.isMerged) return
    setRejecting(true)
    try {
      // Từ chối đợt gộp = XOÁ cả đợt: các SKU quay về đơn hàng gốc kèm lý do và xuất hiện lại ở
      // màn "Tối ưu cắt sắt" để KHSX gộp tổ hợp khác (yêu cầu Sếp 2026-08-14).
      if (isBoss && pi.isMerged) {
        await api.rejectBatchByBoss(pi.id, reason)
      }
      // isBoss từ chối ở WAITING_BOSS, QLSX từ chối ở WAITING_QLSX — BE tách quyền theo 2
      // endpoint riêng (mfgRole khác role), chọn đúng theo trạng thái hiện tại của item.
      else if (item.prodApproval?.status === 'WAITING_QLSX') {
        await api.rejectProdItemByQlsx(pi.id, item.id, reason, user?.name)
      } else {
        await api.rejectProdItem(pi.id, item.id, reason, user?.name)
      }
      refetch()
      setRejectTarget(null)
      setRejectReason('')
    } catch (e: any) {
      alert(errMsg(e, 'Lỗi từ chối sản xuất'))
    } finally {
      setRejecting(false)
    }
  }

  const openPIEdit = (pi: any) => {
    const piDeadline = new Date(pi.deadline)
    const items = Array.isArray(pi.items) ? pi.items : []
    // Cùng công thức "ước tính" đang hiển thị ở bảng SKU timeline (computedDeadline + fb theo
    // số ngày lùi 21/14/8/3) — map luôn giá trị ước tính vào ô nhập thay vì để trống, khớp với
    // những gì người dùng đang thấy trên bảng ngay phía sau modal.
    const computedDeadline = items.length > 0
      ? items.reduce((max: Date, item: any) => {
          const d = item.deliveryDeadline ? new Date(item.deliveryDeadline) : piDeadline
          return d > max ? d : max
        }, new Date(0))
      : piDeadline
    const fb = (days: number) => { const d = new Date(computedDeadline); d.setDate(d.getDate() - days); return d }
    const stgDate = (item: any, type: string, fallbackDays: number) => {
      const s = Array.isArray(item.stages) ? item.stages.find((x: any) => x.stageType === type) : null
      return format(s?.deadline ? new Date(s.deadline) : fb(fallbackDays), 'yyyy-MM-dd')
    }
    const hasStage = (item: any, type: string) =>
      Array.isArray(item.stages) && item.stages.some((x: any) => x.stageType === type && x.deadline)
    setEditingPI(pi)
    setEditValues({
      deadline: format(piDeadline, 'yyyy-MM-dd'),
      items: items.map((item: any) => ({
        materialDeadline: format(item.materialDeadline ? new Date(item.materialDeadline) : fb(21), 'yyyy-MM-dd'),
        deliveryDeadline: format(item.deliveryDeadline  ? new Date(item.deliveryDeadline)  : piDeadline, 'yyyy-MM-dd'),
        FRAME:     stgDate(item, 'FRAME', 14),
        WEAVING:   stgDate(item, 'WEAVING', 8),
        PACKAGING: stgDate(item, 'PACKAGING', 3),
      })),
    })
    setEditEstimated(items.map((item: any) => ({
      materialDeadline: !item.materialDeadline,
      deliveryDeadline: !item.deliveryDeadline,
      FRAME: !hasStage(item, 'FRAME'),
      WEAVING: !hasStage(item, 'WEAVING'),
      PACKAGING: !hasStage(item, 'PACKAGING'),
    })))
    setEditTouched(new Set())
  }

  const handleSavePI = async () => {
    if (!editingPI || !editValues.deadline) return
    setSavingPI(true)
    try {
      // Field chỉ mang giá trị "ước tính" map sẵn để tham khảo (editEstimated) và người dùng
      // chưa thật sự đụng vào (editTouched) thì KHÔNG được gửi lên — tránh biến ước tính thành
      // ngày chính thức chỉ vì bấm Lưu mà không sửa gì (xem openPIEdit).
      const isCommittable = (idx: number, field: keyof (typeof editEstimated)[number]) =>
        !editEstimated[idx]?.[field] || editTouched.has(`${idx}:${field}`)
      const itemDls = editValues.items
        .map((it, idx) => it.deliveryDeadline && isCommittable(idx, 'deliveryDeadline') ? new Date(it.deliveryDeadline) : null)
        .filter(Boolean) as Date[]
      const piDeadlineComputed = itemDls.length > 0
        ? itemDls.reduce((max, d) => d > max ? d : max, itemDls[0])
        : new Date(editValues.deadline)
      await api.updateProductionInvoice(editingPI.id, { deadline: piDeadlineComputed.toISOString() })

      const items: any[] = Array.isArray(editingPI.items) ? editingPI.items : []
      await Promise.all(items.map((item, idx) => {
        const vals = editValues.items[idx]
        if (!vals) return null
        const payload: { materialDeadline?: string; deliveryDeadline?: string; stages?: { stageType: 'FRAME' | 'WEAVING' | 'PACKAGING'; deadline: string }[] } = {}
        if (vals.materialDeadline && isCommittable(idx, 'materialDeadline')) payload.materialDeadline = new Date(vals.materialDeadline).toISOString()
        if (vals.deliveryDeadline && isCommittable(idx, 'deliveryDeadline')) payload.deliveryDeadline = new Date(vals.deliveryDeadline).toISOString()
        const stages = (['FRAME', 'WEAVING', 'PACKAGING'] as const)
          .filter(field => vals[field] && isCommittable(idx, field))
          .map(field => ({ stageType: field, deadline: new Date(vals[field]).toISOString() }))
        if (stages.length > 0) payload.stages = stages
        if (!payload.materialDeadline && !payload.deliveryDeadline && !payload.stages) return null
        return api.updateProductionInvoiceItem(editingPI.id, item.id, payload)
      }))

      refetch()
      setEditingPI(null)
    } catch (e: any) {
      alert(errMsg(e, 'Lỗi lưu thời hạn'))
    } finally {
      setSavingPI(false)
    }
  }

  if (isLoading) return <div style={{ padding:40, color:'var(--text3)' }}>Đang tải...</div>
  if (error) return (
    <div style={{ padding:40, color:'#c62828', display:'flex', alignItems:'center', gap:8 }}>
      <AlertCircle size={18}/> Lỗi tải dữ liệu
    </div>
  )

  return (
    <div>

      {isBoss || isQlsx ? (
        /* ── DUYỆT/XỬ LÝ SKU (bảng phẳng — hiện thẳng SKU của mọi PO, không cần chui vào từng PO) ── */
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>{isBoss ? 'Duyệt lệnh sản xuất' : 'Xử lý lệnh sản xuất'}</h2>
              <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text3)' }}>{flatRows.length} SKU chờ {isBoss ? 'duyệt' : 'xử lý'}</p>
            </div>
            <div style={{ position:'relative' }}>
              <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm mã PO..."
                style={{ padding:'7px 10px 7px 32px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, background:'var(--surface)', color:'var(--text)', width:200, outline:'none' }}
              />
            </div>
          </div>

          <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 95px 95px 95px 95px 100px 200px', padding:'10px 18px', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>PO</span>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>SKU</span>
              {['Mua hàng','Khung CK','Đan','Đóng gói'].map(h => (
                <span key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>
              ))}
              <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>Hạn giao</span>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>Thao tác</span>
            </div>
            {flatRows.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Không có SKU chờ {isBoss ? 'duyệt' : 'xử lý'}</div>
            ) : flatRows.map(({ pi, item, idx }: any, i: number) => {
              const code = item.productVariant?.mfgProduct?.factoryCode ?? '—'
              const name = item.productVariant?.mfgProduct?.name ?? ''
              const color = item.productVariant?.colorCode
              const qty  = item.quantity
              const isLast = i === flatRows.length - 1
              const piDeadline = new Date(pi.deadline)
              const fb = (days: number) => { const d = new Date(piDeadline); d.setDate(d.getDate() - days); return d }
              const iFrame  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'FRAME')     : null
              const iWeav = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'WEAVING') : null
              const iPackaging  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'PACKAGING')     : null
              const iMat      = item.materialDeadline ? new Date(item.materialDeadline) : fb(21)
              const iFrameDate  = iFrame  ? new Date(iFrame.deadline)  : fb(14)
              const iWeavDate = iWeav ? new Date(iWeav.deadline) : fb(8)
              const iPackagingDate  = iPackaging  ? new Date(iPackaging.deadline)  : fb(3)
              const dc = (d: Date, own: boolean) => (
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:13, fontWeight: own ? 700 : 400, color: own ? 'var(--text)' : 'var(--text3)' }}>{format(d, 'dd/MM/yy')}</div>
                  {!own && <div style={{ fontSize:10, color:'var(--text3)' }}>ước tính</div>}
                </div>
              )
              const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
              const busy = approvingKey === `${pi.id}-${idx}`
              // Đợt gộp: quyết định thuộc về CẢ CỤM, nên chỉ dòng ĐẦU của cụm mới có nút. Rải nút
              // trên từng dòng sẽ khiến Sếp tưởng duyệt được lẻ từng SKU (thực tế bấm dòng nào cũng
              // duyệt cả cụm) - hiểu nhầm nguy hiểm hơn hẳn việc phải nhìn kỹ hơn một chút.
              const isFirstOfMergedPi =
                pi.isMerged && flatRows.findIndex((r: any) => r.pi.id === pi.id) === i
              const mergedSkuCount = pi.isMerged
                ? flatRows.filter((r: any) => r.pi.id === pi.id).length
                : 0
              return (
                <div key={`${pi.id}-${idx}`} style={{ display:'grid', gridTemplateColumns:'100px 1fr 95px 95px 95px 95px 100px 200px', padding:'12px 18px', alignItems:'center', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                  <div>
                    {/* PI gộp không thuộc đơn hàng nào - mã PO phải đọc từ CHÍNH SKU (mỗi SKU giữ
                        đơn gốc riêng), rồi ghi thêm mã đợt gộp để Sếp biết nó đi theo cụm nào. */}
                    <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1' }}>
                      {item.salesOrderCode ?? getDisplayCode(pi)}
                    </span>
                    {pi.isMerged && (
                      <div style={{ fontSize:10, color:'#7c3aed', fontWeight:700, marginTop:2 }}>
                        {pi.code}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{code}</span>
                      {pi.isMerged && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20, background:'#f3e8ff', color:'#6b21a8' }}>
                          ĐỢT GỘP
                        </span>
                      )}
                      {item.status && <StatusBadge status={item.status as SalesOrderStatus} />}
                    </div>
                    {name && <div style={{ fontSize:13, color:'var(--text2)', marginTop:3 }}>{name}</div>}
                    <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                      {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                      {color && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{color}</span>}
                      {item.prodApproval?.warehouseName && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, color:'#0369a1', background:'#e0f2fe', padding:'2px 8px', borderRadius:10 }}>
                          <Warehouse size={10}/> {item.prodApproval.warehouseName}
                        </span>
                      )}
                    </div>
                  </div>
                  {dc(iMat,      !!item.materialDeadline)}
                  {dc(iFrameDate,  !!iFrame)}
                  {dc(iWeavDate, !!iWeav)}
                  {dc(iPackagingDate,  !!iPackaging)}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:13, fontWeight:700, color: iDelivery ? '#1d4ed8' : 'var(--text3)' }}>
                      {format(iDelivery ?? piDeadline, 'dd/MM/yy')}
                    </div>
                    {!iDelivery && <div style={{ fontSize:10, color:'var(--text3)' }}>từ PO</div>}
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                    {isBoss && pi.isMerged && !isFirstOfMergedPi ? (
                      <span style={{ fontSize:11, color:'var(--text3)', fontStyle:'italic' }}>
                        cùng {pi.code}
                      </span>
                    ) : isBoss ? (
                      <>
                        <button onClick={() => setApproveTarget({ pi, idx })} disabled={busy}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor: busy ? 'not-allowed' : 'pointer', color:'#fff', opacity: busy ? 0.7 : 1 }}>
                          <ThumbsUp size={12}/> {busy ? 'Đang duyệt...' : pi.isMerged ? `Duyệt cả đợt (${mergedSkuCount} SKU)` : 'Duyệt'}
                        </button>
                        <button onClick={() => { setRejectTarget({ pi, idx }); setRejectReason('') }} disabled={busy}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'transparent', border:'1px solid #fca5a5', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', color:'#b91c1c' }}>
                          <ThumbsDown size={12}/> {pi.isMerged ? 'Từ chối cả đợt' : 'Từ chối'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => {
                          setQlsxTarget({ pi, idx })
                          setQlsxWarehouseCode(null)
                          // Bật sẵn "gửi cả phiếu" khi còn nhiều SKU chờ - ca thường của phiếu gộp.
                          const waiting = (pi.items ?? []).filter((it: any) => it.prodApproval?.status === 'WAITING_QLSX').length
                          setQlsxApplyAll(waiting > 1)
                        }}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', color:'#fff' }}>
                          <Warehouse size={12}/>  Chọn kho sản xuất
                        </button>
                        <button onClick={() => { setRejectTarget({ pi, idx }); setRejectReason('') }}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'transparent', border:'1px solid #fca5a5', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', color:'#b91c1c' }}>
                          <ThumbsDown size={12}/> Từ chối
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : viewingPI ? (
        /* ── CHI TIẾT PI (KHSX) ─────────────────────────────────────────── */
        (() => {
          const pi = viewingPI
          const items = Array.isArray(pi.items) ? pi.items : []
          // PI deadline = latest delivery deadline among SKUs (fallback to pi.deadline)
          const computedDeadline = items.length > 0
            ? items.reduce((max: Date, item: any) => {
                const d = item.deliveryDeadline ? new Date(item.deliveryDeadline) : new Date(pi.deadline)
                return d > max ? d : max
              }, new Date(0))
            : new Date(pi.deadline)
          const fmt = (d: Date) => format(d, 'dd/MM/yy')
          const canConfirmProd = pi.status !== 'PRODUCING' && pi.status !== 'DONE' && pi.status !== 'CANCELLED'
          // Còn SKU nào chưa gửi duyệt / bị từ chối (có thể gửi lại).
          const hasSendableItems = items.some((it: any) => !it.prodApproval || it.prodApproval.status === 'REJECTED')
          const fb = (days: number) => { const d = new Date(computedDeadline); d.setDate(d.getDate() - days); return d }
          return (
            <div>
              {/* Back + actions */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap', rowGap:8 }}>
                <button onClick={() => setViewingPIId(null)}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontSize:13, cursor:'pointer', color:'var(--text2)', fontWeight:500 }}>
                  <ChevronLeft size={15}/> Danh sách PO
                </button>
                <div style={{ flex:1 }} />
                <button onClick={() => openPIEdit(pi)}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--text2)' }}>
                  <Pencil size={13}/> Sửa thời hạn
                </button>
                {canConfirmProd && hasSendableItems && (
                  <button onClick={() => {
                    setConfirmProdTarget(pi)
                    // Tick sẵn MỌI SKU gửi được - ca thường là gửi cả phiếu; ai cần giữ lại vài SKU
                    // (vd chưa khai xong mốc thời hạn) thì tự bỏ tick.
                    const piItems: any[] = pi.items ?? []
                    setSelectedItemIds(new Set(
                      piItems
                        .filter((it: any) => !it.prodApproval || it.prodApproval.status === 'REJECTED')
                        .map((it: any) => String(it.id)),
                    ))
                  }}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'#fff' }}>
                    <Play size={13}/> Gửi QLSX
                  </button>
                )}
              </div>

              {/* PI header info */}
              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, padding:'14px 18px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)' }}>
                <div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:18 }}>{getDisplayCode(pi)}</div>
                  {pi.isMerged && (
                    <div style={{ fontSize:11, fontWeight:700, color:'#6b21a8', marginTop:3 }}>
                      ĐỢT GỘP · cắt chung {items.length} SKU
                    </div>
                  )}
                </div>
                <div style={{ width:1, height:36, background:'var(--border)' }} />
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <CalendarClock size={14} color="var(--text3)"/>
                  <span style={{ fontSize:13, color:'var(--text3)' }}>Hạn hoàn thành:</span>
                  <span style={{ fontWeight:700, fontSize:15 }}>{format(computedDeadline, 'dd/MM/yyyy')}</span>
                </div>
                <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)', background:'var(--surface2)', padding:'4px 12px', borderRadius:12, border:'1px solid var(--border)' }}>
                  {items.length} SKU
                </div>
              </div>

              {/* SKU timeline */}
              <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 105px 105px 105px 105px 110px', padding:'10px 18px', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>SKU</span>
                  {['Mua hàng','Khung CK','Đan','Đóng gói'].map(h => (
                    <span key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>
                  ))}
                  <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>Hạn giao</span>
                </div>
                {items.length === 0 ? (
                  <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Không có SKU</div>
                ) : items.map((item: any, idx: number) => {
                  const code = item.productVariant?.mfgProduct?.factoryCode ?? '—'
                  const name = item.productVariant?.mfgProduct?.name ?? ''
                  const color = item.productVariant?.colorCode
                  const qty  = item.quantity
                  const isLast = idx === items.length - 1
                  const iFrame  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'FRAME')     : null
                  const iWeav = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'WEAVING') : null
                  const iPackaging  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'PACKAGING')     : null
                  const iMat      = item.materialDeadline ? new Date(item.materialDeadline) : fb(21)
                  const iFrameDate  = iFrame  ? new Date(iFrame.deadline)  : fb(14)
                  const iWeavDate = iWeav ? new Date(iWeav.deadline) : fb(8)
                  const iPackagingDate  = iPackaging  ? new Date(iPackaging.deadline)  : fb(3)
                  const dc = (d: Date, own: boolean) => (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:14, fontWeight: own ? 700 : 400, color: own ? 'var(--text)' : 'var(--text3)' }}>{fmt(d)}</div>
                      {!own && <div style={{ fontSize:10, color:'var(--text3)' }}>ước tính</div>}
                    </div>
                  )
                  const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
                  return (
                    <div key={idx} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 105px 105px 105px 105px 110px', padding:'14px 18px', alignItems:'center' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#0369a1' }}>{code}</span>
                            {/* Đợt gộp chứa SKU của NHIỀU đơn hàng - không ghi rõ từng SKU thuộc đơn
                                nào thì KHSX không lần ra được đơn gốc (PI cha không còn cho biết). */}
                            {pi.isMerged && item.salesOrderCode && (
                              <span style={{ fontSize:11, fontWeight:600, color:'#6b21a8', background:'#f3e8ff', padding:'2px 8px', borderRadius:10 }}>
                                {item.salesOrderCode}
                              </span>
                            )}
                            {item.status && <StatusBadge status={item.status as SalesOrderStatus} />}
                            {item.prodApproval?.status === 'APPROVED' && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#2e7d32', background:'#dcfce7', padding:'2px 8px', borderRadius:10 }}>
                                <Play size={10}/> Đang sản xuất
                              </span>
                            )}
                            {/* Thời gian solve dao động rất lớn (đã đo thật: 4,7 phút -> hơn 15 phút
                                tuỳ vật tư) - không có gì báo cho KHSX biết Sếp duyệt xong đang chờ hay
                                đã tính xong. Chỉ hiện khi CALCULATING - tự biến mất khi solver trả lời. */}
                            {item.cuttingProposalStatus === 'CALCULATING' && item.cuttingProposalRequestedAt && (
                              <CalculatingBadge requestedAt={item.cuttingProposalRequestedAt} />
                            )}
                            {item.cuttingProposalStatus === 'FAILED' && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#b91c1c', background:'#fee2e2', padding:'2px 8px', borderRadius:10 }}>
                                <XCircle size={10}/> Lỗi tính phương án cắt
                              </span>
                            )}
                            {item.prodApproval?.status === 'WAITING_QLSX' && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#b45309', background:'#fef3c7', padding:'2px 8px', borderRadius:10 }}>
                                <Clock size={10}/> Chờ QLSX xử lý
                              </span>
                            )}
                            {item.prodApproval?.status === 'WAITING_BOSS' && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#0369a1', background:'#e0f2fe', padding:'2px 8px', borderRadius:10 }}>
                                <Clock size={10}/> Chờ sếp duyệt
                              </span>
                            )}
                            {item.prodApproval?.status === 'REJECTED' && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#b91c1c', background:'#fee2e2', padding:'2px 8px', borderRadius:10 }}>
                                <XCircle size={10}/> Bị từ chối
                              </span>
                            )}
                          </div>
                          {name && <div style={{ fontSize:13, color:'var(--text2)', marginTop:3 }}>{name}</div>}
                          <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                            {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                            {color && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{color}</span>}
                            {item.prodApproval?.warehouseName && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, color:'#0369a1', background:'#e0f2fe', padding:'2px 8px', borderRadius:10 }}>
                                <Warehouse size={10}/> {item.prodApproval.warehouseName}
                              </span>
                            )}
                          </div>
                        </div>
                        {dc(iMat,      !!item.materialDeadline)}
                        {dc(iFrameDate,  !!iFrame)}
                        {dc(iWeavDate, !!iWeav)}
                        {dc(iPackagingDate,  !!iPackaging)}
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:14, fontWeight:700, color: iDelivery ? '#1d4ed8' : 'var(--text3)' }}>
                            {fmt(iDelivery ?? new Date(pi.deadline))}
                          </div>
                          {!iDelivery && <div style={{ fontSize:10, color:'var(--text3)' }}>từ PO</div>}
                        </div>
                      </div>
                      {item.prodApproval?.status === 'REJECTED' && item.prodApproval.reason && (
                        <div style={{ margin:'0 18px 12px', fontSize:12, color:'#b91c1c', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'6px 10px' }}>
                          Lý do từ chối: {item.prodApproval.reason}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()
      ) : (
        /* ── DANH SÁCH PI (KHSX) ────────────────────────────────────────── */
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>Tạo lệnh sản xuất</h2>
              <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text3)' }}>{safeList.length} lệnh</p>
            </div>
            <div style={{ position:'relative' }}>
              <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm mã PO..."
                style={{ padding:'7px 10px 7px 32px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, background:'var(--surface)', color:'var(--text)', width:200, outline:'none' }}
              />
            </div>
          </div>

          {/* PI List */}
          <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            {filteredList.length === 0 && (
              <div style={{ padding:40, textAlign:'center', color:'var(--text3)', background:'var(--surface)' }}>
                {search.trim() ? `Không tìm thấy lệnh sản xuất "${search.trim()}"` : 'Chưa có lệnh sản xuất nào'}
              </div>
            )}
            {filteredList.map((pi: any, i: number) => {
              const items = Array.isArray(pi.items) ? pi.items : []
              const isLast = i === filteredList.length - 1
              return (
                <button key={pi.id} onClick={() => setViewingPIId(pi.id)}
                  style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 16px', width:'100%', background:'var(--surface)', border:'none', borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor:'pointer', textAlign:'left', transition:'background .12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'var(--text)' }}>{getDisplayCode(pi)}</div>
                  </div>
                  <div style={{ flex:1 }} />
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <CalendarClock size={13} color="var(--text3)"/>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>Hạn hoàn thành</span>
                    <span style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{format(new Date(pi.deadline), 'dd/MM/yy')}</span>
                  </div>
                  <span style={{ fontSize:12, color:'var(--text3)', background:'var(--surface2)', border:'1px solid var(--border)', padding:'3px 10px', borderRadius:12, whiteSpace:'nowrap' }}>
                    {items.length} SKU
                  </span>
                  <ChevronRight size={16} color="var(--text3)"/>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Gửi QLSX xử lý */}
      {confirmProdTarget && (() => {
        const items: any[] = confirmProdTarget.items ?? []
        const sendableIds: string[] = items
          .filter((it: any) => !it.prodApproval || it.prodApproval.status === 'REJECTED')
          .map((it: any) => String(it.id))
        const allSendableChecked = sendableIds.length > 0 && sendableIds.every(id => selectedItemIds.has(id))
        const toggleItem = (id: string) => setSelectedItemIds(prev => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id); else next.add(id)
          return next
        })
        return (
          <div onClick={() => { if (!confirmingProdId) setConfirmProdTarget(null) }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:560, maxWidth:'95vw', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>

              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexShrink:0 }}>
                <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                  <Play size={16} color="#2e7d32"/> Gửi QLSX xử lý
                </h3>
                <button onClick={() => setConfirmProdTarget(null)} style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
                  <X size={18} color="var(--text3)"/>
                </button>
              </div>

              {/* PI info strip */}
              <div style={{ display:'flex', gap:10, marginBottom:14, flexShrink:0 }}>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Mã PO</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{getDisplayCode(confirmProdTarget)}</div>
                </div>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Hạn hoàn thành</div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{format(new Date(confirmProdTarget.deadline), 'dd/MM/yyyy')}</div>
                </div>
              </div>

              {/* Section label + chọn/bỏ tất cả */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8, flexShrink:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5 }}>
                  Chọn SKU để sản xuất — {sendableIds.length}/{items.length} SKU gửi được
                </div>
                {sendableIds.length > 1 && (
                  <button
                    onClick={() => setSelectedItemIds(allSendableChecked ? new Set() : new Set(sendableIds))}
                    style={{ padding:'3px 10px', fontSize:11, fontWeight:600, background:'transparent', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', color:'var(--text2)', flexShrink:0 }}>
                    {allSendableChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                )}
              </div>

              {/* SKU list — scrollable, checkbox (chọn nhiều, gửi 1 lần) */}
              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                {items.map((item: any, i: number) => {
                  const approvalStatus: 'WAITING_QLSX' | 'WAITING_BOSS' | 'REJECTED' | 'APPROVED' | undefined = item.prodApproval?.status
                  const locked = approvalStatus === 'WAITING_QLSX' || approvalStatus === 'WAITING_BOSS' || approvalStatus === 'APPROVED'
                  const sel  = selectedItemIds.has(String(item.id))
                  const code = item.productVariant?.mfgProduct?.factoryCode ?? '—'
                  const name = item.productVariant?.mfgProduct?.name ?? ''
                  const clr  = item.productVariant?.colorCode
                  const qty  = item.quantity
                  const pDl  = new Date(confirmProdTarget.deadline)
                  const fb   = (days: number) => { const d = new Date(pDl); d.setDate(d.getDate() - days); return d }
                  const iFrame  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'FRAME')     : null
                  const iWeav = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'WEAVING') : null
                  const iPackaging  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'PACKAGING')     : null
                  const cols = [
                    { label:'Mua hàng', val: item.materialDeadline ? new Date(item.materialDeadline) : fb(21), own: !!item.materialDeadline },
                    { label:'Khung CK', val: iFrame  ? new Date(iFrame.deadline)  : fb(14), own: !!iFrame },
                    { label:'Đan',      val: iWeav ? new Date(iWeav.deadline) : fb(8),  own: !!iWeav },
                    { label:'Đóng gói', val: iPackaging  ? new Date(iPackaging.deadline)  : fb(3),  own: !!iPackaging },
                  ]
                  const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
                  return (
                    <div key={i} onClick={() => { if (!locked) toggleItem(String(item.id)) }}
                      style={{ border: sel ? '2px solid #2e7d32' : '1px solid var(--border)', borderRadius:8, overflow:'hidden', cursor: locked ? 'default' : 'pointer', background: locked ? 'var(--surface2)' : sel ? '#f0fdf4' : 'var(--surface)', opacity: locked ? 0.6 : 1, transition:'border-color .12s, background .12s', userSelect:'none' }}>
                      {/* SKU info row */}
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
                        {/* Checkbox (vuông) - chọn nhiều SKU, gửi 1 lần */}
                        {locked ? (
                          <CheckCircle2 size={18} color={approvalStatus === 'APPROVED' ? '#2e7d32' : approvalStatus === 'WAITING_BOSS' ? '#0369a1' : '#b45309'} style={{ flexShrink:0 }} />
                        ) : (
                          <div style={{ width:18, height:18, borderRadius:4, border:'2px solid', borderColor: sel ? '#2e7d32' : '#d1d5db', background: sel ? '#2e7d32' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'border-color .12s, background .12s' }}>
                            {sel && <Check size={12} color="#fff" strokeWidth={3} />}
                          </div>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1', flexShrink:0 }}>{code}</span>
                            {name && <span style={{ fontSize:13, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>}
                          </div>
                          <div style={{ display:'flex', gap:5, marginTop:3 }}>
                            {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'1px 7px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                            {clr && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'1px 7px', borderRadius:10 }}>{clr}</span>}
                            {approvalStatus === 'APPROVED' && <span style={{ fontSize:11, color:'#2e7d32', fontWeight:600, background:'#dcfce7', padding:'1px 7px', borderRadius:10 }}>Đang sản xuất</span>}
                            {approvalStatus === 'WAITING_QLSX' && <span style={{ fontSize:11, color:'#b45309', fontWeight:600, background:'#fef3c7', padding:'1px 7px', borderRadius:10 }}>Chờ QLSX xử lý</span>}
                            {approvalStatus === 'WAITING_BOSS' && <span style={{ fontSize:11, color:'#0369a1', fontWeight:600, background:'#e0f2fe', padding:'1px 7px', borderRadius:10 }}>Chờ sếp duyệt</span>}
                            {approvalStatus === 'REJECTED' && <span style={{ fontSize:11, color:'#b91c1c', fontWeight:600, background:'#fee2e2', padding:'1px 7px', borderRadius:10 }}>Bị từ chối - Cập nhật thông tin để gửi lại</span>}
                          </div>
                        </div>
                        {iDelivery && (
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:10, color:'#1d4ed8', fontWeight:600 }}>Hạn giao</div>
                            <div style={{ fontSize:12, fontWeight:700, color:'#1d4ed8' }}>{format(iDelivery, 'dd/MM/yy')}</div>
                          </div>
                        )}
                      </div>
                      {/* Timeline dates row */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid', borderColor: sel ? '#bbf7d0' : 'var(--border)', background: sel ? '#dcfce7' : 'var(--surface2)' }}>
                        {cols.map(({ label, val, own }, ci) => (
                          <div key={label} style={{ padding:'5px 10px', borderRight: ci < 3 ? '1px solid' : undefined, borderRightColor: sel ? '#bbf7d0' : 'var(--border)', textAlign:'center' }}>
                            <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:1 }}>{label}</div>
                            <div style={{ fontSize:11, fontWeight: own ? 600 : 400, color: own ? 'var(--text)' : 'var(--text3)' }}>
                              {format(val, 'dd/MM/yy')}
                              {!own && <span style={{ display:'block', fontSize:9 }}>ước tính</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)', flexShrink:0 }}>
                <div style={{ fontSize:13, minWidth:0, overflow:'hidden' }}>
                  {selectedItemIds.size > 0 ? (
                    <span style={{ color:'var(--text2)' }}>
                      Sẽ gửi <strong style={{ color:'#2e7d32' }}>{selectedItemIds.size}</strong> SKU
                      {sendableIds.length > selectedItemIds.size && (
                        <span style={{ color:'var(--text3)', marginLeft:6 }}>
                          (giữ lại {sendableIds.length - selectedItemIds.size})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span style={{ color:'#d97706', fontSize:12 }}>Chưa chọn SKU nào</span>
                  )}
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button onClick={() => setConfirmProdTarget(null)} disabled={!!confirmingProdId}
                    style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
                    Hủy
                  </button>
                  <button
                    onClick={() => handleSendForApproval(confirmProdTarget.id)}
                    disabled={!!confirmingProdId || selectedItemIds.size === 0}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background: selectedItemIds.size > 0 ? '#2e7d32' : '#e5e7eb', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: (confirmingProdId || selectedItemIds.size === 0) ? 'not-allowed' : 'pointer', color: selectedItemIds.size > 0 ? '#fff' : '#9ca3af', opacity: confirmingProdId ? 0.7 : 1 }}>
                    <CheckCircle2 size={15}/>
                    {confirmingProdId
                      ? 'Đang gửi...'
                      : selectedItemIds.size > 1 ? `Gửi QLSX (${selectedItemIds.size} SKU)` : 'Gửi QLSX'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* QLSX chọn kho thành phẩm & gửi sếp duyệt */}
      {qlsxTarget && (() => {
        const { pi, idx } = qlsxTarget
        const items: any[] = pi.items ?? []
        const item = items[idx]
        if (!item) return null
        const code  = item.productVariant?.mfgProduct?.factoryCode ?? '—'
        const name  = item.productVariant?.mfgProduct?.name ?? ''
        const color = item.productVariant?.colorCode
        const qty   = item.quantity
        const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
        const selectedWh = finishedGoodsWarehouses.find((w: any) => w.code === qlsxWarehouseCode) ?? null
        const waitingCount = items.filter((it: any) => it.prodApproval?.status === 'WAITING_QLSX').length
        const closeModal = () => { setQlsxTarget(null); setQlsxWarehouseCode(null); setQlsxApplyAll(false) }
        return (
          <div onClick={() => { if (!sendingToBoss) closeModal() }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
            <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="qlsx-send-boss-title"
              style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:460, maxWidth:'95vw', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>

              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <h3 id="qlsx-send-boss-title" style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                  <Warehouse size={16} color="#2e7d32"/> Chọn kho thành phẩm
                </h3>
                <button onClick={closeModal} disabled={sendingToBoss} aria-label="Đóng"
                  style={{ padding:4, background:'transparent', border:'none', cursor: sendingToBoss ? 'not-allowed' : 'pointer' }}>
                  <X size={18} color="var(--text3)"/>
                </button>
              </div>

              {/* PO + hạn giao */}
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Mã PO</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{getDisplayCode(pi)}</div>
                </div>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Hạn giao</div>
                  <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8' }}>{format(iDelivery ?? new Date(pi.deadline), 'dd/MM/yyyy')}</div>
                </div>
              </div>

              {/* SKU info */}
              <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#0369a1' }}>{code}</span>
                  {name && <span style={{ fontSize:13, color:'var(--text2)' }}>{name}</span>}
                </div>
                <div style={{ display:'flex', gap:6, marginTop:5 }}>
                  {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                  {color && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{color}</span>}
                </div>
              </div>

              {/* Chọn kho thành phẩm */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>
                  Kho thành phẩm — điểm cuối sau khi hoàn thành
                </div>
                <SearchableSelect
                  displayValue={selectedWh?.name ?? ''}
                  options={finishedGoodsWarehouses}
                  getKey={(w: any) => w.code}
                  getSearchText={(w: any) => `${w.name} ${w.code ?? ''}`}
                  renderOption={(w: any) => <span>{w.name}</span>}
                  onSelect={(w: any) => setQlsxWarehouseCode(w.code)}
                  placeholder="Chọn kho thành phẩm..."
                  emptyText="Không có kho thành phẩm"
                />
              </div>

              {/* Áp dụng cho cả phiếu — chỉ hiện khi còn >1 SKU chờ QLSX (ca gộp nhiều SKU) */}
              {waitingCount > 1 && (
                <div onClick={() => !sendingToBoss && setQlsxApplyAll(v => !v)}
                  style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'10px 12px', marginBottom:14, border:'1px solid', borderColor: qlsxApplyAll ? '#2e7d32' : 'var(--border)', background: qlsxApplyAll ? '#f0fdf4' : 'var(--surface)', borderRadius:8, cursor: sendingToBoss ? 'not-allowed' : 'pointer', userSelect:'none' }}>
                  <div style={{ width:18, height:18, marginTop:1, borderRadius:4, border:'2px solid', borderColor: qlsxApplyAll ? '#2e7d32' : '#d1d5db', background: qlsxApplyAll ? '#2e7d32' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {qlsxApplyAll && <Check size={12} color="#fff" strokeWidth={3} />}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>
                      Gửi cả phiếu — {waitingCount} SKU đang chờ QLSX
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                      Tất cả dùng chung kho vừa chọn. Bỏ tick nếu chỉ muốn gửi riêng SKU này.
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
                <button onClick={closeModal} disabled={sendingToBoss}
                  style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor: sendingToBoss ? 'not-allowed' : 'pointer', color:'var(--text2)' }}>
                  Hủy
                </button>
                <button onClick={handleQlsxSendToBoss} disabled={sendingToBoss || qlsxWarehouseCode === null}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', background: qlsxWarehouseCode !== null ? '#2e7d32' : '#e5e7eb', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: (sendingToBoss || qlsxWarehouseCode === null) ? 'not-allowed' : 'pointer', color: qlsxWarehouseCode !== null ? '#fff' : '#9ca3af', opacity: sendingToBoss ? 0.7 : 1 }}>
                  <CheckCircle2 size={15}/>
                  {sendingToBoss
                    ? 'Đang gửi...'
                    : qlsxApplyAll ? `Gửi sếp duyệt (${waitingCount} SKU)` : 'Gửi sếp duyệt'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Duyệt SKU — xác nhận trước khi tạo lệnh sản xuất (PI) */}
      {approveTarget && (() => {
        const { pi, idx } = approveTarget
        const items: any[] = pi.items ?? []
        const item = items[idx]
        if (!item) return null
        const code  = item.productVariant?.mfgProduct?.factoryCode ?? '—'
        const name  = item.productVariant?.mfgProduct?.name ?? ''
        const color = item.productVariant?.colorCode
        const qty   = item.quantity
        const piDeadline = new Date(pi.deadline)
        const fb = (days: number) => { const d = new Date(piDeadline); d.setDate(d.getDate() - days); return d }
        const iFrame  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'FRAME')     : null
        const iWeav = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'WEAVING') : null
        const iPackaging  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'PACKAGING')     : null
        const cols = [
          { label:'Mua hàng', val: item.materialDeadline ? new Date(item.materialDeadline) : fb(21), own: !!item.materialDeadline },
          { label:'Khung CK', val: iFrame  ? new Date(iFrame.deadline)  : fb(14), own: !!iFrame },
          { label:'Đan',      val: iWeav ? new Date(iWeav.deadline) : fb(8),  own: !!iWeav },
          { label:'Đóng gói', val: iPackaging  ? new Date(iPackaging.deadline)  : fb(3),  own: !!iPackaging },
        ]
        const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
        const busy = approvingKey === `${pi.id}-${idx}`
        // Boss cần biết trước nếu đây là SKU cuối — duyệt xong PO sẽ tự chuyển "Đang sản xuất" (đúng logic allApproved ở handleApproveItem).
        const willCompletePI = items.every((it: any, i: number) => i === idx || it.prodApproval?.status === 'APPROVED')

        return (
          <div onClick={() => { if (!busy) setApproveTarget(null) }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
            <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="approve-sku-title"
              style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:480, maxWidth:'95vw', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>

              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <h3 id="approve-sku-title" style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                  <ThumbsUp size={16} color="#2e7d32"/> Duyệt sản xuất — Tạo lệnh sản xuất
                </h3>
                <button onClick={() => setApproveTarget(null)} disabled={busy} aria-label="Đóng"
                  style={{ padding:4, background:'transparent', border:'none', cursor: busy ? 'not-allowed' : 'pointer' }}>
                  <X size={18} color="var(--text3)"/>
                </button>
              </div>

              {/* Đợt gộp: bấm Duyệt là duyệt TẤT CẢ SKU trong đợt, không riêng SKU đang mở. Phải nói
                  thẳng và liệt kê ra - phần bên dưới chỉ hiện chi tiết 1 SKU nên rất dễ hiểu nhầm. */}
              {pi.isMerged && (
                <div style={{ background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12.5, color:'#5b21b6' }}>
                  <b>Đợt gộp {pi.code}</b> — duyệt sẽ cho sản xuất <b>cả {items.length} SKU</b> trong
                  đợt và tính phương án cắt chung một lần cho cả nhóm:
                  <div style={{ marginTop:5, fontFamily:'monospace', fontSize:12 }}>
                    {items.map((it: any) => it.productVariant?.mfgProduct?.factoryCode ?? '—').join(' · ')}
                  </div>
                </div>
              )}

              {/* PO + hạn giao */}
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Mã PO</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{getDisplayCode(pi)}</div>
                </div>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Hạn giao</div>
                  <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8' }}>{format(iDelivery ?? piDeadline, 'dd/MM/yyyy')}</div>
                </div>
              </div>

              {/* SKU + timeline */}
              <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:14 }}>
                <div style={{ padding:'10px 12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#0369a1' }}>{code}</span>
                    {name && <span style={{ fontSize:13, color:'var(--text2)' }}>{name}</span>}
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:5 }}>
                    {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                    {color && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{color}</span>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid var(--border)', background:'var(--surface2)' }}>
                  {cols.map(({ label, val, own }, ci) => (
                    <div key={label} style={{ padding:'6px 10px', borderRight: ci < 3 ? '1px solid var(--border)' : undefined, textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:1 }}>{label}</div>
                      <div style={{ fontSize:11, fontWeight: own ? 600 : 400, color: own ? 'var(--text)' : 'var(--text3)' }}>
                        {format(val, 'dd/MM/yy')}
                        {!own && <span style={{ display:'block', fontSize:9 }}>ước tính</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hệ quả của hành động */}
              <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#166534' }}>
                <CheckCircle2 size={14} style={{ flexShrink:0, marginTop:1 }}/>
                <span>
                  Duyệt sẽ tạo lệnh sản xuất (PI) cho SKU này và bắt đầu sản xuất ngay — không thể hoàn tác.
                  {willCompletePI && ' Đây là SKU cuối cùng của PO — PO sẽ chuyển sang trạng thái "Đang sản xuất".'}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
                <button onClick={() => setApproveTarget(null)} disabled={busy}
                  style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor: busy ? 'not-allowed' : 'pointer', color:'var(--text2)' }}>
                  Hủy
                </button>
                <button onClick={() => handleApproveItem(pi, idx)} disabled={busy}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#2e7d32', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: busy ? 'not-allowed' : 'pointer', color:'#fff', opacity: busy ? 0.7 : 1 }}>
                  <ThumbsUp size={15}/> {busy ? 'Đang duyệt...' : 'Xác nhận duyệt'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Từ chối SKU */}
      {rejectTarget && (
        <div onClick={() => { if (!rejecting) { setRejectTarget(null); setRejectReason('') } }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:420, maxWidth:'95vw', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                <ThumbsDown size={16} color="#b91c1c"/> Từ chối sản xuất
              </h3>
              <button onClick={() => { setRejectTarget(null); setRejectReason('') }} disabled={rejecting}
                style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
                <X size={18} color="var(--text3)"/>
              </button>
            </div>
            {isBoss && rejectTarget.pi.isMerged ? (
              // Từ chối đợt gộp là hành động PHÁ HUỶ (xoá cả đợt), không phải trả lại 1 SKU - phải
              // nói rõ trước khi Sếp bấm, kèm danh sách SKU bị ảnh hưởng.
              <div style={{ fontSize:13, color:'var(--text2)', marginBottom:10 }}>
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 12px', color:'#991b1b' }}>
                  Từ chối sẽ <b>xoá đợt gộp {rejectTarget.pi.code}</b> và trả{' '}
                  <b>{(rejectTarget.pi.items ?? []).length} SKU</b> về đơn hàng gốc kèm lý do. KHSX
                  sẽ thấy chúng lại ở màn "Tối ưu cắt sắt" để gộp tổ hợp khác.
                  <div style={{ marginTop:5, fontFamily:'monospace', fontSize:12 }}>
                    {(rejectTarget.pi.items ?? [])
                      .map((it: any) => it.productVariant?.mfgProduct?.factoryCode ?? '—')
                      .join(' · ')}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize:13, color:'var(--text2)', marginBottom:10 }}>
                SKU <strong style={{ fontFamily:'monospace', color:'#0369a1' }}>
                  {rejectTarget.pi.items?.[rejectTarget.idx]?.productVariant?.mfgProduct?.factoryCode ?? '—'}
                </strong> sẽ được gửi lại cho KHSX sửa thời hạn.
              </div>
            )}
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              rows={3}
              autoFocus
              style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, background:'var(--surface)', color:'var(--text)', boxSizing:'border-box', resize:'vertical' }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
              <button onClick={() => { setRejectTarget(null); setRejectReason('') }} disabled={rejecting}
                style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
                Hủy
              </button>
              <button onClick={handleRejectItem} disabled={rejecting || !rejectReason.trim()}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#b91c1c', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: (rejecting || !rejectReason.trim()) ? 'not-allowed' : 'pointer', color:'#fff', opacity: (rejecting || !rejectReason.trim()) ? 0.6 : 1 }}>
                <ThumbsDown size={15}/> {rejecting ? 'Đang gửi...' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sửa timeline PI */}
      {editingPI && (
        <div onClick={() => { if (!savingPI) setEditingPI(null) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:28, width:560, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                <CalendarClock size={16} color="#1976d2"/> Sửa thời hạn — <span style={{ fontFamily:'monospace' }}>{getDisplayCode(editingPI)}</span>
              </h3>
              <button onClick={() => setEditingPI(null)} disabled={savingPI}
                style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
                <X size={18} color="var(--text3)"/>
              </button>
            </div>

            {/* SKU timelines */}
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
              {(Array.isArray(editingPI.items) ? editingPI.items : []).map((item: any, idx: number) => {
                const code = item.productVariant?.mfgProduct?.factoryCode ?? '—'
                const name = item.productVariant?.mfgProduct?.name ?? ''
                const qty  = item.quantity
                const vals = editValues.items[idx] ?? { materialDeadline:'', deliveryDeadline:'', FRAME:'', WEAVING:'', PACKAGING:'' }
                const est = editEstimated[idx]
                const setField = (field: string, val: string) => {
                  setEditValues(prev => ({
                    ...prev,
                    items: prev.items.map((it, i) => i === idx ? { ...it, [field]: val } : it),
                  }))
                  setEditTouched(prev => new Set(prev).add(`${idx}:${field}`))
                }
                // Ô còn là ước tính (chưa sửa) hiện viền/nền nhạt hơn + nhãn "ước tính" — cùng quy
                // ước với bảng SKU timeline, để người dùng biết giá trị nào là gợi ý, giá trị nào
                // đã chốt thật.
                const isEstimate = (field: string) => !!est?.[field as keyof typeof est] && !editTouched.has(`${idx}:${field}`)
                const dateInput = (label: string, field: string) => (
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>{label}{isEstimate(field) && <span style={{ fontStyle:'italic' }}> (ước tính)</span>}</div>
                    <input type="date" value={vals[field as keyof typeof vals] ?? ''}
                      onChange={e => setField(field, e.target.value)}
                      style={{ width:'100%', padding:'5px 6px', border:`1px solid ${isEstimate(field) ? 'var(--border)' : '#1d4ed8'}`, borderRadius:5, fontSize:12, background:'var(--surface)', color: isEstimate(field) ? 'var(--text3)' : 'var(--text)', boxSizing:'border-box' }}
                    />
                  </div>
                )
                return (
                  <div key={idx} style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                    <div style={{ background:'var(--surface2)', padding:'7px 12px', display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1' }}>{code}</span>
                      {name && <span style={{ fontSize:12, color:'var(--text2)' }}>{name}</span>}
                      {qty != null && <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)', background:'var(--surface)', padding:'1px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                    </div>
                    <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:10 }}>
                      {/* Hạn giao hàng riêng cho SKU này */}
                      <div>
                        <div style={{ fontSize:10, color:'#1d4ed8', fontWeight:700, marginBottom:4 }}>Hạn giao hàng{isEstimate('deliveryDeadline') && <span style={{ fontStyle:'italic', fontWeight:400 }}> (từ PO)</span>}</div>
                        <input type="date" value={vals.deliveryDeadline ?? ''}
                          onChange={e => setField('deliveryDeadline', e.target.value)}
                          style={{ width:'100%', padding:'5px 8px', border:`1px solid ${isEstimate('deliveryDeadline') ? 'var(--border)' : '#1d4ed8'}`, borderRadius:5, fontSize:12, background:'var(--surface)', color: isEstimate('deliveryDeadline') ? 'var(--text3)' : 'var(--text)', boxSizing:'border-box' }}
                        />
                      </div>
                      {/* Các công đoạn sản xuất */}
                      <div style={{ display:'flex', gap:8 }}>
                        {dateInput('Mua hàng',    'materialDeadline')}
                        {dateInput('Khung cơ khí', 'FRAME')}
                        {dateInput('Đan',          'WEAVING')}
                        {dateInput('Đóng gói',     'PACKAGING')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={() => setEditingPI(null)} disabled={savingPI}
                style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor: savingPI ? 'not-allowed' : 'pointer', color:'var(--text2)' }}>
                Hủy
              </button>
              <button onClick={handleSavePI} disabled={savingPI}
                style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#1976d2', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: savingPI ? 'not-allowed' : 'pointer', color:'#fff', opacity: savingPI ? 0.7 : 1 }}>
                {savingPI ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
