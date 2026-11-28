import { getViTriKhoConfig } from '../services/vi-tri-kho-api'
import { createFeatureSwitch } from './featureSwitch'

/**
 * Công tắc vị trí kho Thành phẩm + load cont (VI_TRI_KHO_ENABLED của BE, 25/11/2026). `null` = đang hỏi BE.
 * Lỗi mạng tạm thời không còn bị nhớ là TẮT - hook tự hỏi lại (featureSwitch.ts, 28/11/2026); BE cũ chưa có route (404) thì tắt.
 */
const sw = createFeatureSwitch(getViTriKhoConfig)

export const loadViTriKhoEnabled = sw.load
export const useViTriKhoEnabled = sw.useSwitch
/** Chỉ cho test. */
export const resetViTriKhoEnabledForTest = sw.reset
