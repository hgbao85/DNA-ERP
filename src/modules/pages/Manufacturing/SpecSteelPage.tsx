import { useState, useMemo } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { CheckCircle2, AlertCircle } from 'lucide-react'

export default function SpecSteelPage() {
  const { data: allData, isLoading } = useFetch(() => api.getSpecEntryProposals(), [])
  const proposals = Array.isArray(allData) ? allData : []
  
  // Lọc tasks thuộc SPEC_STEEL từ các proposal
  const specTasks = useMemo(() => {
    const tasks: any[] = []
    proposals.forEach((proposal: any) => {
      if (proposal.tasks) {
        proposal.tasks
          .filter((t: any) => t.specRole === 'SPEC_STEEL')
          .forEach((t: any) => {
            tasks.push({ ...t, proposalId: proposal.id, proposalCode: proposal.code, piCode: proposal.piCode, productName: proposal.productName })
          })
      }
    })
    return tasks
  }, [proposals])

  const { data: materials, isLoading: matLoading } = useFetch(() => api.getMaterials(), [])
  const allMaterials = Array.isArray(materials) ? materials : []

  const [q, setQ] = useState('')
  const filtered = useMemo(() => allMaterials.filter((m: any) => (m.name + ' ' + m.code).toLowerCase().includes(q.toLowerCase())), [allMaterials, q])
  const [sel, setSel] = useState<any | null>(null)
  const [form, setForm] = useState<{ type?: string; specifications?: string; thickness?: string }>({})
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)

  const handleSelectTask = (task: any) => {
    setActiveTaskId(task.id)
    setSel(null)
    setForm({ type: task.type ?? '', specifications: task.specifications ?? '', thickness: task.thickness ?? '' })
    setQ('')
  }

  const handleSelect = (m: any) => {
    setSel(m)
    setForm({ type: m.type ?? '', specifications: m.specifications ?? '', thickness: m.thickness ?? '' })
  }

  const save = async () => {
    try {
      const currentTask = specTasks.find(t => t.id === activeTaskId)
      if (!currentTask) return
      
      await api.updateSpecEntryTask(currentTask.proposalId, activeTaskId, { type: form.type, specifications: form.specifications, thickness: form.thickness, status: 'COMPLETED' })
      setActiveTaskId(null)
      alert('Lưu thành công')
    } catch (e) {
      alert('Lỗi lưu')
    }
  }

  return (
    <div>
      <h2>Nhập định mức — Sắt</h2>
      <p style={{ color: 'var(--text3)' }}>Nhập Type / Specifications / Thickness cho các task được gửi từ kế hoạch sản xuất.</p>

      {specTasks.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          Không có task nào. Chờ kế hoạch sản xuất gửi đề xuất.
        </div>
      )}

      {specTasks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, marginTop: 20 }}>
          {/* Task list */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, color: 'var(--text3)' }}>CÁC TASK CẦN THỰC HIỆN</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {specTasks.map((task: any) => (
                <div
                  key={task.id}
                  onClick={() => handleSelectTask(task)}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: activeTaskId === task.id ? '#fff3e0' : 'transparent',
                    borderLeft: task.status === 'COMPLETED' ? '4px solid #2e7d32' : 'none',
                    paddingLeft: task.status === 'COMPLETED' ? 8 : 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {task.status === 'COMPLETED' ? (
                      <CheckCircle2 size={16} color="#2e7d32" style={{ marginTop: 2, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 16, height: 16, border: '2px solid #e65100', borderRadius: '50%', marginTop: 2, flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{task.proposalCode}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{task.piCode} — {task.productName}</div>
                      <div style={{ fontSize: 11, color: task.status === 'COMPLETED' ? '#2e7d32' : '#e65100', fontWeight: 600, marginTop: 4 }}>
                        {task.status === 'COMPLETED' ? 'Hoàn thành' : 'Chờ xử lý'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          {activeTaskId && (
            <div>
              <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8 }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Nhập thông tin</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <label>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Type</div>
                    <input value={form.type ?? ''} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} placeholder="VD: Ống sắt tròn" style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6, width: '100%' }} />
                  </label>
                  <label>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Thickness</div>
                    <input value={form.thickness ?? ''} onChange={e => setForm(f => ({ ...f, thickness: e.target.value }))} placeholder="VD: 1.2" style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6, width: '100%' }} />
                  </label>
                  <label style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Specifications</div>
                    <input value={form.specifications ?? ''} onChange={e => setForm(f => ({ ...f, specifications: e.target.value }))} placeholder="VD: Φ16×1.0mm" style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6, width: '100%' }} />
                  </label>
                </div>
                <button onClick={save} style={{ padding: '8px 16px', background: '#e65100', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Lưu & Hoàn thành</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
