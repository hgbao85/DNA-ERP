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
 * Domain "mua hàng" CÓ UI thật (LenhMuaNCCPage/BossApp "So sánh giá"/NhapKhoPage) và được lái qua
 * UI — nhưng cần đúng tài khoản khớp Material.buyerId của vật tư sắt dùng trong BOM test này
 * ("nhan", không phải 1 trong các tài khoản chuẩn ở prisma/seed-demo.ts). Việc đăng ký NCC cho vật
 * tư (Vật tư – NCC) là dữ liệu chuẩn bị, không phải bước nghiệp vụ của luồng vàng, nên làm qua API
 * cho nhanh/xác định.
 *
 * Vì vậy: 6/8 bước lái qua browser thật (PO, xem SKU, KHSX/QLSX/Boss xử lý lệnh sản xuất, báo giá
 * + duyệt + nhận hàng mua); chỉ duyệt cắt sắt và ship gọi API. Solver cắt sắt ngoài (cat_sat) được
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

    const piItemId: string = await test.step('Tìm PI item vừa duyệt', async () => {
      const pis = await apiCall(request, khsxToken, 'GET', '/production-invoices?limit=100');
      const pi = pis.data.find((p: any) => p.salesOrderId === salesOrderId);
      expect(pi, `PI cho sales order ${salesOrderId}`).toBeTruthy();
      const item = pi.items.find((it: any) => it.prodApprovalStatus === 'APPROVED');
      expect(item, 'PI item ở trạng thái APPROVED').toBeTruthy();
      return item.id;
    });

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
      const productionOrderPoNumber: string = await test.step('Lấy mã PO-x của ProductionOrder (dùng để tìm dòng trên UI)', async () => {
        const order = await apiCall(request, qlsxToken, 'GET', `/production-orders/${productionOrderId}`);
        return order.poNumber;
      });

      // Đăng ký NCC cho các vật tư trong đề xuất — dữ liệu chuẩn bị (fixture), không phải bước
      // nghiệp vụ của luồng vàng, nên làm qua API cho nhanh/xác định (SupplierPicker ở
      // LenhMuaNCCPage BẮT BUỘC chọn từ NCC đã đăng ký, không cho nhập tay). Idempotent - tái
      // dùng đúng 1 NCC "NCC E2E Test (fixture)" cố định qua mọi lần chạy thay vì tạo mới mỗi lần,
      // vì material 38/39/94 dùng chung giữa các lần chạy (cùng product "test") - nếu không sẽ
      // tích luỹ NCC trùng tên qua từng lần chạy, khiến useEffect seed nhiều dòng báo giá/vật tư
      // hơn dự kiến và test tự flaky theo thời gian (đã gặp thật, dọn dữ liệu tích luỹ cũ 2026-08-13).
      const FIXTURE_SUPPLIER_NAME = 'NCC E2E Test (fixture)';
      await test.step('Chuẩn bị NCC cho vật tư (fixture)', async () => {
        const nhanTokenSetup = await apiLogin(request, 'nhan');
        const detail = await apiCall(request, nhanTokenSetup, 'GET', `/purchase-proposals/${purchaseProposalId}`);
        expect(detail.items.length).toBeGreaterThan(0);

        const existingSuppliers = await apiCall(request, nhanTokenSetup, 'GET', '/suppliers?limit=100');
        let supplierId = existingSuppliers.data.find((s: any) => s.name === FIXTURE_SUPPLIER_NAME)?.id;
        if (!supplierId) {
          const created = await apiCall(request, nhanTokenSetup, 'POST', '/suppliers', { name: FIXTURE_SUPPLIER_NAME });
          supplierId = created.id;
        }

        const materialIds = [...new Set(detail.items.map((it: any) => it.materialId))];
        for (const materialId of materialIds) {
          const links = await apiCall(request, nhanTokenSetup, 'GET', `/materials/${materialId}/suppliers`);
          if (links.some((l: any) => l.supplierId === supplierId)) continue;
          await apiCall(request, nhanTokenSetup, 'POST', `/materials/${materialId}/suppliers`, {
            supplierId,
            price: 50_000,
          });
        }
      });

      await test.step('Mua hàng (nhan) báo giá + gửi Sếp duyệt — UI thật', async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await uiLogin(page, 'nhan');
        await expect(page.getByText('Lệnh mua — chọn NCC')).toBeVisible();

        await page.getByRole('cell', { name: productionOrderPoNumber, exact: true }).click();
        await page.getByRole('button', { name: 'Tiếp nhận & Báo giá' }).click();
        await expect(page.getByRole('button', { name: 'Gửi Giám đốc duyệt' })).toBeVisible();

        // useEffect tự seed dòng báo giá cho từng vật tư qua getMaterialSuppliers() (1 fetch/vật
        // tư, chạy song song, mỗi dòng render dần khi fetch của nó resolve - không phải cùng lúc).
        // SupplierPicker mỗi dòng CŨNG tự fetch riêng (useFetch nội bộ) nên có thể trễ hơn 1 nhịp
        // so với chính input ngày của dòng đó xuất hiện. Vì vậy KHÔNG fill 1 lượt duy nhất - lặp
        // lại việc điền tới khi nút "Gửi Giám đốc duyệt" tự bật (đúng nguồn sự thật canSubmit() của
        // trang, không đoán số lần/khoảng nghỉ) hoặc hết thời gian chờ.
        const futureDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
        const submitBtn = page.getByRole('button', { name: 'Gửi Giám đốc duyệt' });
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline && !(await submitBtn.isEnabled())) {
          const selects = page.locator('select');
          for (let i = 0; i < (await selects.count()); i++) {
            const sel = selects.nth(i);
            if (!(await sel.inputValue())) await sel.selectOption({ index: 1 }).catch(() => {});
          }
          const priceInputs = page.locator('input[type="number"]');
          for (let i = 0; i < (await priceInputs.count()); i++) {
            const inp = priceInputs.nth(i);
            if (!(await inp.inputValue())) await inp.fill('50000').catch(() => {});
          }
          const dateInputs = page.locator('input[type="date"]');
          for (let i = 0; i < (await dateInputs.count()); i++) {
            const inp = dateInputs.nth(i);
            if (!(await inp.inputValue())) await inp.fill(futureDate).catch(() => {});
          }
          if (await submitBtn.isEnabled()) break;
          await page.waitForTimeout(300);
        }
        await expect(submitBtn).toBeEnabled({ timeout: 5_000 });

        // handleSubmit() gọi setSelectedId(null) NGAY sau khi bắn request (không đợi resolve) -
        // quay lại danh sách ngay lập tức, không có màn xác nhận riêng để chờ. Các POST báo giá +
        // POST submit vẫn chạy ngầm (fire-and-forget) SAU KHI UI đã điều hướng - phải đợi đúng
        // network response cuối (/submit) rồi mới đóng context, nếu không đóng context sớm sẽ huỷ
        // ngang các request đang bay giữa chừng (đã gặp thật - đề xuất kẹt ở QUOTING dù UI trông
        // như đã gửi xong).
        const [submitResp] = await Promise.all([
          page.waitForResponse((r) => /\/purchase-proposals\/\d+\/submit$/.test(r.url()) && r.request().method() === 'POST'),
          submitBtn.click(),
        ]);
        expect(submitResp.ok(), `POST submit -> ${submitResp.status()}`).toBeTruthy();
        await expect(page.getByText('Lệnh mua — chọn NCC')).toBeVisible();
        await ctx.close();
      });

      await test.step('Xác nhận đề xuất mua đã chuyển SUBMITTED (API, chỉ đọc)', async () => {
        for (let i = 0; i < 10; i++) {
          const detail = await apiCall(request, khopshToken, 'GET', `/purchase-proposals/${purchaseProposalId}`);
          if (detail.status === 'SUBMITTED') return;
          await new Promise((r) => setTimeout(r, 500));
        }
        throw new Error('Đề xuất mua chưa chuyển SUBMITTED sau khi báo giá qua UI');
      });

      await test.step('Boss duyệt báo giá (So sánh giá) — UI thật', async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await uiLogin(page, 'boss');
        await page.getByRole('button', { name: 'So sánh giá' }).click();
        await page.getByRole('cell', { name: productionOrderPoNumber, exact: true }).click();

        // handleApprove() cũng fire-and-forget (setSelectedRequestId(null) ngay, không đợi resolve)
        // - đợi đúng response POST .../approve rồi mới đóng context, cùng lý do đã sửa ở bước báo giá.
        const [approveResp] = await Promise.all([
          page.waitForResponse((r) => /\/purchase-proposals\/\d+\/approve$/.test(r.url()) && r.request().method() === 'POST'),
          page.getByRole('button', { name: 'Duyệt', exact: true }).click(),
        ]);
        expect(approveResp.ok(), `POST approve -> ${approveResp.status()}`).toBeTruthy();
        await ctx.close();
      });

      await test.step('Kho phôi-sơn-hàn xác nhận nhận hàng — UI thật', async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await uiLogin(page, 'khopsh');
        await page.getByRole('button', { name: 'Nhập kho', exact: true }).click();
        await page.getByRole('cell', { name: productionOrderPoNumber, exact: true }).click();

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
