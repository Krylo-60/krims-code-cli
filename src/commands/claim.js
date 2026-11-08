import { loadConfig, saveConfig } from "../config.js";
import { colors, separator, keyValue, label } from "../ui/theme.js";

const BACKEND_URL = process.env.KRIMS_BOT_URL || "https://krims-discord-bot-d57m.onrender.com";

export default {
  name: "claim",
  signature: "claim [action]",
  description: "Claim your daily KryloCoins (KC) reward and view your balance",
  aliases: ["daily", "kc", "balance"],
  options: [],

  async executeCLI(args, options) {
    const invokedAs = (args[0] || "claim").toLowerCase();
    if (invokedAs === "balance" || invokedAs === "bal" || invokedAs === "kc") {
      await showBalanceOnly();
    } else {
      await handleClaim();
    }
  },

  async executeChat(args, ctx) {
    await handleClaim();
  }
};

async function handleClaim() {
  const config = await loadConfig();
  const disc = config.discord;

  if (!disc || !disc.id) {
    console.log("");
    console.log(colors.brand("  ⚡ KRIMS CODE REWARDS • DAILY KC CLAIM"));
    console.log(separator("─"));
    console.log(colors.warning("  ⚠️ Discord Account Not Linked!"));
    console.log(colors.text("  To claim and save your KryloCoins to your Discord & Web vault:"));
    console.log(colors.accent.bold("  👉 Run: ") + colors.brand("krims discord connect <your_discord_id>"));
    console.log(colors.dim("  (First-time connection also gives a free +1,000 KC bonus!)"));
    console.log("");
    return;
  }

  console.log("");
  console.log(colors.brand("  🔄 Claiming daily rewards from the Krims Fleet..."));

  try {
    const res = await fetch(`${BACKEND_URL}/api/cli/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId: disc.id })
    });

    if (res.ok) {
      const data = await res.json();
      disc.lastBalance = data.balance ?? disc.lastBalance;
      await saveConfig(config);

      if (data.claimed) {
        console.log("");
        console.log(colors.success("  ═════════════════════════════════════════════════════════════════"));
        console.log(colors.brand("  🎉 DAILY KC REWARD CLAIMED SUCCESSFULLY! 🚀"));
        console.log(separator("─"));
        console.log(keyValue("  👤 Account", colors.text(`@${disc.username || disc.id}`)));
        console.log(keyValue("  🎁 Reward Earned", colors.success.bold(`+${(data.reward || 250).toLocaleString()} KC`)));
        console.log(keyValue("  🔥 Daily Streak", colors.orange.bold(`${data.streak} Day(s) Streak Multiplier`)));
        console.log(keyValue("  💎 Total Vault", colors.accent.bold(`${(data.balance || 0).toLocaleString()} KC`)));
        console.log(separator("─"));
        console.log(colors.dim("  ⏱️ Next claim will be available in 24 hours."));
        console.log(colors.dim("  🌐 View your global rank & spend KC: https://krims-bot-dashboard.vercel.app/rewards"));
        console.log(colors.success("  ═════════════════════════════════════════════════════════════════"));
        console.log("");
      } else {
        const remainingHours = Math.floor((data.timeRemaining || 0) / (1000 * 60 * 60));
        const remainingMinutes = Math.floor(((data.timeRemaining || 0) % (1000 * 60 * 60)) / (1000 * 60));
        console.log("");
        console.log(colors.warning("  ⏳ DAILY COOLDOWN ACTIVE"));
        console.log(separator("─"));
        console.log(keyValue("  👤 Account", colors.text(`@${disc.username || disc.id}`)));
        console.log(keyValue("  ⏱️ Cooldown Remaining", colors.warning(`${remainingHours}h ${remainingMinutes}m`)));
        console.log(keyValue("  💰 Current Vault", colors.accent.bold(`${(data.balance || disc.lastBalance || 0).toLocaleString()} KC`)));
        console.log(keyValue("  🔥 Streak Saved", `${data.streak || 1} Day(s)`));
        console.log(separator("─"));
        console.log(colors.dim("  Tip: Chat in the Discord server or use /ask to level up and earn passive KC!"));
        console.log("");
      }
    } else {
      console.log("\n" + label.system + " " + colors.warning("Could not reach rewards server. Please try again shortly.\n"));
    }
  } catch (err) {
    console.log("\n" + label.system + " " + colors.warning(`Network error: ${err.message}. Please check your connection.\n`));
  }
}

async function showBalanceOnly() {
  const config = await loadConfig();
  const disc = config.discord;

  console.log("");
  console.log(colors.brand("  ⚡ KRIMS CODE VAULT • BALANCE SUMMARY"));
  console.log(separator("─"));

  if (!disc || !disc.id) {
    console.log(colors.warning("  ⚠️ No Discord account linked."));
    console.log(colors.text("  Run `krims discord connect <your_discord_id>` to link and claim +1,000 KC!"));
    console.log("");
    return;
  }

  let bal = disc.lastBalance || 1000;
  let streak = 0;
  try {
    const res = await fetch(`${BACKEND_URL}/api/cli/balance?discordId=${disc.id}`);
    if (res.ok) {
      const data = await res.json();
      bal = data.balance ?? bal;
      streak = data.streak || 0;
      disc.lastBalance = bal;
      await saveConfig(config);
    }
  } catch (_) {}

  console.log(keyValue("  👤 Linked Discord", colors.success(`@${disc.username || disc.id}`)));
  console.log(keyValue("  💰 KryloCoins Vault", colors.accent.bold(`${bal.toLocaleString()} KC`)));
  console.log(keyValue("  🔥 Active Streak", `${streak} Day(s)`));
  console.log(separator("─"));
  console.log(colors.dim("  Type `krims claim` to claim your daily KC, or visit https://krims-bot-dashboard.vercel.app"));
  console.log("");
}
