import { useState } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import { SEED_SETTINGS } from '../data/seed'

export default function Settings({ settings, onSave }) {
  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const VARS = ['[TÊN KH]', '[TÊN SALES]', '[MÃ SP]', '[NGÀY]']

  return (
    <div style={{ maxWidth:560 }}>
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:14 }}>Cài đặt thông báo</div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, color:'var(--text2)', display:'block', marginBottom:6 }}>Nhắc trước bao nhiêu ngày</label>
          <select value={form.remindDaysBefore} onChange={e => set('remindDaysBefore', parseInt(e.target.value))} style={{ width:180 }}>
            {[1,2,3,5,7,14].map(d => <option key={d} value={d}>{d} ngày</option>)}
          </select>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
            Hệ thống sẽ hiển thị cảnh báo &quot;sắp tới&quot; trước hạn {form.remindDaysBefore} ngày
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:12, color:'var(--text2)', display:'block', marginBottom:6 }}>Kênh thông báo</label>
            <select value={form.notifyChannel} onChange={e => set('notifyChannel', e.target.value)}>
              <option>Zalo OA</option>
              <option>Email</option>
              <option>Zalo OA + Email</option>
              <option>Telegram</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text2)', display:'block', marginBottom:6 }}>Giờ gửi nhắc nhở</label>
            <select value={form.notifyHour} onChange={e => set('notifyHour', e.target.value)}>
              {['07:00','08:00','09:00','10:00','13:00','14:00'].map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:6 }}>Mẫu tin nhắn nhắc nhở</div>
        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>
          Các biến sẽ được thay tự động: {VARS.map(v => <code key={v} style={{ marginRight:6, background:'var(--surface2)', padding:'1px 5px', borderRadius:3 }}>{v}</code>)}
        </div>
        <textarea
          value={form.messageTemplate}
          onChange={e => set('messageTemplate', e.target.value)}
          style={{ minHeight:120 }}
        />

        <div style={{ marginTop:12, background:'var(--surface2)', borderRadius:'var(--radius)', padding:'10px 12px', fontSize:12, color:'var(--text2)' }}>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Xem trước (ví dụ):</div>
          {form.messageTemplate
            .replace('[TÊN KH]', 'Công ty TNHH Thái Lâm')
            .replace('[TÊN SALES]', 'Minh Tuấn')
            .replace('[MÃ SP]', 'SP-2241, SP-2198')
            .replace('[NGÀY]', '17/05/2026')
          }
        </div>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button
          className="primary"
          onClick={handleSave}
          style={{ display:'flex', alignItems:'center', gap:6 }}
        >
          <Save size={13}/>
          {saved ? '✓ Đã lưu!' : 'Lưu cài đặt'}
        </button>
        <button
          onClick={() => setForm(SEED_SETTINGS)}
          style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}
        >
          <RefreshCw size={12}/> Khôi phục mặc định
        </button>
      </div>
    </div>
  )
}
