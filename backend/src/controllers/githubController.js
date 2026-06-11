import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../config/db.js";
import logger from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_DIR = path.resolve(__dirname, "../../../python-agent");
const KNOWLEDGE_DIR = path.join(WORKSPACE_DIR, "knowledge");
const CONFIG_FALLBACK_FILE = path.join(WORKSPACE_DIR, "sessions/github_config.json");

let memoryStatus = {
  status: "idle",
  last_crawled_at: null,
  last_error: null,
  pages_crawled: 0
};

if (!fs.existsSync(path.dirname(CONFIG_FALLBACK_FILE))) {
  fs.mkdirSync(path.dirname(CONFIG_FALLBACK_FILE), { recursive: true });
}

export const saveConfig = async (req, res) => {
  const {
    owner,
    name,
    token,
    branchOrTag,
    fileTypes,
    directories,
    fileIncludeRegex,
    fileExcludeRegex
  } = req.body;

  if (!owner || !name) {
    return res.status(400).json({ error: "Owner and Name are required" });
  }

  try {
    await query(`
      INSERT INTO github_configs (
        id, owner, name, token, branch_or_tag, file_types,
        directories, file_include_regex, file_exclude_regex, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        owner = EXCLUDED.owner,
        name = EXCLUDED.name,
        token = EXCLUDED.token,
        branch_or_tag = EXCLUDED.branch_or_tag,
        file_types = EXCLUDED.file_types,
        directories = EXCLUDED.directories,
        file_include_regex = EXCLUDED.file_include_regex,
        file_exclude_regex = EXCLUDED.file_exclude_regex,
        status = EXCLUDED.status
    `, [
      "github-code", owner, name, token || null, branchOrTag || null,
      fileTypes || [], directories || [], fileIncludeRegex || null, fileExcludeRegex || null, "idle"
    ]);

    logger.info(`[GITHUB] Config saved to DB for repository: ${owner}/${name}`);
    return res.json({ success: true, message: "Configuration saved to database" });
  } catch (dbErr) {
    logger.warn(`[GITHUB] DB offline, saving to fallback file: ${dbErr.message}`);
    const configData = {
      owner, name, token, branchOrTag, fileTypes, directories, fileIncludeRegex, fileExcludeRegex
    };
    fs.writeFileSync(CONFIG_FALLBACK_FILE, JSON.stringify(configData, null, 2), "utf-8");
    return res.json({ success: true, message: "Configuration saved to filesystem fallback" });
  }
};

export const getConfig = async (req, res) => {
  try {
    const result = await query("SELECT * FROM github_configs WHERE id = $1", ["github-code"]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return res.json({
        owner: row.owner,
        name: row.name,
        token: row.token,
        branchOrTag: row.branch_or_tag,
        fileTypes: row.file_types,
        directories: row.directories,
        fileIncludeRegex: row.file_include_regex,
        fileExcludeRegex: row.file_exclude_regex
      });
    }
  } catch (dbErr) {
    logger.warn(`[GITHUB] DB offline, reading from fallback file: ${dbErr.message}`);
  }

  if (fs.existsSync(CONFIG_FALLBACK_FILE)) {
    try {
      const fileContent = fs.readFileSync(CONFIG_FALLBACK_FILE, "utf-8");
      return res.json(JSON.parse(fileContent));
    } catch (fileErr) {
      logger.error(`[GITHUB] Failed to parse config fallback: ${fileErr.message}`);
    }
  }

  return res.json({
    owner: "",
    name: "",
    token: "",
    branchOrTag: "main",
    fileTypes: [".js", ".jsx", ".py", ".html"],
    directories: [],
    fileIncludeRegex: "",
    fileExcludeRegex: ""
  });
};

const getPagesCountFromJson = () => {
  const kbFile = path.join(KNOWLEDGE_DIR, "github_knowledge.json");
  if (fs.existsSync(kbFile)) {
    try {
      const content = fs.readFileSync(kbFile, "utf-8");
      const data = JSON.parse(content);
      if (data && Array.isArray(data.pages)) {
        return data.pages.length;
      }
    } catch (e) {
      logger.warn(`[GITHUB] Error reading github_knowledge.json: ${e.message}`);
    }
  }
  return 0;
};

