# Changelog 12/11/2026 - Review UI màn chi tiết lệnh (KHSX › Lệnh sản xuất mới)

## Yêu cầu
Review UI màn chi tiết 1 lệnh của KHSX (ảnh THU-902), sửa 5 điểm:
1. Thanh cuộn ngang thừa dưới bảng SKU.
2. Ô SKU chồng tới 8 dòng (mã, trạng thái, tên trùng mã, load cont, dây, nệm, ×SL, xưởng, LSX) - dòng cao, ngày cách xa tên.
3. Thông tin lặp: mã lệnh vs chip "LSX …", "N SKU" 2 lần, xưởng ở từng SKU dù cả lệnh 1 xưởng.
4. Trạng thái "Chờ QLSX xử lý" nằm lẫn trong ô SKU.
5. "từ 17/11" dưới ngày không có nhãn (phải rê chuột mới biết).

## Sửa
- `src/modules/pages/ProductionPlan/LenhSXPage.tsx`:
  1. Cột ngày `minmax(90px, 105px)` (màn duyệt QLSX/Sếp `minmax(86px, 95px)`), cột cuối `minmax`, cột SKU `minmax(170px, 1fr)`:
     bảng co vừa khung thay vì đòi tối thiểu 851px (khung 840px → cuộn ngang thừa). Hai đầu đều là độ dài cố định nên tiêu đề và
     từng dòng vẫn thẳng cột.
  2. Ô SKU (KHSX): số lượng "×40" đậm ngay cạnh mã; tên SKU trùng y mã thì không in lại (cả màn duyệt QLSX/Sếp).
  3. + 4. Đầu lệnh: nhãn trạng thái chung (mọi SKU cùng trạng thái: Chờ QLSX xử lý / Chờ sếp duyệt / Đang sản xuất / Bị từ chối),
     chip xưởng (mọi SKU cùng xưởng), nút sửa số LSX cạnh mã lệnh khi lệnh 1 SKU có số LSX chính là mã lệnh; ô SKU bỏ các thứ đã
     lên đầu. Chip "N SKU" ở đầu lệnh chỉ hiện khi lệnh có nhiều nhóm PO. Lệnh gộp nhiều SKU / trạng thái lệch nhau vẫn hiện riêng
     từng SKU như cũ.
  5. Dòng ngày sớm nhất hàng về ghi "về từ 17/11" (cả màn duyệt).
- `src/components/LsxCodeInput.tsx`: prop `hideChip` - chỉ hiện nút sửa (dùng ở đầu lệnh, số LSX đã hiện to ở đó).

## Kiểm tra
- `tsc` sạch; `eslint` không thêm cảnh báo (LenhSXPage 115 → 115, LsxCodeInput 1 → 1); `vitest` 444/444.
- Trình duyệt (local, khung 840px):
  - KHSX lệnh 1 SKU THU-902: đầu lệnh "THU-902 ✎ · Chờ QLSX xử lý · Xưởng Phú An"; ô SKU còn mã + ×40, load cont, dây, nệm;
    "về từ 17/11"; không còn thanh cuộn (840/840); bút chì mở ô sửa số LSX.
  - KHSX lệnh gộp PBG-1 + PBG-2: đầu lệnh "Đang sản xuất · Xưởng Phú An", mỗi SKU vẫn có chip LSX riêng; không cuộn ngang.
  - QLSX màn duyệt THU-902: không cuộn ngang, "về từ", tên trùng mã đã ẩn.

## Bổ sung: ngày ở các cột mốc nằm thẳng 1 hàng
Ô ngày căn giữa theo chiều dọc nên ô có dòng phụ ("về từ …", "đề xuất", "quá hạn …", "từ PO") cao hơn và ngày chính bị đẩy lên
- 2 cột vật tư nằm cao hơn các cột khác. Desktop: dòng phụ treo ngay dưới ngày chính (`dateSub`, position absolute), mỗi ô chỉ
cao đúng 1 dòng ngày nên mọi ngày chính cùng hàng; điện thoại giữ như cũ. Áp cả màn KHSX và màn duyệt QLSX/Sếp (ô mốc + ô hạn giao).
Kiểm: tsc sạch, eslint 115 → 115, vitest 444/444; đo trên trình duyệt: THU-902 (KHSX) 6 ngày cùng toạ độ, lệnh gộp 2 SKU mỗi dòng
cùng toạ độ, màn duyệt QLSX cùng toạ độ; dòng phụ không tràn ra ngoài dòng.
