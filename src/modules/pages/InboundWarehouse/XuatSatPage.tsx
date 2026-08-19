'use client'

/**
 * Xuất sắt cho Phôi (kho Phôi Sơn Hàn) — mục sidebar dưới "Xuất kho".
 *
 * B4 Đợt 3d (2026-08-19, changelog 2026-08-18-xuat-sat-po-pi-vat-tu.md mục 2) — đổi hẳn sang gộp
 * theo CẢ PI: danh sách ngoài liệt kê theo PI (không phải theo SKU như trước), kế hoạch/lịch sử
 * gộp theo loại sắt cho cả PI (không breakdown theo mảnh nữa — Phôi tự phân bổ vật lý theo mảnh
 * nào khi cắt, hệ thống không cần và không thể biết trước "cây này cho mảnh nào" vì SegmentSpec
 * dùng chung toàn hệ thống). Nút Xuất chỉ hỏi (loại sắt, tổng số cây) — không hỏi mảnh/sản phẩm.
 *
 * Khác mock cũ: bỏ hẳn "kế hoạch xuất sắt" tự tính sẵn số cây mục tiêu (planCay) và highlight
 * "chưa đồng bộ" — không có gì tương ứng ở BE (solver chỉ tính tổng cây/vật tư cho CẢ PI, không
 * chia sẵn theo từng mảnh). Thay vào đó hiện "Σ đoạn cần theo BOM" (steel-issue-plan) làm tham
 * chiếu, thủ kho tự quyết định xuất bao nhiêu cây/chiều dài dựa trên đó — cùng cách đơn giản hoá
 * đã áp cho Sản lượng Hàn/Sơn (bỏ "thanh sắt cấu thành"/"làm tuần tự", xem roadmap M3).
 */

import { useState } from 'react'
import { ArrowUpFromLine, ChevronLeft, PackagePlus, Check } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import type { BeSteelIssuePlanItem, BeSteelIssue, BeReplenishRequest } from '../../../services/steel-issues-api'
import { buildProductionOrderInfoByMfgProduct } from '../../../services/production-invoice-item'
import { errMsg } from '../../../utils/errors'
import { tableWrap, tbl, row, emptyBox, listTh as thStyle, listTd as tdStyle } from '../../../styles/table'
import LoadingState from '../../../components/LoadingState'
import type { Sku } from '../../../types/sku'

const ACCENT = '#4527A0'

interface PiGroup {
  productionInvoiceId: string
  piCode: string
  /** null khi PI gộp nhiều đơn hàng Sales khác nhau (isMerged) — không có 1 mã PO đại diện. */
  poCode: string | null
  skus: Sku[]
}

