import React from 'react';
import { useParams, Link } from 'react-router-dom';

const POLICIES: Record<string, { title: string; content: string }> = {
  'chinh-sach-giao-hang': {
    title: 'Chính Sách Giao Hàng',
    content: `1. Phạm vi áp dụng:
AURA COFFEE hỗ trợ giao hàng tận nơi trên toàn quốc thông qua các đối tác vận chuyển tiêu chuẩn.

2. Thời gian xử lý & giao hàng dự kiến:
- Đơn hàng được xác nhận và đóng gói trong vòng 24 giờ làm việc.
- Khu vực nội thành TP.HCM & Đắk Lắk: dự kiến 1 – 2 ngày làm việc.
- Các tỉnh/thành phố khác: dự kiến 2 – 4 ngày làm việc.

3. Phí vận chuyển (cấu hình mặc định trên hệ thống):
- Phí vận chuyển tiêu chuẩn tạm tính: 30.000₫/đơn hàng.
- Hỗ trợ miễn phí vận chuyển đối với đơn hàng có giá trị tạm tính từ 500.000₫ trở lên.
(Lưu ý: Mức phí vận chuyển cụ thể được hiển thị rõ tại trang Thanh toán trước khi quý khách xác nhận đặt hàng).`,
  },
  'chinh-sach-doi-tra': {
    title: 'Chính Sách Đổi Trả & Hoàn Tiền',
    content: `1. Điều kiện hỗ trợ đổi trả:
Quý khách được kiểm tra ngoại quan gói hàng khi nhận (COD). AURA COFFEE hỗ trợ đổi mới 100% trong vòng 7 ngày kể từ ngày nhận hàng nếu:
- Sản phẩm bị rách bao bì, hở van hoặc hư hỏng trong quá trình vận chuyển.
- Giao sai dòng sản phẩm, sai khối lượng hoặc sai kiểu xay so với đơn đặt hàng.

2. Quy trình thực hiện:
- Vui lòng liên hệ trang Liên hệ kèm mã đơn hàng AURA và hình ảnh sản phẩm thực tế để được xử lý nhanh chóng.`,
  },
  'chinh-sach-bao-mat': {
    title: 'Chính Sách Bảo Mật Thông Tin',
    content: `1. Mục đích thu thập thông tin:
AURA COFFEE chỉ thu thập họ tên, số điện thoại, địa chỉ giao hàng và email (nếu có) nhằm mục đích xử lý đơn đặt hàng, giao nhận sản phẩm và tra cứu lịch sử đơn hàng.

2. Cam kết bảo mật:
- Dữ liệu đơn hàng được lưu trữ an toàn trên hạ tầng cơ sở dữ liệu Cloudflare D1.
- Không chia sẻ, mua bán thông tin cá nhân của khách hàng cho bên thứ ba ngoài đơn vị vận chuyển thực hiện giao đơn hàng đó.`,
  },
};

export default function PolicyPage() {
  const { slug = 'chinh-sach-giao-hang' } = useParams<{ slug: string }>();
  const policy = POLICIES[slug] || POLICIES['chinh-sach-giao-hang'];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(POLICIES).map(([key, item]) => (
          <Link
            key={key}
            to={`/policies/${key}`}
            className={`px-4 py-2 rounded text-xs font-semibold ${
              key === slug
                ? 'bg-[#4A2E24] text-[#FFFDF9]'
                : 'bg-[#FFFDF9] border border-[#E6DED3] text-[#171512]'
            }`}
          >
            {item.title}
          </Link>
        ))}
      </div>

      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-10">
        <h1 className="font-serif-display text-3xl font-bold text-[#171512] mb-6">
          {policy.title}
        </h1>
        <div className="text-sm sm:text-base text-[#171512]/85 leading-relaxed whitespace-pre-line">
          {policy.content}
        </div>
      </div>
    </div>
  );
}
