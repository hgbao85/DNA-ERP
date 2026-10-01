'use client'

/**
 * KHSX - Tối ưu cắt sắt: bảng mọi SKU chưa được Sếp duyệt, tick chọn tổ hợp muốn gộp, số liệu
 * tính lại ngay theo đúng tổ hợp đó.
 *
 * Ba nguyên tắc hiển thị, đều rút ra từ số liệu thật (đừng đổi nếu chưa đọc lý do):
 *
 * 1. SỐ CÂY là con số chính, KHÔNG phải %. Gộp một SKU đang tốt với một SKU đang xấu cho ra %
 *    NẰM GIỮA hai số - % của SKU đang tốt xấu đi dù TỔNG sắt mua vẫn giảm. Đã gặp ca thật:
 *    sắt 50x50 giảm 6,53% -> 0,18% (36 lần) mà bớt ĐÚNG 0 cây; nếu trưng % làm số chính thì
 *    KHSX sẽ gộp và đổi 7 ngày ôm tồn lấy 0 đồng.
 * 2. Mọi số hao hụt kèm dấu "≥" - BE trả GIỚI HẠN DƯỚI, thực tế có thể cao hơn.
 * 3. Bớt 0 cây thì nói thẳng là 0.
 *
 * Luồng "Solve trước → tạo lệnh sản xuất" (2026-09-30): KHSX bấm "Tính phương án cắt" -> solver chạy
 * NGAY cho đúng tổ hợp đang tick (tiến độ + kết quả hiện ở khối bên dưới, xem CuttingSolvePanel) ->
 * khi kết quả dùng được mới tạo lệnh sản xuất (>= 2 SKU: gộp; đúng 1 SKU: cắt riêng) rồi chuyển sang
 * màn "Lệnh sản xuất mới". QLSX/Sếp duyệt ĐÚNG phương án đã tính, solver không chạy lại sau khi duyệt.
 * Số ước tính nhanh (dấu ≥) ở bảng trên vẫn giữ nguyên để KHSX chọn tổ hợp trước khi bấm Tính.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Info, Layers, Loader2, RefreshCw, Settings } from 'lucide-react'
import {
  claimSoloCuttingBatch,
  getCuttingBatchCandidates,
  getCuttingBatchSolves,
  discardCuttingBatchSolve,
  getCuttingDefaults,
  mergeCuttingBatch,
  type CuttingDefaults,
  previewCuttingBatch,
  requestCuttingBatchSolve,
  type CuttingBatchSolve,
  type CuttingBatchCandidate,
  type CuttingBatchCandidateList,
  type SolverOverrideInput,
  type CuttingBatchPreview,
  type StockLengthsByMaterial,
} from '../../../services/cutting-batch-api'
import CuttingSolvePanel, { sameItemSet, solveSkuCodes, solveOrderCodes } from './CuttingSolvePanel'
import { errMsg } from '../../../utils/errors'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { useConfirm } from '../../../hooks/useConfirm'
import { pageTitle, pageSubtitle } from '../../../styles/typography'

/**
 * 2 tình huống cắt KHSX chọn cho đợt sắp tạo. Đặt tên theo NGHIỆP VỤ chứ không theo tham số kỹ
 * thuật, vì người chọn là bên kế hoạch - bên dưới mới quy về 2 thông số độc lập gửi BE
 * (solverAllowCustomLength / solverMaxWastePctOverride, xem SolverOverrideInput).
 *
 * Từng có lựa chọn thứ 3 "Chỉ mua cây chuẩn, phải đạt ngưỡng" (2026-09-15, đã bỏ theo yêu cầu):
 * nó chỉ khác "Bình thường" ĐÚNG một ca - khi không cây chuẩn nào đạt ngưỡng - và khi đó chỉ làm
 * mỗi việc là dừng lại. Ràng buộc "chỉ cây chuẩn" KHÔNG mất: nó vẫn là ô tick bên trong
 * ACCEPT_OVER, đúng chỗ thật sự cần (đơn gấp, không chờ NCC cán cây riêng được). Nếu sau này muốn
 * cấm đặt cây riêng cho TOÀN hệ thống thì đặt SystemConfig.solverAllowCustomLength = false.
 */
type CutMode = 'AUTO' | 'ACCEPT_OVER'

const CUT_MODES: { value: CutMode; label: string; desc: string }[] = [
  {
    value: 'AUTO',
    label: 'Bình thường (mặc định)',
    desc: 'Dùng mức “Hao hụt sắt mặc định tối đa” ở ô trên. Cây chuẩn nào đạt thì chốt luôn; không cây nào đạt thì tự dò thêm chiều dài khác rồi mới đặt. Không có cách cắt nào đạt thì báo “Cần xử lý” (chưa có phương án để tạo lệnh).',
  },
  {
    value: 'ACCEPT_OVER',
    label: 'Chấp nhận hao hụt cao hơn (đơn gấp)',
    desc: 'Dùng cho đợt gấp: không đặt trần hao hụt cho riêng đợt này, hệ thống tìm phương án tốt nhất có thể (không đổi mức mặc định). Kết quả hiện ngay sau khi tính; Sếp thấy lý do và % hao hụt thật khi duyệt lệnh sản xuất.',
  },
]

/** "Chấp nhận hao hụt cao hơn" không còn ô nhập % (2026-09-30, theo yêu cầu): Sếp duyệt trên KẾT QUẢ THẬT đã tính nên con số xin
 *  là thừa. BE vẫn cần 1 con số ngưỡng đặc cách -> gửi trần tối đa cho phép (100%) = "không đặt trần hao hụt". */
const NO_CEILING_PCT = 100

/** Trần giây/loại sắt gửi cho solver (thử nghiệm 2026-10-01) - xem autoTimeLimitSeconds. */
const SOLVER_MAX_SECONDS_PER_MATERIAL = 20

/** 1 -> "1,0", 2.5 -> "2,5" - đúng dạng người dùng gõ/đọc (dấu phẩy). */
const fmtPct = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 3 })

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '—'

const APPROVAL_LABEL: Record<string, string> = {
  WAITING_QLSX: 'Chờ QLSX',
  WAITING_BOSS: 'Chờ Sếp duyệt',
}
/** null = Sales vừa tạo, KHSX chưa gửi QLSX - trạng thái sớm nhất trong luồng, không cần nhãn gì
 *  (chưa gửi đi đâu thì không có gì để báo) - chỉ hiện nhãn từ lúc đã gửi đi (WAITING_QLSX trở đi). */
const approvalLabel = (s: string | null) => (s === null ? '' : (APPROVAL_LABEL[s] ?? s))

const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
  textTransform: 'uppercase', color: 'var(--text3)', padding: '8px 10px',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const TD: React.CSSProperties = {
  padding: '9px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'top',
}
const NUM: React.CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

/**
 * Cận dưới (best-fill.util.ts) giả định nguồn đoạn VÔ HẠN - đúng khi có đủ cây để lặp lại pattern
 * lý tưởng, sai lệch NẶNG khi ít cây (1-2 cây thì cây cuối gần như quyết định cả %). Ngưỡng 3 là
 * kinh nghiệm chọn, không phải số đo được - xem changelog 2026-08-15 mục 15.6-7.
 */
const isLowConfidence = (minBars: number) => minBars > 0 && minBars < 3

/**
 * 2 màu THEO ĐÚNG NGƯỠNG CỦA CHÍNH LOẠI SẮT ĐÓ (`over`, đã tính sẵn ở BE theo
 * SystemConfig.solverMaxWastePercentage - ngưỡng chung KHSX tự đổi; không còn ngưỡng riêng theo vật tư) - KHÔNG hard-code một mốc % cố
 * định ở đây. Loại sắt nào được cấp ngưỡng riêng cao hơn (vd 5%) mà hard-code 1% sẽ báo đỏ sai.
 *
 * Dấu "?" (2026-09-15, thay cho màu vàng riêng trước đó) giữ nguyên ý nghĩa cũ: mẫu quá nhỏ (dưới
 * 3 cây) thì cận dưới % KHÔNG đáng tin - cây cuối gần như quyết định hết cả số. Bỏ hẳn cảnh báo
 * này thì một chip XANH "≥0.3%" tính trên 2 cây có thể khiến người xem yên tâm nhầm trong khi thực
 * tế cắt ra có thể 5-8%. Gộp vào đúng 2 màu, không tách riêng thành màu thứ 3 nữa.
 */
/** 5850 -> "5m85", 6000 -> "6m". Người ở xưởng gọi cây sắt theo mét, không theo mm. */
function fmtLen(mm: number): string {
  const m = Math.floor(mm / 1000)
  const cm = Math.round((mm % 1000) / 10)
  return cm === 0 ? `${m}m` : `${m}m${String(cm).padStart(2, '0')}`
}

