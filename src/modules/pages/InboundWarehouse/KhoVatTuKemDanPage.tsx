'use client'

/**
 * Xuất đan - PHIẾU 2 (anh Nhân 09/11/2026): kho Phụ kiện cấp dây, gỗ, đinh, nút kèm mảnh cho CÙNG điểm đan, giao cùng chuyến.
 * Khi kho Sơn lập phiếu xuất mảnh, hệ thống tính số vật tư cần cấp kèm (định mức / mảnh × số mảnh trên phiếu) và báo kho Phụ kiện.
 * Thủ kho Phụ kiện mở phiếu mảnh ở đây, sửa số thực cấp nếu cần, "Lập phiếu vật tư kèm" -> phiếu XK có số, in, điểm đan ký,
 * tải ảnh rồi mới trừ tồn (phần "Phiếu chờ ký" bên dưới).
 */
import { useState } from 'react'
import { format } from 'date-fns'
import { Printer, Scissors } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import {
  createIssueSlip,
  getWeavingMaterialDemand,
  type IssueSlip,
  type WeavingMaterialDemand,
} from '../../../services/issue-slips-api'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import LenhCode from '../../../components/LenhCode'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import PhieuXuatPage from './PhieuXuatPage'
import { IssueSlipCartProvider } from './IssueSlipCart'
import { printIssueSlip } from './printIssueSlip'

const th: React.CSSProperties = { padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, verticalAlign: 'middle' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }
const fmt = (n: number) => String(Math.round(n * 10_000) / 10_000)

export default function KhoVatTuKemDanPage() {
  const { data, isLoading, error, refetch } = useFetch(getWeavingMaterialDemand, [])
  useRealtimeRefetch(['issue-slips', 'weaving-issues', 'stock'], () => { void refetch() })
  const demand = data ?? []

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <h2 style={{ ...pageTitle, marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Scissors size={20} /> Vật tư kèm đan
      </h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Kho Sơn xuất mảnh cho điểm đan; kho Phụ kiện lập phiếu riêng cấp <b>dây, gỗ, đinh, nút</b> cho cùng điểm đan, giao cùng chuyến.
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, margin: '4px 0 10px' }}>Phiếu mảnh cần cấp vật tư kèm ({demand.length})</div>
      {isLoading ? <LoadingState /> : error ? <LoadErrorState error={error} onRetry={refetch} /> : demand.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Không có phiếu mảnh nào đang chờ vật tư kèm.</div>
      ) : demand.map(d => <DemandCard key={d.slipId} demand={d} onDone={() => void refetch()} />)}

      <div style={{ fontSize: 15, fontWeight: 700, margin: '24px 0 10px' }}>Phiếu xuất của kho</div>
      <IssueSlipCartProvider>
        <PhieuXuatPage listOnly />
      </IssueSlipCartProvider>
    </div>
  )
}

function DemandCard({ demand, onDone }: { demand: WeavingMaterialDemand; onDone: () => void }) {
  const keyOf = (l: WeavingMaterialDemand['lines'][number]) => `${l.productionOrderId}:${l.pieceId}:${l.materialId}`
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(demand.lines.map(l => [keyOf(l), fmt(l.remainingQty)])),
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<IssueSlip | null>(null)

  const lines = demand.lines
    .map(l => ({ l, q: Number(qty[keyOf(l)]) }))
    .filter(x => x.q > 0)

  const create = async () => {
    setBusy(true); setErr('')
    try {
      const slip = await createIssueSlip({
        pairedSlipId: demand.slipId,
        lines: lines.map(({ l, q }) => ({
          kind: 'WEAVING_MATERIAL',
          materialId: l.materialId,
          productionOrderId: l.productionOrderId,
          pieceId: l.pieceId,
          qty: q,
        })),
      })
      setCreated(slip)
      onDone()
    } catch (e) {
      setErr(errMsg(e, 'Không lập được phiếu vật tư kèm'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={card}>
      <div style={head}>
        <b style={{ fontFamily: 'monospace', fontSize: 14 }}>{demand.slipCode}</b>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {demand.warehouseName} → <b style={{ color: 'var(--text2)' }}>{demand.weavingPointName ?? '—'}</b> · lập {format(new Date(demand.createdAt), 'dd/MM HH:mm')} · {demand.slipStatus === 'ISSUED' ? 'mảnh đã xuất' : 'mảnh chờ ký'}
          {demand.pairedSlipCodes.length > 0 && ` · đã có phiếu vật tư ${demand.pairedSlipCodes.join(', ')}`}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Lệnh · SKU</th><th style={th}>Mảnh</th><th style={th}>Vật tư</th>
              <th style={{ ...th, textAlign: 'right' }}>Cần</th><th style={{ ...th, textAlign: 'right' }}>Đã lập</th>
              <th style={{ ...th, textAlign: 'right' }}>Tồn</th><th style={{ ...th, textAlign: 'right' }}>Cấp lần này</th><th style={th}>ĐVT</th>
            </tr>
          </thead>
          <tbody>
            {demand.lines.map(l => (
              <tr key={keyOf(l)} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}><LenhCode piCode={l.lenhCode} />{l.sku ? ` · ${l.sku}` : ''}</td>
                <td style={td}>{l.pieceName} <span style={{ color: 'var(--text3)' }}>×{l.pieceQty}</span></td>
                <td style={{ ...td, fontWeight: 600 }}>{l.materialCode} <span style={{ fontWeight: 400, color: 'var(--text2)' }}>{l.materialName}</span></td>
                <td style={{ ...td, textAlign: 'right' }}>{fmt(l.demandQty)}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{fmt(l.coveredQty)}</td>
                <td style={{ ...td, textAlign: 'right', color: l.onHandQty < l.remainingQty ? 'var(--fg-dc2626)' : 'var(--text3)' }}>{fmt(l.onHandQty)}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <input
                    type="number" min={0} step="any"
                    value={qty[keyOf(l)] ?? ''}
                    onChange={e => setQty(p => ({ ...p, [keyOf(l)]: e.target.value }))}
                    aria-label={`Cấp ${l.materialCode} cho ${l.pieceName}`}
                    style={{ width: 90, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                  />
                </td>
                <td style={{ ...td, color: 'var(--text3)' }}>{l.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Số gợi ý = định mức / mảnh × số mảnh trên phiếu, trừ phần đã lập. Sửa theo số thực cấp.</span>
        <div style={{ flex: 1 }} />
        {created && (
          <button onClick={() => printIssueSlip(created)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
            <Printer size={13} /> In {created.code}
          </button>
        )}
        <button
          onClick={() => void create()}
          disabled={busy || lines.length === 0}
          style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: busy || lines.length === 0 ? 'var(--surface2)' : 'var(--bg-2563eb)', color: busy || lines.length === 0 ? 'var(--text3)' : '#fff', cursor: busy || lines.length === 0 ? 'not-allowed' : 'pointer' }}
        >
          {busy ? 'Đang lập…' : 'Lập phiếu vật tư kèm'}
        </button>
      </div>
      {err && <div style={{ padding: '0 14px 12px', fontSize: 12, color: 'var(--fg-dc2626, #dc2626)' }}>{err}</div>}
    </div>
  )
}
