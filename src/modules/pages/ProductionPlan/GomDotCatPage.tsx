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
 * "Xác nhận gộp" (>= 2 SKU) tạo 1 lệnh sản xuất chứa đúng các SKU đó rồi chuyển sang màn "Lệnh sản
 * xuất mới". Chọn đúng 1 SKU thì KHÔNG gộp gì cả - nó vốn đã có lệnh sản xuất riêng, chỉ việc đi
 * tiếp luồng thường. Solver KHÔNG chạy ở màn này: phương án cắt chỉ tính khi Sếp duyệt.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Info, Layers, Loader2, RefreshCw, Settings } from 'lucide-react'
import {
  claimSoloCuttingBatch,
  getCuttingBatchCandidates,
  mergeCuttingBatch,
  previewCuttingBatch,
  type CuttingBatchCandidate,
  type CuttingBatchCandidateList,
  type SolverOverrideInput,
  type CuttingBatchPreview,
  type StockLengthsByMaterial,
} from '../../../services/cutting-batch-api'
import { errMsg } from '../../../utils/errors'
import { useIsMobile } from '../../../hooks/useMediaQuery'

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
    desc: 'Cây chuẩn nào đạt ngưỡng thì chốt luôn; không cây nào đạt thì tự dò thêm chiều dài khác rồi mới đặt. Không đạt nữa thì dừng chờ duyệt tay.',
  },
  {
    value: 'ACCEPT_OVER',
    label: 'Chấp nhận hao hụt cao hơn (đơn gấp)',
    desc: 'Xin Sếp duyệt một mức hao hụt cao hơn ngưỡng thường cho riêng đợt này. Vượt cả mức đã xin thì hệ thống vẫn chặn.',
  },
]

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
 * Material.maxCuttingWastePercentage ?? SystemConfig mặc định) - KHÔNG hard-code một mốc % cố
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
        background: over ? '#fee2e2' : '#e8f5e9',
        color: over ? '#b91c1c' : '#166534',
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<CuttingBatchPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [merging, setMerging] = useState(false)
  // Chế độ cắt KHSX đề nghị cho ĐÚNG đợt sắp tạo - Sếp chấp thuận bằng chính nút Duyệt lệnh SX.
  // Giữ % dạng chuỗi để ô nhập rỗng được (0 và "chưa nhập" là 2 chuyện khác nhau).
  const [cutMode, setCutMode] = useState<CutMode>('AUTO')
  const [wastePct, setWastePct] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [onlyStandardLength, setOnlyStandardLength] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
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
  // tối thiểu) cho mọi lần gộp/cắt riêng, không cần KHSX biết khái niệm này tồn tại. Solver chạy
  // NỀN sau khi Sếp duyệt (fire-and-forget, xem runSolverAndSave) nên thời gian giải lâu hơn
  // KHÔNG làm KHSX phải chờ gì cả - chỉ ảnh hưởng lúc Sếp mở lại xem kết quả.

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
  const autoTimeLimitSeconds =
    data && selectedMaterialCount > 0
      ? Math.max(1, Math.floor(data.solverTimeoutSeconds / selectedMaterialCount))
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
   * Chốt nhóm. Chỉ TẠO PI - không chạy solver ở đây: phương án cắt được tính khi Sếp duyệt cả cụm
   * (đúng luồng duyệt sẵn có). Xong thì chuyển thẳng sang màn "Lệnh sản xuất mới" vì đó là nơi
   * KHSX làm bước tiếp theo (đặt thời hạn rồi gửi duyệt) - để KHSX tự đi tìm là thừa một bước.
   */
  const handleConfirm = () => {
    setMerging(true)
    setError(null)
    mergeCuttingBatch([...selected], solverOverride())
      .then(() => onDone?.())
      .catch((e) => setError(errMsg(e, 'Không gộp được nhóm đã chọn')))
      .finally(() => setMerging(false))
  }

  /**
   * "Tạo lệnh sản xuất riêng cho SKU này" - đúng 1 SKU, không gộp gì cả. 2026-08-20: PI không còn tự sinh sẵn lúc
   * Sales tạo PO nên đây KHÔNG còn là no-op - phải tạo thật 1 PI riêng cho SKU này mới đi tiếp
   * được sang "Lệnh sản xuất mới" (xem claimSoloCuttingBatch()).
   */
  const handleClaimSolo = () => {
    const [itemId] = selected
    if (!itemId) return
    setMerging(true)
    setError(null)
    claimSoloCuttingBatch(itemId, solverOverride())
      .then(() => onDone?.())
      .catch((e) => setError(errMsg(e, 'Không tạo được lệnh sản xuất cho SKU này')))
      .finally(() => setMerging(false))
  }

  /**
   * Khối "đề nghị cắt đặc cách" dùng chung cho cả 2 nút bên dưới (gộp >=2 SKU / cắt riêng 1 SKU).
   *
   * CHỈ hiện khi thật sự vướng — đạt ngưỡng rồi thì không có gì để xin, bày ra chỉ tổ mời người ta
   * nới ngưỡng vô cớ. Đã gộp thì tin `preview` (gộp có cứu được không) chứ không tin số cắt riêng
   * của từng SKU; chưa gộp thì mới đọc cờ overThreshold của chính SKU đó.
   */
  const overrideNeeded = preview
    ? preview.lines.some((l) => !l.meetsThreshold)
    : items.some((i) => selected.has(i.productionInvoiceItemId) && i.materials.some((m) => m.overThreshold))
  const showOverride = overrideOpen || overrideNeeded

  /**
   * Mức hao hụt tối thiểu cần xin, suy từ chính số đang hiện trên màn: loại sắt vướng nhất trong
   * tổ hợp đang chọn. Làm tròn LÊN 0.1% cho dễ đọc.
   *
   * Số này là CẬN DƯỚI ở CÂY CHUẨN (xem chú thích đầu file) nên chỉ là gợi ý, không phải cam kết:
   * - Không cấm đặt cây riêng → solver có thể tìm được cây lạ hao ít hơn nhiều, xin thừa cũng
   *   không sao nhưng dễ vô tình bao luôn loại sắt khác.
   * - Cấm đặt cây riêng → đây gần đúng là con số thật sự phải xin.
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

  const wastePctNum = Number(wastePct)
  const wastePctBad = !(Number.isFinite(wastePctNum) && wastePctNum > 0 && wastePctNum <= 100)
  /** Xin thấp hơn cả cận dưới thì gần như chắc chắn vẫn bị chặn - cảnh báo, KHÔNG cấm (còn tuỳ
   *  solver có được dò cây riêng hay không). */
  const wastePctTooLow = !wastePctBad && suggestedPct != null && wastePctNum < suggestedPct
  // BE bắt buộc lý do khi có ngưỡng đặc cách - chặn luôn ở đây để KHSX không phải ăn lỗi 400.
  const reasonMissing = overrideReason.trim() === ''
  const overrideInvalid = cutMode === 'ACCEPT_OVER' && (wastePctBad || reasonMissing)

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
    // Độc lập với cutMode/chiều dài cây - thuần ngân sách thời gian tính toán, không phải quyết
    // định nghiệp vụ, nên đi kèm ở CẢ 2 chế độ như `lengths` ở trên. LUÔN tự tính, không chờ KHSX
    // nhập gì (xem autoTimeLimitSeconds ở trên).
    const timeLimit =
      autoTimeLimitSeconds != null ? { solverTimeLimitSecondsOverride: autoTimeLimitSeconds } : undefined
    if (cutMode === 'ACCEPT_OVER') {
      return {
        solverMaxWastePctOverride: wastePctNum,
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
      <span style={{ fontSize: 12, color: '#b45309' }}>
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
          <div key={m.materialId} style={{ fontSize: 11, marginTop: 4, color: m.mergeableWithSkus.length ? 'var(--text2)' : '#b45309' }}>
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

  const cutModePanel = (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setOverrideOpen((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12.5, fontWeight: 600, background: 'var(--surface2)', border: `1px solid ${overrideNeeded ? '#fcd34d' : 'var(--border)'}`, borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text2)' }}
        >
          <Settings size={14} />
          Chế độ cắt: {cutMode === 'ACCEPT_OVER' ? 'Chấp nhận hao hụt cao hơn' : 'Bình thường'}
          {showOverride ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {overrideNeeded && !showOverride && (
        <div style={{ marginTop: 6, display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, color: '#92400e' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Đợt này <b>vượt ngưỡng hao hụt</b> — mở chế độ cắt để xử lý, nếu không sẽ dừng chờ duyệt tay.</span>
        </div>
      )}

      {showOverride && (
        <div style={{ marginTop: 8, padding: '11px 13px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {overrideNeeded && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Đợt này <b>vượt ngưỡng hao hụt</b> nên sẽ dừng chờ duyệt tay. Đơn gấp thì chọn <b>“Chấp nhận hao hụt cao hơn”</b> — Sếp duyệt lệnh sản xuất là chấp thuận luôn.</span>
            </div>
          )}

          {CUT_MODES.map((m) => {
            const active = cutMode === m.value
            return (
              <label
                key={m.value}
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 'var(--radius)', cursor: 'pointer', border: `1px solid ${active ? '#e65100' : 'var(--border)'}`, background: active ? 'rgba(230,81,0,0.06)' : 'var(--surface)' }}
              >
                <input
                  type="radio"
                  name="cutMode"
                  checked={active}
                  onChange={() => {
                    setCutMode(m.value)
                    // Chọn "chấp nhận hao cao hơn" thì điền sẵn luôn mức tối thiểu cần - tránh
                    // đúng thói quen gõ số tròn cho chắc (vd 10%), vì con số này là TRẦN áp cho
                    // MỌI loại sắt trong đợt, xin thừa là vô tình duyệt luôn loại khác.
                    if (m.value === 'ACCEPT_OVER') {
                      setOnlyStandardLength(true)
                      if (wastePct.trim() === '' && suggestedPct != null) {
                        setWastePct(String(suggestedPct))
                      }
                    }
                  }}
                  // Ghim kích thước: để trình duyệt tự co giãn thì ở khung hẹp nút radio phình to
                  // bằng cả dòng (lỗi đã gặp ở bản trước).
                  style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1, accentColor: '#e65100' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{m.desc}</div>
                </div>
              </label>
            )
          })}

          {cutMode === 'ACCEPT_OVER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '9px 11px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text2)' }}>
                Chấp nhận hao hụt tới

                <input
                  value={wastePct}
                  onChange={(e) => setWastePct(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  inputMode="decimal"
                  placeholder="—"
                  style={{ width: 62, padding: '5px 8px', fontSize: 12.5, textAlign: 'right', border: `1px solid ${wastePctBad ? '#dc2626' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}
                />
                %
                {suggestedPct != null && (
                  <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                    (ước tính cần ≥{suggestedPct}%{suggestedDriver ? ` — do ${suggestedDriver}` : ''})
                  </span>
                )}
              </label>
              {wastePctTooLow && (
                <div style={{ fontSize: 11.5, color: '#b45309' }}>
                  Thấp hơn mức ước tính — nhiều khả năng vẫn bị chặn nếu không cho đặt cây riêng.
                </div>
              )}
              {/* Trước 2026-09-16 nhãn ghi "Chỉ mua cây chuẩn" - đúng khi chiều dài luôn là cây
                  chuẩn. Từ khi có ô chọn chiều dài riêng theo quy cách (thanh phía trên), tick này
                  có thể đang GIỮ một cây RIÊNG (vd 5850) chứ không phải ép về cây chuẩn - "khỏi
                  chờ nhà cung cấp cán cây riêng" thành sai nghĩa ngay lúc đó. Câu mới không giả
                  định cây nào, và khớp NGUYÊN VĂN với callout Sếp đọc lúc duyệt
                  (solverOverrideNote() trong LenhSXPage.tsx) - Sếp phải thấy đúng y chang thứ
                  KHSX vừa tick, không phải một cách diễn đạt khác đi. */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text2)' }}>
                <input
                  type="checkbox"
                  checked={onlyStandardLength}
                  onChange={(e) => setOnlyStandardLength(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 15, height: 15, flexShrink: 0, accentColor: '#e65100' }}
                />
                Giữ đúng chiều dài đã định, không cho hệ thống tự dò cây khác
              </label>
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Lý do để Sếp duyệt — vd: PO-4 giao gấp, không kịp chờ cán cây riêng"
                style={{ width: '100%', padding: '6px 9px', fontSize: 12.5, border: `1px solid ${reasonMissing ? '#dc2626' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}
              />
              {overrideInvalid && (
                <div style={{ fontSize: 12, color: '#b91c1c' }}>
                  {wastePctBad
                    ? 'Mức hao hụt phải là số trong khoảng 0–100%.'
                    : 'Nhập lý do thì Sếp mới có căn cứ duyệt.'}
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
          <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={19} color="#e65100" /> Tối ưu cắt sắt
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            Chọn các SKU muốn cắt chung một đợt để bớt số cây sắt phải mua. Chỉ gồm SKU{' '}
            <b>Sếp chưa duyệt</b> — duyệt rồi thì phương án cắt đã chạy riêng, không gộp được nữa.
          </div>
        </div>
        <button onClick={load} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0 }}>
          <RefreshCw size={14} /> Tải lại
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius)', padding: '9px 12px', margin: '12px 0 14px', fontSize: 12, color: '#1e40af' }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Loại sắt kèm dấu <b>≥</b> là ước tính nhanh, <b>chưa xác minh với solver</b> — con số tốt
          nhất về lý thuyết, giả định có đủ số lượng để lặp lại đúng kiểu cắt tối ưu ở mọi cây; số
          lượng thật ít thì cây cuối không đủ đoạn để lặp kiểu đó, nên hao hụt thật có thể cao hơn.
          Loại KHÔNG kèm dấu ≥ là số thật đã xác minh với solver, không còn giả định này. Dùng để so
          sánh phương án, không phải cam kết kết quả. Dấu <b style={{ color: '#854d0e' }}>?</b> cạnh
          % nghĩa là số lượng quá ít (dưới 3 cây) để ước tính đó còn đáng tin — chỉ hoàn toàn dựa
          vào nó để quyết định.
        </span>
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Đang tải…</div>}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
          Không có SKU nào đang chờ duyệt — không có gì để gộp.
        </div>
      )}

      {items.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
            {overCount > 0
              ? <><b style={{ color: '#b91c1c' }}>{overCount}</b> SKU có loại sắt vượt ngưỡng hao hụt. </>
              : <>Không SKU nào vượt ngưỡng. </>}
            {recommended.size > 0 && <>Hệ thống đề xuất gộp <b>{recommended.size}</b> SKU — đã tick sẵn, sửa được.</>}
          </div>

          {/* Chiều dài cây theo TỪNG QUY CÁCH. Đổi ô nào thì mọi con số của đúng loại sắt đó
              trong bảng tính lại, các loại khác không đụng tới. */}
          {/* Chiều dài cây theo TỪNG QUY CÁCH.
              Đóng lại thành 1 dòng khi không có gì đặc biệt: cây chuẩn là ca gần như luôn xảy ra
              nên nó phải tốn ĐÚNG 1 dòng chữ, không phải một dãy ô nhập. Mở ra chỉ khi thật sự
              cần đổi. Dòng tóm tắt chỉ nêu NGOẠI LỆ - 10 loại sắt đổi 1 thì vẫn gọn 1 dòng. */}
          {materialsInTable.length > 0 && (
            <div style={{ padding: '8px 11px', marginBottom: 8, background: 'var(--surface)', border: `1px solid ${lenChanged.length > 0 ? '#fcd34d' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)' }}>
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
                          style={{ width: 78, padding: '4px 8px', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: changed ? 700 : 400, border: `1px solid ${bad ? '#dc2626' : changed ? '#e65100' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text)' }}
                        />
                      </Fragment>
                    )
                  })}
                  <span style={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'var(--text3)' }}>
                    Bỏ trống = cây chuẩn {fmtLen(DEFAULT_STOCK_LENGTH_MM)}.
                  </span>
                  {materialsInTable.some((m) => stockLenBad(m.id)) && (
                    <span style={{ gridColumn: '1 / -1', fontSize: 11.5, color: '#b91c1c' }}>
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
                    style={{ padding: '11px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start', background: isSel ? '#f0fdf4' : undefined, borderColor: isSel ? '#86efac' : undefined }}
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
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: '#dbeafe', color: '#1e40af' }}>ĐỀ XUẤT</span>
                        )}
                        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', color: 'var(--text2)' }}>SL {it.quantity}</span>
                      </div>
                      {it.mfgProductName && <div style={{ color: 'var(--text2)', marginTop: 2, wordBreak: 'break-word' }}>{it.mfgProductName}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{it.salesOrderCode ?? it.productionInvoiceCode ?? '—'}{approvalLabel(it.prodApprovalStatus) && ` · ${approvalLabel(it.prodApprovalStatus)}`}</span>
                        <span>Hạn {fmtDate(it.deadline)}</span>
                        {isSel && selected.size >= 2 && daysEarlyOf(it) > 0 && (
                          <span style={{ color: '#b45309' }}>sớm {daysEarlyOf(it)} ngày</span>
                        )}
                      </div>
                      {it.rejectReason && (
                        <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4, display: 'flex', gap: 4, alignItems: 'flex-start' }}>
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
                      style={{ cursor: 'pointer', background: isSel ? '#f0fdf4' : undefined }}
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
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: '#dbeafe', color: '#1e40af' }}>
                            ĐỀ XUẤT
                          </span>
                        )}
                      </td>
                      <td style={{ ...TD, color: 'var(--text2)' }}>
                        {it.mfgProductName ?? '—'}
                        {/* SKU quay lại đây sau khi Sếp bác một đợt gộp - phải nói rõ VÌ SAO, nếu
                            không KHSX rất dễ gộp lại đúng tổ hợp vừa bị bác. */}
                        {it.rejectReason && (
                          <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3, display: 'flex', gap: 4, alignItems: 'flex-start' }}>
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
                          <div style={{ fontSize: 11, color: '#b45309' }}>sớm {daysEarlyOf(it)} ngày</div>
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

      {selected.size >= 2 && (
        <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14, flex: '1 1 auto' }}>Nếu gộp {selected.size} SKU đã chọn</b>
            {previewing && <Loader2 size={15} className="spin" color="var(--text3)" />}
            {preview && (
              <>
                <span style={{ fontSize: 15, fontWeight: 700, color: preview.totalBarsSaved > 0 ? '#166534' : 'var(--text3)' }}>
                  {preview.totalBarsSaved > 0 ? `Bớt ${preview.totalBarsSaved} cây sắt` : 'Không bớt được cây nào'}
                </span>
                {preview.daysCutEarly !== null && preview.daysCutEarly > 0 && (
                  <span style={{ fontSize: 12, color: '#b45309' }}>
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
              <div key={it.productionInvoiceItemId} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 14px', background: '#fffbeb', borderBottom: '1px solid var(--border)', fontSize: 12.5, color: '#92400e' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ flex: 1 }}>
                  <b>{it.mfgProductCode}</b> không dùng chung loại sắt nào với các SKU còn lại trong
                  nhóm — giữ lại <b>không bớt được cây nào</b>
                  {d > 0 && <>, mà vẫn phải <b>cắt sớm {d} ngày</b></>}.
                </span>
                <button
                  onClick={() => toggle(it.productionInvoiceItemId)}
                  style={{ flexShrink: 0, padding: '3px 9px', fontSize: 12, background: 'var(--surface)', border: '1px solid #fcd34d', borderRadius: 'var(--radius)', cursor: 'pointer', color: '#92400e', fontWeight: 600 }}
                >
                  Bỏ khỏi nhóm
                </button>
              </div>
            )
          })}

          {preview && sharedLines.length === 0 && (
            <div style={{ padding: '14px', fontSize: 13, color: '#b45309' }}>
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
                            thật chạy sau khi Sếp duyệt có thể cần nhiều hơn. Bỏ dấu ≥ ở đây là
                            biến con số tham khảo thành đơn đặt hàng. */}
                        <td style={NUM} title={`Cắt khéo nhất cũng cần ${l.minBars} cây ${l.materialCode} - phương án cắt thật (chạy sau khi Sếp duyệt) có thể cần nhiều hơn.`}>
                          ≥ {l.minBars}
                        </td>
                        <td style={NUM}>
                          <span title={isLowConfidence(l.minBars) ? `Chỉ ${l.minBars} cây - cận dưới này KHÔNG đáng tin (số lượng quá nhỏ để so sánh)` : undefined}>
                            ≥ {l.minWastePct.toFixed(2)}%
                            {isLowConfidence(l.minBars) && <span style={{ marginLeft: 3, fontWeight: 700, color: '#854d0e' }}>?</span>}
                          </span>
                          {l.meetsThreshold
                            ? <span style={{ marginLeft: 5, color: '#166534' }}><Check size={12} /></span>
                            : <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>vượt ngưỡng {l.thresholdPct}%</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ padding: '11px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            {cutModePanel}
            <button
              onClick={handleConfirm}
              disabled={previewing || !preview || merging || overrideInvalid}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 'var(--radius)', fontSize: 13,
                fontWeight: 600, color: '#fff', background: '#2e7d32',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                width: isMobile ? '100%' : undefined,
                cursor: previewing || !preview || merging || overrideInvalid ? 'not-allowed' : 'pointer',
                opacity: previewing || !preview || merging || overrideInvalid ? 0.5 : 1,
              }}
            >
              {merging && <Loader2 size={14} className="spin" />}
              Xác nhận gộp {selected.size} SKU
            </button>
          </div>
        </div>
      )}

      {/* Đúng 1 SKU: không có gì để gộp (lợi ích chỉ đến khi đoạn của NHIỀU SKU nằm chung một cây)
          - vẫn phải tạo PI riêng cho nó (claimSoloCuttingBatch), chỉ là không cần preview hao hụt
          vì không có gì để so sánh. */}
      {selected.size === 1 && (
        <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text2)', minWidth: isMobile ? 0 : 260 }}>
            Chọn 1 SKU thì không có gì để gộp — SKU này cắt riêng như bình thường. Chọn thêm ít nhất
            một SKU nữa (dùng chung loại sắt) mới bớt được cây.
          </div>
          {cutModePanel}
          <button
            onClick={handleClaimSolo}
            disabled={merging || overrideInvalid}
            style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, background: 'var(--surface2)', color: 'var(--text)', cursor: merging || overrideInvalid ? 'not-allowed' : 'pointer', opacity: merging || overrideInvalid ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, flexShrink: 0, width: isMobile ? '100%' : undefined }}
          >
            {merging && <Loader2 size={14} className="spin" />}
            Tạo lệnh sản xuất riêng cho SKU này
          </button>
        </div>
      )}
    </div>
  )
}
