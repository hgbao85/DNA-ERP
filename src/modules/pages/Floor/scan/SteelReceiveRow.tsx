'use client'

/** Khu nhận sắt: công nhân đếm số cây rồi xác nhận nhận. */

import { useState } from 'react'
import LenhCode from '../../../../components/LenhCode'
import type { BeSteelToReceive } from '../../../../services/floor-api'
import { receiveVerdict, type ReceiveVerdict } from '../floorUi'
import { digits, fmtMm } from './scanModel'
import { Banner } from './ScanParts'
import { btn, card, chip, column, hint, numInput } from './scanUi'

function VerdictBanner({ verdict, n, issued }: { verdict: ReceiveVerdict; n: number; issued: number }) {
  if (verdict.kind === 'exact') {
    return <Banner tone="info">Bạn đếm <b>{n} cây</b>, kho xuất {issued} cây: đúng số. Xác nhận đã nhận?</Banner>
  }
  const diffText = verdict.kind === 'short' ? `thiếu ${-verdict.diff}` : verdict.kind === 'over' ? `thừa ${verdict.diff}` : ''
  return (
    <Banner tone="warn">
      Bạn đếm <b>{n} cây</b>, kho xuất {issued} cây: <b>{diffText} cây</b>. Kho và quản lý sẽ được báo. Bạn đã đếm kỹ chưa?
    </Banner>
  )
}

export default function SteelReceiveRow({ issue, onReceive }: {
  issue: BeSteelToReceive; onReceive: (issue: BeSteelToReceive, count: number) => Promise<boolean>
}) {
  // Ô để TRỐNG (không điền sẵn số kho xuất): công nhân phải đếm rồi gõ số - điền sẵn thì bấm xác nhận mà không đếm vẫn xong.
  // Chip "Đủ N cây" chỉ ĐIỀN vào ô giúp gõ nhanh khi đếm thấy đủ, không tự gửi.
  const [count, setCount] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const verdict = receiveVerdict(count, issue.barCount)
  const n = Number(count || 0)
  const empty = verdict.kind === 'empty'
  const send = async () => { setBusy(true); const ok = await onReceive(issue, n); setBusy(false); if (!ok) setConfirming(false) }
  return (
    <div style={{ ...card, ...column(12) }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{issue.materialName}</div>
        <div style={hint}>
          <LenhCode piCode={issue.piCode} /> · kho xuất <b style={{ color: 'var(--text)' }}>{issue.barCount} cây</b>
          {' '}× {fmtMm(issue.barLengthMm)}mm
          {issue.issuedByName ? ` · ${issue.issuedByName}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15 }}>Đếm được</span>
        <input aria-label={`Số cây ${issue.materialName} đếm được`} inputMode="numeric" value={count} placeholder="?" style={numInput}
          onChange={(e) => { setCount(digits(e.target.value)); setConfirming(false) }} />
        <span style={{ fontSize: 15, color: 'var(--text2)' }}>cây</span>
        <button type="button" style={{ ...chip(false), marginLeft: 'auto' }}
          onClick={() => { setCount(String(issue.barCount)); setConfirming(false) }}>
          Đủ {issue.barCount} cây
        </button>
      </div>
      {confirming && !empty ? (
        <>
          <VerdictBanner verdict={verdict} n={n} issued={issue.barCount} />
          <button type="button" disabled={busy} style={btn(true, busy)} onClick={() => void send()}>
            {busy ? 'Đang lưu…' : `Đúng, nhận ${n} cây`}
          </button>
          <button type="button" disabled={busy} style={btn(false, busy)} onClick={() => setConfirming(false)}>Đếm lại</button>
        </>
      ) : (
        // Mọi lần nhận đều hỏi xác nhận. Lệch so với kho xuất thì nói rõ: số này làm kho + QLSX nhận cảnh báo.
        <button type="button" disabled={empty || busy} style={btn(true, empty || busy)} onClick={() => { if (!empty) setConfirming(true) }}>
          {busy ? 'Đang lưu…' : empty ? 'Nhập số cây đếm được' : 'Xác nhận đã nhận'}
        </button>
      )}
    </div>
  )
}
