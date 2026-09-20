---
name: remote-agent
description: Drive a classmate's Mac through the law-school setup agent (setup-agent/ in this repo) over Tailscale - connect the MCP server, run the study-system build there, create Cowork projects by accessibility, and hand account-bound steps to their own claude -p. Use when helping someone else set up the kit on their machine.
disable-model-invocation: true
---

Usage: `/law-school-kit:remote-agent <url printed by their start-agent.command> [server name]`

You are the helper's Claude. The classmate has started
`setup-agent/start-agent.command` on their own Mac, is sitting at it, and
has sent you the URL (`http://100.x.y.z:7777/<64-hex>/mcp`). Everything
you do on their machine prints in their Terminal window and in their
`~/law-school/setup-agent.log`. Act like a guest.

RULES
- The classmate does every sign-in. Never ask them for a password, cookie,
  or token, never type one, never try to read one. The agent refuses
  credential paths, `sudo`, and recursive deletes outside `~/law-school`;
  if a call comes back `REFUSED`, do not work around it - tell the
  classmate what needed doing and let them do it.
- Never run a destructive command "to see if it is refused". The refusal
  rules are guardrails, not a sandbox; `npm test` in `setup-agent/` is how
  they are tested.
- Say what you are about to do on their screen before you do it, one step
  at a time, and stop when they say stop.
- Use `claude_run` (their own `claude -p`) for anything that needs THEIR
  account: reading their D2L or Casebook connectors, running their
  installed plugin skills, anything Cowork-related that reads their data.
  Your plan pays for the build work you do through `run`, `write_file`,
  and the GUI tools; their plan pays only for `claude_run`.
- Prefer `run`/`write_file`/`read_file` over GUI tools. Use the GUI tools
  only for things that have no CLI (Claude Desktop, Cowork projects, System
  Settings prompts).

SECTION 1 - CONNECT
If `$ARGUMENTS` has a URL, register it (server name defaults to
`<their first name>-mac`):

```
claude mcp add --transport http <name> <url>
```

Then, so the session is not interrupted on every call, add a permission
rule to `~/.claude/settings.json` (or the project's `.claude/settings.json`):

```json
{ "permissions": { "allow": ["mcp__<name>__*"] } }
```

Reload MCP servers (`/mcp`) or start a new session, then call
`agent_status`. Confirm: Tailscale IP matches the URL host, `claude_cli`
is not null, and `permissions.accessibility` and `screen_recording` are
both true. If either is false, tell the classmate to grant it to Terminal
in System Settings > Privacy & Security and restart the agent, then call
`agent_status` again. The first GUI tool call may trigger an Automation
prompt ("Terminal wants to control System Events") on their screen; they
click Allow. Record `project_root` - every relative path you pass resolves
there.

SECTION 2 - BUILD (CLI work, your plan)
This mirrors the `setup` skill's sections, executed through the agent:

1. Clone or update the kit under `project_root`:
   `run`: `git clone https://github.com/ourhouse216-cmyk/law-school-kit-plugin.git || (cd law-school-kit-plugin && git pull)`
2. Courses config: interview the classmate (Section 1 of the `setup`
   skill) in chat, then `write_file` `courses.json` and render:
   `run`: `python3 law-school-kit-plugin/law-school-kit/skills/law-school-system/render.py courses.json out`
   Fix unfilled placeholders with them.
3. Per-course project folders: for each course create
   `projects/<CODE>/CLAUDE.md` from `out/<CODE>/01 Syllabus and Admin/PROJECT PROMPT - <CODE>.md`.
4. Plugin on their machine, through THEIR CLI so it lands in their
   user scope: `claude_run` with prompt
   `Run: /plugin marketplace add ourhouse216-cmyk/law-school-kit-plugin then /plugin install law-school-kit@law-school-kit, and report the result.`
   (or `run`: `claude plugin marketplace add ... && claude plugin install ...`
   if their CLI accepts it non-interactively).
5. Anything that needs their D2L (meeting times, casebook, exam format
   still "TBD"): `claude_run` with a prompt that uses their D2L connector
   to read each syllabus and print the facts; then update `courses.json`
   and re-render.

SECTION 3 - COWORK PROJECTS (GUI, one course at a time)
Claude Desktop's process name for accessibility is `Claude`. Before each
course, tell the classmate which project you are creating and ask them to
keep their hands off the mouse until you say done.

1. `list_windows` - confirm a `Claude` window exists; ask them to open
   Claude Desktop > Cowork > Projects if not. `screenshot {app:"Claude"}`
   to see the page.
2. `ax_click {app:"Claude", role:"AXButton", name:"New project"}`.
3. In the Create dialog: `ax_find` for `AXTextField`s; click the name
   field, `type` the project name (the course code); click description,
   `type` the one-line description. Non-ASCII text (em-dashes, curly
   quotes) is fine - `type` routes it through the clipboard with a UTF-8
   locale, which fixes the mojibake seen in the screen-share sessions.
4. Folder: `ax_click` "Use a folder" then "Choose a different folder";
   in the file dialog `key cmd+shift+g`, `type` the absolute path to
   `projects/<CODE>`, `key return`, `key return`. If an
   "Allow Claude to change files" prompt appears, tell the classmate and
   let THEM click it (it is a consent prompt).
5. Instructions: `ax_click` the "+" next to Instructions, click into the
   text area, `clipboard_set` with the rendered PROJECT PROMPT, `key cmd+v`,
   then `ax_click` "Save instructions". `screenshot` to confirm.
6. If an element is not found: `ax_find {app:"Claude", name_contains:"..."}`
   without a role to see what is there; Electron trees sometimes expose
   buttons as `AXGroup` or `AXStaticText`. Fall back to `click` at the
   element's centre (`x + w/2`, `y + h/2`) as a last resort.

For Cowork scheduled tasks, skip the GUI. `~/Documents/Claude/Scheduled`
is outside `project_root`, so `write_file` cannot reach it; copy with
`run`: `mkdir -p ~/Documents/Claude/Scheduled && cp -R out/scheduled-tasks/* ~/Documents/Claude/Scheduled/`
and have the classmate press "Run now" on book-notes-nightly in Cowork.

SECTION 4 - VERIFY AND HAND OFF
- `claude_run` prompt: `Call d2l_status and list every course key.` (if
  their connector is installed).
- `read_file` one rendered doc and one CLAUDE.md to spot-check placeholders.
- Tell the classmate to close the Terminal window (that stops the agent)
  and, if they want, remove the server on your side:
  `claude mcp remove <name>`. The URL is dead after the window closes.

TROUBLESHOOTING
- `403`/connection refused: their Tailscale is off, or you are not on the
  same tailnet. `404`: the URL token is stale (agent restarted) - ask for
  the new one.
- `claude_run` says "Not logged in": their CLI must be logged in from the
  GUI; have them run `claude` once in Terminal and sign in.
- Screenshot errors mention Screen Recording: grant it to Terminal, restart
  the agent. Errors mention Automation: they click Allow on the prompt, or
  enable Terminal > System Events under Privacy & Security > Automation.
- `ax_click` finds nothing in an Electron app: `screenshot` first, then
  `click` by coordinates from the image (`origin` + pixel ×
  `points_per_image_pixel`).
