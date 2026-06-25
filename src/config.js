// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Secure Configuration Management
// Stores user API keys locally at ~/.aether/config.json
// Supports ALL AI providers (13+ and growing)
// ═══════════════════════════════════════════════════════════

import { readFile, writeFile, mkdir, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { getAllConfigKeys } from "./ai/providers.js";

const CONFIG_DIR = join(homedir(), ".aether");
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
  if (upper.endsWith("_API_KEY") || upper.endsWith("_API_KEYS") || upper.endsWith("_MODEL") || upper === "THEME") {
    return true;
  }
  // Accept known config keys
  const knownKeys = getAllConfigKeys();
  return knownKeys.includes(upper);
}

const HISTORY_FILE = join(CONFIG_DIR, "history.json");

/**
 * Loads chat history from disk.
 * @returns {Promise<Array>} List of chat exchanges
 */
export async function loadHistory() {
  try {
    const raw = await readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Saves chat history to disk.
 * @param {Array} history - List of chat exchanges to save
 */
export async function saveHistory(history) {
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    // Limit saved history to last 50 entries to keep it light
    const trimmed = history.slice(-50);
    await writeFile(HISTORY_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  } catch {
    // Fail silently to not block chat
  }
}

/**
 * Deletes the chat history file.
 */
export async function clearHistory() {
  try {
    await unlink(HISTORY_FILE);
  } catch {
    // File may not exist
  }
}
