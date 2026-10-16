'use client'
import { focusAttr } from '../../../utils/notificationLink'
import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowLeftRight, ChevronLeft, HelpCircle, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import { canReceiveAt } from '../../../types/warehouse-transfer'
import { useUrlState } from '../../../hooks/useUrlState'
import { NhapNoiBoSection } from '../InboundWarehouse/InternalTransferSections'
import { useInspection, PROPOSAL_STATUS_LABELS, type PurchaseProposal, type PurchaseProposalItem } from '../../../context/InspectionContext'
import { useConfirm } from '../../../hooks/useConfirm'
import { uploadImage } from '../../../services/api'

// Key theo itemId (2026-08-26, L6) - KHÔNG phải materialId: 1 vật tư đã PURCHASED mà lại phát
// sinh thiếu thêm tách thành DÒNG MỚI cùng materialId (xem purchasing-api.ts đầu file), key theo
// materialId sẽ gộp nhầm 2 dòng khi thủ kho xác nhận nhận hàng.
const itemKey = (item: PurchaseProposalItem) => item.itemId ?? String(item.materialId)
import { compactTh as th, compactTd as td } from '../../../styles/table'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import MobileListCards from '../../../components/MobileListCards'
import { pageTitle } from '../../../styles/typography'

// ── NhapKhoSection: list đề xuất đã duyệt (đang mua/đã mua) → detail nhập kho ─
// Nguồn dữ liệu là PurchaseProposal thật (đã qua Purchasing báo giá + Boss duyệt),
// không tự tính từ SKU nữa — hàng về vào đúng kho `item.warehouseCode` (BE
// PurchaseProposalItemResponseDto.warehouseCode: Material.warehouseId, TRỪ vật tư đóng gói thì
// là kho thành phẩm QLSX đã chọn cho PI, xem PurchaseProposalItem.receiveWarehouseCode) - so trực
// tiếp mã kho của DÒNG, KHÔNG suy diễn lại qua Material.warehouseId (2026-09-04: sửa cùng lúc test
// sống fix routing kho đóng gói - trước đó suy diễn qua Material bỏ lỡ hẳn override, khiến thủ kho
// đúng (vd "Kho thành phẩm 2") không bao giờ thấy dòng cần nhận, trong khi thủ kho SAI (kho mặc
// định của vật tư) lại thấy và có thể nhận nhầm).
function NhapKhoSection({ lockedGroup }: { lockedGroup?: string | null }) {
  // Điện thoại: danh sách PI/PO dạng thẻ (MobileListCards) thay bảng 4-5 cột chiều rộng cố định.
  const isMobile = useIsMobile()
  const { proposals, receiveProposalItem } = useInspection()
  const { ask, confirmModal } = useConfirm()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // unitRateInputs[`${proposalId}:${itemId}`] = Ô1 "Số lượng/1 đơn vị tính" đang nhập dở (2026-10-16,
  // thay cho hệ số quy đổi cố định Material.khoUnitFactor đã xoá - vật tư không chênh lệch đơn vị
  // thì đây chính là số lượng nhận thực tế).
  const [unitRateInputs, setUnitRateInputs] = useState<Record<string, string>>({})
  // supplierUnitInputs[...] = Ô2 "Số lượng đơn vị tính bên bán" đang nhập dở - để trống = BE tự
  // mặc định 1 (vật tư không chênh lệch đơn vị không cần sửa ô này).
  const [supplierUnitInputs, setSupplierUnitInputs] = useState<Record<string, string>>({})
  // fileInputs[...] = ảnh phiếu nhập kho đã chọn, CHƯA upload - chỉ upload lúc bấm Xác nhận (tránh
  // rác Cloudinary nếu thủ kho đổi ý), cùng idiom SpecSteelPage.tsx#photoFile.
  const [fileInputs, setFileInputs] = useState<Record<string, File | null>>({})
  // expandedHistory[...] = có đang mở khối "Lịch sử nhận hàng" của dòng này không.
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({})

  // Dòng vật tư chưa gán kho (BE trả '—', xem purchasing-api.ts#toItem) vẫn hiện cho mọi thủ kho
  // để không "mồ côi" tới khi có người nhận - cùng nguyên tắc đã áp dụng cho routing Mua hàng
  // (xem purchasingRouting.ts).
  const itemInScope = (item: PurchaseProposalItem): boolean => {
    if (!lockedGroup) return true // Tổng kho/Giám đốc thấy hết
    if (!item.warehouseCode || item.warehouseCode === '—') return true
    return item.warehouseCode === lockedGroup
  }

  // Vật tư đã tới lượt nhận hàng - item-level (2026-08-25): rollup p.status không lên
  // 'purchasing'/'purchased' cho tới khi MỌI dòng của đề xuất gộp cùng ở đó, nên Thủ kho phải
  // thấy được item PURCHASING của Nhàn ngay cả khi item của Trâm trong cùng proposal còn QUOTING.
  const itemReceivable = (item: PurchaseProposalItem): boolean =>
    itemInScope(item) && (item.status === 'purchasing' || item.status === 'purchased')

  // Tổng kho/Giám đốc (lockedGroup null) thấy hết, thủ kho theo scope chỉ thấy đề xuất có
  // ít nhất 1 dòng vật tư thuộc kho mình VÀ đã tới lượt nhận hàng.
  const relevant = proposals.filter(p => p.items.some(itemReceivable))
  const selected = relevant.find(p => p.id === selectedId) ?? null
  const visibleItems = selected ? selected.items.filter(itemReceivable) : []

  const inputKey = (proposalId: string, itemId: string) => `${proposalId}:${itemId}`

  // Key đang có request bay - khoá nút để không gửi 2 lần cùng 1 dòng (mỗi lần gửi sinh một
  // Idempotency-Key mới nên BE coi là 2 đợt nhận riêng biệt, sẽ cộng kho 2 lần).
  const [pending, setPending] = useState<Record<string, boolean>>({})

  // CHỈ xoá ô nhập khi BE đã ghi nhận xong. Trước 2026-08-15 hai dòng setInputs/setKgInputs chạy
  // ngay sau lời gọi fire-and-forget: BE trả lỗi thì ô vẫn trống đi như bình thường, bảng không
  // đổi, thủ kho tưởng đã nhập xong trong khi hàng đã nằm trong kho vật lý mà hệ thống không ghi
  // (D.a1-silent-write-failure). Lỗi nay hiện ở banner của InspectionProvider và số vừa gõ được
  // GIỮ LẠI để bấm lại, không phải gõ lại từ đầu.
  const confirmItem = async (p: PurchaseProposal, itemId: string) => {
    const key = inputKey(p.id, itemId)
    if (pending[key]) return
    const unitRateQty = Math.max(0, Number(unitRateInputs[key]) || 0)
    if (unitRateQty <= 0) return
    const supplierUnitRaw = Number(supplierUnitInputs[key])
    const supplierUnitQty = supplierUnitRaw > 0 ? supplierUnitRaw : undefined
    setPending(prev => ({ ...prev, [key]: true }))
    try {
      const file = fileInputs[key]
      const receiptFileUrl = file ? await uploadImage(file) : undefined
      await receiveProposalItem(p.id, itemId, { unitRateQty, supplierUnitQty, receiptFileUrl })
      setUnitRateInputs(prev => ({ ...prev, [key]: '' }))
      setSupplierUnitInputs(prev => ({ ...prev, [key]: '' }))
      setFileInputs(prev => ({ ...prev, [key]: null }))
    } catch {
      // Banner đã hiện ở InspectionProvider - ở đây chỉ cần KHÔNG xoá ô nhập.
    } finally {
      setPending(prev => ({ ...prev, [key]: false }))
    }
  }

  // BE (2026-09-19, theo yêu cầu người dùng) không còn chặn nhận vượt số đặt mua - ghi đúng số
  // thật luôn. Cảnh báo + bắt xác nhận chuyển hẳn sang đây: vượt buyQty thì hỏi lại qua popup
  // (không phải window.confirm - dùng ConfirmModal chung của app) trước khi gọi API, không vượt
  // thì xác nhận thẳng như cũ. Popup cố ý ngắn gọn, KHÔNG dùng `danger` (icon/nút đỏ) - góp ý người
  // dùng 19/09: đây chỉ là hỏi lại số liệu, không phải cảnh báo lỗi nghiêm trọng.
  const handleConfirmClick = (p: PurchaseProposal, item: PurchaseProposalItem) => {
    const key = inputKey(p.id, itemKey(item))
    const unitRateQty = Math.max(0, Number(unitRateInputs[key]) || 0)
    const supplierUnitRaw = Number(supplierUnitInputs[key])
    const supplierUnitQty = supplierUnitRaw > 0 ? supplierUnitRaw : 1
    const qty = unitRateQty * supplierUnitQty
    const received = item.receivedQty ?? 0
    const total = received + qty
    if (total > item.buyQty) {
      ask(
        {
          message: `Xác nhận đã nhận ${total} ${item.unit} "${item.name}"?`,
          confirmLabel: 'Xác nhận',
        },
        () => confirmItem(p, itemKey(item)),
      )
      return
    }
    void confirmItem(p, itemKey(item))
  }

  // ── Detail view ──────────────────────────────────────────
  if (selected) {
    const cfg = PROPOSAL_STATUS_LABELS[selected.status]
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedId(null)}
              style={{ flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
            >
              <ChevronLeft size={15} /> Quay lại
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>
                {selected.salesOrderCode ?? '—'}
                <span style={{ color: 'var(--text3)', margin: '0 6px' }}>·</span>
                {selected.piCode}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
                {selected.skuCode}{selected.skuName ? ` — ${selected.skuName}` : ''}
                {selected.deadline && <> · Hạn giao: {format(new Date(selected.deadline), 'dd/MM/yyyy')}</>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'center' }}>
            {/* Phiếu Sếp ký duyệt lô mua này (2026-08-27) - từ khi việc duyệt mua diễn ra ngoài
                phần mềm, đây là thứ Thủ kho đối chiếu trước khi nhận hàng. Lấy từ dòng đầu tiên có
                file: 1 lượt bấm "Sếp đã duyệt" gắn CÙNG 1 file cho mọi dòng của lượt đó. */}
            {(() => {
              const approvalFileUrl = visibleItems.find(i => i.approvalFileUrl)?.approvalFileUrl
              return approvalFileUrl ? (
                <a
                  href={approvalFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--fg-2563eb)', border: '1px solid var(--fg-bfdbfe)', background: 'var(--bg-eff6ff)', borderRadius: 20, padding: '4px 12px' }}
                >
                  <Paperclip size={12} /> Xem file Sếp duyệt
                </a>
              ) : null
            })()}
            <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>
              {cfg.label}
            </span>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1020, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 240 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 360 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Tên vật tư</th>
                <th style={th}>Quy cách</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>SL cần mua</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã nhận</th>
                <th style={th}>Nhập thêm</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map(item => {
                const received = item.receivedQty ?? 0
                const done = received >= item.buyQty
                const partial = received > 0 && !done
                const key = inputKey(selected.id, itemKey(item))
                const unitRateVal = unitRateInputs[key] ?? ''
                const supplierUnitVal = supplierUnitInputs[key] ?? ''
                const fileVal = fileInputs[key] ?? null
                const isPending = !!pending[key]
                const canConfirm = !done && !!unitRateVal && Number(unitRateVal) > 0 && !isPending
                // Ô1 × Ô2 (mặc định Ô2=1 khi để trống) - công thức GIỐNG NHAU cho mọi vật tư, thay
                // cho hệ số quy đổi cố định Material.khoUnitFactor đã xoá (2026-10-16): vật tư
                // không chênh lệch đơn vị chỉ cần nhập Ô1, giữ Ô2 trống.
                const computedQty =
                  Number(unitRateVal) > 0
                    ? Number(unitRateVal) * (Number(supplierUnitVal) > 0 ? Number(supplierUnitVal) : 1)
                    : null
                const logs = item.receiptLogs ?? []
                return (
                  <tr key={itemKey(item)} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                      {/* Chỉ vật tư sắt có (2026-08-26, xem PurchaseProposalItem.stockLengthMm) -
                          Thủ kho đối chiếu hàng về đúng cây đã đặt, nhất là từ khi có thể ra cây
                          đặt riêng khác 6000mm mặc định (auto_scan). */}
                      {item.stockLengthMm != null && (
                        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: 'var(--fg-e65100)' }}>· cây {item.stockLengthMm}mm</span>
                      )}
                    </td>
                    <td style={{ ...td, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.spec || '—'}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{item.unit}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{item.buyQty}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? 'var(--fg-16a34a)' : partial ? 'var(--fg-d97706)' : 'var(--text)' }}>
                      {received}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {done ? (
                          <span style={{ fontSize: 12, color: 'var(--fg-16a34a)', fontWeight: 600 }}>✓ Đã nhận đủ</span>
                        ) : (
                          <>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                              <input
                                type="number" min={0} step="any"
                                value={unitRateVal}
                                onChange={e => setUnitRateInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder="Số lượng"
                                title="Không có quy đổi: nhập thẳng số lượng thực nhận. Có quy đổi (vd bì zip 1kg = 130 cái): nhập tỷ lệ của lô này, vd 130."
                                style={{ width: 76, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                              />
                              <span style={{ fontSize: 12, color: 'var(--text3)' }}>×</span>
                              <input
                                type="number" min={0} step="any"
                                value={supplierUnitVal}
                                onChange={e => setSupplierUnitInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder="1"
                                title="Chỉ cần nhập khi có quy đổi: số lượng theo đơn vị bên bán, vd 50 nếu nhận 50kg. Không có quy đổi thì để trống (mặc định 1)."
                                style={{ width: 48, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                              />
                              <span
                                title="Không quy đổi: chỉ cần nhập số lượng ở ô trước, để trống ô sau. Có quy đổi (vd bì zip 1kg = 130 cái, nhận 50kg): ô trước nhập 130, ô sau nhập 50."
                                style={{ display: 'inline-flex', cursor: 'help', flexShrink: 0 }}
                              >
                                <HelpCircle size={15} color="var(--text3)" />
                              </span>
                              <button
                                onClick={() => handleConfirmClick(selected, item)}
                                disabled={!canConfirm}
                                style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: canConfirm ? 'var(--bg-2e7d32)' : 'var(--surface2)', color: canConfirm ? '#fff' : 'var(--text3)', cursor: canConfirm ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                              >{isPending ? 'Đang ghi…' : 'Xác nhận'}</button>
                              {computedQty != null && (
                                <span style={{ fontSize: 11, color: 'var(--text3)' }}>→ <b style={{ color: 'var(--text)' }}>{computedQty.toLocaleString('vi-VN')}</b> {item.unit}</span>
                              )}
                            </div>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--fg-2563eb)', cursor: 'pointer', width: 'fit-content' }}>
                              <Paperclip size={12} />
                              {fileVal ? fileVal.name : 'Ảnh phiếu nhập kho'}
                              <input
                                type="file" accept="image/*" hidden
                                onChange={e => setFileInputs(prev => ({ ...prev, [key]: e.target.files?.[0] ?? null }))}
                              />
                            </label>
                          </>
                        )}
                        {logs.length > 0 && (
                          <button
                            onClick={() => setExpandedHistory(prev => ({ ...prev, [key]: !prev[key] }))}
                            style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', width: 'fit-content' }}
                          >
                            {expandedHistory[key] ? '▾' : '▸'} Lịch sử nhận hàng ({logs.length})
                          </button>
                        )}
                        {expandedHistory[key] && logs.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, borderLeft: '2px solid var(--border)', paddingLeft: 6, fontSize: 11, color: 'var(--text3)' }}>
                            {logs.map(r => (
                              <div key={r.id}>
                                {format(new Date(r.receivedAt), 'dd/MM HH:mm')} · {r.unitRateQty} × {r.supplierUnitQty} = {r.receivedQty} {item.unit}
                                {r.receivedByName ? ` · ${r.receivedByName}` : ''}
                                {r.receiptFileUrl && <> · <a href={r.receiptFileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-2563eb)' }}>ảnh</a></>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {confirmModal}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────
  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Đề xuất mua đã được duyệt — ghi nhận vật tư thực nhận vào kho
      </div>
      {isMobile ? (
        <MobileListCards emptyText="Không có đề xuất nào đang chờ nhập kho" items={relevant.map(p => { const cfg = PROPOSAL_STATUS_LABELS[p.status]; return { key: String(p.id), onClick: () => setSelectedId(p.id), title: <><b>{p.skuCode}</b>{p.skuName && <span style={{ color: 'var(--text3)' }}> — {p.skuName}</span>}</>, badge: <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>, meta: [{ label: 'PO', value: p.salesOrderCode ?? '—' }, { label: 'PI', value: p.piCode }] } })} />
      ) : (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 100 }} />
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 160 }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>PO</th>
              <th style={th}>PI</th>
              <th style={th}>SKU</th>
              <th style={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {relevant.map(p => {
              const cfg = PROPOSAL_STATUS_LABELS[p.status]
              return (
                <tr
                  key={p.id}
                  {...focusAttr('PURCHASE_PROPOSAL', p.id)}
                  onClick={() => setSelectedId(p.id)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...td, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                    {p.salesOrderCode ?? '—'}
                  </td>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                    {p.piCode}
                  </td>
                  <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>{p.skuCode}</span>
                    {p.skuName && (
                      <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{p.skuName}</>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {relevant.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}><div className="table-empty-msg">Không có đề xuất nào đang chờ nhập kho</div></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────
export default function NhapKhoPage({ lockedGroup }: { lockedGroup?: string | null } = {}) {
  // `sub` trong query string - cho `WAREHOUSE_TRANSFER_CREATED` mở đúng sub-tab "Nhập nội bộ" thay
  // vì rơi vào "Nhập kho" (mua hàng) mặc định - 2 sub-tab hoàn toàn khác chức năng, không có route
  // riêng trước đây (xem changelog notification 2026-09-25 mục 23.2). Cùng cơ chế `p` ở cấp app
  // shell, chỉ khác đây là sub-tab lồng bên trong 1 page đã có `p='nhap-kho'`.
  const [urlSub, setUrlSub] = useUrlState('sub')
  const [nhapTab, setNhapTabState] = useState<'nhap' | 'noi-bo'>(() => (urlSub === 'noi-bo' ? 'noi-bo' : 'nhap'))
  const setNhapTab = (id: 'nhap' | 'noi-bo') => { setNhapTabState(id); setUrlSub(id === 'noi-bo' ? 'noi-bo' : null) }
  useEffect(() => {
    if (urlSub === 'noi-bo' && nhapTab !== 'noi-bo') setNhapTabState('noi-bo')
  }, [urlSub])

  const showNoiBo = canReceiveAt(lockedGroup ?? '')

  const tabs = [
    ['nhap',    'Nhập kho',           ArrowDownToLine],
    ...(showNoiBo ? [['noi-bo', 'Nhập nội bộ', ArrowLeftRight] as const] : []),
  ] as const

  return (
    <div>
      <h2 style={{ ...pageTitle, marginBottom: 'var(--space-5)' }}>Nhập kho</h2>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setNhapTab(id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', fontSize: 13, fontWeight: nhapTab === id ? 700 : 500,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: nhapTab === id ? 'var(--fg-2e7d32)' : 'var(--text2)',
            borderBottom: nhapTab === id ? '2px solid var(--fg-2e7d32)' : '2px solid transparent',
            marginBottom: -1,
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {nhapTab === 'nhap'    && <NhapKhoSection lockedGroup={lockedGroup} />}
      {nhapTab === 'noi-bo'  && showNoiBo && <NhapNoiBoSection warehouseCode={lockedGroup ?? ''} />}
    </div>
  )
}
