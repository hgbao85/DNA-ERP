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
 *
 * 13/11/2026 (góp ý Sếp 12/11): KHSX phải chọn XƯỞNG cơ khí trước khi bấm Tính (không tự chọn sẵn); xưởng đi kèm
 * lượt tính -> BE áp luật số cỡ đoạn/cây của xưởng, lệnh tạo ra mang sẵn xưởng đó. Các lời gọi ước tính/chip
 * CHƯA gửi xưởng (đợt này chưa áp luật xưởng cho số ước tính).
 */

import MaterialChoiceTags from '../../../components/MaterialChoiceTags'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Info, Layers, Loader2, RefreshCw } from 'lucide-react'
import {
  claimSoloCuttingBatch,
  getCuttingBatchCandidates,
  getCuttingBatchSolves,
  discardCuttingBatchSolve,
  getCuttingDefaults,
  getCuttingBatchFixOptions,
  mergeCuttingBatch,
  type CuttingDefaults,
  type CuttingBatchFixOptions,
  previewCuttingBatch,
  requestCuttingBatchSolve,
  type CuttingBatchSolve,
  type CuttingBatchCandidate,
  type CuttingBatchCandidateList,
  type SolverOverrideInput,
  type CuttingBatchPreview,
  type StockLengthsByMaterial,
} from '../../../services/cutting-batch-api'
import CuttingSolvePanel, { sameItemSet, solveMachine, solveSkuCodes, solveOrderCodes } from './CuttingSolvePanel'
import { errMsg } from '../../../utils/errors'
import { getWorkshops } from '../../../services/workshops-api'
import type { Workshop } from '../../../types/workshop'
import type { SolverMachine } from '../../../types/admin'
import { MACHINE_LABEL } from '../../../utils/cutMachine'
import { fmtNum, fmtPercent } from '../../../utils/numberFormat'
import {
  buildBarStatus, buildBarSummary, buildMachineParams, buildRuleReason, bundleSpecEntriesOf, collectMaterialsInTable,
  DEFAULT_STOCK_LENGTH_MM, fmtBarMm, fmtDate, MAX_STOCK_LENGTH_MM, materialLabel, MIN_STOCK_LENGTH_MM,
  selectedFirst, splitFixMaterials, summarizeCodes, type CutModeKey,
} from './gomDotCatUi'
import { chipStatus, mergeVerified, type ChipStatus } from '../../../utils/mergeHints'
import { DEFAULT_MERGE_MAX_SKUS, DEFAULT_MERGE_WINDOW_DAYS, steelNeedSpan } from '../../../utils/steelNeedWindow'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { useConfirm } from '../../../hooks/useConfirm'
import type { CuttingRecheckItem } from '../../../services/production-invoices-api'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import CutModeDetail from './gomDotCat/CutModeDetail'
import FixOptionsPanel from './gomDotCat/FixOptionsPanel'
import { outlineBtn } from './gomDotCat/gomDotCatStyles'
import { MachineParamsBody, MachineParamsButton } from './gomDotCat/MachineParams'
import RecheckBanner from './gomDotCat/RecheckBanner'
import SettingsPanel from './gomDotCat/SettingsPanel'

/**
 * 2 tình huống cắt KHSX chọn cho đợt sắp tạo. Đặt tên theo NGHIỆP VỤ chứ không theo tham số kỹ
 * thuật, vì người chọn là bên kế hoạch - bên dưới mới quy về 2 thông số độc lập gửi BE
 * (solverAllowCustomLength / solverMaxWastePctOverride, xem SolverOverrideInput).
 *
 * Từng có lựa chọn thứ 3 "Chỉ mua cây chuẩn, phải đạt ngưỡng" (2026-09-15, đã bỏ theo yêu cầu):
 * nó chỉ khác "Bình thường" ĐÚNG một ca - khi không cây chuẩn nào đạt ngưỡng - và khi đó chỉ làm
 * mỗi việc là dừng lại. Ràng buộc "chỉ cây chuẩn" KHÔNG mất: ACCEPT_OVER LUÔN giữ đúng chiều dài
 * đã định (2026-10-24, theo yêu cầu: bỏ ô tick "Giữ đúng chiều dài đã định" vì cho dò chiều dài là
 * trùng với "Bình thường") - đơn gấp không chờ NCC cán cây riêng được. Nếu sau này muốn cấm đặt
 * cây riêng cho TOÀN hệ thống thì đặt SystemConfig.solverAllowCustomLength = false.
 */
type CutMode = CutModeKey


/** "Chấp nhận hao hụt cao hơn" không còn ô nhập % (2026-09-30, theo yêu cầu): Sếp duyệt trên KẾT QUẢ THẬT đã tính nên con số xin
 *  là thừa. BE vẫn cần 1 con số ngưỡng đặc cách -> gửi trần tối đa cho phép (100%) = "không đặt trần hao hụt". */
const NO_CEILING_PCT = 100

/** Trần giây/loại sắt gửi cho solver (thử nghiệm 2026-10-01) - xem autoTimeLimitSeconds. */
const SOLVER_MAX_SECONDS_PER_MATERIAL = 20


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
 * 3 trạng thái (2026-10-24, xem utils/mergeHints.ts chipStatus): ĐỎ = vượt ngưỡng (đã xác minh, hoặc cận dưới ước tính đã vượt -
 * chắc chắn vượt); XANH = đã xác minh bằng bộ giải và đạt; XÁM "chưa kiểm" = chưa xác minh được. Ngưỡng theo `overThreshold` BE
 * tính sẵn (SystemConfig.solverMaxWastePercentage) - KHÔNG hard-code mốc % ở đây.
 *
 * Trước đây chip chưa xác minh hiện XANH "≥x%" (kèm "?" khi ít cây) - đo 2026-10-24 (changelog BE mục 28) có ca "≥0,17%" xanh mà
 * thật ra cây 6m tốt nhất 19,67 % (SAT-PHI-6), MC Tự động "≥0%" mà thật 57 %: cận dưới chưa vượt ngưỡng KHÔNG nói được là đạt.
 */

