'use client'
// Phần A – Đợt 4 (YC6): màn "Vật tư cần về" - vật tư đã chốt mua mà chưa về đủ, xếp theo hạn chót.
// CHỈ XEM (mọi vai trò): không nút sửa/nhận hàng. BE (`GET /materials-due`) tính sẵn trạng thái, hạn, còn thiếu - FE chỉ trình bày.
import { useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { useIsCompact } from '../../../hooks/useMediaQuery'
import { useUrlState } from '../../../hooks/useUrlState'
import { getMaterialsDue, type MaterialsDueRow, type MaterialsDueScope, type MaterialsDueView } from '../../../services/materials-due-api'
import DatePicker from '../../../components/DatePicker'
import FilterPills from '../../../components/FilterPills'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import RefreshButton from '../../../components/RefreshButton'
import EmptyState from '../../../components/EmptyState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { th, td, tableWrap } from '../../../styles/table'
import {
  canReceiveRow, emptyMessage, groupLabel, receiveUrl, isDayKey, isRedState, overdueHint, parseView, pillCount, qtyNeedText, skuChip, stateInfo, supplierText, vnToday, windowText, fmtQty,
  type DueTone,
} from './vatTuCanVe'

const VIEW_OPTIONS: { key: MaterialsDueView; label: string }[] = [
  { key: 'overdue', label: 'Quá hạn' },
  { key: 'today', label: 'Hôm nay' },
  { key: 'date', label: 'Theo ngày' },
  { key: 'all', label: 'Tất cả' },
]

/** Màu chữ + nền của nhãn trạng thái theo mức nhấn. Hạn chót hôm nay: nền đỏ đặc, chữ trắng. */
const TONE_STYLE: Record<DueTone, React.CSSProperties> = {
  critical: { background: 'var(--bg-c62828)', color: '#fff' },
  red: { background: 'rgba(198, 40, 40, 0.12)', color: 'var(--fg-c62828)' },
  amber: { background: 'var(--amber-bg)', color: 'var(--amber)' },
  grey: { background: 'var(--surface2)', color: 'var(--text2)' },
  muted: { background: 'transparent', color: 'var(--text3)' },
}

function StateBadge({ row }: { row: MaterialsDueRow }) {
  const { text, tone } = stateInfo(row)
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', ...TONE_STYLE[tone] }}>
      {text}
    </span>
  )
}

/** Lệnh gộp: mỗi SKU 1 khối nhỏ - dòng 1 "MY-313 · hạn 10/11" (không xuống dòng), dòng 2 mã SKU mờ (đánh giá UX U4: trước ghi
 *  chung 1 dòng "MY-313 (SKU) · hạn …" nên cột hẹp cắt mã SKU xuống 3 dòng). Không tách dòng mua. */
function SkuList({ row }: { row: MaterialsDueRow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {row.skus.map((s) => {
        const c = skuChip(s)
        return (
          <div key={s.itemId} style={{ fontSize: 12, lineHeight: 1.4 }}>
            <div style={{ whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600 }}>{c.code}</span>
              <span style={{ color: s.deadline ? 'var(--text2)' : 'var(--text3)' }}> · {c.deadlineText}</span>
            </div>
            {c.sku && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.sku}</div>}
          </div>
        )
      })}
    </div>
  )
}

/** Lệnh gộp: 1 dòng chữ nhỏ cho biết SKU/lệnh nào được chia hàng trước (BE tính theo thứ tự ưu tiên khi xuất). */
function PriorityNote({ row }: { row: MaterialsDueRow }) {
  if (!row.priorityNote) return null
  return <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.4 }}>{row.priorityNote}</div>
}

