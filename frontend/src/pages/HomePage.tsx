import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Leaf,
  Truck,
  Flame,
  Globe,
  Users,
  Sprout,
  ShieldCheck,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { useHomeData } from '../hooks/useQueries';
import { ProductCard } from '../components/ProductCard';
import { api } from '../services/api';
import { useToast } from '../components/ToastContext';

export default function HomePage() {
  const { data, isLoading, isError } = useHomeData();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submittingNewsletter, setSubmittingNewsletter] = useState(false);
  const [newsletterMsg, setNewsletterMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterMsg(null);

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNewsletterMsg({
        type: 'error',
        text: 'Vui lòng nhập địa chỉ email hợp lệ (ví dụ: ban@email.com).',
      });
      return;
    }

    setSubmittingNewsletter(true);
    try {
      const res = await api.subscribeNewsletter(trimmed, honeypot);
      const msg = res.alreadySubscribed
        ? 'Email này đã có trong danh sách cộng đồng AURA COFFEE!'
        : 'Đăng ký thành công! Cảm ơn bạn đã đồng hành cùng AURA COFFEE.';
      setNewsletterMsg({ type: 'success', text: msg });
      showToast(msg, 'success');
      setEmail('');
    } catch (err: any) {
      setNewsletterMsg({
        type: 'error',
        text: err.message || 'Không thể đăng ký lúc này. Vui lòng thử lại sau.',
      });
    } finally {
      setSubmittingNewsletter(false);
    }
  };

  const featuredProducts = data?.featuredProducts || [];
  const reviews = data?.reviews || [];

  return (
    <div>
      {/* 1. HERO SECTION */}
      <section className="relative min-h-[600px] lg:min-h-[680px] flex flex-col justify-between bg-[#171512] text-[#FFFDF9] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero-bg.png"
            alt="AURA COFFEE — Đậm vị nguyên bản – Trọn từng khoảnh khắc."
            className="hidden sm:block w-full h-full object-cover object-right"
          />
          <div className="hidden sm:block absolute inset-0 bg-gradient-to-r from-[#171512]/90 via-[#171512]/55 to-[#171512]/15 lg:from-[#171512]/85 lg:via-[#171512]/35 lg:to-transparent" />
          <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-[#171512]/75 via-transparent to-[#171512]/25" />
        </div>

        {/* Handwritten Script Accent (Desktop top right like reference image) */}
        <div
          aria-hidden="true"
          className="hidden xl:block absolute top-28 right-12 z-10 text-right font-handwriting text-3xl leading-tight text-[#F7F2EA]/75 -rotate-6 select-none pointer-events-none"
        >
          <p>AURA COFFEE</p>
          <p>Vị nguyên bản</p>
          <p>Trọn khoảnh khắc</p>
        </div>

        {/* Main Hero Content */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-12">
          <div className="max-w-xl">
            <p className="text-xs sm:text-sm uppercase tracking-[0.25em] text-[#E5B287] font-medium mb-4">
              AURA COFFEE · CÀ PHÊ TUYỂN CHỌN
            </p>

            <h1 className="font-serif-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.12] tracking-tight text-[#FFFDF9]">
              Đậm vị
              <br />
              nguyên bản –
              <br />
              <span className="text-[#E5B287]">Trọn từng khoảnh khắc.</span>
            </h1>

            <p className="mt-5 text-sm sm:text-base text-[#F7F2EA]/85 leading-relaxed max-w-lg">
              Từ những vùng nguyên liệu trù phú đến tách cà phê mỗi sáng — chọn hương vị dành riêng cho bạn.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-[#A65F3B] hover:bg-[#8F4F2F] text-[#FFFDF9] text-sm font-semibold transition-all duration-200 shadow-lg shadow-black/20 hover:-translate-y-0.5"
              >
                <span>Khám phá cà phê</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/about"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg border border-[#F7F2EA]/45 hover:border-[#FFFDF9] hover:bg-white/10 text-[#FFFDF9] text-sm font-medium transition-colors"
              >
                Câu chuyện của chúng tôi
              </Link>
            </div>

            <div className="sm:hidden relative mt-8 h-44 overflow-hidden rounded-xl border border-white/15 shadow-xl shadow-black/20">
              <img
                src="/images/hero-bg.png"
                alt="Túi cà phê AURA COFFEE Robusta Buôn Ma Thuột"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#171512]/55 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-[#171512]/65 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#F7F2EA] backdrop-blur-sm">
                Robusta · Buôn Ma Thuột
              </span>
            </div>
          </div>
        </div>

        {/* 4 Advantages Strip inside bottom of Hero */}
        <div className="relative z-10 border-t border-white/15 bg-[#171512]/70 backdrop-blur-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-[#E5B287]/40 flex items-center justify-center text-[#E5B287] shrink-0">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#FFFDF9]">
                    Nguồn gốc minh bạch
                  </p>
                  <p className="text-[11px] text-[#F7F2EA]/65">
                    Buôn Ma Thuột &amp; Cầu Đất
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-[#E5B287]/40 flex items-center justify-center text-[#E5B287] shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#FFFDF9]">
                    Giao hàng toàn quốc
                  </p>
                  <p className="text-[11px] text-[#F7F2EA]/65">
                    Đóng gói van 1 chiều giữ hương
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-[#E5B287]/40 flex items-center justify-center text-[#E5B287] shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#FFFDF9]">
                    Rang mới mỗi ngày
                  </p>
                  <p className="text-[11px] text-[#F7F2EA]/65">
                    Rang mộc mẻ nhỏ chuẩn xác
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-[#E5B287]/40 flex items-center justify-center text-[#E5B287] shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#FFFDF9]">
                    Hướng đến bền vững
                  </p>
                  <p className="text-[11px] text-[#F7F2EA]/65">
                    Bao bì Kraft thân thiện
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BỘ SƯU TẬP SẢN PHẨM NỔI BẬT */}
      <section className="py-14 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#777067] font-semibold mb-2">
              BỘ SƯU TẬP CỦA CHÚNG TÔI
            </p>
            <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512] leading-tight">
              Tìm Hương Vị Cà Phê Của Bạn
            </h2>
            <p className="text-sm text-[#777067] mt-2 max-w-xl">
              Khám phá những hạt cà phê được tuyển chọn cho từng phong cách thưởng thức.
            </p>
          </div>

          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4A2E24] hover:text-[#A65F3B] transition-colors shrink-0"
          >
            <span>Xem tất cả sản phẩm</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="bg-[#FFFDF9] border border-[#E6DED3] rounded-md p-4 h-96 animate-pulse"
              >
                <div className="aspect-square bg-[#E6DED3]/60 rounded mb-4" />
                <div className="h-4 bg-[#E6DED3] rounded w-2/3 mb-2" />
                <div className="h-3 bg-[#E6DED3]/70 rounded w-1/2 mb-4" />
                <div className="h-9 bg-[#E6DED3] rounded mt-auto" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-8 text-center">
            <p className="text-sm text-red-700">
              Không thể tải danh sách sản phẩm. Vui lòng tải lại trang.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 3. CÂU CHUYỆN THƯƠNG HIỆU (Split section matching reference image) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
        <div className="rounded-lg overflow-hidden border border-[#E6DED3] bg-[#FFFDF9] grid grid-cols-1 lg:grid-cols-12 shadow-xs">
          {/* Left + Center image area (8 cols) */}
          <div className="lg:col-span-8 relative grid grid-cols-1 md:grid-cols-12 bg-[#F3ECE1]">
            <div className="md:col-span-6 p-6 sm:p-10 flex flex-col justify-center z-10">
              <p className="text-xs uppercase tracking-[0.2em] text-[#777067] font-semibold mb-2">
                CÂU CHUYỆN AURA COFFEE
              </p>
              <h2 className="font-serif-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#171512] leading-tight">
                Từ Đất Việt,
                <br />
                Đến Tách Cà Phê Mỗi Ngày.
              </h2>
              <p className="mt-4 text-sm text-[#4A2E24]/90 leading-relaxed">
                Chúng tôi trân trọng mối liên kết bền chặt giữa người trồng cà phê tại vùng đất đỏ bazan Tây Nguyên, người thợ rang tâm huyết và những người yêu vị cà phê nguyên bản mỗi sáng.
              </p>
              <p className="mt-2.5 text-xs text-[#777067] leading-relaxed">
                Từng mẻ hạt được rang mộc có kiểm soát nhiệt độ để tôn vinh trọn vẹn hương thơm tự nhiên đặc trưng của văn hóa thưởng thức cà phê Việt Nam.
              </p>
              <div className="mt-6">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-medium transition-colors"
                >
                  <span>Tìm hiểu hành trình</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="md:col-span-6 relative min-h-[260px] md:min-h-full">
              <img
                src="/images/our-story-farmer.png"
                alt="Minh họa vùng trồng cà phê vùng cao nguyên"
                loading="lazy"
                className="w-full h-full object-cover object-center"
              />
              <div className="hidden md:block absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#F3ECE1] to-transparent" />
            </div>
          </div>

          {/* Right Dark Green Values Column (4 cols) */}
          <div className="lg:col-span-4 bg-[#183B2D] text-[#FFFDF9] p-6 sm:p-9 flex flex-col justify-center space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full border border-white/25 flex items-center justify-center text-[#E5B287] shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[#FFFDF9]">
                  Tôn trọng người trồng
                </h3>
                <p className="text-xs text-[#F7F2EA]/75 mt-1 leading-relaxed">
                  Đồng hành và đề cao giá trị lao động của các nông hộ canh tác cà phê tại địa phương.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full border border-white/25 flex items-center justify-center text-[#E5B287] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[#FFFDF9]">
                  Chú trọng chất lượng
                </h3>
                <p className="text-xs text-[#F7F2EA]/75 mt-1 leading-relaxed">
                  Tuyển chọn hạt kỹ lưỡng, rang mộc không phụ gia để giữ hương vị thuần khiết.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full border border-white/25 flex items-center justify-center text-[#E5B287] shrink-0">
                <Sprout className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[#FFFDF9]">
                  Hạn chế tác động môi trường
                </h3>
                <p className="text-xs text-[#F7F2EA]/75 mt-1 leading-relaxed">
                  Ưu tiên bao bì giấy Kraft tối giản và khuyến khích thói quen tiêu dùng bền vững.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ĐÁNH GIÁ KHÁCH HÀNG ("Người Thật. Hương Vị Thật.") */}
      <section className="pb-14 sm:pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#777067] font-semibold mb-1.5">
              KHÁCH HÀNG CHIA SẺ
            </p>
            <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
              Người Thật. Hương Vị Thật.
            </h2>
          </div>

          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4A2E24] hover:text-[#A65F3B]"
          >
            <span>Trải nghiệm ngay</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-[#FFFDF9] border border-[#E6DED3] rounded-md p-5 flex items-start gap-4 shadow-2xs"
            >
              <img
                src={review.avatar_url}
                alt={review.author_name}
                loading="lazy"
                className="w-16 h-16 rounded-full object-cover border border-[#E6DED3] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-[#171512]/90 italic leading-relaxed">
                  &ldquo;{review.comment}&rdquo;
                </p>

                <div className="flex items-center gap-0.5 mt-2.5 text-[#D99B26]">
                  {Array.from({ length: review.rating }).map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-[#D99B26]" />
                  ))}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[#171512]">
                    {review.author_name}
                  </span>
                  {Boolean(review.is_verified_purchase) && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#A65F3B] font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      {review.is_sample_dev ? 'Đánh giá mẫu (Dev)' : 'Đã xác minh mua hàng'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. NEWSLETTER SECTION ("Gia Nhập Hội Yêu Cà Phê") */}
      <section className="relative bg-[#183B2D] text-[#FFFDF9] overflow-hidden">
        <img
          src="/images/newsletter-leaves.png"
          alt="Lá cà phê trang trí cho AURA COFFEE"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#171512]/85 via-[#183B2D]/85 to-[#171512]/85" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#FFFDF9]">
                Gia Nhập Hội Yêu Cà Phê
              </h2>
              <p className="text-xs sm:text-sm text-[#F7F2EA]/80 mt-1.5">
                Nhận ưu đãi đặc biệt, câu chuyện cà phê và sản phẩm mới nhất từ AURA COFFEE.
              </p>
            </div>

            <div className="w-full lg:max-w-md">
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2.5" noValidate>
                {/* Honeypot anti-spam field */}
                <input
                  type="text"
                  name="company_website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  className="hidden"
                />

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập địa chỉ email của bạn..."
                  aria-label="Địa chỉ email nhận bản tin"
                  className="flex-1 px-4 py-3 rounded bg-[#FFFDF9] text-[#171512] placeholder-[#777067] text-sm focus:outline-none focus:ring-2 focus:ring-[#A65F3B]"
                />
                <button
                  type="submit"
                  disabled={submittingNewsletter}
                  className="px-6 py-3 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer shrink-0"
                >
                  {submittingNewsletter ? 'Đang gửi...' : 'Đăng ký'}
                </button>
              </form>

              {newsletterMsg && (
                <p
                  className={`mt-2 text-xs font-medium ${
                    newsletterMsg.type === 'success' ? 'text-[#95D5B2]' : 'text-red-300'
                  }`}
                >
                  {newsletterMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
