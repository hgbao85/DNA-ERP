'use client'
import { useState } from 'react'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { listTh as thStyle, listTd as tdStyle } from '../../../styles/table'
import { useInspection, khoState, type KhoKey } from '../../../context/InspectionContext'

interface Props {
  limitCats?: string[]   // kept for compat, unused
  inspKhoKey?: KhoKey
}

export default function KiemTraVatTuPage({ inspKhoKey }: Props = {}) {
  const { requests, submitKho } = useInspection()

  const [selectedInspId, setSelectedInspId] = useState<string | null>(null)
  // itemId -> giá trị nhập tay, CHỈ cho dòng không có materialId (BE bắt buộc override những
  // dòng đó, dòng có materialId thì BE tự đọc StockQuant, không nhận số client gõ).
  const [manualStock, setManualStock] = useState<Record<string, string>>({})

  const myRequests = (inspKhoKey ? requests : []).filter(req => {
    const inspKho = inspKhoKey ? khoState(req, inspKhoKey) : req.phoiSonHan
    return inspKho.status !== 'done'
  })

  // ── Detail view ─────────────────────────────────────────────────────────────

  if (selectedInspId && inspKhoKey) {
    const inspReq  = requests.find(r => r.id === selectedInspId)
    const inspKho  = inspReq ? khoState(inspReq, inspKhoKey) : null
    const isDone   = inspKho?.status === 'done'
    const items    = inspKho?.items ?? []
    const manualItems = items.filter(i => i.materialId == null)
    const canConfirm  = !isDone && manualItems.every(i => i.id && manualStock[i.id]?.trim())

    const handleConfirm = () => {
      if (!inspReq || !canConfirm) return
      const overrides = manualItems.map(i => ({
        itemId: i.id!,
        actualStock: Math.max(0, Number(manualStock[i.id!]) || 0),
      }))
      submitKho(inspReq.id, inspKhoKey, overrides.length > 0 ? overrides : undefined)
    }

    const goBack = () => { setSelectedInspId(null); setManualStock({}) }

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={goBack}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
            >
              <ChevronLeft size={15} /> Quay lại
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {inspReq?.skuCode}
                {inspReq?.skuName && <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>— {inspReq.skuName}</span>}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
                PO: {inspReq?.poNumber}
                {inspReq && <> · Yêu cầu lúc {format(new Date(inspReq.sentAt), 'HH:mm dd/MM/yyyy')}</>}
              </div>
            </div>
          </div>
          {isDone && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, color: '#166534', background: '#dcfce7', border: '1px solid #86efac' }}>
              <CheckCircle2 size={13} /> Đã xác nhận kiểm
            </span>
          )}
        </div>

        {/* Items table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {items.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Không có vật tư nào thuộc kho này
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: 52 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={thStyle}>Tên vật tư</th>
                  <th style={thStyle}>ĐVT</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cần</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Tồn thực</th>
                  <th style={thStyle}>Đề xuất mua</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const needsManual = item.materialId == null
                  const stock    = isDone ? item.actualStock : (needsManual ? null : undefined)
                  const ok       = stock != null && item.required > 0 ? stock >= item.required : true
                  const shortage = stock != null && item.required > 0 ? item.required - stock : 0
                  return (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text3)' }}>{item.unit}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{item.required > 0 ? item.required : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {isDone ? (
                          <span style={{ fontWeight: 700, color: ok ? '#16a34a' : '#dc2626' }}>{stock ?? 0}</span>
                        ) : needsManual ? (
                          <input
                            type="number" min={0}
                            value={item.id ? (manualStock[item.id] ?? '') : ''}
                            onChange={e => item.id && setManualStock(prev => ({ ...prev, [item.id!]: e.target.value }))}
                            placeholder="Nhập tồn"
                            style={{ width: 80, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                          />
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: 11 }}>Tự động</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {stock == null
                          ? <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                          : shortage > 0
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>{shortage} {item.unit}</span>
                            : <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Đủ</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Actions */}
        {!isDone && items.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: canConfirm ? '#16a34a' : 'var(--surface2)', color: canConfirm ? '#fff' : 'var(--text3)', cursor: canConfirm ? 'pointer' : 'not-allowed' }}
            >
              Xác nhận
            </button>
          </div>
        )}

        {isDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', border: '1px solid #86efac', borderRadius: 10, background: '#f0fdf4', fontSize: 13, fontWeight: 600, color: '#166534' }}>
            <CheckCircle2 size={16} /> Đã gửi kết quả — Quản lý sản xuất sẽ nhận được thông tin
          </div>
        )}
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Yêu cầu kiểm tra vật tư</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Danh sách yêu cầu kiểm tra tồn kho từ Quản lý sản xuất
        </p>
      </div>

      {myRequests.length === 0 ? (
        <div style={{ padding: 56, textAlign: 'center', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}>
          Chưa có yêu cầu nào từ Quản lý sản xuất
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 130 }} /><col /><col style={{ width: 160 }} /><col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Gửi lúc</th>
                <th style={thStyle}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map(req => {
                const inspKho = inspKhoKey ? khoState(req, inspKhoKey) : req.phoiSonHan
                const isDone  = inspKho.status === 'done'
                return (
                  <tr
                    key={req.id}
                    onClick={() => { setSelectedInspId(req.id); setManualStock({}) }}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.poNumber}
                    </td>
                    <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{req.skuCode}</span>
                      {req.skuName && <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{req.skuName}</>}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {format(new Date(req.sentAt), 'HH:mm dd/MM/yyyy')}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: isDone ? '#166534' : '#92400e', background: isDone ? '#dcfce7' : '#fef3c7' }}>
                        {isDone ? 'Đã kiểm' : 'Chờ kiểm'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
