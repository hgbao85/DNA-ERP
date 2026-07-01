import { useState } from 'react'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import type { MaterialType, PlanForm } from '../../../types/plan-form'
import { StatusBadge } from '../ProductionPlan/SKUDetail'
import SearchInput from '../../../components/SearchInput'
import LoadingState from '../../../components/LoadingState'

type GroupKey = keyof MaterialType
interface FieldDef { key: string; label: string; type: 'text' | 'number' }

const FL = ({ children }: { children: React.ReactNode }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{children}</label>
)
const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 24 }

/**
 * Khu vực "Nhập định mức theo SKU thật" dùng chung cho 4 trang chuyên trách định mức chi tiết
 * (Sắt / Dây-Sơn / Phụ kiện / Bao bì). Mỗi trang truyền đúng `group` của mình, panel tự lấy danh sách
 * PlanForm thật, cho chọn 1 SKU rồi nhập/sửa danh sách item của riêng nhóm đó, lưu qua updatePlanFormDetailQuota.
 */
export default function QuotaSkuEntryPanel({ group, groupLabel, fields }: {
  group: GroupKey
  groupLabel: string
  fields: FieldDef[]
}) {
  const { user } = useAuth()
  const { data: planForms, isLoading, refetch } = useFetch<PlanForm[]>(() => api.getPlanForms(), [])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const list = (planForms ?? []).filter(pf => pf.status !== 'DRAFT')
  const q = search.trim().toLowerCase()
  const displayed = q
    ? list.filter(pf => [pf.mfgProduct?.factoryCode, pf.mfgProduct?.name, pf.customerName].some(v => v?.toLowerCase().includes(q)))
    : list
  const selected = list.find(pf => pf.id === selectedId) ?? null

  const emptyRow = (): Record<string, any> =>
    Object.fromEntries([['name', ''], ...fields.map(f => [f.key, f.type === 'number' ? undefined : ''])])

  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const openSku = (pf: PlanForm) => {
    setSelectedId(pf.id)
    const existing = ((pf.quotaManagement?.materialType?.[group] ?? []) as Record<string, any>[])
    setRows(existing.length > 0 ? existing.map(it => ({ ...it })) : [emptyRow()])
    setSaved(false)
  }

  const addRow = () => setRows(r => [...r, emptyRow()])
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i))
  const setRowField = (i: number, key: string, value: any) => setRows(r => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)))

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const items = rows.filter(r => (r.name ?? '').trim()).map(r => ({ ...r, name: String(r.name).trim() }))
      await (api as any).updatePlanFormDetailQuota(selected.id, group, items, user?.name ?? 'Không rõ')
      setSaved(true)
      refetch()
    } catch {
      alert('Không thể lưu định mức')
    } finally {
      setSaving(false)
    }
  }

  if (selected) {
    const meta = selected.quotaManagement?.entryMeta?.[group]
    const review = selected.quotaManagement?.reviewStatus?.[group]
    return (
      <div style={cardStyle}>
        <button
          onClick={() => setSelectedId(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}
        >
          <ChevronLeft size={14} /> Quay lại danh sách SKU
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            Nhập định mức {groupLabel} — {selected.mfgProduct?.factoryCode} {selected.mfgProduct?.name}
          </h3>
          <StatusBadge status={selected.status} />
        </div>
        {meta && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
            Đã nhập bởi <strong>{meta.enteredBy}</strong> lúc {new Date(meta.enteredAt).toLocaleString('vi-VN')}
          </div>
        )}
        {review?.status === 'REJECTED' && (
          <div style={{ padding: '8px 12px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>⚠ KHSX đã từ chối nhóm {groupLabel} — vui lòng nhập lại</div>
            {review.reason && <div style={{ fontSize: 12, color: '#dc2626', fontStyle: 'italic', marginTop: 2 }}>{review.reason}</div>}
          </div>
        )}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>Tên</th>
                {fields.map(f => (
                  <th key={f.key} style={{ padding: '8px 10px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>{f.label}</th>
                ))}
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px' }}>
                    <input value={row.name ?? ''} onChange={e => setRowField(i, 'name', e.target.value)} placeholder="Tên vật tư" style={inputStyle} />
                  </td>
                  {fields.map(f => (
                    <td key={f.key} style={{ padding: '6px 10px' }}>
                      <input
                        type={f.type}
                        value={row[f.key] ?? ''}
                        onChange={e => setRowField(i, f.key, f.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                  ))}
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button
            onClick={addRow}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}
          >
            <Plus size={14} /> Thêm dòng
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saved && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đã lưu</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: '#2e7d32', color: '#fff', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Đang lưu...' : 'Lưu định mức'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Nhập định mức {groupLabel} theo SKU thật</div>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm SKU, sản phẩm, khách hàng..." />
      </div>
      {isLoading ? (
        <LoadingState />
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>SKU</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>Khách hàng</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>Trạng thái</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>{groupLabel} đã nhập</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(pf => {
                const count = ((pf.quotaManagement?.materialType?.[group] ?? []) as unknown[]).length
                const isRejected = pf.quotaManagement?.reviewStatus?.[group]?.status === 'REJECTED'
                return (
                  <tr
                    key={pf.id}
                    onClick={() => openSku(pf)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                      <span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>
                      {pf.mfgProduct?.name}
                    </td>
                    <td style={{ padding: '9px 12px', color: 'var(--text2)' }}>{pf.customerName ?? '—'}</td>
                    <td style={{ padding: '9px 12px' }}><StatusBadge status={pf.status} /></td>
                    <td style={{ padding: '9px 12px', color: isRejected ? '#dc2626' : count > 0 ? '#16a34a' : 'var(--text3)', fontWeight: isRejected || count > 0 ? 600 : 400 }}>
                      {isRejected ? '⚠ Bị từ chối — nhập lại' : count > 0 ? `${count} dòng` : 'Chưa nhập'}
                    </td>
                  </tr>
                )
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Không có SKU nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
