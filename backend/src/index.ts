import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { ensureDatabaseInitialized, type WorkerEnv } from './db/init';
import { createFallbackD1, createFallbackKV, createFallbackVectorize } from './db/fallback';
import { ok, fail } from './utils/response';
import { generateRandomHex, sha256Hex, hashPassword, verifyPassword } from './utils/crypto';
import { handleBaristaChat } from './utils/chatbot';
import {
  indexKnowledgeBaseToVectorDB,
  searchVectorDB,
  DEFAULT_CF_EMBEDDING_MODEL,
  DEFAULT_CF_LLM_MODEL,
} from './utils/rag';
import {
  SESSION_COOKIE_NAME,
  CUSTOMER_COOKIE_NAME,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  clearLoginAttempts,
  requireAdminAuth,
  getAuthenticatedAdmin,
  requireCustomerAuth,
  getAuthenticatedCustomer,
} from './middleware/auth';
import {
  createOrderSchema,
  newsletterSchema,
  adminLoginSchema,
  productFormSchema,
  categoryFormSchema,
  updateOrderStatusSchema,
  customerRegisterSchema,
  customerLoginSchema,
  customerProfileSchema,
  customerPasswordSchema,
} from '../shared/validators';
import { isValidOrderTransition } from '../shared/constants';
import type { AdminUser, CustomerUser, OrderStatus, Product, Order } from '../shared/types';

type AppVariables = {
  adminUser: AdminUser;
  customerUser: CustomerUser;
};

export const app = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

// Global CORS & Security Headers cho API
app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Idempotency-Key',
      'X-Customer-Token',
    ],
    credentials: true,
  })
);

const fallbackD1 = createFallbackD1();
const fallbackKV = createFallbackKV();
const fallbackVectorize = createFallbackVectorize();

// Khởi tạo D1 schema & dữ liệu mẫu môi trường dev (hoặc fallback nếu chưa gắn binding trên Cloudflare Pages)
app.use('/api/*', async (c, next) => {
  if (!c.env.DB) {
    (c.env as any).DB = fallbackD1;
  } else {
    await ensureDatabaseInitialized(c.env);
  }
  if (!c.env.BUCKET) {
    (c.env as any).KV = fallbackKV;
    (c.env as any).BUCKET = fallbackKV;
  }
  await next();
});

// Middleware xử lý lỗi tập trung (không lộ stack trace trong production)
app.onError((err, c) => {
  const isProd = c.env.ENVIRONMENT === 'production';
  console.error('[API Error]:', err.message);
  return fail(
    c,
    'INTERNAL_SERVER_ERROR',
    isProd ? 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' : err.message || 'Lỗi máy chủ',
    500
  );
});

// ============================================================================
// PUBLIC APIs (/api/v1/*)
// ============================================================================

// 1. Health Check
app.get('/api/v1/health', async (c) => {
  const dbCheck = await c.env.DB.prepare('SELECT 1 as ok').first<{ ok: number }>();
  return ok(c, {
    status: 'healthy',
    service: 'AURA COFFEE API (HonoJS on Cloudflare Workers)',
    d1Connected: dbCheck?.ok === 1,
    kvConnected: Boolean(c.env.KV),
    vectorizeConnected: Boolean(c.env.VECTORIZE),
    r2Connected: Boolean(c.env.KV || c.env.BUCKET),
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// 2. Danh sách danh mục
app.get('/api/v1/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.*,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) as product_count
     FROM categories c
     WHERE c.is_active = 1
     ORDER BY c.sort_order ASC, c.id ASC`
  ).all();
  return ok(c, results);
});

// 3. Chi tiết danh mục theo slug
app.get('/api/v1/categories/:slug', async (c) => {
  const slug = c.req.param('slug').trim().toLowerCase();
  const category = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE slug = ? AND is_active = 1'
  )
    .bind(slug)
    .first();

  if (!category) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy danh mục sản phẩm.', 404);
  }

  const { results: products } = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.category_id = ? AND p.is_active = 1
     ORDER BY p.is_featured DESC, p.id ASC`
  )
    .bind((category as any).id)
    .all();

  return ok(c, { category, products });
});

// 4. Sản phẩm nổi bật
app.get('/api/v1/products/featured', async (c) => {
  const limit = Math.min(12, Math.max(1, Number(c.req.query('limit')) || 4));
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1 AND p.is_featured = 1
     ORDER BY p.id ASC
     LIMIT ?`
  )
    .bind(limit)
    .all();

  return ok(c, results);
});

// 5. Tìm kiếm sản phẩm nhanh
app.get('/api/v1/products/search', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  if (!q) {
    return ok(c, []);
  }
  const pattern = `%${q}%`;
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1
       AND (LOWER(p.name) LIKE ? OR LOWER(p.origin) LIKE ? OR LOWER(p.tasting_notes) LIKE ? OR LOWER(p.sku) LIKE ?)
     ORDER BY p.is_featured DESC, p.id ASC
     LIMIT 20`
  )
    .bind(pattern, pattern, pattern, pattern)
    .all();

  return ok(c, results);
});

// 6. Danh sách sản phẩm (hỗ trợ phân trang, tìm kiếm, lọc danh mục, lọc giá, lọc tồn kho, sắp xếp)
app.get('/api/v1/products', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(48, Math.max(1, Number(c.req.query('limit')) || 12));
  const offset = (page - 1) * limit;

  const q = (c.req.query('q') || c.req.query('search') || '').trim().toLowerCase();
  const category = (c.req.query('category') || '').trim();
  const minPrice = c.req.query('minPrice') ? Number(c.req.query('minPrice')) : undefined;
  const maxPrice = c.req.query('maxPrice') ? Number(c.req.query('maxPrice')) : undefined;
  const inStock = c.req.query('inStock');
  const sort = c.req.query('sort') || 'featured';

  let whereClause = 'WHERE p.is_active = 1';
  const bindParams: (string | number)[] = [];

  if (q) {
    whereClause +=
      ' AND (LOWER(p.name) LIKE ? OR LOWER(p.origin) LIKE ? OR LOWER(p.tasting_notes) LIKE ?)';
    const pattern = `%${q}%`;
    bindParams.push(pattern, pattern, pattern);
  }

  if (category && category !== 'all') {
    if (/^\d+$/.test(category)) {
      whereClause += ' AND p.category_id = ?';
      bindParams.push(Number(category));
    } else {
      whereClause += ' AND c.slug = ?';
      bindParams.push(category.toLowerCase());
    }
  }

  if (minPrice !== undefined && !Number.isNaN(minPrice)) {
    whereClause += ' AND COALESCE(p.sale_price, p.price) >= ?';
    bindParams.push(minPrice);
  }

  if (maxPrice !== undefined && !Number.isNaN(maxPrice)) {
    whereClause += ' AND COALESCE(p.sale_price, p.price) <= ?';
    bindParams.push(maxPrice);
  }

  if (inStock === 'true' || inStock === '1') {
    whereClause += ' AND p.stock > 0';
  }

  let orderBy = 'ORDER BY p.is_featured DESC, p.id ASC';
  if (sort === 'price_asc') {
    orderBy = 'ORDER BY COALESCE(p.sale_price, p.price) ASC';
  } else if (sort === 'price_desc') {
    orderBy = 'ORDER BY COALESCE(p.sale_price, p.price) DESC';
  } else if (sort === 'newest') {
    orderBy = 'ORDER BY p.created_at DESC, p.id DESC';
  } else if (sort === 'rating') {
    orderBy = 'ORDER BY p.rating_avg DESC, p.reviews_count DESC';
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereClause}`
  )
    .bind(...bindParams)
    .first<{ total: number }>();

  const total = countRow?.total ?? 0;

  const { results } = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereClause}
     ${orderBy}
     LIMIT ? OFFSET ?`
  )
    .bind(...bindParams, limit, offset)
    .all();

  return ok(c, {
    items: results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

// 7. Chi tiết sản phẩm theo slug
app.get('/api/v1/products/:slug', async (c) => {
  const slug = c.req.param('slug').trim().toLowerCase();
  const product = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ? AND p.is_active = 1`
  )
    .bind(slug)
    .first<Product>();

  if (!product) {
    return fail(c, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.', 404);
  }

  const [{ results: variants }, { results: images }, { results: related }, { results: reviews }] =
    await Promise.all([
      c.env.DB.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1')
        .bind(product.id)
        .all(),
      c.env.DB.prepare(
        'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC'
      )
        .bind(product.id)
        .all(),
      c.env.DB.prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1 AND p.id != ?
         ORDER BY CASE WHEN p.category_id = ? THEN 0 ELSE 1 END, p.is_featured DESC
         LIMIT 4`
      )
        .bind(product.id, product.category_id)
        .all(),
      c.env.DB.prepare(
        'SELECT * FROM reviews WHERE (product_id = ? OR product_id IS NULL) AND is_approved = 1 ORDER BY id DESC LIMIT 6'
      )
        .bind(product.id)
        .all(),
    ]);

  return ok(c, {
    ...product,
    variants,
    images,
    relatedProducts: related,
    reviews,
  });
});

// 8. Banners & Nội dung trang chủ
app.get('/api/v1/banners', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
  ).all();
  return ok(c, results);
});

