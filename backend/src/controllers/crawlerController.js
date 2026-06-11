import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../config/db.js";
import logger from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_DIR = path.resolve(__dirname, "../../../python-agent");
const KNOWLEDGE_DIR = path.join(WORKSPACE_DIR, "knowledge");
const CONFIG_FALLBACK_FILE = path.join(WORKSPACE_DIR, "sessions/crawling_config.json");

// In-memory status fallback if DB is offline
let memoryStatus = {
  status: "idle",
  last_crawled_at: null,
  last_error: null,
  pages_crawled: 0
};

// Check fallback directories
if (!fs.existsSync(path.dirname(CONFIG_FALLBACK_FILE))) {
  fs.mkdirSync(path.dirname(CONFIG_FALLBACK_FILE), { recursive: true });
}

// ─── Controller Functions ────────────────────────────────────────────────────

export const saveConfig = async (req, res) => {
  const {
    startUrl,
    includePattern,
    excludePattern,
    sitemapEnabled,
    customSitemap,
    jsRendering,
    proxyEnabled,
    extractPdfs,
    mainCss,
    excludeCss,
    template
  } = req.body;

  if (!startUrl) {
    return res.status(400).json({ error: "startUrl is required" });
  }

  try {
    // Save to Postgres
    await query(`
      INSERT INTO crawling_configs (
        id, start_url, include_pattern, exclude_pattern, sitemap_enabled,
        custom_sitemap, js_rendering, proxy_enabled, extract_pdfs,
        main_css, exclude_css, template, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        start_url = EXCLUDED.start_url,
        include_pattern = EXCLUDED.include_pattern,
        exclude_pattern = EXCLUDED.exclude_pattern,
        sitemap_enabled = EXCLUDED.sitemap_enabled,
        custom_sitemap = EXCLUDED.custom_sitemap,
        js_rendering = EXCLUDED.js_rendering,
        proxy_enabled = EXCLUDED.proxy_enabled,
        extract_pdfs = EXCLUDED.extract_pdfs,
        main_css = EXCLUDED.main_css,
        exclude_css = EXCLUDED.exclude_css,
        template = EXCLUDED.template,
        status = EXCLUDED.status
    `, [
      "web-crawl", startUrl, includePattern || null, excludePattern || null,
      !!sitemapEnabled, customSitemap || null, !!jsRendering, !!proxyEnabled, !!extractPdfs,
      mainCss || null, excludeCss || null, template || null, "idle"
    ]);

    logger.info(`[CRAWLER] Config saved to DB for startUrl: ${startUrl}`);
    return res.json({ success: true, message: "Configuration saved to database" });
  } catch (dbErr) {
    logger.warn(`[CRAWLER] DB offline, saving to fallback file: ${dbErr.message}`);
    // File fallback
    const configData = {
      startUrl, includePattern, excludePattern, sitemapEnabled,
      customSitemap, jsRendering, proxyEnabled, extractPdfs,
      mainCss, excludeCss, template
    };
    fs.writeFileSync(CONFIG_FALLBACK_FILE, JSON.stringify(configData, null, 2), "utf-8");
    return res.json({ success: true, message: "Configuration saved to filesystem fallback" });
  }
};

export const getConfig = async (req, res) => {
  try {
    const result = await query("SELECT * FROM crawling_configs WHERE id = $1", ["web-crawl"]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return res.json({
        startUrl: row.start_url,
        includePattern: row.include_pattern,
        excludePattern: row.exclude_pattern,
        sitemapEnabled: row.sitemap_enabled,
        customSitemap: row.custom_sitemap,
        jsRendering: row.js_rendering,
        proxyEnabled: row.proxy_enabled,
        extractPdfs: row.extract_pdfs,
        mainCss: row.main_css,
        excludeCss: row.exclude_css,
        template: row.template
      });
    }
  } catch (dbErr) {
    logger.warn(`[CRAWLER] DB offline, reading from fallback file: ${dbErr.message}`);
  }

  // Fallback file check
  if (fs.existsSync(CONFIG_FALLBACK_FILE)) {
    try {
      const fileContent = fs.readFileSync(CONFIG_FALLBACK_FILE, "utf-8");
      return res.json(JSON.parse(fileContent));
    } catch (fileErr) {
      logger.error(`[CRAWLER] Failed to parse config fallback: ${fileErr.message}`);
    }
  }

  return res.json({
    startUrl: "",
    includePattern: "",
    excludePattern: "",
    sitemapEnabled: true,
    customSitemap: "",
    jsRendering: false,
    proxyEnabled: false,
    extractPdfs: false,
    mainCss: "",
    excludeCss: "",
    template: null
  });
};