function MaterialChip({ m, checking }: { m: CuttingBatchCandidate['materials'][number]; checking: boolean }) {
  const { materialCode: code, standaloneWastePct: pct, stockLengthMm, verified, verifiedLengthSource, thresholdPct } = m
  const status: ChipStatus = chipStatus(m)
  // Chip hiện "Tên · Quy cách" (KHSX nhận ra tên chứ không nhớ mã); mã đưa vào tooltip.
  const label = materialLabel(m.materialName, m.materialSpec, code)
  // "scan" = KHÔNG có cách nào cắt ở chiều dài đang chọn mà MỌI cây đều đạt ngưỡng riêng - CHẮC CHẮN hao hụt thật > ngưỡng (xem
  // CandidateMaterial.verifiedLengthSource). `pct` lúc đó chỉ là số tốt nhất SAU KHI phá luật đó - KHÔNG hiện làm số chính (mục 19.9).
  const provenOverThreshold = verified && verifiedLengthSource === 'scan'
  // Nêu rõ con số đang nói về CÂY NÀO - đổi ô chiều dài xong chip nhảy số thì phải biết nó nhảy theo cây nào.
  const onBar = stockLengthMm != null ? ` (cây ${fmtBarMm(stockLengthMm)})` : ''
  const thr = fmtNum(thresholdPct)
  const isChecking = status === 'unknown' && checking
  const title =
    isChecking
      ? `${code}${onBar} — Đang kiểm bằng bộ giải`
      : status === 'unknown'
      ? `${code}${onBar} — CHƯA kiểm được bằng bộ giải (nhiều cỡ đoạn, hoặc bộ giải chưa kịp). Ước tính tối thiểu ≥${fmtPercent(pct)}% - chưa nói được là đạt hay không; số thật có sau khi bấm Tính phương án cắt.`
      : provenOverThreshold
        ? `${code}${onBar} — CHẮC CHẮN vượt ngưỡng ${thr}%: không có cách nào cắt đúng số lượng mà MỌI cây đều đạt ngưỡng riêng. Nếu chấp nhận có vài cây lẻ tự vượt ngưỡng, tốt nhất tìm được là ${fmtPercent(pct)}% - nhưng đây KHÔNG phải phương án hệ thống tự chọn khi duyệt (sẽ tự đặt cây riêng thay vào đó).`
        : verified
          ? `${code}${onBar} — số THẬT vừa xác minh với bộ giải (không phải ước tính)`
          : `${code}${onBar} — ước tính tối thiểu ≥${fmtPercent(pct)}% đã vượt ngưỡng ${thr}% nên chắc chắn vượt (chưa kiểm bằng bộ giải)`
  const look =
    status === 'over'
      ? { background: 'var(--bg-fee2e2)', color: 'var(--fg-b91c1c)', border: '1px solid transparent' }
      : status === 'ok'
        ? { background: 'var(--bg-e8f5e9)', color: 'var(--fg-166534)', border: '1px solid transparent' }
        : { background: 'var(--surface2)', color: 'var(--text2)', border: '1px dashed var(--border)' }
  // Phần số đứng sau nhãn sắt; chưa kiểm xong thì KHÔNG lặp chữ "đang kiểm" ở từng chip (đã có icon xoay + dòng trạng thái chung).
  const suffix =
    status === 'unknown'
      ? (isChecking ? null : '· chưa kiểm')
      : provenOverThreshold
        ? `>${thr}%`
        : `${verified ? '' : '≥'}${fmtPercent(pct)}%`
  return (
    <span
      title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 280, fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, whiteSpace: 'nowrap', ...look }}
    >
      {status === 'over' && <AlertTriangle size={11} style={{ flexShrink: 0 }} />}
      {isChecking && <Loader2 size={11} className="spin" style={{ flexShrink: 0 }} />}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {suffix && <span style={{ flexShrink: 0 }}>{suffix}</span>}
      {/* Chỉ hiện khi KHÁC cây chuẩn: gắn "(6.000 mm)" vào mọi chip chỉ làm bảng ồn thêm. */}
      {stockLengthMm != null && stockLengthMm !== DEFAULT_STOCK_LENGTH_MM && (
        <span style={{ flexShrink: 0, fontWeight: 500, opacity: 0.75 }}>· cây {fmtBarMm(stockLengthMm)}</span>
      )}
    </span>
  )
}


/** Hai tập id giống hệt nhau (không tính thứ tự) - nút "Chọn lại đề xuất" chỉ hiện khi lựa chọn đã khác đề xuất. */
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))

/** Khoá của 1 tổ hợp đã chọn - cùng công thức với selectedKey trong component. */
const keyOf = (ids: Iterable<string>) => [...ids].sort().join(',')

interface Props {
  /** Chuyển sang màn "Lệnh sản xuất mới" - nơi làm bước tiếp theo sau khi chốt nhóm. */
  onDone?: () => void
  /** Vừa bấm "Đã kiểm" 1 lệnh đổi xưởng - để số đỏ ở menu tải lại ngay. */
  onRecheckChanged?: () => void
  /** Lệnh đổi xưởng chờ kiểm lại phương án cắt - do ProductionPlanApp nạp (đã dùng cho số đỏ ở menu). */
  recheck?: CuttingRecheckItem[] | null
}