app.get('/api/v1/content/home', async (c) => {
  const [bannersRes, contentRes, featuredRes, categoriesRes, reviewsRes, blogRes] =
    await Promise.all([
      c.env.DB.prepare('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC').all(),
      c.env.DB.prepare('SELECT * FROM site_content').all(),
      c.env.DB.prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1 AND p.is_featured = 1
         ORDER BY p.id ASC
         LIMIT 4`
      ).all(),
      c.env.DB.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC').all(),
      c.env.DB.prepare('SELECT * FROM reviews WHERE is_approved = 1 ORDER BY id DESC LIMIT 3').all(),
      c.env.DB.prepare(
        'SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY id ASC LIMIT 3'
      ).all(),
    ]);

  const contentMap: Record<string, any> = {};
  for (const row of contentRes.results as any[]) {
    let parsed = {};
    try {
      parsed = JSON.parse(row.content_json || '{}');
    } catch {
      parsed = {};
    }
    contentMap[row.section_key] = {
      title: row.title,
      subtitle: row.subtitle,
      ...parsed,
    };
  }

  return ok(c, {
    banners: bannersRes.results,
    content: contentMap,
    featuredProducts: featuredRes.results,
    categories: categoriesRes.results,
    reviews: reviewsRes.results,
    blogPosts: blogRes.results,
    shippingConfig: {
      defaultFee: Number(contentMap.shipping_config?.defaultFee ?? c.env.DEFAULT_SHIPPING_FEE ?? 30000),
      freeThreshold: Number(
        contentMap.shipping_config?.freeThreshold ?? c.env.FREE_SHIPPING_THRESHOLD ?? 500000
      ),
    },
  });
});

// 9. Đánh giá khách hàng & Blog
app.get('/api/v1/reviews', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM reviews WHERE is_approved = 1 ORDER BY id DESC LIMIT 12'
  ).all();
  return ok(c, results);
});

app.get('/api/v1/blog', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY id ASC'
  ).all();
  return ok(c, results);
});

app.get('/api/v1/blog/:slug', async (c) => {
  const slug = c.req.param('slug').trim().toLowerCase();
  const post = await c.env.DB.prepare(
    'SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1'
  )
    .bind(slug)
    .first();

  if (!post) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy bài viết.', 404);
  }
  return ok(c, post);
});

// 10. Đặt hàng & Quản lý tồn kho an toàn (POST /api/v1/orders)
app.post('/api/v1/orders', async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return fail(c, 'INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
  }

  const parsed = createOrderSchema.safeParse(rawBody);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstMsg =
      Object.values(fieldErrors).flat()[0] || 'Thông tin đặt hàng chưa hợp lệ. Vui lòng kiểm tra lại.';
    return fail(c, 'VALIDATION_ERROR', firstMsg, 400, fieldErrors as Record<string, string[]>);
  }

  const data = parsed.data;

  // 1. Kiểm tra Idempotency Key để chống tạo đơn trùng khi khách bấm nhiều lần hoặc mạng retry
  const existingOrder = await c.env.DB.prepare(
    'SELECT * FROM orders WHERE idempotency_key = ?'
  )
    .bind(data.idempotency_key)
    .first<Order>();

  if (existingOrder) {
    const { results: existingItems } = await c.env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    )
      .bind(existingOrder.id)
      .all();
    return ok(
      c,
      { ...existingOrder, items: existingItems, duplicatePrevented: true },
      'Đơn hàng đã được ghi nhận trước đó.',
      200
    );
  }

  // 2. Gom nhóm số lượng theo product_id để kiểm tra tồn kho chính xác
  const requestedByProduct = new Map<number, number>();
  for (const item of data.items) {
    requestedByProduct.set(
      item.product_id,
      (requestedByProduct.get(item.product_id) || 0) + item.quantity
    );
  }

  const productIds = Array.from(requestedByProduct.keys());
  const placeholders = productIds.map(() => '?').join(', ');
  const { results: dbProducts } = await c.env.DB.prepare(
    `SELECT * FROM products WHERE id IN (${placeholders})`
  )
    .bind(...productIds)
    .all<Product>();

  const productMap = new Map<number, Product>();
  for (const p of dbProducts) {
    productMap.set(p.id, p);
  }

  // 3. Kiểm tra sản phẩm hợp lệ, đang kinh doanh và đủ tồn kho; tính lại giá tại Backend
  let subtotal = 0;
  const preparedItems: {
    product: Product;
    grind_type: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[] = [];

  for (const item of data.items) {
    const product = productMap.get(item.product_id);
    if (!product || !product.is_active) {
      return fail(
        c,
        'PRODUCT_UNAVAILABLE',
        `Sản phẩm (ID #${item.product_id}) không tồn tại hoặc đã ngừng kinh doanh.`,
        400
      );
    }

    const totalQtyForProduct = requestedByProduct.get(product.id) || 0;
    if (product.stock < totalQtyForProduct) {
      return fail(
        c,
        'INSUFFICIENT_STOCK',
        `Sản phẩm "${product.name}" chỉ còn ${product.stock} gói trong kho (bạn đang chọn ${totalQtyForProduct} gói).`,
        409
      );
    }

    // Luôn lấy giá thực tế từ D1 (ưu tiên sale_price nếu hợp lệ)
    const unitPrice =
      product.sale_price && product.sale_price > 0 && product.sale_price < product.price
        ? product.sale_price
        : product.price;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;

    preparedItems.push({
      product,
      grind_type: item.grind_type || 'Nguyên hạt',
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }

  // 4. Tính phí vận chuyển từ cấu hình hệ thống
  const shippingConfigRow = await c.env.DB.prepare(
    "SELECT content_json FROM site_content WHERE section_key = 'shipping_config'"
  ).first<{ content_json: string }>();

  let defaultFee = Number(c.env.DEFAULT_SHIPPING_FEE ?? 30000);
  let freeThreshold = Number(c.env.FREE_SHIPPING_THRESHOLD ?? 500000);
  if (shippingConfigRow?.content_json) {
    try {
      const cfg = JSON.parse(shippingConfigRow.content_json);
      if (typeof cfg.defaultFee === 'number') defaultFee = cfg.defaultFee;
      if (typeof cfg.freeThreshold === 'number') freeThreshold = cfg.freeThreshold;
    } catch {
      // giữ mặc định
    }
  }

  const shippingFee = subtotal >= freeThreshold ? 0 : defaultFee;
  const total = subtotal + shippingFee;

  // 5. Tạo mã đơn hàng duy nhất (VD: MOC-261019-4829)
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderCode = `MOC-${datePart}-${randomSuffix}`;

  // 6. Trừ tồn kho có điều kiện (UPDATE ... WHERE id = ? AND stock >= ?)
  const deductedProducts: { productId: number; qty: number }[] = [];
  for (const [productId, totalQty] of requestedByProduct.entries()) {
    const deductRes = await c.env.DB.prepare(
      `UPDATE products
       SET stock = stock - ?, updated_at = datetime('now')
       WHERE id = ? AND is_active = 1 AND stock >= ?`
    )
      .bind(totalQty, productId, totalQty)
      .run();

    if (!deductRes.meta.changes || deductRes.meta.changes === 0) {
      // Hoàn lại tồn kho cho các sản phẩm đã trừ trước đó nếu xảy ra tranh chấp đồng thời
      for (const prev of deductedProducts) {
        await c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
          .bind(prev.qty, prev.productId)
          .run();
      }
      const prodName = productMap.get(productId)?.name || `#${productId}`;
      return fail(
        c,
        'INSUFFICIENT_STOCK',
        `Sản phẩm "${prodName}" vừa hết hàng hoặc không đủ số lượng trong kho.`,
        409
      );
    }
    deductedProducts.push({ productId, qty: totalQty });
  }

  // 7. Ghi nhận đơn hàng, chi tiết đơn hàng, lịch sử trạng thái và biến động kho
  try {
    // Liên kết đơn hàng với tài khoản khách hàng (nếu đang đăng nhập hoặc khớp SĐT / Email)
    const loggedInCustomer = await getAuthenticatedCustomer(c);
    let linkedUserId: number | null = loggedInCustomer?.id ?? null;

    if (!linkedUserId) {
      const matchedUser = await c.env.DB.prepare(
        'SELECT id FROM users WHERE phone = ? OR LOWER(email) = ?'
      )
        .bind(data.customer_phone, (data.customer_email || '').toLowerCase())
        .first<{ id: number }>();
      if (matchedUser?.id) {
        linkedUserId = matchedUser.id;
      }
    }

    const orderInsert = await c.env.DB.prepare(
      `INSERT INTO orders (
        user_id, order_code, idempotency_key, customer_name, customer_phone, customer_email,
        shipping_address, province, district, ward, notes,
        payment_method, payment_status, status,
        subtotal, shipping_fee, discount_amount, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 'pending', ?, ?, 0, ?)`
    )
      .bind(
        linkedUserId,
        orderCode,
        data.idempotency_key,
        data.customer_name,
        data.customer_phone,
        data.customer_email || null,
        data.shipping_address,
        data.province,
        data.district,
        data.ward,
        data.notes || null,
        data.payment_method,
        subtotal,
        shippingFee,
        total
      )
      .run();

    const orderId = Number(orderInsert.meta.last_row_id);

    const followUpStatements: D1PreparedStatement[] = [];

    for (const item of preparedItems) {
      followUpStatements.push(
        c.env.DB.prepare(
          `INSERT INTO order_items (
            order_id, product_id, product_name_snapshot, sku_snapshot,
            variant_name_snapshot, grind_type, unit_price, quantity, line_total, image_url_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          orderId,
          item.product.id,
          item.product.name,
          item.product.sku,
          `Gói ${item.product.weight_grams}g`,
          item.grind_type,
          item.unit_price,
          item.quantity,
          item.line_total,
          item.product.image_url
        )
      );
    }

    for (const [productId, totalQty] of requestedByProduct.entries()) {
      const prod = productMap.get(productId)!;
      followUpStatements.push(
        c.env.DB.prepare(
          `INSERT INTO inventory_movements (
            product_id, order_id, change_amount, previous_stock, new_stock, reason, note, created_by
          ) VALUES (?, ?, ?, ?, ?, 'order_placed', ?, 'customer_checkout')`
        ).bind(
          productId,
          orderId,
          -totalQty,
          prod.stock,
          prod.stock - totalQty,
          `Đặt hàng ${orderCode}`
        )
      );
    }

    followUpStatements.push(
      c.env.DB.prepare(
        `INSERT INTO order_status_history (order_id, previous_status, new_status, note, changed_by)
         VALUES (?, NULL, 'pending', 'Khách hàng tạo đơn hàng mới', 'customer')`
      ).bind(orderId)
    );

    await c.env.DB.batch(followUpStatements);

    const createdOrder = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
      .bind(orderId)
      .first<Order>();
    const { results: createdItems } = await c.env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    )
      .bind(orderId)
      .all();

    return ok(
      c,
      {
        ...createdOrder,
        items: createdItems,
      },
      'Đặt hàng thành công! Cảm ơn bạn đã lựa chọn AURA COFFEE.',
      201
    );
  } catch (err) {
    // Rollback tồn kho nếu việc tạo bản ghi đơn hàng gặp sự cố
    for (const prev of deductedProducts) {
      await c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
        .bind(prev.qty, prev.productId)
        .run();
    }
    throw err;
  }
});

// 11. Tra cứu đơn hàng theo Mã đơn hàng hoặc Số điện thoại (GET /api/v1/orders/track?code=...&phone=...)
app.get('/api/v1/orders/track', async (c) => {
  const code = (c.req.query('code') || '').trim().toUpperCase();
  const phone = (c.req.query('phone') || '').trim();

  if (!code && !phone) {
    return fail(
      c,
      'MISSING_QUERY',
      'Vui lòng nhập Mã đơn hàng (VD: MOC-261019-1234) hoặc Số điện thoại đặt hàng.',
      400
    );
  }

  // Nếu người dùng chỉ nhập Số điện thoại (không nhập mã đơn), trả về đơn mới nhất kèm danh sách đơn của SĐT đó
  if (!code && phone) {
    const { results: phoneOrders } = await c.env.DB.prepare(
      'SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC, id DESC LIMIT 20'
    )
      .bind(phone)
      .all<Order>();

    if (!phoneOrders.length) {
      return fail(
        c,
        'ORDER_NOT_FOUND',
        `Không tìm thấy đơn hàng nào được đặt với số điện thoại ${phone}.`,
        404
      );
    }

    const enrichedOrders = await Promise.all(
      phoneOrders.map(async (ord) => {
        const [{ results: items }, { results: history }] = await Promise.all([
          c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(ord.id).all(),
          c.env.DB.prepare(
            'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC, id DESC'
          )
            .bind(ord.id)
            .all(),
        ]);
        return { ...ord, items, history };
      })
    );

    return ok(c, {
      ...enrichedOrders[0],
      allOrdersByPhone: enrichedOrders,
    });
  }

  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE UPPER(order_code) = ?')
    .bind(code)
    .first<Order>();

  if (!order) {
    return fail(
      c,
      'ORDER_NOT_FOUND',
      'Không tìm thấy đơn hàng với mã này. Bạn cũng có thể nhập Số điện thoại đặt hàng để tìm tất cả đơn.',
      404
    );
  }

  // Nếu người dùng truyền số điện thoại, kiểm tra khớp 4 số cuối hoặc toàn bộ số điện thoại
  if (phone && !order.customer_phone.endsWith(phone.slice(-4))) {
    return fail(
      c,
      'PHONE_MISMATCH',
      'Số điện thoại không khớp với thông tin đơn hàng.',
      403
    );
  }

  const [{ results: items }, { results: history }] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(order.id).all(),
    c.env.DB.prepare(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC, id DESC'
    )
      .bind(order.id)
      .all(),
  ]);

  const maskedPhone =
    phone === order.customer_phone
      ? order.customer_phone
      : order.customer_phone.slice(0, 3) + '****' + order.customer_phone.slice(-3);

  return ok(c, {
    ...order,
    customer_phone: maskedPhone,
    items,
    history,
  });
});

// Đồng bộ đơn hàng dự phòng giữa trình duyệt khách hàng và Worker (POST /api/v1/orders/sync)
app.post('/api/v1/orders/sync', async (c) => {
  const body = await c.req.json().catch(() => ({ orders: [] }));
  const incomingOrders = Array.isArray(body?.orders) ? (body.orders as Order[]) : [];
  let syncedCount = 0;

  for (const ord of incomingOrders.slice(0, 20)) {
    if (!ord?.order_code || !ord?.customer_phone) continue;
    const code = String(ord.order_code).trim().toUpperCase();
    const existing = await c.env.DB.prepare('SELECT * FROM orders WHERE UPPER(order_code) = ?')
      .bind(code)
      .first<{ id: number }>();

    if (!existing) {
      const ins = await c.env.DB.prepare(
        `INSERT INTO orders (
          user_id, order_code, idempotency_key, customer_name, customer_phone, customer_email,
          shipping_address, province, district, ward, notes,
          payment_method, payment_status, status,
          subtotal, shipping_fee, discount_amount, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 'pending', ?, ?, 0, ?)`
      )
        .bind(
          ord.user_id ?? null,
          code,
          ord.idempotency_key || `sync-${code}`,
          ord.customer_name || 'Khách hàng',
          ord.customer_phone,
          ord.customer_email || null,
          ord.shipping_address || '',
          ord.province || 'TP. Hồ Chí Minh',
          ord.district || '',
          ord.ward || '',
          ord.notes || null,
          ord.payment_method || 'COD',
          Number(ord.subtotal) || 0,
          Number(ord.shipping_fee) || 0,
          Number(ord.total) || 0
        )
        .run();

      const newOrderId = Number(ins.meta.last_row_id);
      if (Array.isArray(ord.items)) {
        for (const item of ord.items) {
          await c.env.DB.prepare(
            `INSERT INTO order_items (
              order_id, product_id, product_name_snapshot, sku_snapshot,
              variant_name_snapshot, grind_type, unit_price, quantity, line_total, image_url_snapshot
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              newOrderId,
              item.product_id || 1,
              item.product_name_snapshot || 'Cà phê AURA COFFEE',
              item.sku_snapshot || 'MOC-250',
              item.variant_name_snapshot || 'Gói 250g',
              item.grind_type || 'Nguyên hạt',
              Number(item.unit_price) || 0,
              Number(item.quantity) || 1,
              Number(item.line_total) || 0,
              item.image_url_snapshot || '/images/product-house-blend.png'
            )
            .run();
        }
      }
      await c.env.DB.prepare(
        `INSERT INTO order_status_history (order_id, previous_status, new_status, note, changed_by)
         VALUES (?, NULL, ?, 'Đồng bộ đơn hàng của khách hàng', 'customer')`
      )
        .bind(newOrderId, ord.status || 'pending')
        .run();
      syncedCount++;
    }
  }

  return ok(c, { syncedCount });
});

// 13. Trợ lý Barista Chatbot thông minh (POST /api/v1/chat)
app.post('/api/v1/chat', async (c) => {
  let body: { message?: string; history?: any[] } = {};
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 'INVALID_JSON', 'Dữ liệu tin nhắn không hợp lệ.', 400);
  }

  const rawMessage = (body.message || '').trim();
  if (!rawMessage) {
    return fail(c, 'EMPTY_MESSAGE', 'Vui lòng nhập nội dung câu hỏi cho Barista.', 400);
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const chatRes = await handleBaristaChat(c, rawMessage, history);
  return ok(c, chatRes);
});

// 13b. Xem trạng thái RAG Vector DB & danh sách Chunks đã được nhúng (GET /api/v1/chat/rag-status)
app.get('/api/v1/chat/rag-status', async (c) => {
  const { results: products } = await c.env.DB.prepare(
    'SELECT * FROM products WHERE is_active = 1 ORDER BY is_featured DESC, id ASC'
  ).all<Product>();

  const status = await indexKnowledgeBaseToVectorDB(c.env, products, false);
  const { results: chunks } = await c.env.DB.prepare(
    'SELECT id, chunk_key, category, title, content, product_slug, embedding_model, embedding_dim, updated_at FROM rag_chunks'
  ).all();

  return ok(c, {
    pipeline: 'Chunking -> Word Embedding -> Vector DB -> Workers AI LLM',
    embeddingModel: c.env.CF_EMBEDDING_MODEL || DEFAULT_CF_EMBEDDING_MODEL,
    llmModel: c.env.CF_LLM_MODEL || DEFAULT_CF_LLM_MODEL,
    workersAiConnected: Boolean(c.env.AI),
    vectorBackend: status.vectorBackend,
    totalChunksIndexed: chunks.length,
    chunks,
  });
});

// 13c. Admin/Dev kích hoạt Re-index toàn bộ Knowledge Base + Sản phẩm vào Vector DB (POST /api/v1/chat/rag-index)
app.post('/api/v1/chat/rag-index', async (c) => {
  const { results: products } = await c.env.DB.prepare(
    'SELECT * FROM products WHERE is_active = 1 ORDER BY is_featured DESC, id ASC'
  ).all<Product>();

  const indexed = await indexKnowledgeBaseToVectorDB(c.env, products, true);
  return ok(
    c,
    indexed,
    `Đã thực hiện Chunking, Word Embedding (${indexed.embeddingModel}) và lưu ${indexed.totalChunks} chunks vào Vector DB.`
  );
});

// ============================================================================
// CUSTOMER ACCOUNT APIs (/api/v1/auth/* & /api/v1/account/*)
// ============================================================================

// Đăng ký tài khoản khách hàng (POST /api/v1/auth/register)
app.post('/api/v1/auth/register', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 'INVALID_JSON', 'Dữ liệu gửi lên không hợp lệ.', 400);
  }

  const parsed = customerRegisterSchema.safeParse(body);
  if (!parsed.success) {
    const firstMsg =
      parsed.error.issues[0]?.message || 'Thông tin đăng ký chưa hợp lệ. Vui lòng kiểm tra lại.';
    return fail(c, 'VALIDATION_ERROR', firstMsg, 400);
  }

  const d = parsed.data;
  const emailLower = d.email.toLowerCase();
  const phoneClean = d.phone.trim();

  const existing = await c.env.DB.prepare(
    'SELECT id, email, phone FROM users WHERE LOWER(email) = ? OR phone = ?'
  )
    .bind(emailLower, phoneClean)
    .first<{ id: number; email: string; phone: string }>();

  if (existing) {
    const isEmailDup = existing.email?.toLowerCase() === emailLower;
    return fail(
      c,
      'DUPLICATE_ACCOUNT',
      isEmailDup
        ? 'Địa chỉ email này đã được đăng ký. Vui lòng đăng nhập.'
        : 'Số điện thoại này đã được đăng ký tài khoản. Vui lòng đăng nhập.',
      409
    );
  }

  const { hash, salt } = await hashPassword(d.password);
  const insertRes = await c.env.DB.prepare(
    `INSERT INTO users (
      email, phone, full_name, password_hash, password_salt, role,
      province, district, ward, shipping_address, is_active
    ) VALUES (?, ?, ?, ?, ?, 'customer', ?, ?, ?, ?, 1)`
  )
    .bind(
      emailLower,
      phoneClean,
      d.full_name,
      hash,
      salt,
      d.province || 'TP. Hồ Chí Minh',
      d.district || '',
      d.ward || '',
      d.shipping_address || ''
    )
    .run();

  const userId = Number(insertRes.meta.last_row_id);

  // Tự động liên kết tất cả đơn hàng đã đặt trước đó có cùng Số điện thoại hoặc Email vào tài khoản mới
  await c.env.DB.prepare(
    `UPDATE orders SET user_id = ?
     WHERE user_id IS NULL AND (customer_phone = ? OR LOWER(customer_email) = ?)`
  )
    .bind(userId, phoneClean, emailLower)
    .run();

  const rawToken = generateRandomHex(32);
  const tokenHash = await sha256Hex(rawToken);
  const csrfToken = generateRandomHex(16);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  const clientIp =
    c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';

  await c.env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, csrf_token, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      tokenHash,
      userId,
      csrfToken,
      clientIp,
      (c.req.header('User-Agent') || '').slice(0, 200),
      expiresAt
    )
    .run();

  const isProd = c.env.ENVIRONMENT === 'production';
  setCookie(c, CUSTOMER_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  const user: CustomerUser = {
    id: userId,
    email: emailLower,
    phone: phoneClean,
    full_name: d.full_name,
    role: 'customer',
    province: d.province || 'TP. Hồ Chí Minh',
    district: d.district || '',
    ward: d.ward || '',
    shipping_address: d.shipping_address || '',
  };

  return ok(
    c,
    { user, token: rawToken },
    'Đăng ký tài khoản thành công! Các đơn hàng trùng số điện thoại của bạn đã được đồng bộ.',
    201
  );
});

