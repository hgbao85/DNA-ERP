'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, HelpCircle, Paperclip, X } from 'lucide-react'
import { format } from 'date-fns'
import { useInspection, type PurchaseProposal, type PurchaseProposalItem, type PurchaseReceiptLog } from '../../../context/InspectionContext'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import MobileListCards from '../../../components/MobileListCards'
import { compactTh as th, compactTd as td } from '../../../styles/table'
import { uploadDocument } from '../../../services/uploads-api'
import { newUuid } from '../../../services/core/uuid'
import { previewPurchaseReceipt, reserveReceiptSlipCode, type ReceiptAllocationLine } from '../../../services/purchase-receipts-api'
import { printReceiptSlip } from './printReceiptSlip'

/**
 * Nhập kho hàng mua theo phiếu (Đợt 5d, 2026-11-05 - bản v8 YC8, YC4 4.3-4.6):
 *  - 1 dòng = 1 vật tư của 1 đơn đặt hàng NCC. Đơn gộp nhiều lệnh chỉ còn 1 dòng, thủ kho nhập 1 con số theo phiếu giao,
 *    hệ thống tự chia cho các lệnh (ngày cần sớm nhất trước) và hiện bảng chia trước khi xác nhận - chỉnh tay được.
 *  - Số thực nhận phải bằng số trên phiếu giao (không dung sai); lệch thì "Từ chối nhận".
 *  - Chứng từ bắt buộc ngay lúc nhập: phiếu giao NCC, phiếu đề xuất Giám đốc ký (tự lấy từ đơn), phiếu nhập kho, phiếu
 *    cân xe (sắt).
 */

interface Line { proposal: PurchaseProposal; item: PurchaseProposalItem }
interface Group {
  key: string
  lines: Line[]
  first: PurchaseProposalItem
  purchaseQty: number
  receivedQty: number
  deadline: string | null
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000
const fmtQty = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const fmtDate = (d?: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

function groupKeyOf(item: PurchaseProposalItem): string {
  if (!item.supplierOrderId) return `item:${item.itemId}`
  return [item.supplierOrderId, item.materialId, item.spec ?? '', item.stockLengthMm ?? '', item.warehouseCode].join('|')
}

function lineDeadline(l: Line): string | null {
  return l.item.deadline ?? l.proposal.deadline ?? null
}

export default function NhapKhoNhanHang({ lockedGroup }: { lockedGroup?: string | null }) {
  const isMobile = useIsMobile()
  const { proposals } = useInspection()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Dòng chưa gán kho ('—') vẫn hiện cho mọi thủ kho để không "mồ côi" (cùng nguyên tắc purchasingRouting.ts).
  const inScope = (item: PurchaseProposalItem) =>
    !lockedGroup || !item.warehouseCode || item.warehouseCode === '—' || item.warehouseCode === lockedGroup

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Line[]>()
    for (const proposal of proposals) {
      for (const item of proposal.items) {
        if (item.status !== 'purchasing' || !item.itemId || !inScope(item)) continue
        const key = groupKeyOf(item)
        map.set(key, [...(map.get(key) ?? []), { proposal, item }])
      }
    }
    return [...map.entries()]
      .map(([key, lines]) => ({
        key,
        lines,
        first: lines[0].item,
        purchaseQty: round4(lines.reduce((s, l) => s + l.item.purchaseQty, 0)),
        receivedQty: round4(lines.reduce((s, l) => s + (l.item.receivedQty ?? 0), 0)),
        deadline: lines.map(lineDeadline).filter((d): d is string => !!d).sort()[0] ?? null,
      }))
      .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inScope chỉ phụ thuộc lockedGroup
  }, [proposals, lockedGroup])

  const selected = groups.find(g => g.key === selectedKey) ?? null
  if (selected) return <ReceiveDetail group={selected} onBack={() => setSelectedKey(null)} />

