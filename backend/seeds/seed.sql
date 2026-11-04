-- ============================================================================
-- AURA COFFEE — DEVELOPMENT SEED DATA (Cloudflare D1)
-- Chỉ sử dụng cho môi trường Development / Demo. Không ghi đè dữ liệu Production.
-- ============================================================================

-- 1. Danh mục sản phẩm (categories)
INSERT OR IGNORE INTO categories (id, name, slug, description, image_url, is_active, sort_order)
VALUES
  (1, 'Cà Phê Phin Truyền Thống', 'ca-phe-phin', 'Đậm đà, hậu ngọt sâu, chuẩn gu phin Việt truyền thống từ vùng đất đỏ Bazan.', '/images/product-house-blend.png', 1, 1),
  (2, 'Cà Phê Hạt Đặc Sản (Specialty)', 'ca-phe-dac-san', 'Tuyển chọn hạt chín đỏ từ vùng cao Cầu Đất và Tây Nguyên, hương hoa quả thanh tao.', '/images/product-colombia.png', 1, 2),
  (3, 'Cà Phê Pha Máy (Espresso)', 'ca-phe-pha-may', 'Phối trộn cân bằng giữa độ đậm của Robusta và hương thơm quyến rũ của Arabica.', '/images/product-ethiopia.png', 1, 3),
  (4, 'Bộ Quà Tặng & Phin Pha', 'qua-tang-phu-kien', 'Set quà tặng cà phê rang mộc sang trọng dành cho đối tác và người thân.', '/images/product-sumatra.png', 1, 4);

