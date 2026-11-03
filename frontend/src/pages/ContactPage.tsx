import React, { useState } from 'react';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import { useToast } from '../components/ToastContext';

export default function ContactPage() {
  const { showToast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    showToast('Cảm ơn bạn! Đội ngũ AURA COFFEE sẽ phản hồi trong vòng 24 giờ làm việc.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="max-w-2xl mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A65F3B] font-semibold mb-2">
          KẾT NỐI CÙNG AURA COFFEE
        </p>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
          Liên Hệ &amp; Hợp Tác Cung Cấp Cà Phê
        </h1>
        <p className="text-sm text-[#777067] mt-2">
          Chúng tôi luôn sẵn sàng tư vấn dòng cà phê phù hợp cho gia đình, văn phòng hoặc quán cà phê của bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-[#183B2D] text-[#FFFDF9] rounded-lg p-6 sm:p-8 space-y-6">
          <h2 className="font-serif-display text-2xl font-bold">Thông Tin Liên Hệ</h2>

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#E5B287] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#FFFDF9]">Xưởng rang &amp; Văn phòng:</strong>
                <span className="text-[#F7F2EA]/80 text-xs">
                  [Cập nhật địa chỉ văn phòng/xưởng rang]
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#E5B287] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#FFFDF9]">Hotline CSKH:</strong>
                <span className="text-[#F7F2EA]/80 text-xs">[Cập nhật số điện thoại liên hệ]</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-[#E5B287] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#FFFDF9]">Email:</strong>
                <span className="text-[#F7F2EA]/80 text-xs">[Cập nhật email liên hệ]</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#E5B287] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#FFFDF9]">Thời gian làm việc:</strong>
                <span className="text-[#F7F2EA]/80 text-xs">[Cập nhật thời gian làm việc]</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-8">
          <h2 className="font-serif-display text-2xl font-bold text-[#171512] mb-5">
            Gửi Lời Nhắn Cho AURA COFFEE
          </h2>
          {submitted ? (
            <div className="p-6 rounded bg-[#F7F2EA] border border-[#E6DED3] text-center">
              <p className="font-semibold text-[#183B2D] mb-1">Đã nhận thông tin liên hệ!</p>
              <p className="text-xs text-[#777067]">
                Cảm ơn bạn đã quan tâm đến AURA COFFEE. Chúng tôi sẽ liên hệ lại sớm nhất.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1">
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0901234567"
                    className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171512] mb-1">
                  Nội dung cần tư vấn *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Tư vấn chọn cà phê pha phin / pha máy hoặc báo giá sỉ cho quán..."
                  className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 rounded bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9] text-sm font-semibold cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Gửi tin nhắn
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
