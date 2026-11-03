# Quy Trình Triển Khai Lên Cloudflare (21 Bước Đầy Đủ) — AURA COFFEE

Tài liệu này hướng dẫn từng bước từ cài đặt môi trường Local cho đến khi triển khai hoàn chỉnh lên hạ tầng **Cloudflare Workers + D1 + Workers KV** mà không phụ thuộc vào máy tính cá nhân sau khi deploy.

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

### Bước 5: Tạo cơ sở dữ liệu Cloudflare D1 trên Production
```bash
npx wrangler d1 create moc-coffee-db
```
Lệnh này trả về thông tin `database_id` (định dạng UUID).

### Bước 6: Cập nhật `database_id` vào cấu hình `wrangler.jsonc`
Mở tệp `wrangler.jsonc` và thay thế giá trị `REPLACE_WITH_YOUR_D1_DATABASE_ID` bằng `database_id` thật vừa nhận được ở Bước 5:
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
npx wrangler vectorize create moc-coffee-vectors --dimensions=1024 --metric=cosine
npm run seed:vectorize

# Tạo KV Namespace cho Media Assets
npx wrangler kv:namespace create moc-coffee-kv-assets
npm run seed:kv
```

### Bước 7b: Cấu hình KV Namespace
```bash
npx wrangler kv:namespace create moc-coffee-kv-assets
```

### Bước 8: Kiểm tra cấu hình Binding trong `wrangler.jsonc`
Đảm bảo `wrangler.jsonc` có đầy đủ 3 bindings:
- `DB` (D1 Database: `moc-coffee-db`)
- `KV` (Workers KV Namespace: `moc-coffee-kv-assets`)
- `ASSETS` (Workers Static Assets: `./dist/client`)

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
Tuyệt đối không lưu mật khẩu Admin trong `wrangler.jsonc` hay Git. Hãy chạy lệnh sau để thiết lập biến mật trên Cloudflare:
```bash
npx wrangler secret put ADMIN_BOOTSTRAP_EMAIL
npx wrangler secret put ADMIN_BOOTSTRAP_PASSWORD
```
Ngoài ra, khi triển khai Production, cập nhật biến `"ENVIRONMENT": "production"` trong mục `"vars"` của `wrangler.jsonc`.

### Bước 12: Chạy Migration tạo bảng trên D1 Production
```bash
npm run db:migrate:prod
```

### Bước 13: Build Frontend & Backend Bundle
```bash
npm run build
```
Lệnh này kiểm tra kiểu TypeScript (`tsc --noEmit`), đóng gói Worker (`dist/moc_coffee/`) và đóng gói React SPA (`dist/client/`).

### Bước 14: Deploy toàn bộ hệ thống (Worker + Static Assets) lên Cloudflare
```bash
npx wrangler deploy
```
Sau khi hoàn tất, Wrangler sẽ cung cấp địa chỉ dạng `https://moc-coffee.<subdomain>.workers.dev`.

### Bước 15: Cấu hình Custom Domain và HTTPS
1. Truy cập **Cloudflare Dashboard** → **Workers & Pages** → chọn **moc-coffee**.
2. Vào mục **Settings** → **Domains & Routes** → bấm **Add** → **Custom Domain**.
3. Nhập tên miền của bạn (ví dụ: `moccoffee.vn` hoặc `shop.moccoffee.vn`). Cloudflare sẽ tự động cấp chứng chỉ SSL/TLS (HTTPS).

### Bước 16: Kiểm tra API trên Production
Mở trình duyệt hoặc chạy `curl`:
```bash
curl https://moc-coffee.<subdomain>.workers.dev/api/v1/health
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