-- 2. Sản phẩm (products) - 4 sản phẩm nổi bật mặc định + 4 sản phẩm mở rộng
INSERT OR IGNORE INTO products (
  id, category_id, name, slug, sku, origin, roast_level, process_method,
  tasting_notes, short_description, description,
  price, sale_price, stock, weight_grams, button_color, badge_text,
  is_featured, is_active, rating_avg, reviews_count, image_url
)
VALUES
  (
    1, 1,
    'Robusta Buôn Ma Thuột',
    'robusta-buon-ma-thuot',
    'MOC-RBM-250',
    'Buôn Ma Thuột, Đắk Lắk',
    'Rang vừa đậm (Medium-Dark)',
    'Chế biến khô tự nhiên (Natural)',
    'Đậm đà • Sô-cô-la đen • Hậu ngọt sâu',
    '100% hạt Robusta tuyển chọn từ vùng đất đỏ bazan Buôn Ma Thuột, thể chất dày dặn, lớp crema sánh mịn.',
    'Được thu hoạch từ những nông hộ canh tác lâu năm tại Buôn Ma Thuột, Đắk Lắk ở độ cao 500m – 600m. Hạt cà phê được phân loại kỹ lưỡng, phơi giàn tự nhiên và rang mộc không tẩm ướp, giữ trọn hương vị sô-cô-la đen, hạt dẻ nướng cùng hậu vị ngọt dịu kéo dài rất hợp với gu cà phê phin sữa đá hoặc cà phê đen truyền thống.',
    145000, 129000, 85, 250, '#183B2D', 'Bán chạy nhất',
    1, 1, 4.9, 142, '/images/product-house-blend.png'
  ),
  (
    2, 2,
    'Arabica Cầu Đất',
    'arabica-cau-dat',
    'MOC-ACD-250',
    'Cầu Đất, Đà Lạt (1.500m)',
    'Rang sáng vừa (Light-Medium)',
    'Chế biến ướt (Fully Washed)',
    'Hương hoa trắng • Cam thảo • Chua thanh',
    'Tinh hoa Arabica vùng cao Cầu Đất với hương thơm thanh thoát của trái cây chín, vị chua thanh dịu và hậu ngọt mật ong.',
    'Sinh trưởng trong sương mù quanh năm ở độ cao trên 1.500m tại Cầu Đất, Đà Lạt, hạt Arabica mang cấu trúc hương vị tinh tế và phức hợp. Phù hợp tuyệt vời cho phương pháp Pour Over (V60), Cold Brew hoặc pha máy hiện đại, mở ra tầng hương cam vàng, trà bá tước và đường nâu.',
    210000, 189000, 60, 250, '#A65F3B', 'Đặc sản vùng cao',
    1, 1, 4.8, 98, '/images/product-colombia.png'
  ),
  (
    3, 1,
    'Blend Phin Việt',
    'blend-phin-viet',
    'MOC-BPV-250',
    'Đắk Lắk & Lâm Đồng',
    'Rang vừa đậm (Medium-Dark)',
    'Phối trộn truyền thống 70/30',
    'Cân bằng • Caramel • Thơm nồng nàn',
    'Tỷ lệ vàng 70% Robusta Buôn Ma Thuột và 30% Arabica Cầu Đất, mang lại tách cà phê phin hài hòa cả hương lẫn vị.',
    'Blend Phin Việt được tuyển chọn dành riêng cho phin truyền thống Việt Nam. Sự kết hợp giữa độ đậm mạnh mẽ của Robusta Đắk Lắk và hương thơm quyến rũ của Arabica Cầu Đất tạo nên giọt cà phê sánh quyện, thơm nồng hương caramel cháy và bơ hạt.',
    165000, NULL, 110, 250, '#171512', 'Chuẩn gu Phin',
    1, 1, 4.9, 215, '/images/product-ethiopia.png'
  ),
  (
    4, 3,
    'Espresso House Blend',
    'espresso-house-blend',
    'MOC-EHB-250',
    'Tây Nguyên, Việt Nam',
    'Rang vừa (Medium Roast)',
    'Chế biến Honey & Washed',
    'Sánh mịn • Hạt phỉ • Cacao nguyên chất',
    'Thiết kế chuyên biệt cho máy pha Espresso tại nhà và văn phòng với lớp crema dày màu hạt dẻ quyến rũ.',
    'Espresso House Blend là bản giao hưởng cân bằng giữa 50% Arabica chế biến ướt và 50% Fine Robusta chế biến mật ong (Honey). Khi chiết xuất qua máy Espresso, sản phẩm cho lớp crema dày mịn, vị chua nhẹ cân bằng cùng vị ngọt tự nhiên rất hợp khi pha Latte, Cappuccino hay Americano.',
    185000, 169000, 72, 250, '#4A2E24', 'Pha máy hoàn hảo',
    1, 1, 4.8, 164, '/images/product-sumatra.png'
  ),
  (
    5, 2,
    'Fine Robusta Honey Đắk Nông',
    'fine-robusta-honey-dak-nong',
    'MOC-FRH-250',
    'Đắk Mil, Đắk Nông',
    'Rang vừa (Medium Roast)',
    'Chế biến mật ong (Yellow Honey)',
    'Trái cây nhiệt đới • Mật mía • Dày vị',
    'Dòng Fine Robusta lên men tự nhiên giữ lại lớp thịt quả ngọt ngào, mang đến góc nhìn hoàn toàn mới về hạt Robusta Việt.',
    'Thu hái 100% trái chín đỏ và sơ chế theo phương pháp Yellow Honey trên giàn phơi nhà kính. Sản phẩm có độ ngọt tự nhiên cao, hương mít chín nhẹ nhàng kết hợp cùng vị cacao đặc trưng.',
    195000, NULL, 45, 250, '#183B2D', 'Micro-Lot',
    0, 1, 4.9, 54, '/images/product-house-blend.png'
  ),
  (
    6, 2,
    'Arabica Sơn La Bourbon',
    'arabica-son-la-bourbon',
    'MOC-ASL-250',
    'Mường Chanh, Sơn La',
    'Rang sáng (Light Roast)',
    'Chế biến ướt (Washed)',
    'Táo đỏ • Trà đen • Dịu mượt',
    'Hạt cà phê vùng Tây Bắc với hương thơm thảo mộc dịu nhẹ, hậu vị thanh sạch kéo dài.',
    'Cà phê Arabica trồng dưới tán cây ăn quả tại Sơn La mang sắc thái thanh tao, vị chua dịu tựa táo chín và hậu vị ngọt mát như trà ô long.',
    220000, 199000, 38, 250, '#A65F3B', 'Mùa vụ mới',
    0, 1, 4.7, 41, '/images/product-colombia.png'
  ),
  (
    7, 3,
    'Cold Brew Signature Blend',
    'cold-brew-signature-blend',
    'MOC-CBS-250',
    'Cầu Đất & Quảng Trị',
    'Rang sáng vừa (Light-Medium)',
    'Natural & Washed',
    'Cam vàng • Mơ chín • Thanh mát',
    'Phối trộn tối ưu để ủ lạnh 16–24 giờ tại nhà, cho ra bình Cold Brew thơm ngát hương trái cây nhiệt đới.',
    'Khi ủ lạnh cùng nước tinh khiết, Cold Brew Signature Blend giải phóng hương thơm cam vàng, quả mơ và vị ngọt thanh không hề gắt cổ, giúp bạn tỉnh táo suốt ngày dài.',
    190000, NULL, 64, 250, '#171512', 'Ủ lạnh 18h',
    0, 1, 4.8, 76, '/images/product-ethiopia.png'
  ),
  (
    8, 4,
    'Hộp Quà Tinh Hoa Cà Phê Việt',
    'hop-qua-tinh-hoa-ca-phe-viet',
    'MOC-GIFT-750',
    'Buôn Ma Thuột & Cầu Đất',
    'Đa dạng mức rang',
    'Tuyển chọn 3 dòng cà phê tiêu biểu',
    'Sang trọng • Đậm bản sắc • Quà tặng ý nghĩa',
    'Bộ sưu tập gồm 3 gói 250g (Robusta Buôn Ma Thuột, Arabica Cầu Đất, Blend Phin Việt) kèm phin nhôm cao cấp.',
    'Món quà tinh tế dành tặng đối tác, khách hàng và người thân yêu cà phê. Hộp giấy mỹ thuật thân thiện môi trường kèm cẩm nang hướng dẫn pha chế chi tiết từ AURA COFFEE.',
    490000, 445000, 30, 750, '#4A2E24', 'Quà tặng cao cấp',
    0, 1, 5.0, 62, '/images/product-sumatra.png'
  );

