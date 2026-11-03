# Quy Trình Triển Khai Lên Cloudflare Pages — AURA COFFEE

Ứng dụng này được cấu hình là **Cloudflare Pages** với Pages Functions (Hono Worker), D1, Workers KV, Workers AI và Vectorize. Không dùng lệnh `wrangler deploy` dành cho Workers.

---

### Bước 1: Cài Node.js LTS và npm
Cài đặt Node.js phiên bản LTS (khuyến nghị Node.js >= 20 hoặc 22/24) và kiểm tra:
```bash
node -v
npm -v
```

### Bước 2: Cài đặt dependencies
Tại thư mục gốc của dự án:
```bash
npm install
```

### Bước 3: Chạy website tại môi trường Local
```bash
npm run dev
```
Lệnh trên khởi chạy Vite kết hợp `@cloudflare/vite-plugin`, tự động mô phỏng Cloudflare Workers runtime, D1 SQLite và Workers KV Storage ngay trên máy local.

### Bước 4: Đăng nhập Cloudflare bằng Wrangler
```bash
npx wrangler login
```
Trình duyệt sẽ mở trang xác thực tài khoản Cloudflare của bạn.

### Bước 5: Tạo cơ sở dữ liệu Cloudflare D1
```bash
npx wrangler d1 create moc-coffee-db
```
Lệnh này trả về thông tin `database_id` (định dạng UUID).

### Bước 6: Cập nhật `database_id` vào cấu hình `wrangler.jsonc`
Mở tệp `wrangler.jsonc` và Thay `database_id` trong cấu hình bằng ID vừa nhận được:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "moc-coffee-db",
    "database_id": "5f8f3bde-67f5-46f8-94d5-745ea375393b"
  }
],
"kv_namespaces": [
    {
      "binding": "KV",
      "id": "<your-kv-namespace-id>"
    }
  ]
```

### Bước 7: Tạo Cloudflare Vectorize Index & Workers KV Namespace
```bash
# Tạo Vectorize Index 1024 chiều cho AI
npx wrangler vectorize create moc-coffee-vector-index --dimensions=1024 --metric=cosine
npm run seed:vectorize

# Tạo KV Namespace cho Media Assets
npx wrangler kv:namespace create moc-coffee-kv-assets
npm run seed:kv
```

### Bước 8: Kiểm tra cấu hình Binding trong `wrangler.jsonc`
Đảm bảo `wrangler.jsonc` có đầy đủ các bindings:
- `DB` (D1 Database: `moc-coffee-db`)
- `KV` (Workers KV Namespace: `moc-coffee-kv-assets`)
- `AI` (Workers AI)
- `VECTORIZE` (Vectorize index: `moc-coffee-vector-index`)

### Bước 9: Chạy Migration cho D1 tại Local
```bash
npm run db:migrate:local
```

### Bước 10: Seed dữ liệu mẫu cho môi trường Development (Local)
```bash
npm run db:seed
```
*(Lưu ý: Không chạy lệnh seed mẫu đè lên cơ sở dữ liệu Production đang vận hành thực tế. Nếu muốn khởi tạo danh mục sản phẩm ban đầu trên Production mới tinh, kiểm tra kỹ nội dung `seeds/seed.sql` trước khi thực thi).*

### Bước 11: Cấu hình Secrets và Bootstrap tài khoản Admin trên Production
Trước lần truy cập đầu tiên vào API trên database mới, hãy thêm `ADMIN_BOOTSTRAP_EMAIL` và `ADMIN_BOOTSTRAP_PASSWORD` tại Pages project `aura-coffee` → **Settings → Variables and Secrets**. Đặt mật khẩu dưới dạng secret. Tuyệt đối không lưu mật khẩu trong `wrangler.jsonc` hay Git.
Có thể cấu hình bằng Wrangler:
```bash
npx wrangler pages secret put ADMIN_BOOTSTRAP_EMAIL --project-name aura-coffee
npx wrangler pages secret put ADMIN_BOOTSTRAP_PASSWORD --project-name aura-coffee
```
Không dùng giá trị mật khẩu mặc định ở local cho Production.

### Bước 12: Chạy Migration tạo bảng trên D1 Production
```bash
npm run db:migrate:prod
```

### Bước 13: Build Frontend & Backend Bundle
```bash
npm run build
```
Lệnh này tạo React SPA và Pages Function tại `dist/_worker.js`. Kiểm tra kiểu và test riêng bằng `npm run typecheck && npm test`.

### Bước 14: Deploy lên Cloudflare Pages
**Khuyến nghị — kết nối GitHub:** Trong Cloudflare Dashboard, tạo Pages project từ repository và cấu hình:
- Production branch: `main`
- Root directory: `/` (hoặc để trống)
- Build command: `npm run build`
- Build output directory: `dist`
- Để trống Deploy command tùy chỉnh; Pages sẽ tự xuất bản sau khi build.

**Triển khai thủ công bằng Wrangler:**
```bash
npx wrangler pages deploy dist --project-name aura-coffee
```
Trang web sẽ có URL dạng `https://aura-coffee-<suffix>.pages.dev`.

### Bước 15: Cấu hình Custom Domain và HTTPS
1. Truy cập **Cloudflare Dashboard** → **Workers & Pages** → chọn Pages project `aura-coffee`.
2. Vào mục **Custom domains** và thêm tên miền của bạn.
3. Nhập tên miền của bạn (ví dụ: `moccoffee.vn` hoặc `shop.moccoffee.vn`). Cloudflare sẽ tự động cấp chứng chỉ SSL/TLS (HTTPS).

### Bước 16: Kiểm tra API trên Production
Mở trình duyệt hoặc chạy `curl`:
```bash
curl https://aura-coffee-<suffix>.pages.dev/api/v1/health
```
Kết quả trả về `"status": "healthy"`, `"d1Connected": true`, `"kvConnected": true`.

### Bước 17: Kiểm tra dữ liệu Database D1
```bash
npx wrangler d1 execute moc-coffee-db --remote --command "SELECT COUNT(*) as total_tables FROM sqlite_master WHERE type='table';"
```

### Bước 18: Kiểm tra đăng nhập Admin
Truy cập `/admin/login` và đăng nhập bằng `ADMIN_BOOTSTRAP_EMAIL` và `ADMIN_BOOTSTRAP_PASSWORD` đã cài đặt ở Bước 11.

### Bước 19: Kiểm tra Upload và phân phối ảnh trên Cloudflare Workers KV
Trong giao diện Admin (`/admin/products/new` hoặc `/admin/content`), tải lên một hình ảnh sản phẩm và kiểm tra đường dẫn `/api/v1/media/products/...` hiển thị ảnh kèm header `Cache-Control: public, max-age=31536000, immutable`.

### Bước 20: Kiểm tra luồng Đặt hàng và trừ Tồn kho
Thực hiện đặt thử 1 đơn hàng trên `/checkout`, nhận mã đơn `MOC-...`, kiểm tra số lượng tồn kho sản phẩm giảm tương ứng và đơn hàng xuất hiện trong `/admin/orders`.

### Bước 21: Kiểm tra giao diện Responsive trên Production
Mở trang web trên điện thoại di động (375px/390px) và máy tính xách tay (1366px/1440px) để nghiệm thu tốc độ tải và bố cục hiển thị.
