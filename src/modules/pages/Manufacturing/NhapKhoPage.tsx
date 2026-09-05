'use client'
import { useState } from 'react'
import { ArrowDownToLine, ArrowLeftRight, ChevronLeft, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import { canReceiveAt } from '../../../types/warehouse-transfer'
import { NhapNoiBoSection } from '../InboundWarehouse/InternalTransferSections'
import { useInspection, PROPOSAL_STATUS_LABELS, type PurchaseProposal, type PurchaseProposalItem } from '../../../context/InspectionContext'

// Key theo itemId (2026-08-26, L6) - KHÔNG phải materialId: 1 vật tư đã PURCHASED mà lại phát
// sinh thiếu thêm tách thành DÒNG MỚI cùng materialId (xem purchasing-api.ts đầu file), key theo
// materialId sẽ gộp nhầm 2 dòng khi thủ kho xác nhận nhận hàng.
const itemKey = (item: PurchaseProposalItem) => item.itemId ?? String(item.materialId)
import { compactTh as th, compactTd as td } from '../../../styles/table'

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
  const { proposals, receiveProposalItem } = useInspection()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // inputs[`${proposalId}:${itemName}`] = số lượng đang nhập dở (theo unit, vd cái)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  // kgInputs[`${proposalId}:${itemName}`] = số lượng đang nhập dở theo purchaseUnit (vd kg) -
  // chỉ dùng để gợi ý auto-fill `inputs` (cái), người dùng vẫn sửa tay được sau khi auto-fill.
  const [kgInputs, setKgInputs] = useState<Record<string, string>>({})

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
    const qty = Math.max(0, Number(inputs[key]) || 0)
    if (qty <= 0) return
    const kgVal = Math.max(0, Number(kgInputs[key]) || 0)
    setPending(prev => ({ ...prev, [key]: true }))
    try {
      await receiveProposalItem(p.id, itemId, qty, kgVal > 0 ? kgVal : undefined)
      setInputs(prev => ({ ...prev, [key]: '' }))
      setKgInputs(prev => ({ ...prev, [key]: '' }))
    } catch {
      // Banner đã hiện ở InspectionProvider - ở đây chỉ cần KHÔNG xoá ô nhập.
    } finally {
      setPending(prev => ({ ...prev, [key]: false }))
    }
  }

  // ── Detail view ──────────────────────────────────────────
  if (selected) {
    const cfg = PROPOSAL_STATUS_LABELS[selected.status]
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSelectedId(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
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
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#2563eb', border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 20, padding: '4px 12px' }}
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

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col style={{ width: 90 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 240 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Tên vật tư</th>
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
                const inputVal = inputs[key] ?? ''
                const kgVal = kgInputs[key] ?? ''
                const isPending = !!pending[key]
                const canConfirm = !done && !!inputVal && Number(inputVal) > 0 && !isPending
                const hasConversion = !!item.purchaseUnit && !!item.khoUnitFactor
                // Vấn đề M4 audit 26/08 - ô SL cho sửa tay tự do, trước đây không đối chiếu gì với
                // số gợi ý tính từ ô kg (dòng dưới). Chỉ CẢNH BÁO (không chặn Xác nhận) vì lệch có
                // thể hợp lý (làm tròn theo quy cách đóng gói thật) - lệch >5% mới coi là "đáng kể".
                const expectedQty = hasConversion && Number(kgVal) > 0 ? Number(kgVal) * item.khoUnitFactor! : null
                const qtyMismatch =
                  expectedQty != null && !!inputVal && Number(inputVal) > 0
                    ? Math.abs(Number(inputVal) - expectedQty) / expectedQty > 0.05
                    : false
                return (
                  <tr key={itemKey(item)} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                      {/* Chỉ vật tư sắt có (2026-08-26, xem PurchaseProposalItem.stockLengthMm) -
                          Thủ kho đối chiếu hàng về đúng cây đã đặt, nhất là từ khi có thể ra cây
                          đặt riêng khác 6000mm mặc định (auto_scan). */}
                      {item.stockLengthMm != null && (
                        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#e65100' }}>· cây {item.stockLengthMm}mm</span>
                      )}
                    </td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{item.unit}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{item.buyQty}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: done ? '#16a34a' : partial ? '#d97706' : 'var(--text)' }}>
                      {received}
                    </td>
                    <td style={td}>
                      {done ? (
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đã nhận đủ</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {hasConversion && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                type="number" min={0} step="any"
                                value={kgVal}
                                onChange={e => {
                                  const v = e.target.value
                                  setKgInputs(prev => ({ ...prev, [key]: v }))
                                  const kg = Number(v)
                                  if (kg > 0 && item.khoUnitFactor) {
                                    setInputs(prev => ({ ...prev, [key]: String(Math.round(kg * item.khoUnitFactor!)) }))
                                  }
                                }}
                                placeholder={`Số ${item.purchaseUnit} nhận`}
                                style={{ width: 84, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                              />
                              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.purchaseUnit} → tự quy đổi {item.unit}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number" min={1}
                              value={inputVal}
                              onChange={e => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                              placeholder="SL"
                              style={{ width: 64, padding: '4px 8px', border: `1px solid ${qtyMismatch ? '#d97706' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.unit}{hasConversion ? ' (có thể sửa tay)' : ''}</span>
                            <button
                              onClick={() => void confirmItem(selected, itemKey(item))}
                              disabled={!canConfirm}
                              style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: canConfirm ? '#2e7d32' : 'var(--surface2)', color: canConfirm ? '#fff' : 'var(--text3)', cursor: canConfirm ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                            >{isPending ? 'Đang ghi…' : 'Xác nhận'}</button>
                          </div>
                          {qtyMismatch && (
                            <div style={{ fontSize: 11, color: '#d97706' }}>
                              ⚠ Lệch nhiều so với gợi ý ({Math.round(expectedQty!)} {item.unit} theo {kgVal} {item.purchaseUnit}) — kiểm tra lại trước khi xác nhận
                            </div>
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

  // ── List view ────────────────────────────────────────────
  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Đề xuất mua đã được duyệt — ghi nhận vật tư thực nhận vào kho
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
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
                <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                  Không có đề xuất nào đang chờ nhập kho
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────
export default function NhapKhoPage({ lockedGroup }: { lockedGroup?: string | null } = {}) {
  const [nhapTab, setNhapTab] = useState<'nhap' | 'noi-bo'>('nhap')

  const showNoiBo = canReceiveAt(lockedGroup ?? '')

  const tabs = [
    ['nhap',    'Nhập kho',           ArrowDownToLine],
    ...(showNoiBo ? [['noi-bo', 'Nhập nội bộ', ArrowLeftRight] as const] : []),
  ] as const

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Nhập kho</h2>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setNhapTab(id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', fontSize: 13, fontWeight: nhapTab === id ? 700 : 500,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: nhapTab === id ? '#2e7d32' : 'var(--text2)',
            borderBottom: nhapTab === id ? '2px solid #2e7d32' : '2px solid transparent',
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
