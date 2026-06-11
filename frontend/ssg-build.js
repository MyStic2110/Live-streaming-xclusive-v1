import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, 'dist');
const BLOGS_DIR = path.join(__dirname, '../python-agent/agents/astra/blogs');

const DOMAIN = 'https://yourdomain.com';

async function runSSG() {
  console.log('[SSG] Starting Static Site Generation...');

  if (!fs.existsSync(DIST_DIR)) {
    console.error('[SSG] dist/ directory not found. Make sure to run `npm run build` before SSG.');
    process.exit(1);
  }

  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    console.error('[SSG] index.html not found in dist/');
    process.exit(1);
  }

  const originalHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

  let blogFiles = [];
  try {
    if (fs.existsSync(BLOGS_DIR)) {
      blogFiles = fs.readdirSync(BLOGS_DIR).filter(file => file.endsWith('.json'));
    }
  } catch (err) {
    console.error('[SSG] Could not read blogs directory:', err);
  }

  const sitemapUrls = [
    `<url><loc>${DOMAIN}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${DOMAIN}/learn</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`,
    `<url><loc>${DOMAIN}/observability-agents-oswap-llm</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    `<url><loc>${DOMAIN}/governed-deployment</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    `<url><loc>${DOMAIN}/sneak-peak</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    `<url><loc>${DOMAIN}/insights</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
  ];

  console.log(`[SSG] Found ${blogFiles.length} blog posts to pre-render.`);

  for (const file of blogFiles) {
    try {
      const content = fs.readFileSync(path.join(BLOGS_DIR, file), 'utf-8');
      const post = JSON.parse(content);
      const slug = post.slug;
      
      if (!slug) continue;

      const title = post.metadata?.seoTitle || post.title || 'Swarm Agentic Lab Insight';
      const desc = post.metadata?.seoDesc || post.subtitle || 'Explore our latest insights.';
      const img = post.featuredImage ? `${DOMAIN}${post.featuredImage}` : `${DOMAIN}/logo.jpeg`;
      const url = `${DOMAIN}/blog/${slug}`;

      // Inject custom tags
      let updatedHtml = originalHtml
        .replace(/<title>.*?<\/title>/g, `<title>${title}</title>`)
        .replace(/<meta name="description" content=".*?"\s*\/>/g, `<meta name="description" content="${desc}" />`)
        .replace(/<meta property="og:url" content=".*?"\s*\/>/g, `<meta property="og:url" content="${url}" />`)
        .replace(/<meta property="og:title" content=".*?"\s*\/>/g, `<meta property="og:title" content="${title}" />`)
        .replace(/<meta property="og:description" content=".*?"\s*\/>/g, `<meta property="og:description" content="${desc}" />`)
        .replace(/<meta property="og:image" content=".*?"\s*\/>/g, `<meta property="og:image" content="${img}" />`)
        .replace(/<meta property="twitter:url" content=".*?"\s*\/>/g, `<meta property="twitter:url" content="${url}" />`)
        .replace(/<meta property="twitter:title" content=".*?"\s*\/>/g, `<meta property="twitter:title" content="${title}" />`)
        .replace(/<meta property="twitter:description" content=".*?"\s*\/>/g, `<meta property="twitter:description" content="${desc}" />`)
        .replace(/<meta property="twitter:image" content=".*?"\s*\/>/g, `<meta property="twitter:image" content="${img}" />`);

      // Create static directory
      const blogDir = path.join(DIST_DIR, 'blog', slug);
      fs.mkdirSync(blogDir, { recursive: true });
      fs.writeFileSync(path.join(blogDir, 'index.html'), updatedHtml);
      
      console.log(`[SSG] Rendered: /blog/${slug}`);

      // Add to sitemap
      sitemapUrls.push(
        `<url><loc>${url}</loc><lastmod>${(post.date || new Date().toISOString()).split('T')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`
      );

    } catch (e) {
      console.error(`[SSG] Error processing ${file}:`, e);
    }
  }

  // Pre-render Governed Deployment page
  try {
    const deploymentTitle = "Governed Deployment | Private AI Swarm Infrastructure";
    const deploymentDesc = "Deploy the AI control plane inside your secure VPC or data centre. Supports On-Prem, Private Cloud, Self-Hosted, and Hybrid deployment models.";
    const deploymentUrl = `${DOMAIN}/governed-deployment`;
    const deploymentImg = `${DOMAIN}/logo.jpeg`;

    const updatedHtml = originalHtml
      .replace(/<title>.*?<\/title>/g, `<title>${deploymentTitle}</title>`)
      .replace(/<meta name="description" content=".*?"\s*\/>/g, `<meta name="description" content="${deploymentDesc}" />`)
      .replace(/<meta property="og:url" content=".*?"\s*\/>/g, `<meta property="og:url" content="${deploymentUrl}" />`)
      .replace(/<meta property="og:title" content=".*?"\s*\/>/g, `<meta property="og:title" content="${deploymentTitle}" />`)
      .replace(/<meta property="og:description" content=".*?"\s*\/>/g, `<meta property="og:description" content="${deploymentDesc}" />`)
      .replace(/<meta property="og:image" content=".*?"\s*\/>/g, `<meta property="og:image" content="${deploymentImg}" />`)
      .replace(/<meta property="twitter:url" content=".*?"\s*\/>/g, `<meta property="twitter:url" content="${deploymentUrl}" />`)
      .replace(/<meta property="twitter:title" content=".*?"\s*\/>/g, `<meta property="twitter:title" content="${deploymentTitle}" />`)
      .replace(/<meta property="twitter:description" content=".*?"\s*\/>/g, `<meta property="twitter:description" content="${deploymentDesc}" />`)
      .replace(/<meta property="twitter:image" content=".*?"\s*\/>/g, `<meta property="twitter:image" content="${deploymentImg}" />`);

    const deploymentDir = path.join(DIST_DIR, 'governed-deployment');
    fs.mkdirSync(deploymentDir, { recursive: true });
    fs.writeFileSync(path.join(deploymentDir, 'index.html'), updatedHtml);
    console.log('[SSG] Rendered: /governed-deployment');
  } catch (err) {
    console.error('[SSG] Error pre-rendering governed deployment page:', err);
  }

  // Pre-render Sneak-Peak page
  try {
    const title = "Sneak-Peak | Swarm Operator Reels";
    const desc = "Watch short clips and interactive sessions detailing our agents at work. Explore SRE telemetry, voice assistants with sub-200ms latency, and automated Docker container scanning.";
    const url = `${DOMAIN}/sneak-peak`;
    const img = `${DOMAIN}/logo.jpeg`;

    const updatedHtml = originalHtml
      .replace(/<title>.*?<\/title>/g, `<title>${title}</title>`)
      .replace(/<meta name="description" content=".*?"\s*\/>/g, `<meta name="description" content="${desc}" />`)
      .replace(/<meta property="og:url" content=".*?"\s*\/>/g, `<meta property="og:url" content="${url}" />`)
      .replace(/<meta property="og:title" content=".*?"\s*\/>/g, `<meta property="og:title" content="${title}" />`)
      .replace(/<meta property="og:description" content=".*?"\s*\/>/g, `<meta property="og:description" content="${desc}" />`)
      .replace(/<meta property="og:image" content=".*?"\s*\/>/g, `<meta property="og:image" content="${img}" />`)
      .replace(/<meta property="twitter:url" content=".*?"\s*\/>/g, `<meta property="twitter:url" content="${url}" />`)
      .replace(/<meta property="twitter:title" content=".*?"\s*\/>/g, `<meta property="twitter:title" content="${title}" />`)
      .replace(/<meta property="twitter:description" content=".*?"\s*\/>/g, `<meta property="twitter:description" content="${desc}" />`)
      .replace(/<meta property="twitter:image" content=".*?"\s*\/>/g, `<meta property="twitter:image" content="${img}" />`);

    const pageDir = path.join(DIST_DIR, 'sneak-peak');
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'index.html'), updatedHtml);
    console.log('[SSG] Rendered: /sneak-peak');
  } catch (err) {
    console.error('[SSG] Error pre-rendering sneak-peak page:', err);
  }

  // Pre-render Insights page
  try {
    const title = "Insights | Swarm AI Agentic Lab";
    const desc = "Explore the latest breakthroughs in multiagent orchestration, vector policy optimization, and secure local model execution. Read technical guides from our research division.";
    const url = `${DOMAIN}/insights`;
    const img = `${DOMAIN}/logo.jpeg`;

    const updatedHtml = originalHtml
      .replace(/<title>.*?<\/title>/g, `<title>${title}</title>`)
      .replace(/<meta name="description" content=".*?"\s*\/>/g, `<meta name="description" content="${desc}" />`)
      .replace(/<meta property="og:url" content=".*?"\s*\/>/g, `<meta property="og:url" content="${url}" />`)
      .replace(/<meta property="og:title" content=".*?"\s*\/>/g, `<meta property="og:title" content="${title}" />`)
      .replace(/<meta property="og:description" content=".*?"\s*\/>/g, `<meta property="og:description" content="${desc}" />`)
      .replace(/<meta property="og:image" content=".*?"\s*\/>/g, `<meta property="og:image" content="${img}" />`)
      .replace(/<meta property="twitter:url" content=".*?"\s*\/>/g, `<meta property="twitter:url" content="${url}" />`)
      .replace(/<meta property="twitter:title" content=".*?"\s*\/>/g, `<meta property="twitter:title" content="${title}" />`)
      .replace(/<meta property="twitter:description" content=".*?"\s*\/>/g, `<meta property="twitter:description" content="${desc}" />`)
      .replace(/<meta property="twitter:image" content=".*?"\s*\/>/g, `<meta property="twitter:image" content="${img}" />`);

    const pageDir = path.join(DIST_DIR, 'insights');
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'index.html'), updatedHtml);
    console.log('[SSG] Rendered: /insights');
  } catch (err) {
    console.error('[SSG] Error pre-rendering insights page:', err);
  }

  // Generate dynamic sitemap
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemapUrls.join('\n  ')}
</urlset>`;

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapContent);
  console.log('[SSG] Generated dist/sitemap.xml successfully!');
}

runSSG();