-- 3. Biến thể sản phẩm (product_variants)
INSERT OR IGNORE INTO product_variants (id, product_id, name, sku, grind_type, weight_grams, price, sale_price, stock)
VALUES
  (1, 1, 'Gói 250g - Nguyên hạt', 'MOC-RBM-250-WB', 'Nguyên hạt', 250, 145000, 129000, 50),
  (2, 1, 'Gói 250g - Xay pha Phin', 'MOC-RBM-250-PHIN', 'Xay pha Phin', 250, 145000, 129000, 35),
  (3, 2, 'Gói 250g - Nguyên hạt', 'MOC-ACD-250-WB', 'Nguyên hạt', 250, 210000, 189000, 40),
  (4, 2, 'Gói 250g - Xay Pour Over', 'MOC-ACD-250-PO', 'Xay Pour Over / Drip', 250, 210000, 189000, 20),
  (5, 3, 'Gói 250g - Xay pha Phin', 'MOC-BPV-250-PHIN', 'Xay pha Phin', 250, 165000, NULL, 70),
  (6, 4, 'Gói 250g - Xay pha Máy', 'MOC-EHB-250-ESP', 'Xay pha Máy (Espresso)', 250, 185000, 169000, 45);

-- 4. Banner trang chủ (banners)
INSERT OR IGNORE INTO banners (
  id, title, subtitle, eyebrow,
  cta_primary_text, cta_primary_link,
  cta_secondary_text, cta_secondary_link,
  image_url, position, is_active, sort_order
)
VALUES (
  1,
  'Đậm vị nguyên bản – Trọn từng khoảnh khắc.',
  'Từ những vùng nguyên liệu trù phú đến tách cà phê mỗi sáng — chọn hương vị dành riêng cho bạn.',
  'GOOD COFFEE, BETTER DAYS',
  'Khám phá cà phê',
  '/shop',
  'Câu chuyện của chúng tôi',
  '/about',
  '/images/hero-bg.png',
  'hero',
  1,
  1
);