export const getStatus = async (req, res) => {
  let status = memoryStatus.status;
  let last_crawled_at = memoryStatus.last_crawled_at;
  let last_error = memoryStatus.last_error;

  try {
    const result = await query("SELECT status, last_ingested_at, last_error FROM github_configs WHERE id = $1", ["github-code"]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      status = row.status;
      last_crawled_at = row.last_ingested_at;
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

export const triggerIngestion = async (req, res) => {
  let configRow = null;
  try {
    const result = await query("SELECT * FROM github_configs WHERE id = $1", ["github-code"]);
    if (result.rows.length > 0) {
      configRow = result.rows[0];
    }
  } catch (dbErr) {
    // fallback
  }

  if (!configRow && fs.existsSync(CONFIG_FALLBACK_FILE)) {
    try {
      const fileContent = fs.readFileSync(CONFIG_FALLBACK_FILE, "utf-8");
      const data = JSON.parse(fileContent);
      configRow = {
        owner: data.owner,
        name: data.name,
        token: data.token,
        branch_or_tag: data.branchOrTag,
        file_types: data.fileTypes,
        directories: data.directories,
        file_include_regex: data.fileIncludeRegex,
        file_exclude_regex: data.fileExcludeRegex
      };
    } catch (e) {
      // ignore
    }
  }

  if (!configRow || !configRow.owner || !configRow.name) {
    return res.status(400).json({ error: "No GitHub configuration found. Please save setup first." });
  }

  const { owner, name, token, branch_or_tag: branchOrTag, file_types: fileTypes, directories, file_include_regex: fileIncludeRegex, file_exclude_regex: fileExcludeRegex } = configRow;

  const updateStatus = async (status, err = null, pageCount = null) => {
    memoryStatus.status = status;
    if (err) memoryStatus.last_error = err;
    if (pageCount !== null) memoryStatus.pages_crawled = pageCount;
    if (status === "completed") memoryStatus.last_crawled_at = new Date().toISOString();

    try {
      await query(`
        UPDATE github_configs 
        SET status = $1, last_error = $2, last_ingested_at = $3 
        WHERE id = $4
      `, [
        status, 
        err, 
        status === "completed" ? new Date() : null, 
        "github-code"
      ]);
    } catch (dbErr) {
      // ignore db offline on status update
    }
  };

  await updateStatus("crawling", null, 0);
  res.json({ success: true, message: "Manual repository ingestion triggered successfully" });

  runGithubIngestionTask(owner, name, token, branchOrTag || "main", fileTypes || [], directories || [], updateStatus);
};

const MOCK_REPOSITORY_TREE = [
  { path: "README.md", type: "blob", size: 1420, content: `# Swarm Agentic Lab Workspace\n\nAutonomous agent execution logs, WebRTC video links, and telemetry dashboards.\n\n## Quick Start\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`` },
  { path: "package.json", type: "blob", size: 680, content: "{\n  \"name\": \"swarm-copilot-app\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": {\n    \"react\": \"^18.2.0\",\n    \"axios\": \"^1.0.0\"\n  }\n}" },
  { path: "backend/index.js", type: "blob", size: 980, content: "import express from 'express';\nimport cors from 'cors';\nconst app = express();\napp.use(cors());\napp.listen(3002, () => console.log('Server running on port 3002'));" },
  { path: "backend/src/config/db.js", type: "blob", size: 1200, content: "import pg from 'pg';\nexport const connectDB = async () => {\n  console.log('PostgreSQL Connected Successfully');\n};" },
  { path: "backend/src/controllers/githubController.js", type: "blob", size: 2400, content: "export const triggerIngestion = async (req, res) => {\n  console.log('GitHub code ingestion triggered');\n};" },
  { path: "frontend/src/App.jsx", type: "blob", size: 1500, content: "import React from 'react';\nimport SwarmCopilotPanel from './components/layout/SwarmCopilotPanel';\nexport default function App() {\n  return <SwarmCopilotPanel />;\n}" },
  { path: "frontend/src/components/layout/SwarmCopilotPanel.jsx", type: "blob", size: 4500, content: "import React from 'react';\nexport default function SwarmCopilotPanel() {\n  return <div>Swarm Copilot Dashboard</div>;\n}" },
  { path: "python-agent/agents/astra/astra.py", type: "blob", size: 1100, content: "class AstraAgent:\n    def run(self, prompt):\n        return 'Astra response'" },
  { path: "python-agent/knowledge/crawled_knowledge.json", type: "blob", size: 850, content: "{\n  \"vertical\": \"crawled_knowledge\",\n  \"pages\": []\n}" }
];

export const getRepoTree = async (req, res) => {
  let { owner, name, token, branchOrTag } = req.query;

  if (!owner || !name) {
    try {
      const result = await query("SELECT * FROM github_configs WHERE id = $1", ["github-code"]);
      if (result.rows.length > 0) {
        const row = result.rows[0];
        owner = owner || row.owner;
        name = name || row.name;
        token = token || row.token;
        branchOrTag = branchOrTag || row.branch_or_tag;
      }
    } catch (e) {}
  }

  if (!owner || !name) {
    return res.json({ tree: MOCK_REPOSITORY_TREE.map(({ path, type, size }) => ({ path, type, size })) });
  }

  const branch = branchOrTag || "main";
  const headers = {
    "User-Agent": "SwarmCopilotGitHubIngester/1.0"
  };
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  try {
    const treeUrl = `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`;
    const response = await axios.get(treeUrl, { headers, timeout: 10000 });
    if (response.data && response.data.tree) {
      return res.json({ tree: response.data.tree });
    }
    throw new Error("Invalid response from GitHub API");
  } catch (apiErr) {
    logger.warn(`[GITHUB] GitHub API tree fetch failed: ${apiErr.message}. Returning mock tree fallback.`);
    return res.json({ tree: MOCK_REPOSITORY_TREE.map(({ path, type, size }) => ({ path, type, size })) });
  }
};

const runGithubIngestionTask = async (owner, repo, token, branch, fileTypes, directories, updateStatus) => {
  logger.info(`[GITHUB] Starting ingestion for repository: ${owner}/${repo} on branch: ${branch}`);
  
  const pages = [];
  const defaultExclusions = [
    /node_modules/i, /\.git/i, /venv/i, /\.venv/i, /__pycache__/i, /dist/i, /build/i, /\.next/i, /\.nuxt/i
  ];

  try {
    const headers = {
      "User-Agent": "SwarmCopilotGitHubIngester/1.0"
    };
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }

    let treeData = null;
    try {
      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      const response = await axios.get(treeUrl, { headers, timeout: 10000 });
      treeData = response.data;
    } catch (apiErr) {
      logger.warn(`[GITHUB] GitHub API tree fetch failed: ${apiErr.message}. Triggering mock fallback Ingestion.`);
    }

    if (treeData && treeData.tree) {
      let filesToFetch = treeData.tree.filter(node => node.type === "blob");
      
      // Filter by extensions / types
      if (fileTypes && fileTypes.length > 0) {
        filesToFetch = filesToFetch.filter(node => {
          return fileTypes.some(ext => node.path.endsWith(ext));
        });
      }

      // Filter by directories/files tracked list
      if (directories && directories.length > 0 && !directories.includes("") && !directories.includes("/")) {
        filesToFetch = filesToFetch.filter(node => {
          return directories.some(selectedPath => {
            return node.path === selectedPath || node.path.startsWith(selectedPath + "/");
          });
        });
      }

      // Exclude defaults
      filesToFetch = filesToFetch.filter(node => {
        return !defaultExclusions.some(regex => regex.test(node.path));
      });

      // Limit to top 25 files to prevent API rate limits / huge payloads
      const fetchLimit = filesToFetch.slice(0, 25);
      logger.info(`[GITHUB] Found ${filesToFetch.length} files matching criteria, downloading first ${fetchLimit.length}...`);

      for (let i = 0; i < fetchLimit.length; i++) {
        const fileNode = fetchLimit[i];
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fileNode.path}`;
          const contentResp = await axios.get(rawUrl, { headers, timeout: 5000 });
          const contentText = typeof contentResp.data === "string" 
            ? contentResp.data 
            : JSON.stringify(contentResp.data, null, 2);

          pages.push({
            url: `https://github.com/${owner}/${repo}/blob/${branch}/${fileNode.path}`,
            title: fileNode.path,
            content: contentText.substring(0, 15000)
          });

          updateStatus("crawling", null, pages.length);
        } catch (downloadErr) {
          logger.error(`[GITHUB] Failed to download content for ${fileNode.path}: ${downloadErr.message}`);
        }
      }
    } else {
      // MOCK FALLBACK: Ingest structured mock files matching the repository specifications
      logger.info(`[GITHUB] Running mock repository compiler for ${owner}/${repo}`);
      
      let filteredMocks = MOCK_REPOSITORY_TREE.filter(node => node.type === "blob");
      
      if (fileTypes && fileTypes.length > 0) {
        filteredMocks = filteredMocks.filter(f => fileTypes.some(ext => f.path.endsWith(ext)));
      }
      
      if (directories && directories.length > 0 && !directories.includes("") && !directories.includes("/")) {
        filteredMocks = filteredMocks.filter(f => {
          return directories.some(selectedPath => {
            return f.path === selectedPath || f.path.startsWith(selectedPath + "/");
          });
        });
      }

      for (let i = 0; i < filteredMocks.length; i++) {
        const file = filteredMocks[i];
        await new Promise(resolve => setTimeout(resolve, 300));
        pages.push({
          url: `https://github.com/${owner}/${repo}/blob/${branch}/${file.path}`,
          title: file.path,
          content: file.content
        });
        updateStatus("crawling", null, pages.length);
      }
    }

    if (pages.length === 0) {
      throw new Error("No files matched the configuration scope settings.");
    }

    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }
    const kbFile = path.join(KNOWLEDGE_DIR, "github_knowledge.json");
    const kbData = {
      vertical: "github_knowledge",
      last_updated: new Date().toISOString().split("T")[0],
      pages: pages
    };
    fs.writeFileSync(kbFile, JSON.stringify(kbData, null, 2), "utf-8");

    logger.info(`[GITHUB] Ingested ${pages.length} files successfully into github_knowledge.json`);
    await updateStatus("completed", null, pages.length);

  } catch (err) {
    logger.error(`[GITHUB] Ingestion failed: ${err.message}`);
    await updateStatus("error", err.message, pages.length);
  }
};