  const orderLabel = (it: PurchaseProposalItem) =>
    it.supplierOrderCode ? `${it.supplierName ?? 'NCC'} – Số ${it.supplierOrderCode}` : '—'
  const materialLabel = (it: PurchaseProposalItem) =>
    `${it.name}${it.spec ? ` · ${it.spec}` : ''}${it.stockLengthMm != null ? ` · cây ${it.stockLengthMm}mm` : ''}`
  const lenhLabel = (g: Group) => [...new Set(g.lines.map(l => l.proposal.lenhCode))].join(', ')

  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Hàng mua đã được Giám đốc duyệt, chờ về kho. Đơn gộp nhiều lệnh chỉ nhập 1 lần - hệ thống tự chia cho các lệnh.
      </div>
      {isMobile ? (
        <MobileListCards
          emptyText="Không có hàng nào đang chờ nhập kho"
          items={groups.map(g => ({
            key: g.key,
            onClick: () => setSelectedKey(g.key),
            title: <b>{materialLabel(g.first)}</b>,
            meta: [
              { label: 'Đơn', value: orderLabel(g.first) },
              { label: 'Lệnh', value: lenhLabel(g) },
              { label: 'Đã nhận', value: `${fmtQty(g.receivedQty)} / ${fmtQty(g.purchaseQty)} ${g.first.unit}` },
              { label: 'Hạn cần', value: fmtDate(g.deadline) },
            ],
          }))}
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 190 }} />
              <col />
              <col style={{ width: 170 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Đơn đặt hàng</th>
                <th style={th}>Vật tư</th>
                <th style={th}>Lệnh</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã nhận / Đặt mua</th>
                <th style={th}>Hạn cần</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr
                  key={g.key}
                  onClick={() => setSelectedKey(g.key)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orderLabel(g.first)}</td>
                  <td style={{ ...td, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{materialLabel(g.first)}</td>
                  <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lenhLabel(g)}{g.lines.length > 1 && <span style={{ fontFamily: 'inherit', fontSize: 11 }}> ({g.lines.length} lệnh)</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <b style={{ color: g.receivedQty > 0 ? 'var(--fg-d97706)' : 'var(--text)' }}>{fmtQty(g.receivedQty)}</b> / {fmtQty(g.purchaseQty)} {g.first.unit}
                  </td>
                  <td style={td}>{fmtDate(g.deadline)}</td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    <div className="table-empty-msg">Không có hàng nào đang chờ nhập kho</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Ô tải chứng từ (nhiều ảnh/PDF mỗi ô) ─────────────────────────────────────
function DocSlot({ label, required, files, onChange, existing }: {
  label: string
  required: boolean
  files: File[]
  onChange: (files: File[]) => void
  existing?: string[]
}) {
  const missing = required && files.length === 0 && !(existing && existing.length > 0)
  return (
    <div style={{ border: `1px solid ${missing ? 'var(--fg-fca5a5, #fca5a5)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 10px', background: 'var(--surface)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--fg-dc2626, #dc2626)' }}> *</span>}
      </div>
      {existing && existing.length > 0 ? (
        <div style={{ fontSize: 12, color: 'var(--fg-16a34a)' }}>
          ✓ Đã có từ đơn đặt hàng:{' '}
          {existing.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-2563eb)' }}>file {i + 1}</a>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 6px', borderRadius: 10, background: 'var(--surface2)' }}>
                {f.name}
                <button onClick={() => onChange(files.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', color: 'var(--text3)' }} aria-label="Bỏ file"><X size={11} /></button>
              </span>
            ))}
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--fg-2563eb)', cursor: 'pointer' }}>
            <Paperclip size={12} /> {files.length > 0 ? 'Thêm ảnh' : 'Chọn ảnh / PDF'}
            <input
              type="file" accept="image/*,application/pdf" multiple hidden
              onChange={e => { onChange([...files, ...Array.from(e.target.files ?? [])]); e.target.value = '' }}
            />
          </label>
        </>
      )}
    </div>
  )
}

// ── Chi tiết 1 lần nhận ─────────────────────────────────────────────────────
function ReceiveDetail({ group, onBack }: { group: Group; onBack: () => void }) {
  const { receivePurchase, rejectPurchase } = useInspection()
  const it = group.first
  const itemIds = group.lines.map(l => l.item.itemId!)
  const proposalIds = [...new Set(group.lines.map(l => l.proposal.id))]
  // Cùng thứ tự BE (PurchaseReceiptsService.approvalFilesOf): file ký của đơn đặt hàng, không có thì file gắn trên dòng (dữ liệu cũ).
  const approvalExisting = it.supplierOrderApprovalFileUrl
    ? [it.supplierOrderApprovalFileUrl]
    : [...new Set(group.lines.map(l => l.item.approvalFileUrl).filter((u): u is string => !!u))]

  const [unitRate, setUnitRate] = useState('')
  const [supplierUnit, setSupplierUnit] = useState('')
  const [delivered, setDelivered] = useState('')
  const [supplierSlips, setSupplierSlips] = useState<File[]>([])
  const [approvalFiles, setApprovalFiles] = useState<File[]>([])
  const [receiptSlips, setReceiptSlips] = useState<File[]>([])
  const [weighSlips, setWeighSlips] = useState<File[]>([])
  const [fetchedPreview, setPreview] = useState<ReceiptAllocationLine[] | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [manual, setManual] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectFiles, setRejectFiles] = useState<File[]>([])
  // Nhận vượt (Đợt 5e, 4.12): lý do bắt buộc, ảnh bằng chứng nếu có.
  const [overReason, setOverReason] = useState('')
  const [overFiles, setOverFiles] = useState<File[]>([])
  // Số phiếu nhập NK (Đợt 6, 4.2/4.8): giữ lúc bấm "In phiếu nhập"; in lại giữ số cũ. Số lượng đổi sau khi in thì phải in lại.
  const [slipCode, setSlipCode] = useState('')
  const [printedTotal, setPrintedTotal] = useState<number | null>(null)
  const [slipErr, setSlipErr] = useState('')
  // Giữ nguyên key giữa các lần bấm lại của CÙNG 1 lần nhận (lỗi mạng mà BE đã ghi thì không nhập 2 lần); đổi sau khi xong.
  const [receiveKey, setReceiveKey] = useState(() => newUuid())
  const [rejectKey, setRejectKey] = useState(() => newUuid())
  // File đã tải lên Cloudinary - bấm lại sau lỗi không tải lại.
  const uploaded = useRef(new WeakMap<File, string>())

  const rate = Number(unitRate) > 0 ? Number(unitRate) : 0
  const hasConversion = Number(supplierUnit) > 0
  const total = rate > 0 ? round4(rate * (hasConversion ? Number(supplierUnit) : 1)) : 0
  const checkedQty = hasConversion ? Number(supplierUnit) : rate
  const deliveredNum = Number(delivered)
  const deliveredMismatch = delivered !== '' && total > 0 && round4(deliveredNum) !== round4(checkedQty)

  // Bảng chia: hỏi BE (cùng 1 luật với lúc ghi), trễ 300ms khi đang gõ.
  useEffect(() => {
    if (!(total > 0)) return
    let cancelled = false
    const t = setTimeout(() => {
      previewPurchaseReceipt(itemIds, total)
        .then(r => { if (!cancelled) { setPreview(r); setPreviewError(null) } })
        .catch(e => { if (!cancelled) setPreviewError(e instanceof Error ? e.message : String(e)) })
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- itemIds dựng lại mỗi render; khoá theo nội dung
  }, [total, itemIds.join(',')])

  // Chưa nhập số thì không có bảng chia (giữ kết quả cũ trong state nhưng không hiện).
  const preview = total > 0 ? fetchedPreview : null
  const allocation = (preview ?? []).map(p => ({
    ...p,
    final: editing ? round4(Number(manual[p.itemId] ?? p.qty) || 0) : p.qty,
  }))
  const allocSum = round4(allocation.reduce((s, a) => s + a.final, 0))
  const allocOk = !editing || allocSum === total

  const missingDocs = [
    supplierSlips.length === 0 && 'phiếu giao hàng NCC',
    approvalExisting.length === 0 && approvalFiles.length === 0 && 'phiếu đề xuất Giám đốc ký',
    receiptSlips.length === 0 && 'phiếu nhập kho',
    it.isSteel && weighSlips.length === 0 && 'phiếu cân xe',
  ].filter(Boolean) as string[]
  const remaining = round4(group.purchaseQty - group.receivedQty)
  // Vượt tổng số còn lại của đơn (BE tính lại sau khoá theo số đã nhận mới nhất, cùng công thức).
  const overQty = round4(Math.max(0, total - remaining))
  const overReasonMissing = overQty > 0 && overReason.trim() === ''
  const slipStale = !!slipCode && printedTotal !== total
  const canPrint = total > 0 && delivered !== '' && !deliveredMismatch && allocOk && !!preview && !busy
  const canConfirm = canPrint && missingDocs.length === 0 && !overReasonMissing && !!slipCode && !slipStale

  const uploadAll = async (files: File[]) => {
    const urls: string[] = []
    for (const f of files) {
      let url = uploaded.current.get(f)
      if (!url) { url = await uploadDocument(f); uploaded.current.set(f, url) }
      urls.push(url)
    }
    return urls
  }

  const doReceive = async () => {
    setBusy(true)
    try {
      const [s1, s2, s3, s4] = [await uploadAll(supplierSlips), await uploadAll(approvalFiles), await uploadAll(receiptSlips), await uploadAll(weighSlips)]
      const overUrls = overQty > 0 ? await uploadAll(overFiles) : []
      const result = await receivePurchase({
        itemIds,
        unitRateQty: rate,
        supplierUnitQty: hasConversion ? Number(supplierUnit) : undefined,
        deliveredQty: deliveredNum,
        supplierSlipUrls: s1,
        approvalFileUrls: s2.length > 0 ? s2 : undefined,
        receiptSlipUrls: s3,
        weighSlipUrls: s4.length > 0 ? s4 : undefined,
        allocation: editing ? allocation.map(a => ({ itemId: a.itemId, qty: a.final })) : undefined,
        slipCode,
        overReason: overQty > 0 ? overReason.trim() : undefined,
        overFileUrls: overUrls.length > 0 ? overUrls : undefined,
      }, receiveKey, proposalIds)
      setDone(`Đã nhập ${fmtQty(result.receivedQty)} ${it.unit}: ` + result.allocation.filter(a => a.qty > 0).map(a => `${a.lenhCode} ${fmtQty(a.qty)}`).join(', ') + (result.allocationAdjusted ? ' (đã chỉnh phân bổ)' : '') + (result.overQty > 0 ? ` · nhận vượt ${fmtQty(result.overQty)} ${it.unit} vào tồn chưa giữ, đã báo người mua` : ''))
      setUnitRate(''); setSupplierUnit(''); setDelivered('')
      setSupplierSlips([]); setApprovalFiles([]); setReceiptSlips([]); setWeighSlips([])
      setOverReason(''); setOverFiles([])
      setSlipCode(''); setPrintedTotal(null)
      setEditing(false); setManual({}); setPreview(null)
      setReceiveKey(newUuid())
    } catch {
      // Lỗi đã hiện ở banner của InspectionProvider - giữ nguyên dữ liệu đã nhập để bấm lại.
    } finally {
      setBusy(false)
    }
  }

  const onConfirm = () => { void doReceive() }

  const printSlip = async () => {
    setSlipErr('')
    try {
      const { code } = await reserveReceiptSlipCode(slipCode || undefined)
      setSlipCode(code)
      setPrintedTotal(total)
      printReceiptSlip({
        code,
        warehouseCode: it.warehouseCode,
        warehouseName: it.khoLabel || it.warehouseCode,
        supplierName: it.supplierName ?? '',
        orderCode: it.supplierOrderCode ? `${it.supplierName ?? 'NCC'} – Số ${it.supplierOrderCode}` : '',
        materialCode: it.materialCode ?? '',
        materialName: it.name,
        spec: [it.spec, it.stockLengthMm != null ? `Cây ${it.stockLengthMm}mm` : null].filter(Boolean).join(' · '),
        unit: it.unit,
        isSteel: !!it.isSteel,
        deliveredQty: deliveredNum,
        receivedQty: total,
        parts: allocation.map(a => ({ lenhCode: a.lenhCode, qty: a.final })),
      })
    } catch (e) {
      setSlipErr(e instanceof Error ? e.message : String(e))
    }
  }

  const doReject = async () => {
    setBusy(true)
    try {
      const fileUrls = await uploadAll(rejectFiles)
      await rejectPurchase({ itemIds, deliveredQty: deliveredNum || 0, reason: rejectReason.trim(), fileUrls }, rejectKey, proposalIds)
      setDone('Đã ghi "Từ chối nhận" và báo người mua phụ trách. Không cộng tồn kho.')
      setRejecting(false); setRejectReason(''); setRejectFiles([])
      setRejectKey(newUuid())
    } catch {
      // banner
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = { padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right' as const, background: 'var(--surface)', color: 'var(--text)' }
  const btn = (enabled: boolean, color: string) => ({ padding: '7px 14px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: enabled ? color : 'var(--surface2)', color: enabled ? '#fff' : 'var(--text3)', cursor: enabled ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' as const })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {it.name}{it.spec ? ` · ${it.spec}` : ''}
            {it.stockLengthMm != null && <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--fg-e65100)' }}>cây {it.stockLengthMm}mm</span>}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
            {it.supplierOrderCode ? `Đơn ${it.supplierName ?? 'NCC'} – Số ${it.supplierOrderCode}` : 'Chưa vào đơn đặt hàng'} · Kho {it.warehouseCode}
            {' · '}Còn chờ nhận <b style={{ color: 'var(--text)' }}>{fmtQty(remaining)} {it.unit}</b>
          </div>
        </div>
      </div>

      {done && (
        <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-f0fdf4, #f0fdf4)', color: 'var(--fg-16a34a)', fontSize: 13 }}>✓ {done}</div>
      )}

      {/* Số lượng */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            Số lượng thực nhận
            <span title="Không quy đổi: nhập số lượng ở ô đầu, để trống ô sau. Có quy đổi (vd bì zip 1kg = 130 cái, nhận 50kg): ô đầu 130, ô sau 50." style={{ display: 'inline-flex', cursor: 'help' }}><HelpCircle size={13} /></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" min={0} step="any" value={unitRate} onChange={e => setUnitRate(e.target.value)} placeholder="Số lượng" style={{ ...inputStyle, width: 100 }} />
            <span style={{ color: 'var(--text3)' }}>×</span>
            <input type="number" min={0} step="any" value={supplierUnit} onChange={e => setSupplierUnit(e.target.value)} placeholder="1" title="Chỉ khi có quy đổi: số lượng theo đơn vị bên bán" style={{ ...inputStyle, width: 64 }} />
            {total > 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>= <b style={{ color: 'var(--text)' }}>{fmtQty(total)}</b> {it.unit}</span>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
            SL trên phiếu giao {hasConversion ? '(đơn vị bên bán)' : `(${it.unit})`}
          </div>
          <input type="number" min={0} step="any" value={delivered} onChange={e => setDelivered(e.target.value)} style={{ ...inputStyle, width: 110, borderColor: deliveredMismatch ? 'var(--fg-dc2626, #dc2626)' : 'var(--border)' }} />
        </div>
      </div>
      {deliveredMismatch && (
        <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--fg-dc2626, #dc2626)' }}>
          Số thực nhận ({fmtQty(checkedQty)}) khác số trên phiếu giao ({fmtQty(deliveredNum)}) - không nhận được. NCC sửa phiếu giao rồi mới nhận, hoặc bấm “Từ chối nhận”.
        </div>
      )}

      {/* Bảng chia cho các lệnh */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>Lệnh</th>
              <th style={th}>Hạn cần</th>
              <th style={{ ...th, textAlign: 'right' }}>Cần mua</th>
              <th style={{ ...th, textAlign: 'right' }}>Số mua</th>
              <th style={{ ...th, textAlign: 'right' }}>Đã nhận</th>
              <th style={{ ...th, textAlign: 'right' }}>Chia lần này</th>
            </tr>
          </thead>
          <tbody>
            {(preview ? allocation : [...group.lines].sort((a, b) => (lineDeadline(a) ?? '9999').localeCompare(lineDeadline(b) ?? '9999')).map(l => ({ itemId: l.item.itemId!, lenhCode: l.proposal.lenhCode, deadline: lineDeadline(l), buyQty: l.item.buyQty, purchaseQty: l.item.purchaseQty, receivedQty: l.item.receivedQty ?? 0, qty: 0, final: 0 }))).map(a => (
              <tr key={a.itemId} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{a.lenhCode}</td>
                <td style={td}>{fmtDate(a.deadline)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtQty(a.buyQty)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtQty(a.purchaseQty)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtQty(a.receivedQty)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                  {editing && preview ? (
                    <input type="number" min={0} step="any" value={manual[a.itemId] ?? String(a.qty)} onChange={e => setManual(m => ({ ...m, [a.itemId]: e.target.value }))} style={{ ...inputStyle, width: 90 }} />
                  ) : preview ? fmtQty(a.final) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap' }}>
        {previewError && <span style={{ color: 'var(--fg-dc2626, #dc2626)' }}>{previewError}</span>}
        {preview && group.lines.length > 1 && (
          editing ? (
            <>
              <span style={{ color: allocOk ? 'var(--text3)' : 'var(--fg-dc2626, #dc2626)' }}>Tổng đã chia {fmtQty(allocSum)} / {fmtQty(total)} {it.unit}</span>
              <button onClick={() => { setEditing(false); setManual({}) }} style={{ fontSize: 12, border: 'none', background: 'none', color: 'var(--fg-2563eb)', cursor: 'pointer', padding: 0 }}>Dùng lại cách chia của hệ thống</button>
            </>
          ) : (
            <>
              <span>Hệ thống chia: lệnh cần sớm nhất được lấp đủ trước.</span>
              <button onClick={() => setEditing(true)} style={{ fontSize: 12, border: 'none', background: 'none', color: 'var(--fg-2563eb)', cursor: 'pointer', padding: 0 }}>Chỉnh phân bổ</button>
            </>
          )
        )}
      </div>

      {overQty > 0 && (
        <div style={{ border: '1px solid var(--fg-d97706)', borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-d97706)' }}>
            Nhận vượt {fmtQty(overQty)} {it.unit} so với số còn chờ nhận của đơn ({fmtQty(remaining)} {it.unit})
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Phần vượt vào tồn chưa giữ cho lệnh nào, hệ thống báo người mua phụ trách. Bắt buộc ghi lý do.</div>
          <textarea value={overReason} onChange={e => setOverReason(e.target.value)} rows={2} placeholder="Lý do nhận vượt (vd: NCC giao nguyên bó, không tách lẻ)" style={{ padding: 8, border: `1px solid ${overReasonMissing ? 'var(--fg-dc2626, #dc2626)' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
          <DocSlot label="Ảnh bằng chứng (nếu có)" required={false} files={overFiles} onChange={setOverFiles} />
        </div>
      )}

      {/* Chứng từ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
        <DocSlot label="(1) Phiếu giao hàng của NCC" required files={supplierSlips} onChange={setSupplierSlips} />
        <DocSlot label="(2) Phiếu đề xuất Giám đốc ký" required files={approvalFiles} onChange={setApprovalFiles} existing={approvalExisting} />
        <DocSlot label="(3) Phiếu nhập kho" required files={receiptSlips} onChange={setReceiptSlips} />
        {it.isSteel && <DocSlot label="(4) Phiếu cân xe" required files={weighSlips} onChange={setWeighSlips} />}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={() => void printSlip()} disabled={!canPrint} style={{ ...btn(canPrint, 'var(--bg-2563eb)') }}>{slipCode ? 'In lại phiếu nhập' : 'In phiếu nhập'}</button>
        {slipCode && <span style={{ fontSize: 12 }}>Số phiếu <b style={{ fontFamily: 'monospace' }}>{slipCode}</b></span>}
        <button onClick={onConfirm} disabled={!canConfirm} style={btn(canConfirm, 'var(--bg-2e7d32)')}>{busy ? 'Đang ghi…' : 'Xác nhận nhập kho'}</button>
        <button onClick={() => setRejecting(r => !r)} disabled={busy} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--fg-dc2626, #dc2626)', cursor: 'pointer' }}>Từ chối nhận</button>
        {!canConfirm && total > 0 && missingDocs.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Còn thiếu ảnh: {missingDocs.join(', ')}</span>
        )}
        {overReasonMissing && <span style={{ fontSize: 12, color: 'var(--fg-d97706)' }}>Ghi lý do nhận vượt</span>}
        {canPrint && !slipCode && <span style={{ fontSize: 12, color: 'var(--text3)' }}>In phiếu nhập → người giao ký → chụp tải vào ô (3) rồi mới nhập được</span>}
        {slipStale && <span style={{ fontSize: 12, color: 'var(--fg-d97706)' }}>Số lượng đã đổi sau khi in - bấm “In lại phiếu nhập”</span>}
        {slipErr && <span style={{ fontSize: 12, color: 'var(--fg-dc2626, #dc2626)' }}>{slipErr}</span>}
      </div>

      {rejecting && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Từ chối nhận - không cộng tồn kho, hệ thống báo người mua phụ trách</div>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Lý do (vd: cân lại thiếu 2 kg so với phiếu giao)" style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
          <DocSlot label="Ảnh bằng chứng" required files={rejectFiles} onChange={setRejectFiles} />
          <div>
            <button
              onClick={() => void doReject()}
              disabled={busy || rejectReason.trim().length < 3 || rejectFiles.length === 0}
              style={btn(!busy && rejectReason.trim().length >= 3 && rejectFiles.length > 0, 'var(--fg-dc2626, #dc2626)')}
            >Xác nhận từ chối</button>
          </div>
        </div>
      )}

      <ReceiptHistory lines={group.lines} unit={it.unit} />
    </div>
  )
}

// ── Lịch sử nhận: gom các phần chia của cùng 1 phiếu ────────────────────────
function ReceiptHistory({ lines, unit }: { lines: Line[]; unit: string }) {
  const entries = useMemo(() => {
    const map = new Map<string, { log: PurchaseReceiptLog; parts: { lenhCode: string; qty: number }[] }>()
    for (const l of lines) {
      for (const log of l.item.receiptLogs ?? []) {
        const key = log.receiptId ?? `log:${log.id}`
        const cur = map.get(key) ?? { log, parts: [] }
        cur.parts.push({ lenhCode: l.proposal.lenhCode, qty: log.receivedQty })
        map.set(key, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.log.receivedAt.localeCompare(a.log.receivedAt))
  }, [lines])
  if (entries.length === 0) return null

  const docs = (log: PurchaseReceiptLog) => [
    ['Phiếu giao', log.supplierSlipUrls], ['Phiếu GĐ ký', log.approvalFileUrls], ['Phiếu nhập', log.receiptSlipUrls], ['Phiếu cân', log.weighSlipUrls],
  ] as const

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Lịch sử nhận hàng</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
        {entries.map(({ log, parts }) => (
          <div key={log.receiptId ?? log.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
            <span style={{ color: 'var(--text)' }}>{format(new Date(log.receivedAt), 'dd/MM HH:mm')}</span>
            {' · '}<b style={{ color: 'var(--text)' }}>{fmtQty(log.receiptTotalQty ?? parts.reduce((s, p) => s + p.qty, 0))} {unit}</b>
            {parts.length > 1 || log.receiptTotalQty != null ? ` → ${parts.map(p => `${p.lenhCode} ${fmtQty(p.qty)}`).join(', ')}` : ''}
            {log.allocationAdjusted && <span style={{ color: 'var(--fg-d97706)' }}> (thủ kho chỉnh phân bổ)</span>}
            {(log.overQty ?? 0) > 0 && <span style={{ color: 'var(--fg-d97706)' }}> · nhận vượt {fmtQty(log.overQty!)} {unit}{log.overReason ? `: ${log.overReason}` : ''}</span>}
            {(log.overFileUrls ?? []).map((u, i) => (
              <span key={u}> · <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-2563eb)' }}>Ảnh nhận vượt{(log.overFileUrls ?? []).length > 1 ? ` ${i + 1}` : ''}</a></span>
            ))}
            {log.receivedByName ? ` · ${log.receivedByName}` : ''}
            {docs(log).map(([label, urls]) => (urls ?? []).map((u, i) => (
              <span key={u}> · <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-2563eb)' }}>{label}{(urls ?? []).length > 1 ? ` ${i + 1}` : ''}</a></span>
            )))}
            {log.receiptFileUrl && <> · <a href={log.receiptFileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-2563eb)' }}>ảnh</a></>}
          </div>
        ))}
      </div>
    </div>
  )
}