export default function XuatSatPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const { data: replenish, refetch: refetchReplenish } = useFetch<BeReplenishRequest[]>(() => api.getReplenishRequests('OPEN'), [])
  // PO/PI thật (từ ProductionOrder Sếp đã duyệt) - KHÔNG dùng Sku.exportOrder/Sku.piCode, xem
  // comment ở buildProductionOrderInfoByMfgProduct().
  const { data: poInfoByProduct } = useFetch(() => buildProductionOrderInfoByMfgProduct(), [])
  const poInfoFor = (pf: Sku) => poInfoByProduct?.get(pf.mfgProductId)

  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT')

  // Gộp SKU theo PI (chỉ SKU đã có lệnh sản xuất thật) - danh sách ngoài liệt kê theo PI.
  const piGroups: PiGroup[] = []
  for (const pf of active) {
    const info = poInfoFor(pf)
    if (!info) continue
    const g = piGroups.find(g => g.productionInvoiceId === info.productionInvoiceId)
    if (g) {
      if (g.poCode !== info.poCode) g.poCode = null
      g.skus.push(pf)
    } else {
      piGroups.push({ productionInvoiceId: info.productionInvoiceId, piCode: info.piCode, poCode: info.poCode, skus: [pf] })
    }
  }

  const [selectedPi, setSelectedPi] = useState<PiGroup | null>(null)
  const { data: planData, isLoading: planLoading, refetch } = useFetch<BeSteelIssuePlanItem[]>(
    () => (selectedPi ? api.getSteelIssuePlan(selectedPi.productionInvoiceId) : Promise.resolve([])),
    [selectedPi?.productionInvoiceId],
  )
  const plan = planData ?? []
  const { data: historyData, refetch: refetchHistory } = useFetch<BeSteelIssue[]>(
    () => (selectedPi ? api.getSteelIssuesForInvoice(selectedPi.productionInvoiceId) : Promise.resolve([])),
    [selectedPi?.productionInvoiceId],
  )
  const history = historyData ?? []
  // Chiều dài cây mặc định — cây sắt nguyên liệu chuẩn luôn là 6000mm (chốt 2026-08-18), vẫn sửa
  // được vì kho vật lý có thể đang có cây dài khác. Bỏ hẳn hướng lấy bestStockLengthMm từ phương
  // án cắt (getApprovedBarLengthByMaterial) — quá phức tạp so với lợi ích, số đó cũng không đại
  // diện chung cho cả PI khi 1 vật tư dùng ở nhiều sản phẩm/phương án cắt khác nhau.
  const DEFAULT_BAR_LENGTH_MM = 6000
  const suggestedBarLen = () => DEFAULT_BAR_LENGTH_MM

  const [barLen, setBarLen] = useState<Record<string, string>>({})
  const [barCount, setBarCount] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})
  const { ask, confirmModal } = useConfirm()

  const issuedForMaterial = (materialId: string) =>
    history.filter(h => h.materialId === materialId).reduce((s, h) => s + h.barCount, 0)

  const handleXuat = (item: BeSteelIssuePlanItem) => {
    const key = item.materialId
    const lenRaw = barLen[key] ?? suggestedBarLen().toString()
    const len = Number(lenRaw)
    const n = Number(barCount[key])
    if (!len || len <= 0) { setMsgs(p => ({ ...p, [key]: 'Nhập chiều dài cây hợp lệ' })); return }
    if (!n || n <= 0) { setMsgs(p => ({ ...p, [key]: 'Nhập số cây hợp lệ' })); return }
    ask(
      { message: `Xuất ${n} cây ${item.materialName} (dài ${len}mm) cho Phôi?` },
      async () => {
        if (!selectedPi) return
        setBusy(key)
        setMsgs(p => ({ ...p, [key]: '' }))
        try {
          await api.issueSteel(selectedPi.productionInvoiceId, { materialId: item.materialId, barLengthMm: len, barCount: n })
          setBarLen(p => ({ ...p, [key]: '' }))
          setBarCount(p => ({ ...p, [key]: '' }))
          await Promise.all([refetch(), refetchHistory()])
        } catch (e) {
          setMsgs(p => ({ ...p, [key]: errMsg(e, 'Không thể xuất sắt') }))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  const doCapLai = async (r: BeReplenishRequest) => {
    setMsgs(p => ({ ...p, [`cap-${r.id}`]: '' }))
    // Cấp bù = tạo 1 đợt xuất mới (issueSteel) rồi liên kết vào request — cần biết đúng
    // materialId/barLengthMm của đợt gốc, tra qua qc-review→steelIssue (không lộ trực tiếp ở
    // ReplenishRequest) nên yêu cầu chọn lại PI/vật tư thủ công thay vì tự động hoá 1 click như
    // mock cũ — đơn giản hoá vì BE tách hẳn "tạo đợt" và "fulfill" thành 2 bước độc lập.
    setMsgs(p => ({ ...p, [`cap-${r.id}`]: 'Chọn PI/vật tư tương ứng ở bảng trên, xuất 1 đợt mới rồi bấm "Gắn vào đề xuất" bên dưới.' }))
  }

  const doFulfill = async (r: BeReplenishRequest, steelIssueId: string) => {
    try {
      await api.fulfillReplenishRequest(r.id, steelIssueId)
      await refetchReplenish()
    } catch (e) {
      setMsgs(p => ({ ...p, [`cap-${r.id}`]: errMsg(e, 'Không cấp bù được') }))
    }
  }

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (selectedPi) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setSelectedPi(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
          >
            <ChevronLeft size={15} /> Quay lại
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              PI: {selectedPi.piCode}
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
              PO: {selectedPi.poCode ?? 'PI gộp nhiều đơn hàng'}
              {' · '}{selectedPi.skus.length} sản phẩm: {selectedPi.skus.map(pf => pf.mfgProduct?.factoryCode).filter(Boolean).join(', ')}
            </div>
          </div>
        </div>

        {planLoading ? <LoadingState /> : plan.length === 0 ? (
          <div style={emptyBox}>
            Chưa có mảnh nào trong PI này khai định mức sắt (BOM), hoặc chưa có phương án cắt sắt đã
            duyệt — báo KHSX bổ sung/duyệt phương án trước khi xuất được.
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={{ ...tbl, tableLayout: 'auto' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={thStyle}>Vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cần</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Còn được xuất</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Tồn kho</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: 240 }}>Xuất</th>
                </tr>
              </thead>
              <tbody>
                {plan.map(item => {
                  const key = item.materialId
                  const suggested = suggestedBarLen()
                  return (
                    <tr key={key} style={row}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{item.materialName}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{item.requiredSegments}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: item.issuedBarCount > 0 ? ACCENT : 'var(--text2)' }}>
                        {issuedForMaterial(item.materialId)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: item.remainingToIssue != null && item.remainingToIssue <= 0 ? '#dc2626' : 'var(--text2)' }}>
                        {item.remainingToIssue ?? '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{item.physicalStockQty ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number" min={1} placeholder="dài (mm)"
                            title={`Mặc định cây chuẩn ${suggested}mm — sửa lại nếu kho đang có cây dài khác`}
                            value={barLen[key] ?? String(suggested)}
                            onChange={e => setBarLen(p => ({ ...p, [key]: e.target.value }))}
                            style={{ width: 80, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                          />
                          <input
                            type="number" min={1} placeholder="SL cây"
                            value={barCount[key] ?? ''}
                            onChange={e => setBarCount(p => ({ ...p, [key]: e.target.value }))}
                            style={{ width: 64, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                          />
                          <button
                            onClick={() => handleXuat(item)}
                            disabled={busy === key}
                            style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: busy === key ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {busy === key ? '...' : 'Xuất'}
                          </button>
                        </div>
                        {msgs[key] && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{msgs[key]}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {history.length > 0 && (
              <table style={{ ...tbl, tableLayout: 'auto', borderTop: '1px solid var(--border)' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                    <th style={thStyle}>Thời gian</th>
                    <th style={thStyle}>Vật tư</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Dài (mm)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Số cây</th>
                    <th style={thStyle}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={row}>
                      <td style={tdStyle}>{new Date(h.issuedAt).toLocaleString('vi-VN')}</td>
                      <td style={tdStyle}>{plan.find(it => it.materialId === h.materialId)?.materialName ?? h.materialId}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{h.barLengthMm.toLocaleString('vi-VN')}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{h.barCount}</td>
                      <td style={tdStyle}>{statusLabel(h.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {confirmModal}
      </div>
    )
  }

  // ── List view (theo PI) ─────────────────────────────────────────────────────────
  return (
    <div>
      {!embedded && (
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ArrowUpFromLine size={20} /> Xuất sắt cho Phôi
        </h2>
      )}
      <p style={{ margin: '4px 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Nhấn vào dòng để xem loại sắt cần xuất cho cả PI (theo phương án cắt sắt đã duyệt) và xuất theo chiều dài/số cây.
      </p>

      {replenish && replenish.length > 0 && (
        <div style={{ border: '1px solid #fca5a5', borderRadius: 12, background: 'var(--red-bg, #fef2f2)', padding: '10px 14px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            <PackagePlus size={16} /> Cần cấp lại — KCS chấm phế ({replenish.reduce((s, c) => s + c.qty, 0)} cây)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {replenish.map(r => (
              <ReplenishRow key={r.id} r={r} msg={msgs[`cap-${r.id}`]} onCapLai={() => doCapLai(r)} onFulfill={steelIssueId => doFulfill(r, steelIssueId)} />
            ))}
          </div>
        </div>
      )}

      {isLoading ? <LoadingState /> : (
        <div style={tableWrap}>
          <table style={tbl}>
            <colgroup>
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PI</th>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>Sản phẩm</th>
              </tr>
            </thead>
            <tbody>
              {piGroups.map(g => (
                <tr key={g.productionInvoiceId} onClick={() => setSelectedPi(g)} style={row}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.piCode}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.poCode ?? 'Gộp nhiều đơn'}
                  </td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.skus.map(pf => pf.mfgProduct?.factoryCode).filter(Boolean).join(', ')}
                  </td>
                </tr>
              ))}
              {piGroups.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có PI nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function statusLabel(status: BeSteelIssue['status']) {
  if (status === 'ISSUED') return <span style={{ color: 'var(--text3)' }}>Chờ Phôi nhận</span>
  if (status === 'RECEIVED') return <span style={{ color: '#d97706' }}>Đang cắt</span>
  if (status === 'AWAITING_QC') return <span style={{ color: '#d97706' }}>Chờ KCS duyệt</span>
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 600 }}><Check size={12} /> KCS đạt</span>
}

/** 1 dòng đề xuất cấp lại — nhập id đợt (SteelIssue) vừa xuất bù để gắn vào request. Đơn giản
 *  hoá so với mock cũ (1 click) vì BE tách "tạo đợt" và "fulfill" thành 2 bước độc lập, xem
 *  QcReviewsService.fulfillReplenishRequest (BE). */
function ReplenishRow({ r, msg, onCapLai, onFulfill }: {
  r: BeReplenishRequest; msg?: string; onCapLai: () => void; onFulfill: (steelIssueId: string) => void
}) {
  const [issueId, setIssueId] = useState('')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
      <span style={{ flex: 1, minWidth: 200 }}>
        <b style={{ color: '#c62828' }}>{r.qty} cây phế</b> · đề xuất #{r.id}
      </span>
      <button onClick={onCapLai} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}>Hướng dẫn</button>
      <input value={issueId} onChange={e => setIssueId(e.target.value)} placeholder="id đợt đã xuất bù"
        style={{ width: 140, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)' }} />
      <button onClick={() => issueId && onFulfill(issueId)} disabled={!issueId}
        style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: issueId ? 'pointer' : 'not-allowed' }}>
        Gắn vào đề xuất
      </button>
      {msg && <div style={{ width: '100%', fontSize: 11, color: 'var(--text3)' }}>{msg}</div>}
    </div>
  )
}
