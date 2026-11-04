// Bộ lưu trữ dự phòng (In-Memory D1 & Workers KV Fallback) trên Cloudflare Pages
// Giúp website hoạt động 100% ngay lập tức sau khi deploy từ GitHub lên Cloudflare Pages
// ngay cả khi người dùng chưa kịp gắn D1 / Workers KV Binding trong phần Settings -> Functions.
// Khi người dùng gắn D1 (DB) và Workers KV (KV) thật, hệ thống tự động ưu tiên dùng D1 và KV thật.
import { hashPassword } from '../utils/crypto';

interface MemoryStore {
  users: any[];
  sessions: any[];
  categories: any[];
  products: any[];
  product_variants: any[];
  product_images: any[];
  orders: any[];
  order_items: any[];
  inventory_movements: any[];
  order_status_history: any[];
  banners: any[];
  site_content: any[];
  newsletter_subscribers: any[];
  reviews: any[];
  blog_posts: any[];
  rag_chunks: any[];
  initialized: boolean;
}

const mem: MemoryStore = {
  users: [],
  sessions: [],
  categories: [
    {
      id: 1,
      name: 'Cà Phê Phin Truyền Thống',
      slug: 'ca-phe-phin',
      description: 'Đậm đà, hậu ngọt sâu, chuẩn gu phin Việt truyền thống từ vùng đất đỏ Bazan.',
      image_url: '/images/product-house-blend.png',
      is_active: 1,
      sort_order: 1,
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 2,
      name: 'Cà Phê Hạt Đặc Sản (Specialty)',
      slug: 'ca-phe-dac-san',
      description: 'Tuyển chọn hạt chín đỏ từ vùng cao Cầu Đất và Tây Nguyên, hương hoa quả thanh tao.',
      image_url: '/images/product-colombia.png',
      is_active: 1,
      sort_order: 2,
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 3,
      name: 'Cà Phê Pha Máy (Espresso)',
      slug: 'ca-phe-pha-may',
      description: 'Phối trộn cân bằng giữa độ đậm của Robusta và hương thơm quyến rũ của Arabica.',
      image_url: '/images/product-ethiopia.png',
      is_active: 1,
      sort_order: 3,
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 4,
      name: 'Bộ Quà Tặng & Phin Pha',
      slug: 'qua-tang-phu-kien',
      description: 'Set quà tặng cà phê rang mộc sang trọng dành cho đối tác và người thân.',
      image_url: '/images/product-sumatra.png',
      is_active: 1,
      sort_order: 4,
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
  ],
  products: [
    {
      id: 1,
      category_id: 1,
      name: 'Robusta Buôn Ma Thuột',
      slug: 'robusta-buon-ma-thuot',
      sku: 'AURA-RBM-250',
      origin: 'Buôn Ma Thuột, Đắk Lắk',
      roast_level: 'Rang vừa đậm (Medium-Dark)',
      process_method: 'Chế biến khô tự nhiên (Natural)',
      tasting_notes: 'Đậm đà • Sô-cô-la đen • Hậu ngọt sâu',
      short_description:
        '100% hạt Robusta tuyển chọn từ vùng đất đỏ bazan Buôn Ma Thuột, thể chất dày dặn, lớp crema sánh mịn.',
      description:
        'Được thu hoạch từ những nông hộ canh tác lâu năm tại Buôn Ma Thuột, Đắk Lắk ở độ cao 500m – 600m. Hạt cà phê được phân loại kỹ lưỡng, phơi giàn tự nhiên và rang mộc không tẩm ướp, giữ trọn hương vị sô-cô-la đen, hạt dẻ nướng cùng hậu vị ngọt dịu kéo dài rất hợp với gu cà phê phin sữa đá hoặc cà phê đen truyền thống.',
      price: 145000,
      sale_price: 129000,
      stock: 85,
      weight_grams: 250,
      button_color: '#183B2D',
      badge_text: 'Bán chạy nhất',
      is_featured: 1,
      is_active: 1,
      rating_avg: 4.9,
      reviews_count: 142,
      image_url: '/images/product-house-blend.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 2,
      category_id: 2,
      name: 'Arabica Cầu Đất',
      slug: 'arabica-cau-dat',
      sku: 'AURA-ACD-250',
      origin: 'Cầu Đất, Đà Lạt (1.500m)',
      roast_level: 'Rang sáng vừa (Light-Medium)',
      process_method: 'Chế biến ướt (Fully Washed)',
      tasting_notes: 'Hương hoa trắng • Cam thảo • Chua thanh',
      short_description:
        'Tinh hoa Arabica vùng cao Cầu Đất với hương thơm thanh thoát của trái cây chín, vị chua thanh dịu và hậu ngọt mật ong.',
      description:
        'Sinh trưởng trong sương mù quanh năm ở độ cao trên 1.500m tại Cầu Đất, Đà Lạt, hạt Arabica mang cấu trúc hương vị tinh tế và phức hợp. Phù hợp tuyệt vời cho phương pháp Pour Over (V60), Cold Brew hoặc pha máy hiện đại, mở ra tầng hương cam vàng, trà bá tước và đường nâu.',
      price: 210000,
      sale_price: 189000,
      stock: 60,
      weight_grams: 250,
      button_color: '#A65F3B',
      badge_text: 'Đặc sản vùng cao',
      is_featured: 1,
      is_active: 1,
      rating_avg: 4.8,
      reviews_count: 98,
      image_url: '/images/product-colombia.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 3,
      category_id: 1,
      name: 'Blend Phin Việt',
      slug: 'blend-phin-viet',
      sku: 'AURA-BPV-250',
      origin: 'Đắk Lắk & Lâm Đồng',
      roast_level: 'Rang vừa đậm (Medium-Dark)',
      process_method: 'Phối trộn truyền thống 70/30',
      tasting_notes: 'Cân bằng • Caramel • Thơm nồng nàn',
      short_description:
        'Tỷ lệ vàng 70% Robusta Buôn Ma Thuột và 30% Arabica Cầu Đất, mang lại tách cà phê phin hài hòa cả hương lẫn vị.',
      description:
        'Blend Phin Việt được tuyển chọn dành riêng cho phin truyền thống Việt Nam. Sự kết hợp giữa độ đậm mạnh mẽ của Robusta Đắk Lắk và hương thơm quyến rũ của Arabica Cầu Đất tạo nên giọt cà phê sánh quyện, thơm nồng hương caramel cháy và bơ hạt.',
      price: 165000,
      sale_price: null,
      stock: 110,
      weight_grams: 250,
      button_color: '#171512',
      badge_text: 'Chuẩn gu Phin',
      is_featured: 1,
      is_active: 1,
      rating_avg: 4.9,
      reviews_count: 215,
      image_url: '/images/product-ethiopia.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 4,
      category_id: 3,
      name: 'Espresso House Blend',
      slug: 'espresso-house-blend',
      sku: 'AURA-EHB-250',
      origin: 'Tây Nguyên, Việt Nam',
      roast_level: 'Rang vừa (Medium Roast)',
      process_method: 'Chế biến Honey & Washed',
      tasting_notes: 'Sánh mịn • Hạt phỉ • Cacao nguyên chất',
      short_description:
        'Thiết kế chuyên biệt cho máy pha Espresso tại nhà và văn phòng với lớp crema dày màu hạt dẻ quyến rũ.',
      description:
        'Espresso House Blend là bản giao hưởng cân bằng giữa 50% Arabica chế biến ướt và 50% Fine Robusta chế biến mật ong (Honey). Khi chiết xuất qua máy Espresso, sản phẩm cho lớp crema dày mịn, vị chua nhẹ cân bằng cùng vị ngọt tự nhiên rất hợp khi pha Latte, Cappuccino hay Americano.',
      price: 185000,
      sale_price: 169000,
      stock: 72,
      weight_grams: 250,
      button_color: '#4A2E24',
      badge_text: 'Pha máy hoàn hảo',
      is_featured: 1,
      is_active: 1,
      rating_avg: 4.8,
      reviews_count: 164,
      image_url: '/images/product-sumatra.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 5,
      category_id: 2,
      name: 'Fine Robusta Honey Đắk Nông',
      slug: 'fine-robusta-honey-dak-nong',
      sku: 'AURA-FRH-250',
      origin: 'Đắk Mil, Đắk Nông',
      roast_level: 'Rang vừa (Medium Roast)',
      process_method: 'Chế biến mật ong (Yellow Honey)',
      tasting_notes: 'Trái cây nhiệt đới • Mật mía • Dày vị',
      short_description:
        'Dòng Fine Robusta lên men tự nhiên giữ lại lớp thịt quả ngọt ngào, mang đến góc nhìn hoàn toàn mới về hạt Robusta Việt.',
      description:
        'Thu hái 100% trái chín đỏ và sơ chế theo phương pháp Yellow Honey trên giàn phơi nhà kính. Sản phẩm có độ ngọt tự nhiên cao, hương mít chín nhẹ nhàng kết hợp cùng vị cacao đặc trưng.',
      price: 195000,
      sale_price: null,
      stock: 45,
      weight_grams: 250,
      button_color: '#183B2D',
      badge_text: 'Micro-Lot',
      is_featured: 0,
      is_active: 1,
      rating_avg: 4.9,
      reviews_count: 54,
      image_url: '/images/product-house-blend.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 6,
      category_id: 2,
      name: 'Arabica Sơn La Bourbon',
      slug: 'arabica-son-la-bourbon',
      sku: 'AURA-ASL-250',
      origin: 'Mường Chanh, Sơn La',
      roast_level: 'Rang sáng (Light Roast)',
      process_method: 'Chế biến ướt (Washed)',
      tasting_notes: 'Táo đỏ • Trà đen • Dịu mượt',
      short_description:
        'Hạt cà phê vùng Tây Bắc với hương thơm thảo mộc dịu nhẹ, hậu vị thanh sạch kéo dài.',
      description:
        'Cà phê Arabica trồng dưới tán cây ăn quả tại Sơn La mang sắc thái thanh tao, vị chua dịu tựa táo chín và hậu vị ngọt mát như trà ô long.',
      price: 220000,
      sale_price: 199000,
      stock: 38,
      weight_grams: 250,
      button_color: '#A65F3B',
      badge_text: 'Mùa vụ mới',
      is_featured: 0,
      is_active: 1,
      rating_avg: 4.7,
      reviews_count: 41,
      image_url: '/images/product-colombia.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 7,
      category_id: 3,
      name: 'Cold Brew Signature Blend',
      slug: 'cold-brew-signature-blend',
      sku: 'AURA-CBS-250',
      origin: 'Cầu Đất & Quảng Trị',
      roast_level: 'Rang sáng vừa (Light-Medium)',
      process_method: 'Natural & Washed',
      tasting_notes: 'Cam vàng • Mơ chín • Thanh mát',
      short_description:
        'Phối trộn tối ưu để ủ lạnh 16–24 giờ tại nhà, cho ra bình Cold Brew thơm ngát hương trái cây nhiệt đới.',
      description:
        'Khi ủ lạnh cùng nước tinh khiết, Cold Brew Signature Blend giải phóng hương thơm cam vàng, quả mơ và vị ngọt thanh không hề gắt cổ, giúp bạn tỉnh táo suốt ngày dài.',
      price: 190000,
      sale_price: null,
      stock: 64,
      weight_grams: 250,
      button_color: '#171512',
      badge_text: 'Ủ lạnh 18h',
      is_featured: 0,
      is_active: 1,
      rating_avg: 4.8,
      reviews_count: 76,
      image_url: '/images/product-ethiopia.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 8,
      category_id: 4,
      name: 'Hộp Quà Tinh Hoa Cà Phê Việt',
      slug: 'hop-qua-tinh-hoa-ca-phe-viet',
      sku: 'AURA-GIFT-750',
      origin: 'Buôn Ma Thuột & Cầu Đất',
      roast_level: 'Đa dạng mức rang',
      process_method: 'Tuyển chọn 3 dòng cà phê tiêu biểu',
      tasting_notes: 'Sang trọng • Đậm bản sắc • Quà tặng ý nghĩa',
      short_description:
        'Bộ sưu tập gồm 3 gói 250g (Robusta Buôn Ma Thuột, Arabica Cầu Đất, Blend Phin Việt) kèm phin nhôm cao cấp.',
      description:
        'Món quà tinh tế dành tặng đối tác, khách hàng và người thân yêu cà phê. Hộp giấy mỹ thuật thân thiện môi trường kèm cẩm nang hướng dẫn pha chế chi tiết từ AURA COFFEE.',
      price: 490000,
      sale_price: 445000,
      stock: 30,
      weight_grams: 750,
      button_color: '#4A2E24',
      badge_text: 'Quà tặng cao cấp',
      is_featured: 0,
      is_active: 1,
      rating_avg: 5.0,
      reviews_count: 62,
      image_url: '/images/product-sumatra.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
  ],
  product_variants: [],
  product_images: [],
  orders: [],
  order_items: [],
  inventory_movements: [],
  order_status_history: [],
  banners: [
    {
      id: 1,
      title: 'Đậm vị nguyên bản – Trọn từng khoảnh khắc.',
      subtitle:
        'Từ những vùng nguyên liệu trù phú đến tách cà phê mỗi sáng — chọn hương vị dành riêng cho bạn.',
      eyebrow: 'GOOD COFFEE, BETTER DAYS',
      cta_primary_text: 'Khám phá cà phê',
      cta_primary_link: '/shop',
      cta_secondary_text: 'Câu chuyện của chúng tôi',
      cta_secondary_link: '/about',
      image_url: '/images/hero-bg.png',
      position: 'hero',
      is_active: 1,
      sort_order: 1,
    },
  ],
  site_content: [
    {
      id: 1,
      section_key: 'shipping_config',
      title: 'Cấu hình vận chuyển tạm tính',
      subtitle: 'Áp dụng toàn quốc',
      content_json: '{"defaultFee":30000,"freeThreshold":500000}',
      updated_at: '2026-10-19 08:00:00',
    },
  ],
  newsletter_subscribers: [],
  reviews: [
    {
      id: 1,
      product_id: 1,
      author_name: 'Minh Anh N.',
      avatar_url:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80',
      rating: 5,
      comment:
        'Mùi thơm cà phê rang mộc rất tự nhiên, pha phin buổi sáng dậy mùi khắp phòng làm việc. Hậu vị ngọt dịu chứ không bị gắt.',
      product_name: 'Robusta Buôn Ma Thuột',
      is_verified_purchase: 1,
      is_sample_dev: 1,
      is_approved: 1,
      created_at: '2026-10-19 08:00:00',
    },
    {
      id: 2,
      product_id: 2,
      author_name: 'Hoàng Nam T.',
      avatar_url:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80',
      rating: 5,
      comment:
        'Arabica Cầu Đất pha V60 lên hương cam thảo và hoa trắng rất rõ. Bao bì giấy Kraft chỉn chu, có van 1 chiều bảo quản hạt tốt.',
      product_name: 'Arabica Cầu Đất',
      is_verified_purchase: 1,
      is_sample_dev: 1,
      is_approved: 1,
      created_at: '2026-10-19 08:00:00',
    },
    {
      id: 3,
      product_id: 3,
      author_name: 'Thu Hà L.',
      avatar_url:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80',
      rating: 5,
      comment:
        'Mình mua Blend Phin Việt và hộp quà tặng đối tác, ai cũng khen cà phê đậm đà chuẩn vị truyền thống mà đóng gói rất sang trọng.',
      product_name: 'Blend Phin Việt',
      is_verified_purchase: 1,
      is_sample_dev: 1,
      is_approved: 1,
      created_at: '2026-10-19 08:00:00',
    },
  ],
  blog_posts: [
    {
      id: 1,
      title: 'Bí Quyết Pha Cà Phê Phin Ngon Đậm Đà Chuẩn Vị Tại Nhà',
      slug: 'bi-quyet-pha-ca-phe-phin-ngon-tai-nha',
      excerpt:
        'Chỉ với 5 phút mỗi sáng cùng tỷ lệ nước và nhiệt độ chuẩn xác, bạn có thể chiết xuất tách cà phê phin sánh mịn, hậu ngọt sâu.',
      content:
        'Pha cà phê phin là một nét văn hóa thưởng thức chậm rãi của người Việt.\n\n1. Chọn cỡ xay phù hợp.\n2. Tráng nóng phin bằng nước sôi.\n3. Ủ cà phê (Blooming) với 20ml nước sôi 92-96 độ C.\n4. Chiết xuất chậm rãi và thưởng thức.',
      cover_image: '/images/hero-bg.png',
      category: 'Nghệ Thuật Pha Chế',
      reading_time: '4 phút đọc',
      is_published: 1,
      published_at: '2026-10-19 08:00:00',
      created_at: '2026-10-19 08:00:00',
    },
    {
      id: 2,
      title: 'Sự Khác Biệt Giữa Robusta Buôn Ma Thuột Và Arabica Cầu Đất',
      slug: 'su-khac-biet-giua-robusta-buon-ma-thuot-va-arabica-cau-dat',
      excerpt:
        'Khám phá đặc trưng thổ nhưỡng, độ cao và hương vị của hai vùng nguyên liệu cà phê danh tiếng bậc nhất Việt Nam.',
      content:
        'Robusta Buôn Ma Thuột sinh trưởng trên đất đỏ bazan 500-600m mang vị đậm đà, sô-cô-la đen. Arabica Cầu Đất ở độ cao 1.500m mang hương hoa trắng và vị chua thanh tao nhã.',
      cover_image: '/images/our-story-farmer.png',
      category: 'Vùng Nguyên Liệu',
      reading_time: '6 phút đọc',
      is_published: 1,
      published_at: '2026-10-19 08:00:00',
      created_at: '2026-10-19 08:00:00',
    },
    {
      id: 3,
      title: 'Cà Phê Rang Mộc Là Gì? Cách Nhận Biết Cà Phê Nguyên Chất',
      slug: 'ca-phe-rang-moc-la-gi-cach-nhan-biet',
      excerpt:
        'Tìm hiểu vì sao cà phê rang mộc không tẩm bơ hay hương liệu ngày càng được người yêu cà phê Việt lựa chọn cho sức khỏe.',
      content:
        'Cà phê rang mộc được rang hoàn toàn bằng nhiệt độ kiểm soát mà không thêm bơ hay hương liệu tổng hợp, cho nước pha màu nâu cánh gián trong trẻo và hậu ngọt tự nhiên.',
      cover_image: '/images/product-colombia.png',
      category: 'Kiến Thức Cà Phê',
      reading_time: '5 phút đọc',
      is_published: 1,
      published_at: '2026-10-19 08:00:00',
      created_at: '2026-10-19 08:00:00',
    },
  ],
  rag_chunks: [],
  initialized: false,
};

const EDGE_CACHE_STATE_URL = 'https://edge-state.auracoffee.internal/__db_snapshot_v2';

function mergeByKey<T extends Record<string, any>>(target: T[], incoming: T[], key: keyof T): T[] {
  const map = new Map<any, T>();
  for (const item of target) {
    map.set(item[key], item);
  }
  for (const item of incoming) {
    const existing = map.get(item[key]);
    if (!existing) {
      map.set(item[key], item);
    } else {
      // Ưu tiên bản ghi có updated_at mới hơn hoặc giữ trạng thái mới nhất
      const t1 = existing.updated_at || existing.created_at || '';
      const t2 = item.updated_at || item.created_at || '';
      if (t2 >= t1) {
        map.set(item[key], { ...existing, ...item });
      }
    }
  }
  return Array.from(map.values());
}

async function syncFromEdgeCache(): Promise<void> {
  try {
    const cacheStorage = (globalThis as any).caches?.default;
    if (!cacheStorage) return;
    const res = await cacheStorage.match(EDGE_CACHE_STATE_URL);
    if (!res) return;
    const snap = (await res.json()) as Partial<MemoryStore>;
    if (snap.users?.length) {
      mem.users = snap.users;
    }
    if (snap.sessions?.length) {
      mem.sessions = snap.sessions;
    }
    if (snap.orders?.length) {
      mem.orders = snap.orders;
    }
    if (snap.order_items?.length) {
      mem.order_items = snap.order_items;
    }
    if (snap.order_status_history?.length) {
      mem.order_status_history = snap.order_status_history;
    }
    if (Array.isArray(snap.products) && snap.products.length > 0) {
      mem.products = snap.products;
    }
    if (Array.isArray(snap.categories) && snap.categories.length > 0) {
      mem.categories = snap.categories;
    }
    if (snap.newsletter_subscribers?.length) {
      mem.newsletter_subscribers = snap.newsletter_subscribers;
    }
  } catch {
    // Ignore cache sync errors in non-edge environments
  }
}

async function persistToEdgeCache(): Promise<void> {
  try {
    const cacheStorage = (globalThis as any).caches?.default;
    if (!cacheStorage) return;
    const payload = JSON.stringify({
      users: mem.users,
      sessions: mem.sessions,
      orders: mem.orders,
      order_items: mem.order_items,
      order_status_history: mem.order_status_history,
      products: mem.products,
      categories: mem.categories,
      newsletter_subscribers: mem.newsletter_subscribers,
    });
    const response = new Response(payload, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=2592000',
      },
    });
    await cacheStorage.put(EDGE_CACHE_STATE_URL, response);
  } catch {
    // Ignore cache write errors in non-edge environments
  }
}

