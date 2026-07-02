import { colors, label, separator, keyValue } from "../ui/theme.js";

export default {
  name: "dashboard",
  description: "Launch visual telemetry dashboard HUD in browser",
  aliases: ["telemetry"],
  options: [
    {
      flags: "-p, --port <port>",
      description: "Port to run the dashboard server on",
      defaultValue: "5050"
    }
  ],
  async executeCLI(args, options) {
    const { startTelemetryServer, openBrowser } = await import("../telemetry-server.js");
    const parsedPort = parseInt(options.port, 10) || 5050;

    console.log("");
    console.log(label.system + " " + colors.brand("Initializing Krims Code Visual Telemetry HUD..."));

    try {
      const { port } = await startTelemetryServer(parsedPort);
      const url = `http://localhost:${port}`;
      console.log("  " + colors.success(`✓ Telemetry Server active at ${colors.accent(url)}`));
      console.log("  " + colors.muted("Press Ctrl+C to terminate dashboard server."));
      console.log("");

      openBrowser(url);
    } catch (err) {
      console.log("\n" + label.error + " " + colors.danger(`Failed to start telemetry server: ${err.message}\n`));
      process.exit(1);
    }
  },
  async executeChat(args, ctx) {
    const { startDashboardServer } = await import("../dashboard.js");
    const { exec } = await import("node:child_process");

    try {
      const { port } = await startDashboardServer();
      console.log("\n" + label.system + " " + colors.brand("📊 Krims Code WEB TELEMETRY DASHBOARD"));
      console.log(separator("─"));
      console.log(keyValue("  Status", colors.success("ONLINE")));
      console.log(keyValue("  Local URL", `http://localhost:${port}`));
      console.log("");
      console.log("  " + colors.muted("Launching browser companion automatically..."));

      let startCmd = `start http://localhost:${port}`;
      if (process.platform === "darwin") {
        startCmd = `open http://localhost:${port}`;
      } else if (process.platform === "linux") {
        startCmd = `xdg-open http://localhost:${port}`;
      }
      exec(startCmd);
      console.log("\n" + label.system + " " + colors.success("✓ Dashboard launched. Press Ctrl+C in this session to stop dashboard at exit.\n"));
    } catch (err) {
      console.log("\n" + label.error + " " + colors.danger("Failed to start dashboard server: " + err.message + "\n"));
    }
  }
};