function MaterialChip({ code, pct, over, minBars, stockLengthMm, verified, verifiedLengthSource, thresholdPct }: { code: string; pct: number; over: boolean; minBars: number; stockLengthMm: number | null; verified: boolean; verifiedLengthSource: 'fixed' | 'scan' | null; thresholdPct: number }) {
  // "?" (mẫu quá nhỏ, cận dưới không đáng tin) chỉ có ý nghĩa với ƯỚC TÍNH - verified=true là số
  // solver vừa xác minh thật, đáng tin bất kể số cây nhiều hay ít (2026-09-24).
  const lowConfidence = !verified && isLowConfidence(minBars)
  // "scan" = KHÔNG có cách nào cắt ở chiều dài đang chọn mà MỌI cây đều đạt ngưỡng riêng - CHẮC
  // CHẮN (không phải ước tính) hao hụt thật > ngưỡng, xem doc comment CandidateMaterial.
  // verifiedLengthSource. `pct` (best_achievable) chỉ là số TỐT NHẤT CÓ THỂ SAU KHI đã phá luật đó
  // - KHÔNG phải "hao hụt sẽ đạt" nên KHÔNG hiện làm số chính (2026-09-24: bản trước hiện thẳng
  // pct này, người dùng chỉ ra đó là "bịp bợm" vì trông như đạt ngưỡng trong khi thực ra không đạt
  // được theo đúng luật - xem changelog mục 19.9). Hiện "> ngưỡng%" thay vào đó - đúng sự thật đã
  // CHỨNG MINH, còn pct thật vẫn có trong tooltip cho ai cần xem chi tiết.
  const provenOverThreshold = verified && verifiedLengthSource === 'scan'
  // Nêu rõ con số đang nói về CÂY NÀO. Không có dòng này thì đổi ô chiều dài xong, chip nhảy số
  // mà không biết nó vừa nhảy theo cây nào - người xem không cách gì tự đối chiếu.
  const onBar = stockLengthMm != null ? ` (cây ${fmtLen(stockLengthMm)})` : ''
  return (
    <span
      title={
        provenOverThreshold
          ? `${code}${onBar} — CHẮC CHẮN vượt ngưỡng ${thresholdPct}%: không có cách nào cắt đúng số lượng mà MỌI cây đều đạt ngưỡng riêng. Nếu chấp nhận có vài cây lẻ tự vượt ngưỡng, tốt nhất tìm được là ${pct.toFixed(2)}% - nhưng đây KHÔNG phải phương án hệ thống tự chọn khi duyệt (sẽ tự đặt cây riêng thay vào đó).`
          : verified
            ? `${code}${onBar} — số THẬT vừa xác minh với solver (không phải ước tính)`
            : lowConfidence
              ? `${code}${onBar} — chỉ ${minBars} cây, cận dưới này KHÔNG đáng tin (số lượng quá nhỏ để so sánh)`
              : `${code}${onBar} — cận dưới ước tính nhanh, CHƯA xác minh với solver thật`
      }
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
        padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
        background: over ? 'var(--bg-fee2e2)' : 'var(--bg-e8f5e9)',
        color: over ? 'var(--fg-b91c1c)' : 'var(--fg-166534)',
      }}
    >
      {over && <AlertTriangle size={11} />}
      {provenOverThreshold ? (
        // KHÔNG hiện pct (best_achievable) như số chính - xem comment provenOverThreshold. Hiện
        // đúng sự thật đã chứng minh: chắc chắn vượt ngưỡng của chính loại sắt này.
        <>{code} &gt;{thresholdPct}%</>
      ) : (
        <>
          {/* verified=true: số THẬT, không còn là cận dưới nên bỏ dấu "≥" - giữ "≥" cho
              verified=false để không hứa hẹn sai (xem doc comment CandidateMaterial.standaloneWastePct). */}
          {code} {verified ? '' : '≥'}{pct.toFixed(2)}%
        </>
      )}
      {lowConfidence && <span style={{ fontWeight: 700 }}>?</span>}
      {/* Chỉ hiện khi KHÁC cây chuẩn: gắn "(6m)" vào mọi chip chỉ làm bảng ồn thêm mà không
          nói được gì mới - cây chuẩn vốn là mặc định ai cũng ngầm hiểu. */}
      {stockLengthMm != null && stockLengthMm !== DEFAULT_STOCK_LENGTH_MM && (
        <span style={{ fontWeight: 500, opacity: 0.75 }}>· cây {fmtLen(stockLengthMm)}</span>
      )}
    </span>
  )
}

/** Cây chuẩn công ty đang mua. Chỉ dùng làm PLACEHOLDER cho ô nhập - con số thật hiển thị trên
 *  chip luôn lấy từ BE (CandidateMaterial.stockLengthMm), không hard-code ở đây. */
const DEFAULT_STOCK_LENGTH_MM = 6000
/** Cùng khoảng BE chặn (xem stock-lengths-by-material.validator.ts) - bắt sớm ca gõ 6 hay 600
 *  thay vì 6000, để KHSX không phải ăn lỗi 400 rồi mới biết. */
const MIN_STOCK_LENGTH_MM = 500
const MAX_STOCK_LENGTH_MM = 20000

interface Props {
  /** Chuyển sang màn "Lệnh sản xuất mới" - nơi làm bước tiếp theo sau khi chốt nhóm. */
  onDone?: () => void
}

