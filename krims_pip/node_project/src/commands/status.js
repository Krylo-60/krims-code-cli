import { getAIConfig, configExists, getConfigPath } from "../config.js";
import { getActiveProviders } from "../ai/providers.js";
import { colors, separator, keyValue, label, getActiveTheme } from "../ui/theme.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8"));
const VERSION = pkg.version;

export default {
  name: "status",
  description: "Show system status & configured providers",
  aliases: [],
  options: [],
  async executeCLI(args, options) {
    const aiConfig = await getAIConfig();
    const exists = await configExists();
    const active = getActiveProviders(aiConfig);

    console.log("");
    console.log(colors.brand("  ⚡ Krims Code SYSTEM STATUS"));
    console.log(separator("─"));
    console.log(keyValue("  Version", `v${VERSION}`));
    console.log(keyValue("  Config", exists ? colors.success("✓ Found") : colors.warning("✗ Not found")));
    console.log(keyValue("  Location", getConfigPath()));

    console.log("");
    console.log(colors.accent("  ◈ Active Providers:"));
    if (active.length === 0) {
      console.log("  " + colors.warning("  No providers configured. Run `Krims Code setup` to get started."));
    } else {
      for (const { id, provider } of active) {
        console.log("  " + colors.success("  ✓ ") + colors.text(provider.name) + colors.dim(` (${provider.defaultModel})`));
      }
    }

    console.log("");
    console.log(colors.accent("  ◈ Local Fallbacks:"));
    console.log(keyValue("    Math Solver", colors.success("✓ Active")));
    console.log(keyValue("    Krylo Companion", colors.success("✓ Standing By")));

    console.log("");
    console.log(colors.accent("  ◈ Failover Mesh:"));
    const totalNodes = 1 + active.length; // +1 for local offline fallback
    console.log(keyValue("    Active Nodes", `${totalNodes}`));
    console.log(keyValue("    Mesh Status", active.length > 0 ? colors.success("✓ Online") : colors.warning("⚠ Local Only")));
    console.log("");
  },
  async executeChat(args, ctx) {
    const active = getActiveProviders(ctx.aiConfig);

    console.log("");
    console.log(colors.brand("  ◈ SESSION STATUS"));
    console.log(separator("─"));
    console.log(keyValue("  Theme", getActiveTheme().toUpperCase()));
    console.log(keyValue("  Mode", ctx.currentMode.label));
    console.log(keyValue("  Layer", ctx.currentMode.layer));
    console.log(keyValue("  Exchanges", String(Math.floor(ctx.history.length / 2))));
    console.log(keyValue("  Files", String(ctx.attachedFiles.length)));
    console.log(keyValue("  Providers", String(active.length)));
    console.log("");
  }
};
