import { useState, Fragment } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { ChevronDown, ChevronRight, Loader2, Plus, Send } from 'lucide-react'
import type { PlanForm, CreatePlanFormPayload } from '../../../types/plan-form'

const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  DRAFT: { text: 'Nháp', bg: '#f3f4f6', color: '#374151' },
  PROPOSED: { text: 'Đã đề xuất', bg: '#fef3c7', color: '#b45309' },
  APPROVED: { text: 'Đã duyệt', bg: '#dcfce7', color: '#15803d' },
  REJECTED: { text: 'Từ chối', bg: '#fee2e2', color: '#b91c1c' },
}

const emptyMaterialType = (): CreatePlanFormPayload['materialType'] => ({
  sat: { type: '', specifications: '', thickness: undefined },
  daySon: { kg: undefined, specifications: '', imageUrl: '' },
  vatTuPhuKien: { unit: 'cái' },
  baoBiDongGoi: { unit: 'thùng' },
})

export default function PlanFormDashboardPage() {
  const { data: planForms = [], isLoading, refetch } = useFetch(() => api.getPlanForms(), [])
  const { data: formOptions } = useFetch(() => api.getPlanFormOptions(), [])
  const exportOrders = formOptions?.exportOrders ?? []
  const mfgProducts = formOptions?.mfgProducts ?? []

  const [expanded, setExpanded] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<CreatePlanFormPayload>({
    exportOrderId: 0,
    mfgProductId: 0,
    note: '',
    materialType: emptyMaterialType(),
  })

  const openModal = () => {
    const firstOrder = exportOrders[0] as { id: number } | undefined
    const firstProduct = mfgProducts[0] as { id: number } | undefined
    setForm({
      exportOrderId: firstOrder?.id ?? 0,
      mfgProductId: firstProduct?.id ?? 0,
      note: '',
      materialType: emptyMaterialType(),
    })
    setModalOpen(true)
  }

  const handleProposeNew = async () => {
    if (!form.exportOrderId || !form.mfgProductId || !form.materialType.sat.type) {
      alert('Vui lòng chọn PO, sản phẩm và nhập loại sắt')
      return
    }
    setSubmitting(true)
    try {
      await api.proposePlanForm(form)
      setModalOpen(false)
      refetch()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể tạo đề xuất'
      alert(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleProposeExisting = async (id: number) => {
    setSubmitting(true)
    try {
      await api.proposePlanFormById(id)
      refetch()
    } catch {
      alert('Không thể gửi đề xuất')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách PlanForm</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)' }}>
            Quản lý kế hoạch sản xuất theo PO — định mức vật tư (Sắt, Dây/Sơn, Phụ kiện, Bao bì)
          </p>
        </div>
        <button
          onClick={openModal}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
            background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8,
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Đề xuất tạo PlanForm
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
          <Loader2 size={18} className="spin" /> Đang tải...
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', width: 40 }} />
                <th style={{ padding: '12px 8px' }}>#</th>
                <th style={{ padding: '12px 8px' }}>PO</th>
                <th style={{ padding: '12px 8px' }}>Sản phẩm</th>
                <th style={{ padding: '12px 8px' }}>Trạng thái</th>
                <th style={{ padding: '12px 8px' }}>Người tạo</th>
                <th style={{ padding: '12px 8px' }}>Ngày tạo</th>
                <th style={{ padding: '12px 16px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(planForms as PlanForm[]).map((pf) => {
                const st = STATUS_LABEL[pf.status] ?? STATUS_LABEL.DRAFT
                const isOpen = expanded === pf.id
                const mt = pf.quotaManagement?.materialType
                return (
                  <Fragment key={pf.id}>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => setExpanded(isOpen ? null : pf.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                        >
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{pf.id}</td>
                      <td style={{ padding: '12px 8px' }}>{pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`}</td>
                      <td style={{ padding: '12px 8px' }}>
                        {pf.mfgProduct?.factoryCode} — {pf.mfgProduct?.name}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color }}>
                          {st.text}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>{pf.createdBy?.name}</td>
                      <td style={{ padding: '12px 8px' }}>{format(new Date(pf.createdAt), 'dd/MM/yyyy')}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {pf.status === 'DRAFT' && (
                          <button
                            disabled={submitting}
                            onClick={() => handleProposeExisting(pf.id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                              background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a',
                              borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            <Send size={13} /> Gửi đề xuất
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && mt && (
                      <tr style={{ background: '#fafafa' }}>
                        <td colSpan={8} style={{ padding: '16px 24px' }}>
                          {pf.note && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text2)' }}>{pf.note}</p>}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                            <MaterialCard title="Sắt (Sat)" items={[
                              ['Loại', mt.sat?.type],
                              ['Quy cách', mt.sat?.specifications],
                              ['Độ dày', mt.sat?.thickness != null ? `${mt.sat.thickness} mm` : '—'],
                            ]} />
                            <MaterialCard title="Dây, Sơn (DaySon)" items={[
                              ['KG', mt.daySon?.kg != null ? `${mt.daySon.kg}` : '—'],
                              ['Quy cách', mt.daySon?.specifications],
                            ]} />
                            <MaterialCard title="Vật tư phụ kiện" items={[['Đơn vị', mt.vatTuPhuKien?.unit]]} />
                            <MaterialCard title="Bao bì đóng gói" items={[['Đơn vị', mt.baoBiDongGoi?.unit]]} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {planForms.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    Chưa có PlanForm — bấm &quot;Đề xuất tạo PlanForm&quot; để bắt đầu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Đề xuất tạo PlanForm</h3>

            <label style={labelStyle}>PO (Export Order)</label>
            <select
              value={form.exportOrderId}
              onChange={(e) => setForm({ ...form, exportOrderId: Number(e.target.value) })}
              style={inputStyle}
            >
              <option value={0}>— Chọn PO —</option>
              {(exportOrders as { id: number; poNumber: string }[]).map((o) => (
                <option key={o.id} value={o.id}>{o.poNumber}</option>
              ))}
            </select>

            <label style={labelStyle}>Sản phẩm (MfgProduct)</label>
            <select
              value={form.mfgProductId}
              onChange={(e) => setForm({ ...form, mfgProductId: Number(e.target.value) })}
              style={inputStyle}
            >
              <option value={0}>— Chọn sản phẩm —</option>
              {(mfgProducts as { id: number; factoryCode: string; name: string }[]).map((p) => (
                <option key={p.id} value={p.id}>{p.factoryCode} — {p.name}</option>
              ))}
            </select>

            <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600, fontSize: 14 }}>MaterialType</div>

            <fieldset style={fieldsetStyle}>
              <legend>Sắt (Sat)</legend>
              <input placeholder="Loại sắt *" value={form.materialType.sat.type}
                onChange={(e) => setForm({ ...form, materialType: { ...form.materialType, sat: { ...form.materialType.sat, type: e.target.value } } })}
                style={inputStyle} />
              <input placeholder="Quy cách" value={form.materialType.sat.specifications ?? ''}
                onChange={(e) => setForm({ ...form, materialType: { ...form.materialType, sat: { ...form.materialType.sat, specifications: e.target.value } } })}
                style={inputStyle} />
              <input type="number" step="0.1" placeholder="Độ dày (mm)" value={form.materialType.sat.thickness ?? ''}
                onChange={(e) => setForm({ ...form, materialType: { ...form.materialType, sat: { ...form.materialType.sat, thickness: e.target.value ? Number(e.target.value) : undefined } } })}
                style={inputStyle} />
            </fieldset>

            <fieldset style={fieldsetStyle}>
              <legend>Dây, Sơn (DaySon)</legend>
              <input type="number" step="0.1" placeholder="KG" value={form.materialType.daySon.kg ?? ''}
                onChange={(e) => setForm({ ...form, materialType: { ...form.materialType, daySon: { ...form.materialType.daySon, kg: e.target.value ? Number(e.target.value) : undefined } } })}
                style={inputStyle} />
              <input placeholder="Quy cách" value={form.materialType.daySon.specifications ?? ''}
                onChange={(e) => setForm({ ...form, materialType: { ...form.materialType, daySon: { ...form.materialType.daySon, specifications: e.target.value } } })}
                style={inputStyle} />
            </fieldset>

            <fieldset style={fieldsetStyle}>
              <legend>Vật tư phụ kiện</legend>
              <input placeholder="Đơn vị" value={form.materialType.vatTuPhuKien.unit}
                onChange={(e) => setForm({ ...form, materialType: { ...form.materialType, vatTuPhuKien: { unit: e.target.value } } })}
                style={inputStyle} />
            </fieldset>

            <fieldset style={fieldsetStyle}>
              <legend>Bao bì đóng gói</legend>
              <input placeholder="Đơn vị" value={form.materialType.baoBiDongGoi.unit}
                onChange={(e) => setForm({ ...form, materialType: { ...form.materialType, baoBiDongGoi: { unit: e.target.value } } })}
                style={inputStyle} />
            </fieldset>

            <label style={labelStyle}>Ghi chú</label>
            <textarea value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })}
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalOpen(false)} style={btnSecondary}>Hủy</button>
              <button onClick={handleProposeNew} disabled={submitting} style={btnPrimary}>
                {submitting ? 'Đang gửi...' : 'Gửi đề xuất'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MaterialCard({ title, items }: { title: string; items: [string, string | undefined | null][] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: '#2e7d32', marginBottom: 8 }}>{title}</div>
      {items.map(([k, v]) => (
        <div key={k} style={{ fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--text3)' }}>{k}: </span>
          <span>{v || '—'}</span>
        </div>
      ))}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, marginTop: 12 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }
const fieldsetStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px 4px', marginBottom: 8 }
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }
