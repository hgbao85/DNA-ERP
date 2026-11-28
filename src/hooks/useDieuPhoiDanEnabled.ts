import { getDieuPhoiDanConfig } from '../services/weaving-coordination-api'
import { createFeatureSwitch } from './featureSwitch'

/**
 * Công tắc Điều phối đan (DIEU_PHOI_DAN_ENABLED của BE, 25/11/2026). `null` = đang hỏi BE.
 * Lỗi mạng tạm thời không còn bị nhớ là TẮT - hook tự hỏi lại (featureSwitch.ts, 28/11/2026); BE cũ chưa có route (404) thì tắt.
 */
const sw = createFeatureSwitch(getDieuPhoiDanConfig)

export const loadDieuPhoiDanEnabled = sw.load
export const useDieuPhoiDanEnabled = sw.useSwitch
/** Chỉ cho test. */
export const resetDieuPhoiDanEnabledForTest = sw.reset
