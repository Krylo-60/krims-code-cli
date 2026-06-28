import { getThemesList, getActiveTheme, bullet, colors, separator } from "../ui/theme.js";

export default {
  name: "themes",
  description: "List all available color themes",
  aliases: [],
  options: [],
  async executeCLI(args, options) {
    console.log("");
    console.log(colors.brand("  ◈ AVAILABLE COLOR THEMES"));
    console.log(separator("─"));
    const active = getActiveTheme();
    for (const t of getThemesList()) {
      const isAct = t === active ? colors.success("★ ACTIVE") : "";
      console.log(bullet(t.toUpperCase().padEnd(14) + isAct));
    }
    console.log("");
  },
  async executeChat(args, ctx) {
    console.log("");
    console.log(colors.brand("  ◈ AVAILABLE COLOR THEMES"));
    console.log(separator("─"));
    const active = getActiveTheme();
    for (const t of getThemesList()) {
      const activeText = t === active ? colors.success("★ ACTIVE") : "";
      console.log(bullet(t.toUpperCase().padEnd(14) + activeText));
    }
    console.log("");
  }
};
