# Tài Liệu API — AURA COFFEE (`/api/v1`)

Tất cả các endpoint đều trả về định dạng JSON nhất quán:

**Thành công:**
```json
{
  "success": true,
  "data": {},
  "message": "Thành công"
}
```

**Lỗi:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ"
  }
}
```

---

## 1. Public APIs

| Phương thức | Đường dẫn | Mô tả & Tham số |
|---|---|---|
| `GET` | `/api/v1/health` | Kiểm tra trạng thái hoạt động của Worker, kết nối D1 và Workers KV |
| `GET` | `/api/v1/categories` | Lấy danh sách danh mục đang hiển thị kèm số lượng sản phẩm |
| `GET` | `/api/v1/categories/:slug` | Lấy chi tiết danh mục và danh sách sản phẩm thuộc danh mục |
| `GET` | `/api/v1/products` | Lấy danh sách sản phẩm. Hỗ trợ: `?page=1&limit=12&q=...&category=...&minPrice=...&maxPrice=...&inStock=true&sort=featured\|price_asc\|price_desc\|rating\|newest` |
| `GET` | `/api/v1/products/featured` | Lấy 4 sản phẩm nổi bật hiển thị trên Trang chủ |
| `GET` | `/api/v1/products/search?q=...` | Tìm kiếm nhanh sản phẩm theo tên, SKU, vùng trồng hoặc hương vị |
| `GET` | `/api/v1/products/:slug` | Lấy chi tiết sản phẩm theo slug kèm biến thể, ảnh phụ, đánh giá và sản phẩm liên quan |
| `GET` | `/api/v1/banners` | Lấy danh sách banner đang kích hoạt |
| `GET` | `/api/v1/content/home` | Tổng hợp dữ liệu Trang chủ (Hero, Story, Sản phẩm nổi bật, Đánh giá, Blog, Cấu hình phí ship) |
| `GET` | `/api/v1/reviews` | Lấy danh sách đánh giá khách hàng đã duyệt |
| `GET` | `/api/v1/blog` | Lấy danh sách bài viết Cẩm nang cà phê |
| `GET` | `/api/v1/blog/:slug` | Lấy nội dung chi tiết bài viết |
| `POST` | `/api/v1/orders` | Đặt hàng mới. Kiểm tra `idempotency_key`, tính lại giá từ D1, trừ kho nguyên tử và lưu lịch sử trạng thái |
| `GET` | `/api/v1/orders/track?code=...&phone=...` | Tra cứu tiến độ đơn hàng theo mã đơn (và số điện thoại tùy chọn) |
| `POST` | `/api/v1/newsletter/subscribe` | Đăng ký nhận bản tin qua email (tích hợp honeypot chống spam) |
| `GET` | `/api/v1/media/:key` | Đọc và phân phối ảnh công khai từ Cloudflare Workers KV kèm `Cache-Control` và `ETag` |

---

## 2. Admin APIs (Yêu cầu xác thực phiên quản trị `aura_admin_session`)

| Phương thức | Đường dẫn | Mô tả chức năng |
|---|---|---|
| `POST` | `/api/v1/admin/auth/login` | Đăng nhập quản trị viên (có Rate Limit chống brute-force, thiết lập cookie `HttpOnly`) |
| `POST` | `/api/v1/admin/auth/logout` | Đăng xuất và xóa phiên trong bảng `sessions` của D1 |
| `GET` | `/api/v1/admin/auth/me` | Kiểm tra thông tin quản trị viên hiện tại |
| `GET` | `/api/v1/admin/dashboard?days=30` | Thống kê thực tế từ D1: Doanh thu, số đơn, biểu đồ doanh thu theo ngày, sản phẩm bán chạy, tồn kho thấp |
| `GET` | `/api/v1/admin/products` | Danh sách toàn bộ sản phẩm cho Admin |
| `POST` | `/api/v1/admin/products` | Tạo sản phẩm mới trong D1 |
| `PUT` | `/api/v1/admin/products/:id` | Cập nhật sản phẩm & tự động ghi nhận biến động tồn kho nếu số lượng thay đổi |
| `DELETE` | `/api/v1/admin/products/:id` | Xóa sản phẩm (hoặc chuyển sang ngừng bán nếu sản phẩm đã từng có trong đơn hàng) |
| `GET / POST / PUT / DELETE` | `/api/v1/admin/categories` | CRUD danh mục sản phẩm (chặn xóa danh mục đang chứa sản phẩm) |
| `GET` | `/api/v1/admin/orders` | Danh sách đơn hàng (lọc theo `status`, `q`, `from`, `to`) |
| `GET` | `/api/v1/admin/orders/:id` | Chi tiết đơn hàng kèm snapshot sản phẩm và lịch sử trạng thái |
| `PATCH` | `/api/v1/admin/orders/:id/status` | Cập nhật trạng thái đơn hàng theo state machine hợp lệ; tự động hoàn kho nếu chuyển sang `cancelled` |
| `POST` | `/api/v1/admin/uploads` | Tải tệp hình ảnh (JPG/PNG/WebP/AVIF/SVG <= 5MB) lên Cloudflare Workers KV |
| `DELETE` | `/api/v1/admin/uploads/:key` | Xóa tệp hình ảnh khỏi Cloudflare Workers KV |
| `GET / PUT` | `/api/v1/admin/banners` & `/api/v1/admin/content/:key` | Quản lý nội dung Hero và cấu hình phí vận chuyển |
| `GET` | `/api/v1/admin/newsletter` | Xem danh sách email đăng ký nhận bản tin |
