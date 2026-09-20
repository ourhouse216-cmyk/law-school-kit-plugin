# law-school setup agent

A small program you run on your own Mac so a classmate you trust can build the
law-school study system on it from *their* Claude, over Tailscale, while you
watch. It replaces screen-sharing sessions. It is remote control by design, so
read this page before you start it.

## What you give up, exactly

- **Only while it is running.** Close the Terminal window and it is gone.
  Nothing is installed as a service; nothing starts on login.
- **Only over your Tailscale network.** It listens on your Tailscale address
  and refuses to start without one. It never listens on the open internet or
  your home Wi-Fi.
- **Only with the URL printed at start.** The URL contains a 64-character
  random token that changes every start. Send it only to the person helping
  you, over a channel you trust.
- **Everything is logged.** Every action prints in the Terminal window as it
  happens and is appended to `~/law-school/setup-agent.log`, with the
  arguments used.
- **It never touches your secrets.** Any command or path that mentions
  `~/.ssh`, `~/.claude.json`, `~/.claude/`, Keychains, browser cookies, or
  Claude Desktop's data folder is refused. `sudo` is refused. A recursive
  delete is refused unless its target is inside `~/law-school` or `/tmp`.
  Files can only be read or written inside `~/law-school` and `/tmp`.
- **You do every sign-in yourself.** The helper's Claude will ask you to log
  in to things (Claude, Google Drive, D2L). Type your own passwords; never
  paste them to anyone.

It *can* click, type, take screenshots and run ordinary commands on your Mac
while it is running, just like a person sitting at the keyboard. The refusals
above are guardrails against mistakes, not a sandbox: whoever holds the URL
can do most of what you could do yourself at the keyboard. Only give it to
someone you trust, stay at the computer, and close the window if anything
looks wrong. Have a backup (Time Machine or iCloud) before you start it.

## One-time setup (about 5 minutes)

1. Install [Tailscale](https://tailscale.com/download) and sign in. Accept
   the invitation to your helper's network (they will send it).
2. Install [Node.js](https://nodejs.org) (the LTS build).
3. Put this `setup-agent` folder somewhere permanent, e.g.
   `~/law-school/law-school-kit-plugin/setup-agent/`.
4. Double-click `start-agent.command`. The first run installs its two
   dependencies. If macOS says the file is from an unidentified developer,
   right-click it, choose Open, then Open again.
5. Grant three permissions to **Terminal** when macOS asks (or in
   System Settings › Privacy & Security):
   - **Accessibility** (so it can click and type)
   - **Screen Recording** (so screenshots work at all)
   - **Automation › System Events** (macOS asks the first time a GUI tool runs)

   Restart the agent after granting them.
6. Copy the printed URL to your helper. Leave the window open.

To stop: close the Terminal window. To revoke the helper entirely: remove them
from your Tailscale network, or just don't start the agent again.

## Environment variables (optional)

| Variable | Default | Meaning |
| --- | --- | --- |
| `SETUP_AGENT_PORT` | `7777` | Port on the Tailscale address |
| `SETUP_AGENT_PROJECT_ROOT` | `~/law-school` | The only folder (plus `/tmp`) the file tools and recursive deletes may touch; also the default working directory for `run` |

## Tools the helper's Claude gets

| Tool | What it does | Limits |
| --- | --- | --- |
| `agent_status` | Hostname, user, macOS version, Tailscale IP, project root, whether Accessibility and Screen Recording are granted | read-only |
| `list_windows` | Visible apps and their window titles and bounds | read-only |
| `screenshot` | PNG of the screen, an app's front window, a window by title, or a region; downscaled | needs Screen Recording |
| `ax_find` | Search an app's front-window accessibility tree by role and name | read-only, max 500 elements |
| `ax_click` | Press an accessibility element by role and name | needs Accessibility |
| `click` | Click at screen coordinates (single, double, triple) | needs Accessibility |
| `type` | Type text; non-ASCII goes via clipboard + cmd+V with a UTF-8 locale, clipboard restored afterwards | needs Accessibility |
| `key` | Press a key combo, e.g. `cmd+shift+g`, `return`, `esc` | needs Accessibility |
| `scroll` | Scroll the wheel at a point | needs Accessibility |
| `clipboard_set` / `clipboard_get` | Read or set the clipboard as UTF-8 text | |
| `run` | Run a zsh command, default cwd `~/law-school`, 60 s timeout (max 600 s) | refuses `sudo`/`su`/`doas`, `security`, `tccutil`, any recursive `rm` whose target is not inside `~/law-school` or `/tmp` (or is not a literal path), any mention of `~/.ssh`, `~/.claude.json`, `~/.claude/`, Keychains, Cookies, or a Claude folder or wildcard under `~/Library`; cwd may not be under `~/Library` |
| `read_file` / `write_file` / `list_dir` | Text files and folders | only inside `~/law-school` or `/tmp`; symlinks resolved; 200 KB read cap |
| `claude_run` | Run **your** `claude -p …` non-interactively from this GUI session so your login, plugins and connectors apply | uses your plan; default 15 min timeout, max 60 min |

Refused calls are logged as `REFUSED` with the reason, and the helper's Claude
sees the same message. `npm test` runs the refusal rules against a table of
commands without running any of them.

## How it works (for the curious)

`server.mjs` is a single-file
[Model Context Protocol](https://modelcontextprotocol.io) server on Node's
built-in HTTP module using the streamable-HTTP transport, stateless per
request. GUI actions use macOS System Events (AppleScript / JXA), screenshots
use `screencapture` + `sips`, and the clipboard uses `pbcopy`/`pbpaste` with
`LANG=en_US.UTF-8` so em-dashes and curly quotes survive. Dependencies:
`@modelcontextprotocol/sdk` and `zod`. Nothing phones home.
