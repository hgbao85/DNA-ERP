'use client'
// Câu 8 (nghiệp vụ 24/11/2026): hộp duyệt huỷ lệnh của Sếp hiện đã xuất bao nhiêu sắt, dòng mua đã ký (kèm tiền) và hàng đã làm ở
// từng công đoạn. Sắt + dòng mua đi theo CẢ lệnh (lệnh gộp gồm cả phần của SKU khác); hàng công đoạn là của riêng SKU xin huỷ.
import { useFetch } from '../../../hooks/useFetch'
import { getOrderCancelImpact, type CancelImpactDto } from '../../../services/order-cancellations-api'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import { th, td, tableWrap } from '../../../styles/table'
import { fmtDateTimeVN } from './duyetDoiMoc'

const fmtNum = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`

const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, margin: '14px 0 6px' }
const muted: React.CSSProperties = { fontSize: 12, color: 'var(--text3)' }

export default function CancelImpactPanel({ requestId }: { requestId: string }) {
  const { data, isLoading, error, refetch } = useFetch(() => getOrderCancelImpact(requestId), [requestId])
  if (error && !data) return <LoadErrorState error={error} onRetry={refetch} />
  if (isLoading || !data) return <LoadingState />
  return <ImpactBody d={data} />
}

function ImpactBody({ d }: { d: CancelImpactDto }) {
  const scope = d.isMergedInvoice ? ' (cả lệnh gộp, gồm phần của SKU khác)' : ' (cả lệnh)'
  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={muted}>
        {d.fromSnapshot ? 'Số chụp lúc Sếp duyệt' : 'Số tính lúc mở'} · {fmtDateTimeVN(d.takenAt)}
      </div>

      <div style={sectionTitle}>Sắt đã xuất{scope}</div>
      {d.steelIssued.length === 0 ? (
        <div style={muted}>Chưa xuất sắt - huỷ thì tính lại phương án cắt cho phần còn lại (lệnh gộp).</div>
      ) : (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Sắt</th>
                <th style={{ ...th, textAlign: 'right' }}>Cây (mm)</th>
                <th style={{ ...th, textAlign: 'right' }}>Số cây xuất</th>
                <th style={{ ...th, textAlign: 'right' }}>Tổ cắt đã nhận</th>
              </tr>
            </thead>
            <tbody>
              {d.steelIssued.map((s, i) => (
                <tr key={i}>
                  <td style={td}>{s.materialCode}{s.materialName ? <span style={muted}> — {s.materialName}</span> : null}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtNum(s.barLengthMm)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtNum(s.bars)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtNum(s.receivedBars)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={sectionTitle}>Dòng mua đã ký NCC (đang mua + đã mua xong){scope}</div>
      {d.signedPurchases.length === 0 ? (
        <div style={muted}>Không có dòng mua đã ký - dòng chưa ký tự giảm theo nhu cầu mới.</div>
      ) : (
        <>
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Vật tư</th>
                  <th style={th}>NCC / đơn</th>
                  <th style={th}>Trạng thái</th>
                  <th style={{ ...th, textAlign: 'right' }}>Đã ký</th>
                  <th style={{ ...th, textAlign: 'right' }}>Đã nhận</th>
                  <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {d.signedPurchases.map(p => (
                  <tr key={p.itemId}>
                    <td style={td}>{p.materialCode}<div style={muted}>{p.materialName}</div></td>
                    <td style={td}>{p.supplierName ?? '—'}{p.supplierOrderCode && <div style={muted}>Số {p.supplierOrderCode}</div>}</td>
                    <td style={td}>{p.purchased ? 'Đã mua, đã nhập kho' : 'Đang mua'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtNum(p.signedQty)} {p.unit}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtNum(p.receivedQty)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{p.amount == null ? <span style={muted}>chưa có giá</span> : fmtMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            Tổng đã ký: {fmtMoney(d.signedAmountTotal)}
            {(d.purchasedAmountTotal ?? 0) > 0 && <span style={{ ...muted, fontWeight: 400 }}> - trong đó đã mua xong {fmtMoney(d.purchasedAmountTotal ?? 0)}</span>}
            {d.missingPriceCount > 0 && <span style={{ ...muted, fontWeight: 400 }}> (chưa tính {d.missingPriceCount} dòng chưa có giá)</span>}
          </div>
          <div style={muted}>Duyệt huỷ thì người mua liên hệ NCC: bớt được thì Đóng phần thiếu, không bớt được thì hàng về vào tồn chung.</div>
        </>
      )}

      <div style={sectionTitle}>Hàng SKU này đã làm ra</div>
      {d.stages.length === 0 ? (
        <div style={muted}>Chưa làm gì ở xưởng.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {d.stages.map(st => (
            <div key={st.stage}>
              <div style={{ fontWeight: 600 }}>{st.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
                {st.rows.map(r => (
                  <span key={r.name}>{r.name}: <strong>{fmtNum(r.qty)}</strong></span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