-- 5. Nội dung trang chủ & cấu hình vận chuyển (site_content)
INSERT OR IGNORE INTO site_content (section_key, title, subtitle, content_json)
VALUES
  (
    'hero_section',
    'Đậm vị nguyên bản – Trọn từng khoảnh khắc.',
    'Khám phá những dòng cà phê tuyển chọn và tìm hương vị dành riêng cho bạn.',
    '{"eyebrow":"AURA COFFEE · CÀ PHÊ TUYỂN CHỌN","primaryCta":"Khám phá cà phê","secondaryCta":"Câu chuyện của chúng tôi","advantages":["Nguồn gốc minh bạch","Giao hàng toàn quốc","Rang mới mỗi ngày","Hướng đến phát triển bền vững"]}'
  ),
  (
    'story_section',
    'Từ Đất Việt, Đến Tách Cà Phê Mỗi Ngày.',
    'AURA COFFEE trân trọng hạt cà phê bản địa Việt Nam — nơi đất đỏ bazan Tây Nguyên và sương mù Cầu Đất kết tinh trong từng mẻ rang mộc.',
    '{"ctaText":"Tìm hiểu hành trình","values":[{"title":"Tôn trọng người trồng","desc":"Hợp tác trực tiếp và minh bạch thông tin vùng trồng tại Đắk Lắk, Lâm Đồng."},{"title":"Chú trọng chất lượng","desc":"Rang mộc 100% theo mẻ nhỏ, ghi nhận hồ sơ nhiệt độ rõ ràng cho từng dòng hạt."},{"title":"Hạn chế tác động môi trường","desc":"Sử dụng bao bì giấy Kraft dễ phân hủy và khuyến khích tái sử dụng hũ đựng tại nhà."}]}'
  ),
  (
    'shipping_config',
    'Cấu hình vận chuyển tạm tính',
    'Áp dụng toàn quốc (cấu hình có thể điều chỉnh trong Admin)',
    '{"defaultFee":30000,"freeThreshold":500000,"note":"Phí vận chuyển hiển thị là mức cấu hình mặc định trên hệ thống và sẽ được xác nhận khi xử lý đơn hàng."}'
  );

-- 6. Đánh giá mẫu cho môi trường Development (reviews) - đánh dấu rõ is_sample_dev = 1
INSERT OR IGNORE INTO reviews (
  id, product_id, author_name, avatar_url, rating, comment, product_name, is_verified_purchase, is_sample_dev, is_approved
)
VALUES
  (
    1, 1,
    'Minh Anh N.',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80',
    5,
    'Mùi thơm cà phê rang mộc rất tự nhiên, pha phin buổi sáng dậy mùi khắp phòng làm việc. Hậu vị ngọt dịu chứ không bị gắt.',
    'Robusta Buôn Ma Thuột',
    1, 1, 1
  ),
  (
    2, 2,
    'Hoàng Nam T.',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80',
    5,
    'Arabica Cầu Đất pha V60 lên hương cam thảo và hoa trắng rất rõ. Bao bì giấy Kraft chỉn chu, có van 1 chiều bảo quản hạt tốt.',
    'Arabica Cầu Đất',
    1, 1, 1
  ),
  (
    3, 3,
    'Thu Hà L.',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80',
    5,
    'Mình mua Blend Phin Việt và hộp quà tặng đối tác, ai cũng khen cà phê đậm đà chuẩn vị truyền thống mà đóng gói rất sang trọng.',
    'Blend Phin Việt',
    1, 1, 1
  );

