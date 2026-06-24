import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { RefreshCw, Plus, Pencil } from 'lucide-react'

interface Props {
  piId: number
  isManager: boolean
}

export default function PackagingMaterialPanel({ piId, isManager }: Props) {
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQty, setEditQty] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ itemName: '', unit: 'cái', qtyPerSet: '', qtyNeeded: '', note: '' })
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')

  const { data, isLoading, error, refetch } = useFetch(
    () => api.getPackagingByPI(piId),
    [piId]
  )
  const safeList = Array.isArray(data) ? data : []

  const inputStyle: React.CSSProperties = {
    padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    fontSize: 12, background: 'var(--surface)', color: 'var(--text)',
  }

  const handleGenerate = async () => {
    setGenLoading(true); setGenError('')
    try {
      await api.generatePackagingFromBOM(piId)
      refetch()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setGenError(err?.response?.data?.error ?? 'Lỗi tạo từ BOM')
    } finally { setGenLoading(false) }
  }

  const handleUpdateReceived = async (id: number) => {
    const qty = Number(editQty)
    if (isNaN(qty) || qty < 0) return
    try {
      await api.updatePackagingReceived(id, qty)
      setEditingId(null); refetch()
    } catch { /* handled */ }
  }

  const handleDelete = async (id: number) => {
    try { await api.deletePackagingItem(id); refetch() } catch { /* handled */ }
  }

  const handleAddManual = async () => {
    setManualLoading(true); setManualError('')
    try {
      await api.addManualPackaging(piId, {
        itemName: manualForm.itemName,
        unit: manualForm.unit,
        qtyPerSet: Number(manualForm.qtyPerSet),
        qtyNeeded: Number(manualForm.qtyNeeded),
        ...(manualForm.note ? { note: manualForm.note } : {}),
      })
      setShowManual(false)
      setManualForm({ itemName: '', unit: 'cái', qtyPerSet: '', qtyNeeded: '', note: '' })
      refetch()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setManualError(err?.response?.data?.error ?? 'Lỗi thêm vật tư')
    } finally { setManualLoading(false) }
  }

  const totalItems = safeList.length
  const missingItems = safeList.filter((i: { qtyMissing: number }) => i.qtyMissing > 0).length

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
          Vật tư đóng gói
          {missingItems > 0 && (
            <span style={{ marginLeft: 8, background: '#ffebee', color: '#c62828', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
              Thiếu {missingItems} loại
            </span>
          )}
        </h4>
        {isManager && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowManual(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={11} /> Thêm thủ công
            </button>
            <button onClick={handleGenerate} disabled={genLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#ede7f6', border: 'none', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#4527a0' }}>
              <RefreshCw size={11} /> {genLoading ? 'Đang tạo...' : 'Tạo từ BOM'}
            </button>
          </div>
        )}
      </div>

      {genError && <div style={{ color: '#c62828', fontSize: 11, marginBottom: 6 }}>{genError}</div>}

      {/* Manual add form */}
      {showManual && isManager && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px', gap: 8, marginBottom: 8 }}>
            <input style={inputStyle} value={manualForm.itemName} onChange={e => setManualForm(f => ({ ...f, itemName: e.target.value }))} placeholder="Tên vật tư *" />
            <input style={inputStyle} value={manualForm.unit} onChange={e => setManualForm(f => ({ ...f, unit: e.target.value }))} placeholder="Đơn vị" />
            <input style={{ ...inputStyle, width: '100%' }} type="number" value={manualForm.qtyPerSet} onChange={e => setManualForm(f => ({ ...f, qtyPerSet: e.target.value }))} placeholder="SL/bộ" />
            <input style={{ ...inputStyle, width: '100%' }} type="number" value={manualForm.qtyNeeded} onChange={e => setManualForm(f => ({ ...f, qtyNeeded: e.target.value }))} placeholder="Cần" />
          </div>
          {manualError && <div style={{ color: '#c62828', fontSize: 11, marginBottom: 6 }}>{manualError}</div>}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowManual(false)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 11, cursor: 'pointer' }}>Hủy</button>
            <button onClick={handleAddManual} disabled={manualLoading || !manualForm.itemName || !manualForm.qtyNeeded}
              style={{ padding: '4px 10px', background: '#e65100', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {manualLoading ? 'Đang lưu...' : 'Thêm'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Đang tải...</div>}
      {error && <div style={{ fontSize: 12, color: '#c62828' }}>Lỗi tải dữ liệu</div>}

      {!isLoading && !error && totalItems === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Chưa có vật tư đóng gói — {isManager ? 'nhấn "Tạo từ BOM" để tự động điền' : 'chờ PRODUCTION_MANAGER thiết lập'}
        </div>
      )}

      {totalItems > 0 && (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
              <th style={{ padding: '5px 6px', textAlign: 'left' }}>Vật tư</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>Cần</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>Đã có</th>
              <th style={{ padding: '5px 6px', textAlign: 'right', color: '#c62828' }}>Thiếu</th>
              {isManager && <th style={{ padding: '5px 6px', textAlign: 'center' }}></th>}
            </tr>
          </thead>
          <tbody>
            {safeList.map((item: { id: number; itemName: string; unit: string; qtyNeeded: number; qtyReceived: number; qtyMissing: number; isFromBOM: boolean }) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 6px' }}>
                  {item.itemName}
                  <span style={{ marginLeft: 4, color: 'var(--text3)' }}>({item.unit})</span>
                  {!item.isFromBOM && (
                    <span style={{ marginLeft: 6, background: '#e3f2fd', color: '#1565c0', padding: '1px 6px', borderRadius: 20, fontSize: 10 }}>thủ công</span>
                  )}
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'right' }}>{item.qtyNeeded}</td>
                <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                  {isManager && editingId === item.id ? (
                    <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)}
                        style={{ ...inputStyle, width: 60, textAlign: 'right' }} />
                      <button onClick={() => handleUpdateReceived(item.id)} style={{ padding: '2px 8px', background: '#e65100', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>OK</button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 11, cursor: 'pointer' }}>✕</button>
                    </span>
                  ) : (
                    <span style={{ color: item.qtyReceived >= item.qtyNeeded ? '#2e7d32' : 'var(--text)' }}>
                      {item.qtyReceived}
                      {isManager && (
                        <button onClick={() => { setEditingId(item.id); setEditQty(String(item.qtyReceived)) }}
                          style={{ marginLeft: 4, padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}>
                          <Pencil size={10} color="var(--text3)" />
                        </button>
                      )}
                    </span>
                  )}
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                  {item.qtyMissing > 0
                    ? <strong style={{ color: '#c62828' }}>{item.qtyMissing}</strong>
                    : <span style={{ color: '#2e7d32' }}>—</span>}
                </td>
                {isManager && (
                  <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                    {!item.isFromBOM && (
                      <button onClick={() => handleDelete(item.id)} style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: '#c62828', fontSize: 11 }}>✕</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
