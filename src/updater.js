// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Automated Update & Highlights Engine
// Checks NPM registry, updates packages, and renders release details.
// ═══════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getConfigValue, setConfigValue } from "./config.js";
import { colors, label, separator } from "./ui/theme.js";
import { createSpinner } from "./ui/spinner.js";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));

/**
 * Returns true if version 'latest' is newer than version 'current'.
 * Supports standard semver format x.y.z.
 * @param {string} latest
 * @param {string} current
 * @returns {boolean}
 */
export function isNewerVersion(latest, current) {
  const l = latest.split(".").map((num) => parseInt(num, 10) || 0);
  const c = current.split(".").map((num) => parseInt(num, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (l[i] > c[i]) return true;
    if (l[i] < c[i]) return false;
  }
  return false;
}

/**
 * Fetches and displays release highlights from the remote repository.
 * @param {string} version
 */
export async function showReleaseHighlights(version) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch("https://raw.githubusercontent.com/Krylo-60/aether-ai-cli/main/HIGHLIGHTS.md", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return;
    const text = await res.text();

    console.log("\n" + separator("━"));
    console.log(colors.accent.bold(`  ★  AETHER AI CLI v${version} RELEASE HIGHLIGHTS  ★`));
    console.log(separator("─"));

    const lines = text.split("\n");
    let inReleaseHeader = false;
    let printedAny = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) {
        // Matches the version header like "# Aether CLI v1.1.9 Highlights" or similar
        if (trimmed.toLowerCase().includes(`v${version}`)) {
          inReleaseHeader = true;
        } else {
          inReleaseHeader = false;
        }
        continue;
      }

      if (inReleaseHeader && trimmed) {
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          console.log(colors.brand("  " + trimmed));
          printedAny = true;
        } else {
          console.log(colors.text("  " + trimmed));
          printedAny = true;
        }
      }
    }

    if (!printedAny) {
      // Fallback if no specific version section was found in HIGHLIGHTS.md
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) continue;
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          console.log(colors.brand("  " + trimmed));
        } else if (trimmed) {
          console.log(colors.text("  " + trimmed));
        }
      }
    }

    console.log(separator("━") + "\n");
  } catch {
    // Fail silently (offline or repo down)
  }
}

/**
 * Checks for updates and runs the automatic updater if configured.
 */
export async function checkForUpdates(force = false) {
  const autoUpdate = (await getConfigValue("AUTO_UPDATE")) !== "false";
  const showHighlights = (await getConfigValue("SHOW_HIGHLIGHTS")) !== "false";
  const lastCheck = parseInt(await getConfigValue("LAST_UPDATE_CHECK") || "0", 10);
  const now = Date.now();
  const currentVersion = pkg.version;

  // Run update check at most once every 24 hours (86,400,000 ms), unless forced
  const checkInterval = 24 * 60 * 60 * 1000;
  if (!force && (now - lastCheck < checkInterval)) {
    // Show highlights if we just updated and haven't shown highlights for this version
    const lastNotified = await getConfigValue("LAST_NOTIFIED_VERSION") || "";
    if (showHighlights && lastNotified !== currentVersion) {
      await showReleaseHighlights(currentVersion);
      await setConfigValue("LAST_NOTIFIED_VERSION", currentVersion);
    }
    return;
  }

  // Update check timestamp immediately
  await setConfigValue("LAST_UPDATE_CHECK", now.toString());

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch("https://registry.npmjs.org/@krishivpb60/aether-ai-cli/latest", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (force) {
        console.log(label.system + " " + colors.warning(`⚠ Update check failed: server returned status ${res.status}`));
      }
      return;
    }
    const data = await res.json();
    const latestVersion = data.version;

    if (isNewerVersion(latestVersion, currentVersion)) {
      if (autoUpdate || force) {
        console.log("\n" + label.system + " " + colors.brand(`⚡ New version detected! Auto-updating from v${currentVersion} to v${latestVersion}...`));

        const isPip = process.env.AETHER_PACKAGER === "pip";
        const updateCmd = isPip
          ? "pip install --upgrade aether-ai-agent-cli"
          : "npm install -g @krishivpb60/aether-ai-cli";

        try {
          const spinner = createSpinner("Installing update").start();
          await execAsync(updateCmd);
          spinner.succeed("Update complete!");

          console.log(label.system + " " + colors.success(`✓ Successfully updated to v${latestVersion}.`));

          if (showHighlights) {
            await showReleaseHighlights(latestVersion);
          }
          await setConfigValue("LAST_NOTIFIED_VERSION", latestVersion);
        } catch (err) {
          console.log(label.system + " " + colors.warning(`⚠ Auto-update failed: ${err.message}`));
          console.log(label.system + " " + colors.muted(`Please run manually: ${updateCmd}`));
        }
      } else {
        console.log("\n" + label.system + " " + colors.warning(`⚡ A new version (v${latestVersion}) is available!`));
        const isPip = process.env.AETHER_PACKAGER === "pip";
        const updateCmd = isPip
          ? "pip install -U aether-ai-agent-cli"
          : "npm install -g @krishivpb60/aether-ai-cli";
        console.log(label.system + " " + colors.muted(`To update, run: ${updateCmd}`));
      }
    } else {
      if (force) {
        console.log(label.system + " " + colors.success(`✓ Aether is already up to date (v${currentVersion}).`));
      }
      // Already on latest version, check if we need to show highlights
      const lastNotified = await getConfigValue("LAST_NOTIFIED_VERSION") || "";
      if (showHighlights && lastNotified !== currentVersion) {
        await showReleaseHighlights(currentVersion);
        await setConfigValue("LAST_NOTIFIED_VERSION", currentVersion);
      }
    }
  } catch (err) {
    if (force) {
      console.log(label.system + " " + colors.warning(`⚠ Update check failed: ${err.message}`));
    }
  }
}