-- 7. Bài viết cẩm nang cà phê (blog_posts)
INSERT OR IGNORE INTO blog_posts (id, title, slug, excerpt, content, cover_image, category, reading_time, is_published)
VALUES
  (
    1,
    'Bí Quyết Pha Cà Phê Phin Ngon Đậm Đà Chuẩn Vị Tại Nhà',
    'bi-quyet-pha-ca-phe-phin-ngon-tai-nha',
    'Chỉ với 5 phút mỗi sáng cùng tỷ lệ nước và nhiệt độ chuẩn xác, bạn có thể chiết xuất tách cà phê phin sánh mịn, hậu ngọt sâu.',
    'Pha cà phê phin là một nét văn hóa thưởng thức chậm rãi của người Việt. Để có một tách phin ngon từ hạt cà phê rang mộc:\n\n1. **Chọn cỡ xay phù hợp**: Bột cà phê pha phin nên có độ mịn vừa phải (tương tự hạt muối tinh). Nếu xay quá mịn nước sẽ khó chảy, nếu quá thô cà phê sẽ nhạt.\n2. **Tráng nóng phin**: Luôn tráng phin bằng nước sôi trước khi cho bột cà phê vào để ổn định nhiệt độ chiết xuất.\n3. **Ủ cà phê (Blooming)**: Rót khoảng 20ml nước sôi (92°C - 96°C) đều khắp bề mặt và chờ 1–2 phút cho bột cà phê nở đều.\n4. **Chiết xuất**: Rót thêm 50ml–60ml nước theo vòng tròn từ tâm ra ngoài, đậy nắp và tận hưởng từng giọt cà phê tí tách rơi.',
    '/images/hero-bg.png',
    'Nghệ Thuật Pha Chế',
    '4 phút đọc',
    1
  ),
  (
    2,
    'Sự Khác Biệt Giữa Robusta Buôn Ma Thuột Và Arabica Cầu Đất',
    'su-khac-biet-giua-robusta-buon-ma-thuot-va-arabica-cau-dat',
    'Khám phá đặc trưng thổ nhưỡng, độ cao và hương vị của hai vùng nguyên liệu cà phê danh tiếng bậc nhất Việt Nam.',
    'Việt Nam sở hữu hai vùng trồng cà phê có điều kiện tự nhiên đối lập nhưng bổ trợ hoàn hảo cho nhau:\n\n- **Robusta Buôn Ma Thuột (Đắk Lắk)**: Sinh trưởng trên tầng đất đỏ bazan màu mỡ ở độ cao 500–600m với nắng gió Tây Nguyên. Hạt có hàm lượng caffeine cao, thể chất (body) dày dặn, vị đắng êm và hương sô-cô-la đen, hạt dẻ.\n- **Arabica Cầu Đất (Đà Lạt)**: Nằm ở độ cao trên 1.500m quanh năm mây phủ. Trái cà phê chín chậm tích tụ đường và axit hữu cơ tự nhiên, tạo nên hương hoa trắng, trái cây có múi và vị chua thanh tao nhã.',
    '/images/our-story-farmer.png',
    'Vùng Nguyên Liệu',
    '6 phút đọc',
    1
  ),
  (
    3,
    'Cà Phê Rang Mộc Là Gì? Cách Nhận Biết Cà Phê Nguyên Chất',
    'ca-phe-rang-moc-la-gi-cach-nhan-biet',
    'Tìm hiểu vì sao cà phê rang mộc không tẩm bơ hay hương liệu ngày càng được người yêu cà phê Việt lựa chọn cho sức khỏe.',
    'Cà phê rang mộc là hạt cà phê được rang hoàn toàn bằng nhiệt độ kiểm soát mà không thêm bơ, mỡ gà, caramel hay hương liệu tổng hợp.\n\n- **Màu bột và nước**: Bột cà phê rang mộc có màu nâu cánh gián tự nhiên, nước pha ra có màu nâu hổ phách trong trẻo chứ không đen đặc sánh quánh.\n- **Lớp bọt**: Khi đánh mạnh với đường hoặc sữa, bọt có màu nâu sáng, mịn và nhanh tan tự nhiên.\n- **Cảm giác sau khi uống**: Mang lại sự tỉnh táo êm dịu, hậu vị ngọt tự nhiên ở cổ họng và thân thiện với dạ dày.',
    '/images/product-colombia.png',
    'Kiến Thức Cà Phê',
    '5 phút đọc',
    1
  );
