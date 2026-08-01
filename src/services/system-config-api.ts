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
  });
}