const getPagesCountFromJson = () => {
  const kbFile = path.join(KNOWLEDGE_DIR, "crawled_knowledge.json");
  if (fs.existsSync(kbFile)) {
    try {
      const content = fs.readFileSync(kbFile, "utf-8");
      const data = JSON.parse(content);
      if (data && Array.isArray(data.pages)) {
        return data.pages.length;
      }
    } catch (e) {
      logger.warn(`[CRAWLER] Error reading crawled_knowledge.json: ${e.message}`);
    }
  }
  return 0;
};

export const getStatus = async (req, res) => {
  let status = memoryStatus.status;
  let last_crawled_at = memoryStatus.last_crawled_at;
  let last_error = memoryStatus.last_error;

  try {
    const result = await query("SELECT status, last_crawled_at, last_error FROM crawling_configs WHERE id = $1", ["web-crawl"]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      status = row.status;
      last_crawled_at = row.last_crawled_at;
      last_error = row.last_error;
    }
  } catch (dbErr) {
    // fallback status
  }

  const pages_crawled = status === "crawling" ? memoryStatus.pages_crawled : getPagesCountFromJson();

  return res.json({
    status,
    last_crawled_at,
    last_error,
    pages_crawled
  });
};

export const triggerCrawl = async (req, res) => {
  // Retrieve config first
  let configRow = null;
  try {
    const result = await query("SELECT * FROM crawling_configs WHERE id = $1", ["web-crawl"]);
    if (result.rows.length > 0) {
      configRow = result.rows[0];
    }
  } catch (dbErr) {
    // fallback handled below
  }

  if (!configRow && fs.existsSync(CONFIG_FALLBACK_FILE)) {
    try {
      const fileContent = fs.readFileSync(CONFIG_FALLBACK_FILE, "utf-8");
      const data = JSON.parse(fileContent);
      configRow = {
        start_url: data.startUrl,
        include_pattern: data.includePattern,
        exclude_pattern: data.excludePattern,
        main_css: data.mainCss,
        exclude_css: data.excludeCss
      };
    } catch (e) {
      // ignore
    }
  }

  if (!configRow || !configRow.start_url) {
    return res.status(400).json({ error: "No crawl configuration found. Please save setup first." });
  }

  // Update status to 'crawling' in DB and memory
  const start_url = configRow.start_url;
  const include_pattern = configRow.include_pattern;
  const exclude_pattern = configRow.exclude_pattern;
  const main_css = configRow.main_css;
  const exclude_css = configRow.exclude_css;

  const updateStatus = async (status, err = null, pageCount = null) => {
    memoryStatus.status = status;
    if (err) memoryStatus.last_error = err;
    if (pageCount !== null) memoryStatus.pages_crawled = pageCount;
    if (status === "completed") memoryStatus.last_crawled_at = new Date().toISOString();

    try {
      await query(`
        UPDATE crawling_configs 
        SET status = $1, last_error = $2, last_crawled_at = $3 
        WHERE id = $4
      `, [
        status, 
        err, 
        status === "completed" ? new Date() : null, 
        "web-crawl"
      ]);
    } catch (dbErr) {
      // ignore db offline on status update
    }
  };

  await updateStatus("crawling", null, 0);

  // Return trigger acknowledgement
  res.json({ success: true, message: "Manual crawl triggered successfully" });

  // Run the crawling function asynchronously
  runCrawlerTask(start_url, include_pattern, exclude_pattern, main_css, exclude_css, updateStatus);
};

