/**
 * Facade API — toàn bộ dữ liệu mock trên FE, không gọi backend.
 * Giữ nguyên import path `services/api` cho các page hiện có.
 */
export * from '../lib/mock/services';

/** @deprecated Không còn axios client — giữ export trống để tránh break import default */
const api = {};
export default api;
