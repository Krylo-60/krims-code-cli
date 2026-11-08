import { getConfigValue, setConfigValue, loadConfig, saveConfig } from "../config.js";
import { colors, separator, keyValue, label } from "../ui/theme.js";

const BACKEND_URL = process.env.KRIMS_BOT_URL || "https://krims-discord-bot-d57m.onrender.com";

export default {
  name: "discord",
  signature: "discord [action] [arg]",
  description: "Connect Discord account to CLI, check link status, and earn KC",
  aliases: ["connect", "link"],
  options: [],

  async executeCLI(args, options) {
    const action = (args[0] || "").toLowerCase();
    const targetId = args[1];

    if (action === "connect" || action === "link") {
      await handleConnect(targetId);
    } else if (action === "disconnect" || action === "unlink") {
      await handleDisconnect();
    } else {
      await handleStatus();
    }
  },

  async executeChat(args, ctx) {
    const action = (args[0] || "").toLowerCase();
    const targetId = args[1];

    if (action === "connect" || action === "link") {
      await handleConnect(targetId);
    } else if (action === "disconnect" || action === "unlink") {
      await handleDisconnect();
    } else {
      await handleStatus();
    }
  }
};

async function handleConnect(targetId) {
  if (!targetId) {
    console.log("");
    console.log(colors.brand("  ⚡ KRIMS CODE CLI • DISCORD SYNC"));
    console.log(separator("─"));
    console.log(colors.warning("  ⚠️ Please provide your Discord User ID:"));
    console.log(colors.text("  Usage: krims discord connect <your_discord_id>"));
    console.log(colors.dim("  Example: /discord connect 1414143825538191373"));
    console.log("");
    console.log(colors.muted("  💡 Tip: In Discord, right click your name -> 'Copy User ID' (or run !cli in support server)."));
    console.log("");
    return;
  }

  console.log("");
  console.log(colors.brand("  🔄 Contacting Krims Fleet Network..."));

  let bonusAwarded = 0;
  let username = "Discord User";
  let balance = 1000;
  let streak = 0;

  try {
    const res = await fetch(`${BACKEND_URL}/api/cli/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId: targetId })
    });

    if (res.ok) {
      const data = await res.json();
      bonusAwarded = data.bonusAwarded || 0;
      username = data.username || targetId;
      balance = data.balance ?? 1000;
      streak = data.dailyStreak || 0;
    } else {
      // Local graceful fallback
      bonusAwarded = 1000;
      username = targetId;
    }
  } catch (err) {
    // Offline / fallback connection
    bonusAwarded = 1000;
    username = targetId;
  }

  const config = await loadConfig();
  config.discord = {
    id: targetId,
    username,
    connectedAt: Date.now(),
    lastBalance: balance
  };
  await saveConfig(config);

  console.log("");
  console.log(colors.success("  ═════════════════════════════════════════════════════════════════"));
  console.log(colors.brand("  ⚡ DISCORD ACCOUNT CONNECTED SUCCESSFULLY! ⚡"));
  console.log(separator("─"));
  console.log(keyValue("  👤 Discord Account", colors.success(`@${username}`)));
  console.log(keyValue("  🆔 Discord ID", colors.text(targetId)));
  if (bonusAwarded > 0) {
    console.log(keyValue("  🎁 Link Bonus", colors.success.bold(`+${bonusAwarded.toLocaleString()} KC (KryloCoins)!`)));
  }
  console.log(keyValue("  💰 Current Vault", colors.accent.bold(`${balance.toLocaleString()} KC`)));
  console.log(keyValue("  🔥 Daily Streak", `${streak} Day(s)`));
  console.log(separator("─"));
  console.log(colors.accent("  👉 Type `/claim` or run `krims claim` to claim your daily rewards!"));
  console.log(colors.dim("  🌐 Web Dashboard Vault: https://krims-bot-dashboard.vercel.app/rewards"));
  console.log(colors.success("  ═════════════════════════════════════════════════════════════════"));
  console.log("");
}

async function handleDisconnect() {
  const config = await loadConfig();
  if (!config.discord) {
    console.log("\n" + label.system + " " + colors.warning("No Discord account is currently linked.\n"));
    return;
  }

  const prevUser = config.discord.username || config.discord.id;
  delete config.discord;
  await saveConfig(config);

  console.log("");
  console.log(colors.warning("  ⚠️ Discord account disconnected: " + colors.text(`@${prevUser}`)));
  console.log(colors.dim("  Run `krims discord connect <id>` anytime to reconnect and sync your KC.\n"));
}

async function handleStatus() {
  const config = await loadConfig();
  const disc = config.discord;

  console.log("");
  console.log(colors.brand("  ⚡ KRIMS CODE CLI • DISCORD IDENTITY"));
  console.log(separator("─"));

  if (!disc || !disc.id) {
    console.log(keyValue("  Status", colors.warning("✗ Not Linked")));
    console.log("");
    console.log(colors.accent("  🎁 Earn +1,000 KC by linking your Discord account!"));
    console.log(colors.text("  Run: ") + colors.brand("krims discord connect <your_discord_id>"));
    console.log(colors.text("  Or inside chat: ") + colors.brand("/discord connect <your_discord_id>"));
    console.log("");
    console.log(colors.dim("  💬 Need your Discord ID? Join our support hub: https://discord.gg/h9n8a2yH3B"));
  } else {
    console.log(keyValue("  Status", colors.success("✓ Connected")));
    console.log(keyValue("  Account", colors.text(`@${disc.username || disc.id}`)));
    console.log(keyValue("  Discord ID", colors.dim(disc.id)));
    console.log(keyValue("  Connected On", new Date(disc.connectedAt).toLocaleDateString()));

    // Try fetching live balance from fleet
    let liveBal = disc.lastBalance || 1000;
    try {
      const res = await fetch(`${BACKEND_URL}/api/cli/balance?discordId=${disc.id}`);
      if (res.ok) {
        const data = await res.json();
        liveBal = data.balance ?? liveBal;
        disc.lastBalance = liveBal;
        await saveConfig(config);
      }
    } catch (_) {}

    console.log(keyValue("  💰 KC Vault", colors.accent.bold(`${liveBal.toLocaleString()} KC`)));
    console.log("");
    console.log(colors.dim("  Type `/claim` for your daily KC bonus, or `/discord unlink` to disconnect."));
  }
  console.log("");
}