// ─── Crawler Task Implementation (Axios & Cheerio) ───────────────────────────

const runCrawlerTask = async (startUrl, includePattern, excludePattern, mainCss, excludeCss, updateStatus) => {
  logger.info(`[CRAWLER] Starting crawling process on: ${startUrl}`);
  
  const crawledPages = [];
  const visited = new Set();
  const queue = [startUrl];
  const MAX_PAGES = 50;

  try {
    while (queue.length > 0 && visited.size < MAX_PAGES) {
      const currentUrl = queue.shift();
      if (visited.has(currentUrl)) continue;

      visited.add(currentUrl);
      logger.info(`[CRAWLER] Crawling URL [${visited.size}/${MAX_PAGES}]: ${currentUrl}`);

      try {
        const response = await axios.get(currentUrl, {
          timeout: 8000,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SwarmCopilotKnowledgeCrawler/1.0;)"
          }
        });

        const html = response.data;
        if (!html || typeof html !== "string") continue;

        const $ = cheerio.load(html);

        // Get page Title
        const pageTitle = $("title").text().trim() || $("h1").first().text().trim() || "Untitled Page";

        // Remove excluded elements
        if (excludeCss) {
          try {
            $(excludeCss).remove();
          } catch (e) {
            logger.warn(`[CRAWLER] Invalid exclusion CSS selector "${excludeCss}": ${e.message}`);
          }
        }

        // Get main content text
        let mainText = "";
        if (mainCss) {
          try {
            mainText = $(mainCss).text().trim();
          } catch (e) {
            logger.warn(`[CRAWLER] Invalid main content CSS selector "${mainCss}": ${e.message}`);
          }
        }
        
        // Fallback to body text if main selector didn't match or wasn't provided
        if (!mainText) {
          mainText = $("body").text().trim();
        }

        // Clean whitespaces and limit size to avoid massive files
        const cleanedContent = mainText.replace(/\s+/g, " ").substring(0, 15000);

        crawledPages.push({
          url: currentUrl,
          title: pageTitle,
          content: cleanedContent
        });

        // Update real-time counter
        updateStatus("crawling", null, crawledPages.length);

        // Find sibling links to queue up
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (!href) return;

          try {
            const resolvedUrl = new URL(href, currentUrl).href;
            
            // Link constraints: must start with the start URL domain or match include pattern
            const isTarget = resolvedUrl.startsWith(startUrl) || 
              (includePattern && resolvedUrl.includes(includePattern));
            const isExcluded = excludePattern && resolvedUrl.includes(excludePattern);

            if (isTarget && !isExcluded) {
              // Ignore page anchor tags
              const urlNoHash = resolvedUrl.split("#")[0];
              if (!visited.has(urlNoHash) && !queue.includes(urlNoHash)) {
                queue.push(urlNoHash);
              }
            }
          } catch (e) {
            // skip invalid absolute URL conversions
          }
        });

      } catch (pageErr) {
        logger.error(`[CRAWLER] Failed to scrape page ${currentUrl}: ${pageErr.message}`);
      }
    }

    if (crawledPages.length === 0) {
      throw new Error("No pages could be crawled or resolved from the start URL");
    }

    // Save crawled output to python-agent/knowledge/crawled_knowledge.json
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }

    const kbFile = path.join(KNOWLEDGE_DIR, "crawled_knowledge.json");
    const kbData = {
      vertical: "crawled_knowledge",
      last_updated: new Date().toISOString().split("T")[0],
      pages: crawledPages
    };

    fs.writeFileSync(kbFile, JSON.stringify(kbData, null, 2), "utf-8");
    logger.info(`[CRAWLER] Ingested ${crawledPages.length} pages successfully into crawled_knowledge.json`);

    await updateStatus("completed", null, crawledPages.length);

  } catch (err) {
    logger.error(`[CRAWLER] Crawl failed: ${err.message}`);
    await updateStatus("error", err.message, crawledPages.length);
  }
};
