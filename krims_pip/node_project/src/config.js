// ═══════════════════════════════════════════════════════════
// Krims Code AI CLI — Secure Configuration Management
// Stores user API keys locally at ~/.krims-code/config.json
// Supports ALL AI providers (13+ and growing)
// ═══════════════════════════════════════════════════════════

import { readFile, writeFile, mkdir, unlink, access } from "node:fs/promises";
import {
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getAllConfigKeys } from "./ai/providers.js";

const CONFIG_DIR = existsSync(join(homedir(), ".krims"))
  ? join(homedir(), ".krims")
  : (existsSync(join(homedir(), ".krims-code"))
    ? join(homedir(), ".krims-code")
    : join(homedir(), ".krims"));
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const SENSITIVE_PATTERNS = ["KEY", "TOKEN", "SECRET"];

/**
 * Returns the full path to the config file.
 * @returns {string}
 */
export function getConfigPath() {
  return CONFIG_FILE;
}

/**
 * Loads the config from disk.
 * @returns {Promise<object>} Parsed config or empty object
 */
export async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Saves config to disk, creating the directory if needed.
 * @param {object} config - The config object to write
 */
export async function saveConfig(config) {
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    throw new Error(`Failed to save config: ${err.message}`);
  }
}

/**
 * Gets a single config value.
 * @param {string} key
 * @returns {Promise<string|undefined>}
 */
export async function getConfigValue(key) {
  const config = await loadConfig();
  return config[key];
}

/**
 * Sets a single config value.
 * @param {string} key
 * @param {string} value
 */
export async function setConfigValue(key, value) {
  const config = await loadConfig();
  config[key] = value;
  await saveConfig(config);
}

/**
 * Deletes a single config key.
 * @param {string} key
 */
export async function deleteConfigValue(key) {
  const config = await loadConfig();
  delete config[key];
  await saveConfig(config);
}

/**
 * Deletes the entire config file.
 */
export async function resetConfig() {
  try {
    await unlink(CONFIG_FILE);
  } catch {
    // File may not exist
  }
}

/**
 * Lists all config keys with sensitive values masked.
 * @returns {Promise<object>} Config with sensitive values masked
 */