async function ensureMemAdmin() {
  if (!mem.initialized) {
    mem.initialized = true;
    await syncFromEdgeCache();
  }
  if (mem.users.length === 0) {
    const { hash, salt } = await hashPassword('AuraCoffeeLocal@2026');
    mem.users.push(
      {
        id: 1,
        email: 'admin@auracoffee.local',
        phone: '',
        full_name: 'Quản trị viên AURA COFFEE',
        password_hash: hash,
        password_salt: salt,
        role: 'admin',
        province: 'TP. Hồ Chí Minh',
        district: '',
        ward: '',
        shipping_address: '',
        is_active: 1,
        created_at: '2026-10-19 08:00:00',
        updated_at: '2026-10-19 08:00:00',
      },
      {
        id: 2,
        email: 'customer@auracoffee.local',
        phone: '',
        full_name: 'Khách hàng thử nghiệm',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'TP. Hồ Chí Minh',
        district: '',
        ward: '',
        shipping_address: '',
        is_active: 1,
        created_at: '2026-10-19 08:00:00',
        updated_at: '2026-10-19 08:00:00',
      },
      {
        id: 3,
        email: 'hoangnam@gmail.com',
        phone: '0903456789',
        full_name: 'Trần Hoàng Nam',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Hà Nội',
        district: 'Quận Hoàn Kiếm',
        ward: 'Phường Tràng Tiền',
        shipping_address: 'Số 45 Tràng Tiền',
        is_active: 1,
        created_at: '2026-10-18 09:30:00',
        updated_at: '2026-10-18 09:30:00',
      },
      {
        id: 4,
        email: 'thuha.le@outlook.com',
        phone: '0912345678',
        full_name: 'Lê Thu Hà',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Đà Nẵng',
        district: 'Quận Hải Châu',
        ward: 'Phường Thạch Thang',
        shipping_address: 'Số 12 Bạch Đằng',
        is_active: 1,
        created_at: '2026-10-17 14:15:00',
        updated_at: '2026-10-17 14:15:00',
      },
      {
        id: 5,
        email: 'quocbao.pham@gmail.com',
        phone: '0988776655',
        full_name: 'Phạm Quốc Bảo',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Đắk Lắk',
        district: 'TP. Buôn Ma Thuột',
        ward: 'Phường Thắng Lợi',
        shipping_address: 'Số 78 Phan Bội Châu',
        is_active: 1,
        created_at: '2026-10-16 11:20:00',
        updated_at: '2026-10-16 11:20:00',
      },
      {
        id: 6,
        email: 'maiphuong.vu@yahoo.com',
        phone: '0934567890',
        full_name: 'Vũ Mai Phương',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Lâm Đồng',
        district: 'TP. Đà Lạt',
        ward: 'Phường 1',
        shipping_address: 'Số 23 Khu Hòa Bình',
        is_active: 1,
        created_at: '2026-10-15 16:40:00',
        updated_at: '2026-10-15 16:40:00',
      },
      {
        id: 7,
        email: 'tiendat.dang@gmail.com',
        phone: '0971234888',
        full_name: 'Đặng Tiến Đạt',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Cần Thơ',
        district: 'Quận Ninh Kiều',
        ward: 'Phường An Phú',
        shipping_address: 'Số 102 Đường 30/4',
        is_active: 1,
        created_at: '2026-10-14 08:50:00',
        updated_at: '2026-10-14 08:50:00',
      },
      {
        id: 8,
        email: 'thilan.bui@gmail.com',
        phone: '0909123999',
        full_name: 'Bùi Thị Lan',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Hải Phòng',
        district: 'Quận Hồng Bàng',
        ward: 'Phường Hoàng Văn Thụ',
        shipping_address: 'Số 56 Đinh Tiên Hoàng',
        is_active: 1,
        created_at: '2026-10-13 10:10:00',
        updated_at: '2026-10-13 10:10:00',
      },
      {
        id: 9,
        email: 'vanhung.hoang@gmail.com',
        phone: '0966554433',
        full_name: 'Hoàng Văn Hùng',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'TP. Hồ Chí Minh',
        district: 'Quận Bình Thạnh',
        ward: 'Phường 25',
        shipping_address: 'Số 48 Điện Biên Phủ',
        is_active: 1,
        created_at: '2026-10-12 15:20:00',
        updated_at: '2026-10-12 15:20:00',
      },
      {
        id: 10,
        email: 'thaolinh.do@gmail.com',
        phone: '0945678123',
        full_name: 'Đỗ Thảo Linh',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Hà Nội',
        district: 'Quận Cầu Giấy',
        ward: 'Phường Dịch Vọng',
        shipping_address: 'Số 19 Duy Tân',
        is_active: 1,
        created_at: '2026-10-11 13:00:00',
        updated_at: '2026-10-11 13:00:00',
      },
      {
        id: 11,
        email: 'quanghuy.ngo@gmail.com',
        phone: '0922334455',
        full_name: 'Ngô Quang Huy',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Đồng Nai',
        district: 'TP. Biên Hòa',
        ward: 'Phường Quyết Thắng',
        shipping_address: 'Số 15 Võ Thị Sáu',
        is_active: 1,
        created_at: '2026-10-10 17:35:00',
        updated_at: '2026-10-10 17:35:00',
      },
      {
        id: 12,
        email: 'kimoanh.duong@gmail.com',
        phone: '0933445566',
        full_name: 'Dương Kim Oanh',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Bình Dương',
        district: 'TP. Thủ Dầu Một',
        ward: 'Phường Phú Cường',
        shipping_address: 'Số 89 Đại lộ Bình Dương',
        is_active: 1,
        created_at: '2026-10-09 09:15:00',
        updated_at: '2026-10-09 09:15:00',
      },
      {
        id: 13,
        email: 'trunghieu.phan@gmail.com',
        phone: '0911223344',
        full_name: 'Phan Trung Hiếu',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'TP. Hồ Chí Minh',
        district: 'Quận 7',
        ward: 'Phường Tân Phong',
        shipping_address: 'Số 68 Nguyễn Đức Cảnh',
        is_active: 1,
        created_at: '2026-10-08 11:45:00',
        updated_at: '2026-10-08 11:45:00',
      },
      {
        id: 14,
        email: 'thanhngoc.nguyen@gmail.com',
        phone: '0981122334',
        full_name: 'Nguyễn Thanh Ngọc',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Bà Rịa - Vũng Tàu',
        district: 'TP. Vũng Tàu',
        ward: 'Phường 1',
        shipping_address: 'Số 32 Hạ Long',
        is_active: 0,
        created_at: '2026-10-07 14:05:00',
        updated_at: '2026-10-07 14:05:00',
      },
      {
        id: 15,
        email: 'vietanh.tran@gmail.com',
        phone: '0977889900',
        full_name: 'Trần Việt Anh',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Hà Nội',
        district: 'Quận Đống Đa',
        ward: 'Phường Láng Hạ',
        shipping_address: 'Số 91 Thái Hà',
        is_active: 1,
        created_at: '2026-10-06 16:30:00',
        updated_at: '2026-10-06 16:30:00',
      },
      {
        id: 16,
        email: 'myduyen.lam@gmail.com',
        phone: '0908877665',
        full_name: 'Lâm Mỹ Duyên',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Khánh Hòa',
        district: 'TP. Nha Trang',
        ward: 'Phường Lộc Thọ',
        shipping_address: 'Số 55 Trần Phú',
        is_active: 1,
        created_at: '2026-10-05 08:20:00',
        updated_at: '2026-10-05 08:20:00',
      },
      {
        id: 17,
        email: 'tuanvu.nguyen@gmail.com',
        phone: '0919988776',
        full_name: 'Nguyễn Tuấn Vũ',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Thừa Thiên Huế',
        district: 'TP. Huế',
        ward: 'Phường Vĩnh Ninh',
        shipping_address: 'Số 14 Lê Lợi',
        is_active: 1,
        created_at: '2026-10-04 10:55:00',
        updated_at: '2026-10-04 10:55:00',
      },
      {
        id: 18,
        email: 'nhuquynh.dinh@gmail.com',
        phone: '0961122888',
        full_name: 'Đinh Như Quỳnh',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'TP. Hồ Chí Minh',
        district: 'Quận Phú Nhuận',
        ward: 'Phường 7',
        shipping_address: 'Số 29 Phan Xích Long',
        is_active: 1,
        created_at: '2026-10-03 15:10:00',
        updated_at: '2026-10-03 15:10:00',
      },
      {
        id: 19,
        email: 'huuphuoc.vo@gmail.com',
        phone: '0937766554',
        full_name: 'Võ Hữu Phước',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Gia Lai',
        district: 'TP. Pleiku',
        ward: 'Phường Diên Hồng',
        shipping_address: 'Số 61 Hùng Vương',
        is_active: 1,
        created_at: '2026-10-02 12:40:00',
        updated_at: '2026-10-02 12:40:00',
      },
      {
        id: 20,
        email: 'kimngan.ly@gmail.com',
        phone: '0903344112',
        full_name: 'Lý Kim Ngân',
        password_hash: hash,
        password_salt: salt,
        role: 'customer',
        province: 'Hà Nội',
        district: 'Quận Hai Bà Trưng',
        ward: 'Phường Bạch Mai',
        shipping_address: 'Số 82 Phố Huế',
        is_active: 1,
        created_at: '2026-10-01 09:00:00',
        updated_at: '2026-10-01 09:00:00',
      }
    );
  }
}

