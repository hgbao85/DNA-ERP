import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

// ── Màn "Lịch sử nhập đan": mọi lần thu mảnh từ điểm đan về kho (mới nhất trước) ──
interface ReceiptRow {
  id: number; receivedDate: string; pointCode: string; pointName: string | null
  pieceName: string; pieceCode: string; piCode: string; poNumber: string | null
  productLabel: string; warehouseName: string; quantity: number; by: string | null; note: string | null
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'top' }

export default function LichSuNhapDanPage() {
  const { data, isLoading, error } = useFetch<ReceiptRow[]>(() => api.getWeavingReceiptHistory(), [])
  const rows = Array.isArray(data) ? data : []

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Lịch sử nhập đan</h2>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text3)' }}>Các lần thu mảnh đã đan từ điểm đan về kho — mới nhất trước.</p>

      {rows.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có lần nhập đan nào.</div>}

      {rows.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Ngày</th>
                  <th style={th}>Điểm đan</th>
                  <th style={th}>Mảnh</th>
                  <th style={th}>Lệnh SX / PO</th>
                  <th style={th}>Kho nhận</th>
                  <th style={{ ...th, textAlign: 'right' }}>Số lượng</th>
                  <th style={th}>Người thu</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{format(new Date(r.receivedDate), 'dd/MM/yyyy')}</td>
                    <td style={td}>
                      <strong>{r.pointCode}</strong>
                      {r.pointName && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.pointName}</div>}
                    </td>
                    <td style={td}>
                      <strong>{r.pieceName}</strong> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{r.pieceCode}</span>
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {r.poNumber ?? r.piCode}
                      <div style={{ color: 'var(--text3)' }}>{r.productLabel}</div>
                    </td>
                    <td style={td}>{r.warehouseName}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#2e7d32' }}>{r.quantity}</td>
                    <td style={{ ...td, fontSize: 12, color: 'var(--text2)' }}>{r.by ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
