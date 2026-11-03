import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Sprout, Users, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16">
      {/* Hero Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-10">
        <div className="lg:col-span-6 space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A65F3B] font-semibold">
            CÂU CHUYỆN THƯƠNG HIỆU
          </p>
          <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#171512] leading-tight">
            Từ Đất Việt, Đến Tách Cà Phê Mỗi Ngày.
          </h1>
          <p className="text-sm sm:text-base text-[#171512]/80 leading-relaxed">
            <strong>AURA COFFEE</strong> theo đuổi trải nghiệm cà phê nguyên bản, trân trọng giá trị của hạt cà phê Việt và đồng hành cùng những khoảnh khắc thường ngày.
          </p>
          <p className="text-sm text-[#777067] leading-relaxed">
            Từ những triền đồi đất đỏ bazan đầy nắng gió tại Buôn Ma Thuột (Đắk Lắk) cho đến vùng cao nguyên sương phủ Cầu Đất (Đà Lạt), mỗi hạt cà phê đều mang trong mình câu chuyện của thổ nhưỡng và bàn tay chăm sóc tận tụy.
          </p>
          <div className="pt-2">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 rounded bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9] text-sm font-semibold"
            >
              <span>Khám phá bộ sưu tập</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        <div className="lg:col-span-6">
          <img
            src="/images/our-story-farmer.png"
            alt="Hành trình hạt cà phê Việt Nam"
            className="w-full h-80 sm:h-96 object-cover rounded-md border border-[#E6DED3]"
          />
        </div>
      </div>

      {/* 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 space-y-3">
          <div className="w-11 h-11 rounded-full bg-[#183B2D] text-[#E5B287] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h2 className="font-serif-display text-xl font-bold text-[#171512]">
            Gắn Kết Cùng Nông Hộ
          </h2>
          <p className="text-sm text-[#777067] leading-relaxed">
            Chúng tôi ưu tiên nguồn hạt thu hái chín đỏ từ các vùng trồng truyền thống tại Đắk Lắk, Đắk Nông và Lâm Đồng, cung cấp thông tin rõ ràng về giống hạt và phương pháp sơ chế trên từng bao bì.
          </p>
        </div>

        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 space-y-3">
          <div className="w-11 h-11 rounded-full bg-[#4A2E24] text-[#E5B287] flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
          <h2 className="font-serif-display text-xl font-bold text-[#171512]">
            Nghệ Thuật Rang Mộc Mẻ Nhỏ
          </h2>
          <p className="text-sm text-[#777067] leading-relaxed">
            Không tẩm bơ, không hương liệu nhân tạo. AURA COFFEE chú trọng cách rang phù hợp với từng dòng hạt để tôn lên hương thơm tự nhiên và hậu vị đặc trưng.
          </p>
        </div>

        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 space-y-3">
          <div className="w-11 h-11 rounded-full bg-[#A65F3B] text-[#FFFDF9] flex items-center justify-center">
            <Sprout className="w-5 h-5" />
          </div>
          <h2 className="font-serif-display text-xl font-bold text-[#171512]">
            Văn Hóa Phin &amp; Hiện Đại
          </h2>
          <p className="text-sm text-[#777067] leading-relaxed">
            Dù bạn yêu thích ly cà phê phin sữa đá đậm đà mỗi sáng hay tách Pour Over, Espresso thanh tao nơi công sở, AURA COFFEE luôn có lựa chọn phù hợp với cách thưởng thức của bạn.
          </p>
        </div>
      </div>
    </div>
  );
}
