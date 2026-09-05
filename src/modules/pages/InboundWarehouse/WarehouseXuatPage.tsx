'use client'
import { useState, useEffect } from 'react'
import { ArrowUpFromLine, ChevronLeft, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BePieceTransferPlanItem } from '../../../services/warehouse-transfers-api'
import type { BePackagingIssuePlanItem } from '../../../services/packaging-issues-api'
import type { SalesOrder } from '../../../types/sales'
import { TRANSFER_ROUTES, canSendFrom } from '../../../types/warehouse-transfer'
import { isFamilyScope, warehouseFamilyOf } from '../../../utils/warehouseFamily'
import { safeArr } from '../../../utils/array'
import { errMsg } from '../../../utils/errors'
import { compactTh as th, compactTd as td, tableWrap, tbl, row, badge, emptyBox } from '../../../styles/table'
import { backBtn, tabBtn } from '../../../styles/buttons'

interface Wh { id: string; name: string; code: string }

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
  lines: OrderLine[]
}

interface Txn {
  id: string
  orderRef: string
  materialName: string
  unit: string
  qty: number
  date: string
}

// ── Status ─────────────────────────────────────────────────────────────────────

function getStatus(order: Order): OrderStatus {
  // plannedQty > 0 bắt buộc - tránh 1 dòng chưa hề bắt đầu (plannedQty=confirmedQty=0, vd mảnh
  // "phoi-son-han" chưa qua KCS lần nào) bị tính "đủ" (0 >= 0) khiến cả PO hiện nhầm "Hoàn thành".
  return order.lines.length > 0 && order.lines.every(l => l.plannedQty > 0 && l.confirmedQty >= l.plannedQty) ? 'da' : 'cho'
}

const STATUS: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  cho: { label: 'Chờ xử lý',  color: '#92400e', bg: '#fef3c7' },
  da:  { label: 'Hoàn thành', color: '#166534', bg: '#dcfce7' },
}

// ── Component ──────────────────────────────────────────────────────────────────

const ACCENT = '#e65100'

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
        counterpart: 'Kho Vật tư thành phẩm',
        date: new Date().toISOString(),
        poNumber: displayCode,
        piCode: o.piCode,
        skuName: items[0]?.productName,
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

// Kho thành phẩm xuất trực tiếp cho khách - đơn vị là SalesOrder thật (sales-orders module), khác
// hẳn 2 chặng nội bộ phía trên (không đi qua warehouse-transfers). "Kế hoạch" = totalQty, "Đã
// xuất" = shippedQty, "Thực có" = phần còn lại được xuất (totalQty - shippedQty) - BE shipItem()
// không tự đối chiếu tồn kho vật lý (chỉ là bút toán đơn hàng), nên không có nguồn thật nào khác
// để lấy "tồn kho" - dùng luôn phần còn lại của đơn làm giới hạn nhập, đúng những gì BE thật sự
// chặn. SalesOrderItem không có field đơn vị riêng (luôn là thành phẩm đếm theo cái).
const SHIP_SCOPE = 'thanh-pham'

