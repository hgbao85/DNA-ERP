import { format, addDays, parseISO } from 'date-fns'
import { calcStatus } from '../hooks/useStore'
import { AlertTriangle, Clock, CheckCircle, Users, Send } from 'lucide-react'

const STATUS_LABEL = {
  overdue: { label: 'Quá hạn',   cls: 'red' },
  today:   { label: 'Hôm nay',   cls: 'amber' },
  soon:    { label: 'Sắp tới',   cls: 'blue' },
  ok:      { label: 'Đã xong',   cls: 'green' },
}

function DaysLabel({ daysLeft, status }: { daysLeft: number; status: string }) {
  if (status === 'overdue') return <span className="badge red">Quá hạn {Math.abs(daysLeft)} ngày</span>
  if (status === 'today')   return <span className="badge amber">Hôm nay</span>
  if (status === 'soon')    return <span className="badge blue">{daysLeft} ngày nữa</span>
  return <span className="badge green">Đã xong</span>
}

function Avatar({ name, color = '#185FA5', bg = '#E6F1FB' }: { name: string; color?: string; bg?: string }) {
  const initials = name.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('')
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: bg, color, fontSize: 12, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{initials}</div>
  )
}

const AVATAR_COLORS = [
  { color: '#185FA5', bg: '#E6F1FB' },
  { color: '#0F6E56', bg: '#E1F5EE' },
  { color: '#534AB7', bg: '#EEEDFE' },
  { color: '#993C1D', bg: '#FAECE7' },
  { color: '#854F0B', bg: '#FAEEDA' },
]

export default function Dashboard({ customers = [], settings = {} as any, onSelect, onSendNotif }: { customers?: any[]; settings?: any; onSelect?: (c?: any) => void; onSendNotif?: (c: any) => void }) {
  const rb = settings?.remindDaysBefore || 7

  // Ensure customers is an array
  const safeCustomers = Array.isArray(customers) ? customers : []

  const urgent = safeCustomers.filter(c => {
    if (!c) return false
    const { status } = calcStatus(c, rb)
    return status === 'overdue' || status === 'today'
  }).sort((a, b) => {
    const da = calcStatus(a, rb).daysLeft
    const db = calcStatus(b, rb).daysLeft
    return da - db
  })

  const upcoming = safeCustomers.filter(c => c && calcStatus(c, rb).status === 'soon')

  const total = safeCustomers.length
  const overdueCount = safeCustomers.filter(c => calcStatus(c, rb).status === 'overdue').length
  const soonCount = safeCustomers.filter(c => calcStatus(c, rb).status === 'soon').length
  const doneCount = safeCustomers.filter(c => calcStatus(c, rb).status === 'ok').length

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Tổng khách hàng', val: total, sub: 'đang theo dõi', icon: <Users size={16}/>, color: 'var(--text)' },
          { label: 'Cần liên hệ ngay', val: overdueCount + urgent.filter(c=>calcStatus(c,rb).status==='today').length, sub: 'quá hạn & hôm nay', icon: <AlertTriangle size={16}/>, color: '#A32D2D' },
          { label: 'Trong 7 ngày tới', val: soonCount, sub: 'sắp đến hạn', icon: <Clock size={16}/>, color: '#854F0B' },
          { label: 'Hoàn thành', val: doneCount, sub: 'tháng này', icon: <CheckCircle size={16}/>, color: '#3B6D11' },
        ].map((s, i) => (
          <div key={i} style={{ background:'var(--surface2)', borderRadius:'var(--radius)', padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ color: s.color }}>{s.icon}</span> {s.label}
            </div>
            <div style={{ fontSize:24, fontWeight:600, color: s.color }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Urgent */}
      <div className="section-title">Cần liên hệ ngay — hôm nay & quá hạn</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
        {urgent.length === 0 && (
          <div style={{ padding:'20px', textAlign:'center', color:'var(--text3)', background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
            Không có khách hàng cần liên hệ gấp 🎉
          </div>
        )}
        {urgent.map((c, i) => {
          const { daysLeft, status, nextDate } = calcStatus(c, rb)
          const ac = AVATAR_COLORS[i % AVATAR_COLORS.length]
          return (
            <div key={c?.id || i}
              onClick={() => onSelect?.(c)}
              style={{
                background:'var(--surface)', border:'1px solid var(--border)',
                borderLeft: status === 'overdue' ? '3px solid #E24B4A' : '3px solid #EF9F27',
                borderRadius:'var(--radius)', padding:'10px 14px',
                display:'flex', alignItems:'center', gap:12,
                cursor:'pointer', transition:'border-color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor='var(--border2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
            >
              <Avatar name={c?.name || 'N/A'} {...ac} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{c?.name || 'Unknown'}</div>
                <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>
                  <DaysLabel daysLeft={daysLeft} status={status} />
                  {' '} · {Array.isArray(c?.products) ? c.products.map((p: string) => <span key={p} className="chip">{p}</span>) : 'N/A'}
                  {' '} · Sales: <strong>{c?.sales || '-'}</strong>
                </div>
              </div>
              <button
                className="primary"
                onClick={e => { e.stopPropagation(); onSendNotif?.(c) }}
                style={{ display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}
              >
                <Send size={12}/> Gửi nhắc
              </button>
            </div>
          )
        })}
      </div>

      {/* Upcoming */}
      <div className="section-title">Sắp đến hạn (trong {rb} ngày tới)</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {upcoming.length === 0 && (
          <div style={{ padding:'16px', textAlign:'center', color:'var(--text3)', background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
            Không có khách hàng nào sắp đến hạn
          </div>
        )}
        {upcoming.map((c, i) => {
          const { daysLeft, nextDate } = calcStatus(c, rb)
          const ac = AVATAR_COLORS[i % AVATAR_COLORS.length]
          return (
            <div key={c?.id || i}
              onClick={() => onSelect?.(c)}
              style={{
                background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:'var(--radius)', padding:'10px 14px',
                display:'flex', alignItems:'center', gap:12, cursor:'pointer',
              }}
            >
              <Avatar name={c?.name || 'N/A'} {...ac} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{c?.name || 'Unknown'}</div>
                <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>
                  <span className="badge blue">{daysLeft} ngày nữa — {format(nextDate,'dd/MM')}</span>
                  {' '} · Sales: <strong>{c?.sales || '-'}</strong>
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); onSelect?.(c) }} style={{ fontSize:11 }}>Xem chi tiết</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
