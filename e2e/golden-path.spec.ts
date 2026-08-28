import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Baseline e2e cho đúng 1 luồng tiền (roadmap mục 08, M4): PO khách hàng -> duyệt SKU -> PI
 * (lệnh sản xuất) -> đề xuất cắt sắt -> mua hàng -> ship.
 *
 * Chỉ 2 chặng KHÔNG có UI thật ở bản này (xác nhận khi viết test — xem
 * D:\DNA-ERP-BE\src\modules\cutting-proposals\cutting-proposals.controller.ts và
 * sales-orders.controller.ts): duyệt đề xuất cắt sắt và ship hàng chỉ có endpoint BE, không có
 * nút bấm tương ứng trên FE (Admin "Cắt sắt" chỉ đọc/"Tính lại"; tab "Chi tiết xuất hàng" của PO
 * chỉ hiển thị shippedQty) — 2 chặng này gọi thẳng API.
 *
 * Domain "mua hàng" CÓ UI thật (LenhMuaNCCPage/NhapKhoPage) và được lái qua UI — nhưng cần đúng
 * tài khoản khớp Material.buyerId của vật tư sắt dùng trong BOM test này ("nhan", không phải 1
 * trong các tài khoản chuẩn ở prisma/seed-demo.ts).
 *
 * 2026-08-27 ("Sếp duyệt ngoài hệ thống"): luồng mua hàng rút còn Mua hàng tải file Sếp đã ký tay
 * lên -> Kho nhận hàng - không còn báo giá nhiều NCC hay bước duyệt nào của Sếp trong hệ thống
 * (màn "So sánh giá" đã gỡ khỏi BossApp). File phiếu ký dùng fixture tĩnh e2e/fixtures/phieu-da-ky.png.
 *
 * Vì vậy: 5/7 bước lái qua browser thật (PO, xem SKU, KHSX/QLSX/Boss xử lý lệnh sản xuất, Sếp đã
 * duyệt + nhận hàng mua); chỉ duyệt cắt sắt và ship gọi API. Solver cắt sắt ngoài (cat_sat) được
 * thay bằng stub cục bộ (xem e2e/solver-stub.js) để test không phụ thuộc mạng ngoài/không xác định.
 *
 * Chạy: `npm run test:e2e` (tự khởi động BE/FE/solver-stub nếu chưa chạy sẵn, xem playwright.config.ts).
 */

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:3001/api/v1';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'demo1234';

async function apiLogin(request: APIRequestContext, username: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username, password: DEMO_PASSWORD },
  });
  expect(res.ok(), `login ${username}: ${res.status()} ${await res.text()}`).toBeTruthy();
  const json = await res.json();
  return json.data.accessToken as string;
}