// Đăng nhập tài khoản khách hàng bằng Email hoặc Số điện thoại (POST /api/v1/auth/login)
app.post('/api/v1/auth/login', async (c) => {
  const clientIp =
    c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';

  const rateCheck = checkLoginRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return fail(
      c,
      'TOO_MANY_REQUESTS',
      `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${rateCheck.retryAfterSec} giây.`,
      429
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 'INVALID_JSON', 'Dữ liệu đăng nhập không hợp lệ.', 400);
  }

  const parsed = customerLoginSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      c,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Vui lòng nhập Email/Số điện thoại và mật khẩu.',
      400
    );
  }

  const identifier = parsed.data.identifier.trim();
  const userRow = await c.env.DB.prepare(
    'SELECT * FROM users WHERE (LOWER(email) = ? OR phone = ?) AND is_active = 1'
  )
    .bind(identifier.toLowerCase(), identifier)
    .first<{
      id: number;
      email: string;
      phone: string;
      full_name: string;
      password_hash: string;
      password_salt: string;
      role: 'customer' | 'admin' | 'staff';
      province: string;
      district: string;
      ward: string;
      shipping_address: string;
      created_at: string;
    }>();

  if (!userRow) {
    recordFailedLoginAttempt(clientIp);
    return fail(c, 'INVALID_CREDENTIALS', 'Email/Số điện thoại hoặc mật khẩu không chính xác.', 401);
  }

  const isValidPassword = await verifyPassword(
    parsed.data.password,
    userRow.password_hash,
    userRow.password_salt
  );

  if (!isValidPassword) {
    recordFailedLoginAttempt(clientIp);
    return fail(c, 'INVALID_CREDENTIALS', 'Email/Số điện thoại hoặc mật khẩu không chính xác.', 401);
  }

  clearLoginAttempts(clientIp);

  // Tự động đồng bộ các đơn hàng có cùng SĐT hoặc Email vào tài khoản
  await c.env.DB.prepare(
    `UPDATE orders SET user_id = ?
     WHERE user_id IS NULL AND (customer_phone = ? OR LOWER(customer_email) = ?)`
  )
    .bind(userRow.id, userRow.phone || '', userRow.email.toLowerCase())
    .run();

  const rawToken = generateRandomHex(32);
  const tokenHash = await sha256Hex(rawToken);
  const csrfToken = generateRandomHex(16);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO sessions (token_hash, user_id, csrf_token, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      tokenHash,
      userRow.id,
      csrfToken,
      clientIp,
      (c.req.header('User-Agent') || '').slice(0, 200),
      expiresAt
    ),
    c.env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(
      userRow.id
    ),
  ]);

  const isProd = c.env.ENVIRONMENT === 'production';
  setCookie(c, CUSTOMER_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  if (userRow.role === 'admin' || userRow.role === 'staff') {
    setCookie(c, SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  const user: CustomerUser = {
    id: userRow.id,
    email: userRow.email,
    phone: userRow.phone || '',
    full_name: userRow.full_name,
    role: userRow.role,
    province: userRow.province || 'TP. Hồ Chí Minh',
    district: userRow.district || '',
    ward: userRow.ward || '',
    shipping_address: userRow.shipping_address || '',
    created_at: userRow.created_at,
  };

  return ok(
    c,
    {
      user,
      token: rawToken,
      isAdmin: userRow.role === 'admin' || userRow.role === 'staff',
      csrf_token: csrfToken,
    },
    'Đăng nhập thành công!'
  );
});

// Đăng xuất tài khoản khách hàng & quản trị (POST /api/v1/auth/logout)
app.post('/api/v1/auth/logout', async (c) => {
  const tokenHeader =
    c.req.header('X-Customer-Token')?.trim() || c.req.header('X-Admin-Token')?.trim();
  const cookieToken = getCookie(c, CUSTOMER_COOKIE_NAME) || getCookie(c, SESSION_COOKIE_NAME);
  const rawToken = tokenHeader || cookieToken;
  if (rawToken) {
    const tokenHash = await sha256Hex(rawToken);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
  deleteCookie(c, CUSTOMER_COOKIE_NAME, { path: '/' });
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
  return ok(c, { loggedOut: true }, 'Đã đăng xuất tài khoản.');
});

// Lấy thông tin tài khoản khách hàng hiện tại (GET /api/v1/auth/me)
app.get('/api/v1/auth/me', async (c) => {
  const customer = await getAuthenticatedCustomer(c);
  return ok(c, { user: customer });
});

// Các API yêu cầu đăng nhập tài khoản khách hàng (/api/v1/account/*)
app.use('/api/v1/account/*', requireCustomerAuth);

// Cập nhật hồ sơ và địa chỉ giao hàng mặc định (PUT /api/v1/account/profile)
app.put('/api/v1/account/profile', async (c) => {
  const customer = c.get('customerUser');
  const body = await c.req.json().catch(() => ({}));
  const parsed = customerProfileSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      c,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Thông tin hồ sơ không hợp lệ.',
      400
    );
  }

  const d = parsed.data;
  const dupPhone = await c.env.DB.prepare(
    'SELECT id FROM users WHERE (LOWER(email) = ? OR phone = ?) AND id != ?'
  )
    .bind('__none__', d.phone, customer.id)
    .first<{ id: number }>();

  if (dupPhone && dupPhone.id !== customer.id) {
    return fail(c, 'DUPLICATE_PHONE', 'Số điện thoại này đã được liên kết với tài khoản khác.', 409);
  }

  await c.env.DB.prepare(
    `UPDATE users SET
      full_name = ?, phone = ?, province = ?, district = ?, ward = ?, shipping_address = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      d.full_name,
      d.phone,
      d.province,
      d.district,
      d.ward,
      d.shipping_address,
      customer.id
    )
    .run();

  // Đồng bộ đơn hàng theo số điện thoại vừa cập nhật
  await c.env.DB.prepare(
    `UPDATE orders SET user_id = ?
     WHERE user_id IS NULL AND (customer_phone = ? OR LOWER(customer_email) = ?)`
  )
    .bind(customer.id, d.phone, customer.email.toLowerCase())
    .run();

  const updated: CustomerUser = {
    ...customer,
    full_name: d.full_name,
    phone: d.phone,
    province: d.province,
    district: d.district,
    ward: d.ward,
    shipping_address: d.shipping_address,
  };

  return ok(c, { user: updated }, 'Đã cập nhật thông tin tài khoản và địa chỉ nhận hàng.');
});

// Đổi mật khẩu khách hàng (PUT /api/v1/account/password)
app.put('/api/v1/account/password', async (c) => {
  const customer = c.get('customerUser');
  const body = await c.req.json().catch(() => ({}));
  const parsed = customerPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      c,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Dữ liệu mật khẩu không hợp lệ.',
      400
    );
  }

  const userRow = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(customer.id)
    .first<{ password_hash: string; password_salt: string }>();

  if (!userRow) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy tài khoản.', 404);
  }

  const validCurrent = await verifyPassword(
    parsed.data.current_password,
    userRow.password_hash,
    userRow.password_salt
  );
  if (!validCurrent) {
    return fail(c, 'INVALID_PASSWORD', 'Mật khẩu hiện tại không chính xác.', 400);
  }

  const { hash, salt } = await hashPassword(parsed.data.new_password);
  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(hash, salt, customer.id)
    .run();

  return ok(c, { updated: true }, 'Đã đổi mật khẩu thành công.');
});

// Lấy toàn bộ danh sách đơn hàng của khách hàng (GET /api/v1/account/orders)
app.get('/api/v1/account/orders', async (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const customer = c.get('customerUser');

  // Đảm bảo mọi đơn hàng trùng SĐT hoặc Email đều được gắn user_id
  await c.env.DB.prepare(
    `UPDATE orders SET user_id = ?
     WHERE user_id IS NULL AND (customer_phone = ? OR LOWER(customer_email) = ?)`
  )
    .bind(customer.id, customer.phone || '', customer.email.toLowerCase())
    .run();

  const { results: orders } = await c.env.DB.prepare(
    `SELECT * FROM orders
     WHERE user_id = ? OR customer_phone = ? OR LOWER(customer_email) = ?
     ORDER BY created_at DESC, id DESC`
  )
    .bind(customer.id, customer.phone || '__no_phone__', customer.email.toLowerCase())
    .all<Order>();

  const enrichedOrders = await Promise.all(
    orders.map(async (ord) => {
      const [{ results: items }, { results: history }] = await Promise.all([
        c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(ord.id).all(),
        c.env.DB.prepare(
          'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC, id DESC'
        )
          .bind(ord.id)
          .all(),
      ]);
      return { ...ord, items, history };
    })
  );

  return ok(c, enrichedOrders);
});

// Khách hàng tự hủy đơn hàng khi đơn còn ở trạng thái 'pending' (POST /api/v1/account/orders/:id/cancel)
app.post('/api/v1/account/orders/:id/cancel', async (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const customer = c.get('customerUser');
  const orderId = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const reason = (body.reason || 'Khách hàng chủ động hủy đơn hàng').trim().slice(0, 200);

  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first<Order>();

  if (!order) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
  }

  const isOwner =
    order.user_id === customer.id ||
    (customer.phone && order.customer_phone === customer.phone) ||
    (order.customer_email &&
      order.customer_email.toLowerCase() === customer.email.toLowerCase());

  if (!isOwner) {
    return fail(c, 'FORBIDDEN', 'Bạn không có quyền thao tác trên đơn hàng này.', 403);
  }

  if (order.status !== 'pending') {
    return fail(
      c,
      'CANNOT_CANCEL',
      'Chỉ có thể hủy đơn hàng khi đang ở trạng thái "Chờ xác nhận". Vui lòng sử dụng trang Liên hệ để được hỗ trợ.',
      400
    );
  }

  const { results: orderItems } = await c.env.DB.prepare(
    'SELECT * FROM order_items WHERE order_id = ?'
  )
    .bind(orderId)
    .all<{ product_id: number; quantity: number }>();

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `UPDATE orders
       SET status = 'cancelled', payment_status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(order.payment_status, orderId),
    c.env.DB.prepare(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, note, changed_by)
       VALUES (?, 'pending', 'cancelled', ?, ?)`
    ).bind(orderId, reason, customer.email),
  ];

  for (const item of orderItems) {
    const prod = await c.env.DB.prepare('SELECT stock FROM products WHERE id = ?')
      .bind(item.product_id)
      .first<{ stock: number }>();
    const prevStock = prod?.stock ?? 0;

    statements.push(
      c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(
        item.quantity,
        item.product_id
      ),
      c.env.DB.prepare(
        `INSERT INTO inventory_movements (
          product_id, order_id, change_amount, previous_stock, new_stock, reason, note, created_by
        ) VALUES (?, ?, ?, ?, ?, 'order_cancelled', ?, ?)`
      ).bind(
        item.product_id,
        orderId,
        item.quantity,
        prevStock,
        prevStock + item.quantity,
        `Khách hàng hủy đơn ${order.order_code}`,
        customer.email
      )
    );
  }

  await c.env.DB.batch(statements);

  const updated = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first<Order>();
  return ok(c, updated, 'Đã hủy đơn hàng thành công.');
});

// 12. Đăng ký nhận bản tin Newsletter (POST /api/v1/newsletter/subscribe)
app.post('/api/v1/newsletter/subscribe', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 'INVALID_JSON', 'Dữ liệu không hợp lệ.', 400);
  }

  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || 'Địa chỉ email không hợp lệ.';
    return fail(c, 'VALIDATION_ERROR', msg, 400);
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM newsletter_subscribers WHERE email = ?'
  )
    .bind(email)
    .first();

  if (existing) {
    return ok(
      c,
      { email, alreadySubscribed: true },
      'Email này đã có trong danh sách cộng đồng AURA COFFEE. Cảm ơn bạn!'
    );
  }

  await c.env.DB.prepare(
    `INSERT INTO newsletter_subscribers (email, status, source)
     VALUES (?, 'subscribed', 'website_newsletter')`
  )
    .bind(email)
    .run();

  return ok(
    c,
    { email, subscribed: true },
    'Đăng ký thành công! Chào mừng bạn đồng hành cùng AURA COFFEE.',
    201
  );
});

// Helper xác định MIME type cho tệp ảnh lưu trong Workers KV
function getMediaContentType(key: string): string {
  const ext = (key.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

// 13. Phân phối ảnh công khai từ Cloudflare Workers KV (GET /api/v1/media/:key)
app.get('/api/v1/media/:key{.*}', async (c) => {
  const rawKey = c.req.param('key');
  const key = decodeURIComponent(rawKey);

  // Chặn truy cập trái phép vào các thư mục private hoặc path traversal
  if (key.startsWith('private/') || key.includes('..')) {
    return fail(c, 'FORBIDDEN', 'Không có quyền truy cập tài nguyên này.', 403);
  }

  const kv = (c.env.KV || (c.env as any).BUCKET) as any;
  if (!kv) {
    return fail(c, 'KV_UNAVAILABLE', 'Chưa cấu hình Cloudflare Workers KV.', 503);
  }

  let value: ArrayBuffer | null = null;
  let contentType: string | undefined = undefined;

  // Hỗ trợ đọc từ KV (hoặc R2 nếu đang migration)
  if (typeof kv.getWithMetadata === 'function') {
    const res = (await kv.getWithMetadata(key, { type: 'arrayBuffer' })) as {
      value: ArrayBuffer | null;
      metadata?: { contentType?: string };
    };
    value = res.value;
    contentType = res.metadata?.contentType;

    // Cơ chế fallback thông minh: nếu không tìm thấy key trực tiếp, thử tìm với basename hoặc prefix
    if (!value && !key.includes('/')) {
      for (const prefix of ['products/', 'banners/']) {
        const fallbackRes = (await kv.getWithMetadata(prefix + key, { type: 'arrayBuffer' })) as {
          value: ArrayBuffer | null;
          metadata?: { contentType?: string };
        };
        if (fallbackRes?.value) {
          value = fallbackRes.value;
          contentType = fallbackRes.metadata?.contentType;
          break;
        }
      }
    } else if (!value && key.includes('/')) {
      const baseName = key.split('/').pop() || '';
      if (baseName) {
        const fallbackRes = (await kv.getWithMetadata(baseName, { type: 'arrayBuffer' })) as {
          value: ArrayBuffer | null;
          metadata?: { contentType?: string };
        };
        if (fallbackRes?.value) {
          value = fallbackRes.value;
          contentType = fallbackRes.metadata?.contentType;
        }
      }
    }
  } else if (typeof kv.get === 'function') {
    const raw: any = await kv.get(key);
    if (raw && typeof raw === 'object' && 'body' in raw) {
      const headers = new Headers();
      raw.writeHttpMetadata?.(headers);
      headers.set('etag', raw.httpEtag || `W/"kv-${encodeURIComponent(key)}"`);
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      return new Response(raw.body, { headers });
    } else if (raw instanceof ArrayBuffer) {
      value = raw;
    }
  }

  // Nếu chưa tìm thấy trong KV, kiểm tra và phân phối trực tiếp từ static assets (c.env.ASSETS)
  if (!value) {
    const baseName = (key.split('/').pop() || '').replace(/[^a-z0-9._-]/gi, '');
    if (baseName && c.env.ASSETS) {
      try {
        const staticAssetReq = new Request(new URL(`/images/${baseName}`, c.req.url));
        const staticAssetRes = await c.env.ASSETS.fetch(staticAssetReq);
        if (staticAssetRes.status === 200) {
          const buf = await staticAssetRes.arrayBuffer();
          const mime = staticAssetRes.headers.get('content-type') || getMediaContentType(baseName);
          if (kv && typeof kv.put === 'function') {
            kv.put(key, buf, { metadata: { contentType: mime, autoCached: true } }).catch(() => {});
          }
          const headers = new Headers();
          headers.set('content-type', mime);
          headers.set('etag', `W/"static-${encodeURIComponent(key)}"`);
          headers.set('cache-control', 'public, max-age=31536000, immutable');
          return new Response(buf, { headers });
        }
      } catch {}
    }
  }

  if (!value) {
    return fail(c, 'MEDIA_NOT_FOUND', 'Không tìm thấy tệp hình ảnh trên Workers KV.', 404);
  }

  const resolvedContentType = contentType || getMediaContentType(key);
  const headers = new Headers();
  headers.set('content-type', resolvedContentType);
  headers.set('etag', `W/"kv-${encodeURIComponent(key)}"`);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(value, { headers });
});

// ============================================================================
// ADMIN APIs (/api/v1/admin/*)
// ============================================================================

// 14. Admin Login (POST /api/v1/admin/auth/login)
app.post('/api/v1/admin/auth/login', async (c) => {
  const clientIp =
    c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';

  const rateCheck = checkLoginRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return fail(
      c,
      'TOO_MANY_REQUESTS',
      `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${rateCheck.retryAfterSec} giây.`,
      429
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 'INVALID_JSON', 'Dữ liệu đăng nhập không hợp lệ.', 400);
  }

  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      c,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Vui lòng kiểm tra email và mật khẩu.',
      400
    );
  }

  const { email, password } = parsed.data;
  const userRow = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND is_active = 1'
  )
    .bind(email.toLowerCase())
    .first<{
      id: number;
      email: string;
      full_name: string;
      password_hash: string;
      password_salt: string;
      role: 'admin' | 'staff' | 'customer';
    }>();

  if (!userRow || (userRow.role !== 'admin' && userRow.role !== 'staff')) {
    recordFailedLoginAttempt(clientIp);
    return fail(c, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu quản trị không chính xác.', 401);
  }

  const isValidPassword = await verifyPassword(
    password,
    userRow.password_hash,
    userRow.password_salt
  );

  if (!isValidPassword) {
    recordFailedLoginAttempt(clientIp);
    return fail(c, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu quản trị không chính xác.', 401);
  }

  clearLoginAttempts(clientIp);

  // Tạo session token ngẫu nhiên, chỉ lưu bản băm SHA-256 trong D1
  const rawSessionToken = generateRandomHex(32);
  const tokenHash = await sha256Hex(rawSessionToken);
  const csrfToken = generateRandomHex(16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')"),
    c.env.DB.prepare(
      `INSERT INTO sessions (token_hash, user_id, csrf_token, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      tokenHash,
      userRow.id,
      csrfToken,
      clientIp,
      (c.req.header('User-Agent') || '').slice(0, 200),
      expiresAt
    ),
    c.env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(
      userRow.id
    ),
  ]);

  const isProd = c.env.ENVIRONMENT === 'production';
  setCookie(c, SESSION_COOKIE_NAME, rawSessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return ok(
    c,
    {
      token: rawSessionToken,
      user: {
        id: userRow.id,
        email: userRow.email,
        full_name: userRow.full_name,
        role: userRow.role,
        csrf_token: csrfToken,
      },
    },
    'Đăng nhập quản trị thành công.'
  );
});

