import { describe, it, expect, beforeAll, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../src/index';
import { ensureDatabaseInitialized, type WorkerEnv } from '../src/db/init';
import { createFallbackVectorize } from '../src/db/fallback';

// Tạo D1Database adapter chạy trên SQLite thực tế (node:sqlite DatabaseSync) để kiểm thử toàn diện
function createSqliteD1Adapter(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  function createPreparedStatement(sql: string, boundValues: any[] = []): any {
    return {
      bind(...values: any[]) {
        return createPreparedStatement(sql, values);
      },
      async first<T = any>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...boundValues) as any;
        if (!row) return null;
        if (colName) return row[colName] ?? null;
        return row as T;
      },
      async all<T = any>(): Promise<{ results: T[]; success: boolean; meta: any }> {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...boundValues) as T[];
        return { results: rows, success: true, meta: {} };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const stmt = sqlite.prepare(sql);
        const res = stmt.run(...boundValues);
        return {
          success: true,
          meta: {
            changes: Number(res.changes),
            last_row_id: Number(res.lastInsertRowid),
          },
        };
      },
      _sql: sql,
      _bound: boundValues,
    };
  }

  return {
    prepare(sql: string) {
      return createPreparedStatement(sql);
    },
    async batch(statements: any[]) {
      const results = [];
      for (const st of statements) {
        results.push(await st.run());
      }
      return results;
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 1 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;
}

// Tạo KVNamespace adapter trong bộ nhớ để kiểm thử luồng Upload / Download / Delete ảnh Workers KV
function createMemoryKVAdapter(): KVNamespace {
  const store = new Map<string, { value: ArrayBuffer; metadata?: any }>();

  return {
    async put(key: string, value: string | ArrayBuffer | ArrayBufferView, options?: any) {
      let buf: ArrayBuffer;
      if (typeof value === 'string') {
        buf = new TextEncoder().encode(value).buffer as ArrayBuffer;
      } else if (value instanceof ArrayBuffer) {
        buf = value;
      } else if (ArrayBuffer.isView(value)) {
        buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
      } else {
        buf = new ArrayBuffer(0);
      }
      store.set(key, { value: buf, metadata: options?.metadata });
    },
    async get(key: string, options?: any) {
      const item = store.get(key);
      if (!item) return null;
      const type = typeof options === 'string' ? options : options?.type;
      if (type === 'arrayBuffer') return item.value.slice(0);
      if (type === 'json') return JSON.parse(new TextDecoder().decode(item.value));
      return new TextDecoder().decode(item.value);
    },
    async getWithMetadata(key: string, options?: any) {
      const item = store.get(key);
      if (!item) return { value: null, metadata: null };
      const type = typeof options === 'string' ? options : options?.type;
      let val: any;
      if (type === 'arrayBuffer') val = item.value.slice(0);
      else if (type === 'json') val = JSON.parse(new TextDecoder().decode(item.value));
      else val = new TextDecoder().decode(item.value);
      return { value: val, metadata: item.metadata || null };
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(options?: any) {
      const keys: any[] = [];
      for (const [k, v] of store.entries()) {
        keys.push({ name: k, metadata: v.metadata });
      }
      return { keys, list_complete: true, cursor: '' };
    },
  } as unknown as KVNamespace;
}

describe('AURA COFFEE Full-Stack HonoJS + D1 + Workers KV Integration Suite', () => {
  let env: WorkerEnv;
  let adminCookie = '';
  let createdOrderId = 0;
  let createdOrderCode = '';

  beforeAll(() => {
    const sharedKV = createMemoryKVAdapter();
    env = {
      DB: createSqliteD1Adapter(),
      KV: sharedKV,
      BUCKET: sharedKV as any,
      ENVIRONMENT: 'development',
      DEFAULT_SHIPPING_FEE: '30000',
      FREE_SHIPPING_THRESHOLD: '500000',
      ADMIN_BOOTSTRAP_EMAIL: 'admin@auracoffee.local',
      ADMIN_BOOTSTRAP_PASSWORD: 'StrongPassword#2026',
    };
  });

  it('does not create default production credentials without bootstrap secrets', async () => {
    const productionEnv: WorkerEnv = {
      DB: createSqliteD1Adapter(),
      KV: createMemoryKVAdapter(),
      ENVIRONMENT: 'production',
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await ensureDatabaseInitialized(productionEnv);
      const admin = await productionEnv.DB.prepare(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      ).first<{ count: number }>();
      expect(admin?.count).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        'Database init error:',
        expect.objectContaining({
          message: expect.stringContaining('ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD'),
        })
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('1. Lấy danh sách sản phẩm từ D1 (GET /api/v1/products)', async () => {
    const res = await app.request('/api/v1/products', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.items.length).toBeGreaterThanOrEqual(4);
    const names = json.data.items.map((p: any) => p.name);
    expect(names).toContain('Robusta Buôn Ma Thuột');
    expect(names).toContain('Arabica Cầu Đất');
    expect(names).toContain('Blend Phin Việt');
    expect(names).toContain('Espresso House Blend');
  });

  it('2. Xem chi tiết sản phẩm theo slug (GET /api/v1/products/:slug)', async () => {
    const res = await app.request('/api/v1/products/robusta-buon-ma-thuot', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Robusta Buôn Ma Thuột');
    expect(json.data.price).toBe(145000);
    expect(json.data.sale_price).toBe(129000);
    expect(json.data.stock).toBe(85);
  });

  it('3. Tìm kiếm và lọc sản phẩm theo danh mục & từ khóa', async () => {
    const res = await app.request(
      '/api/v1/products?q=arabica&category=ca-phe-dac-san',
      { method: 'GET' },
      env
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.items.length).toBeGreaterThanOrEqual(1);
    expect(json.data.items[0].slug).toContain('arabica');
  });

  it('4 & 5 & 7. Đặt hàng thành công, chống giả mạo giá từ client và trừ tồn kho chính xác', async () => {
    const orderPayload = {
      idempotency_key: 'idem-key-test-order-001',
      customer_name: 'Trần Minh Quân',
      customer_phone: '0901234567',
      customer_email: 'quan@example.com',
      shipping_address: '123 Nguyễn Huệ',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
      notes: 'Giao giờ hành chính',
      payment_method: 'COD',
      items: [
        {
          product_id: 1, // Robusta Buôn Ma Thuột (sale_price thực tế trong D1 là 129.000₫)
          grind_type: 'Xay pha Phin truyền thống',
          quantity: 2,
          // Thử gửi kèm giá giả mạo 1.000₫ từ client -> Backend phải bỏ qua và tính 129.000₫ * 2 = 258.000₫
          unit_price: 1000,
        },
      ],
    };

    const res = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      },
      env
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.subtotal).toBe(258000); // 129,000 * 2 (không dùng giá 1,000 từ client)
    expect(json.data.shipping_fee).toBe(30000);
    expect(json.data.total).toBe(288000);
    expect(json.data.status).toBe('pending');

    createdOrderId = json.data.id;
    createdOrderCode = json.data.order_code;

    // Kiểm tra tồn kho sản phẩm #1 đã giảm từ 85 xuống 83
    const prodRes = await app.request(
      '/api/v1/products/robusta-buon-ma-thuot',
      { method: 'GET' },
      env
    );
    const prodJson = (await prodRes.json()) as any;
    expect(prodJson.data.stock).toBe(83);
  });

  it('8. Không tạo đơn trùng và không trừ kho 2 lần khi retry cùng idempotency_key', async () => {
    const retryPayload = {
      idempotency_key: 'idem-key-test-order-001',
      customer_name: 'Trần Minh Quân',
      customer_phone: '0901234567',
      shipping_address: '123 Nguyễn Huệ',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
      payment_method: 'COD',
      items: [{ product_id: 1, grind_type: 'Nguyên hạt', quantity: 2 }],
    };

    const res = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryPayload),
      },
      env
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.duplicatePrevented).toBe(true);
    expect(json.data.order_code).toBe(createdOrderCode);

    // Tồn kho vẫn giữ nguyên ở 83
    const prodRes = await app.request(
      '/api/v1/products/robusta-buon-ma-thuot',
      { method: 'GET' },
      env
    );
    const prodJson = (await prodRes.json()) as any;
    expect(prodJson.data.stock).toBe(83);
  });

  it('6. Không thể đặt số lượng vượt tồn kho (409 INSUFFICIENT_STOCK)', async () => {
    // Đặt 25 gói cho 2 dòng cùng sản phẩm #2 (tổng 50 gói < 60 gói) hoặc đặt 2 dòng mỗi dòng 40 gói (tổng 80 gói > 60 gói tồn kho của Arabica Cầu Đất)
    const overStockPayload = {
      idempotency_key: 'idem-key-overstock-002',
      customer_name: 'Lê Thị Hoa',
      customer_phone: '0912345678',
      shipping_address: '45 Lê Lợi',
      province: 'Đà Nẵng',
      district: 'Hải Châu',
      ward: 'Thạch Thang',
      payment_method: 'COD',
      items: [
        { product_id: 2, grind_type: 'Nguyên hạt', quantity: 40 },
        { product_id: 2, grind_type: 'Xay Pour Over / V60', quantity: 35 }, // Tổng 75 > 60 tồn kho
      ],
    };

    const res = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overStockPayload),
      },
      env
    );

    expect(res.status).toBe(409);
    const json = (await res.json()) as any;
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('16. Form validation trả về lỗi tiếng Việt khi số điện thoại sai định dạng', async () => {
    const invalidPayload = {
      idempotency_key: 'idem-key-invalid-003',
      customer_name: 'A',
      customer_phone: '12345', // Sai định dạng SĐT Việt Nam
      shipping_address: '12',
      province: 'Hà Nội',
      district: 'Ba Đình',
      ward: 'Điện Biên',
      payment_method: 'COD',
      items: [{ product_id: 1, grind_type: 'Nguyên hạt', quantity: 1 }],
    };

    const res = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      },
      env
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('10 & 11. Chặn người dùng chưa xác thực truy cập API Admin và Upload KV', async () => {
    const dashRes = await app.request('/api/v1/admin/dashboard', { method: 'GET' }, env);
    expect(dashRes.status).toBe(401);

    const fd = new FormData();
    fd.append('file', new File([new Uint8Array([137, 80, 78, 71])], 'test.png', { type: 'image/png' }));
    const uploadRes = await app.request(
      '/api/v1/admin/uploads',
      { method: 'POST', body: fd },
      env
    );
    expect(uploadRes.status).toBe(401);
  });

  it('9. Admin đăng nhập hợp lệ và nhận HttpOnly Session Cookie', async () => {
    const res = await app.request(
      '/api/v1/admin/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@auracoffee.local',
          password: 'StrongPassword#2026',
        }),
      },
      env
    );

    expect(res.status).toBe(200);
    const setCookieHeader = res.headers.get('set-cookie') || '';
    expect(setCookieHeader).toContain('moc_admin_session=');
    expect(setCookieHeader).toContain('HttpOnly');
    adminCookie = setCookieHeader.split(';')[0];
  });

  it('12. Upload ảnh lên Cloudflare Workers KV thành công và phục vụ qua endpoint media', async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const fd = new FormData();
    fd.append('file', new File([pngBytes], 'arabica-pack.png', { type: 'image/png' }));
    fd.append('folder', 'products');

    const uploadRes = await app.request(
      '/api/v1/admin/uploads',
      {
        method: 'POST',
        headers: { Cookie: adminCookie },
        body: fd,
      },
      env
    );

    expect(uploadRes.status).toBe(201);
    const uploadJson = (await uploadRes.json()) as any;
    expect(uploadJson.success).toBe(true);
    expect(uploadJson.data.key).toContain('products/');

    // Đọc lại ảnh qua endpoint public media
    const mediaRes = await app.request(uploadJson.data.url, { method: 'GET' }, env);
    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers.get('content-type')).toBe('image/png');
  });

  it('13. Tạo sản phẩm mới trong D1 qua Admin API', async () => {
    const newProduct = {
      category_id: 2,
      name: 'Cà Phê Liberica Quảng Trị',
      slug: 'ca-phe-liberica-quang-tri',
      sku: 'MOC-LIB-250',
      origin: 'Hướng Hóa, Quảng Trị',
      roast_level: 'Rang sáng vừa',
      process_method: 'Natural',
      tasting_notes: 'Hương mít chín • Chua thanh • Hậu ngọt',
      short_description: 'Dòng cà phê mít Liberica đặc trưng vùng đất Quảng Trị.',
      description: 'Cà phê Liberica thu hái chín đỏ tại Hướng Hóa, Quảng Trị, rang mộc mẻ nhỏ.',
      price: 195000,
      sale_price: 179000,
      stock: 40,
      weight_grams: 250,
      is_featured: 1,
      is_active: 1,
      image_url: '/images/product-colombia.png',
    };

    const res = await app.request(
      '/api/v1/admin/products',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify(newProduct),
      },
      env
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.slug).toBe('ca-phe-liberica-quang-tri');
    const createdProdId = json.data.id;

    // Test PATCH status (Bật / Tắt trạng thái kinh doanh)
    const toggleOffRes = await app.request(
      `/api/v1/admin/products/${createdProdId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ is_active: 0 }),
      },
      env
    );
    expect(toggleOffRes.status).toBe(200);
    const toggleOffJson = (await toggleOffRes.json()) as any;
    expect(toggleOffJson.data.is_active).toBe(0);

    // Test PUT chỉnh sửa thông tin sản phẩm
    const updateRes = await app.request(
      `/api/v1/admin/products/${createdProdId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          ...newProduct,
          name: 'Cà Phê Liberica Khe Sanh',
          price: 210000,
          is_active: 1,
        }),
      },
      env
    );
    expect(updateRes.status).toBe(200);
    const updateJson = (await updateRes.json()) as any;
    expect(updateJson.data.name).toBe('Cà Phê Liberica Khe Sanh');
    expect(updateJson.data.price).toBe(210000);

    // Test DELETE xóa sản phẩm khỏi database
    const deleteRes = await app.request(
      `/api/v1/admin/products/${createdProdId}`,
      {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
        },
      },
      env
    );
    expect(deleteRes.status).toBe(200);
    const deleteJson = (await deleteRes.json()) as any;
    expect(deleteJson.data.deleted).toBe(true);
  });

  it('14. Admin cập nhật trạng thái đơn hàng hợp lệ và chặn chuyển ngược từ trạng thái cuối', async () => {
    // Chuyển từ pending -> confirmed -> shipped -> delivered
    for (const nextStatus of ['confirmed', 'shipped', 'delivered']) {
      const patchRes = await app.request(
        `/api/v1/admin/orders/${createdOrderId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminCookie,
          },
          body: JSON.stringify({ status: nextStatus, note: `Chuyển sang ${nextStatus}` }),
        },
        env
      );
      expect(patchRes.status).toBe(200);
    }

    // Thử chuyển ngược từ delivered về pending -> Phải bị chặn (400 INVALID_STATUS_TRANSITION)
    const invalidRes = await app.request(
      `/api/v1/admin/orders/${createdOrderId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ status: 'pending' }),
      },
      env
    );
    expect(invalidRes.status).toBe(400);
    const invalidJson = (await invalidRes.json()) as any;
    expect(invalidJson.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('15. Admin Dashboard trả về dữ liệu doanh thu và đơn hàng thực tế từ D1', async () => {
    const res = await app.request(
      '/api/v1/admin/dashboard?days=30',
      {
        method: 'GET',
        headers: { Cookie: adminCookie },
      },
      env
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.summary.totalRevenue).toBe(288000);
    expect(json.data.summary.totalOrders).toBe(1);
    expect(json.data.revenueByDay.length).toBeGreaterThan(0);
    expect(json.data.revenueByDay[0].revenue).toBe(288000);
    expect(json.data.revenueByDay[0].orders).toBe(1);
    expect(json.data.recentOrders[0].order_code).toBe(createdOrderCode);
  });

  it('17. Khách hàng đăng ký tài khoản, tự động đồng bộ đơn hàng cũ theo SĐT và quản lý đơn hàng cá nhân', async () => {
    // Đăng ký tài khoản mới có số điện thoại 0988776655
    // Trước tiên đặt 1 đơn hàng vãng lai bằng SĐT 0988776655
    const guestOrderRes = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: 'idem-key-customer-sync-001',
          customer_name: 'Phạm Hoàng Nam',
          customer_phone: '0988776655',
          customer_email: 'nam.pham@example.com',
          shipping_address: '88 Lý Tự Trọng',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Thành',
          payment_method: 'COD',
          items: [{ product_id: 2, grind_type: 'Nguyên hạt', quantity: 1 }],
        }),
      },
      env
    );
    expect(guestOrderRes.status).toBe(201);
    const guestOrderJson = (await guestOrderRes.json()) as any;
    const guestOrderId = guestOrderJson.data.id;

    // Khách hàng đăng ký tài khoản với cùng SĐT 0988776655
    const regRes = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: 'Phạm Hoàng Nam',
          phone: '0988776655',
          email: 'nam.pham@example.com',
          password: 'Password123',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Thành',
          shipping_address: '88 Lý Tự Trọng',
        }),
      },
      env
    );

    expect(regRes.status).toBe(201);
    const regJson = (await regRes.json()) as any;
    expect(regJson.success).toBe(true);
    expect(regJson.data.user.phone).toBe('0988776655');
    const customerToken = regJson.data.token;

    // Kiểm tra danh sách đơn hàng của tài khoản -> Đơn đặt trước khi đăng ký phải tự động hiển thị!
    const myOrdersRes = await app.request(
      '/api/v1/account/orders',
      {
        method: 'GET',
        headers: { 'X-Customer-Token': customerToken },
      },
      env
    );
    expect(myOrdersRes.status).toBe(200);
    const myOrdersJson = (await myOrdersRes.json()) as any;
    expect(myOrdersJson.success).toBe(true);
    expect(myOrdersJson.data.length).toBe(1);
    expect(myOrdersJson.data[0].id).toBe(guestOrderId);
    expect(myOrdersJson.data[0].items.length).toBe(1);

    // Tra cứu đơn hàng bằng số điện thoại không cần mã đơn
    const trackByPhoneRes = await app.request(
      '/api/v1/orders/track?phone=0988776655',
      { method: 'GET' },
      env
    );
    expect(trackByPhoneRes.status).toBe(200);
    const trackByPhoneJson = (await trackByPhoneRes.json()) as any;
    expect(trackByPhoneJson.data.allOrdersByPhone.length).toBe(1);

    // Khách hàng tự hủy đơn hàng khi đang ở trạng thái pending -> hoàn lại kho
    const cancelRes = await app.request(
      `/api/v1/account/orders/${guestOrderId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Customer-Token': customerToken,
        },
        body: JSON.stringify({ reason: 'Đổi ý muốn chọn loại hạt khác' }),
      },
      env
    );
    expect(cancelRes.status).toBe(200);
    const cancelJson = (await cancelRes.json()) as any;
    expect(cancelJson.data.status).toBe('cancelled');
  });

  it('18. Trợ lý Barista Chatbot tư vấn sản phẩm từ D1 và tra cứu đơn hàng theo SĐT', async () => {
    const catalogRes = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Liệt kê tất cả sản phẩm hiện có trên shop' }),
      },
      env
    );
    expect(catalogRes.status).toBe(200);
    const catalogJson = (await catalogRes.json()) as any;
    expect(catalogJson.data.rag.llmModel).toBe('d1-product-catalog');
    for (const productName of [
      'Robusta Buôn Ma Thuột',
      'Arabica Cầu Đất',
      'Blend Phin Việt',
      'Espresso House Blend',
      'Fine Robusta Honey Đắk Nông',
      'Arabica Sơn La Bourbon',
      'Cold Brew Signature Blend',
      'Hộp Quà Tinh Hoa Cà Phê Việt',
    ]) {
      expect(catalogJson.data.reply).toContain(productName);
    }

    const recRes = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Tư vấn cà phê pha Phin đậm đà' }),
      },
      env
    );
    expect(recRes.status).toBe(200);
    const recJson = (await recRes.json()) as any;
    expect(recJson.success).toBe(true);
    expect(recJson.data.intent).toBe('recommendation');
    expect(recJson.data.recommendedProducts.length).toBeGreaterThanOrEqual(1);

    const orderChatRes = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Kiểm tra đơn hàng SĐT 0988776655' }),
      },
      env
    );
    expect(orderChatRes.status).toBe(200);
    const orderChatJson = (await orderChatRes.json()) as any;
    expect(orderChatJson.success).toBe(true);
    expect(orderChatJson.data.intent).toBe('order_lookup');
    expect(orderChatJson.data.matchedOrders.length).toBe(1);
  });

  it('19. Đăng nhập 1 cổng duy nhất tự động phân quyền Role: Khách hàng bị giới hạn, Admin có Full Option mà không cần đăng nhập lại', async () => {
    // 1. Admin đăng nhập qua cổng chung /api/v1/auth/login
    const adminLoginRes = await app.request(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'admin@auracoffee.local',
          password: 'StrongPassword#2026',
        }),
      },
      env
    );
    expect(adminLoginRes.status).toBe(200);
    const adminLoginJson = (await adminLoginRes.json()) as any;
    expect(adminLoginJson.success).toBe(true);
    expect(adminLoginJson.data.user.role).toBe('admin');
    expect(adminLoginJson.data.isAdmin).toBe(true);

    const unifiedAdminToken = adminLoginJson.data.token;

    // 2. Với token vừa nhận từ cổng đăng nhập chung, Admin lập tức có quyền truy cập API Admin mà KHÔNG cần đăng nhập lại cổng quản trị
    const adminDashRes = await app.request(
      '/api/v1/admin/dashboard',
      {
        method: 'GET',
        headers: {
          'X-Customer-Token': unifiedAdminToken,
        },
      },
      env
    );
    expect(adminDashRes.status).toBe(200);
    const dashJson = (await adminDashRes.json()) as any;
    expect(dashJson.success).toBe(true);
    expect(dashJson.data.summary).toBeDefined();

    // 3. Khách hàng đăng nhập qua cùng cổng /api/v1/auth/login
    const customerLoginRes = await app.request(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: '0988776655',
          password: 'Password123',
        }),
      },
      env
    );
    expect(customerLoginRes.status).toBe(200);
    const custJson = (await customerLoginRes.json()) as any;
    expect(custJson.data.user.role).toBe('customer');
    expect(custJson.data.isAdmin).toBe(false);

    // 4. Token của khách hàng bị từ chối khi truy cập API Admin (401 Unauthorized)
    const unauthorizedRes = await app.request(
      '/api/v1/admin/dashboard',
      {
        method: 'GET',
        headers: {
          'X-Customer-Token': custJson.data.token,
        },
      },
      env
    );
    expect(unauthorizedRes.status).toBe(401);
  });

  it('20. RAG Pipeline (Chunking -> Word Embedding -> Vector DB -> Cloudflare Workers AI LLM) hoạt động chuẩn xác', async () => {
    // 1. Kiểm tra trạng thái Vector DB và số lượng chunks được tự động Chunking & Embedding vào bảng rag_chunks
    const statusRes = await app.request('/api/v1/chat/rag-status', { method: 'GET' }, env);
    expect(statusRes.status).toBe(200);
    const statusJson = (await statusRes.json()) as any;
    expect(statusJson.success).toBe(true);
    expect(statusJson.data.totalChunksIndexed).toBeGreaterThanOrEqual(10);
    expect(statusJson.data.chunks.length).toBeGreaterThanOrEqual(10);

    // 2. Truy vấn về Chính sách & Quyền lợi (nằm trong Knowledge Base mới nâng cấp)
    const policyChatRes = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Cho mình hỏi quyền lợi khách hàng và chính sách đổi trả 7 ngày của AURA COFFEE?',
        }),
      },
      env
    );
    expect(policyChatRes.status).toBe(200);
    const policyJson = (await policyChatRes.json()) as any;
    expect(policyJson.success).toBe(true);
    expect(policyJson.data.rag).toBeDefined();
    expect(policyJson.data.rag.totalChunksIndexed).toBeGreaterThanOrEqual(10);
    expect(policyJson.data.rag.topChunks.length).toBeGreaterThanOrEqual(1);
    expect(policyJson.data.reply).toContain('7 ngày');

    // 3. Kiểm thử tích hợp trực tiếp Cloudflare Workers AI binding (env.AI.run với @cf/baai/bge-m3 & @cf/meta/llama-3.3-70b-instruct-fp8-fast)
    const aiCalls: string[] = [];
    const llmMessages: Array<{ role: string; content: string }> = [];
    const envWithWorkersAI: WorkerEnv = {
      ...env,
      CF_EMBEDDING_MODEL: '@cf/baai/bge-m3',
      CF_LLM_MODEL: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      AI: {
        async run(model: string, input: any) {
          aiCalls.push(model);
          if (model.includes('bge')) {
            const texts: string[] = Array.isArray(input.text) ? input.text : [input.text];
            return {
              data: texts.map(() => Array.from({ length: 64 }, (_, i) => (i === 0 ? 1 : 0.1))),
            };
          }
          llmMessages.push(...input.messages);
          return {
            response:
              'Mình có thể kể một câu đùa nhẹ nhàng để bạn thư giãn: Vì sao chiếc máy pha cà phê luôn bình tĩnh? Vì nó biết cách giữ áp suất!',
          };
        },
      },
    };

    const workersAiChatRes = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Website có những bài viết nào về cà phê, đồng thời shop bán gì?',
        }),
      },
      envWithWorkersAI
    );
    expect(workersAiChatRes.status).toBe(200);
    const workersAiJson = (await workersAiChatRes.json()) as any;
    expect(workersAiJson.success).toBe(true);
    expect(workersAiJson.data.rag.llmModel).toContain('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    expect(workersAiJson.data.reply).toContain('câu đùa nhẹ nhàng');
    expect(llmMessages.at(-1)).toEqual({
      role: 'user',
      content: 'Website có những bài viết nào về cà phê, đồng thời shop bán gì?',
    });
    expect(llmMessages[0].content).toContain('[DANH SÁCH SẢN PHẨM ĐANG HOẠT ĐỘNG TỪ D1]');
    for (const productName of [
      'Robusta Buôn Ma Thuột',
      'Arabica Cầu Đất',
      'Blend Phin Việt',
      'Espresso House Blend',
      'Fine Robusta Honey Đắk Nông',
      'Arabica Sơn La Bourbon',
      'Cold Brew Signature Blend',
      'Hộp Quà Tinh Hoa Cà Phê Việt',
    ]) {
      expect(llmMessages[0].content).toContain(productName);
    }
    expect(llmMessages[0].content).toContain('129.000₫');
    expect(llmMessages[0].content).toContain('[THÔNG TIN CÁC TRANG VÀ NỘI DUNG ĐANG HIỂN THỊ TRÊN WEBSITE]');
    expect(llmMessages[0].content).toContain('[BÀI VIẾT ĐÃ ĐĂNG TRÊN BLOG]');
    expect(llmMessages[0].content).toContain('30.000₫');
    expect(llmMessages[0].content).toContain('500.000₫');
    expect(llmMessages[0].content).toContain('Bí Quyết Pha Cà Phê Phin Ngon');
    expect(aiCalls).toContain('@cf/baai/bge-m3');
    expect(aiCalls).toContain('@cf/meta/llama-3.3-70b-instruct-fp8-fast');

    const productDetailRes = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Mô tả chi tiết sản phẩm Robusta Buôn Ma Thuột giúp mình.' }),
      },
      envWithWorkersAI
    );
    expect(productDetailRes.status).toBe(200);
    const productDetailJson = (await productDetailRes.json()) as any;
    expect(productDetailJson.data.rag.llmModel).toBe('d1-product-lookup');
    expect(productDetailJson.data.reply).toContain('nông hộ canh tác lâu năm');
    expect(productDetailJson.data.reply).toContain('129.000₫');
    expect(aiCalls.filter((model) => !model.includes('bge'))).toHaveLength(1);

    const policyCallsBefore = aiCalls.length;
    const fastPolicyRes = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Phí giao hàng và chính sách đổi trả thế nào?' }),
      },
      envWithWorkersAI
    );
    expect(fastPolicyRes.status).toBe(200);
    const fastPolicyJson = (await fastPolicyRes.json()) as any;
    expect(fastPolicyJson.data.intent).toBe('shipping_policy');
    expect(fastPolicyJson.data.reply).toContain('Phí vận chuyển');
    expect(aiCalls.slice(policyCallsBefore).some((model) => !model.includes('bge'))).toBe(false);

    const geminiFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Đây là câu trả lời tự nhiên từ Gemini.' }] } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', geminiFetch);
    try {
      const geminiChatRes = await app.request(
        '/api/v1/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Hãy kể một chuyện ngắn về buổi sáng.' }),
        },
        { ...env, GEMINI_API_KEY: 'test-gemini-api-key' }
      );
      expect(geminiChatRes.status).toBe(200);
      const geminiJson = (await geminiChatRes.json()) as any;
      expect(geminiJson.data.reply).toBe('Đây là câu trả lời tự nhiên từ Gemini.');
      expect(geminiJson.data.rag.llmModel).toBe('gemini-2.5-flash');
      expect(geminiFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }

    const ollamaFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'qwen2.5:3b',
          message: { role: 'assistant', content: 'Ollama đã trả lời câu hỏi bằng tiếng Việt.' },
          done: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', ollamaFetch);
    try {
      const ollamaChatRes = await app.request(
        '/api/v1/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Hôm nay bạn thế nào?' }),
        },
        {
          ...env,
          OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
          OLLAMA_MODEL: 'qwen2.5:3b',
        }
      );
      expect(ollamaChatRes.status).toBe(200);
      const ollamaJson = (await ollamaChatRes.json()) as any;
      expect(ollamaJson.data.reply).toBe('Ollama đã trả lời câu hỏi bằng tiếng Việt.');
      expect(ollamaJson.data.rag.llmModel).toBe('ollama/qwen2.5:3b');
      expect(ollamaFetch).toHaveBeenCalledOnce();
      expect(ollamaFetch.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/chat');
      const ollamaPayload = JSON.parse(ollamaFetch.mock.calls[0][1].body as string);
      expect(ollamaPayload.model).toBe('qwen2.5:3b');
      expect(ollamaPayload.stream).toBe(false);
      expect(ollamaPayload.options.num_predict).toBe(120);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