function attachCategoryNames(products: any[]) {
  return products.map((p) => {
    const cat = mem.categories.find((c) => c.id === p.category_id);
    return {
      ...p,
      category_name: cat?.name || '',
      category_slug: cat?.slug || '',
    };
  });
}

export function createFallbackD1(): D1Database {
  function makeStmt(sql: string, bound: any[] = []): any {
    const norm = sql.replace(/\s+/g, ' ').trim();
    const lower = norm.toLowerCase();

    async function executeQuery(): Promise<any[]> {
      await ensureMemAdmin();

      if (lower === 'select 1 as ok') return [{ ok: 1 }];

      // Counts
      if (lower.startsWith('select count(*) as count from users')) {
        if (lower.includes("role = 'admin'")) {
          return [{ count: mem.users.filter((u) => u.role === 'admin').length }];
        }
        let filtered = [...mem.users];
        let boundIdx = 0;
        if (lower.includes('lower(u.full_name) like ?')) {
          const pat = String(bound[boundIdx] || '').replace(/%/g, '').toLowerCase();
          boundIdx += 3;
          if (pat) {
            filtered = filtered.filter(
              (u) =>
                u.full_name.toLowerCase().includes(pat) ||
                u.email.toLowerCase().includes(pat) ||
                (u.phone && u.phone.includes(pat))
            );
          }
        }
        if (lower.includes('u.role = ?')) {
          const r = String(bound[boundIdx++] || '');
          if (r && r !== 'all') filtered = filtered.filter((u) => u.role === r);
        }
        if (lower.includes('u.is_active = ?')) {
          const act = Number(bound[boundIdx++]);
          filtered = filtered.filter((u) => u.is_active === act);
        }
        return [{ count: filtered.length }];
      }
      if (lower.startsWith('select count(*) as count from products')) {
        if (lower.includes('stock <=')) {
          return [{ count: mem.products.filter((p) => p.stock <= 15).length }];
        }
        if (lower.includes('category_id = ?')) {
          return [{ count: mem.products.filter((p) => p.category_id === Number(bound[0])).length }];
        }
        return [{ count: mem.products.length }];
      }
      if (lower.startsWith('select count(*) as count from orders')) {
        if (lower.includes("status = 'pending'")) {
          return [{ count: mem.orders.filter((o) => o.status === 'pending').length }];
        }
        if (lower.includes('status in')) {
          return [
            {
              count: mem.orders.filter((o) =>
                ['confirmed', 'processing', 'shipped'].includes(o.status)
              ).length,
            },
          ];
        }
        return [{ count: mem.orders.length }];
      }
      if (lower.startsWith('select count(*) as count from newsletter_subscribers')) {
        return [{ count: mem.newsletter_subscribers.length }];
      }
      if (lower.startsWith('select count(*) as count from order_items')) {
        return [{ count: mem.order_items.filter((i) => i.product_id === Number(bound[0])).length }];
      }

      // Categories
      if (lower.startsWith('select name, slug, description from categories')) {
        return mem.categories
          .filter((category) => category.is_active === 1)
          .map(({ name, slug, description }) => ({ name, slug, description }));
      }
      if (lower.includes('from categories c')) {
        return mem.categories.map((c) => ({
          ...c,
          product_count: mem.products.filter((p) => p.category_id === c.id && p.is_active === 1)
            .length,
        }));
      }
      if (lower.startsWith('select * from categories where slug = ?')) {
        const c = mem.categories.find((cat) => cat.slug === bound[0]);
        return c ? [c] : [];
      }
      if (lower.startsWith('select * from categories where id = ?')) {
        const c = mem.categories.find((cat) => cat.id === Number(bound[0]));
        return c ? [c] : [];
      }
      if (lower.startsWith('select * from categories')) {
        return mem.categories.filter((c) => c.is_active === 1);
      }

      // Banners & Site Content & Reviews & Blog
      if (lower.startsWith('select title, subtitle, eyebrow, cta_primary_text')) {
        return mem.banners
          .filter((banner) => banner.is_active === 1)
          .sort((a, b) => a.sort_order - b.sort_order);
      }
      if (lower.startsWith('select * from banners')) {
        return mem.banners.filter((banner) => banner.is_active === 1);
      }
      if (lower.includes('from site_content')) {
        if (lower.includes("section_key = 'shipping_config'")) {
          return mem.site_content.filter((s) => s.section_key === 'shipping_config');
        }
        if (lower.includes('where section_key = ?')) {
          return mem.site_content.filter((s) => s.section_key === bound[0]);
        }
        return mem.site_content;
      }
      if (lower.startsWith('select * from reviews')) {
        return mem.reviews;
      }
      if (lower.startsWith('select * from blog_posts where slug = ?')) {
        const b = mem.blog_posts.find((p) => p.slug === bound[0]);
        return b ? [b] : [];
      }
      if (lower.startsWith('select title, slug, excerpt, content, category, reading_time from blog_posts')) {
        return mem.blog_posts
          .filter((post) => post.is_published === 1)
          .sort((a, b) => b.published_at.localeCompare(a.published_at))
          .slice(0, 10);
      }
      if (lower.startsWith('select * from blog_posts')) {
        return mem.blog_posts.filter((post) => post.is_published === 1);
      }
      if (lower.startsWith('select * from newsletter_subscribers')) {
        return mem.newsletter_subscribers;
      }
      if (lower.startsWith('select id from newsletter_subscribers where email = ?')) {
        const sub = mem.newsletter_subscribers.find((s) => s.email === bound[0]);
        return sub ? [sub] : [];
      }

      // Auth & Users & Sessions
      if (lower.includes('from users where (lower(email) = ? or phone = ?)')) {
        const emailOrPhone1 = String(bound[0] || '').toLowerCase();
        const emailOrPhone2 = String(bound[1] || '').trim();
        const u = mem.users.find(
          (user) =>
            user.is_active === 1 &&
            (user.email.toLowerCase() === emailOrPhone1 ||
              (user.phone && user.phone === emailOrPhone2))
        );
        return u ? [u] : [];
      }
      if (lower.includes('from users where lower(email) = ? or phone = ?')) {
        const emailParam = String(bound[0] || '').toLowerCase();
        const phoneParam = String(bound[1] || '').trim();
        const excludeId = bound[2] ? Number(bound[2]) : undefined;
        const u = mem.users.find(
          (user) =>
            user.id !== excludeId &&
            (user.email.toLowerCase() === emailParam ||
              (phoneParam && user.phone === phoneParam))
        );
        return u ? [u] : [];
      }
      if (lower.includes('from users u') && !lower.startsWith('select count(*)')) {
        let filtered = [...mem.users];
        let boundIdx = 0;
        if (lower.includes('lower(u.full_name) like ?')) {
          const pat = String(bound[boundIdx] || '').replace(/%/g, '').toLowerCase();
          boundIdx += 3;
          if (pat) {
            filtered = filtered.filter(
              (u) =>
                u.full_name.toLowerCase().includes(pat) ||
                u.email.toLowerCase().includes(pat) ||
                (u.phone && u.phone.includes(pat))
            );
          }
        }
        if (lower.includes('u.role = ?')) {
          const r = String(bound[boundIdx++] || '');
          if (r && r !== 'all') filtered = filtered.filter((u) => u.role === r);
        }
        if (lower.includes('u.is_active = ?')) {
          const act = Number(bound[boundIdx++]);
          filtered = filtered.filter((u) => u.is_active === act);
        }

        const withStats = filtered.map((u) => {
          const userOrders = mem.orders.filter(
            (o) =>
              (o.user_id && o.user_id === u.id) ||
              (o.customer_email && o.customer_email.toLowerCase() === u.email.toLowerCase()) ||
              (u.phone && o.customer_phone === u.phone)
          );
          const nonCancelled = userOrders.filter((o) => o.status !== 'cancelled');
          const total_spent = nonCancelled.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
          const order_count = nonCancelled.length;
          const last_order_at = userOrders[0]?.created_at || null;
          return {
            id: u.id,
            email: u.email,
            phone: u.phone || '',
            full_name: u.full_name,
            role: u.role,
            province: u.province || 'TP. Hồ Chí Minh',
            district: u.district || '',
            ward: u.ward || '',
            shipping_address: u.shipping_address || '',
            is_active: u.is_active ?? 1,
            last_login_at: u.last_login_at || null,
            created_at: u.created_at,
            updated_at: u.updated_at,
            order_count,
            total_spent,
            last_order_at,
          };
        });

        if (lower.includes('order by u.created_at asc')) {
          withStats.sort((a, b) => a.id - b.id);
        } else if (lower.includes('order by order_count desc')) {
          withStats.sort((a, b) => b.order_count - a.order_count);
        } else if (lower.includes('order by total_spent desc')) {
          withStats.sort((a, b) => b.total_spent - a.total_spent);
        } else if (lower.includes('order by u.full_name asc')) {
          withStats.sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
        } else {
          withStats.sort((a, b) => b.id - a.id);
        }

        const limit = Number(bound[boundIdx++]) || 15;
        const offset = Number(bound[boundIdx++]) || 0;
        return withStats.slice(offset, offset + limit);
      }
      if (lower.includes('from users where id = ?')) {
        const u = mem.users.find((user) => user.id === Number(bound[0]));
        return u ? [u] : [];
      }
      if (lower.includes('from orders where user_id = ? or customer_email = ?')) {
        const uid = Number(bound[0]);
        const email = String(bound[1] || '').toLowerCase();
        const phone = String(bound[2] || '').trim();
        const userOrders = mem.orders
          .filter(
            (o) =>
              (o.user_id && o.user_id === uid) ||
              (o.customer_email && o.customer_email.toLowerCase() === email) ||
              (phone && o.customer_phone === phone)
          )
          .sort((a, b) => b.id - a.id);
        return userOrders;
      }
      if (lower.startsWith('select * from users where id = ?')) {
        const u = mem.users.find((user) => user.id === Number(bound[0]));
        return u ? [u] : [];
      }
      if (lower.startsWith('select * from users where email = ?')) {
        const u = mem.users.find(
          (user) => user.email.toLowerCase() === String(bound[0] || '').toLowerCase()
        );
        return u ? [u] : [];
      }
      if (lower.startsWith('select id from users where phone = ?')) {
        const phoneVal = String(bound[0] || '').trim();
        const emailVal = String(bound[1] || '').toLowerCase();
        const u = mem.users.find(
          (user) =>
            (phoneVal && user.phone === phoneVal) ||
            (emailVal && user.email.toLowerCase() === emailVal)
        );
        return u ? [{ id: u.id }] : [];
      }
      if (lower.includes('from sessions s inner join users u')) {
        const s = mem.sessions.find((sess) => sess.token_hash === bound[0]);
        if (!s) return [];
        const u = mem.users.find((user) => user.id === s.user_id);
        if (!u) return [];
        return [
          {
            token_hash: s.token_hash,
            csrf_token: s.csrf_token,
            expires_at: s.expires_at,
            user_id: u.id,
            email: u.email,
            phone: u.phone || '',
            full_name: u.full_name,
            role: u.role,
            province: u.province || 'TP. Hồ Chí Minh',
            district: u.district || '',
            ward: u.ward || '',
            shipping_address: u.shipping_address || '',
            is_active: u.is_active,
            created_at: u.created_at,
          },
        ];
      }

      // Products
      if (lower.startsWith('select * from products where id in')) {
        const ids = bound.map(Number);
        return mem.products.filter((p) => ids.includes(p.id));
      }
      if (lower.includes('from products where id = ?') || lower.includes('from products where id=?')) {
        const p = mem.products.find((prod) => Number(prod.id) === Number(bound[0]));
        return p ? [p] : [];
      }
      if (lower.startsWith('select id from products where')) {
        const slug = bound[0];
        const sku = bound[1];
        const excludeId = bound[2] ? Number(bound[2]) : undefined;
        const found = mem.products.find(
          (p) => (p.slug === slug || p.sku === sku) && p.id !== excludeId
        );
        return found ? [{ id: found.id }] : [];
      }
      if (lower.includes('from products p left join categories c')) {
        let list = attachCategoryNames([...mem.products]);

        if (lower.includes('where p.slug = ?')) {
          const found = list.find((p) => p.slug === bound[0] && p.is_active === 1);
          return found ? [found] : [];
        }
        if (lower.includes('where p.category_id = ? and p.is_active = 1')) {
          return list.filter((p) => p.category_id === Number(bound[0]) && p.is_active === 1);
        }
        if (lower.includes('where p.is_active = 1 and p.is_featured = 1')) {
          const lim = Number(bound[0]) || 4;
          return list.filter((p) => p.is_active === 1 && p.is_featured === 1).slice(0, lim);
        }
        if (lower.includes('where p.is_active = 1 and p.id != ?')) {
          const exId = Number(bound[0]);
          return list.filter((p) => p.is_active === 1 && p.id !== exId).slice(0, 4);
        }
        if (lower.includes('where p.stock <= 20')) {
          return list.filter((p) => p.stock <= 20);
        }

        // General product filter / count
        if (lower.includes('where p.is_active = 1')) {
          list = list.filter((p) => p.is_active === 1);
        }
        for (const param of bound) {
          if (typeof param === 'string' && param.startsWith('%') && param.endsWith('%')) {
            const kw = param.slice(1, -1).toLowerCase();
            list = list.filter(
              (p) =>
                p.name.toLowerCase().includes(kw) ||
                p.origin.toLowerCase().includes(kw) ||
                p.tasting_notes.toLowerCase().includes(kw) ||
                p.sku.toLowerCase().includes(kw)
            );
            break;
          }
        }
        if (lower.includes('and c.slug = ?')) {
          const catSlug = bound.find(
            (b) => typeof b === 'string' && !b.startsWith('%')
          ) as string;
          if (catSlug) {
            list = list.filter((p) => p.category_slug === catSlug);
          }
        }
        if (lower.startsWith('select count(*) as total')) {
          return [{ total: list.length }];
        }
        return list;
      }

      if (lower.includes('from product_variants')) {
        return mem.product_variants.filter((variant) => variant.is_active === 1);
      }
      if (lower.startsWith('select * from product_images')) return [];

      // Orders & Customer Orders & Dashboard
      if (lower.startsWith('select * from orders where idempotency_key = ?')) {
        const o = mem.orders.find((ord) => ord.idempotency_key === bound[0]);
        return o ? [o] : [];
      }
      if (lower.startsWith('select * from orders where upper(order_code) = ?')) {
        const o = mem.orders.find(
          (ord) => String(ord.order_code || '').toUpperCase() === String(bound[0] || '').toUpperCase()
        );
        return o ? [o] : [];
      }
      if (lower.startsWith('select * from orders where customer_phone = ?')) {
        const targetPhone = String(bound[0] || '').trim();
        return [...mem.orders]
          .filter((ord) => ord.customer_phone === targetPhone)
          .reverse();
      }
      if (lower.includes('from orders where user_id = ? or customer_phone = ?')) {
        const uid = Number(bound[0]);
        const uphone = String(bound[1] || '').trim();
        const uemail = String(bound[2] || '').toLowerCase();
        return [...mem.orders]
          .filter(
            (ord) =>
              ord.user_id === uid ||
              (uphone && ord.customer_phone === uphone) ||
              (uemail && String(ord.customer_email || '').toLowerCase() === uemail)
          )
          .reverse();
      }
      if (lower.startsWith('select * from orders where id = ?')) {
        const o = mem.orders.find((ord) => ord.id === Number(bound[0]));
        return o ? [o] : [];
      }
      if (lower.startsWith('select * from orders')) {
        let list = [...mem.orders].reverse();
        if (lower.includes('and status = ?')) {
          const st = bound[0];
          if (st) list = list.filter((o) => o.status === st);
        }
        for (const param of bound) {
          if (typeof param === 'string' && param.startsWith('%') && param.endsWith('%')) {
            const kw = param.slice(1, -1).toLowerCase();
            list = list.filter(
              (o) =>
                String(o.order_code || '').toLowerCase().includes(kw) ||
                String(o.customer_name || '').toLowerCase().includes(kw) ||
                String(o.customer_phone || '').includes(kw)
            );
            break;
          }
        }
        return list;
      }
      if (lower.startsWith('select * from order_items where order_id = ?')) {
        return mem.order_items.filter((i) => i.order_id === Number(bound[0]));
      }
      if (lower.startsWith('select * from order_status_history where order_id = ?')) {
        return mem.order_status_history
          .filter((h) => h.order_id === Number(bound[0]))
          .reverse();
      }
      if (lower.includes('select coalesce(sum(total), 0) as revenue from orders')) {
        const rev = mem.orders
          .filter((o) => o.status !== 'cancelled')
          .reduce((s, o) => s + o.total, 0);
        return [{ revenue: rev }];
      }
      if (lower.includes('group by substr(created_at, 1, 10)')) {
        const dateMap = new Map<string, { date: string; revenue: number; orders: number }>();
        for (const ord of mem.orders) {
          if (ord.status === 'cancelled') continue;
          const dStr = String(ord.created_at || '').slice(0, 10);
          if (!dStr) continue;
          const curr = dateMap.get(dStr) || { date: dStr, revenue: 0, orders: 0 };
          curr.revenue += Number(ord.total) || 0;
          curr.orders += 1;
          dateMap.set(dStr, curr);
        }
        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      }
      if (lower.includes('p.id as product_id, p.name as product_name')) {
        const soldMap = new Map<number, { sold: number; revenue: number }>();
        const cancelledOrderIds = new Set(
          mem.orders.filter((o) => o.status === 'cancelled').map((o) => o.id)
        );

        for (const item of mem.order_items) {
          if (cancelledOrderIds.has(item.order_id)) continue;
          const pid = Number(item.product_id);
          const curr = soldMap.get(pid) || { sold: 0, revenue: 0 };
          curr.sold += Number(item.quantity) || 0;
          curr.revenue += Number(item.line_total) || 0;
          soldMap.set(pid, curr);
        }

        const sorted = mem.products.map((p) => {
          const stats = soldMap.get(p.id) || { sold: 0, revenue: 0 };
          return {
            product_id: p.id,
            product_name: p.name,
            stock: p.stock,
            total_sold: stats.sold,
            revenue: stats.revenue,
          };
        }).sort((a, b) => {
          if (b.total_sold !== a.total_sold) return b.total_sold - a.total_sold;
          if (b.revenue !== a.revenue) return b.revenue - a.revenue;
          return a.product_id - b.product_id;
        });

        return sorted.slice(0, 5);
      }

      if (lower.startsWith('select count(*) as count from rag_chunks')) {
        return [{ count: mem.rag_chunks.length }];
      }
      if (lower.startsWith('select * from rag_chunks')) {
        return [...mem.rag_chunks];
      }

      return [];
    }

    async function executeMutation(): Promise<{
      success: boolean;
      meta: { changes: number; last_row_id: number };
    }> {
      await ensureMemAdmin();

      if (lower.startsWith('insert into users')) {
        const id =
          mem.users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1;
        const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
        mem.users.push({
          id,
          email: String(bound[0] || '').toLowerCase(),
          phone: bound[1] || '',
          full_name: bound[2],
          password_hash: bound[3],
          password_salt: bound[4],
          role: bound[5] || 'customer',
          province: bound[6] || 'TP. Hồ Chí Minh',
          district: bound[7] || '',
          ward: bound[8] || '',
          shipping_address: bound[9] || '',
          is_active: 1,
          created_at: nowStr,
          updated_at: nowStr,
        });
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('update users set full_name = ?')) {
        const uid = Number(bound[6]);
        const u = mem.users.find((user) => user.id === uid);
        if (u) {
          u.full_name = bound[0];
          u.phone = bound[1];
          u.province = bound[2];
          u.district = bound[3];
          u.ward = bound[4];
          u.shipping_address = bound[5];
          u.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes: u ? 1 : 0, last_row_id: uid } };
      }

      if (lower.startsWith('update users set is_active =')) {
        const newStatus = Number(bound[0]);
        const uid = Number(bound[1]);
        const u = mem.users.find((user) => user.id === uid);
        if (u) {
          u.is_active = newStatus;
          u.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes: u ? 1 : 0, last_row_id: uid } };
      }

      if (lower.startsWith('update users set password_hash = ?')) {
        const uid = Number(bound[2]);
        const u = mem.users.find((user) => user.id === uid);
        if (u) {
          u.password_hash = bound[0];
          u.password_salt = bound[1];
          u.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes: u ? 1 : 0, last_row_id: uid } };
      }

      if (lower.startsWith('update orders set user_id = ?')) {
        const uid = Number(bound[0]);
        const phoneVal = String(bound[1] || '').trim();
        const emailVal = String(bound[2] || '').toLowerCase();
        let changes = 0;
        for (const ord of mem.orders) {
          if (
            !ord.user_id &&
            ((phoneVal && ord.customer_phone === phoneVal) ||
              (emailVal && String(ord.customer_email || '').toLowerCase() === emailVal))
          ) {
            ord.user_id = uid;
            changes++;
          }
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes, last_row_id: 0 } };
      }

      if (lower.startsWith('insert into sessions')) {
        mem.sessions.push({
          id: mem.sessions.length + 1,
          token_hash: bound[0],
          user_id: bound[1],
          csrf_token: bound[2],
          ip_address: bound[3],
          user_agent: bound[4],
          expires_at: bound[5],
        });
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: mem.sessions.length } };
      }

      if (lower.startsWith('delete from sessions where token_hash = ?')) {
        mem.sessions = mem.sessions.filter((s) => s.token_hash !== bound[0]);
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: 0 } };
      }

      if (lower.startsWith('update products set stock = stock - ?')) {
        const qty = Number(bound[0]);
        const id = Number(bound[1]);
        const prod = mem.products.find((p) => p.id === id && p.is_active === 1 && p.stock >= qty);
        if (!prod) return { success: false, meta: { changes: 0, last_row_id: 0 } };
        prod.stock -= qty;
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('update products set stock = stock + ?')) {
        const qty = Number(bound[0]);
        const id = Number(bound[1]);
        const prod = mem.products.find((p) => p.id === id);
        if (prod) prod.stock += qty;
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('insert into orders')) {
        const id =
          mem.orders.reduce((max, o) => Math.max(max, Number(o.id) || 0), 0) + 1;
        const hasUserId = lower.includes('user_id');
        const offset = hasUserId ? 1 : 0;
        const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
        mem.orders.push({
          id,
          user_id: hasUserId ? bound[0] : null,
          order_code: bound[0 + offset],
          idempotency_key: bound[1 + offset],
          customer_name: bound[2 + offset],
          customer_phone: bound[3 + offset],
          customer_email: bound[4 + offset],
          shipping_address: bound[5 + offset],
          province: bound[6 + offset],
          district: bound[7 + offset],
          ward: bound[8 + offset],
          notes: bound[9 + offset],
          payment_method: bound[10 + offset],
          payment_status: 'unpaid',
          status: 'pending',
          subtotal: bound[11 + offset],
          shipping_fee: bound[12 + offset],
          discount_amount: 0,
          total: bound[13 + offset],
          created_at: nowStr,
          updated_at: nowStr,
        });
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('insert into order_items')) {
        const id =
          mem.order_items.reduce((max, i) => Math.max(max, Number(i.id) || 0), 0) + 1;
        mem.order_items.push({
          id,
          order_id: bound[0],
          product_id: bound[1],
          product_name_snapshot: bound[2],
          sku_snapshot: bound[3],
          variant_name_snapshot: bound[4],
          grind_type: bound[5],
          unit_price: bound[6],
          quantity: bound[7],
          line_total: bound[8],
          image_url_snapshot: bound[9],
        });
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('insert into order_status_history')) {
        const id =
          mem.order_status_history.reduce((max, h) => Math.max(max, Number(h.id) || 0), 0) + 1;
        mem.order_status_history.push({
          id,
          order_id: bound[0],
          previous_status: bound[1],
          new_status: bound[2],
          note: bound[3],
          changed_by: bound[4],
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('update orders set status = ?')) {
        const ord = mem.orders.find((o) => o.id === Number(bound[2]));
        if (ord) {
          ord.status = bound[0];
          ord.payment_status = bound[1];
          ord.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: Number(bound[2]) } };
      }

      if (lower.startsWith('insert into newsletter_subscribers')) {
        const id = mem.newsletter_subscribers.length + 1;
        mem.newsletter_subscribers.push({
          id,
          email: bound[0],
          status: 'subscribed',
          source: 'website_newsletter',
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('insert into products')) {
        const id =
          mem.products.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
        mem.products.push({
          id,
          category_id: Number(bound[0]),
          name: bound[1],
          slug: bound[2],
          sku: bound[3],
          origin: bound[4],
          roast_level: bound[5],
          process_method: bound[6],
          tasting_notes: bound[7],
          short_description: bound[8],
          description: bound[9],
          price: Number(bound[10]),
          sale_price: bound[11] ? Number(bound[11]) : null,
          stock: Number(bound[12]),
          weight_grams: Number(bound[13]),
          button_color: bound[14],
          badge_text: bound[15],
          is_featured: Number(bound[16]),
          is_active: Number(bound[17]),
          rating_avg: 5.0,
          reviews_count: 1,
          image_url: bound[18],
          image_key: bound[19],
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
          updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      // Xóa sản phẩm khỏi database
      if (lower.startsWith('delete from products where id = ?')) {
        const id = Number(bound[0]);
        mem.products = mem.products.filter((p) => Number(p.id) !== id);
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      // Ngừng kinh doanh sản phẩm (soft delete khi có đơn hàng)
      if (lower.startsWith('update products set is_active = 0')) {
        const id = Number(bound[0]);
        const prod = mem.products.find((p) => Number(p.id) === id);
        if (prod) {
          prod.is_active = 0;
          prod.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes: prod ? 1 : 0, last_row_id: id } };
      }

      // Bật / Tắt trạng thái sản phẩm trực tiếp (toggle is_active)
      if (lower.startsWith('update products set is_active = ?')) {
        const newStatus = Number(bound[0]);
        const id = Number(bound[1]);
        const prod = mem.products.find((p) => Number(p.id) === id);
        if (prod) {
          prod.is_active = newStatus;
          prod.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes: prod ? 1 : 0, last_row_id: id } };
      }

      // Chỉnh sửa thông tin sản phẩm (Full update)
      if (lower.startsWith('update products set') && lower.includes('category_id = ?')) {
        const id = Number(bound[20]);
        const prod = mem.products.find((p) => Number(p.id) === id);
        if (prod) {
          prod.category_id = Number(bound[0]);
          prod.name = bound[1];
          prod.slug = bound[2];
          prod.sku = bound[3];
          prod.origin = bound[4];
          prod.roast_level = bound[5];
          prod.process_method = bound[6];
          prod.tasting_notes = bound[7];
          prod.short_description = bound[8];
          prod.description = bound[9];
          prod.price = Number(bound[10]);
          prod.sale_price = bound[11] != null && bound[11] !== '' ? Number(bound[11]) : null;
          prod.stock = Number(bound[12]);
          prod.weight_grams = Number(bound[13]);
          prod.button_color = bound[14] || '#4A2E24';
          prod.badge_text = bound[15] || '';
          prod.is_featured = Number(bound[16]);
          prod.is_active = Number(bound[17]);
          prod.image_url = bound[18];
          prod.image_key = bound[19] || null;
          prod.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes: prod ? 1 : 0, last_row_id: id } };
      }

      // Xóa danh mục
      if (lower.startsWith('delete from categories where id = ?')) {
        const id = Number(bound[0]);
        mem.categories = mem.categories.filter((c) => c.id !== id);
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      // Thêm mới danh mục
      if (lower.startsWith('insert into categories')) {
        const id =
          mem.categories.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;
        mem.categories.push({
          id,
          name: bound[0],
          slug: bound[1],
          description: bound[2],
          image_url: bound[3],
          is_active: Number(bound[4]),
          sort_order: Number(bound[5]),
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
          updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      // Cập nhật danh mục
      if (lower.startsWith('update categories set')) {
        const id = Number(bound[6]);
        const cat = mem.categories.find((c) => c.id === id);
        if (cat) {
          cat.name = bound[0];
          cat.slug = bound[1];
          cat.description = bound[2];
          cat.image_url = bound[3];
          cat.is_active = Number(bound[4]);
          cat.sort_order = Number(bound[5]);
          cat.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes: cat ? 1 : 0, last_row_id: id } };
      }

      // Cập nhật nội dung CMS (site_content)
      if (lower.startsWith('update site_content set')) {
        const key = bound[bound.length - 1];
        const sc = mem.site_content.find((s) => s.section_key === key);
        if (sc) {
          sc.title = bound[0];
          sc.subtitle = bound[1];
          sc.content_json = bound[2];
          sc.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
        await persistToEdgeCache();
        return { success: true, meta: { changes: sc ? 1 : 0, last_row_id: 1 } };
      }

      if (lower.startsWith('delete from rag_chunks')) {
        mem.rag_chunks = [];
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: 0 } };
      }

      if (lower.startsWith('insert or replace into rag_chunks') || lower.startsWith('insert into rag_chunks')) {
        const chunkKey = String(bound[0] || '');
        mem.rag_chunks = mem.rag_chunks.filter((c) => c.chunk_key !== chunkKey);
        const id = mem.rag_chunks.length + 1;
        mem.rag_chunks.push({
          id,
          chunk_key: chunkKey,
          category: bound[1],
          title: bound[2],
          content: bound[3],
          product_slug: bound[4] || null,
          embedding_model: bound[5] || '@cf/baai/bge-m3',
          embedding_dim: Number(bound[6]) || 1024,
          embedding_json: bound[7] || '[]',
          updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
        await persistToEdgeCache();
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      await persistToEdgeCache();
      return { success: true, meta: { changes: 1, last_row_id: 1 } };
    }

    return {
      bind(...values: any[]) {
        return makeStmt(sql, values);
      },
      async first<T = any>(colName?: string): Promise<T | null> {
        const rows = await executeQuery();
        if (!rows.length) return null;
        if (colName) return rows[0][colName] ?? null;
        return rows[0] as T;
      },
      async all<T = any>() {
        const rows = await executeQuery();
        return { results: rows as T[], success: true, meta: {} };
      },
      async run() {
        return executeMutation();
      },
    };
  }

  return {
    prepare(sql: string) {
      return makeStmt(sql);
    },
    async batch(statements: any[]) {
      const results = [];
      for (const st of statements) {
        results.push(await st.run());
      }
      await persistToEdgeCache();
      return results;
    },
    async exec() {
      return { count: 1, duration: 1 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;
}

const kvMemStore = new Map<string, { value: ArrayBuffer; metadata: any }>();

export function createFallbackKV(): KVNamespace {
  return {
    async put(
      key: string,
      value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
      options?: { metadata?: any; expiration?: number; expirationTtl?: number }
    ) {
      let buf: ArrayBuffer;
      if (typeof value === 'string') {
        const enc = new TextEncoder();
        buf = enc.encode(value).buffer as ArrayBuffer;
      } else if (value instanceof ArrayBuffer) {
        buf = value;
      } else if (ArrayBuffer.isView(value)) {
        buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
      } else {
        const reader = (value as ReadableStream<Uint8Array>).getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          if (chunk) {
            chunks.push(chunk);
            total += chunk.byteLength;
          }
        }
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        buf = merged.buffer as ArrayBuffer;
      }

      kvMemStore.set(key, {
        value: buf,
        metadata: options?.metadata || {},
      });
      return;
    },
    async get(key: string, options?: any) {
      const item = kvMemStore.get(key);
      if (!item) return null;
      const type = typeof options === 'string' ? options : options?.type;
      if (type === 'text') {
        return new TextDecoder().decode(item.value);
      }
      if (type === 'json') {
        try {
          return JSON.parse(new TextDecoder().decode(item.value));
        } catch {
          return null;
        }
      }
      if (type === 'arrayBuffer') {
        return item.value.slice(0);
      }
      if (type === 'stream') {
        return new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(item.value));
            controller.close();
          },
        });
      }
      return new TextDecoder().decode(item.value);
    },
    async getWithMetadata(key: string, options?: any) {
      const item = kvMemStore.get(key);
      if (!item) return { value: null, metadata: null };
      const type = typeof options === 'string' ? options : options?.type;
      let val: any;
      if (type === 'arrayBuffer') {
        val = item.value.slice(0);
      } else if (type === 'json') {
        try {
          val = JSON.parse(new TextDecoder().decode(item.value));
        } catch {
          val = null;
        }
      } else if (type === 'stream') {
        val = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(item.value));
            controller.close();
          },
        });
      } else {
        val = new TextDecoder().decode(item.value);
      }
      return {
        value: val,
        metadata: item.metadata || null,
      };
    },
    async delete(key: string) {
      kvMemStore.delete(key);
    },
    async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
      const keys: Array<{ name: string; metadata?: any }> = [];
      const prefix = options?.prefix || '';
      for (const [k, v] of kvMemStore.entries()) {
        if (!prefix || k.startsWith(prefix)) {
          keys.push({ name: k, metadata: v.metadata });
        }
      }
      return {
        keys,
        list_complete: true,
        cursor: '',
      };
    },
  } as unknown as KVNamespace;
}

