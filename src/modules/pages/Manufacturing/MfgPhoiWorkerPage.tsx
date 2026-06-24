import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import MfgPhoiPage from './MfgPhoiPage'

interface Props {
  subTab: 'tong-hop' | 'chi-tiet'
  selectedPiId: number | null
  onSelectPi: (id: number) => void
}

export default function MfgPhoiWorkerPage({ subTab, selectedPiId, onSelectPi }: Props) {

  const { data: pis, isLoading, error } = useFetch(() => api.getProductionInvoices(), [])
  const activePIs = (Array.isArray(pis) ? pis : []).filter(
    (p: any) => p.status !== 'DONE' && p.status !== 'CANCELLED',
  )

  const piId: number | null = selectedPiId ?? activePIs[0]?.id ?? null
  const activePi = activePIs.find((p: any) => p.id === piId) ?? activePIs[0] ?? null

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return (
    <div style={{ padding: 40, color: '#c62828', display: 'flex', gap: 8 }}>
      <AlertCircle size={18} /> Lỗi tải dữ liệu
    </div>
  )
  if (activePIs.length === 0) return (
    <div style={{ padding: 40, color: 'var(--text3)' }}>Không có lệnh sản xuất nào đang hoạt động</div>
  )

  return (
    <div>
      {/* ── Chọn lệnh sản xuất ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>LỆNH SX:</span>
        {activePIs.map((pi: any) => {
          const isSelected = pi.id === piId
          const isOverdue = new Date(pi.deadline) < new Date()
          return (
            <button
              key={pi.id}
              onClick={() => onSelectPi(pi.id)}
              style={{
                padding: '5px 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: isSelected ? '#e65100' : 'var(--surface)',
                color: isSelected ? '#fff' : isOverdue ? '#c62828' : 'var(--text)',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {pi.code}
              {activePi?.id === pi.id && (
                <span style={{ marginLeft: 6, fontSize: 11, fontFamily: 'sans-serif', fontWeight: 400, opacity: 0.85 }}>
                  · hạn {format(new Date(pi.deadline), 'dd/MM')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Nội dung Phôi ────────────────────────────────────────────── */}
      {piId && <MfgPhoiPage piId={piId} subTab={subTab} />}
    </div>
  )
}
