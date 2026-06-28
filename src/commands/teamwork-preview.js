import fs from 'node:fs';
import path from 'node:path';
import { colors, separator, label } from '../ui/theme.js';

export function parseArgs(args) {
  const options = { watch: false, agent: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-w' || arg === '--watch') {
      options.watch = true;
    } else if (arg === '-a' || arg === '--agent') {
      options.agent = args[i + 1] || null;
      i++;
    } else if (arg.startsWith('--agent=')) {
      options.agent = arg.split('=')[1] || null;
    }
  }
  return options;
}

export function parseAgentState(name, agentPath, currentTime = new Date()) {
  let mission = 'Unknown';
  let lastVisited = null;
  let status = 'STALE';
  let heartbeatText = 'Never';

  const briefingPath = path.join(agentPath, 'BRIEFING.md');
  if (fs.existsSync(briefingPath)) {
    const content = fs.readFileSync(briefingPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const missionIdx = lines.findIndex(l => l.trim().startsWith('## Mission'));
    if (missionIdx !== -1) {
      for (let i = missionIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#')) break;
        if (line) {
          mission = line;
          break;
        }
      }
    }
    if (mission === 'Unknown' || mission.includes('[') || mission.includes('TBD')) {
      const milestoneMatch = content.match(/-\s*Milestone:\s*([^\r\n]+)/i);
      if (milestoneMatch) {
        mission = milestoneMatch[1].trim();
      } else {
        const focusMatch = content.match(/-\s*Focus:\s*([^\r\n]+)/i);
        if (focusMatch) {
          mission = focusMatch[1].trim();
        }
      }
    }
  }

  const progressPath = path.join(agentPath, 'progress.md');
  if (fs.existsSync(progressPath)) {
    const content = fs.readFileSync(progressPath, 'utf8');
    const match = content.match(/Last visited:\s*([^\r\n]+)/i);
    if (match) {
      const parsedDate = new Date(match[1].trim());
      if (!isNaN(parsedDate.getTime())) {
        lastVisited = parsedDate;
      }
    }
  }

  const hasHandoff = fs.existsSync(path.join(agentPath, 'handoff.md'));

  if (lastVisited) {
    const diffMs = currentTime.getTime() - lastVisited.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMs > 10 * 60 * 1000) {
      status = 'STALE';
    } else {
      status = 'ACTIVE';
    }
    if (diffMins <= 0) {
      heartbeatText = 'Just now';
    } else {
      heartbeatText = `${diffMins}m ago`;
    }
  } else {
    status = 'STALE';
    heartbeatText = 'Never';
  }

  if (hasHandoff) {
    status = 'COMPLETED';
  }

  return {
    name,
    status,
    heartbeat: heartbeatText,
    mission
  };
}

export function scanAgents(agentsDir, currentTime = new Date()) {
  if (!fs.existsSync(agentsDir)) {
    return [];
  }
  const files = fs.readdirSync(agentsDir, { withFileTypes: true });
  const agents = [];
  for (const file of files) {
    if (!file.isDirectory()) continue;
    if (file.name.startsWith('.')) continue;

    const agentPath = path.join(agentsDir, file.name);
    const hasProgress = fs.existsSync(path.join(agentPath, 'progress.md'));
    const hasBriefing = fs.existsSync(path.join(agentPath, 'BRIEFING.md'));
    const hasHandoff = fs.existsSync(path.join(agentPath, 'handoff.md'));

    if (!hasProgress && !hasBriefing && !hasHandoff) {
      continue;
    }

    agents.push(parseAgentState(file.name, agentPath, currentTime));
  }
  return agents;
}

export function printAgentDetails(agentName, agentsDir) {
  const agentPath = path.join(agentsDir, agentName);
  if (!fs.existsSync(agentPath)) {
    console.log(label.error + ` Agent "${agentName}" not found.`);
    return false;
  }

  console.log("");
  console.log(colors.brand(`  ⚡ AGENT PROFILE: ${agentName.toUpperCase()}`));
  console.log(separator("─"));

  const planPath = path.join(agentPath, 'plan.md');
  if (fs.existsSync(planPath)) {
    console.log("");
    console.log(colors.accent(`  ◈ PLAN (plan.md):`));
    console.log(separator("─"));
    console.log(fs.readFileSync(planPath, 'utf8'));
  } else {
    console.log("");
    console.log(colors.warning(`  Plan file (plan.md) not found for ${agentName}.`));
  }

  const handoffPath = path.join(agentPath, 'handoff.md');
  if (fs.existsSync(handoffPath)) {
    console.log("");
    console.log(colors.accent(`  ◈ HANDOFF (handoff.md):`));
    console.log(separator("─"));
    console.log(fs.readFileSync(handoffPath, 'utf8'));
  } else {
    console.log("");
    console.log(colors.warning(`  Handoff file (handoff.md) not found for ${agentName}.`));
  }
  return true;
}

