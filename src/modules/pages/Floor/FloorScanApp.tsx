'use client'

/**
 * Màn quét QR tại máy cho công nhân Phôi/Hàn/Sơn. Mã QR dán ở máy = link `/floor?ws=<qrToken>`: mã chỉ định danh MÁY,
 * lệnh lấy từ hàng đợi của tổ (QLSX xếp + "Chuyển PI tiếp"), công nhân chỉ chọn SKU → loại sắt + cỡ đoạn (Phôi, nhập SỐ ĐOẠN)
 * hoặc mảnh (Hàn/Sơn, nhập SỐ MẢNH) → Lưu. QLSX kiểm rồi mới gửi KCS - màn này KHÔNG có nút gửi KCS.
 * Thiết kế cho điện thoại: 1 cột, chữ to, ô số mở bàn phím số, nút Lưu dính đáy. Các phần con nằm trong ./scan/.
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '../../../context/AuthContext'
import MyOutputTab from './scan/MyOutputTab'
import PinLogin from './scan/PinLogin'
import ReportTab from './scan/ReportTab'
import { LAST_WS_KEY, safeGet, safeSet, STAGE_LABEL } from './scan/scanModel'
import { Banner } from './scan/ScanParts'
import { btn, chip, column, hint, loadingText, page, wrap } from './scan/scanUi'

type Tab = 'report' | 'mine'
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

function FloorScanInner() {
  const { user, loading, logout } = useAuth()
  const params = useSearchParams()
  const urlWs = params.get('ws')
  // Nhớ máy quét gần nhất - mở lại /floor (không có ?ws) thì vẫn về đúng máy đó.
  const [storedWs] = useState(() => safeGet(LAST_WS_KEY))
  const ws = urlWs ?? storedWs
  const [tab, setTab] = useState<Tab>('report')
  useEffect(() => { if (urlWs) safeSet(LAST_WS_KEY, urlWs) }, [urlWs])

  const isFloorTeam = !!user?.mfgRole && ['PHOI', 'HAN', 'SON'].includes(user.mfgRole)

  let content: React.ReactNode
  if (loading) content = <div style={{ marginTop: 24, ...loadingText }}>Đang tải…</div>
  else if (!user) content = <PinLogin />
  else if (!isFloorTeam) {
    content = (
      <div style={{ ...column(12), marginTop: 16 }}>
        <Banner tone="warn">Màn này dành cho công nhân tổ Phôi, Hàn, Sơn. Tài khoản {user.name} không thuộc tổ nào.</Banner>
        <Link href="/" style={{ ...btn(false), display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          Về trang chính
        </Link>
      </div>
    )
  } else if (tab === 'mine') content = <MyOutputTab />
  else if (!ws) {
    // Không có nút quét trong app: công nhân quét tem bằng app camera của điện thoại.
    content = (
      <div style={{ marginTop: 16 }}>
        <Banner tone="info">Quét mã QR dán ở máy / điểm làm việc bằng <b>app camera của điện thoại</b> để bắt đầu báo.</Banner>
      </div>
    )
  } else content = <ReportTab key={ws} ws={ws} />

  return (
    <div style={page} className="floor-root">
      <Header user={user} showTabs={isFloorTeam} tab={tab} onTab={setTab} onLogout={logout} />
      <main style={wrap}>
        <div {...(user && isFloorTeam ? { role: 'tabpanel', id: 'floor-panel', 'aria-labelledby': `floor-tab-${tab}` } : {})}>
          {content}
        </div>
      </main>
    </div>
  )
}

export default function FloorScanApp() {
  return (
    <Suspense fallback={null}>
      <FloorScanInner />
    </Suspense>
  )
}
