'use client'

/**
 * "Thiết lập" của màn QLSX "Sản lượng xưởng" (2026-10-13): (1) máy / điểm làm việc + mã QR in tem, (2) tài khoản công
 * nhân (username + PIN 6 số, không email). Xem changelog BE changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 22-24.
 */

import { useEffect, useState } from 'react'
import { KeyRound, Plus, Printer, QrCode, RefreshCw } from 'lucide-react'
import {
  floorAdmin, type BeFloorSettings, type BeFloorWorker, type BeWorkstation, type FloorStage, type WorkstationKind,
} from '../../../services/floor-api'
import { useConfirm } from '../../../hooks/useConfirm'
import { useFetch } from '../../../hooks/useFetch'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { errMsg } from '../../../utils/errors'
import Modal from '../../../components/Modal'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { btn, card, input, KIND_LABEL, Notice, Pill, STAGE_LABEL, STEP_LABEL, td, th } from './qlsxUi'
import { isLocalOrigin, kindCaption, printTems, qrDataUrl, workstationLink } from './qrPrint'

const STAGES: FloorStage[] = ['PHOI', 'HAN', 'SON']
const STEPS = ['UON', 'DAP', 'DUC_LO', 'TAN', 'TOP_DAU', 'XE', 'NHAN']

const wsTitle = (w: BeWorkstation) => `${w.code} · ${w.name}`

// ─── Máy / điểm làm việc ─────────────────────────────────────────────────────

function QrModal({ ws, base, fromSetting, onClose }: {
  ws: BeWorkstation | null
  /** Địa chỉ gốc in lên tem: địa chỉ đã cài, hoặc địa chỉ trình duyệt đang mở. */
  base: string
  fromSetting: boolean
  onClose: () => void
}) {
  const [img, setImg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const link = ws ? workstationLink(ws.qrToken, base) : ''
  useEffect(() => {
    let live = true
    if (ws) void qrDataUrl(link, 420).then((u) => { if (live) setImg(u) })
    return () => { live = false; setImg(null); setCopied(false) }
  }, [ws, link])
  // Tem trỏ về địa chỉ nội bộ -> điện thoại không mở được; tem trỏ về địa chỉ KHÁC nơi đang xem (đã cài) -> chỉ quét được nếu máy
  // này cũng tồn tại ở hệ thống đó (mã QR nằm trong dữ liệu của từng môi trường).
  const isLocal = isLocalOrigin(base)
  const otherHost = fromSetting && !isLocal && typeof window !== 'undefined' && new URL(base).host !== window.location.host
  return (
    <Modal open={!!ws} onClose={onClose} maxWidth={420}>
      {ws && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{wsTitle(ws)}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Tổ {STAGE_LABEL[ws.stage]} · {kindCaption(ws).toLowerCase()}</div>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL do máy tạo, không cần tối ưu ảnh */}
          {img ? <img src={img} alt={`Mã QR ${ws.code}`} width={220} height={220} style={{ background: '#fff', borderRadius: 8 }} /> : <LoadingState />}
          <div style={{ fontSize: 11, color: 'var(--text3)', wordBreak: 'break-all' }}>{link}</div>
          {isLocal && <Notice tone="warn">Tem đang trỏ về địa chỉ nội bộ ({new URL(base).host}) - điện thoại ngoài mạng này (hoặc chính điện thoại) không mở được. Đặt “Địa chỉ ERP dùng cho tem” ở trên, hoặc in tem từ ERP thật.</Notice>}
          {otherHost && <Notice tone="info">Tem trỏ về {new URL(base).host} (địa chỉ đã cài), không phải nơi bạn đang xem. Tem chỉ quét được nếu máy này cũng đã được tạo trên hệ thống {new URL(base).host}.</Notice>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" style={btn('secondary')} onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)) }}>
              {copied ? 'Đã chép link' : 'Chép link'}
            </button>
            <button type="button" style={btn('primary')} onClick={() => void printTems([ws], base)}><Printer size={14} /> In tem</button>
            <button type="button" style={btn('secondary')} onClick={onClose}>Đóng</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function AddWorkstation({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [stage, setStage] = useState<FloorStage>('PHOI')
  const [kind, setKind] = useState<WorkstationKind>('CUT')
  const [step, setStep] = useState('UON')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Máy cắt / công đoạn phụ / nhận sắt chỉ của tổ Phôi - ép đúng lựa chọn thay vì để BE báo lỗi.
  const kinds: WorkstationKind[] = stage === 'PHOI' ? ['CUT', 'STEP', 'PIECE', 'STEEL_RECEIVE'] : ['PIECE']
  const changeStage = (s: FloorStage) => { setStage(s); setKind(s === 'PHOI' ? 'CUT' : 'PIECE') }
  const valid = code.trim().length >= 2 && name.trim().length >= 1

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true); setErr(null)
    try {
      await floorAdmin.createWorkstation({ code: code.trim(), name: name.trim(), stage, kind, processStep: kind === 'STEP' ? step : undefined })
      onDone()
    } catch (e2) { setErr(errMsg(e2)); setBusy(false) }
  }
  const lab = (t: string) => <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{t}</span>
  return (
    <form onSubmit={submit} style={{ ...card, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      <label style={{ display: 'grid', gap: 4 }}>{lab('Mã ngắn (in trên tem)')}
        <input style={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="LASER-01" maxLength={32} /></label>
      <label style={{ display: 'grid', gap: 4 }}>{lab('Tên gọi')}
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Máy laser số 1" maxLength={120} /></label>
      <label style={{ display: 'grid', gap: 4 }}>{lab('Tổ')}
        <select style={input} value={stage} onChange={(e) => changeStage(e.target.value as FloorStage)}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
      <label style={{ display: 'grid', gap: 4 }}>{lab('Loại')}
        <select style={input} value={kind} onChange={(e) => setKind(e.target.value as WorkstationKind)}>
          {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
      {kind === 'STEP' && (
        <label style={{ display: 'grid', gap: 4 }}>{lab('Công đoạn')}
          <select style={input} value={step} onChange={(e) => setStep(e.target.value)}>
            {STEPS.map((s) => <option key={s} value={s}>{STEP_LABEL[s]}</option>)}</select></label>
      )}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" disabled={!valid || busy} style={btn('primary', !valid || busy)}>Tạo máy</button>
        <button type="button" onClick={onCancel} style={btn('secondary')}>Hủy</button>
        {err && <Notice tone="err">{err}</Notice>}
      </div>
    </form>
  )
}

/**
 * Địa chỉ ERP in lên tem - QLSX chỉ XEM; Admin đặt ở "Cấu hình hệ thống" (SystemConfig.floorPublicUrl, theo từng môi trường).
 * Chưa đặt thì tem dùng địa chỉ trình duyệt đang mở.
 */
function TemAddress({ saved, current }: { saved: string | null; current: string }) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Địa chỉ trên tem</div>
      {saved ? (
        <div style={{ fontSize: 13 }}>
          Tem trỏ về <b>{saved}</b>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Do Admin cài ở “Cấu hình hệ thống”. Đã dán tem rồi thì đừng nhờ đổi nếu không cần.</div>
        </div>
      ) : (
        <div style={{ fontSize: 13 }}>
          Chưa cài - tem dùng địa chỉ đang mở (<b>{current}</b>).
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Trước khi in tem thật, nhờ Admin điền “Địa chỉ ERP dùng cho tem QR” ở Admin › Cấu hình hệ thống.
          </div>
        </div>
      )}
    </div>
  )
}

function Workstations() {
  const { data, isLoading, error, refetch } = useFetch<BeWorkstation[]>(() => floorAdmin.workstations(), [])
  const settings = useFetch<BeFloorSettings>(() => floorAdmin.settings(), [])
  const { ask, confirmModal } = useConfirm()
  const [adding, setAdding] = useState(false)
  const [show, setShow] = useState<BeWorkstation | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const list = data ?? []
  // Địa chỉ in lên tem: đã cài thì dùng, chưa cài thì địa chỉ đang mở.
  const savedBase = settings.data?.publicUrl ?? null
  const base = savedBase ?? (typeof window !== 'undefined' ? window.location.origin : '')

  const toggle = async (w: BeWorkstation) => {
    setErr(null)
    try { await floorAdmin.updateWorkstation(w.id, { isActive: !w.isActive }); void refetch() } catch (e) { setErr(errMsg(e)) }
  }
  const printAll = async () => {
    setPrinting(true); setErr(null)
    try { await printTems(list.filter((w) => w.isActive), base) } catch (e) { setErr(errMsg(e)) } finally { setPrinting(false) }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Máy và mã QR">
      {confirmModal}
      <QrModal ws={show} base={base} fromSetting={!!savedBase} onClose={() => setShow(null)} />
      {settings.isLoading ? <LoadingState /> : settings.error ? (
        <LoadErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <TemAddress saved={savedBase} current={base} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Máy &amp; điểm làm việc</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mỗi máy 1 mã QR dán cố định. Mã không chứa PI - PI lấy từ hàng đợi của tổ.</div>
        </div>
        <button type="button" disabled={printing || !list.some((w) => w.isActive)} onClick={() => void printAll()} style={btn('secondary', printing)}>
          <Printer size={14} /> In tất cả tem
        </button>
        <button type="button" onClick={() => setAdding(true)} style={btn('primary')}><Plus size={14} /> Thêm máy</button>
      </div>
      {adding && <AddWorkstation onCancel={() => setAdding(false)} onDone={() => { setAdding(false); void refetch() }} />}
      {err && <Notice tone="err">{err}</Notice>}
      {isLoading ? <LoadingState /> : error ? <LoadErrorState error={error} onRetry={() => void refetch()} /> : list.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--text3)', padding: 28 }}>
          Chưa có máy nào. Bấm “Thêm máy” - tạo máy laser, điểm Hàn, điểm Sơn và 1 mã “Khu nhận sắt”.
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead><tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Máy</th><th style={th}>Tổ</th><th style={th}>Loại</th><th style={th}>Trạng thái</th><th style={{ ...th, textAlign: 'right' }}>Mã QR</th>
            </tr></thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} style={{ borderTop: '1px solid var(--border)', opacity: w.isActive ? 1 : 0.6 }}>
                  <td style={td}><b>{w.code}</b><div style={{ fontSize: 12, color: 'var(--text2)' }}>{w.name}</div></td>
                  <td style={td}>{STAGE_LABEL[w.stage]}</td>
                  <td style={td}>{KIND_LABEL[w.kind]}{w.processStep ? ` · ${STEP_LABEL[w.processStep]}` : ''}</td>
                  <td style={td}>
                    <button type="button" onClick={() => void toggle(w)} style={{ ...btn('ghost'), padding: 0 }} aria-label={w.isActive ? `Tắt ${w.code}` : `Bật ${w.code}`}>
                      {w.isActive ? <Pill tone="green">Đang dùng</Pill> : <Pill tone="gray">Đã tắt</Pill>}
                    </button>
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" style={btn('secondary')} onClick={() => setShow(w)}><QrCode size={14} /> Xem / in</button>{' '}
                    <button type="button" style={btn('ghost')} title="Đổi mã QR (tem cũ hết dùng)" aria-label={`Đổi mã QR của ${w.code}`}
                      onClick={() => ask({ title: 'Đổi mã QR', message: `Đổi mã QR của ${wsTitle(w)}?\nTem đang dán sẽ KHÔNG quét được nữa - phải in và dán tem mới. Dùng khi tem bị mất hoặc bị chụp mang đi chỗ khác.`, confirmLabel: 'Đổi mã', danger: true },
                        async () => { await floorAdmin.regenerateToken(w.id); void refetch() })}>
                      <RefreshCw size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─── Công nhân ───────────────────────────────────────────────────────────────
// QLSX KHÔNG đặt và KHÔNG biết PIN: tạo tài khoản xong công nhân tự đặt PIN ở lần đăng nhập đầu (trong 72 giờ). Lý do: số báo
// là bằng chứng ai làm bao nhiêu (có thể liên quan lương) - nếu QLSX biết PIN thì không còn chứng minh được người báo là ai.

function pinPill(w: BeFloorWorker) {
  if (w.pinState === 'PENDING') return <Pill tone="amber">Chờ tự đặt PIN</Pill>
  if (w.pinState === 'EXPIRED') return <Pill tone="red">Quá hạn đặt PIN</Pill>
  if (w.pinState === 'ADMIN_SET') return <span title="PIN này do QLSX đặt nên QLSX biết. Bấm “Cho đặt lại PIN” để công nhân tự đặt PIN riêng."><Pill tone="amber">PIN do QLSX đặt</Pill></span>
  return <Pill tone="green">Đã đặt PIN</Pill>
}

function AddWorker({ onDone, onCancel }: { onDone: (w: BeFloorWorker) => void; onCancel: () => void }) {
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [username, setUsername] = useState('')
  const [stage, setStage] = useState<FloorStage>('PHOI')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const valid = firstName.trim() && username.trim().length >= 3

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true); setErr(null)
    try {
      onDone(await floorAdmin.createWorker({ username: username.trim(), firstName: firstName.trim(), lastName: lastName.trim(), stage }))
    } catch (e2) { setErr(errMsg(e2)); setBusy(false) }
  }
  const lab = (t: string) => <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{t}</span>
  return (
    <form onSubmit={submit} style={{ ...card, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
      <label style={{ display: 'grid', gap: 4 }}>{lab('Họ')}<input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nguyễn Văn" /></label>
      <label style={{ display: 'grid', gap: 4 }}>{lab('Tên')}<input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="An" /></label>
      <label style={{ display: 'grid', gap: 4 }}>{lab('Tên đăng nhập')}
        <input style={input} value={username} autoCapitalize="none" onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))} placeholder="phoi.an" /></label>
      <label style={{ display: 'grid', gap: 4 }}>{lab('Tổ')}
        <select style={input} value={stage} onChange={(e) => setStage(e.target.value as FloorStage)}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text3)' }}>
        Không cần đặt PIN: công nhân tự đặt PIN riêng ở lần đăng nhập đầu tiên.
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" disabled={!valid || busy} style={btn('primary', !valid || busy)}>Tạo tài khoản</button>
        <button type="button" onClick={onCancel} style={btn('secondary')}>Hủy</button>
        {err && <Notice tone="err">{err}</Notice>}
      </div>
    </form>
  )
}

function Workers() {
  const { data, isLoading, error, refetch } = useFetch<BeFloorWorker[]>(() => floorAdmin.workers(), [])
  const { ask, confirmModal } = useConfirm()
  const [adding, setAdding] = useState(false)
  const [created, setCreated] = useState<BeFloorWorker | null>(null)
  const list = data ?? []

  const toggle = (w: BeFloorWorker) => {
    const lock = w.isActive
    ask({
      title: lock ? 'Khoá tài khoản' : 'Mở khoá tài khoản',
      message: lock ? `Khoá ${w.fullName ?? w.username}? Công nhân bị đăng xuất khỏi mọi máy và không đăng nhập được. Số đã báo vẫn giữ nguyên.` : `Mở khoá ${w.fullName ?? w.username}?`,
      confirmLabel: lock ? 'Khoá' : 'Mở khoá', danger: lock,
    }, async () => { await floorAdmin.updateWorker(w.id, { isActive: !w.isActive }); void refetch() })
  }
  const resetPin = (w: BeFloorWorker) => ask({
    title: 'Cho đặt lại PIN',
    message: `Xoá PIN hiện tại của ${w.fullName ?? w.username}?\nCông nhân bị đăng xuất khỏi mọi máy; lần đăng nhập tới sẽ tự đặt PIN mới (trong 72 giờ). Bạn không biết PIN mới.`,
    confirmLabel: 'Cho đặt lại PIN', danger: true,
  }, async () => { await floorAdmin.resetWorkerPin(w.id); void refetch() })
  const unlock = (w: BeFloorWorker) => ask({
    title: 'Mở khoá tạm',
    message: `${w.fullName ?? w.username} đang bị khoá tạm vì nhập sai PIN quá 5 lần. Mở khoá ngay?`,
    confirmLabel: 'Mở khoá',
  }, async () => { await floorAdmin.unlockWorker(w.id); void refetch() })

  const isMobile = useIsMobile()

  // Dùng chung cho bảng (màn rộng) và thẻ (điện thoại < 640px - quy ước chung của FE: thẻ thay bảng).
  const who = (w: BeFloorWorker) => (
    <>
      <b>{w.fullName ?? '—'}</b>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{w.username} · tổ {w.stage ? STAGE_LABEL[w.stage] : '—'}</div>
    </>
  )
  const status = (w: BeFloorWorker) => (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {w.isActive ? pinPill(w) : <Pill tone="gray">Đã khoá</Pill>}
        {w.lockedUntil && <Pill tone="red">Khoá tạm đến {new Date(w.lockedUntil).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Pill>}
      </div>
      {w.pinState === 'PENDING' && w.pinClaimExpiresAt && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>hạn đặt PIN {new Date(w.pinClaimExpiresAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
      )}
    </>
  )
  // Nút tự xuống dòng khi hẹp - trước đây nowrap làm cột này tràn khỏi bảng ở khung ~670px.
  const actions = (w: BeFloorWorker) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
      {w.lockedUntil && <button type="button" style={btn('secondary')} onClick={() => unlock(w)}>Mở khoá tạm</button>}
      <button type="button" style={btn('secondary')} onClick={() => resetPin(w)}><KeyRound size={14} /> Cho đặt lại PIN</button>
      <button type="button" style={btn(w.isActive ? 'danger' : 'secondary')} onClick={() => toggle(w)}>{w.isActive ? 'Khoá' : 'Mở khoá'}</button>
    </div>
  )

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Tài khoản công nhân">
      {confirmModal}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Tài khoản công nhân</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mỗi người 1 tài khoản riêng và tự đặt PIN riêng - để biết chắc ai báo.</div>
        </div>
        <button type="button" onClick={() => { setAdding(true); setCreated(null) }} style={btn('primary')}><Plus size={14} /> Thêm công nhân</button>
      </div>
      {created && (
        <Notice tone="ok">
          Đã tạo <b>{created.username}</b>. Bảo công nhân mở link quét tem và nhập tên đăng nhập <b>{created.username}</b>: màn hình sẽ tự
          báo tài khoản chưa có PIN và cho tự chọn PIN 6 số (nhập 2 lần để xác nhận; còn hiệu lực 72 giờ). Bạn không biết và không cần biết PIN.
        </Notice>
      )}
      {adding && <AddWorker onCancel={() => setAdding(false)} onDone={(w) => { setAdding(false); setCreated(w); void refetch() }} />}
      {isLoading ? <LoadingState /> : error ? <LoadErrorState error={error} onRetry={() => void refetch()} /> : list.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--text3)', padding: 28 }}>Chưa có tài khoản công nhân nào.</div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((w) => (
            <div key={w.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, opacity: w.isActive ? 1 : 0.6 }}>
              <div>{who(w)}</div>
              <div>{status(w)}</div>
              {actions(w)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Công nhân</th><th style={th}>Trạng thái</th><th style={{ ...th, textAlign: 'right' }}> </th>
            </tr></thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} style={{ borderTop: '1px solid var(--border)', opacity: w.isActive ? 1 : 0.6 }}>
                  <td style={td}>{who(w)}</td>
                  <td style={td}>{status(w)}</td>
                  <td style={td}>{actions(w)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function QlsxSetup({ section }: { section: 'machines' | 'workers' }) {
  return section === 'machines' ? <Workstations /> : <Workers />
}
