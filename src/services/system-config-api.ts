/** Adapter SYSTEM CONFIG: FE ⇄ BE thật (module `system-config` — bản ghi cấu hình duy nhất). */
import { http } from './core/http';
import type { SystemConfig } from '../types/admin';

export async function getSystemConfig(): Promise<SystemConfig> {
  return http.get<SystemConfig>('/system-config');
}

export async function updateSystemConfig(data: Partial<SystemConfig>): Promise<SystemConfig> {
  return http.put<SystemConfig>('/system-config', {
    companyName: data.companyName,
    companyAddress: data.companyAddress,
    companyPhone: data.companyPhone,
    companyEmail: data.companyEmail,
    taxCode: data.taxCode,
    defaultCurrency: data.defaultCurrency,
    // Không có trong form cũ -> undefined thì BE giữ nguyên; trống -> '' để BE xoá.
    floorPublicUrl: data.floorPublicUrl === undefined ? undefined : (data.floorPublicUrl ?? ''),
    // Bỏ dòng trống; mảng rỗng = tắt giới hạn mạng công ty.
    floorAllowedIps: data.floorAllowedIps?.map((l) => l.trim()).filter(Boolean),
  });
}

export interface NetworkInfo {
  /** IP mà BE thấy của người đang mở màn này. */
  ip: string | null
  /** IP nội bộ/loopback: BE chưa thấy IP thật (chạy local, hoặc chưa khai TRUST_PROXY_HOPS sau proxy). */
  isPrivate: boolean
  /** Giới hạn mạng công ty đang bật (danh sách có ít nhất 1 IP). */
  enforced: boolean
  /** IP này có nằm trong danh sách không (công nhân ở IP này có vào được không). */
  allowed: boolean
  /** Chuỗi X-Forwarded-For BE nhận được (null = không có proxy nào thêm header) - để chẩn đoán số lớp proxy. */
  forwardedFor: string | null
  /** Số lớp proxy BE đang tin (TRUST_PROXY_HOPS). */
  trustProxyHops: number
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  return http.get<NetworkInfo>('/system-config/my-ip');
}
