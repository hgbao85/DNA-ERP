import QRCode from 'qrcode'
import type { BeWorkstation } from '../../../services/floor-api'

const STAGE = { PHOI: 'PHÔI', HAN: 'HÀN', SON: 'SƠN' } as const
const STEP: Record<string, string> = { UON: 'Uốn', DAP: 'Dập', DUC_LO: 'Đục lỗ', TAN: 'Tán', TOP_DAU: 'Tóp đầu', XE: 'Xẻ', NHAN: 'Nhấn' }

/** Link trên tem: trang quét của công nhân. Mã chỉ định danh MÁY (không chứa PI). */
export const workstationLink = (qrToken: string, origin: string = window.location.origin) =>
  `${origin}/floor?ws=${encodeURIComponent(qrToken)}`

/** Địa chỉ nội bộ (localhost / IP mạng LAN) - điện thoại ngoài mạng đó, hoặc chính điện thoại với "localhost", không mở được. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const h = new URL(origin).hostname
    return h === 'localhost' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.endsWith('.local')
  } catch {
    return false
  }
}

export function qrDataUrl(text: string, width = 360): Promise<string> {
  // Mức sửa lỗi Q (~25%): tem dán ở xưởng dễ bẩn/xước.
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'Q', margin: 2, width })
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

export function kindCaption(w: Pick<BeWorkstation, 'kind' | 'processStep'>): string {
  if (w.kind === 'CUT') return 'BÁO SỐ ĐOẠN CẮT'
  if (w.kind === 'STEP') return `BÁO ${(STEP[w.processStep ?? ''] ?? 'CÔNG ĐOẠN').toUpperCase()}`
  if (w.kind === 'STEEL_RECEIVE') return 'XÁC NHẬN NHẬN SẮT'
  return 'BÁO SỐ MẢNH'
}

/** In tem QR (mỗi máy 1 tem, khổ ~10×14cm, cắt theo viền): mở hộp thoại in của trình duyệt qua iframe ẩn. */
export async function printTems(list: BeWorkstation[], origin: string = window.location.origin): Promise<void> {
  const cards = await Promise.all(list.map(async (w) => {
    const img = await qrDataUrl(workstationLink(w.qrToken, origin), 520)
    return `<section class="tem">
      <div class="top">${STAGE[w.stage]} · ${esc(kindCaption(w))}</div>
      <img src="${img}" alt="">
      <div class="code">${esc(w.code)}</div>
      <div class="name">${esc(w.name)}</div>
      <div class="how">Mở camera điện thoại, quét mã, đăng nhập bằng tên + PIN của bạn rồi nhập số.</div>
    </section>`
  }))
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Tem QR máy</title><style>
    @page { size: A4; margin: 10mm }
    * { box-sizing: border-box; font-family: Arial, sans-serif }
    body { margin: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm }
    .tem { border: 2px dashed #000; padding: 6mm; text-align: center; break-inside: avoid; height: 135mm; display: flex; flex-direction: column; align-items: center; gap: 3mm }
    .top { font-weight: 700; font-size: 15pt; background: #000; color: #fff; padding: 2mm 4mm; border-radius: 2mm }
    img { width: 78mm; height: 78mm }
    .code { font-size: 26pt; font-weight: 800; letter-spacing: 1px }
    .name { font-size: 13pt }
    .how { font-size: 9pt; color: #333; margin-top: auto }
  </style></head><body>${cards.join('')}</body></html>`

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc || !frame.contentWindow) { frame.remove(); throw new Error('Không mở được cửa sổ in') }
  doc.open(); doc.write(html); doc.close()
  // Chờ ảnh nạp xong rồi mới in (data URL nạp gần như tức thì nhưng vẫn là bất đồng bộ).
  await new Promise<void>((resolve) => setTimeout(resolve, 250))
  frame.contentWindow.focus()
  frame.contentWindow.print()
  setTimeout(() => frame.remove(), 60_000)
}
