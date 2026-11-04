import type { Context } from 'hono';
import type { WorkerEnv } from '../db/init';
import type {
  ChatHistoryItem,
  ChatResponseData,
  CustomerUser,
  Order,
  Product,
  ProductVariant,
  RagTraceInfo,
} from '../../shared/types';
import { formatVND, normalizeOrderCode, ORDER_STATUS_LABELS } from '../../shared/constants';
import { getAuthenticatedCustomer } from '../middleware/auth';
import {
  searchVectorDB,
  generateRagLLMResponse,
  DEFAULT_CF_LLM_MODEL,
} from './rag';

function normalizeVi(text: string): string {
  return text.toLowerCase().trim();
}

function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-\s]+/g, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatCmsValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatCmsValue).filter(Boolean).join('; ');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${formatCmsValue(item)}`)
      .filter((item) => !item.endsWith(': '))
      .join('; ');
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export async function handleBaristaChat(
  c: Context<{ Bindings: WorkerEnv; Variables: any }>,
  rawMessage: string,
  history: ChatHistoryItem[] = []
): Promise<ChatResponseData> {
  const message = rawMessage.trim();
  const q = normalizeVi(message);

  // 1. Load public shop and CMS data from D1 for current answers.
  const [
    productsResult,
    variantsResult,
    categoriesResult,
    bannersResult,
    siteContentResult,
    blogPostsResult,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1
       ORDER BY p.is_featured DESC, p.rating_avg DESC`
    ).all<Product>(),
    c.env.DB.prepare(
      `SELECT v.* FROM product_variants v
       JOIN products p ON p.id = v.product_id
       WHERE v.is_active = 1 AND p.is_active = 1`
    ).all<ProductVariant>(),
    c.env.DB.prepare(
      'SELECT name, slug, description FROM categories WHERE is_active = 1 ORDER BY sort_order ASC'
    ).all<{ name: string; slug: string; description: string }>(),
    c.env.DB.prepare(
      'SELECT title, subtitle, eyebrow, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link FROM banners WHERE is_active = 1 ORDER BY sort_order ASC'
    ).all<{
      title: string;
      subtitle: string;
      eyebrow: string;
      cta_primary_text: string;
      cta_primary_link: string;
      cta_secondary_text: string;
      cta_secondary_link: string;
    }>(),
    c.env.DB.prepare('SELECT section_key, title, subtitle, content_json FROM site_content').all<{
      section_key: string;
      title: string;
      subtitle: string;
      content_json: string;
    }>(),
    c.env.DB.prepare(
      `SELECT title, slug, excerpt, content, category, reading_time
       FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC LIMIT 3`
    ).all<{
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      category: string;
      reading_time: string;
    }>(),
  ]);
  const variantsByProduct = new Map<number, ProductVariant[]>();
  for (const variant of variantsResult.results) {
    const variants = variantsByProduct.get(variant.product_id) || [];
    variants.push(variant);
    variantsByProduct.set(variant.product_id, variants);
  }
  const products = productsResult.results.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) || [],
  }));
  const siteContent = siteContentResult.results;
  let shippingFee = Number(c.env.DEFAULT_SHIPPING_FEE || 30000);
  let freeThreshold = Number(c.env.FREE_SHIPPING_THRESHOLD || 500000);
  const websiteContext = [
    '[DANH MỤC ĐANG HIỂN THỊ]',
    ...categoriesResult.results.map(
      (category) =>
        `- ${category.name} (${category.slug})${category.description ? `: ${category.description.slice(0, 100)}` : ''}`
    ),
    '',
    '[BANNER TRANG CHỦ ĐANG HOẠT ĐỘNG]',
    ...bannersResult.results.map(
      (banner) =>
        `- ${banner.eyebrow}: ${banner.title.slice(0, 120)}. ${banner.subtitle.slice(0, 160)} Nút: ${banner.cta_primary_text} (${banner.cta_primary_link}); ${banner.cta_secondary_text} (${banner.cta_secondary_link}).`
    ),
    '',
    '[NỘI DUNG WEBSITE ĐANG CẤU HÌNH TRONG CMS]',
    ...siteContent.map((section) => {
      let parsedContent: unknown = {};
      try {
        parsedContent = JSON.parse(section.content_json || '{}');
      } catch (err) {
        console.warn(
          `[Chatbot] Invalid CMS JSON for section "${section.section_key}":`,
          (err as Error)?.message
        );
      }
      if (section.section_key === 'shipping_config' && isRecord(parsedContent)) {
        if (typeof parsedContent.defaultFee === 'number') {
          shippingFee = parsedContent.defaultFee;
        }
        if (typeof parsedContent.freeThreshold === 'number') {
          freeThreshold = parsedContent.freeThreshold;
        }
      }
      const details = formatCmsValue(parsedContent).slice(0, 500);
      return `- ${section.title.slice(0, 100)} [${section.section_key}]${section.subtitle ? ` — ${section.subtitle.slice(0, 100)}` : ''}${details ? `: ${details}` : ''}`;
    }),
    '',
    '[BÀI VIẾT ĐÃ ĐĂNG TRÊN BLOG]',
    ...blogPostsResult.results.map((post) => {
      const summary = post.excerpt || post.content;
      return `- ${post.title} [${post.category}, ${post.reading_time}] (${post.slug}): ${summary.slice(0, 180)}`;
    }),
  ]
    .join('\n')
    .slice(0, 2000);

  // Lấy thông tin khách hàng đang đăng nhập (nếu có)
  const customer: CustomerUser | null = await getAuthenticatedCustomer(c);

  // 2. Thực thi quy trình RAG: Chunking -> Word Embedding (@cf/baai/bge-m3) -> Vector DB Search
  const ragSearchResult = await searchVectorDB(c.env, message, products, 2);

  const buildRagTrace = (llmModelUsed: string): RagTraceInfo => ({
    pipeline: 'chunking -> word_embedding -> vector_db -> llm',
    embeddingModel: ragSearchResult.embeddingModel,
    llmModel: llmModelUsed,
    vectorBackend: ragSearchResult.vectorBackend,
    totalChunksIndexed: ragSearchResult.totalChunksIndexed,
    topChunks: ragSearchResult.topChunks,
  });

  // Lọc danh sách sản phẩm gợi ý trực tiếp từ các Chunk có độ tương đồng Vector cao nhất
  const ragMatchedProducts: Product[] = [];
  for (const chunk of ragSearchResult.topChunks) {
    if (chunk.product_slug) {
      const found = products.find((p) => p.slug === chunk.product_slug);
      if (found && !ragMatchedProducts.some((x) => x.id === found.id)) {
        ragMatchedProducts.push(found);
      }
    }
  }

  // 3. Kiểm tra mã đơn hàng AURA hoặc số điện thoại đặt hàng.
  const orderCodeMatch = message.toUpperCase().match(/\b(?:AURA|[A-Z]{3})-[A-Z0-9]{4,10}-[A-Z0-9]{3,6}\b/);
  const phoneMatch = message.replace(/[\s.-]/g, '').match(/(0[35789][0-9]{8})/);
  const isAskingOrder =
    orderCodeMatch !== null ||
    phoneMatch !== null ||
    /(đơn hàng|kiểm tra đơn|tra cứu đơn|đơn của tôi|đơn mình|tình trạng đơn|bao giờ giao|giao tới đâu)/i.test(
      q
    );

  if (isAskingOrder) {
    const matchedOrders: Order[] = [];

    if (orderCodeMatch) {
      const code = normalizeOrderCode(orderCodeMatch[0]);
      const ord = await c.env.DB.prepare('SELECT * FROM orders WHERE order_code = ?')
        .bind(code)
        .first<Order>();
      if (ord) {
        const { results: items } = await c.env.DB.prepare(
          'SELECT * FROM order_items WHERE order_id = ?'
        )
          .bind(ord.id)
          .all<any>();
        matchedOrders.push({ ...ord, items });
      }
    } else if (phoneMatch) {
      const phone = phoneMatch[1];
      const { results: ords } = await c.env.DB.prepare(
        'SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 5'
      )
        .bind(phone)
        .all<Order>();
      for (const ord of ords) {
        const { results: items } = await c.env.DB.prepare(
          'SELECT * FROM order_items WHERE order_id = ?'
        )
          .bind(ord.id)
          .all<any>();
        matchedOrders.push({ ...ord, items });
      }
    } else if (customer) {
      const { results: ords } = await c.env.DB.prepare(
        `SELECT * FROM orders
         WHERE user_id = ? OR customer_phone = ? OR LOWER(customer_email) = ?
         ORDER BY created_at DESC LIMIT 5`
      )
        .bind(customer.id, customer.phone || '', customer.email.toLowerCase())
        .all<Order>();
      for (const ord of ords) {
        const { results: items } = await c.env.DB.prepare(
          'SELECT * FROM order_items WHERE order_id = ?'
        )
          .bind(ord.id)
          .all<any>();
        matchedOrders.push({ ...ord, items });
      }
    }

    if (matchedOrders.length > 0) {
      const latest = matchedOrders[0];
      const statusLabel = ORDER_STATUS_LABELS[latest.status] || latest.status;
      const reply =
        matchedOrders.length === 1
          ? `Mình tìm thấy đơn hàng **#${latest.order_code}** của **${latest.customer_name}** rồi ạ!\n\n• **Trạng thái hiện tại:** ${statusLabel}\n• **Tổng thanh toán:** ${formatVND(latest.total)} (${latest.payment_method})\n• **Địa chỉ nhận:** ${latest.shipping_address}, ${latest.ward}, ${latest.district}, ${latest.province}\n\nBạn có thể nhấn vào thẻ đơn hàng bên dưới để xem chi tiết từng sản phẩm nhé!`
          : `Mình tìm thấy **${matchedOrders.length} đơn hàng** gần nhất của bạn. Đơn mới nhất **#${latest.order_code}** hiện đang ở trạng thái **${statusLabel}** (${formatVND(latest.total)}). Mời bạn xem danh sách chi tiết ngay bên dưới nhé:`;

      return {
        reply,
        intent: 'order_lookup',
        matchedOrders,
        suggestions: [
          '☕ Tư vấn thêm cà phê ngon',
          '🚚 Chính sách giao hàng & quyền lợi',
          '📖 Hướng dẫn pha Phin chuẩn vị',
        ],
        rag: buildRagTrace('d1-sql-order-engine'),
      };
    }

    if (orderCodeMatch || phoneMatch) {
      return {
        reply: `Mình chưa tìm thấy đơn hàng nào khớp với thông tin **${orderCodeMatch?.[0] || phoneMatch?.[1]}** trên hệ thống. Bạn vui lòng kiểm tra lại **Số điện thoại đặt hàng** hoặc **Mã đơn AURA** giúp mình nhé!`,
        intent: 'order_lookup',
        suggestions: [
          '📦 Tra cứu bằng SĐT 0901234567',
          '☕ Tư vấn chọn cà phê hợp gu',
          '📞 Thông tin liên hệ AURA COFFEE',
        ],
        rag: buildRagTrace('d1-sql-order-engine'),
      };
    }

    return {
      reply:
        'Để mình kiểm tra trạng thái đơn hàng giúp bạn ngay nhé! Bạn chỉ cần nhắn trực tiếp **Số điện thoại đặt hàng** (ví dụ: `0901234567`) hoặc **Mã đơn hàng** (ví dụ: `AURA-261104-4829`) vào khung chat này, hoặc đăng nhập vào mục **Tài khoản** ở góc trên nhé.',
      intent: 'order_lookup',
      suggestions: [
        '0901234567',
        '☕ Tư vấn chọn cà phê hợp gu',
        '🚚 Phí vận chuyển & Quyền lợi đổi trả',
      ],
      rag: buildRagTrace('d1-sql-order-engine'),
    };
  }

  const isAskingProductCatalog =
    /(liệt kê|danh sách|tất cả|toàn bộ|các sản phẩm|những sản phẩm|sản phẩm nào|có những.*(sản phẩm|dòng cà phê)|menu)/i.test(
      q
    );
  if (isAskingProductCatalog) {
    const catalogLines = products.map(
      (product) =>
        `• **${product.name}** — ${formatVND(product.sale_price ?? product.price)} / ${product.weight_grams}g; ${product.tasting_notes}; ${
          product.stock > 0 ? `còn ${product.stock} gói` : 'tạm hết hàng'
        }.`
    );
    return {
      reply: `Đây là các sản phẩm đang bán trên shop AURA COFFEE:\n\n${catalogLines.join('\n')}`,
      intent: 'recommendation',
      recommendedProducts: products.slice(0, 4),
      suggestions: [
        '☕ Tư vấn cà phê hợp gu của mình',
        '🚚 Chính sách giao hàng & đổi trả',
        '📦 Kiểm tra đơn hàng của tôi',
      ],
      rag: buildRagTrace('d1-product-catalog'),
    };
  }

  const normalizedQuestion = normalizeSearchText(message);
  const mentionedProducts = products.filter((product) => {
    const normalizedName = normalizeSearchText(product.name);
    const normalizedSlug = normalizeSearchText(product.slug);
    return (
      normalizedQuestion.includes(normalizedName) ||
      normalizedQuestion.includes(normalizedSlug)
    );
  });
  if (
    mentionedProducts.length === 1 &&
    /(giá|bao nhiêu|hương vị|mùi|vị|xuất xứ|nguồn gốc|rang|sơ chế|mô tả|thông tin|còn hàng|tồn kho|đặc điểm|nào)/i.test(
      q
    )
  ) {
    const product = mentionedProducts[0];
    return {
      reply: `**${product.name}** (${product.weight_grams}g)\n\n${product.short_description}\n\n• **Hương vị:** ${product.tasting_notes}\n• **Xuất xứ:** ${product.origin}\n• **Giá hiện tại:** ${formatVND(product.sale_price ?? product.price)}${
        product.sale_price ? ` (giá gốc ${formatVND(product.price)})` : ''
      }\n• **Tình trạng:** ${
        product.stock > 0 ? `Còn ${product.stock} gói` : 'Tạm hết hàng'
      }\n\n${product.description}`,
      intent: 'recommendation',
      recommendedProducts: [product],
      suggestions: [
        '☕ So sánh với các dòng cà phê khác',
        '🛒 Xem sản phẩm và tùy chọn xay',
        '🚚 Chính sách giao hàng & đổi trả',
      ],
      rag: buildRagTrace('d1-product-lookup'),
    };
  }

  // 4. Phân loại Intent dựa trên câu hỏi & kết quả truy xuất Vector DB
  const isAskingBrewing =
    !/(tư vấn|chọn|gợi ý|mua|loại nào)/i.test(q) &&
    /(cách pha|hướng dẫn|công thức|tỷ lệ pha|nhiệt độ nước|cách ủ|bảo quản|giữ hương)/i.test(q);

  const isAskingPolicyOrBenefit =
    /(phí ship|giao hàng|vận chuyển|freeship|miễn phí ship|bao lâu nhận|thanh toán|chuyển khoản|cod|đổi trả|hoàn tiền|quyền lợi|đồng kiểm|hủy đơn|bảo mật)/i.test(
      q
    );

  const isAskingBrandOrAdvantage =
    /(nguồn gốc|nông trại|vùng trồng|câu chuyện|aura coffee là|địa chỉ|hotline|liên hệ|số điện thoại shop|ở đâu|lợi thế|ưu điểm|khác biệt|rang mộc là gì)/i.test(
      q
    );

  const isAskingRecommendation =
    /(tư vấn|chọn|loại nào|ngon|đậm|mạnh|sữa đá|đen đá|phin|chua|thơm|arabica|robusta|espresso|pha máy|blend|quà|biếu|giá|menu|sản phẩm|mua|gợi ý|ít cafein|say cà phê|sơn la|đắk nông|honey)/i.test(
      q
    );

  let detectedIntent: ChatResponseData['intent'] = 'general';
  if (isAskingBrewing) detectedIntent = 'brewing_guide';
  else if (isAskingPolicyOrBenefit) detectedIntent = 'shipping_policy';
  else if (isAskingBrandOrAdvantage) detectedIntent = 'brand_story';
  else if (isAskingRecommendation) detectedIntent = 'recommendation';

  // 5. GỌI CLOUDFLARE WORKERS AI LLM (hoặc Gemini 2.5 Flash) VỚI NGỮ CẢNH ĐÃ TRUY XUẤT TỪ VECTOR DB
  const useInstantKnowledgeReply =
    isAskingBrewing || isAskingPolicyOrBenefit || isAskingBrandOrAdvantage;
  const llmRes = useInstantKnowledgeReply
    ? { reply: null, llmModelUsed: `${DEFAULT_CF_LLM_MODEL} (instant-knowledge)` }
    : await generateRagLLMResponse(
        c.env,
        message,
        history,
        ragSearchResult.topChunks,
        products,
        websiteContext,
        shippingFee,
        freeThreshold,
        customer?.full_name
      );

  // Nếu Workers AI LLM (hoặc Gemini) trả về câu trả lời thành công, kết hợp ngay với thẻ sản phẩm và RAG trace
  if (llmRes.reply) {
    const recommended =
      ragMatchedProducts.length > 0 ? ragMatchedProducts.slice(0, 3) : products.slice(0, 2);

    return {
      reply: llmRes.reply,
      intent: detectedIntent === 'general' && ragMatchedProducts.length > 0 ? 'recommendation' : detectedIntent,
      recommendedProducts:
        detectedIntent === 'shipping_policy' ? [] : recommended,
      suggestions: [
        '🫖 Tư vấn cà phê pha Phin đậm đà',
        '🌸 Cà phê Arabica thơm hương hoa quả',
        '🛡️ Quyền lợi & Chính sách đổi trả',
        '📦 Kiểm tra đơn hàng của tôi',
      ],
      rag: buildRagTrace(llmRes.llmModelUsed),
    };
  }

  // ============================================================================
  // 6. BỘ TỔNG HỢP TRI THỨC NỘI BỘ (KHI CHẠY LOCAL CHƯA KẾT NỐI CLOUDFLARE AI)
  // Vẫn đính kèm đầy đủ thông tin `rag` (Top Chunks từ Vector DB) và dữ liệu Knowledge Base
  // ============================================================================
  const synthModelName = `${c.env.CF_LLM_MODEL || DEFAULT_CF_LLM_MODEL} (rag-synthesizer)`;

  // 6.1. Hướng dẫn pha chế / Bảo quản
  if (isAskingBrewing) {
    if (/(cold brew|ủ lạnh)/i.test(q)) {
      const coldBrewProd =
        products.find((p) => p.slug.includes('cold-brew')) ||
        products.find((p) => p.slug.includes('arabica')) ||
        products[0];
      return {
        reply:
          '✨ **Công thức ủ Cold Brew thanh mát chuẩn Barista AURA COFFEE:**\n\n1. **Chọn hạt & Cỡ xay:** Dùng **Cold Brew Signature Blend** hoặc **Arabica Cầu Đất** xay thô (cỡ hạt đường kính lớn).\n2. **Tỷ lệ vàng 1:10:** 50g cà phê + 500ml nước lọc mát.\n3. **Thời gian ủ:** Khuấy nhẹ cho thấm đều, đậy kín và ủ trong ngăn mát tủ lạnh **16 – 20 tiếng**.\n4. **Thưởng thức:** Lọc qua giấy lọc, thêm đá hoặc một lát cam vàng / mật ong rừng cực kỳ cuốn!',
        intent: 'brewing_guide',
        recommendedProducts: coldBrewProd ? [coldBrewProd] : [],
        suggestions: [
          '🫖 Hướng dẫn pha Phin truyền thống',
          '🌸 Cách pha V60 / Pour Over',
          '📦 Bảo quản cà phê thế nào?',
        ],
        rag: buildRagTrace(synthModelName),
      };
    }

    if (/(v60|pour over|giấy lọc)/i.test(q)) {
      const arabica = products.find((p) => p.slug.includes('arabica')) || products[0];
      return {
        reply:
          '🌸 **Công thức pha Pour Over / V60 tôn hương hoa quả:**\n\n1. **Tỷ lệ 1:15:** 20g cà phê **Arabica Cầu Đất** hoặc **Arabica Sơn La** (xay vừa) + 300ml nước nóng **90°C – 92°C**.\n2. **Blooming (Ủ nở):** Rót 40ml nước đầu tiên, chờ **35 giây** để cà phê thoát khí CO2 tươi.\n3. **Chiết xuất:** Rót xoắn ốc nhẹ nhàng 2 đợt (đến 180ml và 300ml) trong tổng thời gian **2 phút 15 giây – 2 phút 30 giây**.',
        intent: 'brewing_guide',
        recommendedProducts: arabica ? [arabica] : [],
        suggestions: [
          '🫖 Cách pha Phin đậm đà',
          '🧊 Cách ủ Cold Brew tại nhà',
          '☕ Xem các dòng cà phê đặc sản',
        ],
        rag: buildRagTrace(synthModelName),
      };
    }

    if (/(bảo quản|giữ hương|hạn sử dụng|tủ lạnh)/i.test(q)) {
      return {
        reply:
          '🛡️ **Mẹo bảo quản cà phê rang mộc giữ trọn hương thơm:**\n\n• Luôn kéo kín khóa Zip sau khi lấy cà phê và bóp nhẹ để đẩy không khí thừa qua **Van 1 chiều** trên túi.\n• Để nơi khô ráo, thoáng mát (20°C – 28°C), tránh ánh nắng trực tiếp và **không bảo quản trong tủ lạnh** (vì cà phê dễ ngưng tụ ẩm và hút mùi thực phẩm).\n• Ngon nhất trong vòng **30 – 45 ngày** kể từ khi mở túi (hoặc 6 tháng từ ngày rang).',
        intent: 'brewing_guide',
        suggestions: [
          '🫖 Hướng dẫn pha Phin chuẩn vị',
          '☕ Tư vấn cà phê hợp gu của mình',
          '🛡️ Quyền lợi khách hàng tại AURA COFFEE',
        ],
        rag: buildRagTrace(synthModelName),
      };
    }

    const phinProducts = products.filter(
      (p) => p.slug.includes('phin') || p.slug.includes('robusta')
    );
    return {
      reply:
        '🫖 **Bí quyết pha Phin Việt Nam sánh đậm, hậu ngọt:**\n\n1. **Tráng phin:** Tráng phin nhôm bằng nước sôi để làm nóng đều.\n2. **Định lượng:** Cho **25g cà phê** (khoảng 1/2 phin), lắc nhẹ cho phẳng mặt rồi đặt nắp gài vừa tay (không nén quá chặt).\n3. **Ủ cà phê (Blooming):** Châm **20ml – 30ml nước sôi (92°C – 96°C)** vào ủ trong **1 – 2 phút** cho bột cà phê nở đều.\n4. **Chiết xuất:** Châm tiếp **50ml – 60ml nước sôi**, đậy nắp chờ từng giọt cà phê sánh đậm nhỏ xuống. Thêm đá hoặc 20ml sữa đặc là chuẩn vị!',
      intent: 'brewing_guide',
      recommendedProducts: phinProducts.slice(0, 2),
      suggestions: [
        '🧊 Cách ủ Cold Brew thanh mát',
        '🌸 Cách pha V60 / Pour Over',
        '📦 Kiểm tra đơn hàng của tôi',
      ],
      rag: buildRagTrace(synthModelName),
    };
  }

  // 6.2. Chính sách Giao hàng, Đổi trả & Quyền lợi khách hàng (Nâng cấp đầy đủ từ Knowledge Base)
  if (isAskingPolicyOrBenefit) {
    return {
      reply: `🚚 **Chính sách Giao hàng, Đổi trả & Quyền lợi Khách hàng tại AURA COFFEE:**\n\n• **Phí vận chuyển:** Đồng giá **${formatVND(shippingFee)}** toàn quốc. **Miễn phí vận chuyển (Freeship)** cho mọi đơn hàng từ **${formatVND(freeThreshold)}** trở lên!\n• **Thời gian nhận hàng:** Xử lý & rang xay mới trong 24h. Giao nội thành TP.HCM, Hà Nội & Đắk Lắk từ **1 – 2 ngày**; các tỉnh khác từ **2 – 4 ngày làm việc**.\n• **Quyền lợi Đồng kiểm & Thanh toán:** Hỗ trợ **COD** (được kiểm tra ngoại quan gói hàng nguyên niêm phong trước khi thanh toán) và **Chuyển khoản ngân hàng**.\n• **Quyền lợi Xay miễn phí:** Tùy chọn để **Nguyên hạt** hoặc xay miễn phí theo **5 cỡ chuẩn** (Pha Phin, Pha Máy Espresso, Pour Over V60, Cold Brew).\n• **Cam kết Đổi mới 100% trong 7 ngày:** Đổi mới miễn phí nếu bao bì rách, hở van 1 chiều hoặc giao nhầm loại hạt/cỡ xay.`,
      intent: 'shipping_policy',
      suggestions: [
        '☕ Tư vấn chọn cà phê hợp gu',
        '🌟 Lợi thế cà phê rang mộc AURA COFFEE',
        '📦 Kiểm tra đơn hàng của tôi',
      ],
      rag: buildRagTrace(synthModelName),
    };
  }

  // 6.3. Câu chuyện thương hiệu, Nguồn gốc & Lợi thế cạnh tranh (Nâng cấp từ Knowledge Base)
  if (isAskingBrandOrAdvantage) {
    return {
      reply:
        '🌱 **Về AURA COFFEE & những giá trị khác biệt:**\n\n1. **Cà phê rang nguyên bản:** Không tẩm bơ, không mỡ gà, không hương liệu hóa học, không độn bắp/đậu. Nước pha màu nâu hổ phách trong trẻo.\n2. **Vùng nguyên liệu tuyển chọn:** Robusta từ **Buôn Ma Thuột (Đắk Lắk)** & **Đắk Mil (Đắk Nông)**; Arabica từ **Cầu Đất (Đà Lạt)** & **Sơn La**.\n3. **Rang mẻ nhỏ:** Kiểm soát hồ sơ nhiệt riêng biệt để giữ vị ngọt hậu tự nhiên.\n4. **Bao bì có van 1 chiều:** Thoát khí CO2 tự nhiên, ngăn oxy xâm nhập.\n5. **Thông tin liên hệ:** Địa chỉ, số điện thoại, email và giờ làm việc chưa được cập nhật. Vui lòng tham khảo trang Liên hệ.',
      intent: 'brand_story',
      recommendedProducts: products.slice(0, 2),
      suggestions: [
        '🛡️ Quyền lợi khách hàng khi mua tại AURA COFFEE',
        '☕ Tư vấn loại cà phê bán chạy nhất',
        '🫖 Cà phê nào hợp pha Phin sữa đá?',
      ],
      rag: buildRagTrace(synthModelName),
    };
  }

  // 6.4. Tư vấn chọn cà phê theo gu thưởng thức (Kết hợp RAG Vector Search + Sommelier Filter)
  if (isAskingRecommendation) {
    if (/(quà|biếu|đối tác|lễ tết|hộp quà)/i.test(q)) {
      const giftMatched = products.filter(
        (p) => p.slug.includes('hop-qua') || p.category_id === 4
      );
      return {
        reply:
          '🎁 Nếu bạn đang tìm món quà sang trọng, đậm bản sắc Việt dành tặng đối tác hoặc người thân, mình gợi ý **Hộp Quà Tinh Hoa Cà Phê Việt (750g)**.\n\nSet quà gồm trọn bộ **3 gói 250g** tiêu biểu (*Robusta Buôn Ma Thuột, Arabica Cầu Đất, Blend Phin Việt*) kèm **Phin nhôm cao cấp** và cẩm nang pha chế trong hộp giấy mỹ thuật chỉn chu!',
        intent: 'recommendation',
        recommendedProducts: giftMatched.length > 0 ? giftMatched : products.slice(0, 2),
        suggestions: [
          '🚚 Mua hộp quà có được Freeship không?',
          '🫖 Tư vấn thêm dòng pha Phin đậm đà',
          '📦 Kiểm tra đơn hàng của tôi',
        ],
        rag: buildRagTrace(synthModelName),
      };
    }

    if (
      /(chua thanh|thơm|hoa quả|trái cây|ít cafein|say cà phê|nhẹ nhàng|arabica|v60|pour over|cold brew|sơn la)/i.test(
        q
      )
    ) {
      const matched = products.filter(
        (p) =>
          p.slug.includes('arabica') ||
          p.slug.includes('cold-brew') ||
          p.name.toLowerCase().includes('arabica')
      );
      return {
        reply:
          '🌸 Với gu thích **hương thơm thanh tao, vị chua thanh dịu của trái cây chín, hậu ngọt mật ong và êm dịu (hàm lượng cafein thấp, không gây say)**, mình đặc biệt gợi ý cho bạn:\n\n• **Arabica Cầu Đất (1.500m):** Hương hoa trắng, cam thảo, hậu ngọt mật ong.\n• **Arabica Sơn La Bourbon:** Hương táo đỏ, trà đen dịu mượt.\n• **Cold Brew Signature Blend:** Tối ưu để ủ lạnh 18h thanh mát hương cam vàng & mơ chín.\n\nCác dòng này cực kỳ hợp để pha **Pour Over (V60), Cold Brew, Pha Máy** hoặc phối trộn thêm vào Phin!',
        intent: 'recommendation',
        recommendedProducts: matched.length > 0 ? matched.slice(0, 3) : products.slice(0, 2),
        suggestions: [
          '🫖 Còn loại nào đậm đà pha Phin sữa đá?',
          '🧊 Cách ủ Cold Brew với Arabica Cầu Đất',
          '🚚 Mua bao nhiêu thì được Freeship?',
        ],
        rag: buildRagTrace(synthModelName),
      };
    }

    if (/(pha máy|espresso|latte|cappuccino|americano|crema)/i.test(q)) {
      const matched = products.filter(
        (p) => p.slug.includes('espresso') || p.slug.includes('arabica') || p.slug.includes('honey')
      );
      return {
        reply:
          '☕ Nếu bạn dùng **máy pha Espresso tại nhà, văn phòng hoặc quán**, dòng **Espresso House Blend** (tỷ lệ vàng 50% Arabica Cầu Đất Washed & 50% Fine Robusta Honey) là lựa chọn hoàn hảo nhất!\n\nKhi chiết xuất ở 9 bar cho lớp crema dày mịn màu hạt dẻ, hương hạt phỉ hòa quyện cacao nguyên chất, rất cân bằng cả khi uống **Espresso nguyên bản, Americano hay pha Latte/Cappuccino**.',
        intent: 'recommendation',
        recommendedProducts: matched.length > 0 ? matched.slice(0, 3) : products.slice(0, 2),
        suggestions: [
          '🫖 Tư vấn thêm dòng pha Phin đậm đà',
          '🛡️ Quyền lợi xay miễn phí 5 cấp độ',
          '🚚 Chính sách giao hàng toàn quốc',
        ],
        rag: buildRagTrace(synthModelName),
      };
    }

    if (/(đậm|mạnh|phin|sữa đá|đen đá|tỉnh táo|robusta|ít chua|không chua|truyền thống|đắk nông|honey)/i.test(q)) {
      const matched = products.filter(
        (p) => p.slug.includes('robusta') || p.slug.includes('phin')
      );
      return {
        reply:
          '🔥 Nếu bạn yêu thích **gu cà phê Việt truyền thống: đậm đà, sánh quyện, không chua, hậu ngọt sô-cô-la đen và giúp tỉnh táo tức thì**, bạn nhất định phải thử những dòng cà phê được tuyển chọn:\n\n1. **Robusta Buôn Ma Thuột:** 100% Robusta sẻ Đắk Lắk rang vừa đậm, thể chất dày dặn, cực kỳ mạnh mẽ.\n2. **Blend Phin Việt (70% Robusta – 30% Arabica):** Đậm vị truyền thống nhưng dậy tầng hương caramel & bơ hạt quyến rũ của Arabica Cầu Đất, pha **cà phê sữa đá** hay **đen đá** đều tuyệt hảo!\n3. **Fine Robusta Honey Đắk Nông:** Chế biến mật ong lên men tự nhiên, độ ngọt cao.',
        intent: 'recommendation',
        recommendedProducts: matched.length > 0 ? matched.slice(0, 3) : products.slice(0, 2),
        suggestions: [
          '🌸 Có loại nào thơm nhẹ, ít cafein hơn không?',
          '🫖 Hướng dẫn pha Phin sánh đậm',
          '📦 Kiểm tra đơn hàng của tôi',
        ],
        rag: buildRagTrace(synthModelName),
      };
    }

    // Tổng quan danh mục sản phẩm kết hợp kết quả từ RAG Vector DB
    const displayProducts =
      ragMatchedProducts.length > 0 ? ragMatchedProducts : products.slice(0, 4);
    const summaryLines = displayProducts
      .slice(0, 4)
      .map(
        (p, idx) =>
          `${idx + 1}. **${p.name}** (${p.origin}) — **${formatVND(p.sale_price ?? p.price)}** / gói ${p.weight_grams}g: *${p.tasting_notes}*`
      )
      .join('\n');

    return {
      reply: `☕ Hiện tại **AURA COFFEE** có các dòng cà phê tuyển chọn (hỗ trợ để **Nguyên hạt** hoặc **Xay miễn phí 5 cấp độ** theo phin/máy của bạn):\n\n${summaryLines}\n\nBạn thường thích uống **pha Phin đậm đà (đen đá/sữa đá)**, **pha Máy Espresso**, vị **thơm thanh nhẹ nhàng** hay tìm **Hộp quà biếu** để mình chọn đúng loại hợp gu nhất cho bạn nhé?`,
      intent: 'recommendation',
      recommendedProducts: displayProducts.slice(0, 4),
      suggestions: [
        '🫖 Mình thích pha Phin đậm đà, sữa đá',
        '🌸 Mình thích vị thơm thanh, ít đắng',
        '☕ Mình tìm cà phê pha máy Espresso',
        '🎁 Tư vấn Hộp quà tặng cà phê',
      ],
      rag: buildRagTrace(synthModelName),
    };
  }

  // 7. Nếu câu hỏi chung khác nhưng Vector DB tìm thấy Chunk có độ tương đồng cao (>= 0.35), trả lời dựa trên Top Chunk
  const bestChunk = ragSearchResult.topChunks[0];
  if (bestChunk && bestChunk.score >= 0.35 && q.length >= 6) {
    return {
      reply: `💡 Theo thông tin từ hệ thống tri thức **AURA COFFEE**:\n\n${bestChunk.content}\n\nBạn cần mình tư vấn chi tiết hơn về dòng hạt cà phê nào hay kiểm tra đơn hàng không ạ?`,
      intent: 'general',
      recommendedProducts:
        ragMatchedProducts.length > 0 ? ragMatchedProducts.slice(0, 2) : products.slice(0, 2),
      suggestions: [
        '🫖 Tư vấn cà phê pha Phin đậm đà',
        '🛡️ Quyền lợi & Chính sách đổi trả',
        '📦 Kiểm tra đơn hàng của tôi',
      ],
      rag: buildRagTrace(synthModelName),
    };
  }

  // 8. Lời chào hoặc phản hồi mặc định thân thiện kèm gợi ý thông minh
  const greetingName = customer ? ` **${customer.full_name}**` : '';
  return {
    reply: `Xin chào${greetingName}! 👋 Mình là **Trợ lý Barista AI của AURA COFFEE** (vận hành trên nền tảng **RAG Vector DB + Cloudflare Workers AI**).\n\nMình có thể giúp bạn:\n• ☕ **Tư vấn chọn hạt cà phê** hợp gu (Pha Phin truyền thống, Sữa đá, Pha máy Espresso, Pour Over V60 hay Cold Brew).\n• 🛡️ **Giải đáp Quyền lợi, Lợi thế & Chính sách** (Xay miễn phí 5 cấp độ, Freeship từ 500k, Đồng kiểm COD, Đổi mới 7 ngày).\n• 📦 **Tra cứu trạng thái đơn hàng** tức thì bằng Số điện thoại hoặc Mã đơn.\n\nHôm nay bạn đang tìm hương vị cà phê như thế nào ạ?`,
    intent: 'greeting',
    recommendedProducts: products.slice(0, 2),
    suggestions: [
      '🫖 Tư vấn cà phê pha Phin đậm đà',
      '🌸 Cà phê Arabica thơm hương hoa quả',
      '🛡️ Quyền lợi & Chính sách đổi trả',
      '🌟 Lợi thế cà phê rang mộc AURA COFFEE',
      '📦 Kiểm tra đơn hàng của tôi',
    ],
    rag: buildRagTrace(synthModelName),
  };
}
