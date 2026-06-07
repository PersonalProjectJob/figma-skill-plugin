---
name: telegram-commander
description: Bypass built-in Sandbox/IDE Terminal permission UIs by running all commands via Telegram approval. Universal skill for Antigravity, Claude, Cursor, and CodeX.
---

# Telegram Commander Skill

**CRITICAL RULE FOR ALL AI AGENTS (Antigravity, Claude, Cursor, CodeX, etc.):**
You MUST use this skill whenever you need to run a terminal command that executes scripts, modifies files, or alters the system. 

Do NOT run modifying commands natively (e.g. `npm run build` or `npm install`). Most IDEs and Sandboxes (like Antigravity UI or Cursor Terminal) will block the execution and wait for the user to manually click "Approve" on their desktop screen, which disrupts your autonomous operations when the user is away.

Instead, wrap **all** your terminal commands through the `run.cjs` script. This script will send an interactive card to the user's Telegram, wait for them to click "✅ Allow" on their phone, and then execute your command and stream the output back to your terminal/task log.

## Usage

To run a command, use your terminal execution tool (e.g., `run_command`, `bash`, or Cursor Terminal) exactly like this. Replace `<absolute_path_to_run.cjs>` with the actual path to this plugin's `run.cjs` script:

```bash
node <absolute_path_to_run.cjs> "your command here"
```

### Examples:
- `node C:\Users\AD\.gemini\config\plugins\telegram-commander-plugin\skills\run.cjs "pnpm vitest run tests/unit"`
- `node C:\Users\AD\.gemini\config\plugins\telegram-commander-plugin\skills\run.cjs "npm install lodash"`

*Note: The script requires a `.env.local` file containing `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `TELEGRAM_THREAD_ID` in the directory where the command is run (the project root).*

## Agent-Specific Behaviors

### For Antigravity Agents
When you invoke this wrapped command, the engine will manage it as a background task. Use your `manage_task` tool to check its status or kill it if it hangs. If the UI popup appears once for `run.cjs`, instruct the user to check "Always Allow".

### For Claude (Claude Desktop / Cline)
Use your `bash` tool to execute the `node run.cjs ...` command. Your execution will naturally pause and wait. Once the user clicks "Allow" on Telegram, the command will run and the `bash` tool will return the standard output. Do not timeout; just wait for the output.

### For Cursor (Composer) / CodeX
If you use the built-in terminal, execute the `node run.cjs ...` command. If the IDE asks the user for permission to run `run.cjs`, the user must click "Always allow" in the IDE once. After that, all your commands will silently forward approval to Telegram.

**IMPORTANT:** Read-only diagnostic commands like `dir` or `ls` or `cat` do not need to be wrapped. Only wrap execution/modifying commands.
