'use client'
import { useState } from 'react'
import { ArrowLeftRight, Send } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeWarehouse } from '../../../services/warehouses-api'
import SearchableSelect from '../../../components/SearchableSelect'
import { safeArr } from '../../../utils/array'
import { warehouseFamilyOf } from '../../../utils/warehouseFamily'
import { errMsg } from '../../../utils/errors'
import { compactTh as th, compactTd as td, emptyBox } from '../../../styles/table'

const ACCENT = 'var(--fg-4527a0)'

interface MaterialOption {
  id: number
  code: string
  name: string
  unit: string
  availableQty: number
}

/**
 * Chuyển kho tự do — vật tư bất kỳ, số lượng bất kỳ, kho nguồn/đích bất kỳ, KHÔNG còn ràng buộc
 * chuỗi Phôi sơn hàn → Vật tư TP → Thành phẩm (quyết định nghiệp vụ, gỡ isValidTransferRoute() ở
 * BE create()). Gọi thẳng createWarehouseTransfer() có sẵn (warehouse-transfers-api.ts) - trước
 * đây không FE nào gọi tới từ khi nhánh "ghi tự do" cũ bị xoá 09/09/2026.
 *
 * `scope` khoá kho nguồn = đúng kho của thủ kho (khớp assertWarehouseScope phía BE, tránh gửi lên
 * để BE trả 403 vô nghĩa). `scope === null` (Admin/Giám đốc) cho chọn kho nguồn bất kỳ.
 */
