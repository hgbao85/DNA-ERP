const ISO = (d: string) => new Date(d).toISOString();

export const seedWeavingByPoint = [
  {
    id: 1,
    code: 'DD-A',
    fullName: 'Anh Tuấn',
    phone: '0909123456',
    totalHolding: 45,
    assignments: [
      {
        id: 901,
        piCode: 'PI-2026-001',
        poNumber: 'PO-MY-001',
        productLabel: 'Ghế J55',
        pieceName: 'Mặt ghế',
        pieceCode: 'MAT-GHE',
        quantity: 100,
        completed: 55,
        holding: 45,
        deadline: ISO('2026-07-05'),
      },
    ],
  },
  {
    id: 2,
    code: 'DD-B',
    fullName: 'Chị Hà',
    phone: '0918765432',
    totalHolding: 30,
    assignments: [
      {
        id: 902,
        piCode: 'PI-2026-001',
        poNumber: 'PO-MY-001',
        productLabel: 'Ghế J55',
        pieceName: 'Mặt ghế',
        pieceCode: 'MAT-GHE',
        quantity: 80,
        completed: 50,
        holding: 30,
        deadline: ISO('2026-07-10'),
      },
    ],
  },
];
