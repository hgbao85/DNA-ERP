'use client'

/**
 * Lệnh sản xuất — Công đoạn PHÔI (đọc-only, tổng quan theo PI → loại sắt).
 *
 * Đã nối BE thật (M3, 2026-08-12 — "Xuất sắt Phôi"): dựng thẳng từ GET /steel-issues (flat, cùng
 * nguồn dữ liệu XacNhanSanLuongPage) — PHOI_STAFF chỉ có STEEL_ISSUE:VIEW, không có
 * SKU:VIEW/PRODUCTION_ORDER:VIEW nên không tự resolve steel-issue-plan (BOM) theo PI như phía kho
 * (XuatSatPage) được.
 *
 * B4 Đợt 3d (2026-08-19): gom theo PI + LOẠI SẮT (không còn theo mảnh) — SteelIssue giờ gộp theo
 * cả PI, không còn gắn 1 mảnh cụ thể (xem changelog 2026-08-18-xuat-sat-po-pi-vat-tu.md). Xác
 * nhận nhận/báo cắt xong làm ở màn riêng "Xác nhận sản lượng"; màn này chỉ theo dõi tiến độ.
 */

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Wrench, Clock, Check, AlertTriangle } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSteelIssue, BeQcReview } from '../../../services/steel-issues-api'
import LoadingState from '../../../components/LoadingState'

const ACCENT = '#e65100'
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

interface MaterialAgg {
  materialId: string; materialName: string
  issuedBarCount: number; awaitingReceive: number; cutting: number; inProcess: number; awaitingQc: number; passed: number; failed: number
}
interface PiAgg { productionInvoiceId: string; poNumber: string; materials: MaterialAgg[]; totalIssued: number; totalPassed: number; totalAwaiting: number }