export default function GomDotCatPage({ onDone, onRecheckChanged, recheck: recheckProp }: Props) {
  const [data, setData] = useState<CuttingBatchCandidateList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { ask, confirmModal } = useConfirm()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // SKU được ghim lên đầu bảng (13/11/2026): chụp lựa chọn lúc danh sách TẢI (mở trang, "Tải lại", đổi chiều dài cây), không theo từng
  // lần tick - tick thêm mà dòng nhảy lên đầu thì dòng chạy khỏi con trỏ, dễ tick nhầm dòng khác.
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected }, [selected])
  const [preview, setPreview] = useState<CuttingBatchPreview | null>(null)
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
  const [overrideOpen, setOverrideOpen] = useState(false)
  // Máy cắt KHSX chọn cho ĐÚNG đợt sắp tính. null = theo mặc định của hệ thống (Admin > Cấu hình hệ thống > Máy cắt).
  // Đứng độc lập với chế độ cắt ở trên: hai chế độ "Bình thường" / "Chấp nhận hao hụt cao hơn" áp cho cả hai máy.
  const [machine, setMachine] = useState<SolverMachine | null>(null)
  // Xưởng cơ khí KHSX chọn cho đợt sắp tính (13/11/2026) - BẮT BUỘC, không tự chọn sẵn. '' = chưa chọn.
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [workshopId, setWorkshopId] = useState('')
  const selectedWorkshop = workshops.find((w) => String(w.id) === workshopId) ?? null
  // Máy cắt BẮT BUỘC theo xưởng (13/11/2026, Admin > Cấu hình hệ thống > Máy cắt): xưởng có khoá thì ô máy cắt khoá theo máy đó và mọi
  // chỗ dùng máy cho lượt tính (ước tính, chip, gửi BE, so khớp kết quả) dùng MÁY HIỆU LỰC này. Đổi sang xưởng không bắt buộc thì
  // `machine` (lựa chọn trước đó của KHSX) tự có hiệu lực lại vì ta không ghi đè nó.
  const forcedMachine: SolverMachine | null = (selectedWorkshop && defaults?.solverMachineByWorkshop?.[selectedWorkshop.code]) || null
  const usedMachine = forcedMachine ?? machine
  // Khối "Thông số máy cắt" (chỉ xem) đóng sẵn - KHSX ít khi cần, trưng sẵn chỉ làm dài khối máy cắt.
  const [machineParamsOpen, setMachineParamsOpen] = useState(false)
  // Dòng SKU đang mở "n loại đạt" - đóng sẵn: dòng chỉ hiện loại có cảnh báo / chưa kiểm.
  const [okOpen, setOkOpen] = useState<Set<string>>(new Set())
  // Lượt KIỂM BÙ (deepVerify) cho chip chưa xác minh đang chạy nền - xem load().
  const [deepVerifying, setDeepVerifying] = useState(false)
  // Khối "Đợt đang chọn" (2026-10-24): cách xử lý cho ĐÚNG tổ hợp đang tick (bộ giải thật, BE cutting-batch-fix-options).
  const [fixOpts, setFixOpts] = useState<CuttingBatchFixOptions | null>(null)
  const [fixKey, setFixKey] = useState<string | null>(null)
  const [fixLoading, setFixLoading] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)
  // Tick sẵn = đơn gấp nhất có cảnh báo (BE) + các đơn gợi ý gộp của nó (fix-options) - giữ để "Chọn lại đề xuất" quay về đúng đợt này.
  const [recommendedOverride, setRecommendedOverride] = useState<Set<string> | null>(null)
  const autoFill = useRef<Set<string> | null>(null)
  const batchPanelRef = useRef<HTMLDivElement | null>(null)
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
  // Nút "Giải thích" ở khung Cài đặt đợt tính (13/11/2026): câu giải thích dài thu lại, mở khi cần.
  const [settingsHelpOpen, setSettingsHelpOpen] = useState(false)
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

  // Mỗi lần tải 1 số thứ tự: kết quả (cả lượt kiểm bù) của lần tải CŨ về muộn thì bỏ, không ghi đè bảng của cài đặt mới.
  const loadSeq = useRef(0)
  // Lần tải đầu gọi ngay; debounce chỉ để chống bắn dồn khi KHSX đang gõ chiều dài (lần 2 trở đi).
  const loadedOnce = useRef(false)
  // selectedKey do HỆ THỐNG vừa đặt (tick sẵn, tự thêm đơn gợi ý gộp, cập nhật sau kiểm bù): fix-options chạy ngay,
  // không chờ 500 ms vì đâu có ai đang tick dở. Lựa chọn do người bấm thì khác key này -> vẫn chờ như cũ.
  const systemKey = useRef<string | null>(null)
  // Danh sách lệnh đổi xưởng chờ kiểm lại do ProductionPlanApp nạp (dùng chung với số đỏ ở menu) - khỏi gọi trùng.
  const recheck = recheckProp ?? []
  const load = useCallback(() => {
    const seq = ++loadSeq.current
    setLoading(true)
    setDeepVerifying(false)
    getCuttingBatchCandidates(stockLengths, usedMachine)
      .then((res) => {
        if (seq !== loadSeq.current) return
        setData(res)
        // Kiểm bù NỀN (2026-10-24): chip lượt nhanh chưa kịp xác minh hiện xám "đang kiểm" rồi tự cập nhật - không chặn trang, không
        // làm mờ bảng, không đổi thứ tự dòng/lựa chọn (mergeVerified). BE nhớ kết quả nên lượt này không giải lại chip đã có.
        const shownRec = new Set(res.recommendedItemIds)
        if (res.items.some((i) => i.materials.some((m) => !m.verified && !m.overThreshold))) {
          setDeepVerifying(true)
          getCuttingBatchCandidates(stockLengths, usedMachine, { deepVerify: true })
            .then((deep) => {
              if (seq !== loadSeq.current) return
              setData((prev) => (prev ? mergeVerified(prev, deep) : prev))
              // Đơn tick sẵn tính lại sau khi chip được xác minh: KHSX còn để nguyên đề xuất lúc tải thì đổi theo; đã tick tay thì giữ.
              if (autoFill.current && sameSet(autoFill.current, shownRec)) autoFill.current = new Set(deep.recommendedItemIds)
              systemKey.current = keyOf(deep.recommendedItemIds)
              setSelected((cur) => (sameSet(cur, shownRec) ? new Set(deep.recommendedItemIds) : cur))
              setPinned((cur) => (sameSet(cur, shownRec) ? new Set(deep.recommendedItemIds) : cur))
            })
            .catch(() => { /* kiểm bù lỗi thì chip giữ "chưa kiểm" - không phải lỗi của trang */ })
            .finally(() => { if (seq === loadSeq.current) setDeepVerifying(false) })
        }
        if (!pickedOnce.current) {
          // Tick sẵn đơn gấp nhất có cảnh báo; khi cách xử lý của đợt đó về (fix-options) thì tự thêm đơn gợi ý gộp - xem effect dưới.
          systemKey.current = keyOf(res.recommendedItemIds)
          setSelected(new Set(res.recommendedItemIds))
          setPinned(new Set(res.recommendedItemIds))
          autoFill.current = new Set(res.recommendedItemIds)
          pickedOnce.current = true
        } else {
          // Tải lại do đổi chiều dài cây: giữ lựa chọn, chỉ bỏ SKU không còn trong bảng.
          const alive = new Set(res.items.map((i) => i.productionInvoiceItemId))
          setSelected((prev) => new Set([...prev].filter((id) => alive.has(id))))
          setPinned(new Set([...selectedRef.current].filter((id) => alive.has(id))))
        }
        setError(null)
      })
      .catch((e) => { if (seq === loadSeq.current) setError(errMsg(e, 'Không tải được danh sách SKU')) })
      .finally(() => { if (seq === loadSeq.current) setLoading(false) })
  }, [stockLengths, usedMachine])

  // Gõ chiều dài tới đâu tải lại tới đó, nhưng CHỜ 400ms: không debounce thì gõ "5850" bắn 4
  // request, và request của "5" (số vô lý) có thể về sau cùng rồi ghi đè kết quả đúng.
  // Lần đầu vào màn thì không có ai đang gõ -> tải ngay, khỏi chờ vô ích.
  useEffect(() => {
    // Đánh dấu khi load() THẬT SỰ chạy (trong hẹn giờ), không phải lúc effect chạy: StrictMode ở dev chạy effect 2 lần, đánh dấu
    // sớm thì lần chạy thứ 2 lại phải chờ 400 ms.
    const t = setTimeout(() => { loadedOnce.current = true; load() }, loadedOnce.current ? 400 : 0)
    return () => clearTimeout(t)
  }, [load])

  // Tính lại mỗi khi tổ hợp đổi. Dưới 2 SKU thì không có gì để gộp -> xoá kết quả cũ.
  const selectedKey = useMemo(() => [...selected].sort().join(','), [selected])
  useEffect(() => {
    const ids = selectedKey ? selectedKey.split(',') : []
    if (ids.length < 2) { setPreview(null); return }
    let cancelled = false
    previewCuttingBatch(ids, stockLengths, usedMachine)
      .then((res) => { if (!cancelled) setPreview(res) })
      .catch((e) => { if (!cancelled) setError(errMsg(e, 'Không tính được tổ hợp đã chọn')) })
    return () => { cancelled = true }
  }, [selectedKey, stockLengths, usedMachine])

  // Khối "Đợt đang chọn": hỏi BE cách xử lý cho ĐÚNG tổ hợp đang tick (chờ 500 ms cho KHSX tick xong; lần trả về cũ bị bỏ).
  useEffect(() => {
    const ids = selectedKey ? selectedKey.split(',') : []
    if (ids.length === 0) { setFixOpts(null); setFixKey(null); setFixError(null); return }
    let cancelled = false
    const bySystem = systemKey.current === selectedKey
    const t = setTimeout(() => {
      // Xoá mốc khi gọi THẬT (không phải lúc effect chạy) - lý do như hẹn giờ tải bảng ở trên.
      if (systemKey.current === selectedKey) systemKey.current = null
      setFixLoading(true)
      setFixError(null)
      getCuttingBatchFixOptions(ids, stockLengths, usedMachine)
        .then((res) => {
          if (cancelled) return
          setFixOpts(res)
          setFixKey(selectedKey)
          // Lần tải đầu: đợt tick sẵn (đơn gấp nhất) tự thêm các đơn gợi ý gộp - chỉ khi KHSX chưa đổi lựa chọn.
          const base = autoFill.current
          autoFill.current = null
          if (base && sameSet(new Set(ids), base) && res.addAllItemIds?.length) {
            const next = new Set([...ids, ...res.addAllItemIds])
            setRecommendedOverride(next)
            systemKey.current = keyOf(next)
            setSelected(next)
            // Đơn hệ thống tự thêm cũng ghim lên đầu cùng đơn tick sẵn (không phải KHSX tick tay nên không sợ dòng chạy khỏi con trỏ).
            setPinned(next)
          }
        })
        .catch((e) => { if (!cancelled) setFixError(errMsg(e, 'Không tính được cách xử lý cho đợt này')) })
        .finally(() => { if (!cancelled) setFixLoading(false) })
    }, bySystem ? 0 : 500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [selectedKey, stockLengths, usedMachine])

  useEffect(() => {
    getCuttingDefaults()
      .then(setDefaults)
      .catch(() => { /* không chặn màn nếu chỉ đọc số mặc định lỗi */ })
  }, [])

  useEffect(() => {
    getWorkshops()
      .then(setWorkshops)
      .catch(() => { /* không đọc được danh sách xưởng thì ô chọn xưởng rỗng - nút Tính vẫn khoá (bắt buộc chọn xưởng) */ })
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
  const recommended = recommendedOverride ?? new Set(data?.recommendedItemIds ?? [])
  // 13/11/2026: SKU đã chọn lúc tải danh sách lên đầu bảng cho dễ tìm (xem `pinned`); phần còn lại giữ thứ tự cũ (sắp ổn định).
  const displayItems = useMemo(() => selectedFirst(items, (i) => pinned.has(i.productionInvoiceItemId)), [items, pinned])


  /** Mỗi QUY CÁCH đúng MỘT ô chọn, gom từ mọi SKU trong bảng (không đặt ô cạnh từng chip: một loại sắt nằm ở nhiều dòng SKU). */
  const materialsInTable = useMemo(() => collectMaterialsInTable(items), [items])

  /** Các quy cách ĐÃ đổi khỏi cây chuẩn - dòng tóm tắt chỉ nêu đúng mấy cái này. */
  const lenChanged = useMemo(
    () => materialsInTable.filter((m) => stockLengths[m.id] != null),
    [materialsInTable, stockLengths],
  )

  const overCount = items.filter((i) => i.materials.some((m) => m.overThreshold)).length

  // Chỉ loại sắt có >= 2 SKU trong tổ hợp cùng dùng mới CÓ THỂ hưởng lợi từ việc gộp; loại chỉ 1
  // SKU dùng thì số liệu y hệt cắt riêng, đưa thành dòng riêng chỉ làm loãng bảng.
  const sharedLines = (preview?.lines ?? []).filter((l) => l.contributingSkus.length >= 2)

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
  // "Đã có kết quả" chỉ đúng khi lượt tính cũng KHỚP máy + chế độ đang chọn - cùng tập SKU mà khác máy/chế độ thì kết quả cũ không phải thứ sẽ ra khi bấm Tính.
  // Máy hiệu lực = máy chọn riêng, không thì máy mặc định (chưa biết mặc định thì coi là khớp).
  const effectiveMachine = usedMachine ?? defaults?.solverMachine ?? null
  const currentSolveMatches = solves.some((sv) => {
    if (!sameItemSet(sv, [...selected])) return false
    const m = solveMachine(sv)
    if (effectiveMachine && m && m !== effectiveMachine) return false
    // Khác xưởng đang chọn = kết quả cũ không phải thứ sẽ ra khi bấm Tính (lượt cũ chưa có xưởng coi như khác khi đã chọn xưởng).
    if (String(sv.solverOptions?.workshopId ?? '') !== workshopId) return false
    return (sv.solverOptions?.solverMaxWastePctOverride != null) === (cutMode === 'ACCEPT_OVER')
  })

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
    if (!workshopId) return // nút đã khoá + có dòng nhắc "Chọn xưởng trước khi tính"; chặn thêm phòng khi gọi bằng đường khác
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
    // Điền máy THỰC SỰ đã dùng (BE ghi trên từng loại sắt) chứ không để "theo mặc định": Admin có thể đã đổi máy mặc định từ lúc đó,
    // mà KHSX chỉ muốn đổi chế độ thì không được vô tình đổi cả máy. Các loại sắt khác máy nhau (không nên xảy ra) thì dùng máy KHSX đã chọn.
    const usedMachines = new Set((solve.lines ?? []).map((l) => l.machine).filter((m): m is SolverMachine => !!m))
    setMachine(usedMachines.size === 1 ? [...usedMachines][0] : (o?.solverMachine ?? null))
    // Khôi phục xưởng đã tính (lượt cũ chưa có xưởng -> để trống, KHSX phải chọn lại).
    setWorkshopId(o?.workshopId ? String(o.workshopId) : '')
    // Điền lại ĐÚNG chế độ lượt đó đã dùng để KHSX chỉ việc đổi rồi Tính lại.
    setOverrideTouched(false)
    if (o?.solverMaxWastePctOverride != null) {
      setCutMode('ACCEPT_OVER')
      setOverrideReason(o.solverOverrideReason ?? '')
      setOverrideOpen(true)
    } else {
      setCutMode('AUTO')
      setOverrideReason('')
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
   *  Chiều dài cây đứng ĐỘC LẬP với chế độ cắt: chọn cắt trên cây 5.850 mm là quyết định kỹ thuật
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
    // Máy cắt đi kèm ở CẢ HAI chế độ; để theo mặc định thì không gửi gì (BE tự lấy SystemConfig.solverMachine).
    const machineOpt = usedMachine ? { solverMachine: usedMachine } : undefined
    // Xưởng BẮT BUỘC (nút Tính khoá khi chưa chọn) - đi kèm ở CẢ HAI chế độ.
    const workshopOpt = workshopId ? { workshopId } : undefined
    if (cutMode === 'ACCEPT_OVER') {
      return {
        solverMaxWastePctOverride: NO_CEILING_PCT,
        solverOverrideReason: overrideReason.trim(),
        // Đơn gấp LUÔN giữ đúng chiều dài đã định (2026-10-24): không chờ NCC cán cây riêng được, còn muốn dò chiều dài thì
        // đó là chế độ "Bình thường". Không trần hao hụt + khoá chiều dài = phương án hao hụt nhỏ nhất trên đúng cây đó.
        solverAllowCustomLength: false,
        ...lengths,
        ...timeLimit,
        ...machineOpt,
        ...workshopOpt,
      }
    }
    return lengths || timeLimit || machineOpt || workshopOpt ? { ...lengths, ...timeLimit, ...machineOpt, ...workshopOpt } : undefined
  }

  /** Luật số cỡ đoạn/cây của xưởng đang chọn (nếu có) - khối Đợt đang chọn và khung Cài đặt cùng dùng. */
  const workshopMaxSizes = selectedWorkshop ? defaults?.solverMaxSizesPerBarByWorkshop?.[selectedWorkshop.code] : undefined
  const hasWsRule = selectedWorkshop != null && workshopMaxSizes != null
  /** Cây chuẩn đang dùng để cảnh báo (tiêu đề cột, khối gợi ý) - lấy từ cấu hình, chưa có thì 6.000 mm. */
  const stdLenMm = defaults?.solverStockLengths?.[0] ?? DEFAULT_STOCK_LENGTH_MM
  const stdLenLabel = fmtBarMm(stdLenMm)
  const toggleKey = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })

  // Ô loại sắt của 1 dòng SKU (bảng + thẻ điện thoại): CHỈ hiện loại có cảnh báo / chưa kiểm; loại đạt gom "✓ n loại đạt" (bấm mới
  // mở). Gợi ý "gộp với đơn nào" KHÔNG còn ở đây (lặp ở mọi dòng dùng chung sắt) - xem warnPanel (2026-10-24).
  const materialsCell = (it: CuttingBatchCandidate) => {
    if (!it.hasActiveBom) {
      return (
        <span style={{ fontSize: 12, color: 'var(--fg-b45309)' }}>
          Chưa có định mức đang áp dụng — không tính được
        </span>
      )
    }
    const flagged = it.materials.filter((m) => chipStatus(m) !== 'ok')
    const ok = it.materials.filter((m) => chipStatus(m) === 'ok')
    const open = okOpen.has(it.productionInvoiceItemId)
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {flagged.map((m) => <MaterialChip key={m.materialId} m={m} checking={deepVerifying} />)}
        {open && ok.map((m) => <MaterialChip key={m.materialId} m={m} checking={false} />)}
        {ok.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            onClick={(e) => { e.stopPropagation(); toggleKey(setOkOpen, it.productionInvoiceItemId) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', minHeight: isMobile ? 32 : undefined, fontSize: 11, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-166534)' }}
          >
            {open ? <>Ẩn loại đạt <ChevronUp size={12} /></> : <><Check size={12} /> {ok.length} loại đạt <ChevronDown size={12} /></>}
          </button>
        )}
      </div>
    )
  }

  // ── Khối "Đợt đang chọn": gộp chỉ để CỨU loại sắt vượt ngưỡng ở cây chuẩn mà không muốn chuyển đơn gấp. Luật gộp: mốc cần sắt cả
  // đợt trong khung N ngày tính cả ngày đầu, tối đa M SKU - FE kiểm ngay để khoá nút Tính, BE kiểm lại (cutting-batch-solve, merge).
  const mergeWindow = defaults?.solverMergeWindowDays ?? DEFAULT_MERGE_WINDOW_DAYS
  const mergeMax = defaults?.solverMergeMaxSkus ?? DEFAULT_MERGE_MAX_SKUS
  const selSpan = steelNeedSpan(
    selectedItems.map((i) => ({ code: i.salesOrderCode ? `${i.mfgProductCode} (${i.salesOrderCode})` : i.mfgProductCode, date: i.deadline })),
  )
  // Gợi ý cách xử lý chỉ dùng khi đã về ĐÚNG đợt đang tick.
  const freshFix = fixOpts !== null && fixKey === selectedKey ? fixOpts : null
  const ruleReason = buildRuleReason({
    beReason: freshFix?.ruleReason ?? null, selectedCount: selected.size, mergeMax, mergeWindow, span: selSpan,
  })
  const fixOverCount = splitFixMaterials(freshFix).over.length
  // Tiến độ kiểm: Y = tổng chip loại sắt trên bảng; X = số chip đã có kết quả (không còn "chưa kiểm").
  const chipTotal = items.reduce((n, it) => n + (it.hasActiveBom ? it.materials.length : 0), 0)
  const chipDone = items.reduce((n, it) => n + (it.hasActiveBom ? it.materials.filter((mm) => chipStatus(mm) !== 'unknown').length : 0), 0)
  const addItems = (ids: string[]) => setSelected((prev) => new Set([...prev, ...ids]))
  const goUrgent = () => {
    setCutMode('ACCEPT_OVER')
    setOverrideOpen(true)
    setTimeout(() => cutModeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }
  // Tên SKU đang chọn ngay ở tiêu đề: tối đa 3 mã, quá thì "+N", title hiện đủ. Theo thứ tự đang hiện trên bảng.
  const selectedCodes = summarizeCodes(displayItems.filter((i) => selected.has(i.productionInvoiceItemId)).map((i) => i.mfgProductCode), 3)
  const batchPanel = selected.size >= 1 && (
    <FixOptionsPanel
      panelRef={batchPanelRef} isMobile={isMobile} items={items} selectedCount={selected.size} selectedCodes={selectedCodes}
      selDates={selectedItems.map((i) => i.deadline).filter((d): d is string => !!d).sort()}
      mergeWindow={mergeWindow} mergeMax={mergeMax} loading={fixLoading} error={fixError} fix={freshFix} ruleReason={ruleReason}
      deadItems={deadItems} daysEarlyOf={daysEarlyOf} cutMode={cutMode} stdLenMm={stdLenMm} hasWsRule={hasWsRule}
      workshopName={selectedWorkshop?.name} onToggleItem={toggle} onAddItems={addItems} onGoUrgent={goUrgent}
    />
  )

  /** Máy cắt của đợt: 3 lựa chọn. "Theo mặc định" ghi rõ máy mặc định hiện tại (Admin đổi được) để KHSX khỏi phải nhớ. */
  const defaultMachineLabel = defaults?.solverMachine ? MACHINE_LABEL[defaults.solverMachine] : null

  // Thông số máy cắt hiện tại, KHSX CHỈ XEM (đóng sẵn): thông số của ĐÚNG máy sẽ dùng cho đợt (máy chọn riêng, không thì máy mặc định).
  const paramsMachine: SolverMachine = usedMachine ?? defaults?.solverMachine ?? 'laser'
  const machineParams = buildMachineParams(defaults, paramsMachine, (code) => workshops.find((w) => w.code === code)?.name)
  const machineParamsButton = machineParams && (
    <MachineParamsButton open={machineParamsOpen} isMobile={isMobile} onToggle={() => setMachineParamsOpen((v) => !v)} />
  )
  const machineParamsBody = machineParams && machineParamsOpen && (
    <MachineParamsBody
      params={machineParams} machine={paramsMachine} isDefaultMachine={!usedMachine}
      bundleEntries={bundleSpecEntriesOf(defaults)} isMobile={isMobile}
    />
  )
  /** Nút "Tính phương án cắt". Khoá khi: đang gửi yêu cầu, đúng tổ hợp này ĐANG tính (bấm nữa chỉ bị
   *  BE chặn 409), hoặc chưa chọn SKU (đề nghị đặc cách thiếu thì chặn lúc bấm, kèm lỗi ngay chỗ cần điền). (Đang lưu ô hao hụt KHÔNG khoá nút: khoá giữa mousedown và mouseup làm mất click; handleSolve tự chờ lưu xong.) */
  const solveDisabled = solving || currentCalculating || merging || selected.size === 0 || ruleReason !== null || !workshopId
  const solveButton = (
    <button
      onClick={handleSolve}
      disabled={solveDisabled}
      title={ruleReason ?? (!workshopId ? 'Chọn xưởng trước khi tính' : undefined)}
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

  const cutModeDetail = (
    <CutModeDetail
      overrideNeeded={overrideNeeded} open={showOverride} stdLenLabel={stdLenLabel} cutMode={cutMode}
      onCutMode={(m) => { setCutMode(m); setOverrideTouched(false) }}
      reason={overrideReason} onReason={setOverrideReason} touched={overrideTouched}
      reasonMissing={reasonMissing} invalid={overrideInvalid} suggestedPct={suggestedPct} suggestedDriver={suggestedDriver}
      reasonBoxRef={overrideBoxRef}
    />
  )

  // Khung "Cài đặt đợt tính": MỘT hàng ô, xưởng đứng trước máy cắt (xưởng quyết định máy). Chi tiết ở ./gomDotCat/SettingsPanel.
  const settingsPanel = (
    <SettingsPanel
      panelRef={cutModeRef} isMobile={isMobile}
      workshops={workshops} workshopId={workshopId} onWorkshop={setWorkshopId}
      selectedWorkshop={selectedWorkshop} workshopMaxSizes={workshopMaxSizes} selectedCount={selected.size}
      usedMachine={usedMachine} forcedMachine={forcedMachine} defaultMachine={defaults?.solverMachine} onMachine={setMachine}
      maxWastePct={defaults?.solverMaxWastePercentage}
      modeText={cutMode === 'ACCEPT_OVER' ? 'Chấp nhận hao hụt cao hơn' : 'Bình thường'}
      modeOpen={showOverride} onToggleMode={() => setOverrideOpen((v) => !v)} overrideNeeded={overrideNeeded}
      helpOpen={settingsHelpOpen} onToggleHelp={() => setSettingsHelpOpen((v) => !v)}
      lengthOpen={lenOpen} onToggleLength={() => setLenOpen((v) => !v)}
      length={{
        materials: materialsInTable, changed: lenChanged, lengths: stockLengths, inputs: stockLenInput,
        onInput: (id, v) => setStockLenInput((prev) => ({ ...prev, [id]: v })), onReset: () => setStockLenInput({}),
      }}
      machineParamsButton={machineParamsButton} machineParamsBody={machineParamsBody} cutModeDetail={cutModeDetail}
    />
  )

  // Chữ thanh dưới cùng (hàm thuần ở gomDotCatUi.ts): "2 SKU · Xưởng Phước An · MC Tự động · Bình thường" + MỘT cụm trạng thái.
  const barSummary = buildBarSummary({
    count: selected.size,
    workshopName: selectedWorkshop?.name ?? null,
    machineLabel: usedMachine ? MACHINE_LABEL[usedMachine] : (defaultMachineLabel ?? 'Máy mặc định'),
    cutMode,
  })
  const barStatus = buildBarStatus({
    workshopChosen: !!workshopId,
    reasonMissing: overrideTouched && overrideInvalid,
    ruleBlocked: ruleReason !== null,
    overCount: fixOverCount,
    hasMatchingResult: currentSolveMatches,
    hasOtherResult: currentSolve != null,
  })
  const barStatusColor = barStatus.tone === 'red' ? 'var(--fg-b91c1c)' : barStatus.tone === 'amber' ? 'var(--fg-92400e)' : 'var(--text2)'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ ...pageTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={20} color="var(--fg-e65100)" /> Tối ưu cắt sắt
          </h2>
          <div style={{ ...pageSubtitle, marginTop: 4 }}>
            Chọn các SKU muốn cắt chung một đợt để bớt số cây sắt phải mua. Chỉ gồm SKU{' '}
            <b title="Sếp duyệt rồi thì đã chốt phương án cắt riêng, không gộp được nữa.">Sếp chưa duyệt</b>.
          </div>
        </div>
        <button onClick={load} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0 }}>
          <RefreshCw size={14} /> Tải lại
        </button>
      </div>

      <RecheckBanner items={recheck} isMobile={isMobile} ask={ask} onChanged={onRecheckChanged} />

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

      {loading && !data && tab === 'choose' && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Đang tải…</div>}
      {error && (
        <div style={{ background: 'var(--bg-fee2e2)', border: '1px solid var(--fg-fca5a5)', color: 'var(--fg-991b1b)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {tab === 'choose' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--bg-eff6ff)', border: '1px solid var(--fg-bfdbfe)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--fg-1e40af)' }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Chip loại sắt = <b>hao hụt khi SKU cắt riêng ở cây chuẩn {stdLenLabel}</b>: <b style={{ color: 'var(--fg-166534)' }}>xanh</b> = đạt,{' '}
            <b style={{ color: 'var(--fg-b91c1c)' }}>đỏ</b> = vượt ngưỡng, <b>xám</b> = chưa kiểm. Số trên chip: <b>0,30%</b> = bộ giải đã kiểm ·{' '}
            <b>≥10,00%</b> = ước tính tối thiểu, chưa kiểm · <b>&gt;1%</b> = chắc chắn vượt. Số thật có sau khi bấm <b>Tính phương án cắt</b>.
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
            {recommended.size > 0 && (
              <>
                Hệ thống đề xuất gộp <b>{recommended.size}</b> SKU
                {sameSet(selected, recommended) ? ' — đang chọn đúng đề xuất.' : ' — '}
                {!sameSet(selected, recommended) && (
                  // 1 chạm quay về đúng tổ hợp hệ thống đề xuất (bỏ hết tick tay) - người dùng 2026-10-24.
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(recommended))}
                    style={{
                      ...outlineBtn(isMobile, 'var(--fg-1e40af)'), minHeight: isMobile ? 40 : 26, padding: '2px 9px', verticalAlign: 'middle',
                    }}
                  >
                    <RefreshCw size={12} /> Chọn lại đề xuất
                  </button>
                )}
              </>
            )}
          </div>

          {/* Cài đặt đợt tính: một khung, một hàng (xưởng đứng trước máy cắt vì xưởng quyết định máy). */}
          {settingsPanel}

          {/* Đổi máy / chiều dài cây thì BE tính lại cả bảng (có thể vài giây): làm mờ bảng + nói rõ đang tính lại, không để số ước tính
              của cấu hình cũ nằm đó như thể còn đúng. */}
          {loading && data && (
            <div role="status" style={{ fontSize: 12.5, color: 'var(--fg-92400e)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={13} className="spin" /> Đang tính lại số ước tính theo {usedMachine ? MACHINE_LABEL[usedMachine] : (defaultMachineLabel ?? 'cài đặt mới')}…
            </div>
          )}
          {deepVerifying && !loading && (
            <div role="status" style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={13} className="spin" style={{ flexShrink: 0 }} />
              <span>Đang kiểm các loại sắt “chưa kiểm” bằng bộ giải — chip tự cập nhật, vẫn chọn SKU bình thường.</span>
              {chipTotal > 0 && (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  Đã kiểm <b>{chipDone}/{chipTotal}</b> loại sắt
                  <span aria-hidden="true" style={{ display: 'inline-block', width: 80, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.round((chipDone / chipTotal) * 100)}%`, background: 'var(--fg-15803d)', transition: 'width .3s' }} />
                  </span>
                </span>
              )}
            </div>
          )}
          {batchPanel}
          <div aria-busy={loading} style={{ opacity: loading && data ? 0.5 : 1, transition: 'opacity .15s' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayItems.map((it: CuttingBatchCandidate) => {
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
                        <MaterialChoiceTags wire={it.wireMaterial} cushion={it.cushionMaterial} />
                        {recommended.has(it.productionInvoiceItemId) && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'var(--bg-dbeafe)', color: 'var(--fg-1e40af)', whiteSpace: 'nowrap' }}>ĐỀ XUẤT</span>
                        )}
                        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', color: 'var(--text2)' }}>SL {it.quantity}</span>
                      </div>
                      {it.mfgProductName && <div style={{ color: 'var(--text2)', marginTop: 2, wordBreak: 'break-word' }}>{it.mfgProductName}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{it.salesOrderCode ?? it.productionInvoiceCode ?? '—'}{approvalLabel(it.prodApprovalStatus) && ` · ${approvalLabel(it.prodApprovalStatus)}`}</span>
                        <span>Hạn {fmtDate(it.deadline ?? it.deliveryDate ?? null)}{!it.deadline && it.deliveryDate && <span style={{ fontSize: 10, color: 'var(--text3)' }}> hạn giao</span>}</span>
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
                  <th style={TH}>Loại sắt · hao hụt khi cắt riêng ở cây chuẩn {stdLenLabel}</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((it: CuttingBatchCandidate) => {
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
                        {/* Mã đơn dài vẫn 1 dòng, quá thì cắt "…" (title hiện đủ) - trước đây xuống 3 dòng. */}
                        <div title={it.salesOrderCode ?? it.productionInvoiceCode ?? undefined} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it.salesOrderCode ?? it.productionInvoiceCode ?? '—'}
                        </div>
                        {approvalLabel(it.prodApprovalStatus) && (
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{approvalLabel(it.prodApprovalStatus)}</div>
                        )}
                      </td>
                      <td style={TD}>
                        <b style={{ whiteSpace: 'nowrap', marginRight: 6 }}>{it.mfgProductCode}</b>
                        <MaterialChoiceTags wire={it.wireMaterial} cushion={it.cushionMaterial} />
                        {recommended.has(it.productionInvoiceItemId) && (
                          <span style={{ display: 'inline-block', marginTop: 2, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'var(--bg-dbeafe)', color: 'var(--fg-1e40af)', whiteSpace: 'nowrap' }}>
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
                        {fmtDate(it.deadline ?? it.deliveryDate ?? null)}
                        {/* Chưa có hạn khung thì hiện hạn giao của đơn để KHSX biết đơn nào gấp. */}
                        {!it.deadline && it.deliveryDate && (
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>hạn giao</div>
                        )}
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
          </div>
        </>
      )}

      {/* Thanh hành động CỐ ĐỊNH ở đáy: luôn thấy nút Tính dù bảng SKU dài. Chỉ gồm tóm tắt + nút - mọi cài đặt ở đầu trang.
          13/11/2026: máy tính = MỘT hàng, chữ bên trái (flex 1, tối đa 2 dòng), nút luôn bên phải, không rớt xuống dưới.
          Điện thoại: 1 dòng tóm tắt + 1 dòng trạng thái (đều cắt "…") + nút rộng hết, thanh cao ~130 px. */}
      {tab === 'choose' && selected.size >= 1 && (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 5, marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: isMobile ? '8px 12px' : '10px 14px', boxShadow: '0 -4px 14px rgba(0,0,0,0.14)' }}>
          <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 6 } : { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'nowrap' }}>
            <div
              title={`${barSummary} · ${barStatus.text}`}
              style={isMobile
                ? { minWidth: 0, fontSize: 12.5, color: 'var(--text2)' }
                : { flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              <div style={isMobile ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : { display: 'inline' }}>
                <b style={{ color: 'var(--text)' }}>{barSummary}</b>
              </div>
              {!isMobile && ' · '}
              <div style={isMobile ? { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } : { display: 'inline' }}>
                <span style={{ color: barStatusColor, fontWeight: barStatus.tone === 'muted' ? 400 : 600, ...(isMobile ? { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}) }}>
                  {barStatus.text}
                </span>
                {barStatus.fixLink && (
                  <>
                    {!isMobile && ' '}
                    <button type="button" onClick={() => batchPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ padding: 0, flexShrink: 0, border: 'none', background: 'none', color: 'var(--fg-1e40af)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', minHeight: isMobile ? 24 : undefined }}>
                      Xem cách xử lý
                    </button>
                  </>
                )}
              </div>
            </div>
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
          workshops={workshops}
        />
      )}
      {confirmModal}
    </div>
  )
}