// 15. Admin Logout (POST /api/v1/admin/auth/logout)
app.post('/api/v1/admin/auth/logout', async (c) => {
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME);
  if (cookieToken) {
    const tokenHash = await sha256Hex(cookieToken);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
  return ok(c, { loggedOut: true }, 'Đã đăng xuất khỏi phiên quản trị.');
});

// 16. Kiểm tra phiên đăng nhập Admin (GET /api/v1/admin/auth/me)
app.get('/api/v1/admin/auth/me', async (c) => {
  const admin = await getAuthenticatedAdmin(c);
  return ok(c, { user: admin });
});

// Áp dụng middleware xác thực cho tất cả các route /api/v1/admin/* bên dưới
app.use('/api/v1/admin/*', requireAdminAuth);

// 17. Admin Dashboard thực tế từ D1 (GET /api/v1/admin/dashboard)
app.get('/api/v1/admin/dashboard', async (c) => {
  const days = Math.min(365, Math.max(1, Number(c.req.query('days')) || 30));
  const dateFilter = `-${days} days`;

  const [
    revenueRow,
    ordersCountRow,
    pendingRow,
    processingRow,
    lowStockCountRow,
    subscribersRow,
    revenueByDayRes,
    topProductsRes,
    lowStockProductsRes,
    recentOrdersRes,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(total), 0) as revenue
       FROM orders
       WHERE status != 'cancelled' AND created_at >= datetime('now', ?)`
    )
      .bind(dateFilter)
      .first<{ revenue: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM orders WHERE created_at >= datetime('now', ?)`
    )
      .bind(dateFilter)
      .first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").first<{
      count: number;
    }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE status IN ('confirmed', 'processing', 'shipped')"
    ).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= 15').first<{
      count: number;
    }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM newsletter_subscribers').first<{
      count: number;
    }>(),
    c.env.DB.prepare(
      `SELECT substr(created_at, 1, 10) as date,
              COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as revenue,
              COUNT(*) as orders
       FROM orders
       WHERE created_at >= datetime('now', ?)
       GROUP BY substr(created_at, 1, 10)
       ORDER BY date ASC`
    )
      .bind(dateFilter)
      .all(),
    c.env.DB.prepare(
      `SELECT p.id as product_id,
              p.name as product_name,
              p.stock as stock,
              COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN oi.quantity ELSE 0 END), 0) as total_sold,
              COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN oi.line_total ELSE 0 END), 0) as revenue
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id
       GROUP BY p.id
       ORDER BY total_sold DESC, p.is_featured DESC
       LIMIT 5`
    ).all(),
    c.env.DB.prepare(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.stock <= 20
       ORDER BY p.stock ASC
       LIMIT 6`
    ).all(),
    c.env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 8').all(),
  ]);

  return ok(c, {
    summary: {
      totalRevenue: revenueRow?.revenue ?? 0,
      totalOrders: ordersCountRow?.count ?? 0,
      pendingOrders: pendingRow?.count ?? 0,
      processingOrders: processingRow?.count ?? 0,
      lowStockCount: lowStockCountRow?.count ?? 0,
      subscribersCount: subscribersRow?.count ?? 0,
    },
    revenueByDay: revenueByDayRes.results,
    topProducts: topProductsRes.results,
    lowStockProducts: lowStockProductsRes.results,
    recentOrders: recentOrdersRes.results,
  });
});

// 18. Admin CRUD Sản phẩm
app.get('/api/v1/admin/products', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const categoryId = c.req.query('category_id');
  let query = `
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (q) {
    query += ' AND (LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.origin) LIKE ?)';
    const pat = `%${q}%`;
    params.push(pat, pat, pat);
  }
  if (categoryId) {
    query += ' AND p.category_id = ?';
    params.push(Number(categoryId));
  }
  query += ' ORDER BY p.id DESC';

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return ok(c, results);
});

