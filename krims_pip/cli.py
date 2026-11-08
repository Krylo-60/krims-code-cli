import sys
import os
import json
import getpass
import urllib.request
import urllib.error
from krims_code_sdk import KrimsClient, PROVIDERS

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

API_BASE = "https://krims-discord-bot-d57m.onrender.com"

# ANSI color helper matching chalk
class Colors:
    RED = "\033[31m"
    CYAN = "\033[36m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    WHITE = "\033[37m"
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    
    @staticmethod
    def hex(code):
        h = code.lstrip('#')
        r, g, b = tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
        return f"\033[38;2;{r};{g};{b}m"

# Config Path Resolver
def get_config_path():
    home = os.path.expanduser("~")
    # Check ~/.krims/config.json first for parity with Node CLI
    node_config = os.path.join(home, ".krims", "config.json")
    if os.path.exists(node_config):
        return node_config
    return os.path.join(home, ".aether", "config.json")

def load_config():
    config_path = get_config_path()
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_config(config):
    config_path = get_config_path()
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

def handle_discord(args, config):
    action = args[0].lower() if len(args) > 0 else "status"
    subarg = args[1] if len(args) > 1 else ""

    if action in ["link", "connect"]:
        target_id = subarg or (args[0] if len(args) == 1 and args[0].isdigit() else "")
        if not target_id:
            print(f"\n{Colors.YELLOW}Usage: krims-pip discord connect <your_discord_id>{Colors.RESET}")
            print(f"{Colors.DIM}Enable Developer Mode in Discord, right-click your profile, and select 'Copy User ID'.{Colors.RESET}\n")
            return

        print(f"\n{Colors.CYAN}Connecting Discord identity [{target_id}] to Krims Fleet...{Colors.RESET}")
        try:
            req_data = json.dumps({"discordId": target_id, "username": getpass.getuser()}).encode("utf-8")
            req = urllib.request.Request(
                f"{API_BASE}/api/cli/connect",
                data=req_data,
                headers={"Content-Type": "application/json", "User-Agent": "KrimsCodeCLI-Python/1.5.8"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            if not data.get("ok"):
                print(f"{Colors.RED}Connection failed: {data.get('error', 'Unknown error')}{Colors.RESET}")
                return

            config["discord_id"] = data.get("discordId")
            config["discord_user"] = data.get("username")
            config["discord_linked_at"] = os.times().elapsed
            save_config(config)

            bonus_msg = f"{Colors.GREEN} (+1,000 KC Link Bonus Awarded!){Colors.RESET}" if data.get("bonusAwarded") else ""
            print(f"\n{Colors.CYAN}⚡ DISCORD IDENTITY LINKED SUCCESSFULLY!{Colors.RESET}")
            print("─" * 60)
            print(f"  Account     : {Colors.CYAN}@{data.get('username')}{Colors.RESET}")
            print(f"  Discord ID  : {data.get('discordId')}")
            print(f"  KC Vault    : {Colors.YELLOW}{data.get('balance', 0):,} KC{Colors.RESET}{bonus_msg}")
            print("─" * 60)
            print(f"{Colors.DIM}Use /claim for daily rewards directly in your terminal.{Colors.RESET}\n")
        except Exception as e:
            print(f"{Colors.RED}Failed to reach Krims rewards server: {e}{Colors.RESET}\n")

    elif action == "unlink":
        if "discord_id" not in config:
            print(f"\n{Colors.YELLOW}No Discord account currently linked.{Colors.RESET}\n")
            return
        old_id = config.pop("discord_id", None)
        config.pop("discord_user", None)
        save_config(config)
        print(f"\n{Colors.GREEN}✓ Disconnected Discord identity ({old_id}).{Colors.RESET}\n")

    else:
        # Status
        disc_id = config.get("discord_id")
        if not disc_id:
            print(f"\n{Colors.YELLOW}⚡ KRIMS CODE • DISCORD IDENTITY{Colors.RESET}")
            print("─" * 60)
            print(f"  Status: {Colors.RED}✗ Not Linked{Colors.RESET}")
            print("─" * 60)
            print("  Link your account to earn +1,000 KC and claim daily terminal drops:")
            print(f"  {Colors.CYAN}krims-pip discord connect <discord_id>{Colors.RESET}\n")
            return

        try:
            req = urllib.request.Request(
                f"{API_BASE}/api/cli/balance?discordId={disc_id}",
                headers={"User-Agent": "KrimsCodeCLI-Python/1.5.8"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            bal = data.get("balance", 0)
        except Exception:
            bal = "Unavailable"

        print(f"\n{Colors.CYAN}⚡ KRIMS CODE • DISCORD IDENTITY{Colors.RESET}")
        print("─" * 60)
        print(f"  Status     : {Colors.GREEN}✓ Connected{Colors.RESET}")
        print(f"  Account    : {Colors.CYAN}@{config.get('discord_user', disc_id)}{Colors.RESET}")
        print(f"  Discord ID : {disc_id}")
        print(f"  KC Vault   : {Colors.YELLOW}{bal:,} KC{Colors.RESET}" if isinstance(bal, int) else f"  KC Vault   : {bal}")
        print("─" * 60)
        print(f"{Colors.DIM}Type /claim for daily rewards, or krims-pip discord unlink to disconnect.{Colors.RESET}\n")

def handle_claim(config):
    disc_id = config.get("discord_id")
    if not disc_id:
        print(f"\n{Colors.YELLOW}⚠️  No Discord Account Linked!{Colors.RESET}")
        print("─" * 60)
        print("Link your Discord ID first to claim KC drops directly into your vault:")
        print(f"  {Colors.CYAN}krims-pip discord connect <your_discord_id>{Colors.RESET}")
        print("─" * 60)
        print(f"{Colors.DIM}First-time linking grants an instant +1,000 KC bonus!{Colors.RESET}\n")
        return

    print(f"\n{Colors.CYAN}🔄 Contacting the Krims Fleet Rewards Server...{Colors.RESET}")
    try:
        req_data = json.dumps({"discordId": disc_id}).encode("utf-8")
        req = urllib.request.Request(
            f"{API_BASE}/api/cli/claim",
            data=req_data,
            headers={"Content-Type": "application/json", "User-Agent": "KrimsCodeCLI-Python/1.5.8"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if not data.get("ok"):
            print(f"{Colors.RED}Claim failed: {data.get('error', 'Unknown error')}{Colors.RESET}")
            return

        if data.get("claimed"):
            reward = data.get("reward", 250)
            streak = data.get("streak", 1)
            bal = data.get("balance", 0)
            print(f"\n{Colors.GREEN}═════════════════════════════════════════════════════════════════{Colors.RESET}")
            print(f"{Colors.GREEN}🎉 DAILY KC REWARD CLAIMED SUCCESSFULLY! 🚀{Colors.RESET}")
            print("─" * 60)
            print(f"  Account       : {Colors.CYAN}@{config.get('discord_user', disc_id)}{Colors.RESET}")
            print(f"  Reward Earned : {Colors.YELLOW}+{reward:,} KC{Colors.RESET}")
            print(f"  Daily Streak  : {Colors.CYAN}{streak} Day(s) Multiplier{Colors.RESET}")
            print(f"  Total Vault   : {Colors.YELLOW}{bal:,} KC{Colors.RESET}")
            print("─" * 60)
            print(f"{Colors.DIM}Next claim available in 24 hours. View rewards: https://krims-bot-dashboard.vercel.app/rewards{Colors.RESET}")
            print(f"{Colors.GREEN}═════════════════════════════════════════════════════════════════{Colors.RESET}\n")
        else:
            time_rem = data.get("timeRemaining", 0)
            hrs = time_rem // (1000 * 60 * 60)
            mins = (time_rem % (1000 * 60 * 60)) // (1000 * 60)
            bal = data.get("balance", 0)
            streak = data.get("streak", 1)
            print(f"\n{Colors.YELLOW}⏳ DAILY COOLDOWN ACTIVE{Colors.RESET}")
            print("─" * 60)
            print(f"  Account     : {Colors.CYAN}@{config.get('discord_user', disc_id)}{Colors.RESET}")
            print(f"  Cooldown    : {Colors.YELLOW}{hrs}h {mins}m remaining{Colors.RESET}")
            print(f"  Current KC  : {Colors.YELLOW}{bal:,} KC{Colors.RESET}")
            print(f"  Saved Streak: {streak} Day(s)")
            print("─" * 60)
            print(f"{Colors.DIM}Chat in the Discord server or use Krims Code to level up and earn passive KC!{Colors.RESET}\n")

    except Exception as e:
        print(f"{Colors.RED}Could not reach rewards server: {e}{Colors.RESET}\n")

def print_banner(config, current_mode="titan"):
    c1 = Colors.hex('#FF3E3E') # Red-Orange
    c2 = Colors.hex('#FF8500') # Orange
    c3 = Colors.hex('#FFD000') # Yellow
    c4 = Colors.hex('#00F2FF') # Cyan
    c5 = Colors.hex('#0085FF') # Blue
    c6 = Colors.hex('#7000FF') # Violet
    c7 = Colors.hex('#B000FF') # Purple
    dim = Colors.DIM
    reset = Colors.RESET

    username = getpass.getuser() or "Explorer"
    cwd = os.getcwd()
    home = os.path.expanduser("~")
    display_cwd = cwd
    if cwd.startswith(home):
        display_cwd = "~" + cwd[len(home):]

    # Resolve active providers
    active_providers = []
    for k, p in PROVIDERS.items():
        env_key = p.get('envKey')
        if env_key and os.environ.get(env_key):
            active_providers.append(k)
        elif env_key and config.get(env_key):
            active_providers.append(k)
            
    if active_providers:
        active_names = ", ".join(set(active_providers))
        mesh_status = f"{Colors.GREEN}● Online ({len(active_providers)} active node(s)){reset}"
    else:
        active_names = "Local math & offline logic only"
        mesh_status = f"{Colors.YELLOW}○ Offline (Local fallbacks active){reset}"

    # Truncate values to fit screen
    max_val_width = 46
    if len(display_cwd) > max_val_width:
        display_cwd = "..." + display_cwd[-(max_val_width - 3):]
    if len(active_names) > max_val_width:
        active_names = active_names[:max_val_width - 3] + "..."

    logo = [
        c1("  █▄     ▄█"),
        c2("  ██    ██ "),
        c3("  ██ ▄█    "),
        c4("  ███▀     "),
        c5("  ██ ▀█    "),
        c6("  ██    ██ "),
        c7("  █▀     ▀█")
    ]

    info = [
        f"   ⚡ {c4}KRIMS CODE COMMAND STATION v1.5.8{reset} • Welcome back, {c4}{username}{reset}",
        dim("   " + "─" * 58),
        f"     {dim}Workspace{reset} : {display_cwd}",
        f"     {dim}Mode{reset}      : {c4}{current_mode.upper()}{reset} {dim}— Ultimate reasoning fusion of Codex & Claude Code.{reset}",
        f"     {dim}Network{reset}   : {mesh_status}",
        f"     {dim}Engine{reset}    : {active_names}",
        f"     {dim}Packager{reset}  : pip (krims-code-cli)"
    ]

    print("")
    for i in range(7):
        print(logo[i] + info[i] + reset)
    print("")

def run_chat(config, model=None, provider=None):
    # Resolve default provider
    prov_key = provider or config.get("DEFAULT_PROVIDER") or "google"
    model_name = model or config.get("DEFAULT_MODEL") or ""
    
    # Resolve key
    prov_config = PROVIDERS.get(prov_key.lower(), {})
    env_key = prov_config.get("envKey", "")
    api_key = config.get(env_key) or os.environ.get(env_key) or ""

    client = KrimsClient(provider=prov_key, model=model_name, api_key=api_key)
    session = client.create_session()

    print_banner(config)
    print(f"{Colors.DIM}Type 'exit' or 'quit' to terminate session. /claim for daily KC, /discord connect <id> to link.{Colors.RESET}\n")

    while True:
        try:
            prompt = input(f"{Colors.hex('#00F2FF')}you > {Colors.RESET}").strip()
            if not prompt:
                continue
            if prompt.lower() in ['exit', 'quit']:
                break
            
            # Slash commands in chat
            if prompt.startswith("/discord"):
                parts = prompt.split()
                handle_discord(parts[1:], config)
                continue
            if prompt.lower() in ["/claim", "/daily", "/kc", "/balance"]:
                handle_claim(config)
                continue
            
            print(f"{Colors.DIM}krims is composing response...{Colors.RESET}")
            res = session.ask(prompt)
            print(f"\n{Colors.hex('#7000FF')}krims > {Colors.RESET}{res['text']}\n")
        except KeyboardInterrupt:
            print("\nSession terminated.")
            break
        except Exception as e:
            print(f"\n{Colors.RED}Error: {e}{Colors.RESET}\n")

def run_ask(prompt, config):
    prov_key = config.get("DEFAULT_PROVIDER") or "google"
    model_name = config.get("DEFAULT_MODEL") or ""
    prov_config = PROVIDERS.get(prov_key.lower(), {})
    env_key = prov_config.get("envKey", "")
    api_key = config.get(env_key) or os.environ.get(env_key) or ""

    client = KrimsClient(provider=prov_key, model=model_name, api_key=api_key)
    try:
        res = client.ask(prompt)
        print(res['text'])
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

def handle_config(args, config):
    if len(args) == 0:
        print("Usage: krims-pip config <get/set/list/delete> [key] [value]")
        return
        
    action = args[0].lower()
    if action == "list":
        for k, v in config.items():
            print(f"{k}={v}")
    elif action == "get" and len(args) >= 2:
        print(config.get(args[1], ""))
    elif action == "set" and len(args) >= 3:
        config[args[1]] = args[2]
        save_config(config)
        print(f"Set {args[1]}={args[2]}")
    elif action == "delete" and len(args) >= 2:
        if args[1] in config:
            del config[args[1]]
            save_config(config)
            print(f"Deleted {args[1]}")
        else:
            print(f"Key {args[1]} not found")
    else:
        print("Invalid config arguments.")

def main():
    config = load_config()
    args = sys.argv[1:]

    if not args:
        run_chat(config)
        return

    cmd = args[0].lower()
    if cmd == "chat":
        run_chat(config)
    elif cmd in ["claim", "daily", "balance", "kc"]:
        handle_claim(config)
    elif cmd in ["discord", "link"]:
        handle_discord(args[1:], config)
    elif cmd == "ask" and len(args) >= 2:
        run_ask(args[1], config)
    elif cmd == "config":
        handle_config(args[1:], config)
    elif cmd in ["version", "-v", "--version"]:
        print("Krims Code CLI v1.5.8 (Native Python Edition)")
    elif cmd in ["help", "-h", "--help"]:
        print("Krims Code CLI — Native Python Edition")
        print("\nCommands:")
        print("  chat                       Start stateful chat loop (default)")
        print("  claim | daily              Claim daily KC rewards (+250 KC)")
        print("  discord connect <id>       Link Discord account to Krims Fleet (+1,000 KC bonus)")
        print("  discord                    View linked Discord account and KC vault")
        print("  ask <prompt>               Get single answer for prompt")
        print("  config <get/set/list>      Get or set keys")
        print("  version                    Display version info")
    else:
        # Fallback to ask if they just write a prompt directly
        run_ask(" ".join(args), config)
        run_ask(" ".join(args), config)

if __name__ == "__main__":
    main()