function ReceiveButton({ row, onOpen }: { row: MaterialsDueRow; onOpen: (r: MaterialsDueRow) => void }) {
  return (
    <button
      onClick={() => onOpen(row)}
      title="Mở màn Nhập kho đúng dòng vật tư này"
      style={{ height: 30, padding: '0 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--bg-ede7f6)', color: 'var(--fg-4527a0)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      Nhập kho
    </button>
  )
}

function SupplierCell({ row }: { row: MaterialsDueRow }) {
  const s = supplierText(row)
  return (
    <div>
      <div style={{ color: s.placed ? 'var(--text)' : 'var(--text3)', fontStyle: s.placed ? 'normal' : 'italic' }}>{s.name}</div>
      {s.order && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.order}</div>}
    </div>
  )
}

/** Nền/viền dòng: đỏ khi quá hạn hoặc hạn chót hôm nay (hạn chót hôm nay đậm hơn). */
const redRowBg = (row: MaterialsDueRow): string | undefined =>
  row.state === 'DEADLINE_TODAY' ? 'rgba(198, 40, 40, 0.14)' : row.state === 'OVERDUE' ? 'rgba(198, 40, 40, 0.07)' : undefined

export default function VatTuCanVePage() {
  const isCompact = useIsCompact()
  const { user } = useAuth()
  const router = useRouter()
  const openReceive = (r: MaterialsDueRow) => router.push(receiveUrl(r))
  const showReceive = (r: MaterialsDueRow) => canReceiveRow(user, r)
  // Lọc nằm trên URL (`view`, `date`) để link từ thông báo mở đúng lọc và F5 giữ nguyên.
  const [urlView, setUrlView] = useUrlState('view')
  const [urlDate, setUrlDate] = useUrlState('date')
  const view = parseView(urlView)
  const date = view === 'date' ? (isDayKey(urlDate) ? urlDate : vnToday()) : null
  const [scope, setScope] = useState<MaterialsDueScope>('mine')

  const { data, isLoading, error, refetch } = useFetch(
    () => getMaterialsDue({ view, date: date ?? undefined, scope }),
    [view, date, scope],
  )

  const changeView = (v: MaterialsDueView) => {
    setUrlView(v)
    if (v === 'date' && !isDayKey(urlDate)) setUrlDate(vnToday())
  }

  const rows = data?.rows ?? []
  const canReceiveAny = rows.some(showReceive)
  const redCount = rows.filter((r) => isRedState(r.state)).length
  const overdue = overdueHint(view, data?.counts)

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={pageTitle}>Vật tư cần về</div>
        <div style={pageSubtitle}>
          Vật tư đã chốt mua mà chưa về đủ{data ? ` · được về sớm nhất ${data.earliestArrivalDays} ngày trước hạn chót` : ''}
        </div>
      </div>
      <RefreshButton onRefresh={refetch} loading={isLoading} />
    </div>
  )

  const filters = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <FilterPills<MaterialsDueView>
        options={VIEW_OPTIONS}
        active={view}
        onChange={changeView}
        countFor={(k) => pillCount(data?.counts, k) as number}
      />
      {view === 'date' && date && (
        <DatePicker value={date} onChange={(v) => { if (v) setUrlDate(v) }} title="Xem vật tư đang trong khoảng được về của ngày này" />
      )}
      {/* Đánh giá UX U3: phạm vi người mua tách hẳn khỏi nhóm lọc ngày (trước 2 nút "Tất cả" đứng sát nhau), có chữ "Phạm vi",
          nút đang chọn tô tím nhạt để khác nút lọc (xám đậm). */}
      {data?.canChooseScope && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Phạm vi</span>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }} role="group" aria-label="Phạm vi vật tư">
            {([['mine', 'Của tôi'], ['all', 'Mọi người mua']] as [MaterialsDueScope, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setScope(k)}
                aria-pressed={scope === k}
                style={{
                  padding: '5px 12px', fontSize: 12, fontWeight: scope === k ? 700 : 600, border: 'none', cursor: 'pointer',
                  background: scope === k ? 'var(--bg-ede7f6)' : 'var(--surface)', color: scope === k ? 'var(--fg-4527a0)' : 'var(--text2)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {data?.warehouseScope && (
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface)' }}>
          {/* Tên kho do BE trả (đúng ở mọi tab, kể cả tab rỗng); thiếu thì lấy từ dòng cùng kho, cuối cùng mới hiện mã. */}
          {data.warehouseScopeName ?? rows.find((r) => r.warehouseCode === data.warehouseScope)?.warehouseName ?? `Kho: ${data.warehouseScope}`}
        </span>
      )}
    </div>
  )

  let body: React.ReactNode
  if (error && !data) {
    body = <LoadErrorState error={error} onRetry={refetch} />
  } else if (isLoading && !data) {
    body = <LoadingState />
  } else if (!data) {
    body = <LoadErrorState error="Chưa có dữ liệu" onRetry={refetch} />
  } else if (rows.length === 0) {
    body = <EmptyState icon={<PackageCheck size={32} style={{ opacity: 0.4, marginBottom: 8 }} />} message={emptyMessage(view, date)} />
  } else if (isCompact) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => <MaterialCard key={r.lineId} row={r} onReceive={showReceive(r) ? openReceive : undefined} />)}
      </div>
    )
  } else {
    body = (
      <div style={tableWrap}>
        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>Trạng thái</th>
              <th style={th}>Được về từ – Hạn chót</th>
              <th style={th}>Vật tư</th>
              <th style={th}>Cần / Chốt mua</th>
              <th style={{ ...th, textAlign: 'right' }}>Đã nhận</th>
              <th style={{ ...th, textAlign: 'right' }}>Còn thiếu</th>
              <th style={{ ...th, minWidth: 150 }}>Lệnh</th>
              <th style={th}>NCC</th>
              <th style={{ ...th, width: 150 }}>Người mua</th>
              <th style={th}>Kho nhận</th>
              {canReceiveAny && <th style={th}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const red = isRedState(r.state)
              return (
                <tr key={r.lineId} style={{
                  borderTop: '1px solid var(--border)', verticalAlign: 'top', background: redRowBg(r),
                  boxShadow: red ? 'inset 3px 0 0 var(--bg-c62828)' : undefined,
                }}>
                  <td style={td}><StateBadge row={r} /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: red ? 'var(--fg-c62828)' : 'var(--text)', fontWeight: red ? 600 : 400 }}>{windowText(r)}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.materialName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{groupLabel(r.group)}</div>
                  </td>
                  <td style={td}>{qtyNeedText(r)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtQty(r.receivedQty)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: red ? 'var(--fg-c62828)' : 'var(--text)' }}>{fmtQty(r.remainingQty)} {r.unit}</td>
                  <td style={td}><SkuList row={r} /><PriorityNote row={r} /></td>
                  <td style={td}><SupplierCell row={r} /></td>
                  <td style={{ ...td, fontSize: 12 }}>{r.buyerName ?? <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td style={td}>{r.warehouseName ?? r.warehouseCode ?? <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  {canReceiveAny && <td style={td}>{showReceive(r) && <ReceiveButton row={r} onOpen={openReceive} />}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      {header}
      {filters}
      {error && data && <div style={{ marginBottom: 12 }}><LoadErrorState error={error} onRetry={refetch} /></div>}
      {/* Đánh giá UX U2: lọc Hôm nay không chứa dòng quá hạn - nhắc nổi bật, bấm là sang lọc Quá hạn. */}
      {overdue !== null ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(198, 40, 40, 0.10)', border: '1px solid rgba(198, 40, 40, 0.35)',
        }}>
          <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-c62828)' }}>
              {overdue} dòng đã quá hạn chưa về đủ — không nằm trong “Hôm nay”
            </span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              {redCount > 0 ? `Thêm ${redCount} dòng hạn chót hôm nay ở danh sách dưới. ` : ''}Bấm “Xem quá hạn” để xem.
            </span>
          </div>
          <button
            onClick={() => changeView('overdue')}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--bg-c62828)', color: '#fff', fontSize: 13, fontWeight: 600 }}
          >
            Xem quá hạn
          </button>
        </div>
      ) : data && rows.length > 0 && redCount > 0 && (
        <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--fg-c62828)' }}>
          {redCount} dòng quá hạn hoặc đến hạn chót hôm nay mà chưa về đủ.
        </div>
      )}
      {body}
    </div>
  )
}

