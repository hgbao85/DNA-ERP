'use client'

/**
 * KHSX - tab "Kết quả đã tính" của màn "Tối ưu cắt sắt" (luồng "Solve trước → tạo lệnh
 * sản xuất", 2026-09-30).
 *
 * Solver chạy NGAY khi KHSX bấm "Tính phương án cắt", TRƯỚC khi có lệnh sản xuất nào. Khối này cho
 * KHSX xem tiến độ (đang tính bao lâu, đang giải loại sắt nào) và kết quả THẬT (số cây, chiều dài
 * cây, % hao hụt từng loại sắt), rồi mới tạo lệnh sản xuất từ chính phương án đó - QLSX/Sếp duyệt
 * đúng số này, solver không chạy lại sau khi duyệt.
 *
 * Nút "Tạo lệnh sản xuất" chỉ bật khi BE báo phương án dùng được (`invoiceReadiness.ready`): mọi
 * loại sắt cắt được, không vượt ngưỡng, và định mức/số lượng chưa đổi kể từ lúc tính. Không bật thì
 * nêu thẳng lý do BE trả về - KHSX biết phải chỉnh gì (gộp khác, xin đặc cách, tính lại).
 */

import { focusAttr } from '../../../utils/notificationLink'
import { Fragment, useEffect, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, ChevronUp, Loader2 } from 'lucide-react'
import type { CuttingBatchSolve, CuttingSolveLine } from '../../../services/cutting-batch-api'

const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
  textTransform: 'uppercase', color: 'var(--text3)', padding: '7px 10px',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const TD: React.CSSProperties = {
  padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'top',
}
const NUM: React.CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

/** 5850 -> "5m85", 6000 -> "6m" - người ở xưởng gọi cây sắt theo mét, không theo mm. */
function fmtLen(mm: number): string {
  const m = Math.floor(mm / 1000)
  const cm = Math.round((mm % 1000) / 10)
  return cm === 0 ? `${m}m` : `${m}m${String(cm).padStart(2, '0')}`
}

/** "3 phút 20 giây" - thời gian solve dao động rất lớn (vài giây tới hơn 15 phút tuỳ vật tư) nên
 *  phải nói tới giây, không làm tròn phút như chip cũ ở màn Admin. */
