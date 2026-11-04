import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Upload, Save } from 'lucide-react';
import { productFormSchema, type ProductFormInput } from '../../../shared/validators';
import {
  useAdminProductById,
  useAdminCategories,
  useSaveAdminProduct,
} from '../../hooks/useQueries';
import { api } from '../../services/api';
import { useToast } from '../../components/ToastContext';

function slugifyVi(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const productId = id ? Number(id) : undefined;

  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: categories } = useAdminCategories();
  const { data: existingProduct, isLoading } = useAdminProductById(productId);
  const saveMutation = useSaveAdminProduct();

  const [uploadingKV, setUploadingKV] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      category_id: 1,
      name: '',
      slug: '',
      sku: 'AURA-NEW-250',
      origin: 'Buôn Ma Thuột, Đắk Lắk',
      roast_level: 'Rang vừa (Medium Roast)',
      process_method: 'Rang mộc nguyên bản',
      tasting_notes: 'Đậm đà • Sô-cô-la đen • Hậu ngọt',
      short_description: '',
      description: '',
      price: 165000,
      sale_price: null,
      stock: 50,
      weight_grams: 250,
      button_color: '#4A2E24',
      badge_text: 'Mới',
      is_featured: 1,
      is_active: 1,
      image_url: '/images/product-house-blend.png',
      image_key: null,
    },
  });

  useEffect(() => {
    if (existingProduct) {
      reset({
        category_id: existingProduct.category_id,
        name: existingProduct.name,
        slug: existingProduct.slug,
        sku: existingProduct.sku,
        origin: existingProduct.origin,
        roast_level: existingProduct.roast_level,
        process_method: existingProduct.process_method,
        tasting_notes: existingProduct.tasting_notes,
        short_description: existingProduct.short_description,
        description: existingProduct.description,
        price: existingProduct.price,
        sale_price: existingProduct.sale_price ?? null,
        stock: existingProduct.stock,
        weight_grams: existingProduct.weight_grams,
        button_color: existingProduct.button_color || '#4A2E24',
        badge_text: existingProduct.badge_text || '',
        is_featured: existingProduct.is_featured,
        is_active: existingProduct.is_active,
        image_url: existingProduct.image_url,
        image_key: existingProduct.image_key || null,
      });
    }
  }, [existingProduct, reset]);

  const currentImageUrl = watch('image_url');

  const handleKVFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingKV(true);
    try {
      const uploaded = await api.uploadImageToKV(file, 'products');
      setValue('image_url', uploaded.url, { shouldValidate: true });
      setValue('image_key', uploaded.key);
      showToast('Đã tải ảnh lên Cloudflare Workers KV thành công!');
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải ảnh lên Workers KV', 'error');
    } finally {
      setUploadingKV(false);
    }
  };

  const onSubmit = async (values: ProductFormInput) => {
    try {
      await saveMutation.mutateAsync({ id: productId, payload: values });
      showToast(isEdit ? 'Đã cập nhật sản phẩm!' : 'Đã tạo sản phẩm mới!');
      navigate('/admin/products');
    } catch (err: any) {
      showToast(err.message || 'Không thể lưu sản phẩm.', 'error');
    }
  };

  if (isEdit && isLoading) {
    return <div className="p-8 text-sm text-[#777067]">Đang tải thông tin sản phẩm...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-1.5 text-xs text-[#777067] hover:text-[#171512] mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại danh sách sản phẩm
        </Link>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512]">
          {isEdit ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Cà Phê Mới'}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-8 space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Tên sản phẩm *
            </label>
            <input
              type="text"
              {...register('name', {
                onChange: (e) => {
                  if (!isEdit) {
                    setValue('slug', slugifyVi(e.target.value));
                  }
                },
              })}
              placeholder="Ví dụ: Robusta Buôn Ma Thuột"
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Đường dẫn tĩnh (Slug) *
            </label>
            <input
              type="text"
              {...register('slug')}
              placeholder="robusta-buon-ma-thuot"
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm font-mono"
            />
            {errors.slug && <p className="text-xs text-red-600 mt-1">{errors.slug.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Danh mục *
            </label>
            <select
              {...register('category_id')}
              className="w-full px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            >
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Mã SKU *
            </label>
            <input
              type="text"
              {...register('sku')}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm font-mono"
            />
            {errors.sku && <p className="text-xs text-red-600 mt-1">{errors.sku.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Vùng nguyên liệu *
            </label>
            <input
              type="text"
              {...register('origin')}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Giá bán (VND) *
            </label>
            <input
              type="number"
              {...register('price')}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
            {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Giá khuyến mãi (VND)
            </label>
            <input
              type="number"
              {...register('sale_price')}
              placeholder="Để trống nếu không giảm"
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Tồn kho (Gói) *
            </label>
            <input
              type="number"
              {...register('stock')}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Khối lượng (gram)
            </label>
            <input
              type="number"
              {...register('weight_grams')}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Mức độ rang *
            </label>
            <input
              type="text"
              {...register('roast_level')}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Phương pháp sơ chế
            </label>
            <input
              type="text"
              {...register('process_method')}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Ghi chú hương vị *
            </label>
            <input
              type="text"
              {...register('tasting_notes')}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>
        </div>

        {/* Workers KV Image Upload Section */}
        <div className="p-4 rounded bg-[#F7F2EA] border border-[#E6DED3] space-y-3">
          <label className="block text-xs font-semibold text-[#171512]">
            Hình ảnh bao bì sản phẩm (Lưu trữ trên Cloudflare Workers KV) *
          </label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {currentImageUrl && (
              <img
                src={currentImageUrl}
                alt="Preview"
                className="w-24 h-24 rounded object-cover border border-[#E6DED3] bg-white"
              />
            )}
            <div className="flex-1 space-y-2 w-full">
              <input
                type="text"
                {...register('image_url')}
                placeholder="/images/product-house-blend.png hoặc URL từ Workers KV"
                className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-white text-xs"
              />
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#4A2E24] text-[#FFFDF9] text-xs font-semibold cursor-pointer hover:bg-[#3A231B]">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingKV ? 'Đang tải lên Workers KV...' : 'Tải ảnh từ máy tính lên Workers KV'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={handleKVFileUpload}
                    disabled={uploadingKV}
                    className="hidden"
                  />
                </label>
                {watch('image_key') && (
                  <span className="text-[11px] font-mono text-[#183B2D]">
                    KV Key: {watch('image_key')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#171512] mb-1">
            Mô tả ngắn *
          </label>
          <textarea
            rows={2}
            {...register('short_description')}
            className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
          />
          {errors.short_description && (
            <p className="text-xs text-red-600 mt-1">{errors.short_description.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#171512] mb-1">
            Mô tả chi tiết *
          </label>
          <textarea
            rows={4}
            {...register('description')}
            className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
          />
          {errors.description && (
            <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Nhãn nổi bật (Badge)
            </label>
            <input
              type="text"
              {...register('badge_text')}
              placeholder="Bán chạy nhất / Đặc sản"
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Hiển thị Trang chủ
            </label>
            <select
              {...register('is_featured')}
              className="w-full px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            >
              <option value={1}>Có (Nổi bật)</option>
              <option value={0}>Không</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Trạng thái kinh doanh
            </label>
            <select
              {...register('is_active')}
              className="w-full px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            >
              <option value={1}>Đang mở bán</option>
              <option value={0}>Tạm ngừng bán</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-[#E6DED3] flex items-center justify-end gap-3">
          <Link
            to="/admin/products"
            className="px-4 py-2.5 rounded border border-[#E6DED3] text-sm text-[#171512]"
          >
            Hủy
          </Link>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saveMutation.isPending ? 'Đang lưu...' : 'Lưu sản phẩm'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
