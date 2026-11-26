/**
 * Đọc nội dung tem QR quét trong app (24/11/2026). Tem in từ "Máy & tem QR" là link `<origin>/floor?ws=<qrToken>`
 * (qrPrint.workstationLink); tem pallet Sơn (24/11/2026, thủ kho Sơn in) là `<origin>/floor?pallet=<token>` (qrPrint.palletLink).
 * Tem vị trí kho Thành phẩm (25/11/2026, VI_TRI_KHO, thủ kho Thành phẩm in) là `<origin>/floor?loc=<token>` (qrPrint.locationLink).
 * Chỉ nhận đúng 3 dạng link đó - mã QR khác (link web, mã hàng, Wi-Fi...) báo không phải tem. Kết quả phân biệt theo `kind`.
 * Không so origin: tem in ở tên miền khác (vd bản thử) vẫn đọc ra mã, BE tự báo nếu mã không có.
 */
export type QrParseResult =
  | { ok: true; kind: 'ws'; ws: string }
  | { ok: true; kind: 'pallet'; pallet: string }
  | { ok: true; kind: 'loc'; loc: string }
  | { ok: false; error: string }

/** Kết quả đọc được tem (bỏ nhánh lỗi) - truyền cho màn sau khi quét. */
export type FloorQr = Extract<QrParseResult, { ok: true }>

export const NOT_A_TEM = 'Mã này không phải tem máy / khu làm việc / pallet của hệ thống DNA-ERP.'

const tokenOf = (v: string | null): string | null => {
  const t = v?.trim()
  return t && t.length <= 200 ? t : null
}

export function parseWorkstationQr(text: string): QrParseResult {
  const raw = text.trim()
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: NOT_A_TEM }
  }
  if (!/^https?:$/.test(url.protocol)) return { ok: false, error: NOT_A_TEM }
  if (url.pathname.replace(/\/+$/, '') !== '/floor') return { ok: false, error: NOT_A_TEM }
  const ws = tokenOf(url.searchParams.get('ws'))
  if (ws) return { ok: true, kind: 'ws', ws }
  const pallet = tokenOf(url.searchParams.get('pallet'))
  if (pallet) return { ok: true, kind: 'pallet', pallet }
  const loc = tokenOf(url.searchParams.get('loc'))
  if (loc) return { ok: true, kind: 'loc', loc }
  return { ok: false, error: NOT_A_TEM }
}

/** Mã quét / dán vào ô nhập của màn kho (máy quét cầm tay gõ nguyên link tem): link tem ô -> token; chuỗi khác giữ nguyên. */
export function locationTokenOf(text: string): string | null {
  const raw = text.trim()
  if (!raw) return null
  const p = parseWorkstationQr(raw)
  if (p.ok) return p.kind === 'loc' ? p.loc : null
  return /^https?:/i.test(raw) ? null : raw.slice(0, 200)
}

const KIND_TEM: Record<FloorQr['kind'], string> = { ws: 'tem máy', pallet: 'tem pallet', loc: 'tem vị trí kho' }

/** Lời báo khi quét đúng tem của hệ thống nhưng sai loại màn đang cần (giữ nguyên câu cũ của tem máy / pallet). */
export function wrongKindText(kind: FloorQr['kind'], accept: readonly FloorQr['kind'][]): string {
  if (kind === 'pallet' && !accept.includes('loc')) return 'Đây là tem pallet, không phải tem máy.'
  if (kind === 'ws' && !accept.includes('loc')) return 'Đây là tem máy, không phải tem pallet.'
  const want = accept.filter((k) => k !== kind).map((k) => KIND_TEM[k]).join(' / ')
  return `Đây là ${KIND_TEM[kind]}, không phải ${want || 'tem cần quét'}.`
}

/** Đường dẫn trong app sau khi quét được tem (đổi máy, hoặc mở pallet). */
export function floorHrefOf(qr: FloorQr): string {
  if (qr.kind === 'ws') return `/floor?ws=${encodeURIComponent(qr.ws)}`
  if (qr.kind === 'loc') return `/floor?loc=${encodeURIComponent(qr.loc)}`
  return `/floor?pallet=${encodeURIComponent(qr.pallet)}`
}

/** Lời báo khi không mở được camera (tên lỗi theo chuẩn getUserMedia). */
export function cameraErrorText(name: string | undefined): string {
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Chưa cho phép dùng camera. Vào cài đặt trình duyệt, cho phép camera cho trang này rồi bấm Quét lại.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Không tìm thấy camera trên máy này.'
    case 'NotReadableError':
      return 'Camera đang bị ứng dụng khác dùng. Đóng ứng dụng đó rồi thử lại.'
    case 'NO_MEDIA':
      return 'Trình duyệt này không mở được camera (cần trang https). Dùng app camera của điện thoại để quét tem.'
    default:
      return 'Không mở được camera. Thử lại, hoặc dùng app camera của điện thoại để quét tem.'
  }
}
