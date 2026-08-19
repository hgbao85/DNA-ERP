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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Info, Layers, Loader2, RefreshCw } from 'lucide-react'
import {
  getCuttingBatchCandidates,
  mergeCuttingBatch,
  previewCuttingBatch,
  type CuttingBatchCandidate,
  type CuttingBatchCandidateList,
  type CuttingBatchPreview,
} from '../../../services/cutting-batch-api'
import { errMsg } from '../../../utils/errors'

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

function MaterialChip({ code, pct, over, minBars }: { code: string; pct: number; over: boolean; minBars: number }) {
  const lowConfidence = isLowConfidence(minBars)
  return (
    <span
      title={
        lowConfidence
          ? `${code} — chỉ ${minBars} cây, cận dưới này KHÔNG đáng tin (số lượng quá nhỏ để so sánh)`
          : `${code} — hao hụt tốt nhất có thể khi SKU này cắt một mình`
      }
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
        padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
        background: over ? '#fee2e2' : lowConfidence ? '#fef9c3' : 'var(--surface2)',
        color: over ? '#b91c1c' : lowConfidence ? '#854d0e' : 'var(--text2)',
      }}
    >
      {over && <AlertTriangle size={11} />}
      {code} ≥{pct.toFixed(2)}%
      {lowConfidence && <span style={{ fontWeight: 700 }}>?</span>}
    </span>
  )
}

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

  const load = useCallback(() => {
    setLoading(true)
    getCuttingBatchCandidates()
      .then((res) => {
        setData(res)
        // Tick sẵn tổ hợp hệ thống đề xuất - KHSX chỉ việc xem lại rồi xác nhận, vẫn sửa được.
        setSelected(new Set(res.recommendedItemIds))
        setError(null)
      })
      .catch((e) => setError(errMsg(e, 'Không tải được danh sách SKU')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Tính lại mỗi khi tổ hợp đổi. Dưới 2 SKU thì không có gì để gộp -> xoá kết quả cũ.
  const selectedKey = useMemo(() => [...selected].sort().join(','), [selected])
  useEffect(() => {
    const ids = selectedKey ? selectedKey.split(',') : []
    if (ids.length < 2) { setPreview(null); return }
    let cancelled = false
    setPreviewing(true)
    previewCuttingBatch(ids)
      .then((res) => { if (!cancelled) setPreview(res) })
      .catch((e) => { if (!cancelled) setError(errMsg(e, 'Không tính được tổ hợp đã chọn')) })
      .finally(() => { if (!cancelled) setPreviewing(false) })
    return () => { cancelled = true }
  }, [selectedKey])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const items = data?.items ?? []
  const recommended = new Set(data?.recommendedItemIds ?? [])
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
    mergeCuttingBatch([...selected])
      .then(() => onDone?.())
      .catch((e) => setError(errMsg(e, 'Không gộp được nhóm đã chọn')))
      .finally(() => setMerging(false))
  }

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
          Các con số hao hụt là <b>mức tốt nhất có thể</b> (nên luôn có dấu ≥) — thực tế có thể cao
          hơn vì còn phụ thuộc số lượng và cây cắt dở cuối đợt. Dùng để so sánh phương án, không
          phải cam kết kết quả. Dấu <b style={{ color: '#854d0e' }}>?</b> cạnh % nghĩa là số lượng
          quá ít (dưới 3 cây) để con số này còn đáng tin — chỉ hoàn toàn dựa vào nó để quyết định.
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
                        {it.salesOrderCode ?? it.productionInvoiceCode}
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
                        {!it.hasActiveBom ? (
                          <span style={{ fontSize: 12, color: '#b45309' }}>
                            Chưa có định mức đang áp dụng — không tính được
                          </span>
                        ) : (
                          <>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {it.materials.map((m) => (
                                <MaterialChip key={m.materialId} code={m.materialCode} pct={m.standaloneWastePct} over={m.overThreshold} minBars={m.standaloneMinBars} />
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
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected.size >= 2 && (
        <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14, flex: 1 }}>Nếu gộp {selected.size} SKU đã chọn</b>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={TH}>Loại sắt dùng chung</th>
                    <th style={TH}>SKU cùng dùng</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Cắt riêng</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Cắt chung</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Bớt</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Hao hụt</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedLines.map((l) => (
                    <tr key={l.materialId}>
                      <td style={TD}><b>{l.materialCode}</b></td>
                      <td style={{ ...TD, fontSize: 12, color: 'var(--text2)' }}>{l.contributingSkus.join(' + ')}</td>
                      <td style={NUM}>{l.barsSeparate} cây</td>
                      <td style={NUM}>{l.minBars} cây</td>
                      <td style={{ ...NUM, fontWeight: 700, color: l.barsSavedVsSeparate > 0 ? '#166534' : 'var(--text3)' }}>
                        {l.barsSavedVsSeparate > 0 ? `−${l.barsSavedVsSeparate}` : '0'}
                      </td>
                      <td style={NUM}>
                        <span title={isLowConfidence(l.minBars) ? `Chỉ ${l.minBars} cây - cận dưới này KHÔNG đáng tin (số lượng quá nhỏ để so sánh)` : undefined}>
                          ≥ {l.minWastePct.toFixed(2)}%
                          {isLowConfidence(l.minBars) && <span style={{ marginLeft: 3, fontWeight: 700, color: '#854d0e' }}>?</span>}
                        </span>
                        {l.meetsThreshold
                          ? <span style={{ marginLeft: 5, color: '#166534' }}><Check size={12} /></span>
                          : <span style={{ marginLeft: 5, fontSize: 11, color: '#b91c1c' }}>vượt ngưỡng {l.thresholdPct}%</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {soloLines.length > 0 && (
                // Loại sắt chỉ 1 SKU trong tổ hợp dùng thì gộp KHÔNG THỂ tác động - liệt kê từng
                // dòng chỉ tạo một loạt "bớt 0 cây" gây nhiễu. Gom lại 1 dòng để KHSX vẫn biết
                // chúng tồn tại và đã được xét.
                <div style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
                  {soloLines.length} loại sắt khác ({soloLines.map((l) => l.materialCode).join(', ')})
                  {' '}chỉ một SKU trong nhóm dùng — gộp không ảnh hưởng.
                </div>
              )}
            </div>
          )}

          <div style={{ padding: '11px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleConfirm}
              disabled={previewing || !preview || merging}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 'var(--radius)', fontSize: 13,
                fontWeight: 600, color: '#fff', background: '#2e7d32',
                display: 'inline-flex', alignItems: 'center', gap: 7,
                cursor: previewing || !preview || merging ? 'not-allowed' : 'pointer',
                opacity: previewing || !preview || merging ? 0.5 : 1,
              }}
            >
              {merging && <Loader2 size={14} className="spin" />}
              Xác nhận gộp {selected.size} SKU
            </button>
          </div>
        </div>
      )}

      {/* Đúng 1 SKU: không có gì để gộp (lợi ích chỉ đến khi đoạn của NHIỀU SKU nằm chung một cây).
          SKU đó vốn đã nằm trong lệnh sản xuất riêng của nó nên chỉ cần đi tiếp luồng thường -
          không tạo thêm gì, không gọi API. */}
      {selected.size === 1 && (
        <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text2)', minWidth: 260 }}>
            Chọn 1 SKU thì không có gì để gộp — SKU này cắt riêng như bình thường. Chọn thêm ít nhất
            một SKU nữa (dùng chung loại sắt) mới bớt được cây.
          </div>
          <button
            onClick={() => onDone?.()}
            style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', flexShrink: 0 }}
          >
            Tiến hành cắt riêng
          </button>
        </div>
      )}
    </div>
  )
}