/** Thẻ cho màn hẹp: nhãn trạng thái + còn thiếu nổi lên đầu, phần đỏ vẫn rõ. */
function MaterialCard({ row, onReceive }: { row: MaterialsDueRow; onReceive?: (r: MaterialsDueRow) => void }) {
  const red = isRedState(row.state)
  const s = supplierText(row)
  const label: React.CSSProperties = { fontSize: 11, color: 'var(--text3)' }
  return (
    <div style={{
      background: redRowBg(row) ? `linear-gradient(${redRowBg(row)}, ${redRowBg(row)}), var(--surface)` : 'var(--surface)',
      border: `1px solid ${red ? 'rgba(198, 40, 40, 0.45)' : 'var(--border)'}`, borderLeft: red ? '4px solid var(--bg-c62828)' : undefined,
      borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <StateBadge row={row} />
        <span style={{ fontSize: 12, color: red ? 'var(--fg-c62828)' : 'var(--text2)', fontWeight: red ? 600 : 400 }}>{windowText(row)}</span>
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{row.materialName}</div>
        <div style={label}>{groupLabel(row.group)}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          {qtyNeedText(row)}
          <div style={label}>Đã nhận {fmtQty(row.receivedQty)} {row.unit}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={label}>Còn thiếu</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: red ? 'var(--fg-c62828)' : 'var(--text)' }}>{fmtQty(row.remainingQty)} {row.unit}</div>
        </div>
      </div>
      <div>
        <div style={label}>Lệnh</div>
        <SkuList row={row} />
        <PriorityNote row={row} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12 }}>
        <div><span style={label}>NCC </span><span style={{ color: s.placed ? 'var(--text)' : 'var(--text3)', fontStyle: s.placed ? 'normal' : 'italic' }}>{s.name}{s.order ? ` · ${s.order}` : ''}</span></div>
        <div><span style={label}>Người mua </span>{row.buyerName ?? '—'}</div>
        <div><span style={label}>Kho nhận </span>{row.warehouseName ?? row.warehouseCode ?? '—'}</div>
      </div>
      {onReceive && <div><ReceiveButton row={row} onOpen={onReceive} /></div>}
    </div>
  )
}