async function apiCall(
  request: APIRequestContext,
  token: string,
  method: 'GET' | 'POST',
  path: string,
  data?: unknown,
  headers: Record<string, string> = {},
): Promise<any> {
  const res = await request.fetch(`${API_BASE}${path}`, {
    method,
    data,
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
  const bodyText = await res.text();
  let json: any;
  try { json = JSON.parse(bodyText); } catch { json = bodyText; }
  expect(res.ok(), `${method} ${path} -> ${res.status()}: ${bodyText}`).toBeTruthy();
  return json.data ?? json;
}

async function uiLogin(page: Page, username: string) {
  page.on('dialog', (dialog) => {
    const msg = dialog.message();
    dialog.dismiss();
    throw new Error(`Unexpected alert() while logged in as ${username}: ${msg}`);
  });
  await page.goto('/login');
  await page.getByPlaceholder('Tên đăng nhập').fill(username);
  await page.getByPlaceholder('••••••••').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Đăng Nhập' }).click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
}

test.describe('Golden path', () => {
  test('PO -> duyệt SKU -> PI -> đề xuất cắt sắt -> mua hàng -> ship', async ({ browser, request }) => {
    test.setTimeout(240_000);

    const marker = `E2E ${new Date().toISOString()}`;
    const qty = 5;
    let salesOrderId = '';
    let salesOrderCode = '';

    // ── 1. Sales tạo PO cho SKU đã duyệt "test" (UI thật) ──────────────────────
    await test.step('Sales tạo PO mới', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, 'sales');
      await expect(page.getByText('Quản lí đơn hàng')).toBeVisible();

      await page.getByRole('button', { name: 'Tạo PO' }).click();
      await expect(page.getByText('Tạo PO mới')).toBeVisible();

      const customerInput = page.getByPlaceholder('Tìm hoặc chọn khách hàng *');
      await customerInput.click();
      await customerInput.fill('MEIJING');
      await page.getByRole('button', { name: /MEIJING/ }).click();

      const skuInput = page.getByPlaceholder('Tìm hoặc chọn SKU đã duyệt *');
      await skuInput.click();
      await skuInput.fill('test');
      await page.getByRole('button', { name: /^test/ }).click();

      const deliveryDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      await page.locator('input[title="Hạn giao"]').fill(deliveryDate);
      await page.getByPlaceholder('Tổng số').fill(String(qty));
      await page.getByPlaceholder('Ghi chú').fill(marker);

      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/sales-orders') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Lưu' }).click(),
      ]);
      const json = await resp.json();
      salesOrderId = json.data.id;
      salesOrderCode = json.data.code;
      expect(salesOrderId).toBeTruthy();

      await expect(page.getByText(salesOrderCode)).toBeVisible();
      await ctx.close();
    });

    // ── 2. Xác nhận SKU đã duyệt hiển thị đúng (khsx, UI thật) ─────────────────
    await test.step('KHSX xem SKU đã duyệt', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, 'khsx');

      await page.getByRole('button', { name: 'Danh sách SKU' }).click();
      await page.getByPlaceholder('Tìm SKU, tên sản phẩm, khách hàng...').fill('test');
      const row = page.getByRole('row').filter({ hasText: 'test' }).first();
      await expect(row).toBeVisible();
      await expect(row.getByText('Đã duyệt')).toBeVisible();
      await ctx.close();
    });

    // ── 3. KHSX gửi QLSX xử lý (UI thật) ────────────────────────────────────────
    await test.step('KHSX gửi lệnh sản xuất cho QLSX', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, 'khsx');

      await page.getByRole('button', { name: 'Lệnh sản xuất mới' }).click();
      await page.getByPlaceholder('Tìm mã PO...').fill(salesOrderCode);
      await page.getByRole('button', { name: new RegExp(salesOrderCode) }).click();

      await page.getByRole('button', { name: 'Gửi QLSX', exact: true }).click();
      await expect(page.getByText('Chọn SKU để sản xuất')).toBeVisible();
      await page.getByRole('button', { name: 'Gửi QLSX', exact: true }).last().click();
      await expect(page.getByText('Chọn SKU để sản xuất')).toBeHidden();
      await ctx.close();
    });

    // ── 4. QLSX chọn kho thành phẩm + gửi Sếp duyệt (UI thật) ──────────────────
    await test.step('QLSX chọn kho và gửi Sếp duyệt', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, 'qlsx');

      await page.getByRole('button', { name: 'Xử lý lệnh sản xuất' }).click();
      await page.getByPlaceholder('Tìm mã PO...').fill(salesOrderCode);
      await expect(page.getByText(salesOrderCode)).toBeVisible();

      await page.getByRole('button', { name: 'Chọn kho sản xuất' }).click();
      await expect(page.getByText('Chọn kho thành phẩm')).toBeVisible();
      await page.getByPlaceholder('Chọn kho thành phẩm...').click();
      await page.locator('div').filter({ hasText: /^Kho/ }).getByRole('button').first().click();

      await page.getByRole('button', { name: 'Gửi sếp duyệt' }).click();
      await expect(page.getByText('Chọn kho thành phẩm')).toBeHidden();
      await ctx.close();
    });

    // ── 5. Boss duyệt -> tạo PI/ProductionOrder + trigger đề xuất cắt sắt (UI thật) ──
    await test.step('Boss duyệt lệnh sản xuất', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, 'boss');

      await expect(page.getByText('Tổng hợp chờ duyệt')).toBeVisible();
      await page.getByRole('button', { name: 'Lệnh sản xuất' }).click();
      await page.getByPlaceholder('Tìm mã PO...').fill(salesOrderCode);
      await expect(page.getByText(salesOrderCode)).toBeVisible();

      await page.getByRole('button', { name: 'Duyệt', exact: true }).click();
      await expect(page.getByText('Duyệt sản xuất — Tạo lệnh sản xuất')).toBeVisible();
      await page.getByRole('button', { name: 'Xác nhận duyệt' }).click();
      await expect(page.getByText('Duyệt sản xuất — Tạo lệnh sản xuất')).toBeHidden();
      await ctx.close();
    });

    // ── 6. Đề xuất cắt sắt: tìm ProductionOrder, đợi solver (stub) tính xong, QLSX duyệt (API — không có UI, xem đầu file) ──
    const qlsxToken = await apiLogin(request, 'qlsx');
    const khsxToken = await apiLogin(request, 'khsx');
    // qlsx thiếu PURCHASE_PROPOSAL:VIEW trên DB demo hiện tại dù role-permissions.constant.ts đã
    // khai (có thể do seed chưa đồng bộ) - dùng khopsh (WAREHOUSE_STAFF, đã xác nhận có quyền)
    // để đọc purchase-proposals thay vì qlsx.
    const khopshToken = await apiLogin(request, 'khopsh');

    const { piItemId, piCode }: { piItemId: string; piCode: string } = await test.step(
      'Tìm PI item vừa duyệt',
      async () => {
        const pis = await apiCall(request, khsxToken, 'GET', '/production-invoices?limit=100');
        const pi = pis.data.find((p: any) => p.salesOrderId === salesOrderId);
        expect(pi, `PI cho sales order ${salesOrderId}`).toBeTruthy();
        const item = pi.items.find((it: any) => it.prodApprovalStatus === 'APPROVED');
        expect(item, 'PI item ở trạng thái APPROVED').toBeTruthy();
        return { piItemId: item.id, piCode: pi.code };
      },
    );

    const productionOrderId: string = await test.step('Tìm ProductionOrder tự sinh', async () => {
      for (let i = 0; i < 10; i++) {
        const orders = await apiCall(request, qlsxToken, 'GET', '/production-orders?limit=100');
        const order = orders.data.find((o: any) => o.productionInvoiceItemId === piItemId);
        if (order) return order.id;
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error('ProductionOrder không tự sinh sau khi Boss duyệt');
    });

    const cuttingProposalId: string = await test.step('Đợi đề xuất cắt sắt tính xong (solver stub)', async () => {
      for (let i = 0; i < 20; i++) {
        const list = await apiCall(
          request, qlsxToken, 'GET',
          `/production-orders/${productionOrderId}/cutting-proposals?limit=5`,
        );
        const proposal = list.data[0];
        if (proposal && proposal.status !== 'CALCULATING') {
          expect(proposal.status, `cutting proposal: ${proposal.errorMessage ?? ''}`).toBe('DRAFT');
          return proposal.id;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error('Đề xuất cắt sắt không tính xong sau 10s - solver-stub có đang chạy? (xem e2e/solver-stub.js)');
    });

    await test.step('QLSX duyệt đề xuất cắt sắt', async () => {
      const approved = await apiCall(request, qlsxToken, 'POST', `/cutting-proposals/${cuttingProposalId}/approve`);
      expect(approved.status).toBe('APPROVED');
    });

    // ── 7. Mua hàng: PurchaseProposal tự sinh từ đề xuất cắt sắt đã duyệt ──────
    // "nhan" là tài khoản THẬT khớp Material.buyerId của các vật tư sắt dùng trong BOM test này
    // (không phải 1 trong các tài khoản chuẩn ở prisma/seed-demo.ts — mật khẩu demo1234 do người
    // vận hành đặt lại tay trong phiên làm việc này). "khopsh" nhận hàng vì cùng warehouseScope
    // 'phoi-son-han' với đề xuất.
    // Nếu tồn kho demo (dùng chung, tích luỹ qua các lần chạy) đã đủ cho MỌI vật tư lúc duyệt cắt
    // sắt, CuttingProposalsService.approve() tạo thẳng PurchaseProposal ở PURCHASED (D.p7, vá
    // 2026-08-13) - không còn gì để báo giá/duyệt/nhận, và đề xuất bị lọc khỏi LenhMuaNCCPage
    // (trang chỉ hiện status khác purchasing/purchased). Nhánh dưới xử lý cả 2 khả năng.
    const purchaseProposal: { id: string; status: string } | null = await test.step('Tìm đề xuất mua tự sinh', async () => {
      const proposals = await apiCall(request, khopshToken, 'GET', '/purchase-proposals?limit=100');
      const pp = proposals.data.find((p: any) => p.cuttingProposalId === cuttingProposalId);
      return pp ? { id: pp.id, status: pp.status } : null;
    });
    const purchaseProposalId = purchaseProposal?.id ?? null;

    if (purchaseProposal?.status === 'PURCHASED') {
      // Tồn đã đủ cho mọi vật tư ngay lúc duyệt - không có gì để mua, coi như xong luôn chặng này.
    } else if (purchaseProposalId) {
      // Cột mã trên 2 màn UI dưới đây (LenhMuaNCCPage/NhapKhoPage) hiện mã PI (Sếp chốt
      // 2026-08-17, xem PurchaseProposalsService.toResponseDto) - dùng lại piCode đã lấy ở trên,
      // không phải ProductionOrder.poNumber nội bộ nữa.
      //
      // 2026-08-27 ("Sếp duyệt ngoài hệ thống"): bỏ hẳn báo giá nhiều NCC + màn "So sánh giá" của
      // Sếp - so sánh giá nay làm trên phiếu Excel in ra, Sếp ký tay, Mua hàng chỉ tải file đã ký
      // lên. Không còn cần đăng ký NCC/giá tham khảo (fixture cũ), không còn bước của Sếp trong
      // luồng UI - rút từ 3 step (fixture NCC + báo giá/gửi Sếp + Boss duyệt) xuống còn 1.
      await test.step('Mua hàng (nhan) xác nhận "Sếp đã duyệt" kèm file đã ký — UI thật', async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await uiLogin(page, 'nhan');
        await expect(page.getByText('Lệnh mua vật tư')).toBeVisible();

        await page.getByRole('cell', { name: piCode, exact: true }).click();
        await page.getByRole('button', { name: 'Sếp đã duyệt' }).click();
        await page.setInputFiles('input[type="file"]', 'e2e/fixtures/phieu-da-ky.png');

        const confirmBtn = page.getByRole('button', { name: 'Xác nhận' });
        await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });

        // onConfirm() đóng popup NGAY sau khi Promise (upload + boss-approve) resolve - đợi đúng
        // network response cuối (/boss-approve) rồi mới đóng context, cùng lý do đã gặp ở luồng cũ
        // (đóng context sớm huỷ ngang request đang bay, đề xuất kẹt trạng thái cũ dù UI trông như
        // đã xong).
        const [approveResp] = await Promise.all([
          page.waitForResponse((r) => /\/purchase-proposals\/\d+\/boss-approve$/.test(r.url()) && r.request().method() === 'POST'),
          confirmBtn.click(),
        ]);
        expect(approveResp.ok(), `POST boss-approve -> ${approveResp.status()}`).toBeTruthy();
        await expect(page.getByText('Lệnh mua vật tư')).toBeVisible();
        await ctx.close();
      });

      await test.step('Xác nhận đề xuất mua đã chuyển PURCHASING (API, chỉ đọc)', async () => {
        for (let i = 0; i < 10; i++) {
          const detail = await apiCall(request, khopshToken, 'GET', `/purchase-proposals/${purchaseProposalId}`);
          if (detail.status === 'PURCHASING') return;
          await new Promise((r) => setTimeout(r, 500));
        }
        throw new Error('Đề xuất mua chưa chuyển PURCHASING sau khi Sếp đã duyệt qua UI');
      });

      await test.step('Kho phôi-sơn-hàn xác nhận nhận hàng — UI thật', async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await uiLogin(page, 'khopsh');
        await page.getByRole('button', { name: 'Nhập kho', exact: true }).click();
        await page.getByRole('cell', { name: piCode, exact: true }).click();

        // Sau mỗi lần "Xác nhận", dòng đó re-render (input+nút -> "✓ Đã nhận đủ") và cả bảng có
        // thể re-render theo state proposal mới - không lặp theo index cố định (dễ trật dòng qua
        // mỗi vòng, đã gặp thật: dòng cuối cùng bị bỏ sót). Luôn truy vấn lại nút "Xác nhận" ĐẦU
        // TIÊN còn hiển thị, xử lý xong mới tìm tiếp, tới khi không còn nút nào.
        const deadline = Date.now() + 20_000;
        for (;;) {
          // Đợi 1 nhịp mỗi vòng để React kịp re-render sau lần "Xác nhận" trước - count() không tự
          // chờ như expect(), lỡ đọc trúng khung hình cũ (nút vừa bấm chưa kịp biến mất) sẽ bấm
          // trùng 1 dòng đã nhận đủ, ăn 409 khi đề xuất vừa chuyển PURCHASED (đã gặp thật). Đi từ
          // ô nhập "SL" (duy nhất/dòng) lên <tr> cha bằng xpath - .filter({has}) trên nút "Xác
          // nhận" khớp NHIỀU dòng cùng lúc (mọi dòng còn nút, không riêng dòng đầu), gây strict-mode
          // violation khi truy vấn tiếp getByPlaceholder('SL') bên trong (đã gặp thật).
          await page.waitForTimeout(250);
          const slInput = page.getByPlaceholder('SL').first();
          if ((await slInput.count()) === 0) break;
          if (Date.now() > deadline) throw new Error('Nhận hàng qua UI không xong sau 20s');

          const row = slInput.locator('xpath=ancestor::tr[1]');
          const buyQtyText = (await row.locator('td').nth(2).innerText()).trim();
          await slInput.fill(buyQtyText);
          const confirmBtn = row.getByRole('button', { name: 'Xác nhận' });
          // confirmItem() cũng fire-and-forget (chỉ clear input ngay, không đợi resolve) - đợi
          // đúng response POST .../receive trước khi qua dòng kế tiếp/đóng context, cùng lý do
          // đã sửa ở 2 bước trên.
          const [receiveResp] = await Promise.all([
            page.waitForResponse((r) => /\/purchase-proposals\/\d+\/items\/\d+\/receive$/.test(r.url()) && r.request().method() === 'POST'),
            confirmBtn.click(),
          ]);
          expect(receiveResp.ok(), `POST receive -> ${receiveResp.status()}`).toBeTruthy();
        }
        await ctx.close();
      });

      await test.step('Xác nhận đề xuất mua đã PURCHASED (API, chỉ đọc)', async () => {
        for (let i = 0; i < 20; i++) {
          const detail = await apiCall(request, khopshToken, 'GET', `/purchase-proposals/${purchaseProposalId}`);
          if (detail.status === 'PURCHASED') return;
          await new Promise((r) => setTimeout(r, 500));
        }
        throw new Error('Đề xuất mua chưa chuyển PURCHASED sau khi nhận đủ hàng qua UI');
      });
    }

    // ── 8. Ship hàng cho khách (API — không có nút UI, xem đầu file) ──────────
    await test.step('Sales xác nhận xuất hàng', async () => {
      const salesToken = await apiLogin(request, 'sales');
      const soDetail = await apiCall(request, salesToken, 'GET', `/sales-orders/${salesOrderId}`);
      const item = soDetail.items[0];
      const shipped = await apiCall(
        request, salesToken, 'POST',
        `/sales-orders/${salesOrderId}/items/${item.id}/ship`,
        { qty },
      );
      expect(Number(shipped.shippedQty)).toBe(qty);
    });
  });
});
