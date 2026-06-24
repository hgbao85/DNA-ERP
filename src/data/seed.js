// Dữ liệu mẫu để chạy thử — sẽ được lưu vào LocalStorage lần đầu
export const SEED_CUSTOMERS = [
  {
    id: 'KH001',
    name: 'Công ty TNHH Thái Lâm',
    city: 'TP.HCM',
    phone: '0901 234 567',
    email: 'lienhe@thailam.vn',
    products: ['SP-2241', 'SP-2198'],
    sales: 'Minh Tuấn',
    cycleDays: 30,
    lastContact: '2026-04-17',
    notes: 'KH thân thiết, hay hỏi thêm về dòng thép không gỉ.',
    history: [
      { date: '2026-04-17', note: 'Gọi điện hỏi thăm — KH hài lòng, dự kiến tái đặt tháng 5.' },
      { date: '2026-03-18', note: 'Gửi email báo giá Q2/2026.' },
    ],
  },
  {
    id: 'KH002',
    name: 'Hải Dương Manufacturing',
    city: 'Hải Dương',
    phone: '0912 345 678',
    email: 'contact@hdmfg.com',
    products: ['SP-3310'],
    sales: 'Lan Anh',
    cycleDays: 45,
    lastContact: '2026-04-03',
    notes: 'Chu kỳ mua đều, tiềm năng upsell thêm SP-3311.',
    history: [
      { date: '2026-04-03', note: 'Gặp trực tiếp tại nhà máy, demo sản phẩm mới.' },
      { date: '2026-02-17', note: 'Ký hợp đồng Q1/2026.' },
    ],
  },
  {
    id: 'KH003',
    name: 'Bình Việt Co., Ltd',
    city: 'Bình Dương',
    phone: '0933 456 789',
    email: 'binhviet@bv.vn',
    products: ['SP-1102', 'SP-1788'],
    sales: 'Hồng Nhung',
    cycleDays: 30,
    lastContact: '2026-04-19',
    notes: 'Đã hẹn gặp tuần trước, cần follow-up báo giá Q3.',
    history: [
      { date: '2026-04-19', note: 'Zalo hỏi thăm — KH yêu cầu báo giá thêm.' },
    ],
  },
  {
    id: 'KH004',
    name: 'Minh Trung Import Export',
    city: 'Hà Nội',
    phone: '0944 567 890',
    email: 'minhtrung@mt.vn',
    products: ['SP-4401'],
    sales: 'Minh Tuấn',
    cycleDays: 60,
    lastContact: '2026-03-28',
    notes: 'Sắp ký hợp đồng dài hạn, cần ưu tiên chăm sóc.',
    history: [
      { date: '2026-03-28', note: 'Email xác nhận điều khoản hợp đồng.' },
    ],
  },
  {
    id: 'KH005',
    name: 'Phú Thọ Steel Group',
    city: 'Phú Thọ',
    phone: '0955 678 901',
    email: 'phutho@ptsg.vn',
    products: ['SP-2050', 'SP-2051'],
    sales: 'Bảo Châu',
    cycleDays: 30,
    lastContact: '2026-04-24',
    notes: 'KH lớn, mỗi đơn >500 triệu. Cần phản hồi nhanh.',
    history: [
      { date: '2026-04-24', note: 'Gặp tại triển lãm, giới thiệu SP mới.' },
    ],
  },
  {
    id: 'KH006',
    name: 'Đại Lộc Furniture',
    city: 'Đà Nẵng',
    phone: '0966 789 012',
    email: 'dailoc@dlf.vn',
    products: ['SP-0990'],
    sales: 'Lan Anh',
    cycleDays: 30,
    lastContact: '2026-05-10',
    notes: 'Mới ký HĐ tháng 5, đang triển khai đơn hàng đầu tiên.',
    history: [
      { date: '2026-05-10', note: 'Ký HĐ, chuyển sang bộ phận giao hàng.' },
    ],
  },
]

export const SEED_SETTINGS = {
  remindDaysBefore: 3,
  notifyChannel: 'Zalo OA',
  notifyHour: '09:00',
  messageTemplate:
    'Chào anh/chị [TÊN KH], em là [TÊN SALES] từ Đông Nam Á Corp. ' +
    'Không biết gần đây anh/chị dùng sản phẩm [MÃ SP] thế nào ạ? ' +
    'Bên em có một số thông tin mới muốn chia sẻ với anh/chị ạ.',
}
