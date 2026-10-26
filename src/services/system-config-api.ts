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
    // Nhóm "Máy cắt" (Tối ưu cắt sắt). Không có trong draft -> undefined thì BE giữ nguyên.
    solverMachine: data.solverMachine,
    solverMctdBladeWidthMm: data.solverMctdBladeWidthMm,
    solverMctdTrimStartMm: data.solverMctdTrimStartMm,
    solverBundleFactors: data.solverBundleFactors,
    solverMaxManualCuts: data.solverMaxManualCuts,
    solverMaxSizesPerPattern: data.solverMaxSizesPerPattern,
    // Cỡ lệnh gộp (2026-10-24): mốc/hạn cách nhau tối đa N ngày + tối đa M SKU mỗi lệnh. Hàm này chỉ
    // chuyển các field được liệt kê tên; solverMergeWindowDays trước đây THIẾU ở đây nên Admin sửa
    // ở màn Cấu hình hệ thống mà BE không bao giờ nhận được - thêm field mới phải thêm ở cả đây.
    solverMergeWindowDays: data.solverMergeWindowDays,
    solverMergeMaxSkus: data.solverMergeMaxSkus,
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