export default function ChuyenKhoTuDoPage({ scope }: { scope: string | null }) {
  const { data: warehouses } = useFetch<BeWarehouse[]>(() => api.getWarehouses(), [])
  // Kho ảo (OPENING_BALANCE, SCRAP, PRODUCTION, SUPPLIER...) không phải điểm đến/nguồn hợp lệ cho
  // chuyển kho tự do (thủ kho thao tác tay) - chỉ hiện kho thật.
  const whList = safeArr(warehouses).filter(w => !w.isVirtual)
  const myWarehouse = scope ? whList.find(w => w.code === scope) ?? null : null

  const [fromId, setFromId] = useState('')
  const fromWarehouse = scope ? myWarehouse : whList.find(w => w.id === fromId) ?? null
  const effectiveFromId = scope ? (myWarehouse?.id ?? '') : fromId

  const [toId, setToId] = useState('')
  const toWarehouse = whList.find(w => w.id === toId) ?? null
  // Không ai được gửi tới Phôi Sơn Hàn qua tính năng này (2026-09-15, quyết định nghiệp vụ) - họ
  // chỉ nhận vật tư qua đường mua hàng/nhập kho, không nhận chuyển kho tự do từ chặng khác.
  const toOptions = whList.filter(w => w.id !== effectiveFromId && warehouseFamilyOf(w.code) !== 'phoi-son-han')

  // Hiện TOÀN BỘ vật tư của kho nguồn đã chọn (2026-09-15, trước đây lọc chỉ còn vật tư có tồn >0
  // khiến danh sách trông "thiếu" so với Tổng hợp vật tư) - join stock_quant (tồn thật) với
  // materials (tên/ĐVT), cộng dồn theo mọi bucket stockLengthMm CHỈ để hiển thị "tồn khả dụng",
  // vật tư chưa có tồn hiện 0 (BE tự chặn cứng 400 nếu vật tư có bucket ≠ 0 - chuyển kho tự do cố
  // ý length-agnostic, xem comment ở create()).
  //
  // Cộng theo `availableQty` (BE đã trừ sẵn phần đang bị giữ chỗ bởi phiếu PENDING khác/cắt sắt -
  // StockReservationsService.getAvailableQty), KHÔNG dùng `qty` thô (2026-09-15, phát hiện qua live
  // test: dùng `qty` khiến "Thực có" hiển thị CAO HƠN thực tế khi có phiếu khác đang giữ chỗ cùng
  // vật tư - người dùng nhập số trong khoảng đó vẫn tạo phiếu được, nhưng BE âm thầm clamp xuống
  // thấp hơn số đã nhập mà không có cảnh báo rõ ràng nào ở bước tạo).
  const { data: materialOptions, isLoading: loadingMaterials, refetch: refetchStock } = useFetch<MaterialOption[]>(async () => {
    if (!effectiveFromId) return []
    const [quants, materials] = await Promise.all([
      api.getStockQuants({ warehouseId: effectiveFromId }),
      api.getMaterials(),
    ])
    const byMaterial = new Map<string, number>()
    for (const q of quants) {
      if (!q.materialId) continue
      byMaterial.set(q.materialId, (byMaterial.get(q.materialId) ?? 0) + q.availableQty)
    }
    return materials.map(m => ({ id: m.id, code: m.code, name: m.name, unit: m.unit, availableQty: byMaterial.get(String(m.id)) ?? 0 }))
  }, [effectiveFromId])

  const [material, setMaterial] = useState<MaterialOption | null>(null)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [successCode, setSuccessCode] = useState('')
  // Số lượng THỰC được tạo có thể thấp hơn số đã nhập - BE âm thầm clamp xuống đúng phần còn khả
  // dụng nếu 1 phiếu khác đã giữ chỗ trước (xem comment ở materialOptions). null = không bị giảm.
  const [clampedInfo, setClampedInfo] = useState<{ requested: number; actual: number; unit: string } | null>(null)

  const { data: pendingData, refetch: refetchPending } = useFetch(
    () => api.getWarehouseTransfers('PENDING'), []
  )
  const myPending = safeArr(pendingData).filter(t => t.fromWarehouseId === effectiveFromId)

  const resetLine = () => { setMaterial(null); setQty(''); setNote('') }

  const qtyNum = Number(qty)
  const overAvail = !!material && qtyNum > material.availableQty
  const canSubmit = !!fromWarehouse && !!toWarehouse && !!material && qtyNum > 0 && !overAvail && !busy

  const submit = async () => {
    if (!canSubmit || !fromWarehouse || !toWarehouse || !material) return
    setBusy(true)
    setError('')
    setSuccessCode('')
    setClampedInfo(null)
    try {
      const created = await api.createWarehouseTransfer({
        fromWarehouseId: fromWarehouse.id,
        toWarehouseId: toWarehouse.id,
        note: note.trim() || undefined,
        items: [{ materialId: material.id, materialName: material.name, unit: material.unit, quantity: qtyNum }],
      })
      setSuccessCode(created.code)
      // Phiếu tạo thành công KHÔNG đồng nghĩa đủ số lượng đã nhập - nếu 1 phiếu khác giành mất
      // phần tồn khả dụng giữa lúc mở form và lúc bấm "Tạo phiếu", BE tự clamp xuống đúng phần còn
      // lại thay vì báo lỗi. Phải đối chiếu items[0].quantity thật (createWarehouseTransfer() đã
      // fetch lại chi tiết) với số đã nhập để không im lặng bỏ qua chênh lệch này.
      const actualQty = created.items[0]?.quantity ?? 0
      if (actualQty < qtyNum) {
        setClampedInfo({ requested: qtyNum, actual: actualQty, unit: material.unit })
      }
      resetLine()
      refetchStock()
      refetchPending()
    } catch (e) {
      setError(errMsg(e, 'Không thể tạo phiếu chuyển kho'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ArrowLeftRight size={20} color={ACCENT} /> Chuyển kho ngoài đơn hàng
      </h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 18 }}>
        Dùng khi chuyển vật tư KHÔNG gắn với đơn hàng (PO/PI) cụ thể nào — chọn vật tư đang có tồn,
        nhập số lượng, chọn kho đích, không cần theo đúng thứ tự chuỗi kho. Nếu xuất cho 1 đơn hàng cụ
        thể (đóng gói, giao khách...), dùng tab &quot;Xuất theo đơn hàng&quot; để tiến độ đơn được cập
        nhật đúng. Tồn kho chỉ thay đổi sau khi kho đích xác nhận đã nhận hàng.
      </p>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 24, maxWidth: 640 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Kho nguồn</label>
            {scope ? (
              <div style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface2)' }}>
                {myWarehouse?.name ?? 'Đang tải…'}
              </div>
            ) : (
              <SearchableSelect
                displayValue={fromWarehouse ? fromWarehouse.name : ''}
                options={whList}
                getKey={w => w.id}
                getSearchText={w => `${w.code} ${w.name}`}
                renderOption={w => <span>{w.name}</span>}
                onSelect={w => { setFromId(w.id); if (w.id === toId) setToId(''); setMaterial(null) }}
                placeholder="Chọn kho nguồn…"
              />
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Kho đích</label>
            <SearchableSelect
              displayValue={toWarehouse ? toWarehouse.name : ''}
              options={toOptions}
              getKey={w => w.id}
              getSearchText={w => `${w.code} ${w.name}`}
              renderOption={w => <span>{w.name}</span>}
              onSelect={w => setToId(w.id)}
              placeholder={effectiveFromId ? 'Chọn kho đích…' : 'Chọn kho nguồn trước'}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Vật tư</label>
          <SearchableSelect
            displayValue={material ? material.name : ''}
            options={safeArr(materialOptions)}
            getKey={m => String(m.id)}
            getSearchText={m => `${m.code} ${m.name}`}
            renderOption={m => (
              <span>
                <span>{m.name} <span style={{ color: 'var(--text3)' }}>({m.unit})</span></span>
                <span style={{ float: 'right', color: m.availableQty > 0 ? 'var(--fg-2563eb)' : 'var(--text3)', fontWeight: 600 }}>{m.availableQty.toLocaleString('vi-VN')}</span>
              </span>
            )}
            onSelect={m => setMaterial(m)}
            placeholder={!effectiveFromId ? 'Chọn kho nguồn trước' : loadingMaterials ? 'Đang tải tồn kho…' : 'Chọn vật tư…'}
            emptyText={effectiveFromId ? 'Kho này không có vật tư nào' : 'Chọn kho nguồn trước'}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
              Số lượng {material && <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(tối đa {material.availableQty.toLocaleString('vi-VN')} {material.unit})</span>}
            </label>
            <input
              type="number" min={0} value={qty}
              onChange={e => setQty(e.target.value)}
              disabled={!material}
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${overAvail ? 'var(--fg-dc2626)' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Ghi chú (tuỳ chọn)</label>
            <input
              value={note} onChange={e => setNote(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}
            />
          </div>
        </div>

        {error && <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--fg-dc2626)' }}>{error}</div>}
        {successCode && !clampedInfo && (
          <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--fg-16a34a)' }}>Đã tạo phiếu {successCode}, chờ kho đích xác nhận.</div>
        )}
        {successCode && clampedInfo && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bg-fff3e0)', border: '1px solid var(--fg-ffcc80)', borderRadius: 6, fontSize: 12, color: 'var(--fg-92400e)' }}>
            Đã tạo phiếu {successCode}, nhưng chỉ chuyển được <strong>{clampedInfo.actual.toLocaleString('vi-VN')}</strong> / {clampedInfo.requested.toLocaleString('vi-VN')} {clampedInfo.unit} đã nhập — phần còn lại đang bị 1 phiếu khác giữ chỗ trước. Chờ kho đích xác nhận.
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600,
            border: 'none', borderRadius: 8, background: canSubmit ? ACCENT : 'var(--surface2)',
            color: canSubmit ? '#fff' : 'var(--text3)', cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          <Send size={14} /> {busy ? 'Đang gửi…' : 'Tạo phiếu chuyển kho'}
        </button>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Phiếu đang chờ kho đích xác nhận</h3>
      {myPending.length === 0 ? (
        <div style={emptyBox}>Chưa có phiếu nào đang chờ</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Mã phiếu</th>
                <th style={th}>Kho đích</th>
                <th style={th}>Vật tư</th>
                <th style={th}>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {myPending.map(t => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{t.code}</td>
                  <td style={td}>{t.toWarehouseName}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{t.items.map(it => `${it.materialName} (${it.quantity} ${it.unit})`).join(', ')}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{new Date(t.createdAt).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
