'use client'
import { useState, useEffect } from 'react'
import { OutgoingTransfersPanel, WorkshopMovePanel } from './InternalTransferSections'
import PhieuXuatPage from './PhieuXuatPage'
import { IssueSlipCartProvider } from './IssueSlipCart'
import { createIssueSlip, type IssueSlip } from '../../../services/issue-slips-api'
import { printIssueSlip } from './printIssueSlip'
import { ArrowUpFromLine, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BePieceTransferPlanItem } from '../../../services/warehouse-transfers-api'
import type { BePackagingIssuePlanItem } from '../../../services/packaging-issues-api'
import { isFamilyScope, warehouseFamilyOf } from '../../../utils/warehouseFamily'
import { safeArr } from '../../../utils/array'
import { errMsg } from '../../../utils/errors'
import { compactTh as th, compactTd as td, tableWrap, tbl, row, badge, emptyBox, tableScrollBox, stickyHeaderRow } from '../../../styles/table'
import { backBtn } from '../../../styles/buttons'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import MobileListCards from '../../../components/MobileListCards'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle } from '../../../styles/typography'
import XuatHangBookingSection from './XuatHangBookingSection'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import LenhCode from '../../../components/LenhCode'

interface Wh { id: string; name: string; code: string; kind?: string | null; workshopId?: string | null }

// ── Types ──────────────────────────────────────────────────────────────────────

type OrderStatus = 'cho' | 'da'

interface OrderLine {
  id: string
  materialName: string
  unit: string
  plannedQty: number
  availableQty: number
  confirmedQty: number
  inputQty: string
}

// 2026-09-04: phân biệt theo TỪNG ĐƠN (không còn theo scope trang) - từ khi packaging-issue
// không còn giới hạn 1 gia đình cố định (xem PACKAGING_SCOPE ở dưới), 1 trang có thể hiện lẫn đơn
// packaging VÀ đơn ship cùng lúc (vd thủ kho scope 'thanh-pham'), nên confirmLine()/banner/cột
// bảng không còn suy được loại đơn chỉ từ cờ isXScope của cả trang - phải đọc field này.
type OrderKind = 'piece' | 'packaging' | 'ship'

interface Order {
  id: string
  kind: OrderKind
  ref: string
  counterpart: string
  date: string
  poNumber?: string
  skuCode?: string
  skuName?: string
  piCode?: string
  /** Đơn 'piece': kho Thành phẩm của lệnh. */
  finishedWarehouseCode?: string | null
  lines: OrderLine[]
}

// ── Status ─────────────────────────────────────────────────────────────────────

function getStatus(order: Order): OrderStatus {
  // plannedQty > 0 bắt buộc - tránh 1 dòng chưa hề bắt đầu (plannedQty=confirmedQty=0, vd mảnh
  // "phoi-son-han" chưa qua KCS lần nào) bị tính "đủ" (0 >= 0) khiến cả PO hiện nhầm "Hoàn thành".
  return order.lines.length > 0 && order.lines.every(l => l.plannedQty > 0 && l.confirmedQty >= l.plannedQty) ? 'da' : 'cho'
}

const STATUS: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  cho: { label: 'Chờ xử lý',  color: 'var(--fg-92400e)', bg: 'var(--bg-fef3c7)' },
  da:  { label: 'Hoàn thành', color: 'var(--fg-166534)', bg: 'var(--bg-dcfce7)' },
}

// ── Component ──────────────────────────────────────────────────────────────────

const ACCENT = 'var(--fg-e65100)'

// Piece transfer (mảnh/vật tư thành phẩm) chỉ áp dụng cho chặng phoi-son-han → vat-tu-tp - gộp
// theo ProductionOrder (byPo keyed theo productionOrderId), hiển thị PI thật cho user (2026-09-05,
// trước đó hiện PO - xem docs/review-2026-08-17-sanxuat-stage-v16-va-chuyen-kho-manh.md mục 6/7 ở
// BE cho quyết định gộp gốc). Chặng vat-tu-tp → thanh-pham dùng packaging-issues thật (xem PACKAGING_SCOPE).
// 2026-09-03: so khớp theo GIA ĐÌNH (isFamilyScope) thay vì đúng 1 literal - kho phôi-sơn-hàn PHỤ
// (phoi-son-han-2...) giờ cũng vào được đúng nhánh này, trước đây rơi vào "không có lệnh nào".
const PIECE_TRANSFER_SCOPE = 'phoi-son-han'

function pieceLabelToUnit(label: BePieceTransferPlanItem['label']): string {
  return label === 'MANH' ? 'Mảnh' : 'Vật tư TP'
}