export function renderTable(agents) {
  const colWidths = [35, 11, 12, 45];
  const borderChar = '│';

  console.log('  ┌' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐');

  const headers = ['AGENT NAME', 'STATUS', 'HEARTBEAT', 'ACTIVE GOAL / MILESTONE'];
  const headerRow = '  ' + borderChar + headers.map((h, i) => {
    const text = h.padEnd(colWidths[i]);
    return colors.brand(text);
  }).join(borderChar) + borderChar;
  console.log(headerRow);

  console.log('  ├' + colWidths.map(w => '─'.repeat(w)).join('┼') + '┤');

  for (const agent of agents) {
    const nameStr = padString(agent.name, colWidths[0]);
    const heartbeatStr = padString(agent.heartbeat, colWidths[2]);
    const missionStr = padString(agent.mission, colWidths[3]);

    let statusColored = '';
    if (agent.status === 'COMPLETED') {
      statusColored = colors.success(padString('COMPLETED', colWidths[1]));
    } else if (agent.status === 'ACTIVE') {
      statusColored = colors.accent3(padString('ACTIVE', colWidths[1]));
    } else {
      statusColored = colors.warning(padString('STALE', colWidths[1]));
    }

    const row = '  ' + borderChar +
      colors.text(nameStr) + borderChar +
      statusColored + borderChar +
      colors.muted(heartbeatStr) + borderChar +
      colors.text(missionStr) + borderChar;
    console.log(row);
  }

  console.log('  └' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘');
}

function padString(str, length) {
  if (str.length > length) {
    return str.slice(0, length - 3) + '...';
  }
  return str.padEnd(length);
}

export default {
  name: "teamwork-preview",
  description: "View status and heartbeat of subagents",
  aliases: ["teamwork"],
  signature: "teamwork-preview",
  options: [
    {
      flags: "-w, --watch",
      description: "Automatically refresh the status matrix every 3 seconds"
    },
    {
      flags: "-a, --agent <name>",
      description: "Show detailed profile of a specific agent"
    }
  ],
  async executeCLI(args, options) {
    const agentsDir = path.join(process.cwd(), '.agents');
    const parsed = {
      watch: !!(options.watch || args.includes('-w') || args.includes('--watch')),
      agent: options.agent || null
    };
    if (!parsed.agent) {
      const manual = parseArgs(args);
      if (manual.agent) parsed.agent = manual.agent;
      if (manual.watch) parsed.watch = true;
    }

    if (parsed.agent) {
      printAgentDetails(parsed.agent, agentsDir);
      return;
    }

    if (parsed.watch) {
      const isTest = process.env.NODE_ENV === 'test' || options.testOnce;
      const runTick = () => {
        process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
        console.log("");
        console.log(colors.brand("  ⚡ AETHER TEAMWORK DASHBOARD [WATCH MODE]"));
        console.log(separator("─"));
        console.log("");
        
        const agents = scanAgents(agentsDir);
        if (agents.length === 0) {
          console.log("  " + colors.warning("No agent workspace directories detected."));
        } else {
          renderTable(agents);
        }
        
        if (options.onTick) {
          options.onTick();
        }
        
        if (!isTest) {
          setTimeout(runTick, 3000);
        }
      };
      runTick();
    } else {
      console.log("");
      console.log(colors.brand("  ⚡ AETHER TEAMWORK DASHBOARD"));
      console.log(separator("─"));
      console.log("");

      const agents = scanAgents(agentsDir);
      if (agents.length === 0) {
        console.log("  " + colors.warning("No agent workspace directories detected."));
      } else {
        renderTable(agents);
      }
      console.log("");
    }
  },
  async executeChat(args, ctx) {
    const agentsDir = path.join(process.cwd(), '.agents');
    const parsed = parseArgs(args);

    if (parsed.agent) {
      printAgentDetails(parsed.agent, agentsDir);
      return;
    }

    if (parsed.watch) {
      const isTest = process.env.NODE_ENV === 'test' || args.includes('--test-once') || ctx.testOnce;
      const runTick = () => {
        process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
        console.log("");
        console.log(colors.brand("  ⚡ AETHER TEAMWORK DASHBOARD [WATCH MODE]"));
        console.log(separator("─"));
        console.log("");

        const agents = scanAgents(agentsDir);
        if (agents.length === 0) {
          console.log("  " + colors.warning("No agent workspace directories detected."));
        } else {
          renderTable(agents);
        }

        if (ctx.onTick) {
          ctx.onTick();
        }

        if (!isTest) {
          setTimeout(runTick, 3000);
        }
      };
      runTick();
    } else {
      console.log("");
      console.log(colors.brand("  ⚡ AETHER TEAMWORK DASHBOARD"));
      console.log(separator("─"));
      console.log("");

      const agents = scanAgents(agentsDir);
      if (agents.length === 0) {
        console.log("  " + colors.warning("No agent workspace directories detected."));
      } else {
        renderTable(agents);
      }
      console.log("");
    }
  }
};
