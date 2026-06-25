// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — File Parser & Context Injector
// ═══════════════════════════════════════════════════════════

import { readFile, stat } from "node:fs/promises";
import { resolve, extname, basename } from "node:path";

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
  const resolved = resolve(filePath);
  const ext = extname(resolved).toLowerCase();
  const name = basename(resolved);

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

  // Trim if too long
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.slice(0, MAX_CONTENT_LENGTH) +
      `\n\n[... truncated at ${MAX_CONTENT_LENGTH.toLocaleString()} characters]`;
  }

  return {
    name,
    content: content.trim(),
    size: fileStats.size,
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
