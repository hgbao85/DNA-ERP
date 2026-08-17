'use client'

/**
 * Thống kê công đoạn (Phôi) — bóc nhỏ hơn 4 trạng thái thô (Chờ nhận/Đang cắt/Chờ KCS/Đạt) theo
 * TỪNG công đoạn chi tiết (Cắt/Uốn/Dập/Đục lỗ/Tán/Tóp đầu/Xẻ) đã chọn sẵn cho từng mảnh, xem
 * PieceBom.processSteps (BE) + SteelIssue.completedSteps/requiredSteps. Cùng nguồn dữ liệu +
 * pattern client-aggregate như LenhSanXuatPhoi.tsx (GET /steel-issues, không cần endpoint riêng).
 *
 * "Đang chờ" 1 công đoạn = số cây của đợt có công đoạn đó trong requiredSteps nhưng CHƯA có trong
 * completedSteps, và đợt chưa qua KCS (status ISSUED/RECEIVED/IN_PROCESS) — đợt đã AWAITING_QC/
 * QC_PASSED nghĩa là mọi requiredSteps đã xong hết, không còn "chờ" ở bước nào nữa.
 */

import { useMemo } from 'react'
import { ListChecks } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSteelIssue } from '../../../services/steel-issues-api'
import type { ProcessStep } from '../../../types/sku'
import { PROCESS_STEPS, PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import LoadingState from '../../../components/LoadingState'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

const barCountOf = (i: BeSteelIssue) => i.actualBarCount ?? i.barCount
const isPendingStep = (i: BeSteelIssue, step: ProcessStep) =>
  (i.status === 'ISSUED' || i.status === 'RECEIVED' || i.status === 'IN_PROCESS') &&
  i.requiredSteps.includes(step) && !i.completedSteps.includes(step)

interface PieceRow {
  pieceId: string; pieceName: string; materialName: string
  pending: Partial<Record<ProcessStep, number>>
  awaitingQc: number; passed: number
}
interface PoRow { poNumber: string; pieces: PieceRow[] }

export default function ThongKeCongDoanPage() {
  const { data: issues, isLoading } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])

  const activeSteps = useMemo(
    () => PROCESS_STEPS.filter(step => (issues ?? []).some(i => i.requiredSteps.includes(step))),
    [issues],
  )

  const poRows: PoRow[] = useMemo(() => {
    const byPo = new Map<string, BeSteelIssue[]>()
    const order: string[] = []
    for (const i of issues ?? []) {
      if (!byPo.has(i.poNumber)) { byPo.set(i.poNumber, []); order.push(i.poNumber) }
      byPo.get(i.poNumber)!.push(i)
    }
    return order.map(po => {
      const list = byPo.get(po)!
      const byPiece = new Map<string, BeSteelIssue[]>()
      for (const i of list) { if (!byPiece.has(i.pieceId)) byPiece.set(i.pieceId, []); byPiece.get(i.pieceId)!.push(i) }
      const pieces: PieceRow[] = [...byPiece.entries()].map(([pieceId, its]) => {
        const pending: Partial<Record<ProcessStep, number>> = {}
        for (const step of activeSteps) {
          const n = its.filter(i => isPendingStep(i, step)).reduce((s, i) => s + barCountOf(i), 0)
          if (n > 0) pending[step] = n
        }
        return {
          pieceId, pieceName: its[0].pieceName, materialName: its[0].materialName,
          pending,
          awaitingQc: its.filter(i => i.status === 'AWAITING_QC').reduce((s, i) => s + barCountOf(i), 0),
          passed: its.filter(i => i.status === 'QC_PASSED').reduce((s, i) => s + barCountOf(i), 0),
        }
      }).filter(p => Object.keys(p.pending).length > 0 || p.awaitingQc > 0)
      return { poNumber: po, pieces }
    }).filter(r => r.pieces.length > 0)
  }, [issues, activeSteps])

  const totalsByStep = useMemo(() => {
    const totals: Partial<Record<ProcessStep, number>> = {}
    for (const step of activeSteps) {
      totals[step] = (issues ?? []).filter(i => isPendingStep(i, step)).reduce((s, i) => s + barCountOf(i), 0)
    }
    return totals
  }, [issues, activeSteps])

  if (isLoading || !issues) return <LoadingState />

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <ListChecks size={20} /> Thống kê công đoạn
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Số cây đang treo ở từng công đoạn chi tiết (chưa đánh dấu xong) — bóc nhỏ hơn 4 trạng thái ở "Lệnh sản xuất".
      </div>

      {activeSteps.length === 0 ? (
        <div style={{ ...card, padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Chưa có mảnh nào cấu hình công đoạn chi tiết (ngoài Cắt) ở "Định mức sắt".
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {activeSteps.map(step => (
              <div key={step} style={{ ...card, padding: '10px 16px', minWidth: 110 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{PROCESS_STEP_LABELS[step]}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: (totalsByStep[step] ?? 0) > 0 ? '#7b1fa2' : 'var(--text3)' }}>
                  {totalsByStep[step] ?? 0}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 + activeSteps.length * 100 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}>PO</th>
                  <th style={th}>Mảnh</th>
                  <th style={th}>Loại sắt</th>
                  {activeSteps.map(step => <th key={step} style={thR}>{PROCESS_STEP_LABELS[step]}</th>)}
                  <th style={thR}>Chờ KCS</th>
                  <th style={thR}>Đạt</th>
                </tr>
              </thead>
              <tbody>
                {poRows.map(po => po.pieces.map((p, idx) => (
                  <tr key={`${po.poNumber}-${p.pieceId}`} style={{ borderTop: '1px solid var(--border)' }}>
                    {idx === 0 ? (
                      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)' }} rowSpan={po.pieces.length}>{po.poNumber}</td>
                    ) : null}
                    <td style={{ ...td, fontWeight: 600 }}>{p.pieceName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{p.materialName}</td>
                    {activeSteps.map(step => (
                      <td key={step} style={tdR}>
                        {p.pending[step] ? <span style={{ color: '#7b1fa2', fontWeight: 700 }}>{p.pending[step]}</span> : '—'}
                      </td>
                    ))}
                    <td style={tdR}>{p.awaitingQc > 0 ? <span style={{ color: '#d97706', fontWeight: 700 }}>{p.awaitingQc}</span> : '—'}</td>
                    <td style={tdR}>{p.passed > 0 ? <span style={{ color: '#16a34a', fontWeight: 700 }}>{p.passed}</span> : '—'}</td>
                  </tr>
                )))}
                {poRows.length === 0 && (
                  <tr><td colSpan={5 + activeSteps.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có công đoạn nào đang treo</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