app.get('/api/v1/admin/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!product) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
  }
  return ok(c, product);
});

app.post('/api/v1/admin/products', async (c) => {
  const body = await c.req.json();
  const parsed = productFormSchema.safeParse(body);
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message || 'Dữ liệu sản phẩm không hợp lệ.';
    return fail(c, 'VALIDATION_ERROR', firstMsg, 400);
  }

  const d = parsed.data;
  const conflict = await c.env.DB.prepare(
    'SELECT id FROM products WHERE slug = ? OR sku = ?'
  )
    .bind(d.slug, d.sku)
    .first();

  if (conflict) {
    return fail(c, 'DUPLICATE_PRODUCT', 'Slug hoặc mã SKU đã tồn tại trên hệ thống.', 409);
  }

  const insertRes = await c.env.DB.prepare(
    `INSERT INTO products (
      category_id, name, slug, sku, origin, roast_level, process_method,
      tasting_notes, short_description, description,
      price, sale_price, stock, weight_grams, button_color, badge_text,
      is_featured, is_active, image_url, image_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      d.category_id,
      d.name,
      d.slug,
      d.sku,
      d.origin,
      d.roast_level,
      d.process_method,
      d.tasting_notes,
      d.short_description,
      d.description,
      d.price,
      d.sale_price ?? null,
      d.stock,
      d.weight_grams,
      d.button_color,
      d.badge_text || null,
      d.is_featured,
      d.is_active,
      d.image_url,
      d.image_key || null
    )
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?')
    .bind(insertRes.meta.last_row_id)
    .first();

  return ok(c, created, 'Tạo sản phẩm mới thành công.', 201);
});

app.put('/api/v1/admin/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?')
    .bind(id)
    .first<Product>();

  if (!existing) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy sản phẩm cần cập nhật.', 404);
  }

  const body = await c.req.json();
  const parsed = productFormSchema.safeParse(body);
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message || 'Dữ liệu sản phẩm không hợp lệ.';
    return fail(c, 'VALIDATION_ERROR', firstMsg, 400);
  }

  const d = parsed.data;
  const conflict = await c.env.DB.prepare(
    'SELECT id FROM products WHERE (slug = ? OR sku = ?) AND id != ?'
  )
    .bind(d.slug, d.sku, id)
    .first();

  if (conflict) {
    return fail(c, 'DUPLICATE_PRODUCT', 'Slug hoặc mã SKU đã được sử dụng bởi sản phẩm khác.', 409);
  }

  await c.env.DB.prepare(
    `UPDATE products SET
      category_id = ?, name = ?, slug = ?, sku = ?, origin = ?, roast_level = ?, process_method = ?,
      tasting_notes = ?, short_description = ?, description = ?,
      price = ?, sale_price = ?, stock = ?, weight_grams = ?, button_color = ?, badge_text = ?,
      is_featured = ?, is_active = ?, image_url = ?, image_key = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      d.category_id,
      d.name,
      d.slug,
      d.sku,
      d.origin,
      d.roast_level,
      d.process_method,
      d.tasting_notes,
      d.short_description,
      d.description,
      d.price,
      d.sale_price ?? null,
      d.stock,
      d.weight_grams,
      d.button_color,
      d.badge_text || null,
      d.is_featured,
      d.is_active,
      d.image_url,
      d.image_key || null,
      id
    )
    .run();

  if (existing.stock !== d.stock) {
    const admin = c.get('adminUser');
    await c.env.DB.prepare(
      `INSERT INTO inventory_movements (
        product_id, change_amount, previous_stock, new_stock, reason, note, created_by
      ) VALUES (?, ?, ?, ?, 'manual_adjustment', 'Điều chỉnh tồn kho trong trang Quản trị', ?)`
    )
      .bind(id, d.stock - existing.stock, existing.stock, d.stock, admin.email)
      .run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return ok(c, updated, 'Cập nhật sản phẩm thành công.');
});