export default function LenhSanXuatPhoi({ readOnly = true }: { readOnly?: boolean }) {
  void readOnly // màn này luôn đọc-only — xác nhận/báo cắt làm ở XacNhanSanLuongPage
  const { data: issues, isLoading } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  const { data: reviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])
  const [selPi, setSelPi] = useState<string | null>(null)

  const piRows: PiAgg[] = useMemo(() => {
    const failedByIssue = new Map<string, number>()
    for (const r of reviews ?? []) if (r.steelIssueId) failedByIssue.set(r.steelIssueId, r.failedQty)

    // Gom theo productionInvoiceId (luôn duy nhất) chứ KHÔNG theo mã hiển thị salesOrderCode -
    // nhiều lệnh SX có thể cùng chung 1 mã Sales (nhiều SKU/đơn) hoặc cùng null.
    const byPi = new Map<string, BeSteelIssue[]>()
    const order: string[] = []
    for (const i of issues ?? []) {
      if (!byPi.has(i.productionInvoiceId)) { byPi.set(i.productionInvoiceId, []); order.push(i.productionInvoiceId) }
      byPi.get(i.productionInvoiceId)!.push(i)
    }
    return order.map(productionInvoiceId => {
      const list = byPi.get(productionInvoiceId)!
      const po = list[0].salesOrderCode ?? list[0].piCode
      const byMaterial = new Map<string, BeSteelIssue[]>()
      for (const i of list) { if (!byMaterial.has(i.materialId)) byMaterial.set(i.materialId, []); byMaterial.get(i.materialId)!.push(i) }
      const materials: MaterialAgg[] = [...byMaterial.entries()].map(([materialId, its]) => {
        const failed = its.filter(i => i.status === 'QC_PASSED').reduce((s, i) => s + (failedByIssue.get(i.id) ?? 0), 0)
        const passed = its.filter(i => i.status === 'QC_PASSED').reduce((s, i) => s + (i.actualBarCount ?? i.barCount) - (failedByIssue.get(i.id) ?? 0), 0)
        return {
          materialId, materialName: its[0].materialName,
          issuedBarCount: its.reduce((s, i) => s + i.barCount, 0),
          awaitingReceive: its.filter(i => i.status === 'ISSUED').reduce((s, i) => s + i.barCount, 0),
          cutting: its.filter(i => i.status === 'RECEIVED').reduce((s, i) => s + i.barCount, 0),
          inProcess: its.filter(i => i.status === 'IN_PROCESS').reduce((s, i) => s + (i.actualBarCount ?? i.barCount), 0),
          awaitingQc: its.filter(i => i.status === 'AWAITING_QC').reduce((s, i) => s + (i.actualBarCount ?? i.barCount), 0),
          passed, failed,
        }
      })
      return {
        productionInvoiceId, poNumber: po, materials,
        totalIssued: materials.reduce((s, m) => s + m.issuedBarCount, 0),
        totalPassed: materials.reduce((s, m) => s + m.passed, 0),
        totalAwaiting: materials.reduce((s, m) => s + m.awaitingReceive + m.cutting + m.inProcess + m.awaitingQc, 0),
      }
    })
  }, [issues, reviews])

  if (isLoading || !issues) return <LoadingState />

  const sel = selPi ? piRows.find(r => r.productionInvoiceId === selPi) ?? null : null

  if (sel) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => setSelPi(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
            <ChevronLeft size={15} /> Quay lại
          </button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{sel.poNumber}</h2>
        </div>
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>Loại sắt</th>
                <th style={thR}>Đã xuất (cây)</th>
                <th style={thR}>Chờ nhận</th>
                <th style={thR}>Đang cắt</th>
                <th style={thR}>Đang gia công</th>
                <th style={thR}>Chờ KCS</th>
                <th style={thR}>Đạt</th>
                <th style={thR}>Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {sel.materials.map(m => (
                <tr key={m.materialId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{m.materialName}</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{m.issuedBarCount}</td>
                  <td style={tdR}>{m.awaitingReceive > 0 ? <span style={{ color: ACCENT }}>{m.awaitingReceive}</span> : '—'}</td>
                  <td style={tdR}>{m.cutting > 0 ? <span style={{ color: ACCENT }}>{m.cutting}</span> : '—'}</td>
                  <td style={tdR}>{m.inProcess > 0 ? <span style={{ color: '#7b1fa2' }}>{m.inProcess}</span> : '—'}</td>
                  <td style={tdR}>{m.awaitingQc > 0 ? <span style={{ color: '#d97706' }}>{m.awaitingQc}</span> : '—'}</td>
                  <td style={tdR}>{m.passed > 0 ? <span style={{ color: '#16a34a', fontWeight: 700 }}>{m.passed}</span> : '—'}</td>
                  <td style={tdR}>{m.failed > 0 ? <span style={{ color: '#c62828', fontWeight: 700 }}>{m.failed}</span> : '—'}</td>
                </tr>
              ))}
              {sel.materials.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chưa có đợt sắt nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Wrench size={20} /> Lệnh sản xuất — Công đoạn Phôi
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Theo dõi tiến độ cắt sắt theo PO/PI — bấm để xem chi tiết theo loại sắt. Xác nhận nhận/báo cắt xong làm ở <b>Xác nhận sản lượng</b>.
      </div>
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO / PI</th>
              <th style={thR}>Đã xuất (cây)</th>
              <th style={thR}>Đang xử lý</th>
              <th style={thR}>Đã KCS đạt</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {piRows.map(r => (
              <tr key={r.productionInvoiceId} onClick={() => setSelPi(r.productionInvoiceId)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{r.poNumber}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{r.totalIssued}</td>
                <td style={tdR}>
                  {r.totalAwaiting > 0
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#d97706', fontWeight: 600 }}><Clock size={12} /> {r.totalAwaiting}</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a' }}><Check size={12} /> xong</span>}
                </td>
                <td style={{ ...tdR, color: '#16a34a', fontWeight: 700 }}>{r.totalPassed}</td>
                <td style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}><ChevronRight size={16} /></td>
              </tr>
            ))}
            {piRows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Chưa có PI nào được xuất sắt</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
