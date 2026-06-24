export type MockLine = { id: number; name: string; specs: string; unit: string; qty: number };
export type MockStage = { stageType: string; lines: MockLine[] };
export type MockCatStatus = { cat: string; confirmed: boolean; confirmedBy: string | null };

export type MockBom = {
  id: number;
  productCode: string;
  productName: string;
  version: number;
  createdBy: string;
  status: 'IN_PROGRESS' | 'PENDING' | 'APPROVED' | 'REJECTED';
  stages: MockStage[];
  catStatuses: MockCatStatus[];
};

export const MOCK_BOMS: MockBom[] = [
  {
    id: 1,
    productCode: 'GHE-J55-GP',
    productName: 'Ghế J55 Goplus Mới',
    version: 1,
    createdBy: 'Dương Vũ Tố Ngân',
    status: 'IN_PROGRESS',
    catStatuses: [
      { cat: 'SAT',      confirmed: true,  confirmedBy: 'Nguyễn Thanh Đức' },
      { cat: 'DAY',      confirmed: false, confirmedBy: null },
      { cat: 'PHU_KIEN', confirmed: false, confirmedBy: null },
    ],
    stages: [
      {
        stageType: 'PHOI',
        lines: [
          { id: 1,  name: 'Sắt V18',        specs: '6.2cm',           unit: 'cm',  qty: 1332 },
          { id: 2,  name: 'Sắt V18',        specs: '6.2cm — 262mm',   unit: 'cm',  qty: 1048 },
          { id: 3,  name: 'Sắt V10',        specs: '6.2cm',           unit: 'cm',  qty: 731.6 },
          { id: 4,  name: 'Sắt hộp 20×20', specs: '6.2cm',           unit: 'cm',  qty: 591.6 },
          { id: 5,  name: 'Thép phi 6',     specs: '',                unit: 'cm',  qty: 240 },
          { id: 6,  name: 'Thép F14',       specs: '',                unit: 'cm',  qty: 12 },
          { id: 7,  name: 'Tan rút',        specs: '',                unit: 'cái', qty: 44 },
        ],
      },
      {
        stageType: 'HAN',
        lines: [
          { id: 8,  name: 'Bánh đà cát',     specs: '3.5',            unit: 'cái', qty: 0.012 },
          { id: 9,  name: 'Bánh đà cát',     specs: '10cm',           unit: 'cái', qty: 0.003 },
          { id: 10, name: 'Lực giữ đen',     specs: '',               unit: 'cái', qty: 0.336 },
          { id: 11, name: 'Dây xăm bông/ổn 08', specs: '',            unit: 'kg',  qty: 11.43 },
          { id: 12, name: 'Ổn số kiêm',      specs: '',               unit: 'cái', qty: 3 },
          { id: 13, name: 'Khí CO2',         specs: '',               unit: 'kg',  qty: 2.727 },
          { id: 14, name: 'Van nén',         specs: '',               unit: 'cái', qty: 2.154 },
        ],
      },
      {
        stageType: 'SON',
        lines: [
          { id: 15, name: 'Sứa bọt',         specs: '',               unit: 'kg',  qty: 0.308 },
          { id: 16, name: 'Tây dầu',         specs: '',               unit: 'lít', qty: 0.03 },
          { id: 17, name: 'Hàm bọt',         specs: '',               unit: 'lít', qty: 0 },
          { id: 18, name: 'Photphat nano',   specs: '',               unit: 'kg',  qty: 0.019 },
          { id: 19, name: 'Gas/đốt mỏ cắt đập', specs: '',           unit: 'kg',  qty: 0.336 },
          { id: 20, name: 'Sơn đệm',         specs: '',               unit: 'lon', qty: 0.008 },
        ],
      },
      {
        stageType: 'DAN',
        lines: [
          { id: 21, name: 'Dây xăm bông/đan 08', specs: '',          unit: 'kg',  qty: 11.43 },
          { id: 22, name: 'Bỉ zipper',        specs: '3×12cm',       unit: 'cái', qty: 3 },
          { id: 23, name: 'Bỉ zipper',        specs: '7mm',          unit: 'cái', qty: 0 },
        ],
      },
      {
        stageType: 'BAO_BI',
        lines: [
          { id: 24, name: 'Logo Patiojoy',    specs: 'khổ-chỉ',      unit: 'cái', qty: 4 },
          { id: 25, name: 'Nút V18 Eru',      specs: '',              unit: 'con', qty: 8 },
          { id: 26, name: 'Nút V18 thường',   specs: '',              unit: 'con', qty: 8 },
          { id: 27, name: 'Nút tổng ống 6×15 có rãnh', specs: '',    unit: 'con', qty: 8 },
          { id: 28, name: 'Bulon M6×35',      specs: '7 màu',        unit: 'con', qty: 46 },
          { id: 29, name: 'London 6×14',      specs: '8 màu',        unit: 'con', qty: 46 },
          { id: 30, name: 'Lực giữ 4×98',    specs: 'đường bì 7 màu', unit: 'cái', qty: 46 },
          { id: 31, name: 'HDLR',             specs: '',              unit: 'bộ',  qty: 1 },
          { id: 32, name: 'Nhãn số 1,2,3',   specs: '',              unit: 'cái', qty: 3 },
          { id: 33, name: 'Dây ruy băng',     specs: '',              unit: 'cuộn', qty: 1 },
        ],
      },
      {
        stageType: 'DONG_GOI',
        lines: [
          { id: 34, name: 'Thùng 75×54×44cm', specs: 'rộng nắp nịp mít tôm chữa 54cm đt 200', unit: 'cái', qty: 1 },
          { id: 35, name: 'Vải lưng tay',     specs: 'GA M4×25',     unit: 'cái', qty: 8 },
          { id: 36, name: 'Nhăn chỉ',         specs: '50×31.5cm',    unit: 'cái', qty: 1 },
          { id: 37, name: 'Xốp',              specs: '3.6m 44×6 cm mầu nâu nim theo dừa bằng', unit: 'cái', qty: 1 },
          { id: 38, name: 'Góc giấy',         specs: '5×5, 30×50cm', unit: 'cái', qty: 4 },
          { id: 39, name: 'Góc 10×10cm',      specs: '',              unit: 'cái', qty: 4 },
          { id: 40, name: 'Lót mít thùng',    specs: '70×52 3 lớp',  unit: 'tờ',  qty: 1 },
          { id: 41, name: 'Hút ẩm',           specs: '',              unit: 'gói', qty: 2 },
          { id: 42, name: 'Cotton đa phụ kiện', specs: '',            unit: 'cái', qty: 1 },
          { id: 43, name: 'Dây đai vàng',     specs: '',              unit: 'bo',  qty: 0.012 },
          { id: 44, name: 'Màng PE',          specs: '',              unit: 'cuộn', qty: 0.019 },
          { id: 45, name: 'Bạc ke tráng',     specs: '6cm',          unit: 'cái', qty: 0.462 },
          { id: 46, name: 'Xăng',             specs: '',              unit: 'lít', qty: 0.01 },
          { id: 47, name: 'Sơn đệm',          specs: '',              unit: 'lon', qty: 0.008 },
          { id: 48, name: 'Lưỡng hàn',        specs: '',              unit: 'lon', qty: 3.06 },
        ],
      },
    ],
  },
];
