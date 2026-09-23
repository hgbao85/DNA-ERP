'use client';

import GuideApp from '../../modules/pages/Guide/GuideApp';

/**
 * Trang Hướng dẫn sử dụng — CÔNG KHAI, không yêu cầu đăng nhập (khác mọi route khác trong
 * app này). Nội dung là tài liệu tĩnh, không gọi API nghiệp vụ nào, nên không có lý do kỹ
 * thuật để bắt xác thực trước khi đọc. Nếu trình duyệt đang có sẵn phiên đăng nhập (token
 * hợp lệ), GuideApp vẫn đọc được user qua useAuth() để cá nhân hoá mục "Dành cho bạn" —
 * nhưng thiếu phiên đăng nhập không chặn xem, chỉ ẩn phần cá nhân hoá đó.
 */
export default function GuidePage() {
  return <GuideApp />;
}
