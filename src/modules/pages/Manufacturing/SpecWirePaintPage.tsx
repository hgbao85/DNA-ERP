import { useState, useMemo } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, ChevronLeft } from 'lucide-react'

export default function SpecWirePaintPage() {
  const { data: allData, isLoading } = useFetch(() => api.getSpecEntryProposals(), [])
  const proposals = Array.isArray(allData) ? allData : []

  const specTasks = useMemo(() => {
    const tasks: any[] = []
    proposals.forEach((proposal: any) => {
      if (proposal.tasks) {
        proposal.tasks
          .filter((t: any) => t.specRole === 'SPEC_WIRE_PAINT')
          .forEach((t: any) => {
            tasks.push({
              ...t,
              proposalId: proposal.id,
              proposalCode: proposal.code,
              piCode: proposal.piCode,
              productName: proposal.productName,
            })
          })
      }
    })
    return tasks
  }, [proposals])

  const [activeTask, setActiveTask] = useState<any | null>(null)
  const [form, setForm] = useState<{ unit?: string; imageUrl?: string; specifications?: string }>({})
  const [saving, setSaving] = useState(false)

  const handleSelectTask = (task: any) => {
    setActiveTask(task)
    setForm({ unit: task.unit ?? '', imageUrl: task.imageUrl ?? '', specifications: task.specifications ?? '' })
  }

  const save = async () => {
    if (!activeTask) return
    setSaving(true)
    try {
      await api.updateSpecEntryTask(activeTask.proposalId, activeTask.id, {
        unit: form.unit,
        imageUrl: form.imageUrl,
        specifications: form.specifications,
        status: 'COMPLETED',
      })
      setActiveTask(null)
    } catch {
      alert('Lỗi lưu dữ liệu')
    } finally {
      setSaving(false)
    }
  }

  /* ── Detail view ─────────────────────────────────────────── */
  if (activeTask) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setActiveTask(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
          >
            <ChevronLeft size={16} /> Danh sách
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{activeTask.proposalCode}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text3)' }}>
              {activeTask.piCode} — {activeTask.productName}
            </p>
          </div>
        </div>

        {/* Thông tin chung */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 28px', padding: '10px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
          <span><span style={{ color: 'var(--text3)' }}>Mã đề xuất: </span><strong>{activeTask.proposalCode}</strong></span>
          <span><span style={{ color: 'var(--text3)' }}>PI: </span><strong>{activeTask.piCode}</strong></span>
          <span><span style={{ color: 'var(--text3)' }}>Sản phẩm: </span><strong>{activeTask.productName}</strong></span>
          <span>
            <span style={{ color: 'var(--text3)' }}>Trạng thái: </span>
            <TaskStatusBadge status={activeTask.status} />
          </span>
        </div>

        {/* Form */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 560 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Nhập thông tin Dây & Sơn</div>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text3)' }}>Điền đầy đủ thông tin bên dưới rồi nhấn Lưu.</p>

          <label style={labelStyle}>Đơn vị tính</label>
          <input
            value={form.unit ?? ''}
            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            placeholder="VD: kg"
            style={inputStyle}
          />

          <label style={labelStyle}>Image URL</label>
          <input
            value={form.imageUrl ?? ''}
            onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
            placeholder="VD: https://..."
            style={inputStyle}
          />

          <label style={labelStyle}>Specifications</label>
          <input
            value={form.specifications ?? ''}
            onChange={e => setForm(f => ({ ...f, specifications: e.target.value }))}
            placeholder="VD: Dây PE xám + sơn tĩnh điện"
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setActiveTask(null)} style={btnSecondary}>Hủy</button>
            <button onClick={save} disabled={saving} style={btnGreen}>
              {saving ? 'Đang lưu...' : 'Lưu & Hoàn thành'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── List view ───────────────────────────────────────────── */
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Nhập định mức — Dây & Sơn</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          Nhập Đơn vị tính / Image URL / Specifications cho các task gửi từ kế hoạch sản xuất.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
          <Loader2 size={18} /> Đang tải...
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 52 }} />
              <col style={{ width: 150 }} />
              <col />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Mã đề xuất</th>
                <th style={thStyle}>Sản phẩm</th>
                <th style={thStyle}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {specTasks.map((task: any, idx: number) => (
                <tr
                  key={task.id}
                  onClick={() => handleSelectTask(task)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)' }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.proposalCode}
                  </td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>{task.piCode}</span>
                    <span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>
                    {task.productName}
                  </td>
                  <td style={tdStyle}>
                    <TaskStatusBadge status={task.status} />
                  </td>
                </tr>
              ))}
              {specTasks.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    Không có task nào — chờ kế hoạch sản xuất gửi đề xuất
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

function TaskStatusBadge({ status }: { status: string }) {
  const completed = status === 'COMPLETED'
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px',
      borderRadius: 20, whiteSpace: 'nowrap',
      color: completed ? '#16a34a' : '#d97706',
      background: completed ? '#dcfce7' : '#fef3c7',
    }}>
      {completed ? 'Hoàn thành' : 'Chờ xử lý'}
    </span>
  )
}

const thStyle: React.CSSProperties      = { padding: '12px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties      = { padding: '12px 16px' }
const labelStyle: React.CSSProperties   = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, marginTop: 12 }
const inputStyle: React.CSSProperties   = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }
const btnGreen: React.CSSProperties     = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }
