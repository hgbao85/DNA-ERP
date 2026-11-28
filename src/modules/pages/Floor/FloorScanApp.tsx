'use client'

/**
 * Màn quét QR tại máy cho công nhân Phôi/Hàn/Sơn. Mã QR dán ở máy = link `/floor?ws=<qrToken>`: mã chỉ định danh MÁY,
 * công nhân Hàn / Sơn tự chọn lệnh làm được ở xưởng của máy (Phôi: lệnh trong bảng chia máy cắt), rồi chọn SKU → loại sắt + cỡ đoạn (Phôi, nhập SỐ ĐOẠN)
 * hoặc mảnh (Hàn/Sơn, nhập SỐ MẢNH) → Lưu. Từ P1 KCS tự chấm đợt công nhân vừa báo (QLSX không gửi KCS nữa); số nhập quá
 * "còn báo được" thì BE chặn nên nút Lưu khoá.
 * Thiết kế cho điện thoại: 1 cột, chữ to, ô số mở bàn phím số, nút Lưu dính đáy. Các phần con nằm trong ./scan/.
 * Pallet Sơn (24/11/2026): tem pallet = link `/floor?pallet=<token>` (quét bằng camera điện thoại hoặc trong app) -> PalletPanel,
 * báo qua điểm sơn quét gần nhất (LAST_WS_KEY).
 * Chuyền kiểm / Đóng gói QR (24/11/2026, CK_DG_QR): tài khoản tổ Chuyền kiểm / Đóng gói quét tem điểm của kho Thành phẩm ->
 * CkDgReportTab; tài khoản KCS chuyền kiểm -> KcsChuyenKiemPanel (không cần quét tem). Không có tab "Sản lượng của tôi" (lần báo gần
 * đây hiện ngay trong màn báo).
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import QrScanner from './scan/QrScanner'
import PalletPanel from './scan/PalletPanel'
import { floorHrefOf, type FloorQr } from './scan/qrScan'
import { ScannerContext } from './scan/scannerContext'
import ScanButton from './scan/ScanButton'
import { isQrScanEnabled } from '../../../constants/featureFlags'
import { useCkDgEnabled } from '../../../hooks/useCkDgEnabled'
import { useAuth } from '../../../context/AuthContext'
import MyOutputTab from './scan/MyOutputTab'
import PinLogin from './scan/PinLogin'
import ReportTab from './scan/ReportTab'
import CkDgReportTab from './ckdg/CkDgReportTab'
import KcsChuyenKiemPanel from './ckdg/KcsChuyenKiemPanel'
import { isCkDgRole } from './ckdg/ckDgModel'
import { LAST_WS_KEY, safeGet, safeSet, STAGE_LABEL } from './scan/scanModel'
import { Banner } from './scan/ScanParts'
import { btn, chip, column, hint, loadingText, page, wrap } from './scan/scanUi'

type Tab = 'report' | 'mine'
/** Tổ Đóng gói quét được tem khu đóng gói và tem vị trí kho (ô cất thùng). */
const DONG_GOI_ACCEPT: readonly FloorQr['kind'][] = ['ws', 'loc']
const TABS: readonly (readonly [Tab, string])[] = [['report', 'Báo sản lượng'], ['mine', 'Sản lượng của tôi']]

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div role="tablist" style={{ ...wrap, paddingBottom: 0, display: 'flex' }}>
      {TABS.map(([k, t]) => (
        <button key={k} role="tab" id={`floor-tab-${k}`} aria-controls="floor-panel" aria-selected={tab === k} type="button"
          onClick={() => onChange(k)} style={{
            flex: 1, minHeight: 48, border: 'none', background: 'transparent', fontSize: 15,
            fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--floor-tab-active)' : 'var(--text2)',
            borderBottom: `3px solid ${tab === k ? 'var(--blue)' : 'transparent'}`, cursor: 'pointer',
          }}>{t}</button>
      ))}
    </div>
  )
}

function Header({ user, showTabs, tab, onTab, onLogout }: {
  user: { name: string; mfgRole?: string | null } | null; showTabs: boolean; tab: Tab; onTab: (t: Tab) => void; onLogout: () => void
}) {
  return (
    <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ ...wrap, paddingBottom: 0, display: 'flex', alignItems: 'center', gap: 12, minHeight: 56 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700 }}>DNA · Báo sản lượng</h1>
          {user && <div style={{ ...hint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.name}{user.mfgRole && STAGE_LABEL[user.mfgRole] ? ` · tổ ${STAGE_LABEL[user.mfgRole]}` : ''}
          </div>}
        </div>
        {user && <button type="button" onClick={onLogout} style={{ ...chip(false), minHeight: 40 }}>Đăng xuất</button>}
      </div>
      {user && showTabs && <TabBar tab={tab} onChange={onTab} />}
    </header>
  )
}

/** Tài khoản không thuộc tổ nào: chỉ nêu tổ Chuyền kiểm / Đóng gói / KCS chuyền kiểm khi BE bật công tắc CK_DG_QR (tắt = câu như cũ). */
function NotTeamNotice({ name }: { name: string }) {
  const ckDg = useCkDgEnabled() === true
  return (
    <Banner tone="warn">
      {ckDg
        ? 'Màn này dành cho công nhân tổ Phôi, Hàn, Sơn, Chuyền kiểm, Đóng gói và KCS chuyền kiểm.'
        : 'Màn này dành cho công nhân tổ Phôi, Hàn, Sơn.'}{' '}
      Tài khoản {name} không thuộc tổ nào.
    </Banner>
  )
}