export default function GomDotCatPage({ onDone }: Props) {
  const [data, setData] = useState<CuttingBatchCandidateList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { ask, confirmModal } = useConfirm()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<CuttingBatchPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [merging, setMerging] = useState(false)
  // Luồng "Solve trước": các lượt tính gần đây + đang gửi yêu cầu tính.
  const [solves, setSolves] = useState<CuttingBatchSolve[]>([])
  const [solving, setSolving] = useState(false)
  // 2 tab: "Chọn và tính" (việc thường ngày) | "Kết quả đã tính" (theo dõi + tạo lệnh). Tách đôi để
  // KHSX không phải cuộn qua bảng SKU + khối chế độ cắt mới thấy kết quả solver.
  const [tab, setTab] = useState<'choose' | 'results'>('choose')
  const [expandedSolveId, setExpandedSolveId] = useState<string | null>(null)
  const openedOnce = useRef(false)
  // "Hao hụt sắt mặc định tối đa (%)": mức chung của công ty, KHSX chỉ ĐỌC (2026-09-30, theo yêu cầu: ô này khoá;
  // ai cần hao hụt cao hơn thì chọn "Chấp nhận hao hụt cao hơn" ở khối Chế độ cắt - Sếp duyệt riêng cho đợt đó).
  const [defaults, setDefaults] = useState<CuttingDefaults | null>(null)
  // Chế độ cắt KHSX đề nghị cho ĐÚNG đợt sắp tạo - Sếp chấp thuận bằng chính nút Duyệt lệnh SX.
  const [cutMode, setCutMode] = useState<CutMode>('AUTO')
  const [overrideReason, setOverrideReason] = useState('')
  const [onlyStandardLength, setOnlyStandardLength] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  // Lỗi của đề nghị đặc cách chỉ hiện SAU khi KHSX bấm Tính mà chưa điền đủ - vừa chọn mode đã báo đỏ là hù người dùng.
  const [overrideTouched, setOverrideTouched] = useState(false)
  const cutModeRef = useRef<HTMLDivElement | null>(null)
  const overrideBoxRef = useRef<HTMLDivElement | null>(null)
  // Chiều dài cây KHSX chọn cho TỪNG QUY CÁCH trong đợt này (materialId -> chuỗi đang gõ).
  // Giữ dạng chuỗi như wastePct: ô rỗng = "dùng cây chuẩn", khác hẳn với số 0.
  const [stockLenInput, setStockLenInput] = useState<Record<string, string>>({})
  // Đóng sẵn: gần như đợt nào cũng cắt cây chuẩn, trưng sẵn một dãy ô nhập chỉ làm người ta
  // tưởng có việc phải điền. Mở ra mới sửa được - cũng chặn luôn việc lỡ tay đổi lúc cuộn/tab,
  // mà đổi chiều dài thì TÍNH LẠI CẢ BẢNG chứ không phải thay đổi vặt.
  const [lenOpen, setLenOpen] = useState(false)
  // Điện thoại: bảng ứng viên 7 cột (minWidth 760) đổi thành thẻ - chạm cả thẻ để tick/bỏ tick.
  const isMobile = useIsMobile()
  // "Thời gian chạy tối đa" (2026-09-22 → BỎ Ô NHẬP 2026-09-23): ban đầu là ô KHSX tự gõ, sau đó
  // thử auto-suggest + giấu vào "Cài đặt nâng cao" - người dùng chốt lại: "KHSX không cần biết
  // tốn bao lâu, miễn cho kết quả tốt nhất". Không còn field/state nào ở FE cho việc này nữa - xem
  // solverOverride() dưới, giờ LUÔN tự tính + gửi ngân sách AN TOÀN TỐI ĐA (không phải mặc định
  // tối thiểu) cho mọi lần tính, không cần KHSX biết khái niệm này tồn tại.
  // 2026-09-30 (luồng "Solve trước"): solver giờ chạy NGAY khi KHSX bấm Tính (vẫn chạy nền, có thể rời
  // màn hình và nhận thông báo khi xong) nhưng KHSX phải có kết quả mới tạo được lệnh sản xuất - nên
  // thời gian giải lâu hơn giờ LÀ thời gian KHSX chờ trước khi đi tiếp. Nếu thấy chờ quá lâu thì hạ
  // ngân sách này (SystemConfig.solverTimeLimitSeconds / SOLVER_TIMEOUT_SECONDS), đừng bỏ "kết quả
  // tốt nhất" mà không hỏi lại.

  /** Chỉ lấy ô đã gõ HỢP LỆ. Ô rỗng/đang gõ dở không được gửi đi: gửi số vô nghĩa sẽ làm BE trả
   *  400 ngay giữa lúc người ta còn đang gõ dở con số.
   *
   *  PHẢI là useMemo (không phải dựng thẳng trong thân hàm): load()/preview phụ thuộc vào nó,
   *  object dựng mới mỗi render sẽ làm 2 effect chạy vô hạn. */
  const stockLengths = useMemo<StockLengthsByMaterial>(() => {
    const out: StockLengthsByMaterial = {}
    for (const [id, raw] of Object.entries(stockLenInput)) {
      const n = Number(raw)
      if (raw.trim() !== '' && Number.isFinite(n) && n >= MIN_STOCK_LENGTH_MM && n <= MAX_STOCK_LENGTH_MM) {
        out[id] = n
      }
    }
    return out
  }, [stockLenInput])

  /** Lần tải đầu mới tick sẵn theo đề xuất của hệ thống. Các lần sau (đổi chiều dài cây) phải
   *  GIỮ NGUYÊN lựa chọn đang có - ghi đè sẽ xoá trắng nhóm KHSX vừa tick tay chỉ vì họ sửa một
   *  con số chiều dài, đúng kiểu mất việc khó chịu nhất. */
  const pickedOnce = useRef(false)

  const load = useCallback(() => {
    setLoading(true)
    getCuttingBatchCandidates(stockLengths)
      .then((res) => {
        setData(res)
        if (!pickedOnce.current) {
          // Tick sẵn tổ hợp hệ thống đề xuất - KHSX chỉ việc xem lại rồi xác nhận, vẫn sửa được.
          setSelected(new Set(res.recommendedItemIds))
          pickedOnce.current = true
        } else {
          // Tải lại do đổi chiều dài cây: giữ lựa chọn, chỉ bỏ SKU không còn trong bảng.
          const alive = new Set(res.items.map((i) => i.productionInvoiceItemId))
          setSelected((prev) => new Set([...prev].filter((id) => alive.has(id))))
        }
        setError(null)
      })
      .catch((e) => setError(errMsg(e, 'Không tải được danh sách SKU')))
      .finally(() => setLoading(false))
  }, [stockLengths])

  // Gõ chiều dài tới đâu tải lại tới đó, nhưng CHỜ 400ms: không debounce thì gõ "5850" bắn 4
  // request, và request của "5" (số vô lý) có thể về sau cùng rồi ghi đè kết quả đúng.
  useEffect(() => {
    const t = setTimeout(() => load(), 400)
    return () => clearTimeout(t)
  }, [load])

  // Tính lại mỗi khi tổ hợp đổi. Dưới 2 SKU thì không có gì để gộp -> xoá kết quả cũ.
  const selectedKey = useMemo(() => [...selected].sort().join(','), [selected])
  useEffect(() => {
    const ids = selectedKey ? selectedKey.split(',') : []
    if (ids.length < 2) { setPreview(null); return }
    let cancelled = false
    setPreviewing(true)
    previewCuttingBatch(ids, stockLengths)
      .then((res) => { if (!cancelled) setPreview(res) })
      .catch((e) => { if (!cancelled) setError(errMsg(e, 'Không tính được tổ hợp đã chọn')) })
      .finally(() => { if (!cancelled) setPreviewing(false) })
    return () => { cancelled = true }
  }, [selectedKey, stockLengths])

  useEffect(() => {
    getCuttingDefaults()
      .then(setDefaults)
      .catch(() => { /* không chặn màn nếu chỉ đọc số mặc định lỗi */ })
  }, [])

  const loadSolves = useCallback(() => {
    getCuttingBatchSolves()
      .then((res) => {
        setSolves(res)
        // Lần đầu vào màn mà đã có lượt tính (đang chạy / vừa xong - vd bấm từ thông báo "đã tính
        // xong") thì mở thẳng tab kết quả: đó chính là thứ KHSX quay lại để xem.
        if (!openedOnce.current) {
          openedOnce.current = true
          if (res.length > 0) {
            setTab('results')
            setExpandedSolveId(res[0].id)
          }
        }
      })
      // Không chặn cả màn nếu chỉ khối tiến độ tải lỗi - bảng chọn SKU vẫn dùng được.
      .catch((e) => setError(errMsg(e, 'Không tải được tiến độ tính phương án cắt')))
  }, [])
  useEffect(() => { loadSolves() }, [loadSolves])

  /** Xoá 1 lượt tính khỏi "Kết quả đã tính" (thử nhiều lần thì danh sách tràn lan). Lỗi (vd đang tính) hiện ngay trong hộp xác nhận. */
  const handleDiscard = (solve: CuttingBatchSolve) => {
    ask(
      {
        title: 'Xóa lượt tính này?',
        message: `Xóa kết quả tính của ${solveSkuCodes(solve)}${solveOrderCodes(solve) ? ` (đơn ${solveOrderCodes(solve)})` : ''}? Các SKU được thả ra để tính lại; lệnh sản xuất không bị ảnh hưởng.`,
        confirmLabel: 'Xóa',
        danger: true,
      },
      async () => {
        await discardCuttingBatchSolve(solve.id)
        setExpandedSolveId((cur) => (cur === solve.id ? null : cur))
        loadSolves()
      },
    )
  }
  // Còn lượt đang tính thì hỏi lại BE mỗi 4 giây; xong hết thì dừng (không poll vô ích).
  const hasCalculating = solves.some((sv) => sv.displayStatus === 'CALCULATING')
  useEffect(() => {
    if (!hasCalculating) return
    const t = setInterval(loadSolves, 4000)
    return () => clearInterval(t)
  }, [hasCalculating, loadSolves])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  // useMemo chu khong phai `data?.items ?? []` tran: mang moi tao lai moi render se lam
  // materialsInTable ben duoi tinh lai lien tuc (eslint react-hooks canh bao dung cho nay).
  const items = useMemo(() => data?.items ?? [], [data])
  const recommended = new Set(data?.recommendedItemIds ?? [])

  /** Mỗi QUY CÁCH đúng MỘT ô chọn, gom từ mọi SKU trong bảng.
   *
   *  Cố ý KHÔNG đặt ô ngay cạnh từng chip: một loại sắt xuất hiện ở nhiều dòng SKU, làm vậy sẽ
   *  ra nhiều ô cho cùng một giá trị - người dùng sửa ô này không hiểu sao ô kia cũng nhảy. */
  const materialsInTable = useMemo(() => {
    const map = new Map<string, { id: string; code: string; stockLengthMm: number | null }>()
    for (const it of items) {
      for (const m of it.materials) {
        if (!map.has(m.materialId)) {
          map.set(m.materialId, { id: m.materialId, code: m.materialCode, stockLengthMm: m.stockLengthMm })
        }
      }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
  }, [items])

  /** Các quy cách ĐÃ đổi khỏi cây chuẩn - dòng tóm tắt chỉ nêu đúng mấy cái này. */
  const lenChanged = useMemo(
    () => materialsInTable.filter((m) => stockLengths[m.id] != null),
    [materialsInTable, stockLengths],
  )

  /** Ô đang gõ dở/sai khoảng - viền đỏ tại chỗ thay vì để BE trả 400 rồi mới biết. */
  const stockLenBad = (id: string) => {
    const raw = stockLenInput[id] ?? ''
    if (raw.trim() === '') return false
    const n = Number(raw)
    return !(Number.isFinite(n) && n >= MIN_STOCK_LENGTH_MM && n <= MAX_STOCK_LENGTH_MM)
  }
  const overCount = items.filter((i) => i.materials.some((m) => m.overThreshold)).length

  // Chỉ loại sắt có >= 2 SKU trong tổ hợp cùng dùng mới CÓ THỂ hưởng lợi từ việc gộp; loại chỉ 1
  // SKU dùng thì số liệu y hệt cắt riêng, đưa thành dòng riêng chỉ làm loãng bảng.
  const sharedLines = (preview?.lines ?? []).filter((l) => l.contributingSkus.length >= 2)
  const soloLines = (preview?.lines ?? []).filter((l) => l.contributingSkus.length < 2)

  /**
   * SKU đã tick nhưng KHÔNG dùng chung loại sắt nào với phần còn lại của nhóm -> đóng góp đúng 0,
   * mà vẫn kéo theo chi phí cắt sớm. Đây là lỗi chọn nhóm dễ mắc nhất và trước đây màn hình để nó
   * chìm trong dòng ghi chú xám cuối bảng.
   */
  const contributingSkuCodes = new Set(sharedLines.flatMap((l) => l.contributingSkus))
  const selectedItems = items.filter((i) => selected.has(i.productionInvoiceItemId))
  const deadItems = preview
    ? selectedItems.filter((i) => !contributingSkuCodes.has(i.mfgProductCode))
    : []

  // Số loại sắt riêng của TỔ HỢP ĐANG CHỌN (không phải toàn bảng) - đúng số solver sẽ chạy TUẦN
  // TỰ cho đợt này, nêu ra để KHSX tự nhân nhẩm "Nx phút" trước khi gõ số vào ô dưới.
  const selectedMaterialIds = new Set<string>()
  for (const it of selectedItems) for (const m of it.materials) selectedMaterialIds.add(m.materialId)
  const selectedMaterialCount = selectedMaterialIds.size
  /** Lượt tính khớp ĐÚNG tổ hợp SKU đang tick (danh sách BE trả mới nhất trước nên find() ra bản mới
   *  nhất). Phương án chỉ dùng được cho ĐÚNG tập SKU đã tính - tick khác đi là chưa có kết quả. */
  const currentSolve = solves.find((sv) => sameItemSet(sv, [...selected])) ?? null
  const currentCalculating = currentSolve?.displayStatus === 'CALCULATING'

  // Ngân sách giây/loại sắt LUÔN gửi tự động cho solver - KHÔNG hỏi KHSX gì cả (chốt 2026-09-23:
  // "KHSX không cần biết tốn bao lâu, miễn cho kết quả tốt nhất"). Dùng HẾT phần ngân sách AN TOÀN
  // TỐI ĐA cho phép, không phải mặc định tối thiểu của công ty (SystemConfig.solverTimeLimitSeconds
  // vốn chỉ vài chục giây - đủ chạy nhanh nhưng bỏ lỡ cơ hội CP-SAT tìm được phương án ít hao hụt
  // hơn nếu được cho thêm thời gian dò). An toàn TUYỆT ĐỐI bằng toán học của phép chia nguyên: với
  // N = selectedMaterialCount, T = solverTimeoutSeconds, đặt time_limit = floor(T/N) thì
  // N × floor(T/N) ≤ T LUÔN đúng - không thể vượt trần HTTP client của BE
  // (CuttingProposalsService.runSolverAndSave), bất kể N là bao nhiêu. Vì chạy NỀN sau khi Sếp
  // duyệt (fire-and-forget) nên "tốn thêm thời gian giải" không làm KHSX phải chờ gì - đúng tinh
  // thần "miễn kết quả tốt nhất" người dùng yêu cầu.
  // Thử nghiệm 2026-10-01 (live-test tốc độ, changelog-2026-10-01-live-test-dau-cuoi.md 7b): kẹp thêm TRẦN
  // SOLVER_MAX_SECONDS_PER_MATERIAL - Ghế J55/Ghế tình yêu nâng limit 20s -> 242/340s tốn 7-8 lần thời gian mà ra
  // đúng cùng phương án. Vẫn là chặn trên nên N × min(floor(T/N), trần) ≤ T luôn đúng.
  const autoTimeLimitSeconds =
    data && selectedMaterialCount > 0
      ? Math.min(
          SOLVER_MAX_SECONDS_PER_MATERIAL,
          Math.max(1, Math.floor(data.solverTimeoutSeconds / selectedMaterialCount)),
        )
      : null

  /** Số ngày 1 SKU phải cắt sớm = hạn của nó trừ hạn GẤP NHẤT trong nhóm (cả đợt cắt cùng lúc). */
  const earliestSelected = Math.min(
    ...selectedItems.filter((i) => i.deadline).map((i) => new Date(i.deadline!).getTime()),
  )
  const daysEarlyOf = (it: CuttingBatchCandidate) =>
    it.deadline && Number.isFinite(earliestSelected)
      ? Math.round((new Date(it.deadline).getTime() - earliestSelected) / 86_400_000)
      : 0

  /**
   * "Tính phương án cắt" - chạy solver NGAY cho tổ hợp đang tick (chạy nền, kết quả hiện ở khối
   * "Kết quả tính" bên dưới). Chưa tạo lệnh sản xuất nào ở bước này. Thông số cắt (chế độ đặc cách,
   * chiều dài cây, thời gian tính) gửi kèm ở đây - lệnh sản xuất tạo sau sẽ dùng đúng bộ đó.
   */
  const handleSolve = async () => {
    // Đề nghị đặc cách chưa đủ: KHÔNG khoá nút (khoá mà không nói lý do thì người dùng bí) - mở khối chế độ cắt,
    // hiện lỗi đúng chỗ cần điền và cuộn tới đó.
    if (overrideInvalid) {
      setOverrideTouched(true)
      setOverrideOpen(true)
      // Cuộn tới ĐÚNG ô cần điền (khối vàng), không phải cả khối chế độ cắt: khối cao gần hết màn, cuộn vào giữa
      // thì thanh Tính cố định ở đáy che mất ô lý do. Chờ 1 nhịp để khối bung ra xong mới có ref.
      setTimeout(() => (overrideBoxRef.current ?? cutModeRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
      return
    }
    setSolving(true)
    setError(null)
    requestCuttingBatchSolve([...selected], solverOverride())
      .then((sv) => {
        // Chuyển sang tab kết quả ngay: KHSX thấy lượt vừa bấm đang chạy (bộ đếm giây) thay vì phải
        // tự cuộn xuống tìm.
        setExpandedSolveId(sv.id)
        setTab('results')
        loadSolves()
      })
      .catch((e) => setError(errMsg(e, 'Không bắt đầu tính được phương án cắt')))
      .finally(() => setSolving(false))
  }

  /** Bấm "Tính lại với chế độ khác" ở 1 thẻ: quay về tab chọn, tick lại đúng các SKU của lượt đó và điền
   *  lại cài đặt đã dùng (chỉ cây chuẩn, chiều dài cây) để KHSX chỉ việc đổi rồi bấm Tính. */
  const handleRecalcFrom = (solve: CuttingBatchSolve) => {
    const alive = new Set(items.map((i) => i.productionInvoiceItemId))
    setSelected(new Set((solve.items ?? []).map((i) => i.productionInvoiceItemId).filter((id) => alive.has(id))))
    const o = solve.solverOptions
    // Điền lại ĐÚNG chế độ lượt đó đã dùng để KHSX chỉ việc đổi rồi Tính lại.
    setOverrideTouched(false)
    if (o?.solverMaxWastePctOverride != null) {
      setCutMode('ACCEPT_OVER')
      setOverrideReason(o.solverOverrideReason ?? '')
      setOnlyStandardLength(o.solverAllowCustomLength === false)
      setOverrideOpen(true)
    } else {
      setCutMode('AUTO')
      setOverrideReason('')
      setOnlyStandardLength(false)
    }
    if (o?.solverStockLengthsByMaterial && Object.keys(o.solverStockLengthsByMaterial).length > 0) {
      setStockLenInput(Object.fromEntries(Object.entries(o.solverStockLengthsByMaterial).map(([k, v]) => [k, String(v)])))
      setLenOpen(true)
    } else {
      setStockLenInput({})
    }
    setTab('choose')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Tạo lệnh sản xuất từ phương án đã tính. BE kiểm lại phương án còn đúng (chưa lỗi thời) - nếu
   *  không, 409 kèm lý do và ta tải lại danh sách để khối kết quả hiện đúng trạng thái mới. */
  const handleCreateInvoice = (solve: CuttingBatchSolve) => {
    setMerging(true)
    setError(null)
    // SKU lấy từ CHÍNH lượt tính (không phụ thuộc đang tick gì) - tab kết quả tách khỏi bảng chọn.
    const ids = (solve.items ?? []).map((i) => i.productionInvoiceItemId)
    const create = ids.length >= 2
      ? mergeCuttingBatch(ids, solve.id)
      : claimSoloCuttingBatch(ids[0], solve.id)
    create
      .then(() => onDone?.())
      .catch((e) => {
        setError(errMsg(e, 'Không tạo được lệnh sản xuất từ phương án này'))
        loadSolves()
      })
      .finally(() => setMerging(false))
  }

  /**
   * Gợi ý cho ô “Chấp nhận hao hụt tới”: mức tối thiểu ước tính để đợt đang chọn KHÔNG vượt ngưỡng (làm
   * tròn LÊN 0,1%). Là CẬN DƯỚI ở cây chuẩn nên chỉ là gợi ý; solver có thể tìm được cây riêng hao ít
   * hơn. Đã gộp thì tin `preview`; chưa gộp thì đọc cờ overThreshold của chính SKU.
   */
  const suggestedPct = (() => {
    const pcts = preview
      ? preview.lines.filter((l) => !l.meetsThreshold).map((l) => l.minWastePct)
      : items
          .filter((i) => selected.has(i.productionInvoiceItemId))
          .flatMap((i) => i.materials.filter((m) => m.overThreshold).map((m) => m.standaloneWastePct))
    if (pcts.length === 0) return null
    return Math.ceil(Math.max(...pcts) * 10) / 10
  })()
  /** Loại sắt kéo con số trên lên cao nhất - nói tên ra thì KHSX biết đang nới cho cái gì. */
  const suggestedDriver = (() => {
    if (preview) {
      const worst = [...preview.lines].filter((l) => !l.meetsThreshold).sort((a, b) => b.minWastePct - a.minWastePct)[0]
      return worst?.materialCode ?? null
    }
    const all = items
      .filter((i) => selected.has(i.productionInvoiceItemId))
      .flatMap((i) => i.materials.filter((m) => m.overThreshold))
      .sort((a, b) => b.standaloneWastePct - a.standaloneWastePct)
    return all[0]?.materialCode ?? null
  })()

  /**
   * Khối "đề nghị cắt đặc cách" chỉ hiện khi thật sự vướng — đạt ngưỡng rồi thì không có gì để xin.
   * Đã gộp thì tin `preview` (gộp có cứu được không) chứ không tin số cắt riêng của từng SKU.
   */
  const overrideNeeded = preview
    ? preview.lines.some((l) => !l.meetsThreshold)
    : items.some((i) => selected.has(i.productionInvoiceItemId) && i.materials.some((m) => m.overThreshold))
  // Không tự bung: chỉ hiện 1 dòng nhắc khi vượt ngưỡng (xem cutModePanel), KHSX bấm mới mở.
  const showOverride = overrideOpen

  // BE bắt buộc lý do khi có ngưỡng đặc cách - chặn luôn ở đây để KHSX không phải ăn lỗi 400.
  const reasonMissing = overrideReason.trim() === ''
  const overrideInvalid = cutMode === 'ACCEPT_OVER' && reasonMissing

  /** undefined = không đề nghị gì, để BE chạy ngưỡng thường + mặc định công ty.
   *
   *  Chiều dài cây đứng ĐỘC LẬP với chế độ cắt: chọn cắt trên cây 5m85 là quyết định kỹ thuật
   *  của KHSX, không phải lời xin Sếp nới ngưỡng - nên nó đi kèm cả khi chế độ vẫn "Bình thường".
   */
  const solverOverride = (): SolverOverrideInput | undefined => {
    const lengths =
      Object.keys(stockLengths).length > 0
        ? { solverStockLengthsByMaterial: stockLengths }
        : undefined
    // Thuần ngân sách thời gian tính toán - LUÔN tự tính (xem autoTimeLimitSeconds ở trên).
    const timeLimit =
      autoTimeLimitSeconds != null ? { solverTimeLimitSecondsOverride: autoTimeLimitSeconds } : undefined
    if (cutMode === 'ACCEPT_OVER') {
      return {
        solverMaxWastePctOverride: NO_CEILING_PCT,
        solverOverrideReason: overrideReason.trim(),
        // Đơn gấp thường kèm "chỉ cây chuẩn" (khỏi chờ NCC cán), nhưng KHÔNG bắt buộc - bỏ tick
        // thì vẫn cho solver dò cây riêng, chỉ là chấp nhận hao cao hơn.
        ...(onlyStandardLength ? { solverAllowCustomLength: false } : {}),
        ...lengths,
        ...timeLimit,
      }
    }
    return lengths || timeLimit ? { ...lengths, ...timeLimit } : undefined
  }

  // Chip hao hụt từng loại sắt + gợi ý "gộp với ai" - dùng chung cho bảng (desktop) và thẻ (điện thoại).
  const materialsCell = (it: CuttingBatchCandidate) => (
    !it.hasActiveBom ? (
      <span style={{ fontSize: 12, color: 'var(--fg-b45309)' }}>
        Chưa có định mức đang áp dụng — không tính được
      </span>
    ) : (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {it.materials.map((m) => (
            <MaterialChip key={m.materialId} code={m.materialCode} pct={m.standaloneWastePct} over={m.overThreshold} minBars={m.standaloneMinBars} stockLengthMm={m.stockLengthMm} verified={m.verified} verifiedLengthSource={m.verifiedLengthSource} thresholdPct={m.thresholdPct} />
          ))}
        </div>
        {/* Chỉ gợi ý cho loại VƯỢT ngưỡng - loại đang đạt thì không cần gộp,
            hiện thêm chỉ làm loãng. Đây là câu trả lời sẵn cho "gộp với ai",
            thay vì bắt KHSX tự quét cả bảng tìm SKU cùng loại sắt. */}
        {it.materials.filter((m) => m.overThreshold).map((m) => (
          <div key={m.materialId} style={{ fontSize: 11, marginTop: 4, color: m.mergeableWithSkus.length ? 'var(--text2)' : 'var(--fg-b45309)' }}>
            {m.mergeableWithSkus.length > 0 ? (
              <>↳ <b>{m.materialCode}</b> gộp được với: <b>{m.mergeableWithSkus.join(', ')}</b></>
            ) : (
              <>↳ <b>{m.materialCode}</b> — không SKU nào khác dùng, gộp không cứu được</>
            )}
          </div>
        ))}
      </>
    )
  )

  /** Mức hao hụt MẶC ĐỊNH của công ty - chỉ đọc (ô bị khoá). Cần cao hơn cho đợt gấp: “Chấp nhận hao hụt cao hơn”
   *  ở khối Chế độ cắt (Sếp duyệt riêng, không đổi mức chung này). */
  const settingsCard = defaults && (
    <div style={{ padding: '12px 14px', marginBottom: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      <label htmlFor="waste-max" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        Hao hụt sắt mặc định tối đa (%):
      </label>
      <input
        id="waste-max"
        value={fmtPct(defaults.solverMaxWastePercentage)}
        disabled
        readOnly
        style={{ width: 'min(260px, 100%)', padding: '9px 11px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text2)', cursor: 'not-allowed', boxSizing: 'border-box' }}
      />
      <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
        Mức chung của công ty, áp cho mọi lượt tính (không sửa tại đây). Đợt gấp cần hao hụt cao hơn: chọn
        {' '}<b>“Chấp nhận hao hụt cao hơn”</b> ở khối “Chế độ cắt” bên dưới — Sếp duyệt riêng cho đợt đó.
      </div>
    </div>
  )

  /** Nút "Tính phương án cắt". Khoá khi: đang gửi yêu cầu, đúng tổ hợp này ĐANG tính (bấm nữa chỉ bị
   *  BE chặn 409), hoặc chưa chọn SKU (đề nghị đặc cách thiếu thì chặn lúc bấm, kèm lỗi ngay chỗ cần điền). (Đang lưu ô hao hụt KHÔNG khoá nút: khoá giữa mousedown và mouseup làm mất click; handleSolve tự chờ lưu xong.) */
  const solveDisabled = solving || currentCalculating || merging || selected.size === 0
  const solveButton = (
    <button
      onClick={handleSolve}
      disabled={solveDisabled}
      style={{
        padding: '8px 16px', border: 'none', borderRadius: 'var(--radius)', fontSize: 13,
        fontWeight: 600, color: '#fff', background: 'var(--bg-2e7d32)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        flexShrink: 0, width: isMobile ? '100%' : undefined,
        cursor: solveDisabled ? 'not-allowed' : 'pointer',
        opacity: solveDisabled ? 0.5 : 1,
      }}
    >
      {(solving || currentCalculating) && <Loader2 size={14} className="spin" />}
      {currentCalculating
        ? 'Đang tính…'
        : currentSolve
          ? `Tính lại phương án cắt (${selected.size} SKU)`
          : `Tính phương án cắt (${selected.size} SKU)`}
    </button>
  )

  const cutModePanel = (
    <div ref={cutModeRef} style={{ padding: '8px 11px', marginBottom: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setOverrideOpen((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12.5, fontWeight: 600, background: 'var(--surface2)', border: `1px solid ${overrideNeeded ? 'var(--fg-fcd34d)' : 'var(--border)'}`, borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text2)' }}
        >
          <Settings size={14} />
          Chế độ cắt: {cutMode === 'ACCEPT_OVER' ? 'Chấp nhận hao hụt cao hơn' : 'Bình thường'}
          {showOverride ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {overrideNeeded && !showOverride && (
        <div style={{ marginTop: 6, display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--fg-92400e)' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Đợt này <b>vượt ngưỡng hao hụt</b> — vẫn tính và tạo lệnh được, nhưng QLSX/Sếp sẽ thấy cảnh báo. Muốn tính với hao hụt cao hơn mức mặc định cho đợt gấp này: mở chế độ cắt và chọn “Chấp nhận hao hụt cao hơn”.</span>
        </div>
      )}

      {showOverride && (
        <div style={{ marginTop: 8, padding: '11px 13px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {overrideNeeded && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--fg-92400e)', background: 'var(--bg-fffbeb)', border: '1px solid var(--fg-fcd34d)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Đợt này <b>vượt ngưỡng hao hụt</b> — vẫn tạo lệnh được nhưng QLSX/Sếp sẽ thấy cảnh báo. Đợt gấp cần mức hao hụt cao hơn mức mặc định: chọn <b>“Chấp nhận hao hụt cao hơn”</b> bên dưới (Sếp duyệt riêng, không đổi mức mặc định).</span>
            </div>
          )}

          {CUT_MODES.map((m) => {
            const active = cutMode === m.value
            return (
              <label
                key={m.value}
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 'var(--radius)', cursor: 'pointer', border: `1px solid ${active ? 'var(--fg-e65100)' : 'var(--border)'}`, background: active ? 'rgba(230,81,0,0.06)' : 'var(--surface)' }}
              >
                <input
                  type="radio"
                  name="cutMode"
                  checked={active}
                  onChange={() => {
                    setCutMode(m.value)
                    setOverrideTouched(false)
                    // Đơn gấp thường kèm "giữ đúng chiều dài đã định" (khỏi chờ NCC cán cây riêng) - tick sẵn, bỏ tick được.
                    if (m.value === 'ACCEPT_OVER') setOnlyStandardLength(true)
                  }}
                  // Ghim kích thước: để trình duyệt tự co giãn thì ở khung hẹp nút radio phình to
                  // bằng cả dòng (lỗi đã gặp ở bản trước).
                  style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1, accentColor: 'var(--fg-e65100)' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{m.desc}</div>
                </div>
              </label>
            )
          })}

          {cutMode === 'ACCEPT_OVER' && (
            <div ref={overrideBoxRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '9px 11px', background: 'var(--bg-fffbeb)', border: '1px solid var(--fg-fcd34d)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                Không đặt trần hao hụt cho đợt này — hệ thống tìm phương án tốt nhất có thể.
                {suggestedPct != null && (
                  <span style={{ color: 'var(--text3)' }}>
                    {' '}Ước tính đợt này cần ≥ {fmtPct(suggestedPct)}%{suggestedDriver ? ` (${suggestedDriver})` : ''}; số thật hiện sau khi tính.
                  </span>
                )}
              </div>
              {/* Nhãn KHỚP NGUYÊN VĂN với callout Sếp đọc lúc duyệt (solverOverrideNote() trong
                  LenhSXPage.tsx) - Sếp phải thấy đúng y chang thứ KHSX vừa tick. Không giả định
                  "cây chuẩn": có thể đang giữ một cây RIÊNG (vd 5850) chọn ở ô chiều dài cây. */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text2)' }}>
                <input
                  type="checkbox"
                  checked={onlyStandardLength}
                  onChange={(e) => setOnlyStandardLength(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 15, height: 15, flexShrink: 0, accentColor: 'var(--fg-e65100)' }}
                />
                Giữ đúng chiều dài đã định, không cho hệ thống tự dò cây khác
              </label>
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Lý do để Sếp duyệt — vd: PO-4 giao gấp, không kịp chờ cán cây riêng"
                style={{ width: '100%', padding: '6px 9px', fontSize: 12.5, border: `1px solid ${overrideTouched && reasonMissing ? 'var(--fg-dc2626)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}
              />
              {overrideTouched && overrideInvalid && (
                <div style={{ fontSize: 12, color: 'var(--fg-b91c1c)' }}>
                  Nhập lý do thì Sếp mới có căn cứ duyệt.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ ...pageTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={20} color="var(--fg-e65100)" /> Tối ưu cắt sắt
          </h2>
          <div style={{ ...pageSubtitle, marginTop: 4 }}>
            Chọn các SKU muốn cắt chung một đợt để bớt số cây sắt phải mua. Chỉ gồm SKU{' '}
            <b>Sếp chưa duyệt</b> — Sếp duyệt rồi thì đã chốt phương án cắt riêng, không gộp được nữa.
          </div>
        </div>
        <button onClick={load} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0 }}>
          <RefreshCw size={14} /> Tải lại
        </button>
      </div>

      {/* 2 tab. Số trên tab kết quả = lượt đang có; chấm xanh = có lượt đã tính xong dùng được để tạo lệnh. */}
      <div style={{ display: 'flex', gap: 8, margin: '14px 0' }}>
        {([
          { key: 'choose', label: 'Chọn và tính' },
          { key: 'results', label: 'Kết quả đã tính' },
        ] as const).map((t) => {
          const active = tab === t.key
          const count = t.key === 'results' ? solves.length : 0
          const readyCount = solves.filter((sv) => sv.invoiceReadiness?.ready === true).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', fontSize: 13,
                fontWeight: 600, borderRadius: 'var(--radius)', cursor: 'pointer',
                border: `1px solid ${active ? 'var(--fg-e65100)' : 'var(--border)'}`,
                background: active ? 'rgba(230,81,0,0.08)' : 'var(--surface)',
                color: active ? 'var(--fg-e65100)' : 'var(--text2)',
              }}
            >
              {t.label}
              {t.key === 'results' && count > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: readyCount > 0 ? 'var(--bg-e8f5e9)' : 'var(--surface2)', color: readyCount > 0 ? 'var(--fg-166534)' : 'var(--text2)' }}>
                  {count}{readyCount > 0 ? ' · xong' : ''}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading && tab === 'choose' && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Đang tải…</div>}
      {error && (
        <div style={{ background: 'var(--bg-fee2e2)', border: '1px solid var(--fg-fca5a5)', color: 'var(--fg-991b1b)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {tab === 'choose' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--bg-eff6ff)', border: '1px solid var(--fg-bfdbfe)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--fg-1e40af)' }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Số kèm dấu <b>≥</b> chỉ là <b>ước tính nhanh</b>, dùng để chọn SKU nào nên cắt chung. Số thật
            có sau khi bấm <b>Tính phương án cắt</b>. Dấu <b style={{ color: 'var(--fg-854d0e)' }}>?</b> = mới
            có vài cây nên ước tính chưa đáng tin.
          </span>
        </div>
      )}

      {tab === 'choose' && !loading && items.length === 0 && !error && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
          Không có SKU nào đang chờ duyệt — không có gì để gộp.
        </div>
      )}

      {tab === 'choose' && items.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
            {overCount > 0
              ? <><b style={{ color: 'var(--fg-b91c1c)' }}>{overCount}</b> SKU có loại sắt vượt ngưỡng hao hụt. </>
              : <>Không SKU nào vượt ngưỡng. </>}
            {recommended.size > 0 && <>Hệ thống đề xuất gộp <b>{recommended.size}</b> SKU — đã tick sẵn, sửa được.</>}
          </div>

          {settingsCard}

          {/* Chế độ cắt nằm cùng nhóm cài đặt ở đầu trang (không nằm trong thanh Tính cố định ở đáy - bung ra
              sẽ che hết bảng SKU, đang tick dở không thấy mình chọn gì). */}
          {selected.size >= 1 && cutModePanel}

          {/* Chiều dài cây theo TỪNG QUY CÁCH. Đổi ô nào thì mọi con số của đúng loại sắt đó
              trong bảng tính lại, các loại khác không đụng tới. */}
          {/* Chiều dài cây theo TỪNG QUY CÁCH.
              Đóng lại thành 1 dòng khi không có gì đặc biệt: cây chuẩn là ca gần như luôn xảy ra
              nên nó phải tốn ĐÚNG 1 dòng chữ, không phải một dãy ô nhập. Mở ra chỉ khi thật sự
              cần đổi. Dòng tóm tắt chỉ nêu NGOẠI LỆ - 10 loại sắt đổi 1 thì vẫn gọn 1 dòng. */}
          {materialsInTable.length > 0 && (
            <div style={{ padding: '8px 11px', marginBottom: 8, background: 'var(--surface)', border: `1px solid ${lenChanged.length > 0 ? 'var(--fg-fcd34d)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Chiều dài cây sắt</span>
                {!lenOpen && (
                  <span style={{ color: 'var(--text2)' }}>
                    {lenChanged.length === 0 ? (
                      <>tất cả {fmtLen(DEFAULT_STOCK_LENGTH_MM)} <span style={{ color: 'var(--text3)' }}>(cây chuẩn)</span></>
                    ) : (
                      <>
                        {lenChanged.map((m, i) => (
                          <span key={m.id}>
                            {i > 0 && ' · '}
                            {m.code} <b>{fmtLen(stockLengths[m.id])}</b>
                          </span>
                        ))}
                        {lenChanged.length < materialsInTable.length && (
                          <span style={{ color: 'var(--text3)' }}> · còn lại {fmtLen(DEFAULT_STOCK_LENGTH_MM)}</span>
                        )}
                      </>
                    )}
                  </span>
                )}
                <button
                  onClick={() => setLenOpen((v) => !v)}
                  style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text2)' }}
                >
                  {lenOpen ? 'Xong' : 'Đổi'}
                </button>
                {lenOpen && lenChanged.length > 0 && (
                  <button
                    onClick={() => setStockLenInput({})}
                    style={{ fontSize: 12, padding: '3px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text2)' }}
                  >
                    Về cây chuẩn
                  </button>
                )}
              </div>

              {lenOpen && (
                <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: 'auto max-content', gap: '5px 12px', alignItems: 'center', maxWidth: 360 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Loại sắt</span>
                  {/* "mm" nêu MỘT lần ở tiêu đề cột thay vì lặp sau từng ô. */}
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'right' }}>Chiều dài (mm)</span>
                  {materialsInTable.map((m) => {
                    const bad = stockLenBad(m.id)
                    const changed = stockLengths[m.id] != null
                    return (
                      <Fragment key={m.id}>
                        <label htmlFor={`len-${m.id}`} style={{ fontSize: 12.5, color: changed ? 'var(--text)' : 'var(--text2)', fontWeight: changed ? 600 : 400 }}>
                          {m.code}
                        </label>
                        <input
                          id={`len-${m.id}`}
                          value={stockLenInput[m.id] ?? ''}
                          onChange={(e) => setStockLenInput((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          inputMode="numeric"
                          placeholder={String(DEFAULT_STOCK_LENGTH_MM)}
                          aria-label={`Chiều dài cây cho ${m.code}, tính bằng mm`}
                          title="Bỏ trống = dùng cây chuẩn của công ty. Nhập mm, vd 5850 cho cây 5m85."
                          style={{ width: 78, padding: '4px 8px', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: changed ? 700 : 400, border: `1px solid ${bad ? 'var(--fg-dc2626)' : changed ? 'var(--fg-e65100)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text)' }}
                        />
                      </Fragment>
                    )
                  })}
                  <span style={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'var(--text3)' }}>
                    Bỏ trống = cây chuẩn {fmtLen(DEFAULT_STOCK_LENGTH_MM)}.
                  </span>
                  {materialsInTable.some((m) => stockLenBad(m.id)) && (
                    <span style={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'var(--fg-b91c1c)' }}>
                      Chiều dài phải từ {MIN_STOCK_LENGTH_MM} đến {MAX_STOCK_LENGTH_MM}mm — nhập theo mm (6000, không phải 6).
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it: CuttingBatchCandidate) => {
                const isSel = selected.has(it.productionInvoiceItemId)
                return (
                  <div
                    key={it.productionInvoiceItemId}
                    onClick={() => toggle(it.productionInvoiceItemId)}
                    className="card"
                    style={{ padding: '11px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start', background: isSel ? 'var(--bg-f0fdf4)' : undefined, borderColor: isSel ? 'var(--fg-86efac)' : undefined }}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(it.productionInvoiceItemId)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Chọn ${it.mfgProductCode}`}
                      style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <b style={{ wordBreak: 'break-word' }}>{it.mfgProductCode}</b>
                        {recommended.has(it.productionInvoiceItemId) && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'var(--bg-dbeafe)', color: 'var(--fg-1e40af)' }}>ĐỀ XUẤT</span>
                        )}
                        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', color: 'var(--text2)' }}>SL {it.quantity}</span>
                      </div>
                      {it.mfgProductName && <div style={{ color: 'var(--text2)', marginTop: 2, wordBreak: 'break-word' }}>{it.mfgProductName}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{it.salesOrderCode ?? it.productionInvoiceCode ?? '—'}{approvalLabel(it.prodApprovalStatus) && ` · ${approvalLabel(it.prodApprovalStatus)}`}</span>
                        <span>Hạn {fmtDate(it.deadline)}</span>
                        {isSel && selected.size >= 2 && daysEarlyOf(it) > 0 && (
                          <span style={{ color: 'var(--fg-b45309)' }}>sớm {daysEarlyOf(it)} ngày</span>
                        )}
                      </div>
                      {it.rejectReason && (
                        <div style={{ fontSize: 11, color: 'var(--fg-b91c1c)', marginTop: 4, display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                          <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>Bị từ chối: {it.rejectReason}</span>
                        </div>
                      )}
                      <div style={{ marginTop: 8 }}>
                        {materialsCell(it)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 34 }} />
                  <th style={TH}>Đơn hàng</th>
                  <th style={TH}>SKU</th>
                  <th style={TH}>Sản phẩm</th>
                  <th style={{ ...TH, textAlign: 'right' }}>SL</th>
                  <th style={TH}>Hạn</th>
                  <th style={TH}>Loại sắt · hao hụt khi cắt riêng</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: CuttingBatchCandidate) => {
                  const isSel = selected.has(it.productionInvoiceItemId)
                  return (
                    <tr
                      key={it.productionInvoiceItemId}
                      onClick={() => toggle(it.productionInvoiceItemId)}
                      style={{ cursor: 'pointer', background: isSel ? 'var(--bg-f0fdf4)' : undefined }}
                    >
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(it.productionInvoiceItemId)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Chọn ${it.mfgProductCode}`}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={TD}>
                        {it.salesOrderCode ?? it.productionInvoiceCode ?? '—'}
                        {approvalLabel(it.prodApprovalStatus) && (
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{approvalLabel(it.prodApprovalStatus)}</div>
                        )}
                      </td>
                      <td style={TD}>
                        <b>{it.mfgProductCode}</b>
                        {recommended.has(it.productionInvoiceItemId) && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'var(--bg-dbeafe)', color: 'var(--fg-1e40af)' }}>
                            ĐỀ XUẤT
                          </span>
                        )}
                      </td>
                      <td style={{ ...TD, color: 'var(--text2)' }}>
                        {it.mfgProductName ?? '—'}
                        {/* SKU quay lại đây sau khi Sếp bác một đợt gộp - phải nói rõ VÌ SAO, nếu
                            không KHSX rất dễ gộp lại đúng tổ hợp vừa bị bác. */}
                        {it.rejectReason && (
                          <div style={{ fontSize: 11, color: 'var(--fg-b91c1c)', marginTop: 3, display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                            <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>Bị từ chối: {it.rejectReason}</span>
                          </div>
                        )}
                      </td>
                      <td style={NUM}>{it.quantity}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                        {fmtDate(it.deadline)}
                        {/* Chi phí cắt sớm gắn vào ĐÚNG SKU gây ra nó. Trước đây chỉ có 1 con số
                            cho cả nhóm nên không biết SKU nào đang làm đội chi phí. */}
                        {isSel && selected.size >= 2 && daysEarlyOf(it) > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--fg-b45309)' }}>sớm {daysEarlyOf(it)} ngày</div>
                        )}
                      </td>
                      <td style={TD}>
                        {materialsCell(it)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {tab === 'choose' && selected.size >= 2 && (
        <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14, flex: '1 1 auto' }}>Nếu gộp {selected.size} SKU đã chọn</b>
            {previewing && <Loader2 size={15} className="spin" color="var(--text3)" />}
            {preview && (
              <>
                <span style={{ fontSize: 15, fontWeight: 700, color: preview.totalBarsSaved > 0 ? 'var(--fg-166534)' : 'var(--text3)' }}>
                  {preview.totalBarsSaved > 0 ? `Bớt ${preview.totalBarsSaved} cây sắt` : 'Không bớt được cây nào'}
                </span>
                {preview.daysCutEarly !== null && preview.daysCutEarly > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--fg-b45309)' }}>
                    · đơn xa nhất phải cắt sớm {preview.daysCutEarly} ngày
                  </span>
                )}
              </>
            )}
          </div>

          {/* Cảnh báo SKU chọn thừa: đóng góp 0 mà vẫn đội chi phí cắt sớm. Đặt NGAY dưới tiêu đề
              chứ không phải cuối bảng - đây là thứ khiến người dùng chọn sai nhóm. */}
          {deadItems.map((it) => {
            const d = daysEarlyOf(it)
            return (
              <div key={it.productionInvoiceItemId} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--bg-fffbeb)', borderBottom: '1px solid var(--border)', fontSize: 12.5, color: 'var(--fg-92400e)' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ flex: 1 }}>
                  <b>{it.mfgProductCode}</b> không dùng chung loại sắt nào với các SKU còn lại trong
                  nhóm — giữ lại <b>không bớt được cây nào</b>
                  {d > 0 && <>, mà vẫn phải <b>cắt sớm {d} ngày</b></>}.
                </span>
                <button
                  onClick={() => toggle(it.productionInvoiceItemId)}
                  style={{ flexShrink: 0, padding: '3px 9px', fontSize: 12, background: 'var(--surface)', border: '1px solid var(--fg-fcd34d)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--fg-92400e)', fontWeight: 600 }}
                >
                  Bỏ khỏi nhóm
                </button>
              </div>
            )
          })}

          {preview && sharedLines.length === 0 && (
            <div style={{ padding: '14px', fontSize: 13, color: 'var(--fg-b45309)' }}>
              Các SKU đã chọn <b>không dùng chung loại sắt nào</b> — gộp chúng lại không thay đổi
              được gì. Chọn các SKU có chung ít nhất một loại sắt.
            </div>
          )}

          {preview && sharedLines.length > 0 && (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 0 : 720 }}>
                <thead>
                  <tr>
                    <th style={TH}>Loại sắt</th>
                    <th style={TH}>SKU dùng</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Số cây cần</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Hao hụt</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 19/09, sau 2 vòng góp ý: bỏ "Cắt riêng"/"Cắt chung" rồi bỏ nốt "Bớt" theo yêu
                      cầu người dùng ("chỉ quan tâm hao hụt thôi", xác nhận sau khi đã được cảnh báo
                      về nguyên tắc #1 đầu file - case sắt 50x50 giảm % đẹp mà bớt đúng 0 cây thật).
                      Số "Bớt"/"Cắt riêng"/"Cắt chung" VẪN còn ở banner đầu khối "Nếu gộp N SKU"
                      (`preview.totalBarsSaved`, xem phía trên) - chỉ bỏ khỏi bảng chi tiết theo
                      từng loại sắt này, không xoá khỏi toàn trang. */}
                  {[...sharedLines, ...soloLines].map((l) => {
                    const isSolo = l.contributingSkus.length < 2
                    return (
                      <tr key={l.materialId} style={isSolo ? { background: 'var(--surface2)' } : undefined}>
                        <td style={TD}>
                          <span style={{ fontWeight: isSolo ? 500 : 700 }}>{l.materialCode}</span>
                          {/* Cùng quy tắc với MaterialChip: chỉ nêu khi KHÁC cây chuẩn, tránh
                              lặp "(6m)" ở mọi dòng mà không nói được gì mới. */}
                          {l.stockLengthMm != null && l.stockLengthMm !== DEFAULT_STOCK_LENGTH_MM && (
                            <span style={{ marginLeft: 6, fontSize: 11.5, color: 'var(--text3)', fontWeight: 500 }}>
                              cây {fmtLen(l.stockLengthMm)}
                            </span>
                          )}
                        </td>
                        <td style={{ ...TD, fontSize: 12, color: 'var(--text2)' }}>{l.contributingSkus.join(' + ')}</td>
                        {/* 21/09: đưa lại số cây (chính là cột "Cắt chung" bỏ hôm 19/09), lần này
                            KHÔNG phải để so sánh gộp/không gộp mà để trả lời "loại sắt này phải
                            mua bao nhiêu cây". Vẫn kèm dấu ≥ vì minBarsFor() là CẬN DƯỚI
                            (ceil(tổng mm cần / mm dùng được của cây khéo nhất)) - phương án cắt
                            thật (bấm “Tính phương án cắt” để có số thật) có thể cần nhiều hơn. Bỏ dấu ≥ ở đây là
                            biến con số tham khảo thành đơn đặt hàng. */}
                        <td style={NUM} title={`Cắt khéo nhất cũng cần ${l.minBars} cây ${l.materialCode} - phương án cắt thật (bấm “Tính phương án cắt” để có số thật) có thể cần nhiều hơn.`}>
                          ≥ {l.minBars}
                        </td>
                        <td style={NUM}>
                          <span title={isLowConfidence(l.minBars) ? `Chỉ ${l.minBars} cây - cận dưới này KHÔNG đáng tin (số lượng quá nhỏ để so sánh)` : undefined}>
                            ≥ {l.minWastePct.toFixed(2)}%
                            {isLowConfidence(l.minBars) && <span style={{ marginLeft: 3, fontWeight: 700, color: 'var(--fg-854d0e)' }}>?</span>}
                          </span>
                          {l.meetsThreshold
                            ? <span style={{ marginLeft: 5, color: 'var(--fg-166534)' }}><Check size={12} /></span>
                            : <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 700, color: 'var(--fg-b91c1c)' }}>vượt ngưỡng {l.thresholdPct}%</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* Đúng 1 SKU: không có gì để gộp (lợi ích chỉ đến khi đoạn của NHIỀU SKU nằm chung một cây)
          - vẫn tính phương án cắt riêng cho nó rồi tạo lệnh sản xuất riêng, chỉ là không cần preview
          hao hụt vì không có gì để so sánh. */}
      {tab === 'choose' && selected.size === 1 && (
        <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 12.5, color: 'var(--text2)' }}>
          Chọn 1 SKU thì không có gì để gộp — SKU này cắt riêng như bình thường. Chọn thêm ít nhất một SKU
          nữa (dùng chung loại sắt) mới bớt được cây.
        </div>
      )}

      {/* Thanh hành động CỐ ĐỊNH ở đáy: luôn thấy nút Tính dù bảng SKU dài. Chỉ gồm tóm tắt + nút - mọi cài đặt ở đầu trang. */}
      {tab === 'choose' && selected.size >= 1 && (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 5, marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', boxShadow: '0 -4px 14px rgba(0,0,0,0.14)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              Đang chọn <b>{selected.size}</b> SKU
              {currentSolve ? ' · đã có kết quả (xem tab “Kết quả đã tính”)' : ' · chưa tính'}
              {' · '}Chế độ: <b>{cutMode === 'ACCEPT_OVER' ? 'chấp nhận hao hụt cao hơn' : 'bình thường'}</b>
              {overrideTouched && overrideInvalid && (
                <span style={{ color: 'var(--fg-b91c1c)' }}> — chưa điền đủ ở khối “Chế độ cắt” phía trên</span>
              )}
            </span>
            {solveButton}
          </div>
        </div>
      )}

      {/* Kết quả solver THẬT + theo dõi tiến độ. Mỗi lượt là 1 thẻ; thẻ mới nhất mở sẵn. */}
      {tab === 'results' && (
        <CuttingSolvePanel
          solves={solves}
          expandedId={expandedSolveId}
          onToggle={(id) => setExpandedSolveId((cur) => (cur === id ? null : id))}
          creating={merging}
          onCreateInvoice={handleCreateInvoice}
          onRecalc={handleRecalcFrom}
          onDiscard={handleDiscard}
          onGoChoose={() => setTab('choose')}
          isMobile={isMobile}
        />
      )}
      {confirmModal}
    </div>
  )
}