// Bật / Tắt trạng thái sản phẩm (PATCH /api/v1/admin/products/:id/status)
app.patch('/api/v1/admin/products/:id/status', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const isActive = body.is_active ? 1 : 0;

  const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?')
    .bind(id)
    .first<Product>();

  if (!existing) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
  }

  await c.env.DB.prepare(
    "UPDATE products SET is_active = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(isActive, id)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return ok(
    c,
    updated,
    isActive === 1
      ? `Đã mở bán sản phẩm "${existing.name}".`
      : `Đã tạm ngừng bán sản phẩm "${existing.name}".`
  );
});

app.delete('/api/v1/admin/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const orderRefs = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?'
  )
    .bind(id)
    .first<{ count: number }>();

  if (orderRefs && orderRefs.count > 0) {
    // Nếu sản phẩm đã có trong đơn hàng, chuyển sang ngừng kinh doanh (is_active = 0) để bảo toàn lịch sử đơn
    await c.env.DB.prepare(
      "UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?"
    )
      .bind(id)
      .run();
    return ok(
      c,
      { id, softDeleted: true },
      'Sản phẩm đã từng phát sinh đơn hàng nên được chuyển sang trạng thái Ngừng kinh doanh.'
    );
  }

  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return ok(c, { id, deleted: true }, 'Đã xóa sản phẩm thành công.');
});