function FloorScanInner() {
  const { user, loading, logout } = useAuth()
  const params = useSearchParams()
  const urlWs = params.get('ws')
  const urlPallet = params.get('pallet')
  // Tem vị trí kho (25/11/2026, VI_TRI_KHO): công nhân đóng gói quét tem ô -> báo ở khu đóng gói quét gần nhất, chọn sẵn ô.
  const urlLoc = params.get('loc')
  // Nhớ máy quét gần nhất - mở lại /floor (không có ?ws) thì vẫn về đúng máy đó; quét pallet thì báo qua máy này.
  const [storedWs, setStoredWs] = useState(() => safeGet(LAST_WS_KEY))
  const ws = urlWs ?? storedWs
  const [tab, setTab] = useState<Tab>('report')
  useEffect(() => { if (urlWs) safeSet(LAST_WS_KEY, urlWs) }, [urlWs])

  // 24/11/2026: quét tem ngay trong app - đổi máy / sang khu nhận sắt không phải thoát ra app camera, không đăng nhập lại.
  const router = useRouter()
  // Công tắc NEXT_PUBLIC_QR_SCAN_ENABLED (mặc định tắt): tắt thì không nút quét, không mở khung quét, không xin quyền camera.
  const qrScan = isQrScanEnabled()
  const [scanning, setScanning] = useState(false)
  const openScanner = useCallback(() => setScanning(true), [])
  const onScanned = useCallback((qr: FloorQr) => {
    setScanning(false)
    setTab('report')
    if (qr.kind === 'ws') {
      safeSet(LAST_WS_KEY, qr.ws)
      setStoredWs(qr.ws)
    } else if (urlWs) {
      // Đang ở máy mở bằng link (?ws=) rồi quét pallet: nhớ máy đó để báo pallet qua nó.
      setStoredWs(urlWs)
    }
    router.replace(floorHrefOf(qr))
  }, [router, urlWs])

  const isOldTeam = !!user?.mfgRole && ['PHOI', 'HAN', 'SON'].includes(user.mfgRole)
  const isCkDg = isCkDgRole(user?.mfgRole)
  const isFloorTeam = isOldTeam || isCkDg

  let content: React.ReactNode
  if (loading) content = <div style={{ marginTop: 24, ...loadingText }}>Đang tải…</div>
  else if (!user) content = <PinLogin />
  else if (!isFloorTeam) {
    content = (
      <div style={{ ...column(12), marginTop: 16 }}>
        <NotTeamNotice name={user.name} />
        <Link href="/" style={{ ...btn(false), display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          Về trang chính
        </Link>
      </div>
    )
  } else if (user.mfgRole === 'KCS_CHUYEN_KIEM') content = <KcsChuyenKiemPanel />
  else if (isCkDg) {
    content = ws ? (
      <div style={{ ...column(12), marginTop: 12 }}>
        <ScanButton onClick={openScanner} label="Quét mã QR khác" />
        <CkDgReportTab key={`${ws}:${urlLoc ?? ''}`} ws={ws} initialLoc={user.mfgRole === 'DONG_GOI' ? urlLoc : null} />
      </div>
    ) : (
      <div style={{ ...column(12), marginTop: 16 }}>
        <ScanButton onClick={openScanner} />
        {qrScan
          ? <Banner tone="info">Bấm <b>Quét mã QR</b> rồi đưa tem dán ở điểm chuyền kiểm / khu đóng gói vào khung để bắt đầu báo.</Banner>
          : <Banner tone="info">Quét mã QR dán ở điểm chuyền kiểm / khu đóng gói bằng <b>app camera của điện thoại</b> để bắt đầu báo.</Banner>}
      </div>
    )
  } else if (tab === 'mine') content = <MyOutputTab />
  else if (urlPallet) {
    content = (
      <div style={{ ...column(12), marginTop: 12 }}>
        <PalletPanel key={urlPallet} token={urlPallet} />
      </div>
    )
  } else if (!ws) {
    content = qrScan ? (
      // Quét bằng nút trong app (24/11/2026) hoặc app camera của điện thoại như trước.
      <div style={{ ...column(12), marginTop: 16 }}>
        <ScanButton onClick={openScanner} />
        <Banner tone="info">Bấm <b>Quét mã QR</b> rồi đưa tem dán ở máy / khu nhận sắt / pallet vào khung để bắt đầu báo (hoặc quét bằng app camera của điện thoại).</Banner>
      </div>
    ) : (
      // Công tắc tắt: như bản trước - công nhân quét tem bằng app camera của điện thoại.
      <div style={{ marginTop: 16 }}>
        <Banner tone="info">Quét mã QR dán ở máy / điểm làm việc bằng <b>app camera của điện thoại</b> để bắt đầu báo.</Banner>
      </div>
    )
  } else content = qrScan ? (
    <div style={{ ...column(12), marginTop: 12 }}>
      <ScanButton onClick={openScanner} label="Quét mã QR khác" />
      <ReportTab key={ws} ws={ws} />
    </div>
  ) : <ReportTab key={ws} ws={ws} />

  return (
    <ScannerContext.Provider value={qrScan && user && isFloorTeam ? openScanner : null}>
      <div style={page} className="floor-root">
        <Header user={user} showTabs={isOldTeam} tab={tab} onTab={setTab} onLogout={logout} />
        <main style={wrap}>
          <div {...(user && isOldTeam ? { role: 'tabpanel', id: 'floor-panel', 'aria-labelledby': `floor-tab-${tab}` } : {})}>
            {content}
          </div>
        </main>
        {qrScan && scanning && <QrScanner onScanned={onScanned} onClose={() => setScanning(false)}
          {...(user?.mfgRole === 'DONG_GOI' ? { accept: DONG_GOI_ACCEPT, title: 'Đưa tem khu đóng gói / tem vị trí kho vào khung' } : {})} />}
      </div>
    </ScannerContext.Provider>
  )
}

export default function FloorScanApp() {
  return (
    <Suspense fallback={null}>
      <FloorScanInner />
    </Suspense>
  )
}