function salesOrdersToOrders(salesOrders: SalesOrder[]): Order[] {
  return salesOrders
    .map(so => ({
      id: so.id,
      kind: 'ship' as const,
      ref: so.code,
      counterpart: so.customerName,
      date: so.orderDate,
      poNumber: so.code,
      skuCode: so.items[0]?.skuCode,
      skuName: so.items[0]?.skuName,
      lines: so.items
        .filter(it => it.totalQty > it.shippedQty)
        .map(it => ({
          id: it.id,
          materialName: it.skuName ? `${it.skuCode} — ${it.skuName}` : it.skuCode,
          unit: 'cái',
          plannedQty: it.totalQty,
          availableQty: it.totalQty - it.shippedQty,
          confirmedQty: it.shippedQty,
          inputQty: '',
        })),
    }))
    .filter(o => o.lines.length > 0)
}

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
  // 2026-09-03: so khớp theo GIA ĐÌNH thay vì đúng 1 literal - kho phụ (phoi-son-han-2,
  // vat-tu-tp-2...) giờ cũng chạy đúng nhánh nghiệp vụ của gia đình mình.
  const isPieceScope = isFamilyScope(scope, PIECE_TRANSFER_SCOPE)
  const isShipScope = isFamilyScope(scope, SHIP_SCOPE)

  const [orders, setOrders]         = useState<Order[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [txns, setTxns]             = useState<Txn[]>([])
  const [view, setView]             = useState<'orders' | 'history'>('orders')

  // Kho này có nằm trong chuỗi chuyển kho nội bộ không (phôi sơn hàn, vật tư thành phẩm) —
  // nếu có, nút "Xác nhận" ở bảng dưới sẽ tạo phiếu chuyển kho nội bộ thật thay vì chỉ cập nhật cục bộ.
  const { data: warehouses } = useFetch<Wh[]>(() => api.getWarehouses(), [])
  const myWarehouse = safeArr(warehouses).find(w => w.code === scope) ?? null
  const nextHopCode = myWarehouse ? TRANSFER_ROUTES[myWarehouse.code] : undefined
  const nextHopWh = safeArr(warehouses).find(w => w.code === nextHopCode) ?? null
  const isInternalChain = canSendFrom(scope) && !!myWarehouse && !!nextHopWh

  // Chặng phoi-son-han → vat-tu-tp: người tạo phiếu TỰ CHỌN kho đích cụ thể trong gia đình
  // vat-tu-tp (quyết định nghiệp vụ 2026-09-03, không tự động theo cặp cố định như nextHopWh ở
  // trên - nextHopWh chỉ còn dùng cho nhánh isInternalChain generic, thực tế không còn kho nào đi
  // qua nhánh đó vì order.kind luôn khớp 1 trong 3 nhánh cụ thể trước). Mặc định chọn
  // kho vat-tu-tp đầu tiên tìm thấy, Thủ kho đổi lại nếu có nhiều kho vat-tu-tp phụ.
  const [pieceDestCode, setPieceDestCode] = useState('')
  const pieceDestOptions = safeArr(warehouses).filter(w => isFamilyScope(w.code, 'vat-tu-tp'))
  const pieceDestWh = pieceDestOptions.find(w => w.code === pieceDestCode) ?? pieceDestOptions[0] ?? null

  // Danh sách PO + kế hoạch chuyển thật (mảnh/vật tư TP) — thay MOCK cho đúng chặng phoi-son-han.
  const { data: pieceOrders, error: pieceOrdersError, refetch: refetchPieceOrders } = useFetch<Order[]>(async () => {
    if (!isPieceScope) return []
    const summaries = await api.listProductionOrdersForStage()
    if (summaries.length === 0) return []
    const plan = await api.getPieceTransferPlan(summaries.map(o => o.id))
    return pieceItemsToOrders(summaries, plan)
  }, [isPieceScope])

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

  // Danh sách đơn hàng bán + số lượng còn phải xuất thật — thay MOCK cho scope 'thanh-pham'.
  const { data: shipOrders, error: shipOrdersError, refetch: refetchShipOrders } = useFetch<Order[]>(async () => {
    if (!isShipScope) return []
    const salesOrders = await api.getSalesOrders()
    return salesOrdersToOrders(salesOrders)
  }, [isShipScope])

  // useFetch nuốt lỗi vào state `error` riêng, không throw ra ngoài — trước đây không màn nào đọc
  // field này nên 1 lỗi BE (vd ConflictException của getPieceTransferPlan) khiến danh sách chỉ
  // hiện trắng trơn "Không có lệnh xuất nào đang chờ xử lý" mà không có gợi ý gì (Critical C2).
  // packagingOrdersError giờ luôn có thể liên quan (không còn gán theo 1 scope cố định).
  const activeListError = pieceOrdersError ?? packagingOrdersError ?? (isShipScope ? shipOrdersError : null)

  // Gộp CẢ 3 nguồn vào 1 state duy nhất trong CÙNG 1 effect (2026-09-04) - trước đây 3 effect
  // riêng, mỗi cái tự setOrders() ĐÈ TOÀN BỘ state bằng đúng slice của mình (mergeInputQty trả về
  // đúng độ dài của next, không cộng dồn với prev) - an toàn khi 3 cờ isXScope loại trừ lẫn nhau
  // (chỉ đúng 1 effect thật sự chạy), nhưng từ khi packaging không còn loại trừ theo gia đình nữa,
  // 1 trang có thể có CẢ packagingOrders LẪN shipOrders cùng lúc - 2 effect cũ sẽ đua nhau ghi đè,
  // effect nào chạy sau cùng "thắng" và xoá mất dữ liệu của effect kia. Gộp lại + giữ nguyên inputQty
  // đang gõ dở (cùng idiom TwoTierScreen ở components/sanxuat/core.tsx).
  useEffect(() => {
    const next = [...(pieceOrders ?? []), ...(packagingOrders ?? []), ...(shipOrders ?? [])]
    setOrders(prev => mergeInputQty(prev, next))
  }, [pieceOrders, packagingOrders, shipOrders])

  const [transferBusyLine, setTransferBusyLine] = useState<string | null>(null)
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({})

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
    if (order.kind === 'piece' && myWarehouse && pieceDestWh) {
      setTransferBusyLine(lineId)
      setTransferErrors(prev => ({ ...prev, [lineId]: '' }))
      try {
        await api.createPieceWarehouseTransfer({
          fromWarehouseId: myWarehouse.id,
          toWarehouseId: pieceDestWh.id,
          pieceItems: [{ productionOrderId: order.id, pieceId: line.id, quantity: qty }],
        })
      } catch (e) {
        setTransferErrors(prev => ({ ...prev, [lineId]: errMsg(e, 'Không thể tạo phiếu chuyển kho nội bộ') }))
        setTransferBusyLine(null)
        return
      }
      setTxns(t => [{
        id: `txn-${Date.now()}-${lineId}`, orderRef: order.ref,
        materialName: line.materialName, unit: line.unit, qty, date: new Date().toISOString(),
      }, ...t])
      setTransferBusyLine(null)
      refetchPieceOrders() // đọc lại suggestedQty/transferredQty thật từ BE thay vì tự trừ cục bộ
      return
    }

    // Xuất vật tư đóng gói thật (packaging-issues), ghi StockLedger ngay - đặt TRƯỚC nhánh
    // isInternalChain chung bên dưới vì scope 'vat-tu-tp' cũng thoả canSendFrom (đúng kho thật
    // trong TRANSFER_ROUTES) nên phải chặn sớm, không rơi xuống createWarehouseTransfer generic cũ.
    // Dispatch theo order.kind (2026-09-04), KHÔNG còn theo cờ scope cả trang - đơn packaging có
    // thể lẫn với đơn ship/piece khác trên CÙNG 1 trang (xem comment PACKAGING_SCOPE cũ).
    if (order.kind === 'packaging') {
      setTransferBusyLine(lineId)
      setTransferErrors(prev => ({ ...prev, [lineId]: '' }))
      try {
        await api.issuePackaging(order.id, { materialId: line.id, issuedQty: qty })
      } catch (e) {
        setTransferErrors(prev => ({ ...prev, [lineId]: errMsg(e, 'Không thể xuất vật tư đóng gói') }))
        setTransferBusyLine(null)
        return
      }
      setTxns(t => [{
        id: `txn-${Date.now()}-${lineId}`, orderRef: order.ref,
        materialName: line.materialName, unit: line.unit, qty, date: new Date().toISOString(),
      }, ...t])
      setTransferBusyLine(null)
      refetchPackagingOrders() // đọc lại remainingToIssue/issuedQty thật từ BE thay vì tự trừ cục bộ
      return
    }

    // Kho thành phẩm: "Xác nhận" = ship thật cho đơn hàng (cộng dồn shippedQty), không qua
    // warehouse-transfers vì đây là điểm cuối chuỗi, xuất thẳng cho khách ngoài.
    if (order.kind === 'ship') {
      setTransferBusyLine(lineId)
      setTransferErrors(prev => ({ ...prev, [lineId]: '' }))
      try {
        await api.shipSalesOrderItem(order.id, line.id, qty)
      } catch (e) {
        setTransferErrors(prev => ({ ...prev, [lineId]: errMsg(e, 'Không thể xuất kho') }))
        setTransferBusyLine(null)
        return
      }
      setTxns(t => [{
        id: `txn-${Date.now()}-${lineId}`, orderRef: order.ref,
        materialName: line.materialName, unit: line.unit, qty, date: new Date().toISOString(),
      }, ...t])
      setTransferBusyLine(null)
      refetchShipOrders() // đọc lại shippedQty thật từ BE thay vì tự trừ cục bộ
      return
    }

    // Kho thuộc chuỗi chuyển kho nội bộ (vat-tu-tp → thanh-pham): "Xác nhận" = tạo phiếu chuyển
    // kho thật sang kho kế tiếp, tồn kho chỉ đổi sau khi kho nhận xác nhận.
    if (isInternalChain && myWarehouse && nextHopWh) {
      setTransferBusyLine(lineId)
      setTransferErrors(prev => ({ ...prev, [lineId]: '' }))
      try {
        await api.createWarehouseTransfer({
          fromWarehouseId: myWarehouse.id,
          toWarehouseId: nextHopWh.id,
          items: [{ materialName: line.materialName, unit: line.unit, quantity: qty }],
          // BE không có field piCode riêng (chỉ note tự do hoặc planFormId thật) - giữ lại thông
          // tin PI cho thủ kho nhận hàng thấy được bằng cách nhồi vào note, dán nhãn rõ ràng thay
          // vì giả vờ đây là 1 field có cấu trúc.
          note: order.piCode ? `PI: ${order.piCode}` : undefined,
        })
      } catch (e) {
        setTransferErrors(prev => ({ ...prev, [lineId]: errMsg(e, 'Không thể tạo phiếu chuyển kho nội bộ') }))
        setTransferBusyLine(null)
        return
      }
      setTransferBusyLine(null)
    }

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      return {
        ...o,
        lines: o.lines.map(l => {
          if (l.id !== lineId) return l
          setTxns(t => [{
            id: `txn-${Date.now()}-${lineId}`, orderRef: o.ref,
            materialName: l.materialName, unit: l.unit, qty, date: new Date().toISOString(),
          }, ...t])
          return { ...l, confirmedQty: l.confirmedQty + qty, availableQty: l.availableQty - qty, inputQty: '' }
        }),
      }
    }))
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setSelectedId(null)} style={backBtn}>
              <ChevronLeft size={15} /> Quay lại
            </button>
            <div>
              {usePOLayout && selected.poNumber ? (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text3)' }}>
                      {selected.poNumber}
                      {selected.piCode && <> <span style={{ color: 'var(--border)' }}>·</span> {selected.piCode}</>}
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
          <div style={{ marginBottom: 14, padding: '8px 14px', background: '#ede7f6', border: '1px solid #d1c4e9', borderRadius: 8, fontSize: 12, color: '#4527a0' }}>
            Bấm &quot;Xác nhận&quot; sẽ ghi nhận đã xuất vật tư đóng gói cho <strong>Kho Thành phẩm</strong> ngay lập tức.
          </div>
        )}
        {/* phoi-son-han (piece transfer): Thủ kho TỰ CHỌN kho vat-tu-tp đích trước khi xuất (quyết
            định nghiệp vụ 2026-09-03 - không còn tự động theo 1 cặp cố định như trước, để hỗ trợ
            nhiều kho vat-tu-tp song song). Chỉ hiện dropdown khi có từ 2 lựa chọn trở lên - 1 kho
            duy nhất thì tự chọn sẵn, không cần hỏi. */}
        {selected.kind === 'piece' && (
          <div style={{ marginBottom: 14, padding: '8px 14px', background: '#ede7f6', border: '1px solid #d1c4e9', borderRadius: 8, fontSize: 12, color: '#4527a0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Bấm &quot;Xác nhận&quot; sẽ tạo phiếu chuyển kho nội bộ sang kho vật tư thành phẩm bên dưới — tồn kho chỉ cập nhật sau khi kho nhận xác nhận.</span>
            {pieceDestOptions.length > 1 ? (
              <select
                value={pieceDestWh?.code ?? ''}
                onChange={e => setPieceDestCode(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #d1c4e9', borderRadius: 6, background: '#fff', color: '#4527a0', fontWeight: 600 }}
              >
                {pieceDestOptions.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
              </select>
            ) : pieceDestWh ? (
              <strong>{pieceDestWh.name}</strong>
            ) : (
              <strong style={{ color: '#dc2626' }}>Chưa có kho vật tư thành phẩm nào — không thể xuất</strong>
            )}
          </div>
        )}
        {isInternalChain && nextHopWh && selected.kind !== 'packaging' && selected.kind !== 'piece' && (
          <div style={{ marginBottom: 14, padding: '8px 14px', background: '#ede7f6', border: '1px solid #d1c4e9', borderRadius: 8, fontSize: 12, color: '#4527a0' }}>
            Bấm &quot;Xác nhận&quot; sẽ tạo phiếu chuyển kho nội bộ sang <strong>{nextHopWh.name}</strong> — tồn kho chỉ cập nhật sau khi kho nhận xác nhận.
          </div>
        )}

        {/* 7-column xuất table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
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
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: l.availableQty > 0 ? '#2563eb' : '#dc2626' }}>
                      {l.availableQty.toLocaleString('vi-VN')}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? '#16a34a' : partial ? '#d97706' : 'var(--text)' }}>
                      {done && <span style={{ marginRight: 4, fontSize: 11 }}>✓</span>}
                      {l.confirmedQty.toLocaleString('vi-VN')}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: conLai > 0 ? '#d97706' : '#16a34a' }}>
                      {conLai.toLocaleString('vi-VN')}
                    </td>
                    <td style={td}>
                      {done ? (
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã xong</span>
                      ) : noStock ? (
                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{selected.kind === 'piece' ? 'Chưa có hàng' : 'Hết hàng'}</span>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number" min={1} max={l.availableQty} value={l.inputQty}
                              onChange={e => updateInput(selected.id, l.id, e.target.value)}
                              placeholder="SL"
                              disabled={transferBusyLine === l.id}
                              style={{ width: 72, padding: '4px 8px', border: `1px solid ${overAvail ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                            />
                            <button onClick={() => confirmLine(selected.id, l.id)} disabled={!can || transferBusyLine === l.id}
                              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: can ? ACCENT : 'var(--surface2)', color: can ? '#fff' : 'var(--text3)', cursor: can && transferBusyLine !== l.id ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                              {transferBusyLine === l.id ? 'Đang gửi...' : 'Xác nhận'}
                            </button>
                          </div>
                          {transferErrors[l.id] && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{transferErrors[l.id]}</div>
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
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowUpFromLine size={20} color={ACCENT} /> Xuất kho
        </h2>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['orders', 'history'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={tabBtn(view === v, ACCENT)}>
              {v === 'history' && <Clock size={13} />}
              {v === 'orders' ? 'Xuất kho' : 'Lịch sử'}
            </button>
          ))}
        </div>
      </div>

      {view === 'orders' && (
        activeListError ? (
          <div style={{ ...emptyBox, color: '#dc2626' }}>Lỗi tải danh sách: {activeListError}</div>
        ) : orders.length === 0 ? (
          <div style={emptyBox}>Không có lệnh xuất nào đang chờ xử lý</div>
        ) : (
          // PO | PI | SKU | Số lượng vật tư | Trạng thái — mọi kho (không có hạn giao). Đơn nội bộ
          // (piece/packaging) có cả PO lẫn PI thật; đơn ship (xuất thẳng cho khách) chỉ có PO (mã
          // đơn hàng bán) - không có khái niệm PI.
          <div style={tableWrap}>
            <table style={tbl}>
              <colgroup>
                <col style={{ width: 100 }} /><col style={{ width: 120 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 130 }} />
              </colgroup>
              <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>PO</th>
                <th style={th}>PI</th>
                <th style={th}>SKU</th>
                <th style={{ ...th, textAlign: 'right' }}>Số lượng vật tư</th>
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
                      <td style={{ ...td, fontWeight: 700, color: 'var(--text3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{order.piCode ?? '—'}</td>
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

      {view === 'history' && (
        txns.length === 0 ? (
          <div style={emptyBox}>Chưa có giao dịch nào trong phiên này</div>
        ) : (
          <div style={tableWrap}>
            <table style={tbl}>
              <colgroup>
                <col style={{ width: 130 }} /><col style={{ width: 110 }} /><col /><col style={{ width: 56 }} /><col style={{ width: 80 }} />
              </colgroup>
              <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Thời gian</th>
                <th style={th}>Mã PO / ĐH</th>
                <th style={th}>Vật tư</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>SL xuất</th>
              </tr></thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{format(new Date(t.date), 'HH:mm · dd/MM')}</td>
                    <td style={{ ...td, fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' }}>{t.orderRef}</td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{t.materialName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{t.unit}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: ACCENT }}>−{t.qty.toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

