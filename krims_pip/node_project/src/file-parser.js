// ═══════════════════════════════════════════════════════════
// Krims Code AI CLI — File Parser & Context Injector
// ═══════════════════════════════════════════════════════════

import { readFile, stat } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { resolve, extname, basename, join, relative } from "node:path";

const MAX_CONTENT_LENGTH = 30000;

const SUPPORTED_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".csv", ".js", ".jsx", ".ts", ".tsx",
  ".html", ".css", ".py", ".log", ".yaml", ".yml", ".xml",
  ".toml", ".env", ".sh", ".bat", ".ps1", ".sql", ".rs",
  ".go", ".java", ".c", ".cpp", ".h", ".rb", ".php",
  ".swift", ".kt", ".dart", ".vue", ".svelte",
]);

/**
 * Reads and parses a file for context injection.
 * @param {string} filePath - Path to the file (absolute or relative)
 * @returns {Promise<{ name: string, content: string, size: number, extension: string }>}
 */
export async function parseFile(filePath) {
  let lineRange = null;
  let cleanFilePath = filePath;

  // Match ending with :start-end or :line (e.g. :10-50 or :100)
  const match = filePath.match(/:(\d+)(?:-(\d+))?$/);
  if (match) {
    cleanFilePath = filePath.slice(0, match.index);
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    lineRange = { start, end };
  }

  const resolved = resolve(cleanFilePath);
  const ext = extname(resolved).toLowerCase();
  let name = basename(resolved);

  // Validate extension
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    const supported = [...SUPPORTED_EXTENSIONS].join(", ");
    throw new Error(
      `Unsupported file type: "${ext}"\nSupported types: ${supported}`
    );
  }

  // Check file exists and get size
  let fileStats;
  try {
    fileStats = await stat(resolved);
  } catch {
    throw new Error(`File not found: ${resolved}`);
  }

  if (!fileStats.isFile()) {
    throw new Error(`Not a file: ${resolved}`);
  }

  // Read file content
  let content;
  try {
    content = await readFile(resolved, "utf-8");
  } catch (err) {
    throw new Error(`Cannot read file: ${err.message}`);
  }

  let finalSize = fileStats.size;

  if (lineRange) {
    const lines = content.split(/\r?\n/);
    const startIdx = Math.max(0, lineRange.start - 1);
    const endIdx = Math.min(lines.length, lineRange.end);
    content = lines.slice(startIdx, endIdx).join("\n");
    name += `:${lineRange.start}-${lineRange.end}`;
    finalSize = Buffer.byteLength(content, "utf-8");
  }

  // Trim if too long
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.slice(0, MAX_CONTENT_LENGTH) +
      `\n\n[... truncated at ${MAX_CONTENT_LENGTH.toLocaleString()} characters]`;
  }

  return {
    name,
    content: content.trim(),
    size: finalSize,
    extension: ext,
  };
}

/**
 * Formats parsed file data into a context string for prompt injection.
 * @param {{ name: string, content: string, size: number, extension: string }} fileData
 * @returns {string}
 */
export function formatContext(fileData) {
  return [
    `[Context File: ${fileData.name} (${formatBytes(fileData.size)}, ${fileData.extension})]`,
    "---",
    fileData.content,
    "---",
    `[End of ${fileData.name}]`,
  ].join("\n");
}

/**
 * Formats bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const EXCLUDE_DIRS = new Set([
  "node_modules", ".git", ".agents", "build", "dist", ".github",
  "Krims Code_pip", "krims_code_agent_cli.egg-info", "krims_code_cli.egg-info"
]);

/**
 * Recursively scans baseDir and returns a list of supported files.
 * @param {string} baseDir - Directory to scan
 * @returns {string[]} List of relative file paths
 */
export function scanWorkspaceFiles(baseDir) {
  const files = [];

  function recurse(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      const fullPath = join(dir, entry);
      let stats;
      try {
        stats = statSync(fullPath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        recurse(fullPath);
      } else if (stats.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          files.push(relative(baseDir, fullPath));
        }
      }
    }
  }

  recurse(baseDir);
  return files.sort();
}
