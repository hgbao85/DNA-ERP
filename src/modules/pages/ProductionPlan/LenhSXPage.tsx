import { useEffect, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { errMsg } from '../../../utils/errors'
import { StatusBadge } from '../Sales/StatusBadge'
import type { SalesOrderStatus } from '../../../types/sales'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, X, CalendarClock, Pencil, Play, ChevronRight, ChevronLeft, Search, Clock, XCircle, ThumbsUp, ThumbsDown, Warehouse, Loader2 } from 'lucide-react'
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
  const [approvingKey, setApprovingKey] = useState<string | null>(null)
  // Duyệt/từ chối/gửi sếp giờ LUÔN theo cả PI (2026-08-24, không còn theo từng SKU riêng) - target
  // chỉ cần giữ PI, không cần idx của 1 dòng SKU cụ thể nữa.
  const [approveTarget, setApproveTarget] = useState<any | null>(null)
  const [rejectTarget, setRejectTarget] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [qlsxTarget, setQlsxTarget] = useState<any | null>(null)
  const [qlsxWarehouseCode, setQlsxWarehouseCode] = useState<string | null>(null)
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
  // Màn duyệt Boss/QLSX: danh sách chỉ hiện PI thu gọn (không hiện SKU, không có nút thao tác) -
  // bấm vào 1 PI mới chuyển sang trang chi tiết (2026-08-24, KHÔNG xổ tại chỗ) - danh sách SKU +
  // 2 nút Duyệt/Từ chối (hoặc Chọn kho/Từ chối) đều nằm trong trang chi tiết đó.
  const [viewingApprovalPiId, setViewingApprovalPiId] = useState<number | null>(null)

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
  // Tìm theo mã PI (2026-08-24) - danh sách giờ chỉ hiện mã PI, không còn hiện mã PO ở dòng thu
  // gọn nữa nên tìm theo PO sẽ không khớp được gì trên màn hình, dễ gây tưởng nhầm "không tìm ra".
  const filteredList = search.trim()
    ? safeList.filter((p: any) => (p.code ?? '').toLowerCase().includes(search.trim().toLowerCase()))
    : safeList
  const viewingPI = viewingPIId ? (Array.isArray(pis) ? pis : []).find((p: any) => p.id === viewingPIId) ?? null : null
  const getDisplayCode = (item: any) => item?.exportOrder?.poNumber || item?.poNumber || item?.code || '—'

  // Boss/QLSX xử lý theo TỪNG PI (2026-08-24, không còn theo từng SKU riêng lẻ) - mỗi PI là 1
  // khối, gồm các SKU của nó đang chờ đúng vai trò mình xử lý. 1 nút duyệt/từ chối/gửi cho CẢ
  // khối - tránh hiểu nhầm "bấm SKU này chỉ ảnh hưởng SKU này" khi thực ra tác động cả PI (đặc
  // biệt PI gộp, nơi các SKU khác của cùng PI có thể đang ẩn ở chỗ khác trong danh sách phẳng cũ).
  const relevantStatus = isBoss ? 'WAITING_BOSS' : 'WAITING_QLSX'
  const piGroups = (isBoss || isQlsx)
    ? filteredList
        .map((pi: any) => ({
          pi,
          items: (Array.isArray(pi.items) ? pi.items : []).filter(
            (it: any) => it.prodApproval?.status === relevantStatus,
          ),
        }))
        .filter((g: { items: any[] }) => g.items.length > 0)
    : []
  const viewingApprovalGroup = viewingApprovalPiId
    ? piGroups.find((g: { pi: any }) => g.pi.id === viewingApprovalPiId) ?? null
    : null

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
  // Gửi cả PI 1 lần - không còn cho chọn từng SKU nữa (2026-08-24), itemIds bỏ trống = BE tự gửi
  // MỌI SKU đủ điều kiện (chưa gửi / bị QLSX trả lại) trong PI này.
  const handleSendForApproval = async (id: number) => {
    setConfirmingProdId(id)
    try {
      await api.sendPiToQlsx(id)
      refetch()
      setConfirmProdTarget(null)
    } catch (e: any) {
      alert(errMsg(e, 'Lỗi gửi QLSX'))
    } finally {
      setConfirmingProdId(null)
    }
  }

  // QLSX chọn kho thành phẩm làm điểm cuối rồi gửi sếp duyệt lần cuối - LUÔN cả PI (mọi SKU đang
  // chờ QLSX của PI này), không còn chọn gửi lẻ từng SKU (2026-08-24).
  const handleQlsxSendToBoss = async () => {
    if (!qlsxTarget || qlsxWarehouseCode === null) return
    const wh = finishedGoodsWarehouses.find((w: any) => w.code === qlsxWarehouseCode)
    if (!wh) return
    setSendingToBoss(true)
    try {
      await api.sendPiToBoss(qlsxTarget.id, { code: wh.code, name: wh.name })
      refetch()
      setQlsxTarget(null)
      setQlsxWarehouseCode(null)
      setViewingApprovalPiId(null)
    } catch (e: any) {
      alert(errMsg(e, 'Lỗi gửi sếp duyệt'))
    } finally {
      setSendingToBoss(false)
    }
  }

  // Sếp duyệt CẢ PI đang chờ mình — không còn duyệt lẻ từng SKU (2026-08-24). PI cắt riêng chỉ có
  // đúng 1 SKU nên tìm-và-duyệt item đó; PI gộp duyệt CẢ CỤM một lần (các SKU nằm chung một cây
  // sắt nên duyệt lẻ là vô nghĩa - BE cũng chỉ chạy solver một lần cho cả nhóm ở đường này).
  const handleApproveItem = async (pi: any) => {
    setApprovingKey(String(pi.id))
    try {
      if (pi.isMerged) {
        await api.approveBatchByBoss(pi.id)
      } else {
        const item = (pi.items ?? []).find((it: any) => it.prodApproval?.status === 'WAITING_BOSS')
        if (!item) return
        await api.approveItemByBoss(pi.id, item.id, user?.name)
      }
      refetch()
      setApproveTarget(null)
      setViewingApprovalPiId(null)
    } catch (e: any) {
      alert(errMsg(e, 'Lỗi duyệt sản xuất'))
    } finally {
      setApprovingKey(null)
    }
  }

  // Từ chối CẢ PI đang chờ mình xử lý - không còn từ chối lẻ từng SKU (2026-08-24).
  const handleRejectItem = async () => {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) { alert('Vui lòng nhập lý do từ chối'); return }
    const pi = rejectTarget
    setRejecting(true)
    try {
      if (isBoss) {
        // Từ chối đợt gộp = XOÁ cả đợt: các SKU quay về đơn hàng gốc kèm lý do và xuất hiện lại ở
        // màn "Tối ưu cắt sắt" để KHSX gộp tổ hợp khác (yêu cầu Sếp 2026-08-14). Từ chối PI cắt
        // riêng cũng trả về "chưa gom" tương tự (xem ProductionInvoicesService.rejectItem).
        if (pi.isMerged) {
          await api.rejectBatchByBoss(pi.id, reason)
        } else {
          const item = (pi.items ?? []).find((it: any) => it.prodApproval?.status === 'WAITING_BOSS')
          if (!item) return
          await api.rejectProdItem(pi.id, item.id, reason, user?.name)
        }
      } else {
        // QLSX từ chối CẢ PI (mọi SKU đang chờ QLSX của PI này) trong 1 lần gọi.
        await api.rejectPiByQlsx(pi.id, reason)
      }
      refetch()
      setRejectTarget(null)
      setRejectReason('')
      setViewingApprovalPiId(null)
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
        viewingApprovalGroup ? (
          /* ── CHI TIẾT 1 PI (Boss/QLSX, 2026-08-24) — bấm vào PI ở danh sách mới sang đây,
              danh sách SKU + 2 nút Duyệt/Từ chối (hoặc Chọn kho/Từ chối) đều nằm trong này ── */
          (() => {
            const { pi, items } = viewingApprovalGroup as { pi: any; items: any[] }
            const piDeadline = new Date(pi.deadline)
            const fb = (days: number) => { const d = new Date(piDeadline); d.setDate(d.getDate() - days); return d }
            const busy = approvingKey === String(pi.id)
            return (
              <div>
                {/* Back */}
                <button onClick={() => setViewingApprovalPiId(null)}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', marginBottom:20, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontSize:13, cursor:'pointer', color:'var(--text2)', fontWeight:500 }}>
                  <ChevronLeft size={15}/> Danh sách PI
                </button>

                {/* PI header + 2 nút thao tác cho CẢ khối */}
                <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, padding:'14px 18px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', flexWrap:'wrap' }}>
                  <div>
                    <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:18 }}>{pi.code}</span>
                    {pi.isMerged && (
                      <div style={{ fontSize:11, fontWeight:700, color:'#6b21a8', marginTop:3 }}>
                        ĐỢT GỘP · {items.length} SKU
                      </div>
                    )}
                  </div>
                  <div style={{ width:1, height:36, background:'var(--border)' }} />
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <CalendarClock size={14} color="var(--text3)"/>
                    <span style={{ fontSize:13, color:'var(--text3)' }}>Hạn hoàn thành:</span>
                    <span style={{ fontWeight:700, fontSize:15 }}>{format(piDeadline, 'dd/MM/yyyy')}</span>
                  </div>
                  <div style={{ flex:1 }} />
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {isBoss ? (
                      <>
                        <button onClick={() => setApproveTarget(pi)} disabled={busy}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'8px 16px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor: busy ? 'not-allowed' : 'pointer', color:'#fff', opacity: busy ? 0.7 : 1 }}>
                          <ThumbsUp size={13}/> {busy ? 'Đang duyệt...' : pi.isMerged ? `Duyệt cả đợt (${items.length} SKU)` : 'Duyệt'}
                        </button>
                        <button onClick={() => { setRejectTarget(pi); setRejectReason('') }} disabled={busy}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'8px 16px', background:'transparent', border:'1px solid #fca5a5', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'#b91c1c' }}>
                          <ThumbsDown size={13}/> {pi.isMerged ? 'Từ chối cả đợt' : 'Từ chối'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setQlsxTarget(pi); setQlsxWarehouseCode(null) }}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'8px 16px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'#fff' }}>
                          <Warehouse size={13}/> Chọn kho sản xuất{items.length > 1 ? ` (${items.length} SKU)` : ''}
                        </button>
                        <button onClick={() => { setRejectTarget(pi); setRejectReason('') }}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'8px 16px', background:'transparent', border:'1px solid #fca5a5', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'#b91c1c' }}>
                          <ThumbsDown size={13}/> Từ chối{items.length > 1 ? ` (${items.length} SKU)` : ''}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Danh sách SKU trong PI */}
                <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 95px 95px 95px 95px 100px', padding:'10px 18px', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>PO</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>SKU</span>
                    {['Mua hàng','Khung CK','Đan','Đóng gói'].map(h => (
                      <span key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>
                    ))}
                    <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>Hạn giao</span>
                  </div>
                  {items.map((item: any, idx: number) => {
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
                        <div style={{ fontSize:13, fontWeight: own ? 700 : 400, color: own ? 'var(--text)' : 'var(--text3)' }}>{format(d, 'dd/MM/yy')}</div>
                        {!own && <div style={{ fontSize:10, color:'var(--text3)' }}>ước tính</div>}
                      </div>
                    )
                    const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
                    return (
                      <div key={item.id ?? idx} style={{ display:'grid', gridTemplateColumns:'100px 1fr 95px 95px 95px 95px 100px', padding:'12px 18px', alignItems:'center', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                        <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1' }}>
                          {item.salesOrderCode ?? getDisplayCode(pi)}
                        </span>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{code}</span>
                            {item.status && <StatusBadge status={item.status as SalesOrderStatus} />}
                          </div>
                          {name && <div style={{ fontSize:13, color:'var(--text2)', marginTop:3 }}>{name}</div>}
                          <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                            {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString('vi-VN')}</span>}
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
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()
        ) : (
          /* ── DANH SÁCH PI (Boss/QLSX) — thu gọn, bấm vào để xem chi tiết + thao tác ── */
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>{isBoss ? 'Duyệt lệnh sản xuất' : 'Xử lý lệnh sản xuất'}</h2>
                <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text3)' }}>{piGroups.length} PI chờ {isBoss ? 'duyệt' : 'xử lý'}</p>
              </div>
              <div style={{ position:'relative' }}>
                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm mã PI..."
                  style={{ padding:'7px 10px 7px 32px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, background:'var(--surface)', color:'var(--text)', width:200, outline:'none' }}
                />
              </div>
            </div>

            <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
              {piGroups.length === 0 ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Không có PI chờ {isBoss ? 'duyệt' : 'xử lý'}</div>
              ) : piGroups.map(({ pi, items }: { pi: any; items: any[] }, i: number) => (
                <button key={pi.id} onClick={() => setViewingApprovalPiId(pi.id)}
                  style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 16px', width:'100%', background:'var(--surface)', border:'none', borderBottom: i === piGroups.length - 1 ? 'none' : '1px solid var(--border)', cursor:'pointer', textAlign:'left' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}>
                  <div style={{ minWidth:0 }}>
                    <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'var(--text)' }}>{pi.code}</span>
                    {pi.isMerged && (
                      <span style={{ marginLeft:8, fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20, background:'#f3e8ff', color:'#6b21a8' }}>
                        ĐỢT GỘP
                      </span>
                    )}
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
              ))}
            </div>
          </div>
        )
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
          // Nhóm SKU theo PO gốc (item.salesOrderCode) - PI gộp chứa SKU của nhiều PO khác nhau,
          // PI cắt riêng chỉ có đúng 1 nhóm. Giữ thứ tự xuất hiện đầu tiên của mỗi PO.
          const poGroupsMap = new Map<string, any[]>()
          for (const it of items) {
            const key = it.salesOrderCode ?? '—'
            const arr = poGroupsMap.get(key)
            if (arr) arr.push(it); else poGroupsMap.set(key, [it])
          }
          const poGroups = Array.from(poGroupsMap.entries())
          return (
            <div>
              {/* Back + actions */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap', rowGap:8 }}>
                <button onClick={() => setViewingPIId(null)}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontSize:13, cursor:'pointer', color:'var(--text2)', fontWeight:500 }}>
                  <ChevronLeft size={15}/> Danh sách PI
                </button>
                <div style={{ flex:1 }} />
                <button onClick={() => openPIEdit(pi)}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--text2)' }}>
                  <Pencil size={13}/> Sửa thời hạn
                </button>
                {canConfirmProd && hasSendableItems && (
                  <button onClick={() => setConfirmProdTarget(pi)}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'#fff' }}>
                    <Play size={13}/> Gửi QLSX
                  </button>
                )}
              </div>

              {/* PI header info */}
              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, padding:'14px 18px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)' }}>
                <div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:18 }}>{pi.code}</div>
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

              {/* Nhóm theo PO - mỗi PO là 1 khối, bên trong liệt kê các SKU thuộc PO đó */}
              {items.length === 0 ? (
                <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:40, textAlign:'center', color:'var(--text3)' }}>Không có SKU</div>
              ) : poGroups.map(([soCode, groupItems]: [string, any[]], gi: number) => (
              <div key={soCode + '-' + gi} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', marginBottom: gi === poGroups.length - 1 ? 0 : 16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:'#f3e8ff', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#6b21a8' }}>{soCode}</span>
                  <span style={{ fontSize:11, color:'#7c3aed' }}>{groupItems.length} SKU</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 105px 105px 105px 105px 110px', padding:'10px 18px', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>SKU</span>
                  {['Mua hàng','Khung CK','Đan','Đóng gói'].map(h => (
                    <span key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>
                  ))}
                  <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>Hạn giao</span>
                </div>
                {groupItems.map((item: any, idx: number) => {
                  const code = item.productVariant?.mfgProduct?.factoryCode ?? '—'
                  const name = item.productVariant?.mfgProduct?.name ?? ''
                  const color = item.productVariant?.colorCode
                  const qty  = item.quantity
                  const isLast = idx === groupItems.length - 1
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
                    <div key={item.id ?? idx} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 105px 105px 105px 105px 110px', padding:'14px 18px', alignItems:'center' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#0369a1' }}>{code}</span>
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
                            {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString('vi-VN')}</span>}
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
              ))}
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
                placeholder="Tìm mã PI..."
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
                    <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'var(--text)' }}>{pi.code}</div>
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

              {/* Section label - không còn cho chọn từng SKU (2026-08-24), gửi cả PI 1 lần */}
              <div style={{ marginBottom:8, flexShrink:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5 }}>
                  Danh sách SKU trong PI — {sendableIds.length}/{items.length} SKU gửi được
                </div>
              </div>

              {/* SKU list — scrollable, chỉ để xem, không chọn lẻ được nữa */}
              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                {items.map((item: any, i: number) => {
                  const approvalStatus: 'WAITING_QLSX' | 'WAITING_BOSS' | 'REJECTED' | 'APPROVED' | undefined = item.prodApproval?.status
                  const locked = approvalStatus === 'WAITING_QLSX' || approvalStatus === 'WAITING_BOSS' || approvalStatus === 'APPROVED'
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
                    <div key={i}
                      style={{ border: !locked ? '2px solid #2e7d32' : '1px solid var(--border)', borderRadius:8, overflow:'hidden', background: locked ? 'var(--surface2)' : '#f0fdf4', opacity: locked ? 0.6 : 1, userSelect:'none' }}>
                      {/* SKU info row */}
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
                        {/* Chỉ để xem - không chọn lẻ được nữa (2026-08-24), mọi SKU sendable đều
                            sẽ được gửi cùng lúc. */}
                        {locked ? (
                          <CheckCircle2 size={18} color={approvalStatus === 'APPROVED' ? '#2e7d32' : approvalStatus === 'WAITING_BOSS' ? '#0369a1' : '#b45309'} style={{ flexShrink:0 }} />
                        ) : (
                          <CheckCircle2 size={18} color="#2e7d32" style={{ flexShrink:0 }} />
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1', flexShrink:0 }}>{code}</span>
                            {name && <span style={{ fontSize:13, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>}
                          </div>
                          <div style={{ display:'flex', gap:5, marginTop:3 }}>
                            {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'1px 7px', borderRadius:10 }}>×{qty.toLocaleString('vi-VN')}</span>}
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
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid', borderColor: !locked ? '#bbf7d0' : 'var(--border)', background: !locked ? '#dcfce7' : 'var(--surface2)' }}>
                        {cols.map(({ label, val, own }, ci) => (
                          <div key={label} style={{ padding:'5px 10px', borderRight: ci < 3 ? '1px solid' : undefined, borderRightColor: !locked ? '#bbf7d0' : 'var(--border)', textAlign:'center' }}>
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
                  <span style={{ color:'var(--text2)' }}>
                    Sẽ gửi <strong style={{ color:'#2e7d32' }}>{sendableIds.length}</strong> SKU (cả PI)
                  </span>
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button onClick={() => setConfirmProdTarget(null)} disabled={!!confirmingProdId}
                    style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
                    Hủy
                  </button>
                  <button
                    onClick={() => handleSendForApproval(confirmProdTarget.id)}
                    disabled={!!confirmingProdId || sendableIds.length === 0}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background: sendableIds.length > 0 ? '#2e7d32' : '#e5e7eb', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: (confirmingProdId || sendableIds.length === 0) ? 'not-allowed' : 'pointer', color: sendableIds.length > 0 ? '#fff' : '#9ca3af', opacity: confirmingProdId ? 0.7 : 1 }}>
                    <CheckCircle2 size={15}/>
                    {confirmingProdId
                      ? 'Đang gửi...'
                      : sendableIds.length > 1 ? `Gửi QLSX (${sendableIds.length} SKU)` : 'Gửi QLSX'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* QLSX chọn kho thành phẩm & gửi sếp duyệt */}
      {qlsxTarget && (() => {
        const pi = qlsxTarget
        const items: any[] = (pi.items ?? []).filter((it: any) => it.prodApproval?.status === 'WAITING_QLSX')
        const selectedWh = finishedGoodsWarehouses.find((w: any) => w.code === qlsxWarehouseCode) ?? null
        const closeModal = () => { setQlsxTarget(null); setQlsxWarehouseCode(null) }
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

              {/* PI + hạn hoàn thành */}
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Mã PI</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{pi.code}</div>
                </div>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Hạn hoàn thành</div>
                  <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8' }}>{format(new Date(pi.deadline), 'dd/MM/yyyy')}</div>
                </div>
              </div>

              {/* Danh sách SKU sẽ gửi - CẢ PI, không chọn lẻ được nữa (2026-08-24) */}
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>
                SKU sẽ gửi — {items.length} SKU đang chờ QLSX
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14, maxHeight:180, overflowY:'auto' }}>
                {items.map((item: any, i: number) => (
                  <div key={item.id ?? i} style={{ border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1' }}>
                        {item.productVariant?.mfgProduct?.factoryCode ?? '—'}
                      </span>
                      {item.productVariant?.mfgProduct?.name && <span style={{ fontSize:12, color:'var(--text2)' }}>{item.productVariant.mfgProduct.name}</span>}
                    </div>
                    <div style={{ display:'flex', gap:6, marginTop:4 }}>
                      {item.quantity != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{item.quantity.toLocaleString('vi-VN')}</span>}
                      {item.productVariant?.colorCode && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{item.productVariant.colorCode}</span>}
                    </div>
                  </div>
                ))}
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

              {/* Actions */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
                <button onClick={closeModal} disabled={sendingToBoss}
                  style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor: sendingToBoss ? 'not-allowed' : 'pointer', color:'var(--text2)' }}>
                  Hủy
                </button>
                <button onClick={handleQlsxSendToBoss} disabled={sendingToBoss || qlsxWarehouseCode === null}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', background: qlsxWarehouseCode !== null ? '#2e7d32' : '#e5e7eb', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: (sendingToBoss || qlsxWarehouseCode === null) ? 'not-allowed' : 'pointer', color: qlsxWarehouseCode !== null ? '#fff' : '#9ca3af', opacity: sendingToBoss ? 0.7 : 1 }}>
                  <CheckCircle2 size={15}/>
                  {sendingToBoss ? 'Đang gửi...' : items.length > 1 ? `Gửi sếp duyệt (${items.length} SKU)` : 'Gửi sếp duyệt'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Duyệt PI — xác nhận trước khi tạo lệnh sản xuất, LUÔN cả PI (2026-08-24) */}
      {approveTarget && (() => {
        const pi = approveTarget
        const items: any[] = (pi.items ?? []).filter((it: any) => it.prodApproval?.status === 'WAITING_BOSS')
        if (items.length === 0) return null
        const piDeadline = new Date(pi.deadline)
        const busy = approvingKey === String(pi.id)

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

              {/* Đợt gộp: bấm Duyệt là duyệt TẤT CẢ SKU trong đợt cùng lúc. */}
              {pi.isMerged && (
                <div style={{ background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12.5, color:'#5b21b6' }}>
                  <b>Đợt gộp {pi.code}</b> — duyệt sẽ cho sản xuất <b>cả {items.length} SKU</b> trong
                  đợt và tính phương án cắt chung một lần cho cả nhóm:
                  <div style={{ marginTop:5, fontFamily:'monospace', fontSize:12 }}>
                    {items.map((it: any) => it.productVariant?.mfgProduct?.factoryCode ?? '—').join(' · ')}
                  </div>
                </div>
              )}

              {/* PI + hạn hoàn thành */}
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Mã PI</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{pi.code}</div>
                </div>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Hạn hoàn thành</div>
                  <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8' }}>{format(piDeadline, 'dd/MM/yyyy')}</div>
                </div>
              </div>

              {/* Danh sách SKU sẽ duyệt */}
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14, maxHeight:220, overflowY:'auto' }}>
                {items.map((item: any, i: number) => (
                  <div key={item.id ?? i} style={{ border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#0369a1' }}>
                        {item.productVariant?.mfgProduct?.factoryCode ?? '—'}
                      </span>
                      {item.productVariant?.mfgProduct?.name && <span style={{ fontSize:13, color:'var(--text2)' }}>{item.productVariant.mfgProduct.name}</span>}
                    </div>
                    <div style={{ display:'flex', gap:6, marginTop:5 }}>
                      {item.quantity != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{item.quantity.toLocaleString('vi-VN')}</span>}
                      {item.productVariant?.colorCode && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{item.productVariant.colorCode}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Hệ quả của hành động */}
              <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#166534' }}>
                <CheckCircle2 size={14} style={{ flexShrink:0, marginTop:1 }}/>
                <span>
                  Duyệt sẽ tạo lệnh sản xuất cho {items.length > 1 ? 'cả ' + items.length + ' SKU' : 'SKU này'} và bắt đầu sản xuất ngay — không thể hoàn tác.
                </span>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
                <button onClick={() => setApproveTarget(null)} disabled={busy}
                  style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor: busy ? 'not-allowed' : 'pointer', color:'var(--text2)' }}>
                  Hủy
                </button>
                <button onClick={() => handleApproveItem(pi)} disabled={busy}
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
            {isBoss && rejectTarget.isMerged ? (
              // Từ chối đợt gộp là hành động PHÁ HUỶ (xoá cả đợt), không phải trả lại 1 SKU - phải
              // nói rõ trước khi Sếp bấm, kèm danh sách SKU bị ảnh hưởng.
              <div style={{ fontSize:13, color:'var(--text2)', marginBottom:10 }}>
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 12px', color:'#991b1b' }}>
                  Từ chối sẽ <b>xoá đợt gộp {rejectTarget.code}</b> và trả{' '}
                  <b>{(rejectTarget.items ?? []).length} SKU</b> về đơn hàng gốc kèm lý do. KHSX
                  sẽ thấy chúng lại ở màn "Tối ưu cắt sắt" để gộp tổ hợp khác.
                  <div style={{ marginTop:5, fontFamily:'monospace', fontSize:12 }}>
                    {(rejectTarget.items ?? [])
                      .map((it: any) => it.productVariant?.mfgProduct?.factoryCode ?? '—')
                      .join(' · ')}
                  </div>
                </div>
              </div>
            ) : (() => {
              // Cả PI, không còn từ chối lẻ 1 SKU (2026-08-24) - QLSX có thể có nhiều SKU đang chờ
              // mình trong cùng 1 PI (kể cả PI gộp, nếu Sếp chưa duyệt tới); Boss PI cắt riêng chỉ
              // có đúng 1.
              const status = isBoss ? 'WAITING_BOSS' : 'WAITING_QLSX'
              const pending: any[] = (rejectTarget.items ?? []).filter((it: any) => it.prodApproval?.status === status)
              return (
                <div style={{ fontSize:13, color:'var(--text2)', marginBottom:10 }}>
                  {pending.length > 1 ? <>Cả <strong>{pending.length} SKU</strong> sau sẽ được gửi lại cho KHSX sửa thời hạn:</> : 'SKU sau sẽ được gửi lại cho KHSX sửa thời hạn:'}
                  <div style={{ marginTop:5, fontFamily:'monospace', fontSize:12, color:'#0369a1' }}>
                    {pending.map((it: any) => it.productVariant?.mfgProduct?.factoryCode ?? '—').join(' · ')}
                  </div>
                </div>
              )
            })()}
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
                      {qty != null && <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)', background:'var(--surface)', padding:'1px 8px', borderRadius:10 }}>×{qty.toLocaleString('vi-VN')}</span>}
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
