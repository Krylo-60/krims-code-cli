import { getAIConfig, setConfigValue } from "../config.js";
import { colors, label, setTheme, getThemesList } from "../ui/theme.js";

export default {
  name: "theme",
  signature: "theme [name]",
  description: "Show active visual theme or switch to a new theme",
  aliases: [],
  options: [],
  async executeCLI(args, options) {
    const name = args[0];
    if (!name) {
      const aiConfig = await getAIConfig();
      const theme = aiConfig.THEME || "cyberpunk";
      console.log("\n" + label.config + " " + colors.muted("Active Theme: ") + colors.accent(theme.toUpperCase()) + "\n");
    } else {
      const success = setTheme(name);
      if (success) {
        await setConfigValue("THEME", name.toLowerCase().trim());
        console.log("\n" + label.config + " " + colors.success(`✓ Switched theme to ${name.toUpperCase()}`) + "\n");
      } else {
        console.log("\n" + label.error + " " + colors.danger(`Unknown theme: "${name}".`) + colors.muted(` Available: ${getThemesList().join(", ")}\n`));
      }
    }
  },
  async executeChat(args, ctx) {
    const themeName = args[0];
    if (!themeName) {
      console.log("\n" + label.system + " " + colors.warning("Usage: /theme <theme-name>. Type /themes to list themes.\n"));
      return;
    }

    const success = setTheme(themeName);
    if (success) {
      await setConfigValue("THEME", themeName.toLowerCase().trim());
      console.log("\n" + label.system + " " + colors.success(`✓ Theme switched to ${themeName.toUpperCase()}`));
      console.log("  " + colors.muted("Visual grid modulates synchronized.\n"));
    } else {
      console.log("\n" + label.system + " " + colors.danger(`Unknown theme: "${themeName}".`) + " " + colors.muted(`Available: ${getThemesList().join(", ")}\n`));
    }
  }
};