// item.readyQty/suggestedQty/transferredQty map vào đúng plannedQty/availableQty/confirmedQty
// sẵn có của OrderLine (không cần shape riêng) - "Kế hoạch" ở đây đọc là "đã qua KCS tính đến
// nay", "Thực có" đọc là "còn có thể chuyển" (đã trừ phần đã nằm trong phiếu PENDING/CONFIRMED
// trước đó - xem WarehouseTransfersService.getPieceTransferPlan ở BE).
function pieceItemsToOrders(summaries: { id: string; poNumber: string; salesOrderCode: string | null; piCode: string }[], plan: BePieceTransferPlanItem[]): Order[] {
  const byPo = new Map<string, BePieceTransferPlanItem[]>()
  for (const item of plan) {
    const arr = byPo.get(item.productionOrderId) ?? []
    arr.push(item)
    byPo.set(item.productionOrderId, arr)
  }
  return summaries
    .filter(o => (byPo.get(o.id)?.length ?? 0) > 0)
    .map(o => {
      const items = byPo.get(o.id) ?? []
      const displayCode = o.salesOrderCode ?? '—'
      return {
        id: o.id,
        kind: 'piece' as const,
        ref: displayCode,
        counterpart: 'Kho Thành phẩm của lệnh',
        date: new Date().toISOString(),
        poNumber: displayCode,
        piCode: o.piCode,
        skuName: items[0]?.productName,
        // Kho Thành phẩm QLSX đã chọn cho SKU (09/11/2026: mảnh không đan chuyển thẳng về đây).
        finishedWarehouseCode: items[0]?.finishedWarehouseCode ?? null,
        lines: items.map(it => ({
          id: it.pieceId,
          materialName: `${it.pieceCode} — ${it.pieceName}`,
          unit: pieceLabelToUnit(it.label),
          plannedQty: it.readyQty,
          availableQty: it.suggestedQty,
          confirmedQty: it.transferredQty,
          inputQty: '',
        })),
      }
    })
}

// Xuất vật tư đóng gói (tem nhãn, màng PE...) chặng vat-tu-tp → thanh-pham - hiển thị PI thật
// (2026-09-05), cùng idiom PIECE_TRANSFER_SCOPE ở trên (module packaging-issues, thay MOCK, 2026-08-19).
//
// KHÔNG còn gán cứng theo 1 gia đình cố định (2026-09-04, sửa sau khi test sống PO-41 "Ghế tình
// yêu" phát hiện: vật tư đóng gói của SKU này - vd VTK-009 "Thùng" - lại được Admin gán kho MẶC
// ĐỊNH là chính "thanh-pham" gốc, không phải "vat-tu-tp" như đa số. Trước đây trang chỉ hiện màn
// Đóng gói cho ĐÚNG scope 'vat-tu-tp' - vật tư nhóm này không ai xuất được qua UI: thủ kho
// vat-tu-tp bị BE chặn (assertWarehouseScope, không đúng kho vật lý của vật tư), thủ kho thanh-pham
// thì trang không hiện màn Đóng gói cho họ, chỉ hiện màn Xuất hàng cho khách. Giờ SO TRỰC TIẾP
// item.materialWarehouseCode === scope (mã kho THẬT của vật tư, không phải cả gia đình) - đúng
// thủ kho nào giữ vật tư nào thì thấy đúng vật tư đó, bất kể họ thuộc gia đình nào.

// item.requiredQty/issuedQty/remainingToIssue map vào đúng plannedQty/confirmedQty/availableQty
// sẵn có của OrderLine, cùng cách pieceItemsToOrders() đã làm.
function packagingItemsToOrders(summaries: { id: string; poNumber: string; salesOrderCode: string | null; piCode: string }[], plan: BePackagingIssuePlanItem[]): Order[] {
  const byPo = new Map<string, BePackagingIssuePlanItem[]>()
  for (const item of plan) {
    const arr = byPo.get(item.productionOrderId) ?? []
    arr.push(item)
    byPo.set(item.productionOrderId, arr)
  }
  return summaries
    .filter(o => (byPo.get(o.id)?.length ?? 0) > 0)
    .map(o => {
      const items = byPo.get(o.id) ?? []
      const displayCode = o.salesOrderCode ?? '—'
      return {
        id: o.id,
        kind: 'packaging' as const,
        ref: displayCode,
        counterpart: 'Kho Thành phẩm',
        date: new Date().toISOString(),
        poNumber: displayCode,
        piCode: o.piCode,
        skuName: items[0]?.productName,
        lines: items.map(it => ({
          id: it.materialId,
          materialName: `${it.materialCode} — ${it.materialName}`,
          unit: it.materialUnit,
          plannedQty: it.requiredQty,
          availableQty: it.remainingToIssue,
          confirmedQty: it.issuedQty,
          inputQty: '',
        })),
      }
    })
}