// 19. Admin CRUD Danh mục
app.get('/api/v1/admin/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.*,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
     FROM categories c
     ORDER BY c.sort_order ASC, c.id ASC`
  ).all();
  return ok(c, results);
});

app.post('/api/v1/admin/categories', async (c) => {
  const body = await c.req.json();
  const parsed = categoryFormSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      c,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Dữ liệu danh mục không hợp lệ.',
      400
    );
  }
  const d = parsed.data;
  const res = await c.env.DB.prepare(
    `INSERT INTO categories (name, slug, description, image_url, image_key, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(d.name, d.slug, d.description, d.image_url, d.image_key || null, d.is_active, d.sort_order)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?')
    .bind(res.meta.last_row_id)
    .first();
  return ok(c, created, 'Tạo danh mục thành công.', 201);
});

app.put('/api/v1/admin/categories/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const parsed = categoryFormSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      c,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Dữ liệu danh mục không hợp lệ.',
      400
    );
  }
  const d = parsed.data;
  await c.env.DB.prepare(
    `UPDATE categories SET
      name = ?, slug = ?, description = ?, image_url = ?, image_key = ?,
      is_active = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      d.name,
      d.slug,
      d.description,
      d.image_url,
      d.image_key || null,
      d.is_active,
      d.sort_order,
      id
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return ok(c, updated, 'Cập nhật danh mục thành công.');
});

app.delete('/api/v1/admin/categories/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const prodCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM products WHERE category_id = ?'
  )
    .bind(id)
    .first<{ count: number }>();

  if (prodCount && prodCount.count > 0) {
    return fail(
      c,
      'CATEGORY_NOT_EMPTY',
      `Không thể xóa danh mục đang chứa ${prodCount.count} sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước.`,
      400
    );
  }

  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return ok(c, { id, deleted: true }, 'Đã xóa danh mục.');
});

// 20. Admin Quản lý Đơn hàng
app.get('/api/v1/admin/orders', async (c) => {
  const status = c.req.query('status');
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const fromDate = c.req.query('from');
  const toDate = c.req.query('to');

  let query = 'SELECT * FROM orders WHERE 1=1';
  const params: (string | number)[] = [];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    query +=
      ' AND (LOWER(order_code) LIKE ? OR LOWER(customer_name) LIKE ? OR customer_phone LIKE ?)';
    const pat = `%${q}%`;
    params.push(pat, pat, pat);
  }
  if (fromDate) {
    query += ' AND created_at >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    query += ' AND created_at <= ?';
    params.push(toDate + ' 23:59:59');
  }

  query += ' ORDER BY created_at DESC, id DESC LIMIT 100';
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return ok(c, results);
});

app.get('/api/v1/admin/orders/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(id)
    .first<Order>();

  if (!order) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
  }

  const [{ results: items }, { results: history }] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all(),
    c.env.DB.prepare(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC, id DESC'
    )
      .bind(id)
      .all(),
  ]);

  return ok(c, { ...order, items, history });
});

app.patch('/api/v1/admin/orders/:id/status', async (c) => {
  const id = Number(c.req.param('id'));
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(id)
    .first<Order>();

  if (!order) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
  }

  const body = await c.req.json();
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Trạng thái cập nhật không hợp lệ.', 400);
  }

  const { status: nextStatus, payment_status, note } = parsed.data;
  const currentStatus = order.status as OrderStatus;

  if (!isValidOrderTransition(currentStatus, nextStatus)) {
    return fail(
      c,
      'INVALID_STATUS_TRANSITION',
      `Không thể chuyển trạng thái đơn hàng từ "${currentStatus}" sang "${nextStatus}".`,
      400
    );
  }

  const admin = c.get('adminUser');
  const nextPaymentStatus =
    payment_status || (nextStatus === 'delivered' ? 'paid' : order.payment_status);

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `UPDATE orders
       SET status = ?, payment_status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(nextStatus, nextPaymentStatus, id),
    c.env.DB.prepare(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, note, changed_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      id,
      currentStatus,
      nextStatus,
      note || `Cập nhật trạng thái sang ${nextStatus}`,
      admin.email
    ),
  ];

  // Nếu đơn hàng chuyển sang trạng thái 'cancelled' từ trạng thái chưa hủy, hoàn lại tồn kho
  if (nextStatus === 'cancelled' && currentStatus !== 'cancelled') {
    const { results: orderItems } = await c.env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    )
      .bind(id)
      .all<{ product_id: number; quantity: number }>();

    for (const item of orderItems) {
      const prod = await c.env.DB.prepare('SELECT stock FROM products WHERE id = ?')
        .bind(item.product_id)
        .first<{ stock: number }>();
      const prevStock = prod?.stock ?? 0;

      statements.push(
        c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(
          item.quantity,
          item.product_id
        ),
        c.env.DB.prepare(
          `INSERT INTO inventory_movements (
            product_id, order_id, change_amount, previous_stock, new_stock, reason, note, created_by
          ) VALUES (?, ?, ?, ?, ?, 'order_cancelled', ?, ?)`
        ).bind(
          item.product_id,
          id,
          item.quantity,
          prevStock,
          prevStock + item.quantity,
          `Hoàn kho do hủy đơn ${order.order_code}`,
          admin.email
        )
      );
    }
  }

  await c.env.DB.batch(statements);

  const updated = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return ok(c, updated, 'Đã cập nhật trạng thái đơn hàng thành công.');
});

