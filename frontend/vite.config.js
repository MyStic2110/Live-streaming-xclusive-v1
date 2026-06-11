import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function crawlerMiddlewarePlugin() {
  const middleware = (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const isCrawler = userAgent.includes('SwarmCopilotKnowledgeCrawler');
    const cleanPath = req.url.split('?')[0].replace(/\/$/, '');
    const targets = ['/governed-deployment', '/sneak-peak', '/insights'];
    
    if (isCrawler) {
      if (targets.includes(cleanPath)) {
        const publicDir = path.resolve(__dirname, 'public');
        const filePath = path.join(publicDir, cleanPath, 'index.html');
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(fs.readFileSync(filePath));
          return;
        }
      } else if (cleanPath.startsWith('/blog/')) {
        const slug = cleanPath.split('/blog/')[1];
        const blogsDir = path.resolve(__dirname, '../python-agent/agents/astra/blogs');
        const blogFilePath = path.join(blogsDir, `${slug}.json`);
        if (fs.existsSync(blogFilePath)) {
          try {
            const blogData = JSON.parse(fs.readFileSync(blogFilePath, 'utf-8'));
            const title = blogData.title || 'Swarm Insight';
            const subtitle = blogData.subtitle || '';
            const author = blogData.author?.name || 'Astra AI';
            const date = blogData.date || '';
            const content = blogData.content || '';
            
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
</head>
<body>
  <article>
    <h1>${title}</h1>
    <p><strong>Published on:</strong> ${date} | <strong>Author:</strong> ${author}</p>
    <p><em>${subtitle}</em></p>
    <hr/>
    <div>
      ${content.replace(/\n/g, '<br/>')}
    </div>
  </article>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(html);
            return;
          } catch (e) {
            console.error('[CRAWLER MIDDLEWARE] Failed to serve dynamic blog:', e);
          }
        }
      }
    }
    next();
  };

  return {
    name: 'crawler-middleware',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
}

export default defineConfig({
  plugins: [react(), crawlerMiddlewarePlugin()],
  server: {
    port: 5173,
    proxy: {
      // Direct Local Proxy to LiveKit
      '/livekit': {
        target: 'ws://127.0.0.1:7880',
        ws: true,
        rewrite: (path) => path.replace(/^\/livekit/, ''),
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'ECONNABORTED') return;
            console.warn('LiveKit Proxy Error:', err.message);
          });
        }
      },
      // Direct Local Proxy to Backend
      '/go-live': 'http://127.0.0.1:3002',
      '/request-call': 'http://127.0.0.1:3002',
      '/talk-to-ai': 'http://127.0.0.1:3002',
      '/end-room': 'http://127.0.0.1:3002',
      '/socket.io': {
        target: 'http://127.0.0.1:3002',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'ECONNABORTED') return;
            console.warn('Socket.IO Proxy Error:', err.message);
          });
        }
      }
    }
  }
})
