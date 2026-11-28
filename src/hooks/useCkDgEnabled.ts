import { getCkDgConfig } from '../services/ck-dg-api'
import { createFeatureSwitch } from './featureSwitch'

/**
 * Công tắc Chuyền kiểm / Đóng gói bằng quét QR (CK_DG_QR_ENABLED của BE, 24/11/2026). `null` = đang hỏi BE.
 * Lỗi mạng tạm thời không còn bị nhớ là TẮT - hook tự hỏi lại (featureSwitch.ts, 28/11/2026); BE cũ chưa có route (404) thì tắt.
 */
const sw = createFeatureSwitch(getCkDgConfig)

export const loadCkDgEnabled = sw.load
export const useCkDgEnabled = sw.useSwitch
/** Chỉ cho test. */
export const resetCkDgEnabledForTest = sw.reset
