import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendEntryPath = path.resolve(__dirname, 'backend/src/index.ts');

// Plugin chạy trực tiếp HonoJS Worker (/api/*) từ thư mục backend/ trong môi trường Vite Dev Server
// đồng thời giữ nguyên cấu trúc output chuẩn `dist/index.html` cho Cloudflare Pages khi build.
function honoLocalDevPlugin(localEnv: Record<string, string>): Plugin {
  return {
    name: 'hono-local-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }
        try {
          const mod = await server.ssrLoadModule(backendEntryPath);
          const app = mod.app || mod.default;

          const protocol = 'http';
          const host = req.headers.host || 'localhost:5173';
          const fullUrl = `${protocol}://${host}${req.url}`;

          const headers = new Headers();
          for (const [key, val] of Object.entries(req.headers)) {
            if (Array.isArray(val)) {
              for (const v of val) headers.append(key, v);
            } else if (typeof val === 'string') {
              headers.set(key, val);
            }
          }

          let body: BodyInit | undefined = undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            body = Buffer.concat(chunks);
          }

          const webReq = new Request(fullUrl, {
            method: req.method || 'GET',
            headers,
            body,
          });

          const webRes: Response = await app.fetch(webReq, {
            ENVIRONMENT: 'development',
            DEFAULT_SHIPPING_FEE: '30000',
            FREE_SHIPPING_THRESHOLD: '500000',
            CF_LLM_MODEL: localEnv.CF_LLM_MODEL,
            GEMINI_API_KEY: localEnv.GEMINI_API_KEY,
            OLLAMA_BASE_URL: localEnv.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
            OLLAMA_MODEL: localEnv.OLLAMA_MODEL || 'qwen2.5:3b',
          });

          res.statusCode = webRes.status;
          webRes.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });

          const arrayBuf = await webRes.arrayBuffer();
          res.end(Buffer.from(arrayBuf));
        } catch (err: any) {
          console.error('[Hono Dev Middleware Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: false,
              error: { code: 'DEV_SERVER_ERROR', message: err.message || 'Dev Server Error' },
            })
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, __dirname, '');

  return {
    root: 'frontend',
    publicDir: 'public',
    plugins: [react(), tailwindcss(), honoLocalDevPlugin(localEnv)],
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
  };
});
