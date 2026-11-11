'use client'
import { useState } from 'react'
import { Factory } from 'lucide-react'
import { getProductionInvoices, recomputeNonSteelPurchase } from '../../../../services/api'
import { errMsg } from '../../../../utils/errors'
import AdminReadOnlyList, { type AdminReadOnlyListConfig } from '../shared/AdminReadOnlyList'

interface ProductionInvoice {
  id: string
  code: string
  displayCode?: string
  deadline?: string
  status: string
  exportOrder?: { poNumber: string }
  createdBy?: { name: string }
  items?: { id: string; productionOrderId?: string | null; prodApproval?: { status?: string | null } | null }[]
}

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Lên kế hoạch',
  PRODUCING: 'Đang sản xuất',
  DONE: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
}

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

/**
 * 10/11/2026: sau khi Sếp duyệt, bước tự tạo dòng mua ngoài sắt (vật tư tiêu hao, pat, chân nhôm) từng có thể lỗi im lặng
 * (transaction quá giờ) -> lệnh không có dòng mua nào. Admin bấm "Tạo lại" để chạy lại cho cả lệnh (không tạo dòng trùng).
 * Tìm lệnh đã dính lỗi: prisma/sql/tim-lenh-thieu-dong-mua-ngoai-sat.sql (BE).
 */
function RecomputeNonSteelButton({ pi }: { pi: ProductionInvoice }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const item = (pi.items ?? []).find(it => it.prodApproval?.status === 'APPROVED' && it.productionOrderId)
  // Lệnh đã huỷ: BE không tính lại đề xuất mua (409), nên không hiện nút.
  if (!item || pi.status === 'CANCELLED') return <span style={{ color: 'var(--text3)' }}>—</span>

  const run = async () => {
    setBusy(true); setMsg(null)
    try {
      await recomputeNonSteelPurchase(pi.id, item.id)
      setMsg({ ok: true, text: 'Đã tạo lại' })
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e, 'Không tạo lại được') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <button onClick={e => { e.stopPropagation(); void run() }} disabled={busy}
        title="Chạy lại bước tạo dòng mua vật tư tiêu hao, pat, chân nhôm cho cả lệnh - không tạo dòng trùng"
        style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: busy ? 'var(--text3)' : 'var(--text)', cursor: busy ? 'not-allowed' : 'pointer' }}>
        {busy ? 'Đang tạo…' : 'Tạo lại'}
      </button>
      {msg && <span style={{ fontSize: 11, color: msg.ok ? 'var(--fg-2e7d32)' : 'var(--fg-dc2626, #dc2626)' }}>{msg.text}</span>}
    </div>
  )
}

export default function ProductionInvoicesPage() {
  const config: AdminReadOnlyListConfig<ProductionInvoice> = {
    title: 'Lệnh sản xuất (PI)',
    icon: <Factory size={16} color="var(--fg-3949ab)" />,
    searchFields: ['code', 'displayCode'],
    searchPlaceholder: 'Tìm theo mã PI / số LSX...',
    emptyMessage: 'Chưa có lệnh sản xuất nào',
    pageSize: 10,
    columns: [
      { key: 'code', label: 'Mã PI' },
      { key: 'displayCode', label: 'Số LSX', render: (p) => p.displayCode ?? '—' },
      { key: 'exportOrder', label: 'Đơn xuất khẩu', render: (p) => p.exportOrder?.poNumber ?? '—' },
      { key: 'deadline', label: 'Deadline', render: (p) => fmtDate(p.deadline) },
      { key: 'status', label: 'Trạng thái', render: (p) => STATUS_LABEL[p.status] ?? p.status },
      { key: 'createdBy', label: 'Người tạo', render: (p) => p.createdBy?.name ?? '—' },
      { key: 'nonSteelPurchase', label: 'Dòng mua ngoài sắt', render: (p) => <RecomputeNonSteelButton pi={p} /> },
    ],
    filters: [
      { key: 'PLANNING', label: 'Lên kế hoạch', predicate: (p) => p.status === 'PLANNING' },
      { key: 'PRODUCING', label: 'Đang sản xuất', predicate: (p) => p.status === 'PRODUCING' },
      { key: 'DONE', label: 'Hoàn thành', predicate: (p) => p.status === 'DONE' },
    ],
    fetch: () => getProductionInvoices() as Promise<ProductionInvoice[]>,
    realtimeTopics: ['production-invoices'],
  }

  return <AdminReadOnlyList config={config} />
}
