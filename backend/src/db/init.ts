import { hashPassword } from '../utils/crypto';

export interface WorkerEnv {
  DB: D1Database;
  KV: KVNamespace;
  BUCKET?: any;
  AI?: any;
  VECTORIZE?: any;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  DEFAULT_SHIPPING_FEE?: string;
  FREE_SHIPPING_THRESHOLD?: string;
  ADMIN_BOOTSTRAP_EMAIL?: string;
  ADMIN_BOOTSTRAP_PASSWORD?: string;
  CF_EMBEDDING_MODEL?: string;
  CF_LLM_MODEL?: string;
  GEMINI_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
}

let initialized = false;

export async function ensureDatabaseInitialized(env: WorkerEnv): Promise<void> {
  if (initialized || !env.DB) return;

  try {
    await env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          phone TEXT DEFAULT '',
          full_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'customer',
          province TEXT NOT NULL DEFAULT 'TP. Hồ Chí Minh',
          district TEXT NOT NULL DEFAULT '',
          ward TEXT NOT NULL DEFAULT '',
          shipping_address TEXT NOT NULL DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          last_login_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          csrf_token TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL DEFAULT '',
          image_url TEXT NOT NULL DEFAULT '/images/product-colombia.png',
          image_key TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          sku TEXT NOT NULL UNIQUE,
          origin TEXT NOT NULL,
          roast_level TEXT NOT NULL,
          process_method TEXT NOT NULL DEFAULT 'Rang mộc nguyên bản',
          tasting_notes TEXT NOT NULL,
          short_description TEXT NOT NULL,
          description TEXT NOT NULL,
          price INTEGER NOT NULL,
          sale_price INTEGER,
          stock INTEGER NOT NULL DEFAULT 0,
          weight_grams INTEGER NOT NULL DEFAULT 250,
          button_color TEXT NOT NULL DEFAULT '#4A2E24',
          badge_text TEXT,
          is_featured INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          rating_avg REAL NOT NULL DEFAULT 5.0,
          reviews_count INTEGER NOT NULL DEFAULT 0,
          image_url TEXT NOT NULL,
          image_key TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          sku TEXT NOT NULL UNIQUE,
          grind_type TEXT NOT NULL DEFAULT 'Nguyên hạt',
          weight_grams INTEGER NOT NULL DEFAULT 250,
          price INTEGER NOT NULL,
          sale_price INTEGER,
          stock INTEGER NOT NULL DEFAULT 50,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS product_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          image_url TEXT NOT NULL,
          image_key TEXT,
          alt_text TEXT NOT NULL DEFAULT '',
          is_primary INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          order_code TEXT NOT NULL UNIQUE,
          idempotency_key TEXT UNIQUE,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          customer_email TEXT,
          shipping_address TEXT NOT NULL,
          province TEXT NOT NULL,
          district TEXT NOT NULL DEFAULT '',
          ward TEXT NOT NULL DEFAULT '',
          notes TEXT,
          payment_method TEXT NOT NULL DEFAULT 'COD',
          payment_status TEXT NOT NULL DEFAULT 'unpaid',
          status TEXT NOT NULL DEFAULT 'pending',
          subtotal INTEGER NOT NULL,
          shipping_fee INTEGER NOT NULL DEFAULT 0,
          discount_amount INTEGER NOT NULL DEFAULT 0,
          total INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          variant_id INTEGER,
          product_name_snapshot TEXT NOT NULL,
          sku_snapshot TEXT NOT NULL,
          variant_name_snapshot TEXT NOT NULL DEFAULT 'Gói 250g',
          grind_type TEXT NOT NULL DEFAULT 'Nguyên hạt',
          unit_price INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          line_total INTEGER NOT NULL,
          image_url_snapshot TEXT
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS inventory_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          variant_id INTEGER,
          order_id INTEGER,
          change_amount INTEGER NOT NULL,
          previous_stock INTEGER NOT NULL,
          new_stock INTEGER NOT NULL,
          reason TEXT NOT NULL,
          note TEXT,
          created_by TEXT DEFAULT 'system',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS order_status_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          previous_status TEXT,
          new_status TEXT NOT NULL,
          note TEXT,
          changed_by TEXT NOT NULL DEFAULT 'system',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS banners (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          subtitle TEXT NOT NULL,
          eyebrow TEXT NOT NULL DEFAULT 'GOOD COFFEE, BETTER DAYS',
          cta_primary_text TEXT NOT NULL DEFAULT 'Khám phá cà phê',
          cta_primary_link TEXT NOT NULL DEFAULT '/shop',
          cta_secondary_text TEXT NOT NULL DEFAULT 'Câu chuyện của chúng tôi',
          cta_secondary_link TEXT NOT NULL DEFAULT '/about',
          image_url TEXT NOT NULL DEFAULT '/images/hero-bg.png',
          image_key TEXT,
          position TEXT NOT NULL DEFAULT 'hero',
          is_active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS site_content (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          section_key TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          subtitle TEXT NOT NULL DEFAULT '',
          content_json TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'subscribed',
          source TEXT NOT NULL DEFAULT 'homepage_footer',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER,
          order_code TEXT,
          author_name TEXT NOT NULL,
          avatar_url TEXT NOT NULL,
          rating INTEGER NOT NULL DEFAULT 5,
          comment TEXT NOT NULL,
          product_name TEXT NOT NULL DEFAULT 'Robusta Buôn Ma Thuột',
          is_verified_purchase INTEGER NOT NULL DEFAULT 0,
          is_sample_dev INTEGER NOT NULL DEFAULT 0,
          is_approved INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS blog_posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          excerpt TEXT NOT NULL,
          content TEXT NOT NULL,
          cover_image TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'Văn Hóa Cà Phê',
          reading_time TEXT NOT NULL DEFAULT '5 phút đọc',
          is_published INTEGER NOT NULL DEFAULT 1,
          published_at TEXT NOT NULL DEFAULT (datetime('now')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS rag_chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chunk_key TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          product_slug TEXT,
          embedding_model TEXT NOT NULL DEFAULT '@cf/baai/bge-m3',
          embedding_dim INTEGER NOT NULL DEFAULT 1024,
          embedding_json TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
    ]);

    // Tự động nâng cấp bảng nếu cơ sở dữ liệu D1 được tạo từ phiên bản trước
    const migrationStatements = [
      "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''",
      "ALTER TABLE users ADD COLUMN province TEXT NOT NULL DEFAULT 'TP. Hồ Chí Minh'",
      "ALTER TABLE users ADD COLUMN district TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE users ADD COLUMN ward TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE users ADD COLUMN shipping_address TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE orders ADD COLUMN user_id INTEGER',
    ];
    for (const stmt of migrationStatements) {
      await env.DB.prepare(stmt)
        .run()
        .catch(() => {});
    }

    // Bootstrap credentials are required in production; development keeps local defaults.
    const isDev = (env.ENVIRONMENT || 'development') !== 'production';
    const adminCount = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
    if (!adminCount || adminCount.count === 0) {
      const bootstrapEmail = env.ADMIN_BOOTSTRAP_EMAIL || (isDev ? 'admin@auracoffee.local' : '');
      const bootstrapPass = env.ADMIN_BOOTSTRAP_PASSWORD || (isDev ? 'AuraCoffeeLocal@2026' : '');
      if (!bootstrapEmail || !bootstrapPass) {
        throw new Error('Production admin bootstrap requires ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD.');
      }

      const { hash, salt } = await hashPassword(bootstrapPass);
      await env.DB.prepare(
        `INSERT OR IGNORE INTO users (email, phone, full_name, password_hash, password_salt, role, province, district, ward, shipping_address, is_active)
         VALUES (?, '', 'Quản trị viên AURA COFFEE', ?, ?, 'admin', '', '', '', '', 1)`
      )
        .bind(bootstrapEmail.toLowerCase(), hash, salt)
        .run();

      if (isDev) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO users (email, phone, full_name, password_hash, password_salt, role, province, district, ward, shipping_address, is_active)
           VALUES ('customer@auracoffee.local', '', 'Khách hàng thử nghiệm', ?, ?, 'customer', '', '', '', '', 1)`
        )
          .bind(hash, salt)
          .run();
      }
    }

    // Seed initial catalog only in non-production or when catalog is completely empty
    const prodCount = await env.DB.prepare('SELECT COUNT(*) as count FROM products').first<{ count: number }>();
    if ((!prodCount || prodCount.count === 0) && isDev) {
      await env.DB.batch([
        env.DB.prepare(`
          INSERT OR IGNORE INTO categories (id, name, slug, description, image_url, is_active, sort_order)
          VALUES
          (1, 'Cà Phê Phin Truyền Thống', 'ca-phe-phin', 'Đậm đà, hậu ngọt sâu, chuẩn gu phin Việt truyền thống từ vùng đất đỏ Bazan.', '/images/product-house-blend.png', 1, 1),
          (2, 'Cà Phê Hạt Đặc Sản (Specialty)', 'ca-phe-dac-san', 'Tuyển chọn hạt chín đỏ từ vùng cao Cầu Đất và Tây Nguyên, hương hoa quả thanh tao.', '/images/product-colombia.png', 1, 2),
          (3, 'Cà Phê Pha Máy (Espresso)', 'ca-phe-pha-may', 'Phối trộn cân bằng giữa độ đậm của Robusta và hương thơm quyến rũ của Arabica.', '/images/product-ethiopia.png', 1, 3),
          (4, 'Bộ Quà Tặng & Phin Pha', 'qua-tang-phu-kien', 'Set quà tặng cà phê rang mộc sang trọng dành cho đối tác và người thân.', '/images/product-sumatra.png', 1, 4)
        `),
        env.DB.prepare(`
          INSERT OR IGNORE INTO products (
            id, category_id, name, slug, sku, origin, roast_level, process_method,
            tasting_notes, short_description, description,
            price, sale_price, stock, weight_grams, button_color, badge_text,
            is_featured, is_active, rating_avg, reviews_count, image_url
          ) VALUES
          (1, 1, 'Robusta Buôn Ma Thuột', 'robusta-buon-ma-thuot', 'AURA-RBM-250', 'Buôn Ma Thuột, Đắk Lắk', 'Rang vừa đậm (Medium-Dark)', 'Chế biến khô tự nhiên (Natural)', 'Đậm đà • Sô-cô-la đen • Hậu ngọt sâu', '100% hạt Robusta tuyển chọn từ vùng đất đỏ bazan Buôn Ma Thuột, thể chất dày dặn, lớp crema sánh mịn.', 'Được thu hoạch từ những nông hộ canh tác lâu năm tại Buôn Ma Thuột, Đắk Lắk ở độ cao 500m – 600m. Hạt cà phê được phân loại kỹ lưỡng, phơi giàn tự nhiên và rang mộc không tẩm ướp, giữ trọn hương vị sô-cô-la đen, hạt dẻ nướng cùng hậu vị ngọt dịu kéo dài rất hợp với gu cà phê phin sữa đá hoặc cà phê đen truyền thống.', 145000, 129000, 85, 250, '#183B2D', 'Bán chạy nhất', 1, 1, 4.9, 142, '/images/product-house-blend.png'),
          (2, 2, 'Arabica Cầu Đất', 'arabica-cau-dat', 'AURA-ACD-250', 'Cầu Đất, Đà Lạt (1.500m)', 'Rang sáng vừa (Light-Medium)', 'Chế biến ướt (Fully Washed)', 'Hương hoa trắng • Cam thảo • Chua thanh', 'Tinh hoa Arabica vùng cao Cầu Đất với hương thơm thanh thoát của trái cây chín, vị chua thanh dịu và hậu ngọt mật ong.', 'Sinh trưởng trong sương mù quanh năm ở độ cao trên 1.500m tại Cầu Đất, Đà Lạt, hạt Arabica mang cấu trúc hương vị tinh tế và phức hợp. Phù hợp tuyệt vời cho phương pháp Pour Over (V60), Cold Brew hoặc pha máy hiện đại, mở ra tầng hương cam vàng, trà bá tước và đường nâu.', 210000, 189000, 60, 250, '#A65F3B', 'Đặc sản vùng cao', 1, 1, 4.8, 98, '/images/product-colombia.png'),
          (3, 1, 'Blend Phin Việt', 'blend-phin-viet', 'AURA-BPV-250', 'Đắk Lắk & Lâm Đồng', 'Rang vừa đậm (Medium-Dark)', 'Phối trộn truyền thống 70/30', 'Cân bằng • Caramel • Thơm nồng nàn', 'Tỷ lệ vàng 70% Robusta Buôn Ma Thuột và 30% Arabica Cầu Đất, mang lại tách cà phê phin hài hòa cả hương lẫn vị.', 'Blend Phin Việt được tuyển chọn dành riêng cho phin truyền thống Việt Nam. Sự kết hợp giữa độ đậm mạnh mẽ của Robusta Đắk Lắk và hương thơm quyến rũ của Arabica Cầu Đất tạo nên giọt cà phê sánh quyện, thơm nồng hương caramel cháy và bơ hạt.', 165000, NULL, 110, 250, '#171512', 'Chuẩn gu Phin', 1, 1, 4.9, 215, '/images/product-ethiopia.png'),
          (4, 3, 'Espresso House Blend', 'espresso-house-blend', 'AURA-EHB-250', 'Tây Nguyên, Việt Nam', 'Rang vừa (Medium Roast)', 'Chế biến Honey & Washed', 'Sánh mịn • Hạt phỉ • Cacao nguyên chất', 'Thiết kế chuyên biệt cho máy pha Espresso tại nhà và văn phòng với lớp crema dày màu hạt dẻ quyến rũ.', 'Espresso House Blend là bản giao hưởng cân bằng giữa 50% Arabica chế biến ướt và 50% Fine Robusta chế biến mật ong (Honey). Khi chiết xuất qua máy Espresso, sản phẩm cho lớp crema dày mịn, vị chua nhẹ cân bằng cùng vị ngọt tự nhiên rất hợp khi pha Latte, Cappuccino hay Americano.', 185000, 169000, 72, 250, '#4A2E24', 'Pha máy hoàn hảo', 1, 1, 4.8, 164, '/images/product-sumatra.png'),
          (5, 2, 'Fine Robusta Honey Đắk Nông', 'fine-robusta-honey-dak-nong', 'AURA-FRH-250', 'Đắk Mil, Đắk Nông', 'Rang vừa (Medium Roast)', 'Chế biến mật ong (Yellow Honey)', 'Trái cây nhiệt đới • Mật mía • Dày vị', 'Dòng Fine Robusta lên men tự nhiên giữ lại lớp thịt quả ngọt ngào, mang đến góc nhìn hoàn toàn mới về hạt Robusta Việt.', 'Thu hái 100% trái chín đỏ và sơ chế theo phương pháp Yellow Honey trên giàn phơi nhà kính. Sản phẩm có độ ngọt tự nhiên cao, hương mít chín nhẹ nhàng kết hợp cùng vị cacao đặc trưng.', 195000, NULL, 45, 250, '#183B2D', 'Micro-Lot', 0, 1, 4.9, 54, '/images/product-house-blend.png'),
          (6, 2, 'Arabica Sơn La Bourbon', 'arabica-son-la-bourbon', 'AURA-ASL-250', 'Mường Chanh, Sơn La', 'Rang sáng (Light Roast)', 'Chế biến ướt (Washed)', 'Táo đỏ • Trà đen • Dịu mượt', 'Hạt cà phê vùng Tây Bắc với hương thơm thảo mộc dịu nhẹ, hậu vị thanh sạch kéo dài.', 'Cà phê Arabica trồng dưới tán cây ăn quả tại Sơn La mang sắc thái thanh tao, vị chua dịu tựa táo chín và hậu vị ngọt mát như trà ô long.', 220000, 199000, 38, 250, '#A65F3B', 'Mùa vụ mới', 0, 1, 4.7, 41, '/images/product-colombia.png'),
          (7, 3, 'Cold Brew Signature Blend', 'cold-brew-signature-blend', 'AURA-CBS-250', 'Cầu Đất & Quảng Trị', 'Rang sáng vừa (Light-Medium)', 'Natural & Washed', 'Cam vàng • Mơ chín • Thanh mát', 'Phối trộn tối ưu để ủ lạnh 16–24 giờ tại nhà, cho ra bình Cold Brew thơm ngát hương trái cây nhiệt đới.', 'Khi ủ lạnh cùng nước tinh khiết, Cold Brew Signature Blend giải phóng hương thơm cam vàng, quả mơ và vị ngọt thanh không hề gắt cổ, giúp bạn tỉnh táo suốt ngày dài.', 190000, NULL, 64, 250, '#171512', 'Ủ lạnh 18h', 0, 1, 4.8, 76, '/images/product-ethiopia.png'),
          (8, 4, 'Hộp Quà Tinh Hoa Cà Phê Việt', 'hop-qua-tinh-hoa-ca-phe-viet', 'AURA-GIFT-750', 'Buôn Ma Thuột & Cầu Đất', 'Đa dạng mức rang', 'Tuyển chọn 3 dòng cà phê tiêu biểu', 'Sang trọng • Đậm bản sắc • Quà tặng ý nghĩa', 'Bộ sưu tập gồm 3 gói 250g (Robusta Buôn Ma Thuột, Arabica Cầu Đất, Blend Phin Việt) kèm phin nhôm cao cấp.', 'Món quà tinh tế dành tặng người yêu cà phê, kèm cẩm nang hướng dẫn pha chế của AURA COFFEE.', 490000, 445000, 30, 750, '#4A2E24', 'Quà tặng cao cấp', 0, 1, 5.0, 62, '/images/product-sumatra.png')
        `),
        env.DB.prepare(`
          INSERT OR IGNORE INTO banners (id, title, subtitle, eyebrow, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, image_url, position, is_active, sort_order)
          VALUES (1, 'Đậm vị nguyên bản – Trọn từng khoảnh khắc.', 'Khám phá những dòng cà phê tuyển chọn và tìm hương vị dành riêng cho bạn.', 'AURA COFFEE · CÀ PHÊ TUYỂN CHỌN', 'Khám phá cà phê', '/shop', 'Câu chuyện của chúng tôi', '/about', '/images/hero-bg.png', 'hero', 1, 1)
        `),
        env.DB.prepare(`
          INSERT OR IGNORE INTO site_content (section_key, title, subtitle, content_json)
          VALUES
          ('hero_section', 'Đậm vị nguyên bản – Trọn từng khoảnh khắc.', 'Khám phá những dòng cà phê tuyển chọn và tìm hương vị dành riêng cho bạn.', '{"eyebrow":"AURA COFFEE · CÀ PHÊ TUYỂN CHỌN","primaryCta":"Khám phá cà phê","secondaryCta":"Câu chuyện của chúng tôi"}'),
          ('story_section', 'Từ Đất Việt, Đến Tách Cà Phê Mỗi Ngày.', 'AURA COFFEE trân trọng hạt cà phê bản địa Việt Nam — nơi đất đỏ bazan Tây Nguyên và sương mù Cầu Đất kết tinh trong từng mẻ rang mộc.', '{"ctaText":"Tìm hiểu hành trình"}'),
          ('shipping_config', 'Cấu hình vận chuyển tạm tính', 'Áp dụng toàn quốc', '{"defaultFee":30000,"freeThreshold":500000}')
        `),
        env.DB.prepare(`
          INSERT OR IGNORE INTO reviews (id, product_id, author_name, avatar_url, rating, comment, product_name, is_verified_purchase, is_sample_dev, is_approved)
          VALUES
          (1, 1, 'Minh Anh N.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80', 5, 'Mùi thơm cà phê rang mộc rất tự nhiên, pha phin buổi sáng dậy mùi khắp phòng làm việc. Hậu vị ngọt dịu chứ không bị gắt.', 'Robusta Buôn Ma Thuột', 1, 1, 1),
          (2, 2, 'Hoàng Nam T.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80', 5, 'Arabica Cầu Đất pha V60 lên hương cam thảo và hoa trắng rất rõ. Bao bì giấy Kraft chỉn chu, có van 1 chiều bảo quản hạt tốt.', 'Arabica Cầu Đất', 1, 1, 1),
          (3, 3, 'Thu Hà L.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80', 5, 'Mình mua Blend Phin Việt và hộp quà tặng đối tác, ai cũng khen cà phê đậm đà chuẩn vị truyền thống mà đóng gói rất sang trọng.', 'Blend Phin Việt', 1, 1, 1)
        `),
        env.DB.prepare(`
          INSERT OR IGNORE INTO blog_posts (id, title, slug, excerpt, content, cover_image, category, reading_time, is_published)
          VALUES
          (1, 'Bí Quyết Pha Cà Phê Phin Ngon Đậm Đà Chuẩn Vị Tại Nhà', 'bi-quyet-pha-ca-phe-phin-ngon-tai-nha', 'Chỉ với 5 phút mỗi sáng cùng tỷ lệ nước và nhiệt độ chuẩn xác, bạn có thể chiết xuất tách cà phê phin sánh mịn, hậu ngọt sâu.', 'Pha cà phê phin là một nét văn hóa thưởng thức chậm rãi của người Việt. Để có một tách phin ngon từ hạt cà phê rang mộc:\n\n1. Chọn cỡ xay phù hợp: Bột cà phê pha phin nên có độ mịn vừa phải (tương tự hạt muối tinh).\n2. Tráng nóng phin bằng nước sôi trước khi cho bột cà phê vào để ổn định nhiệt độ.\n3. Ủ cà phê (Blooming): Rót khoảng 20ml nước sôi (92°C - 96°C) đều khắp bề mặt và chờ 1–2 phút cho bột cà phê nở đều.\n4. Chiết xuất: Rót thêm 50ml–60ml nước theo vòng tròn từ tâm ra ngoài, đậy nắp và tận hưởng từng giọt cà phê tí tách rơi.', '/images/hero-bg.png', 'Nghệ Thuật Pha Chế', '4 phút đọc', 1),
          (2, 'Sự Khác Biệt Giữa Robusta Buôn Ma Thuột Và Arabica Cầu Đất', 'su-khac-biet-giua-robusta-buon-ma-thuot-va-arabica-cau-dat', 'Khám phá đặc trưng thổ nhưỡng, độ cao và hương vị của hai vùng nguyên liệu cà phê danh tiếng bậc nhất Việt Nam.', 'Việt Nam sở hữu hai vùng trồng cà phê có điều kiện tự nhiên đối lập nhưng bổ trợ hoàn hảo cho nhau:\n\n- Robusta Buôn Ma Thuột (Đắk Lắk): Sinh trưởng trên tầng đất đỏ bazan màu mỡ ở độ cao 500–600m với nắng gió Tây Nguyên. Hạt có hàm lượng caffeine cao, thể chất dày dặn, vị đắng êm và hương sô-cô-la đen, hạt dẻ.\n- Arabica Cầu Đất (Đà Lạt): Nằm ở độ cao trên 1.500m quanh năm mây phủ. Trái cà phê chín chậm tích tụ đường và axit hữu cơ tự nhiên, tạo nên hương hoa trắng, trái cây có múi và vị chua thanh tao nhã.', '/images/our-story-farmer.png', 'Vùng Nguyên Liệu', '6 phút đọc', 1),
          (3, 'Cà Phê Rang Mộc Là Gì? Cách Nhận Biết Cà Phê Nguyên Chất', 'ca-phe-rang-moc-la-gi-cach-nhan-biet', 'Tìm hiểu vì sao cà phê rang mộc không tẩm bơ hay hương liệu ngày càng được người yêu cà phê Việt lựa chọn cho sức khỏe.', 'Cà phê rang mộc là hạt cà phê được rang hoàn toàn bằng nhiệt độ kiểm soát mà không thêm bơ, caramel hay hương liệu tổng hợp.\n\n- Màu bột và nước: Bột cà phê rang mộc có màu nâu cánh gián tự nhiên, nước pha ra có màu nâu hổ phách trong trẻo.\n- Lớp bọt: Khi đánh mạnh với đường hoặc sữa, bọt có màu nâu sáng, mịn và nhanh tan tự nhiên.\n- Cảm giác sau khi uống: Mang lại sự tỉnh táo êm dịu, hậu vị ngọt tự nhiên ở cổ họng.', '/images/product-colombia.png', 'Kiến Thức Cà Phê', '5 phút đọc', 1)
        `),
      ]);
    }

    initialized = true;
  } catch (err) {
    console.error('Database init error:', err);
  }
}