export async function listConfig() {
  const config = await loadConfig();
  const masked = {};

  for (const [key, value] of Object.entries(config)) {
    const isSensitive = SENSITIVE_PATTERNS.some((p) => key.toUpperCase().includes(p));
    if (isSensitive && typeof value === "string" && value.length > 8) {
      masked[key] = value.slice(0, 6) + "•••" + value.slice(-3);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Returns the full flat config object for the AI router.
 * Merges the config file with environment variables (config file takes precedence).
 * @returns {Promise<object>}
 */
export async function getAIConfig() {
  const config = await loadConfig();
  const allKeys = getAllConfigKeys();

  // Merge: config file values override env vars
  const merged = {};
  for (const key of allKeys) {
    merged[key] = config[key] || process.env[key] || "";
  }

  // Also pass through any custom model overrides and extra keys
  for (const [key, value] of Object.entries(config)) {
    if (!merged[key]) {
      merged[key] = value;
    }
  }

  // Check env vars for anything the config didn't have
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith("_API_KEY") && !merged[key]) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Checks if the config file exists.
 * @returns {Promise<boolean>}
 */
export async function configExists() {
  try {
    await access(CONFIG_FILE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if the given key is a valid/recognized config key.
 * Accepts any *_API_KEY, *_MODEL, and known keys.
 * @param {string} key
 * @returns {boolean}
 */
export function isValidConfigKey(key) {
  const upper = key.toUpperCase();
  // Accept any API key or model override
  const allowedSpecialKeys = [
    "THEME", "CUSTOM_COMMANDS", "AUTOPILOT", 
    "AUTO_UPDATE", "SHOW_HIGHLIGHTS", "LAST_UPDATE_CHECK", "LAST_NOTIFIED_VERSION",
    "SHOW_TOKENS", "DIAGNOSE_CMD", "NERD_FONTS"
  ];
  if (upper.endsWith("_API_KEY") || upper.endsWith("_API_KEYS") || upper.endsWith("_MODEL") || allowedSpecialKeys.includes(upper)) {
    return true;
  }
  // Accept known config keys
  const knownKeys = getAllConfigKeys();
  return knownKeys.includes(upper);
}

const HISTORY_DIR = join(CONFIG_DIR, "history");
const LEGACY_HISTORY_FILE = join(CONFIG_DIR, "history.json");

let currentSessionFile = null;

/**
 * Gets the current active session file path, initializing it if necessary.
 * @returns {string}
 */
export function getSessionFile() {
  if (currentSessionFile) {
    return currentSessionFile;
  }

  try {
    if (!existsSync(HISTORY_DIR)) {
      mkdirSync(HISTORY_DIR, { recursive: true });
    }

    const files = readdirSync(HISTORY_DIR).filter(
      (f) => f.startsWith("session_") && f.endsWith(".json")
    );

    if (files.length > 0) {
      // Sort files descending by modification time
      files.sort((a, b) => {
        return statSync(join(HISTORY_DIR, b)).mtimeMs - statSync(join(HISTORY_DIR, a)).mtimeMs;
      });
      currentSessionFile = join(HISTORY_DIR, files[0]);
    } else {
      // If legacy history file exists, migrate it
      if (existsSync(LEGACY_HISTORY_FILE)) {
        const timestamp = statSync(LEGACY_HISTORY_FILE).mtimeMs || Date.now();
        currentSessionFile = join(HISTORY_DIR, `session_${timestamp}.json`);
        try {
          const raw = readFileSync(LEGACY_HISTORY_FILE, "utf-8");
          const legacyData = JSON.parse(raw);
          const sessionData = {
            mode: "titan",
            timestamp,
            messages: Array.isArray(legacyData) ? legacyData : (legacyData.messages || []),
          };
          writeFileSync(currentSessionFile, JSON.stringify(sessionData, null, 2), "utf-8");
          try {
            unlinkSync(LEGACY_HISTORY_FILE);
          } catch {
            // ignore unlink error
          }
        } catch {
          // ignore parsing error, start new
          startNewSession();
        }
      } else {
        startNewSession();
      }
    }
  } catch {
    startNewSession();
  }

  return currentSessionFile;
}

/**
 * Starts a new chat session.
 * @returns {string} Path to the new session file
 */
export function startNewSession() {
  const timestamp = Date.now();
  currentSessionFile = join(HISTORY_DIR, `session_${timestamp}.json`);
  try {
    if (!existsSync(HISTORY_DIR)) {
      mkdirSync(HISTORY_DIR, { recursive: true });
    }
    const sessionData = {
      mode: "titan",
      timestamp,
      messages: [],
    };
    writeFileSync(currentSessionFile, JSON.stringify(sessionData, null, 2), "utf-8");
  } catch {
    // Fail silently
  }
  return currentSessionFile;
}

/**
 * Lists all session logs.
 * @returns {Array} List of sessions with metadata
 */
export function listSessions() {
  try {
    if (!existsSync(HISTORY_DIR)) {
      mkdirSync(HISTORY_DIR, { recursive: true });
    }
    const files = readdirSync(HISTORY_DIR).filter(
      (f) => f.startsWith("session_") && f.endsWith(".json")
    );
    const sessions = [];

    for (const file of files) {
      const fullPath = join(HISTORY_DIR, file);
      try {
        const raw = readFileSync(fullPath, "utf-8");
        const data = JSON.parse(raw);
        const messages = Array.isArray(data) ? data : (data.messages || []);
        const mode = Array.isArray(data) ? "titan" : (data.mode || "titan");
        const timestamp = Array.isArray(data)
          ? (statSync(fullPath).mtimeMs || Date.now())
          : (data.timestamp || statSync(fullPath).mtimeMs || Date.now());

        sessions.push({
          file: fullPath,
          filename: file,
          timestamp,
          mode,
          messages,
        });
      } catch {
        // ignore corrupt files
      }
    }

    sessions.sort((a, b) => b.timestamp - a.timestamp);
    return sessions;
  } catch {
    return [];
  }
}

/**
 * Switches the active session file.
 * @param {string} sessionFile
 */
export function switchSession(sessionFile) {
  currentSessionFile = sessionFile;
}

/**
 * Loads chat history from disk.
 * @returns {Promise<Array>} List of chat exchanges
 */
export async function loadHistory() {
  try {
    const file = getSessionFile();
    const raw = readFileSync(file, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : (data.messages || []);
  } catch {
    return [];
  }
}

/**
 * Saves chat history to disk.
 * @param {Array} history - List of chat exchanges to save
 * @param {string} [mode] - Current mode name
 */
export async function saveHistory(history, mode) {
  try {
    const file = getSessionFile();
    let timestamp = Date.now();
    const match = file.match(/session_(\d+)\.json$/);
    if (match) {
      timestamp = parseInt(match[1], 10);
    }
    const trimmed = history.slice(-50);
    
    let finalMode = mode;
    if (!finalMode) {
      try {
        const raw = readFileSync(file, "utf-8");
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) {
          finalMode = data.mode;
        }
      } catch {
        // file might not exist yet
      }
    }
    if (!finalMode) {
      finalMode = "titan";
    }

    const sessionData = {
      mode: finalMode,
      timestamp,
      messages: trimmed,
    };

    writeFileSync(file, JSON.stringify(sessionData, null, 2), "utf-8");
  } catch {
    // Fail silently to not block chat
  }
}

/**
 * Deletes the current chat history file.
 */
export async function clearHistory() {
  try {
    const file = getSessionFile();
    unlinkSync(file);
    currentSessionFile = null;
  } catch {
    // File may not exist
  }
}
