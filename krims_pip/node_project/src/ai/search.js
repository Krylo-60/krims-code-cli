import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, sep, relative } from "node:path";

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "build",
  "dist",
  ".agents",
  "krims_code_agent_cli.egg-info",
  "krims_code_cli.egg-info",
  "temp-test-home",
  "temp-test-home-updater",
  "temp-test-home-search"
]);

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".pdf", ".exe", ".dll", ".so", ".dylib", ".bin",
  ".mp3", ".mp4", ".wav", ".avi", ".mov",
  ".woff", ".woff2", ".ttf", ".eot"
]);

/**
 * Recursively walks a directory and yields all text files.
 * @param {string} dir - Directory to scan
 * @param {string} rootDir - Root directory for ignore matching
 * @returns {string[]} List of absolute paths
 */
export function crawlDirectory(dir, rootDir = dir) {
  let files = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files = files.concat(crawlDirectory(fullPath, rootDir));
      } else if (stat.isFile()) {
        if (stat.size > 250 * 1024) continue; // Skip files larger than 250KB

        const dotIdx = entry.lastIndexOf(".");
        const ext = dotIdx !== -1 ? entry.slice(dotIdx).toLowerCase() : "";
        if (BINARY_EXTS.has(ext)) continue;

        files.push(fullPath);
      }
    } catch {
      // Ignore stat failures
    }
  }
  return files;
}

/**
 * Searches all text files in the workspace for occurrences of query.
 * @param {string} query - Query string
 * @param {string} rootDir - The workspace root path
 * @returns {Array<{ filePath: string, relativePath: string, lineNumber: number, lineContent: string }>}
 */
export function workspaceSearch(query, rootDir = process.cwd()) {
  const files = crawlDirectory(rootDir, rootDir);
  const results = [];
  const lowerQuery = query.toLowerCase().trim();

  for (const file of files) {
    try {
      const content = readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(lowerQuery)) {
          results.push({
            filePath: file,
            relativePath: relative(rootDir, file),
            lineNumber: i + 1,
            lineContent: line.trim()
          });
        }
      }
    } catch {
      // Ignore read failures
    }
  }
  return results;
}