// 21. Admin Quản lý Danh sách Khách hàng có Phân trang (GET /api/v1/admin/customers)
app.get('/api/v1/admin/customers', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(5, Number(c.req.query('limit')) || 15));
  const offset = (page - 1) * limit;
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const role = c.req.query('role');
  const status = c.req.query('status');
  const sort = c.req.query('sort') || 'created_desc';

  let whereClause = 'WHERE 1=1';
  const whereParams: (string | number)[] = [];

  if (q) {
    whereClause += ' AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR u.phone LIKE ?)';
    const pat = `%${q}%`;
    whereParams.push(pat, pat, pat);
  }

  if (role && role !== 'all') {
    whereClause += ' AND u.role = ?';
    whereParams.push(role);
  }

  if (status && status !== 'all') {
    whereClause += ' AND u.is_active = ?';
    whereParams.push(status === 'active' ? 1 : 0);
  }

  const countSql = `SELECT COUNT(*) as count FROM users u ${whereClause}`;
  const totalRow = await c.env.DB.prepare(countSql).bind(...whereParams).first<{ count: number }>();
  const total = totalRow?.count || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  let orderBy = 'ORDER BY u.created_at DESC, u.id DESC';
  if (sort === 'created_asc') orderBy = 'ORDER BY u.created_at ASC, u.id ASC';
  else if (sort === 'orders_desc') orderBy = 'ORDER BY order_count DESC, u.id DESC';
  else if (sort === 'spent_desc') orderBy = 'ORDER BY total_spent DESC, u.id DESC';
  else if (sort === 'name_asc') orderBy = 'ORDER BY u.full_name ASC';

  const dataSql = `
    SELECT u.id, u.email, u.phone, u.full_name, u.role, u.province, u.district, u.ward,
           u.shipping_address, u.is_active, u.last_login_at, u.created_at, u.updated_at,
           COUNT(DISTINCT o.id) as order_count,
           COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0) as total_spent,
           MAX(o.created_at) as last_order_at
    FROM users u
    LEFT JOIN orders o ON (o.user_id = u.id OR o.customer_email = u.email OR (u.phone != '' AND o.customer_phone = u.phone))
    ${whereClause}
    GROUP BY u.id
    ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const { results } = await c.env.DB.prepare(dataSql).bind(...whereParams, limit, offset).all();

  return ok(c, {
    items: results,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

// 22. Admin Xem Chi tiết Khách hàng & Lịch sử mua hàng (GET /api/v1/admin/customers/:id)
app.get('/api/v1/admin/customers/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const user = await c.env.DB.prepare(
    `SELECT id, email, phone, full_name, role, province, district, ward, shipping_address, is_active, last_login_at, created_at, updated_at
     FROM users WHERE id = ?`
  ).bind(id).first<any>();

  if (!user) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy tài khoản khách hàng.', 404);
  }

  const { results: orders } = await c.env.DB.prepare(
    `SELECT id, order_code, total, subtotal, shipping_fee, discount_amount, status, payment_method, payment_status, created_at
     FROM orders
     WHERE user_id = ? OR customer_email = ? OR (customer_phone = ? AND customer_phone != '')
     ORDER BY created_at DESC, id DESC
     LIMIT 50`
  ).bind(id, user.email, user.phone || '').all<Order>();

  const totalSpent = orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total || 0), 0);

  return ok(c, {
    user,
    stats: {
      totalOrders: orders.length,
      totalSpent,
      avgOrderValue: orders.length > 0 ? Math.round(totalSpent / orders.length) : 0,
      latestOrderAt: orders[0]?.created_at || null,
    },
    orders,
  });
});

// 23. Bật / Tắt trạng thái hoạt động tài khoản khách hàng (PATCH /api/v1/admin/customers/:id/status)
app.patch('/api/v1/admin/customers/:id/status', async (c) => {
  const id = Number(c.req.param('id'));
  const admin = c.get('adminUser') as AdminUser;
  if (admin && admin.id === id) {
    return fail(c, 'FORBIDDEN', 'Bạn không thể tự khóa tài khoản quản trị của chính mình.', 400);
  }

  const existing = await c.env.DB.prepare('SELECT id, full_name, is_active FROM users WHERE id = ?')
    .bind(id)
    .first<any>();

  if (!existing) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy tài khoản người dùng.', 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const newStatus = body.is_active ? 1 : 0;

  await c.env.DB.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(newStatus, id)
    .run();

  return ok(
    c,
    { id, is_active: newStatus },
    newStatus === 1
      ? `Đã kích hoạt lại tài khoản của khách hàng "${existing.full_name}".`
      : `Đã tạm khóa tài khoản của khách hàng "${existing.full_name}".`
  );
});

// 24. Admin Upload & Xóa ảnh trên Cloudflare Workers KV
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

app.post('/api/v1/admin/uploads', async (c) => {
  const kv = c.env.KV || (c.env.BUCKET as any);
  if (!kv) {
    return fail(c, 'KV_NOT_CONFIGURED', 'Chưa cấu hình Cloudflare Workers KV trong môi trường hiện tại.', 503);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const folder = ((formData.get('folder') as string) || 'products').replace(/[^a-z0-9-_]/gi, '');

  if (!file) {
    return fail(c, 'MISSING_FILE', 'Vui lòng chọn tệp hình ảnh để tải lên.', 400);
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return fail(
      c,
      'INVALID_MIME_TYPE',
      'Định dạng ảnh không hỗ trợ. Chỉ chấp nhận JPG, PNG, WebP, AVIF hoặc SVG.',
      400
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(c, 'FILE_TOO_LARGE', 'Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 5MB).', 400);
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const randomKey = generateRandomHex(12);
  const objectKey = `${folder}/${yearMonth}/${randomKey}.${ext}`;

  const buffer = await file.arrayBuffer();
  const admin = c.get('adminUser');

  // Ghi dữ liệu nhị phân ảnh cùng metadata vào Cloudflare Workers KV
  if (typeof kv.put === 'function') {
    await kv.put(objectKey, buffer, {
      metadata: {
        contentType: file.type,
        size: file.size,
        originalName: file.name.slice(0, 120),
        uploadedBy: admin.email,
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  const publicUrl = `/api/v1/media/${encodeURIComponent(objectKey)}`;

  return ok(
    c,
    {
      key: objectKey,
      url: publicUrl,
      size: file.size,
      contentType: file.type,
      storage: 'workers-kv',
    },
    'Tải ảnh lên Cloudflare Workers KV thành công.',
    201
  );
});

app.delete('/api/v1/admin/uploads/:key{.*}', async (c) => {
  const kv = c.env.KV || (c.env.BUCKET as any);
  if (!kv) {
    return fail(c, 'KV_NOT_CONFIGURED', 'Chưa cấu hình Cloudflare Workers KV.', 503);
  }
  const key = decodeURIComponent(c.req.param('key'));
  await kv.delete(key);
  return ok(c, { key, deleted: true }, 'Đã xóa tệp ảnh khỏi Cloudflare Workers KV.');
});

// 22. Admin Quản lý Banners & Nội dung trang chủ & Newsletter
app.get('/api/v1/admin/banners', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM banners ORDER BY sort_order ASC').all();
  return ok(c, results);
});

app.put('/api/v1/admin/banners/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  await c.env.DB.prepare(
    `UPDATE banners SET
      title = ?, subtitle = ?, eyebrow = ?,
      cta_primary_text = ?, cta_primary_link = ?,
      cta_secondary_text = ?, cta_secondary_link = ?,
      image_url = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      body.title || '',
      body.subtitle || '',
      body.eyebrow || 'GOOD COFFEE, BETTER DAYS',
      body.cta_primary_text || 'Khám phá cà phê',
      body.cta_primary_link || '/shop',
      body.cta_secondary_text || 'Câu chuyện của chúng tôi',
      body.cta_secondary_link || '/about',
      body.image_url || '/images/hero-bg.png',
      id
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM banners WHERE id = ?').bind(id).first();
  return ok(c, updated, 'Đã cập nhật banner trang chủ.');
});

app.get('/api/v1/admin/content', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM site_content ORDER BY id ASC').all();
  return ok(c, results);
});

app.put('/api/v1/admin/content/:key', async (c) => {
  const sectionKey = c.req.param('key');
  const body = await c.req.json();
  const contentJson =
    typeof body.content_json === 'string'
      ? body.content_json
      : JSON.stringify(body.content_json || {});

  await c.env.DB.prepare(
    `INSERT INTO site_content (section_key, title, subtitle, content_json, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(section_key) DO UPDATE SET
       title = excluded.title,
       subtitle = excluded.subtitle,
       content_json = excluded.content_json,
       updated_at = datetime('now')`
  )
    .bind(sectionKey, body.title || '', body.subtitle || '', contentJson)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM site_content WHERE section_key = ?')
    .bind(sectionKey)
    .first();
  return ok(c, updated, 'Đã lưu cấu hình nội dung.');
});

app.get('/api/v1/admin/newsletter', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 200'
  ).all();
  return ok(c, results);
});

// Phục vụ SPA Static Assets khi chạy dưới dạng _worker.js trên Cloudflare Pages
app.all('*', async (c) => {
  if (c.env?.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('AURA COFFEE API Worker is running.', 200);
});

export default app;