// Kho thành phẩm xuất hàng cho khách: Đợt 10b (YC5 5.7) bỏ nút "Xuất giao" theo từng dòng đơn - mọi lần xuất hàng đi qua
// booking (XuatHangBookingSection).
const SHIP_SCOPE = 'thanh-pham'


// Giữ nguyên inputQty đang gõ dở của từng dòng khi refetch dữ liệu remote đè lên state cục bộ -
// cùng idiom TwoTierScreen ở components/sanxuat/core.tsx.
function mergeInputQty(prev: Order[], next: Order[]): Order[] {
  return next.map(o => {
    const old = prev.find(p => p.id === o.id)
    if (!old) return o
    return { ...o, lines: o.lines.map(l => {
      const oldLine = old.lines.find(pl => pl.id === l.id)
      return oldLine ? { ...l, inputQty: oldLine.inputQty } : l
    }) }
  })
}

export default function WarehouseXuatPage({ scope }: { scope: string }) {
  // Điện thoại: danh sách PI/PO dạng thẻ (MobileListCards) thay bảng 4-5 cột chiều rộng cố định.
  const isMobile = useIsMobile()
  // 2026-09-03: so khớp theo GIA ĐÌNH thay vì đúng 1 literal - kho phụ (phoi-son-han-2,
  // vat-tu-tp-2...) giờ cũng chạy đúng nhánh nghiệp vụ của gia đình mình.
  const isPieceScope = isFamilyScope(scope, PIECE_TRANSFER_SCOPE)
  const isShipScope = isFamilyScope(scope, SHIP_SCOPE)

  const [orders, setOrders]         = useState<Order[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Đơn xuất thẳng cho khách (kind 'ship') là SalesOrder - không có PI, mỗi "dòng" là 1 SKU.
  const allShip = orders.length > 0 && orders.every(o => o.kind === 'ship')

  const { data: warehouses } = useFetch<Wh[]>(() => api.getWarehouses(), [])
  const myWarehouse = safeArr(warehouses).find(w => w.code === scope) ?? null

  // Anh Nhân 09/11/2026: mảnh KHÔNG đan chuyển thẳng sang kho Thành phẩm của lệnh (QLSX đã chọn cho từng SKU) - kho đích lấy
  // theo lệnh; lệnh cũ chưa chọn kho thì thủ kho chọn trong các kho Thành phẩm. Mảnh cần đan không còn ở đây (xuất đan bằng phiếu).
  const [pieceDestCode, setPieceDestCode] = useState('')
  // Đợt 7: kho Hàn của xưởng KHÔNG có kho Sơn (Phước An) - mảnh cần sơn hàn xong chuyển sang kho Sơn Phú An (chặng 'TO_PAINT');
  // trong cùng xưởng không lập phiếu giữa các công đoạn (user chốt 09/11).
  const toPaint = myWarehouse?.kind === 'HAN'
    && !safeArr(warehouses).some(w => w.kind === 'SON' && w.workshopId === myWarehouse.workshopId)
  const pieceDestOptions = safeArr(warehouses).filter(w => (toPaint ? w.kind === 'SON' : isFamilyScope(w.code, 'thanh-pham')))
  const pieceDestFor = (order: Order | null) => {
    const fixed = !toPaint && order?.finishedWarehouseCode
      ? pieceDestOptions.find(w => w.code === order.finishedWarehouseCode) ?? null
      : null
    return fixed ?? pieceDestOptions.find(w => w.code === pieceDestCode) ?? pieceDestOptions[0] ?? null
  }

  // Danh sách PO + kế hoạch chuyển thật (mảnh/vật tư TP) — thay MOCK cho đúng chặng phoi-son-han.
  const { data: pieceOrders, error: pieceOrdersError, refetch: refetchPieceOrders } = useFetch<Order[]>(async () => {
    if (!isPieceScope) return []
    const summaries = await api.listProductionOrdersForStage()
    if (summaries.length === 0) return []
    const plan = await api.getPieceTransferPlan(summaries.map(o => o.id), toPaint ? 'TO_PAINT' : undefined)
    return pieceItemsToOrders(summaries, plan)
  }, [isPieceScope, toPaint])

  // Danh sách PO + kế hoạch xuất vật tư đóng gói thật — KHÔNG còn gán theo 1 gia đình cố định
  // (2026-09-04, xem comment PACKAGING_SCOPE cũ ở trên) - luôn fetch rồi lọc đúng dòng mà
  // materialWarehouseCode === scope (mã kho THẬT của chính thủ kho này), bất kể họ thuộc gia đình
  // nào - 1 trang giờ có thể vừa có đơn packaging vừa có đơn khác (piece/ship) cùng lúc.
  const { data: packagingOrders, error: packagingOrdersError, refetch: refetchPackagingOrders } = useFetch<Order[]>(async () => {
    const summaries = await api.listProductionOrdersForStage()
    if (summaries.length === 0) return []
    const plan = await api.getPackagingIssuePlan(summaries.map(o => o.id))
    const mine = plan.filter(item => item.materialWarehouseCode === scope)
    if (mine.length === 0) return []
    return packagingItemsToOrders(summaries, mine)
  }, [scope])


  // Realtime: đơn xuất / đợt đóng gói / tồn đổi -> làm mới đúng danh sách tương ứng. Các hàm refetch này
  // đã gộp giữ số lượng đang gõ dở (xem comment phía trên), nên an toàn khi dữ liệu remote đổi.
  useRealtimeRefetch(['packaging-issues'], () => { void refetchPackagingOrders() })
  useRealtimeRefetch(['stock'], () => { void refetchPieceOrders() })
  // useFetch nuốt lỗi vào state `error` riêng, không throw ra ngoài — trước đây không màn nào đọc
  // field này nên 1 lỗi BE (vd ConflictException của getPieceTransferPlan) khiến danh sách chỉ
  // hiện trắng trơn "Không có lệnh xuất nào đang chờ xử lý" mà không có gợi ý gì (Critical C2).
  // packagingOrdersError giờ luôn có thể liên quan (không còn gán theo 1 scope cố định).
  const activeListError = pieceOrdersError ?? packagingOrdersError
  const retryActiveList = () => { refetchPieceOrders(); refetchPackagingOrders() }

  // Gộp CẢ 3 nguồn vào 1 state duy nhất trong CÙNG 1 effect (2026-09-04) - trước đây 3 effect
  // riêng, mỗi cái tự setOrders() ĐÈ TOÀN BỘ state bằng đúng slice của mình (mergeInputQty trả về
  // đúng độ dài của next, không cộng dồn với prev) - an toàn khi 3 cờ isXScope loại trừ lẫn nhau
  // (chỉ đúng 1 effect thật sự chạy), nhưng từ khi packaging không còn loại trừ theo gia đình nữa,
  // 1 trang có thể có CẢ packagingOrders LẪN shipOrders cùng lúc - 2 effect cũ sẽ đua nhau ghi đè,
  // effect nào chạy sau cùng "thắng" và xoá mất dữ liệu của effect kia. Gộp lại + giữ nguyên inputQty
  // đang gõ dở (cùng idiom TwoTierScreen ở components/sanxuat/core.tsx).
  useEffect(() => {
    const next = [...(pieceOrders ?? []), ...(packagingOrders ?? [])]
    setOrders(prev => mergeInputQty(prev, next))
  }, [pieceOrders, packagingOrders])

  const [transferBusyLine, setTransferBusyLine] = useState<string | null>(null)
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({})
  // Tổng duyệt 11/11: bấm "Xác nhận" xong không có phản hồi (ô vẫn giữ số, "Có thể chuyển" chưa kịp đổi) nên người dùng
  // bấm lại -> sinh phiếu trùng. Nay xoá ô số lượng + hiện số phiếu vừa lập ngay khi tạo xong.
  const [transferDone, setTransferDone] = useState<Record<string, string>>({})

  const selected = orders.find(o => o.id === selectedId) ?? null

  const confirmLine = async (orderId: string, lineId: string) => {
    const order = orders.find(o => o.id === orderId)
    const line = order?.lines.find(l => l.id === lineId)
    if (!order || !line) return
    const raw = Math.max(0, Number(line.inputQty) || 0)
    if (raw <= 0) return
    const qty = Math.min(raw, line.availableQty)
    if (qty <= 0) return

    // Chặng phoi-son-han: tạo phiếu chuyển kho piece-only thật (mảnh/vật tư TP theo PO), số lượng
    // đã được BE tự clamp theo kế hoạch (đã qua KCS trừ đã chuyển trước đó) tại thời điểm tạo.
    // Kho đích là kho vat-tu-tp Thủ kho đã chọn ở dropdown (pieceDestWh) - không còn tự động theo
    // 1 cặp cố định (2026-09-03).
    const pieceDestWh = pieceDestFor(order)
    if (order.kind === 'piece' && myWarehouse && pieceDestWh) {
      setTransferBusyLine(lineId)
      setTransferErrors(prev => ({ ...prev, [lineId]: '' }))
      setTransferDone(prev => ({ ...prev, [lineId]: '' }))
      let created: { code: string }
      try {
        created = await api.createPieceWarehouseTransfer({
          fromWarehouseId: myWarehouse.id,
          toWarehouseId: pieceDestWh.id,
          pieceItems: [{ productionOrderId: order.id, pieceId: line.id, quantity: qty }],
        })
      } catch (e) {
        setTransferErrors(prev => ({ ...prev, [lineId]: errMsg(e, 'Không thể tạo phiếu chuyển kho nội bộ') }))
        setTransferBusyLine(null)
        return
      }
      setTransferBusyLine(null)
      setOrders(prev => prev.map(o => o.id !== orderId ? o : { ...o, lines: o.lines.map(l => l.id !== lineId ? l : { ...l, inputQty: '' }) }))
      setTransferDone(prev => ({ ...prev, [lineId]: `Đã lập phiếu ${created.code} (${qty}) - in phiếu ở bảng "Phiếu đã gửi" bên dưới` }))
      refetchPieceOrders() // đọc lại suggestedQty/transferredQty thật từ BE thay vì tự trừ cục bộ
      return
    }

    // Xuất vật tư đóng gói thật (packaging-issues), ghi StockLedger ngay. Dispatch theo order.kind
    // (2026-09-04), KHÔNG còn theo cờ scope cả trang - đơn packaging có thể lẫn với đơn ship/piece
    // khác trên CÙNG 1 trang (xem comment PACKAGING_SCOPE cũ).
    // Đóng gói (09/11/2026): không xuất từng dòng nữa - lập 1 phiếu XK cho các dòng đã nhập (createPackagingSlip bên dưới).


    // order.kind chỉ nhận 1 trong 3 giá trị ở trên (piece/packaging/ship, xem OrderKind) - cả 3
    // đều return sớm, nên không còn nhánh nào rơi xuống đây. Trước 09/09/2026 còn 1 nhánh dự phòng
    // ("isInternalChain" generic) tạo phiếu chuyển kho qua createWarehouseTransfer() với dòng
    // "ghi tự do" (materialName gõ tay, không gắn materialId) - đã xác nhận dead code (không đơn
    // thật nào còn đi qua nhánh đó) và dọn hẳn cùng lúc với việc bắt buộc materialId ở BE (audit
    // toàn diện 09/09/2026, mục Trung bình "phiếu ghi tự do").
  }

  // Xuất vật tư đóng gói (09/11/2026): lập 1 phiếu XK cho mọi dòng đã nhập số của lệnh - in, người nhận ký, tải ảnh ở bảng
  // "Phiếu chờ ký" bên dưới rồi mới trừ tồn (cùng cách phiếu xuất sắt / vật tư hàn, sơn).
  const [slipBusy, setSlipBusy] = useState(false)
  const [slipMsg, setSlipMsg] = useState<{ ok: boolean; text: string; slip?: IssueSlip } | null>(null)
  const createPackagingSlip = async (order: Order) => {
    const lines = order.lines
      .map(l => ({ l, q: Math.min(Number(l.inputQty) || 0, l.availableQty) }))
      .filter(x => x.q > 0)
    if (lines.length === 0) return
    setSlipBusy(true); setSlipMsg(null)
    try {
      const slip = await createIssueSlip({
        recipientName: 'Chuyền kiểm / đóng gói',
        lines: lines.map(({ l, q }) => ({ kind: 'PACKAGING', materialId: l.id, productionOrderId: order.id, qty: q })),
      })
      setOrders(prev => prev.map(o => o.id !== order.id ? o : { ...o, lines: o.lines.map(l => ({ ...l, inputQty: '' })) }))
      setSlipMsg({ ok: true, text: `Đã lập phiếu ${slip.code} (${lines.length} dòng). In phiếu → người nhận ký → tải ảnh ở "Phiếu chờ ký" bên dưới rồi xác nhận xuất.`, slip })
    } catch (e) {
      setSlipMsg({ ok: false, text: errMsg(e, 'Không lập được phiếu xuất') })
    } finally {
      setSlipBusy(false)
    }
  }

  const updateInput = (orderId: string, lineId: string, val: string) =>
    setOrders(prev => prev.map(o =>
      o.id !== orderId ? o : { ...o, lines: o.lines.map(l => l.id !== lineId ? l : { ...l, inputQty: val }) }
    ))

  // 2026-09-03: any-family thay vì đúng 3 literal - kho phụ (thanh-pham-2, phoi-son-han-2...)
  // cũng dùng layout theo PO như kho gốc cùng gia đình.
  const usePOLayout = !!warehouseFamilyOf(scope)

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const cfg = STATUS[getStatus(selected)]
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedId(null)} style={backBtn}>
              <ChevronLeft size={15} /> Quay lại
            </button>
            <div>
              {usePOLayout && selected.poNumber ? (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text3)' }}>
                      {selected.poNumber}
                      {selected.piCode && <> <span style={{ color: 'var(--border)' }}>·</span> <LenhCode piCode={selected.piCode} /></>}
                    </span>
                    <span style={{ fontWeight: 600, marginLeft: 10 }}>{selected.skuCode}</span>
                    {selected.skuName && <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6, fontSize: 15 }}>— {selected.skuName}</span>}
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
                    Đối tác: {selected.counterpart} · {selected.lines.length} mặt hàng · đã xác nhận {selected.lines.filter(l => l.confirmedQty > 0).length}/{selected.lines.length} dòng
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    <span style={{ color: ACCENT }}>{selected.ref}</span>
                    <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 8, fontSize: 15 }}>{selected.counterpart}</span>
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
                    Ngày: {format(new Date(selected.date), 'dd/MM/yyyy')} · {selected.lines.length} vật tư · đã xác nhận {selected.lines.filter(l => l.confirmedQty > 0).length}/{selected.lines.length} dòng
                  </div>
                </>
              )}
            </div>
          </div>
          <span style={{ ...badge, fontSize: 12, padding: '4px 14px', alignSelf: 'center', color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
        </div>

        {/* packaging-issues: KHÔNG qua warehouse-transfers PENDING/CONFIRMED như 2 chặng còn lại -
            ghi StockLedger ngay lúc xác nhận (xem confirmLine, nhánh order.kind === 'packaging') -
            phát hiện qua browser thật 2026-08-19: banner cũ dùng chung isInternalChain nói sai
            "chờ kho nhận xác nhận" cho chặng này dù tồn kho đã đổi ngay lập tức. Dispatch theo
            selected.kind (2026-09-04) - không còn theo cờ scope cả trang, vì 1 trang giờ có thể
            vừa có đơn packaging vừa có đơn khác (vd ship) cùng lúc. */}
        {selected.kind === 'packaging' && (
          <div style={{ marginBottom: 14, padding: '8px 14px', background: 'var(--bg-ede7f6)', border: '1px solid var(--fg-d1c4e9)', borderRadius: 8, fontSize: 12, color: 'var(--fg-4527a0)' }}>
            Nhập số rồi bấm &quot;Lập phiếu xuất&quot; → in phiếu, người nhận ký → tải ảnh ở &quot;Phiếu chờ ký&quot; bên dưới rồi xác nhận xuất - lúc đó mới trừ tồn. Số xuất không vượt số bộ đã qua Chuyền kiểm.
          </div>
        )}
        {/* phoi-son-han (piece transfer): mảnh không đan về kho Thành phẩm của lệnh (09/11/2026) - lệnh đã có kho thì cố định,
            lệnh cũ chưa chọn kho thì thủ kho chọn (chỉ hiện dropdown khi có từ 2 lựa chọn). */}
        {selected.kind === 'piece' && (() => { const pieceDestWh = pieceDestFor(selected); const fixedDest = !toPaint && !!selected.finishedWarehouseCode && pieceDestWh?.code === selected.finishedWarehouseCode; return (
          <div style={{ marginBottom: 14, padding: '8px 14px', background: 'var(--bg-ede7f6)', border: '1px solid var(--fg-d1c4e9)', borderRadius: 8, fontSize: 12, color: 'var(--fg-4527a0)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{toPaint
              ? <>Mảnh cần sơn đã qua KCS Hàn: bấm &quot;Xác nhận&quot; sẽ tạo phiếu chuyển sang kho Sơn bên dưới (chở sang Phú An) — kho Sơn xác nhận khi nhận hàng.</>
              : <>Mảnh không đan: bấm &quot;Xác nhận&quot; sẽ tạo phiếu chuyển sang kho Thành phẩm của lệnh — tồn kho chỉ cập nhật sau khi kho nhận xác nhận. Mảnh cần đan lập phiếu ở mục Xuất đan.</>}</span>
            {pieceDestOptions.length > 1 && !fixedDest ? (
              <select
                value={pieceDestWh?.code ?? ''}
                onChange={e => setPieceDestCode(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--fg-d1c4e9)', borderRadius: 6, background: 'var(--surface)', color: 'var(--fg-4527a0)', fontWeight: 600 }}
              >
                {pieceDestOptions.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
              </select>
            ) : pieceDestWh ? (
              <strong>{pieceDestWh.name}</strong>
            ) : (
              <strong style={{ color: 'var(--fg-dc2626)' }}>Chưa có kho {toPaint ? 'Sơn' : 'Thành phẩm'} nào — không thể xuất</strong>
            )}
          </div>
        ) })()}

        {/* 7-column xuất table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col style={{ width: 56 }} /><col style={{ width: 84 }} /><col style={{ width: 72 }} /><col style={{ width: 72 }} /><col style={{ width: 72 }} /><col style={{ width: 170 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>{selected.kind === 'piece' ? 'Mảnh / Vật tư TP' : 'Vật tư'}</th>
                <th style={th}>{selected.kind === 'piece' ? 'Loại' : 'ĐVT'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{selected.kind === 'piece' ? 'Đã qua KCS' : 'Kế hoạch'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{selected.kind === 'piece' ? 'Có thể chuyển' : 'Thực có'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{selected.kind === 'piece' ? 'Đã chuyển' : 'Đã xuất'}</th>
                <th style={{ ...th, textAlign: 'right' }}>Còn lại</th>
                <th style={th}>Xuất</th>
              </tr>
            </thead>
            <tbody>
              {selected.lines.map(l => {
                // plannedQty > 0 bắt buộc - cùng lý do getStatus() (tránh dòng chưa hề bắt đầu bị
                // tính "đủ" do 0 >= 0).
                const done      = l.plannedQty > 0 && l.confirmedQty >= l.plannedQty
                const partial   = l.confirmedQty > 0 && !done
                const conLai    = l.plannedQty - l.confirmedQty
                const noStock   = l.availableQty <= 0
                const inputNum  = Number(l.inputQty)
                const overAvail = !!l.inputQty && inputNum > l.availableQty
                const can       = !!l.inputQty && inputNum > 0 && !overAvail
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)', background: done ? 'rgba(22,101,52,.04)' : undefined }}>
                    <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.materialName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{l.unit}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.plannedQty.toLocaleString('vi-VN')}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: l.availableQty > 0 ? 'var(--fg-2563eb)' : 'var(--fg-dc2626)' }}>
                      {l.availableQty.toLocaleString('vi-VN')}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? 'var(--fg-16a34a)' : partial ? 'var(--fg-d97706)' : 'var(--text)' }}>
                      {done && <span style={{ marginRight: 4, fontSize: 11 }}>✓</span>}
                      {l.confirmedQty.toLocaleString('vi-VN')}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: conLai > 0 ? 'var(--fg-d97706)' : 'var(--fg-16a34a)' }}>
                      {conLai.toLocaleString('vi-VN')}
                    </td>
                    <td style={td}>
                      {done ? (
                        <span style={{ fontSize: 12, color: 'var(--fg-16a34a)', fontWeight: 600 }}>Đã xong</span>
                      ) : noStock ? (
                        <span style={{ fontSize: 12, color: 'var(--fg-dc2626)', fontWeight: 600 }}>{selected.kind === 'piece' ? 'Chưa có hàng' : 'Hết hàng'}</span>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number" min={1} max={l.availableQty} value={l.inputQty}
                              onChange={e => updateInput(selected.id, l.id, e.target.value)}
                              placeholder="SL"
                              disabled={transferBusyLine === l.id}
                              style={{ width: 72, padding: '4px 8px', border: `1px solid ${overAvail ? 'var(--fg-dc2626)' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                            />
                            {selected.kind !== 'packaging' && <button onClick={() => confirmLine(selected.id, l.id)} disabled={!can || transferBusyLine === l.id}
                              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: can ? ACCENT : 'var(--surface2)', color: can ? '#fff' : 'var(--text3)', cursor: can && transferBusyLine !== l.id ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                              {transferBusyLine === l.id ? 'Đang gửi...' : 'Xác nhận'}
                            </button>}
                          </div>
                          {transferErrors[l.id] && (
                            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-dc2626)' }}>{transferErrors[l.id]}</div>
                          )}
                          {transferDone[l.id] && (
                            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-2e7d32)' }}>{transferDone[l.id]}</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {selected.kind === 'packaging' && (() => {
          const n = selected.lines.filter(l => Number(l.inputQty) > 0 && Number(l.inputQty) <= l.availableQty).length
          return (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Nhập số ở cột “Xuất” cho các vật tư cần cấp rồi lập 1 phiếu xuất cho cả lệnh.</span>
              <div style={{ flex: 1 }} />
              {slipMsg?.slip && (
                <button onClick={() => printIssueSlip(slipMsg.slip!)} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
                  In {slipMsg.slip.code}
                </button>
              )}
              <button onClick={() => void createPackagingSlip(selected)} disabled={n === 0 || slipBusy}
                style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: n > 0 && !slipBusy ? ACCENT : 'var(--surface2)', color: n > 0 && !slipBusy ? '#fff' : 'var(--text3)', cursor: n > 0 && !slipBusy ? 'pointer' : 'not-allowed' }}>
                {slipBusy ? 'Đang lập…' : `Lập phiếu xuất${n > 0 ? ` (${n} dòng)` : ''}`}
              </button>
              {slipMsg && <div style={{ width: '100%', fontSize: 12, color: slipMsg.ok ? 'var(--fg-2e7d32)' : 'var(--fg-dc2626)' }}>{slipMsg.text}</div>}
            </div>
          )
        })()}
        {selected.kind === 'packaging' && (
          <div style={{ marginTop: 20 }}>
            <IssueSlipCartProvider><PhieuXuatPage listOnly /></IssueSlipCartProvider>
          </div>
        )}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ ...pageTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowUpFromLine size={20} color={ACCENT} /> Xuất theo đơn hàng
        </h2>
      </div>

      {/* Đợt 10b: kho thành phẩm (và tổng kho) xuất hàng cho khách theo booking. */}
      {(isShipScope || scope == null) && <XuatHangBookingSection />}

      {(
        activeListError ? (
          <LoadErrorState error={activeListError} onRetry={retryActiveList} />
        ) : orders.length === 0 ? (
          <div style={emptyBox}>Không có lệnh xuất nào đang chờ xử lý</div>
        ) : isMobile ? (
          <MobileListCards emptyText="Không có lệnh xuất nào" items={orders.map(order => { const cfg = STATUS[getStatus(order)]; return { key: String(order.id), onClick: () => setSelectedId(order.id), title: <><b>{order.skuCode ?? '—'}</b>{order.skuName && <span style={{ color: 'var(--text3)' }}> — {order.skuName}</span>}</>, badge: <span style={{ ...badge, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>, meta: [{ label: 'PO', value: order.poNumber ?? order.ref }, { label: 'Lệnh', value: <LenhCode piCode={order.piCode} /> }, { label: order.kind === 'ship' ? 'Số SKU' : 'Số lượng vật tư', value: order.lines.length }] } })} />
        ) : (
          // PO | PI | SKU | Số lượng vật tư | Trạng thái — mọi kho (không có hạn giao). Đơn nội bộ
          // (piece/packaging) có cả PO lẫn PI thật; đơn ship (xuất thẳng cho khách) chỉ có PO (mã
          // đơn hàng bán) - PI lấy từ BE (SalesOrder.piCodes = các PI đơn đã gộp vào, '—' nếu chưa vào PI nào).
          // "Số lượng vật tư" của đơn ship thật ra là số dòng SKU nên đổi nhãn thành "Số SKU".
          <div style={{ ...tableWrap, ...tableScrollBox }}>
            <table style={tbl}>
              <colgroup>
                <col style={{ width: 100 }} /><col style={{ width: 120 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 130 }} />
              </colgroup>
              <thead><tr style={{ ...stickyHeaderRow, textAlign: 'left' }}>
                <th style={th}>PO</th>
                <th style={th}>Lệnh</th>
                <th style={th}>SKU</th>
                <th style={{ ...th, textAlign: 'right' }}>{allShip ? 'Số SKU' : 'Số lượng vật tư'}</th>
                <th style={th}>Trạng thái</th>
              </tr></thead>
              <tbody>
                {orders.map(order => {
                  const cfg = STATUS[getStatus(order)]
                  return (
                    <tr key={order.id} onClick={() => setSelectedId(order.id)} style={row}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ ...td, color: 'var(--text3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{order.poNumber ?? order.ref}</td>
                      <td style={{ ...td, fontWeight: 700, color: 'var(--text3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}><LenhCode piCode={order.piCode} /></td>
                      <td style={{ ...td, overflow: 'hidden' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 600 }}>{order.skuCode ?? '—'}</span>
                          {order.skuName && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{order.skuName}</span>}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{order.lines.length}</td>
                      <td style={td}><span style={{ ...badge, color: cfg.color, background: cfg.bg }}>{cfg.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
      {/* 09/11/2026: phiếu chuyển mảnh đã lập, chờ kho nhận - in phiếu để người nhận ký (v8 4.1/4.2). */}
      {/* Đổi xưởng (10/11/2026): hàng đang giữ cho lệnh ở kho này cần chuyển sang kho xưởng mới. */}
      {isPieceScope && <div style={{ marginTop: 24 }}><WorkshopMovePanel /></div>}
      {isPieceScope && <OutgoingTransfersPanel warehouseId={myWarehouse?.id ?? null} />}
      {/* Phiếu xuất đóng gói chờ ký / đã xuất của kho (09/11/2026). */}
      {!isPieceScope && (packagingOrders ?? []).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <IssueSlipCartProvider><PhieuXuatPage listOnly /></IssueSlipCartProvider>
        </div>
      )}
    </div>
  )
}