function fmtElapsed(fromIso: string, toMs: number): string {
  const sec = Math.max(0, Math.floor((toMs - new Date(fromIso).getTime()) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m} phút ${s} giây` : `${s} giây`
}

/** Tự đếm bằng interval riêng - số đúng dù danh sách cha chưa kịp tải lại. */
function ElapsedText({ requestedAt }: { requestedAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return <>{fmtElapsed(requestedAt, now)}</>
}

export function solveSkuCodes(s: CuttingBatchSolve): string {
  return [...new Set((s.items ?? []).map((i) => i.mfgProductCode))].join(', ') || '—'
}

export function solveOrderCodes(s: CuttingBatchSolve): string {
  return [...new Set((s.items ?? []).map((i) => i.salesOrderCode).filter((c): c is string => !!c))].join(', ')
}

/** Cùng tập SKU (không phân biệt thứ tự) - phương án chỉ dùng được cho ĐÚNG tổ hợp đã tính. */
export function sameItemSet(s: CuttingBatchSolve, ids: string[]): boolean {
  const own = (s.items ?? []).map((i) => i.productionInvoiceItemId)
  return own.length === ids.length && own.every((id) => ids.includes(id))
}

function StatusBadge({ solve }: { solve: CuttingBatchSolve }) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
    padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
  }
  if (solve.displayStatus === 'CALCULATING') {
    return (
      <span style={{ ...base, background: 'var(--bg-eceff1)', color: 'var(--fg-546e7a)' }}>
        <Loader2 size={12} className="spin" /> Đang tính… (đã chạy <ElapsedText requestedAt={solve.requestedAt} />)
      </span>
    )
  }
  if (solve.displayStatus === 'NEEDS_ACTION') {
    return (
      <span style={{ ...base, background: 'var(--bg-fee2e2)', color: 'var(--fg-b91c1c)' }}>
        <AlertTriangle size={12} /> Cần xử lý
      </span>
    )
  }
  return (
    <span style={{ ...base, background: 'var(--bg-e8f5e9)', color: 'var(--fg-166534)' }}>
      <Check size={12} /> Đã tính xong
    </span>
  )
}

function lineResult(l: SolveLineLike) {
  if (!l.feasible) {
    return (
      <span style={{ color: 'var(--fg-b91c1c)', fontWeight: 600 }}>
        {l.timedOut ? 'Hết giờ, chưa kết luận' : 'Không cắt được'}
      </span>
    )
  }
  if (l.overThreshold) {
    return <span style={{ color: 'var(--fg-b91c1c)', fontWeight: 600 }}>Vượt ngưỡng</span>
  }
  // Cắt được nhờ chế độ "Chấp nhận hao hụt cao hơn": hao hụt thật đã vượt mức mặc định - không được ghi "Đạt" xanh.
  if (l.usedWasteOverride) {
    return <span style={{ color: 'var(--fg-b45309)', fontWeight: 600 }}>Cao hơn mức mặc định</span>
  }
  return (
    <span style={{ color: 'var(--fg-166534)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <Check size={12} /> Đạt
    </span>
  )
}

/** Đủ field để dựng bảng - cả CuttingSolveLine (màn tính) lẫn CuttingProposalLine (chi tiết phương án
 *  đã duyệt) đều thoả, nên dùng chung được cho màn Lệnh sản xuất. */
export type SolveLineLike = Pick<
  CuttingSolveLine,
  | 'materialId' | 'materialCode' | 'feasible' | 'bestStockLengthMm' | 'lengthSource' | 'totalBars'
  | 'wastePercentage' | 'maxWastePctThreshold' | 'overThreshold' | 'timedOut' | 'displayReason'
>
  & Partial<Pick<CuttingSolveLine, 'normalWastePctThreshold' | 'usedWasteOverride' | 'pieceSummary' | 'patterns'>>


/** "470 mm" - cỡ đoạn nói bằng mm (khác chiều dài cây nói bằng mét) để không lẫn với nhau. */
const fmtMm = (mm: number) => `${Number(mm).toLocaleString('vi-VN')} mm`

/**
 * Chi tiết 1 loại sắt khi bấm vào dòng: (1) các cỡ đoạn cần cắt - cần bao nhiêu, phương án cắt ra bao nhiêu, mảnh gì;
 * (2) cách cắt từng cây - mỗi kiểu là các đoạn trên một cây và số cây cắt theo kiểu đó. Cho KHSX hiểu VÌ SAO ra
 * ngần ấy cây trước khi tạo lệnh sản xuất.
 */
function LineDetail({ line }: { line: SolveLineLike }) {
  const sizes = [...(line.pieceSummary ?? [])].sort((a, b) => b.size - a.size)
  const patterns = [...(line.patterns ?? [])].sort((a, b) => b.barCount - a.barCount || a.patternIndex - b.patternIndex)
  const sub: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '2px 0 6px' }
  const box: React.CSSProperties = { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)' }
  if (sizes.length === 0 && patterns.length === 0) {
    return <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Phương án này chưa lưu chi tiết các đoạn cắt. Bấm “Tính lại” để có.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sizes.length > 0 && (
        <div>
          <div style={sub}>Các đoạn cần cắt</div>
          <div style={box}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Cỡ đoạn</th>
                  <th style={TH}>Mảnh</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Cần</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Cắt ra</th>
                </tr>
              </thead>
              <tbody>
                {sizes.map((p) => (
                  <tr key={p.size}>
                    <td style={{ ...TD, fontWeight: 600 }}>{fmtMm(p.size)}</td>
                    <td style={{ ...TD, color: 'var(--text2)' }}>{p.names.length > 0 ? p.names.join(', ') : '—'}</td>
                    <td style={NUM}>{p.demand}</td>
                    <td style={NUM}>
                      {p.produced}
                      {p.produced > p.demand && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)' }} title="Dư ra khi cắt cho vừa cây">dư {p.produced - p.demand}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {patterns.length > 0 && (
        <div>
          <div style={sub}>Cách cắt từng cây</div>
          <div style={box}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Kiểu</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Số cây</th>
                  <th style={TH}>Các đoạn trên 1 cây</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Phần thừa/cây</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((pt, i) => (
                  <tr key={pt.id}>
                    <td style={{ ...TD, color: 'var(--text2)' }}>{i + 1}</td>
                    <td style={NUM}><b>{pt.barCount}</b></td>
                    <td style={TD}>
                      {[...pt.segments]
                        .filter((sg) => sg.countPerBar > 0)
                        .sort((a, b) => b.cutLengthMm - a.cutLengthMm)
                        .map((sg) => `${Number(sg.cutLengthMm).toLocaleString('vi-VN')} × ${sg.countPerBar}`)
                        .join('  +  ')}
                    </td>
                    <td style={NUM}>{pt.wastePerBarMm != null ? fmtMm(pt.wastePerBarMm) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** Bảng kết quả theo từng loại sắt: số cây mua, chiều dài cây, hao hụt, đạt/vượt/không cắt được. */
export function SolveLinesTable({
  lines, totalBarsAll, wastePercentage, totalSolveSeconds, isMobile,
}: {
  lines: SolveLineLike[]
  totalBarsAll: number | null
  wastePercentage: number | null
  totalSolveSeconds?: number | null
  isMobile: boolean
}) {
  // Loại sắt đang mở chi tiết (bấm vào dòng để mở/đóng).
  const [openMaterial, setOpenMaterial] = useState<string | null>(null)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 640 : undefined }}>
        <thead>
          <tr>
            <th style={TH}>Loại sắt</th>
            <th style={{ ...TH, textAlign: 'right' }}>Số cây mua</th>
            <th style={TH}>Chiều dài cây</th>
            <th style={{ ...TH, textAlign: 'right' }}>Hao hụt</th>
            <th style={TH}>Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const hasDetail = (l.pieceSummary?.length ?? 0) > 0 || (l.patterns?.length ?? 0) > 0
            const open = openMaterial === l.materialId
            return (
            <Fragment key={l.materialId}>
            <tr
              onClick={hasDetail ? () => setOpenMaterial(open ? null : l.materialId) : undefined}
              style={{ cursor: hasDetail ? 'pointer' : 'default', background: open ? 'var(--surface2)' : undefined }}
              title={hasDetail ? 'Bấm để xem các đoạn cắt của loại sắt này' : undefined}
            >
              <td style={TD}>
                <b style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {hasDetail && (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                  {l.materialCode}
                </b>
                {l.displayReason && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, maxWidth: 420 }}>{l.displayReason}</div>
                )}
              </td>
              <td style={NUM}>{l.feasible && l.totalBars != null ? <b>{l.totalBars}</b> : '—'}</td>
              <td style={TD}>
                {l.bestStockLengthMm != null ? (
                  <>
                    {fmtLen(l.bestStockLengthMm)}
                    {l.lengthSource === 'scan' && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: 'var(--fg-854d0e)' }} title="Cây ĐẶT RIÊNG - phải chờ NCC cán, không phải cây chuẩn có sẵn">
                        đặt riêng
                      </span>
                    )}
                  </>
                ) : '—'}
              </td>
              <td style={NUM}>
                {l.feasible && l.wastePercentage != null ? `${Number(l.wastePercentage).toFixed(2)}%` : '—'}
                {/* Ngưỡng MẶC ĐỊNH của công ty, không phải trần đã gửi solver (đợt đơn gấp là 100% - vô nghĩa với người đọc). */}
                {(l.normalWastePctThreshold ?? l.maxWastePctThreshold) != null && (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>ngưỡng {l.normalWastePctThreshold ?? l.maxWastePctThreshold}%</div>
                )}
              </td>
              <td style={TD}>{lineResult(l)}</td>
            </tr>
            {open && hasDetail && (
              <tr>
                <td colSpan={5} style={{ ...TD, background: 'var(--surface2)', padding: '12px 14px' }}>
                  <LineDetail line={l} />
                </td>
              </tr>
            )}
            </Fragment>
            )
          })}
        </tbody>
        {totalBarsAll != null && (
          <tfoot>
            <tr>
              <td style={{ ...TD, fontWeight: 700 }}>Tổng</td>
              <td style={{ ...NUM, fontWeight: 700 }}>{totalBarsAll}</td>
              <td style={TD} />
              <td style={{ ...NUM, fontWeight: 700 }}>
                {wastePercentage != null ? `${Number(wastePercentage).toFixed(2)}%` : '—'}
              </td>
              <td style={{ ...TD, fontSize: 11.5, color: 'var(--text3)' }}>
                {totalSolveSeconds != null ? `giải ${Number(totalSolveSeconds).toFixed(1)}s` : ''}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

interface Props {
  /** Các lượt tính gần đây, mới nhất trước. */
  solves: CuttingBatchSolve[]
  /** Thẻ đang mở chi tiết. */
  expandedId: string | null
  onToggle: (id: string) => void
  creating: boolean
  /** Tạo lệnh sản xuất từ ĐÚNG lượt tính này (SKU lấy từ chính lượt tính, không phụ thuộc đang tick gì). */
  onCreateInvoice: (solve: CuttingBatchSolve) => void
  /** "Tính lại với chế độ khác": quay lại tab chọn với đúng SKU + cài đặt của lượt này. */
  onRecalc: (solve: CuttingBatchSolve) => void
  /** Xoá lượt tính này khỏi danh sách (chỉ lượt đã xong/lỗi, chưa dùng tạo lệnh sản xuất). */
  onDiscard: (solve: CuttingBatchSolve) => void
  /** Bấm ở trạng thái rỗng: quay lại tab chọn SKU. */
  onGoChoose: () => void
  isMobile: boolean
}

/** "Hao hụt tối đa 1%, chỉ cây chuẩn" - để KHSX biết lượt này chạy với cài đặt nào trước khi đổi. */
function settingsSummary(s: CuttingBatchSolve): string {
  const thresholds = (s.lines ?? []).map((l) => l.maxWastePctThreshold).filter((n): n is number => n != null)
  const parts: string[] = []
  const over = s.solverOptions?.solverMaxWastePctOverride
  // Chế độ đơn gấp không đặt trần (trần gửi solver = 100% chỉ là quy ước) - đừng in "hao hụt tối đa 100%".
  if (over != null) parts.push('chế độ: chấp nhận hao hụt cao hơn (đơn gấp, không đặt trần)')
  else {
    if (thresholds.length > 0) parts.push(`hao hụt tối đa ${Math.max(...thresholds)}%`)
    parts.push('chế độ: bình thường')
  }
  parts.push(s.solverOptions?.solverAllowCustomLength === false ? 'giữ chiều dài đã định' : 'được đặt cây riêng')
  const n = Object.keys(s.solverOptions?.solverStockLengthsByMaterial ?? {}).length
  if (n > 0) parts.push(`chiều dài cây tự chọn cho ${n} quy cách`)
  return parts.join(' · ')
}

/** Tóm tắt 1 dòng của thẻ: "387 cây · hao hụt 0,27%". */
function summaryText(s: CuttingBatchSolve): string {
  if (s.displayStatus === 'CALCULATING') return ''
  if (s.status === 'FAILED') return 'Solver lỗi'
  if (s.totalBarsAll == null) return ''
  const pct = s.wastePercentage != null ? ` · hao hụt ${Number(s.wastePercentage).toFixed(2)}%` : ''
  return `${s.totalBarsAll} cây${pct}`
}

/**
 * Tab "Kết quả đã tính": mỗi lượt tính là 1 THẺ (mã SKU + trạng thái + tóm tắt). Bấm thẻ mở chi tiết:
 * tiến độ khi đang tính, bảng từng loại sắt khi xong, và nút "Tạo lệnh sản xuất" CHỈ khi phương án dùng
 * được. Thiết kế để công nhân/KHSX chỉ cần nhìn màu + 1 nút: xanh = tạo lệnh; vàng = đọc lý do rồi
 * quay lại tab chọn để chỉnh và tính lại.
 */
export default function CuttingSolvePanel({
  solves, expandedId, onToggle, creating, onCreateInvoice, onRecalc, onDiscard, onGoChoose, isMobile,
}: Props) {
  if (solves.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
        Chưa có lượt tính nào. Sang tab{' '}
        <button onClick={onGoChoose} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fg-e65100)', fontWeight: 600, fontSize: 13 }}>
          Chọn và tính
        </button>{' '}
        để chọn SKU rồi bấm “Tính phương án cắt”.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {solves.map((s) => {
        const open = expandedId === s.id
        const ready = s.displayStatus === 'OK' && s.invoiceReadiness?.ready === true
        const reason = s.invoiceReadiness && !s.invoiceReadiness.ready ? s.invoiceReadiness.reason : null
        // Cảnh báo KHÔNG chặn (vd có loại sắt vượt ngưỡng hao hụt): vẫn tạo được lệnh, nhưng nói rõ
        // QLSX/Sếp sẽ thấy để KHSX không bất ngờ.
        const warning = ready ? (s.invoiceReadiness?.warning ?? null) : null
        const skuCount = (s.items ?? []).length
        return (
          <div key={s.id} data-solve-id={s.id} {...focusAttr('CUTTING_PROPOSAL', s.id)} style={{ background: 'var(--surface)', border: `1px solid ${ready ? 'var(--fg-86efac)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <button
              onClick={() => onToggle(s.id)}
              aria-expanded={open}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}
            >
              <b style={{ fontSize: 13, wordBreak: 'break-word' }}>{solveSkuCodes(s)}</b>
              {skuCount >= 2 && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>gộp {skuCount} SKU</span>}
              {/* Mã đơn: 2 đơn cùng SKU cho ra 2 thẻ trùng tên SKU - thiếu dòng này KHSX không biết thẻ nào của đơn nào. */}
              {solveOrderCodes(s) && <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>đơn {solveOrderCodes(s)}</span>}
              <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{summaryText(s)}</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge solve={s} />
                {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </span>
            </button>

            {open && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {s.displayStatus !== 'CALCULATING' && (
                  <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, minWidth: 0 }}>
                      Cài đặt đã dùng: <b>{settingsSummary(s)}</b>
                    </span>
                    <button
                      onClick={() => onRecalc(s)}
                      style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text)' }}
                    >
                      Tính lại với chế độ khác
                    </button>
                    <button
                      onClick={() => onDiscard(s)}
                      style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', background: 'var(--surface)', border: '1px solid var(--fg-fca5a5)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--fg-991b1b)' }}
                    >
                      Xóa lượt tính này
                    </button>
                  </div>
                )}
                {s.displayStatus === 'CALCULATING' && (
                  <div style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--text2)' }}>
                    Solver đang tìm cách cắt ít hao nhất
                    {s.pendingMaterials && s.pendingMaterials.length > 0
                      ? <> cho <b>{s.pendingMaterials.map((m) => m.materialCode).join(', ')}</b></>
                      : null}
                    . Có thể mất từ vài giây tới vài phút. Bạn có thể rời màn này — kết quả vẫn được giữ và sẽ có
                    thông báo khi xong. Nếu đang có lượt khác chạy thì lượt này xếp hàng chờ tới lượt.
                  </div>
                )}

                {s.status === 'FAILED' && s.displayStatus !== 'CALCULATING' && (
                  <div style={{ margin: '11px 14px', background: 'var(--bg-fee2e2)', border: '1px solid var(--fg-fca5a5)', color: 'var(--fg-991b1b)', borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 12.5 }}>
                    Solver lỗi: {s.errorMessage ?? 'không rõ nguyên nhân'}. Quay lại tab “Chọn và tính” để tính lại.
                  </div>
                )}

                {s.lines && s.lines.length > 0 && (
                  <SolveLinesTable
                    lines={s.lines}
                    totalBarsAll={s.totalBarsAll}
                    wastePercentage={s.wastePercentage}
                    totalSolveSeconds={s.totalSolveSeconds}
                    isMobile={isMobile}
                  />
                )}

                {reason && (
                  <div style={{ margin: '11px 14px', display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--bg-fffbeb)', border: '1px solid var(--fg-fcd34d)', color: 'var(--fg-854d0e)', borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 12.5 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      <b>Chưa tạo được lệnh sản xuất:</b> {reason}{' '}
                      <button onClick={onGoChoose} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fg-e65100)', fontWeight: 600, fontSize: 12.5 }}>
                        Quay lại chỉnh
                      </button>
                    </span>
                  </div>
                )}

                {warning && (
                  <div style={{ margin: '11px 14px', display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--bg-fffbeb)', border: '1px solid var(--fg-fcd34d)', color: 'var(--fg-854d0e)', borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 12.5 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span><b>Lưu ý:</b> {warning}</span>
                  </div>
                )}

                {/* Nút CHỈ hiện khi tạo được - không bày nút mờ gây thắc mắc "vì sao bấm không được". */}
                {ready && (
                  <div style={{ padding: '11px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1, minWidth: isMobile ? 0 : 240 }}>
                      QLSX và Sếp sẽ duyệt đúng phương án này — solver không chạy lại sau khi duyệt.
                    </span>
                    <button
                      onClick={() => onCreateInvoice(s)}
                      disabled={creating}
                      style={{
                        padding: '9px 18px', border: 'none', borderRadius: 'var(--radius)', fontSize: 13,
                        fontWeight: 600, color: '#fff', background: 'var(--bg-2e7d32)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        width: isMobile ? '100%' : undefined,
                        cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.5 : 1,
                      }}
                    >
                      {creating && <Loader2 size={14} className="spin" />}
                      {skuCount >= 2 ? `Tạo lệnh sản xuất (gộp ${skuCount} SKU)` : 'Tạo lệnh sản xuất'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
