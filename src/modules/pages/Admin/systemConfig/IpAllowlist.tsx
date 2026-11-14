'use client'

/**
 * Giới hạn mạng công nhân: công ty không dùng nên mục này ẩn. Chỉ hiện khi DB đang có IP (bật từ trước) để Admin còn xoá mà tắt;
 * xoá hết + Lưu thì mục tự ẩn. BE vẫn giữ nguyên tính năng - cần dùng lại thì bỏ điều kiện ẩn ở trang cha.
 */

import { useState } from 'react'
import { getNetworkInfo } from '../../../../services/api'
import type { NetworkInfo } from '../../../../services/system-config-api'
import type { ConfigForm } from './fieldParts'
import { errorStyle, helpStyle, inputStyle, labelStyle } from './systemConfigStyles'

/** Dòng ghi chú ngắn của IP sắp thêm: bỏ khoảng trắng thừa. */
const cleanNote = (s: string) => s.trim().replace(/\s+/g, ' ')

export default function IpAllowlist({ form, savedCount }: { form: ConfigForm; savedCount: number }) {
  // IP mà BE thấy của người đang mở màn này (nút "Thêm IP hiện tại của tôi").
  const [netInfo, setNetInfo] = useState<NetworkInfo | null>(null)
  const [netBusy, setNetBusy] = useState(false)
  const [netError, setNetError] = useState<string | null>(null)
  const [netNote, setNetNote] = useState('')
  const ipLines = form.values.floorAllowedIps ?? []

  const addMyIp = async () => {
    setNetBusy(true); setNetError(null)
    try {
      const info = await getNetworkInfo()
      setNetInfo(info)
      // IP nội bộ/loopback: BE chưa thấy IP thật (local, hoặc chưa khai TRUST_PROXY_HOPS) - thêm vào chỉ vô ích, nên không tự thêm.
      const have = ipLines.map((l) => l.split('#')[0].trim())
      if (info.ip && !info.isPrivate && !have.includes(info.ip)) {
        const note = cleanNote(netNote)
        const line = note ? `${info.ip} # ${note}` : info.ip
        form.patch({ floorAllowedIps: [...ipLines.filter((l) => l.trim()), line] })
        setNetNote('')
      }
    } catch (e) {
      setNetError(e instanceof Error ? e.message : 'Không lấy được IP hiện tại')
    } finally {
      setNetBusy(false)
    }
  }

  return (
    <div>
      <label htmlFor="allowed-ips" style={labelStyle}>Mạng công ty được phép đăng nhập (công nhân)</label>
      <textarea
        id="allowed-ips"
        rows={4}
        value={ipLines.join('\n')}
        onChange={(e) => form.patch({ floorAllowedIps: e.target.value.split('\n') })}
        placeholder={'203.0.113.5 # Văn phòng Quy Nhơn\n198.51.100.7 # Xưởng Tây Sơn'}
        spellCheck={false}
        style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
        <input
          value={netNote}
          onChange={(e) => setNetNote(e.target.value)}
          maxLength={60}
          placeholder="Tên mạng (vd Văn phòng Quy Nhơn)"
          aria-label="Tên mạng ghi chú cho IP sắp thêm"
          style={{ ...inputStyle, width: 240 }}
        />
        <button type="button" onClick={() => void addMyIp()} disabled={netBusy}
          style={{
            padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border2)', borderRadius: 8,
            background: 'var(--surface)', color: 'var(--text)', cursor: netBusy ? 'default' : 'pointer',
          }}>
          {netBusy ? 'Đang kiểm tra...' : 'Thêm IP hiện tại của tôi'}
        </button>
        {netInfo && <NetInfoText info={netInfo} />}
      </div>
      {netInfo && !netInfo.isPrivate && (
        <div style={{ ...helpStyle, lineHeight: undefined }}>
          Kiểm tra: mở trang “what is my ip” trên cùng máy này - phải ra <b>đúng IP trên</b>. Khác (vd ra IP của Cloudflare/máy chủ)
          thì chỉnh biến TRUST_PROXY_HOPS của máy chủ (đang là {netInfo.trustProxyHops};
          chuỗi nhận được: {netInfo.forwardedFor ?? 'không có'}) rồi bấm lại.
        </div>
      )}
      {netError && <div style={errorStyle}>{netError}</div>}
      <div style={helpStyle}>
        Mỗi dòng 1 IP công cộng của công ty (vd 203.0.113.5) hoặc dải IPv4 (vd 203.0.113.0/24), có thể ghi chú sau dấu # để biết là địa
        điểm nào (văn phòng và xưởng ở 2 nơi sẽ có 2 IP khác nhau - thêm cả hai). <b>Để trống = không giới hạn.</b> Khi có IP, công nhân
        và tài khoản tổ Phôi/Hàn/Sơn chỉ đăng nhập và làm việc được khi nối mạng công ty - dùng 4G hoặc mạng ngoài sẽ bị chặn (người
        đang mở cũng bị chặn ngay). Sếp, QLSX, KCS, Admin không bị giới hạn. Công ty cần IP công cộng cố định; mở màn này từ mạng công
        ty rồi bấm “Thêm IP hiện tại của tôi”.
        {' '}<b style={{ color: 'var(--amber)' }}>Đang BẬT ({savedCount} mục).</b> Công ty hiện không dùng giới hạn này: xoá hết các
        dòng rồi bấm Lưu để tắt, mục sẽ tự ẩn.
      </div>
    </div>
  )
}

function NetInfoText({ info }: { info: NetworkInfo }) {
  return (
    <span style={{ fontSize: 12, color: info.isPrivate ? 'var(--amber)' : 'var(--text2)' }}
      title={`Chuỗi X-Forwarded-For BE nhận: ${info.forwardedFor ?? '(không có)'}`
        + ` · BE đang tin ${info.trustProxyHops} lớp proxy (TRUST_PROXY_HOPS)`}>
      Máy chủ thấy IP của bạn là <b>{info.ip ?? 'không rõ'}</b>
      {info.isPrivate
        ? ' - đây là IP nội bộ, chưa phải IP công cộng của công ty (đang chạy thử, '
          + 'hoặc máy chủ chưa khai số lớp proxy TRUST_PROXY_HOPS) nên chưa thêm.'
        : ''}
    </span>
  )
}
