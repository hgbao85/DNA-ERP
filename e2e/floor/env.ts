import os from 'node:os'

/**
 * Môi trường bài thử điện thoại công nhân (QR tại máy) - changelog BE docs/changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 42.
 *
 * Trang được mở bằng http://<IP Wi-Fi của máy này>:3100 - KHÔNG phải localhost - để trình duyệt coi là "ngữ cảnh không an toàn" y như
 * điện thoại thật mở http://IP (lỗi `crypto.randomUUID` làm nút Lưu báo lỗi trước đây chỉ xảy ra ở đây). Đặt E2E_LAN_IP để chỉ định IP khác.
 */

function lanIp(): string {
  if (process.env.E2E_LAN_IP) return process.env.E2E_LAN_IP
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/vethernet|wsl|docker|virtual|loopback|vmware|hyper-v/i.test(name)) continue
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && a.address.startsWith('192.168.')) return a.address
    }
  }
  return 'localhost'
}

export const LAN_HOST = lanIp()
export const FE_PORT = Number(process.env.E2E_FE_PORT ?? 3100)
export const BE_PORT = Number(process.env.E2E_BE_PORT ?? 3002)
export const FE_ORIGIN = `http://${LAN_HOST}:${FE_PORT}`
export const API_BASE = process.env.E2E_API_BASE_URL ?? `http://${LAN_HOST}:${BE_PORT}/api/v1`

/** Dải IP "mạng công ty" ghi trong `floorAllowedIps` của DB thử (10.88.0.0/16); mỗi bài lấy 1 IP riêng trong dải để không dùng chung hạn mức đăng nhập 8 lần/phút/IP. */
export const FACTORY_PREFIX = '10.88'
/** IP ngoài mạng công ty (dải tài liệu TEST-NET-3) - bị chặn đăng nhập công nhân. */
export const OUTSIDE_IP = '203.0.113.9'
export const QLSX_IP = `${FACTORY_PREFIX}.250.1`