export const createFallbackR2 = createFallbackKV as any;

interface VectorRecord {
  id: string;
  values: number[];
  metadata?: any;
}

const vectorizeMemStore = new Map<string, VectorRecord>();

export function createFallbackVectorize(): any {
  return {
    async upsert(vectors: VectorRecord[]) {
      for (const vec of vectors) {
        vectorizeMemStore.set(vec.id, {
          id: vec.id,
          values: Array.from(vec.values),
          metadata: vec.metadata || {},
        });
      }
      return { count: vectors.length };
    },
    async query(queryVector: number[], options?: { topK?: number; returnMetadata?: string }) {
      const topK = options?.topK || 4;
      const scored: Array<{ id: string; score: number; metadata: any }> = [];

      for (const record of vectorizeMemStore.values()) {
        const len = Math.min(queryVector.length, record.values.length);
        if (len === 0) continue;
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < len; i++) {
          dot += queryVector[i] * record.values[i];
          normA += queryVector[i] * queryVector[i];
          normB += record.values[i] * record.values[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        const score = denom === 0 ? 0 : dot / denom;
        scored.push({
          id: record.id,
          score,
          metadata: record.metadata,
        });
      }

      scored.sort((a, b) => b.score - a.score);
      return {
        matches: scored.slice(0, topK),
        count: vectorizeMemStore.size,
      };
    },
    async deleteByIds(ids: string[]) {
      for (const id of ids) vectorizeMemStore.delete(id);
      return { count: ids.length };
    },
    async getByIds(ids: string[]) {
      return ids.map((id) => vectorizeMemStore.get(id)).filter(Boolean);
    },
    async describe() {
      return {
        dimensions: 1024,
        metric: 'cosine',
        count: vectorizeMemStore.size,
      };
    },
  };
}
