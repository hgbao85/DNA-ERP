'use client'

/**
 * Lệnh sản xuất — Công đoạn PHÔI (đọc-only, tổng quan theo PO → mảnh).
 *
 * Đã nối BE thật (M3, 2026-08-12 — "Xuất sắt Phôi"): dựng thẳng từ GET /steel-issues (flat, cùng
 * nguồn dữ liệu XacNhanSanLuongPage) — PHOI_STAFF chỉ có STEEL_ISSUE:VIEW, không có
 * SKU:VIEW/PRODUCTION_ORDER:VIEW nên không tự resolve steel-issue-plan (BOM) theo PO như phía kho
 * (XuatSatPage) được. Khác `phoi-sat.service.ts` mock (3 tầng PO → Mảnh → Vật tư, đồng bộ theo
 * `lineId` giả): bỏ hẳn tầng "Mảnh" (BOM thật nhóm theo `piece`, không có khái niệm gộp nhiều
 * piece thành 1 mảnh ở BE) và bỏ "Bắt đầu/Kết thúc ca" (không có gì tương ứng ở BE, cùng lý do đã
 * bỏ ở Hàn/Sơn — xem core.tsx::TwoTierScreen). Xác nhận nhận/báo cắt xong làm ở màn riêng
 * "Xác nhận sản lượng"; màn này chỉ theo dõi tiến độ.
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

interface PieceAgg {
  pieceId: string; pieceName: string; materialName: string
  issuedBarCount: number; awaitingReceive: number; cutting: number; inProcess: number; awaitingQc: number; passed: number; failed: number
}
interface PoAgg { productionOrderId: string; poNumber: string; pieces: PieceAgg[]; totalIssued: number; totalPassed: number; totalAwaiting: number }

export default function LenhSanXuatPhoi({ readOnly = true }: { readOnly?: boolean }) {
  void readOnly // màn này luôn đọc-only — xác nhận/báo cắt làm ở XacNhanSanLuongPage
  const { data: issues, isLoading } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  const { data: reviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])
  const [selPo, setSelPo] = useState<string | null>(null)

  const poRows: PoAgg[] = useMemo(() => {
    const failedByIssue = new Map<string, number>()
    for (const r of reviews ?? []) if (r.steelIssueId) failedByIssue.set(r.steelIssueId, r.failedQty)

    // Gom theo productionOrderId (luôn duy nhất) chứ KHÔNG theo mã hiển thị salesOrderCode -
    // nhiều lệnh SX có thể cùng chung 1 mã Sales (nhiều SKU/đơn) hoặc cùng null.
    const byPo = new Map<string, BeSteelIssue[]>()
    const order: string[] = []
    for (const i of issues ?? []) {
      if (!byPo.has(i.productionOrderId)) { byPo.set(i.productionOrderId, []); order.push(i.productionOrderId) }
      byPo.get(i.productionOrderId)!.push(i)
    }
    return order.map(productionOrderId => {
      const list = byPo.get(productionOrderId)!
      const po = list[0].salesOrderCode ?? '—'
      const byPiece = new Map<string, BeSteelIssue[]>()
      for (const i of list) { if (!byPiece.has(i.pieceId)) byPiece.set(i.pieceId, []); byPiece.get(i.pieceId)!.push(i) }
      const pieces: PieceAgg[] = [...byPiece.entries()].map(([pieceId, its]) => {
        const failed = its.filter(i => i.status === 'QC_PASSED').reduce((s, i) => s + (failedByIssue.get(i.id) ?? 0), 0)
        const passed = its.filter(i => i.status === 'QC_PASSED').reduce((s, i) => s + (i.actualBarCount ?? i.barCount) - (failedByIssue.get(i.id) ?? 0), 0)
        return {
          pieceId, pieceName: its[0].pieceName, materialName: its[0].materialName,
          issuedBarCount: its.reduce((s, i) => s + i.barCount, 0),
          awaitingReceive: its.filter(i => i.status === 'ISSUED').reduce((s, i) => s + i.barCount, 0),
          cutting: its.filter(i => i.status === 'RECEIVED').reduce((s, i) => s + i.barCount, 0),
          inProcess: its.filter(i => i.status === 'IN_PROCESS').reduce((s, i) => s + (i.actualBarCount ?? i.barCount), 0),
          awaitingQc: its.filter(i => i.status === 'AWAITING_QC').reduce((s, i) => s + (i.actualBarCount ?? i.barCount), 0),
          passed, failed,
        }
      })
      return {
        productionOrderId, poNumber: po, pieces,
        totalIssued: pieces.reduce((s, p) => s + p.issuedBarCount, 0),
        totalPassed: pieces.reduce((s, p) => s + p.passed, 0),
        totalAwaiting: pieces.reduce((s, p) => s + p.awaitingReceive + p.cutting + p.inProcess + p.awaitingQc, 0),
      }
    })
  }, [issues, reviews])

  if (isLoading || !issues) return <LoadingState />

  const sel = selPo ? poRows.find(r => r.productionOrderId === selPo) ?? null : null

  if (sel) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => setSelPo(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
            <ChevronLeft size={15} /> Quay lại
          </button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{sel.poNumber}</h2>
        </div>
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>Mảnh</th>
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
              {sel.pieces.map(p => (
                <tr key={p.pieceId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{p.pieceName}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{p.materialName}</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{p.issuedBarCount}</td>
                  <td style={tdR}>{p.awaitingReceive > 0 ? <span style={{ color: ACCENT }}>{p.awaitingReceive}</span> : '—'}</td>
                  <td style={tdR}>{p.cutting > 0 ? <span style={{ color: ACCENT }}>{p.cutting}</span> : '—'}</td>
                  <td style={tdR}>{p.inProcess > 0 ? <span style={{ color: '#7b1fa2' }}>{p.inProcess}</span> : '—'}</td>
                  <td style={tdR}>{p.awaitingQc > 0 ? <span style={{ color: '#d97706' }}>{p.awaitingQc}</span> : '—'}</td>
                  <td style={tdR}>{p.passed > 0 ? <span style={{ color: '#16a34a', fontWeight: 700 }}>{p.passed}</span> : '—'}</td>
                  <td style={tdR}>{p.failed > 0 ? <span style={{ color: '#c62828', fontWeight: 700 }}>{p.failed}</span> : '—'}</td>
                </tr>
              ))}
              {sel.pieces.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chưa có đợt sắt nào</td></tr>
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
        Theo dõi tiến độ cắt sắt theo PO — bấm PO để xem chi tiết theo mảnh. Xác nhận nhận/báo cắt xong làm ở <b>Xác nhận sản lượng</b>.
      </div>
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO</th>
              <th style={thR}>Đã xuất (cây)</th>
              <th style={thR}>Đang xử lý</th>
              <th style={thR}>Đã KCS đạt</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {poRows.map(r => (
              <tr key={r.productionOrderId} onClick={() => setSelPo(r.productionOrderId)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
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
            {poRows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Chưa có PO nào được xuất sắt</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
