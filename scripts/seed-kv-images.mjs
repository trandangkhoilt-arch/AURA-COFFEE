import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.resolve(__dirname, '../frontend/public/images');

console.log('=== AURA COFFEE - ĐỒNG BỘ ẢNH LÊN CLOUDFLARE WORKERS KV ===');
console.log(`Đang đọc thư mục hình ảnh: ${imagesDir}`);

if (!fs.existsSync(imagesDir)) {
  console.error('Không tìm thấy thư mục ảnh!');
  process.exit(1);
}

const files = fs.readdirSync(imagesDir);
console.log(`Tìm thấy ${files.length} tệp hình ảnh mẫu:`);

const imagesList = [];
for (const file of files) {
  const filePath = path.join(imagesDir, file);
  const stat = fs.statSync(filePath);
  if (stat.isFile()) {
    const ext = path.extname(file).toLowerCase();
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
        ? 'image/webp'
        : 'application/octet-stream';
    const folder = file.startsWith('hero') || file.startsWith('newsletter') ? 'banners' : 'products';
    const kvKey = `${folder}/${file}`;
    imagesList.push({ file, filePath, size: stat.size, mime, kvKey });
    console.log(`  - ${file} (${(stat.size / 1024).toFixed(1)} KB) -> KV Key: "${kvKey}"`);
  }
}

console.log('\n--- HƯỚNG DẪN ĐỒNG BỘ LÊN CLOUDFLARE WORKERS KV THẬT ---');
console.log('1. Lấy KV Namespace ID từ bảng điều khiển Cloudflare hoặc chạy:');
console.log('   npx wrangler kv:namespace list');
console.log('2. Đẩy từng tệp ảnh lên Workers KV:');
imagesList.forEach(({ filePath, kvKey, mime }) => {
  console.log(
    `   npx wrangler kv:key put --binding=KV "${kvKey}" --path="${filePath}" --metadata='{"contentType":"${mime}"}'`
  );
});
console.log('\nĐường dẫn phân phối tại Edge sẽ tương ứng:');
imagesList.forEach(({ kvKey }) => {
  console.log(`   https://<domain>/api/v1/media/${encodeURIComponent(kvKey)}`);
});
