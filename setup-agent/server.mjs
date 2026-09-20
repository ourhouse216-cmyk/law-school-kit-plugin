#!/usr/bin/env node
// law-school setup agent — a small MCP server a classmate runs on their own Mac
// so a trusted helper's Claude can build the study system there over Tailscale.
//
// Safety properties (do not weaken without re-reading README.md):
//   * binds ONLY to this Mac's Tailscale IPv4 address; refuses to start without one
//   * the MCP endpoint lives at /<64-hex random token>/mcp, printed once at start
//   * every tool call is logged (stdout + setup-agent.log) with its arguments
//   * `run` refuses sudo, credential paths, and recursive rm outside the sandbox
//   * file tools are confined to PROJECT_ROOT (default ~/law-school) and /tmp
//   * closing the Terminal window stops the agent
//
// The refusal rules are guardrails, not a security boundary. Test them with
// `node test-refusals.mjs` (pure function calls) — never by sending a
// destructive command to a running agent.

import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const execFileP = promisify(execFile);

// ---------------------------------------------------------------- config ----
const HOME = os.homedir();
const PORT = Number(process.env.SETUP_AGENT_PORT || 7777);
export const PROJECT_ROOT = path.resolve(
  (process.env.SETUP_AGENT_PROJECT_ROOT || path.join(HOME, "law-school")).replace(/^~(?=$|\/)/, HOME)
);
const TOKEN = crypto.randomBytes(32).toString("hex"); // 64 hex chars
const LOG_FILE = path.join(PROJECT_ROOT, "setup-agent.log");
const TAILSCALE_BIN = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";
const UTF8_ENV = {
  ...process.env,
  LANG: "en_US.UTF-8",
  LC_ALL: "en_US.UTF-8",
  PATH: [path.join(HOME, ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH || "/usr/bin:/bin"].join(":"),
};
// Resolve symlinks on the deepest existing ancestor (so /tmp -> /private/tmp and a
// symlink inside the sandbox cannot point out of it), keeping any not-yet-existing tail.
function realish(abs) {
  let probe = abs;
  const missing = [];
  while (!fs.existsSync(probe)) {
    missing.unshift(path.basename(probe));
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  return path.join(fs.realpathSync(probe), ...missing);
}
const SANDBOX_ROOTS = () => [...new Set([PROJECT_ROOT, "/tmp", "/private/tmp"].map(realish))];

// ------------------------------------------------------------ refusals ------
export class Refusal extends Error {
  constructor(msg) {
    super(msg);
    this.name = "Refusal";
  }
}

// Any command or path that mentions one of these is refused outright.
const FORBIDDEN_PATH_PATTERNS = [
  { re: /\.ssh(?=$|[\/\s"'`;&|)])/i, why: "~/.ssh (SSH keys)" },
  { re: /\.claude\.json/i, why: "~/.claude.json (Claude Code credentials/config)" },
  { re: /\.claude(?=$|[\/\s"'`;&|)])/i, why: "~/.claude/ (Claude Code settings, sessions)" },
  { re: /keychain/i, why: "Keychains" },
  { re: /\bCookies\b/, why: "browser cookies" },
  // "Application Support/Claude", "Application\ Support/Claude", "'Application Support'/Claude", "Library/.../Claude" all count.
  { re: /Application[\\\s"']*Support["'\\\s]*\/["'\\\s]*Claude(?=$|[\/\s"'`;&|)*?])/i, why: "Library/Application Support/Claude (Claude Desktop data)" },
  { re: /Library[\s\S]*?Claude(?=$|[\/\s"'`;&|)*?])/, why: "a Claude folder under ~/Library" },
  { re: /Library(?:[^\s;&|]|\\ )*[*?[]/, why: "a wildcard path under ~/Library" },
  { re: /\.gnupg|\.netrc|\.git-credentials|\.npmrc|\.config\/gh(?=$|[\/\s"'`;&|)])|\.aws(?=$|[\/\s"'`;&|)])|TCC\.db/i, why: "other credential stores" },
];
const FORBIDDEN_COMMAND_PATTERNS = [
  { re: /(^|[\s;&|(`])sudo(?=$|[\s;&|)])/, why: "sudo" },
  { re: /(^|[\s;&|(`])doas(?=$|[\s;&|)])/, why: "doas" },
  { re: /(^|[;&|(`]\s*|^\s*)su(?=\s|$)/, why: "su" },
  { re: /(^|[\s;&|(`])security(?=$|[\s;&|)])/, why: "the `security` keychain tool" },
  { re: /(^|[\s;&|(`])tccutil(?=$|[\s;&|)])/, why: "tccutil (privacy permissions)" },
];
const FORBIDDEN_CWD_PATTERNS = [{ re: /(^|\/)Library(\/|$)/, why: "~/Library (nothing in the study system lives there)" }];

export function checkForbidden(text, kind) {
  for (const { re, why } of FORBIDDEN_PATH_PATTERNS) {
    if (re.test(text)) throw new Refusal(`Refused: ${kind} references ${why}. This agent never touches credential paths.`);
  }
}

// Recursive `rm` may only target paths strictly inside PROJECT_ROOT or /tmp, and
// only literal ones (no $VAR, no command substitution). Everything else is refused.
export function checkRecursiveRm(command, cwd = PROJECT_ROOT) {
  // A `cd`/`pushd` earlier in the command would make relative targets unresolvable here.
  const changesDir = /(^|[\s;&|(`])(cd|pushd)(?=\s|$|[;&|)])/.test(command);
  for (const segment of command.split(/\|\||&&|[;|&\n]/)) {
    const toks = segment.trim().split(/\s+/).filter(Boolean);
    const i = toks.findIndex((t) => /^(\/bin\/)?rm$/.test(t.replace(/^['"]|['"]$/g, "")));
    if (i < 0) continue;
    const args = toks.slice(i + 1);
    const recursive = args.some((a) => a === "--recursive" || a === "-R" || (/^-[a-zA-Z]+$/.test(a) && /[rR]/.test(a)));
    if (!recursive) continue;
    for (const raw of args.filter((a) => !a.startsWith("-"))) {
      const t = raw.replace(/^['"]|['"]$/g, "");
      if (/[$`]/.test(t)) throw new Refusal(`Refused: recursive rm with a non-literal target (${raw}). Use a literal path inside PROJECT_ROOT or /tmp.`);
      const expanded = t.replace(/^~(?=$|\/)/, HOME);
      if (changesDir && !path.isAbsolute(expanded)) throw new Refusal(`Refused: recursive rm with a relative target (${raw}) after a cd. Use an absolute path inside PROJECT_ROOT or /tmp.`);
      const abs = path.resolve(cwd, expanded);
      const prefix = realish(abs.replace(/[*?[].*$/, "")); // path before any glob, symlinks resolved
      const inside = SANDBOX_ROOTS().some((r) => prefix.startsWith(r + path.sep));
      if (!inside) throw new Refusal(`Refused: recursive rm outside PROJECT_ROOT (${PROJECT_ROOT}) and /tmp: ${raw} -> ${abs}`);
    }
  }
}

export function checkCommand(command, cwd = PROJECT_ROOT) {
  for (const { re, why } of FORBIDDEN_COMMAND_PATTERNS) {
    if (re.test(command)) throw new Refusal(`Refused: command uses ${why}. This agent never escalates privileges or reads secrets.`);
  }
  checkForbidden(command, "command");
  checkRecursiveRm(command, cwd);
}

// cwd for `run` / `claude_run`: expanded, must exist, must not be under ~/Library.
export function resolveCwd(cwd) {
  if (!cwd) return PROJECT_ROOT;
  checkForbidden(cwd, "cwd");
  const dir = path.resolve(PROJECT_ROOT, cwd.replace(/^~(?=$|\/)/, HOME));
  for (const { re, why } of FORBIDDEN_CWD_PATTERNS) {
    if (re.test(dir)) throw new Refusal(`Refused: cwd is under ${why}.`);
  }
  if (!fs.existsSync(dir)) throw new Error(`cwd does not exist: ${dir}`);
  return dir;
}

export function sandboxedPath(p) {
  if (typeof p !== "string" || !p.trim()) throw new Refusal("Refused: empty path.");
  const expanded = p.replace(/^~(?=$|\/)/, HOME);
  const abs = path.resolve(PROJECT_ROOT, expanded);
  const real = realish(abs);
  const inside = SANDBOX_ROOTS().some((r) => real === r || real.startsWith(r + path.sep));
  if (!inside) throw new Refusal(`Refused: ${p} is outside PROJECT_ROOT (${PROJECT_ROOT}) and /tmp.`);
  checkForbidden(real, "path");
  return real;
}

// ------------------------------------------------------------- logging ------
function trunc(v, n = 300) {
  if (typeof v === "string") return v.length > n ? v.slice(0, n) + `… [${v.length} chars]` : v;
  if (Array.isArray(v)) return v.map((x) => trunc(x, n));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trunc(x, n)]));
  return v;
}
function log(event, tool, detail) {
  const line = `[${new Date().toISOString()}] ${event.padEnd(7)} ${tool} ${JSON.stringify(trunc(detail))}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    /* logging must never break a call */
  }
}

// ------------------------------------------------------------- helpers ------
async function sh(file, args, opts = {}) {
  const { stdout, stderr } = await execFileP(file, args, {
    env: UTF8_ENV,
    maxBuffer: 64 * 1024 * 1024,
    timeout: opts.timeout ?? 60_000,
    cwd: opts.cwd,
  });
  return { stdout, stderr };
}
// Turn macOS permission failures into plain instructions for the classmate.
function explainMacError(e) {
  const msg = String(e?.stderr || e?.message || e);
  if (/-1743|not authorized to send Apple events/i.test(msg)) {
    return new Error("Automation is not granted: Terminal may not control System Events. Classmate: System Settings > Privacy & Security > Automation > Terminal > System Events, then retry.");
  }
  if (/assistive access|-1719|-25211|not allowed to send keystrokes/i.test(msg)) {
    return new Error("Accessibility is not granted to Terminal. Classmate: System Settings > Privacy & Security > Accessibility > enable Terminal, then restart the agent.");
  }
  if (/could not create image/i.test(msg)) {
    return new Error("Screen Recording is not granted to Terminal. Classmate: System Settings > Privacy & Security > Screen & System Audio Recording > enable Terminal, then restart the agent.");
  }
  if (/Can't get window|Invalid index/i.test(msg)) {
    return new Error("That app has no window at that index (is it open and not minimized?). Call list_windows.");
  }
  if (/Can't get process|Can't get application process/i.test(msg)) {
    return new Error("No running process by that name. Call list_windows for the exact names.");
  }
  return e;
}
async function jxa(script, args = []) {
  try {
    const { stdout } = await sh("/usr/bin/osascript", ["-l", "JavaScript", "-e", script, ...args.map(String)], { timeout: 120_000 });
    return stdout.trim();
  } catch (e) {
    throw explainMacError(e);
  }
}
async function applescript(script, args = []) {
  try {
    const { stdout } = await sh("/usr/bin/osascript", ["-e", script, ...args.map(String)], { timeout: 60_000 });
    return stdout.trim();
  } catch (e) {
    throw explainMacError(e);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (s) => ({ content: [{ type: "text", text: typeof s === "string" ? s : JSON.stringify(s, null, 2) }] });

async function tailscaleIPv4() {
  const candidates = [TAILSCALE_BIN, "/usr/local/bin/tailscale", "/opt/homebrew/bin/tailscale"];
  for (const bin of candidates) {
    if (!fs.existsSync(bin)) continue;
    try {
      const { stdout } = await sh(bin, ["ip", "-4"], { timeout: 10_000 });
      const ip = stdout.trim().split(/\s+/)[0];
      if (isCgnat(ip)) return ip;
    } catch {
      /* try next */
    }
  }
  return null;
}
function isCgnat(ip) {
  // Tailscale hands out 100.64.0.0/10
  const m = /^100\.(\d+)\.\d+\.\d+$/.exec(ip || "");
  return !!m && Number(m[1]) >= 64 && Number(m[1]) <= 127;
}
async function screenRecordingGranted() {
  // On current macOS, screencapture fails with "could not create image" without Screen Recording.
  const file = path.join(os.tmpdir(), `setup-agent-probe-${process.pid}.png`);
  try {
    await sh("/usr/sbin/screencapture", ["-x", "-t", "png", "-R", "0,0,2,2", file], { timeout: 10_000 });
    return true;
  } catch (e) {
    return /could not create image/i.test(String(e.stderr || e.message)) ? false : `unknown: ${String(e.message).split("\n")[0]}`;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

const KEY_CODES = {
  return: 36, enter: 76, tab: 48, space: 49, delete: 51, backspace: 51, forwarddelete: 117,
  esc: 53, escape: 53, left: 123, right: 124, down: 125, up: 126,
  home: 115, end: 119, pageup: 116, pagedown: 121,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
};
const MODS = { cmd: "command down", command: "command down", shift: "shift down", alt: "option down", opt: "option down", option: "option down", ctrl: "control down", control: "control down" };

const AS_KEY = `
on run argv
  set k to item 1 of argv
  set mods to {}
  repeat with i from 2 to count of argv
    set m to item i of argv
    if m is "command down" then set end of mods to command down
    if m is "shift down" then set end of mods to shift down
    if m is "option down" then set end of mods to option down
    if m is "control down" then set end of mods to control down
  end repeat
  tell application "System Events"
    if k starts with "code:" then
      set c to (text 6 thru -1 of k) as integer
      if (count of mods) is 0 then
        key code c
      else
        key code c using mods
      end if
    else
      if (count of mods) is 0 then
        keystroke k
      else
        keystroke k using mods
      end if
    end if
  end tell
end run`;

const AS_CLICK = `
on run argv
  set x to (item 1 of argv) as integer
  set y to (item 2 of argv) as integer
  set n to (item 3 of argv) as integer
  tell application "System Events"
    repeat n times
      click at {x, y}
      delay 0.08
    end repeat
  end tell
end run`;

const JXA_LIST_WINDOWS = `
function run() {
  const se = Application('System Events');
  const out = [];
  for (const p of se.processes.whose({visible: true})()) {
    let wins = [];
    try {
      wins = p.windows().map(w => {
        let title = null, pos = null, size = null;
        try { title = w.name(); } catch (e) {}
        try { pos = w.position(); } catch (e) {}
        try { size = w.size(); } catch (e) {}
        return { title, x: pos ? pos[0] : null, y: pos ? pos[1] : null, w: size ? size[0] : null, h: size ? size[1] : null };
      });
    } catch (e) {}
    let frontmost = false; try { frontmost = p.frontmost(); } catch (e) {}
    out.push({ app: p.name(), frontmost, windows: wins });
  }
  return JSON.stringify(out);
}`;

const JXA_WINDOW_BOUNDS = `
function run(argv) {
  const [app, titleContains, idxStr] = argv;
  const se = Application('System Events');
  const proc = se.processes.byName(app);
  const wins = proc.windows();
  let win = null;
  if (titleContains) {
    win = wins.find(w => { try { return (w.name() || '').toLowerCase().includes(titleContains.toLowerCase()); } catch (e) { return false; } });
  } else {
    win = wins[parseInt(idxStr || '0', 10)] || null;
  }
  if (!win) return JSON.stringify({ error: 'no matching window for ' + app });
  const pos = win.position(), size = win.size();
  let title = null; try { title = win.name(); } catch (e) {}
  return JSON.stringify({ title, x: pos[0], y: pos[1], w: size[0], h: size[1] });
}`;

const JXA_AX_FIND = `
function run(argv) {
  const [app, role, needleRaw, maxStr, idxStr] = argv;
  const needle = (needleRaw || '').toLowerCase();
  const max = parseInt(maxStr, 10) || 200;
  const se = Application('System Events');
  const proc = se.processes.byName(app);
  const win = proc.windows[parseInt(idxStr || '0', 10)];
  const elems = win.entireContents();
  const out = [];
  for (const el of elems) {
    let r = null, n = null, d = null, v = null, pos = null, size = null;
    try { r = el.role(); } catch (e) {}
    if (role && r !== role) continue;
    try { n = el.name(); } catch (e) {}
    try { d = el.description(); } catch (e) {}
    if (needle) {
      const hay = ((n || '') + ' ' + (d || '')).toLowerCase();
      if (!hay.includes(needle)) continue;
    }
    try { v = el.value(); } catch (e) {}
    if (!(typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) v = null;
    if (typeof v === 'string' && v.length > 200) v = v.slice(0, 200) + '…';
    try { pos = el.position(); } catch (e) {}
    try { size = el.size(); } catch (e) {}
    out.push({ role: r, name: n, description: d, value: v,
      x: pos ? pos[0] : null, y: pos ? pos[1] : null, w: size ? size[0] : null, h: size ? size[1] : null });
    if (out.length >= max) break;
  }
  return JSON.stringify({ scanned: elems.length, returned: out.length, elements: out });
}`;

const JXA_AX_CLICK = `
function run(argv) {
  const [app, role, name, idxStr] = argv;
  const se = Application('System Events');
  const proc = se.processes.byName(app);
  const win = proc.windows[parseInt(idxStr || '0', 10)];
  const elems = win.entireContents();
  let exact = null, partial = null;
  for (const el of elems) {
    let r = null, n = null, d = null;
    try { r = el.role(); } catch (e) { continue; }
    if (r !== role) continue;
    try { n = el.name(); } catch (e) {}
    try { d = el.description(); } catch (e) {}
    if (n === name || d === name) { exact = el; break; }
    if (!partial && ((n || '').includes(name) || (d || '').includes(name))) partial = el;
  }
  const t = exact || partial;
  if (!t) return JSON.stringify({ ok: false, error: 'no ' + role + ' named "' + name + '" in the front window of ' + app });
  let how = 'AXPress';
  try { t.actions.byName('AXPress').perform(); } catch (e) { how = 'click'; t.click(); }
  let n = null; try { n = t.name(); } catch (e) {}
  return JSON.stringify({ ok: true, matched: exact ? 'exact' : 'partial', name: n, via: how });
}`;

const JXA_AX_TRUSTED = `
ObjC.import('ApplicationServices');
function run() {
  try { return $.AXIsProcessTrusted() ? 'true' : 'false'; } catch (e) { return 'unknown: ' + e; }
}`;

const JXA_SCROLL = `
ObjC.import('CoreGraphics');
function run(argv) {
  const [xs, ys, dxs, dys] = argv;
  const x = Number(xs), y = Number(ys), dx = Number(dxs), dy = Number(dys);
  if (!Number.isNaN(x) && !Number.isNaN(y)) {
    $.CGWarpMouseCursorPosition({ x: x, y: y });
    delay(0.05);
  }
  const ev = $.CGEventCreateScrollWheelEvent2($(), $.kCGScrollEventUnitLine, 2, dy, dx, 0);
  $.CGEventPost($.kCGHIDEventTap, ev);
  return 'ok';
}`;

function findClaudeBinary() {
  const candidates = [path.join(HOME, ".local/bin/claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude"];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  for (const dir of (process.env.PATH || "").split(":")) {
    const c = path.join(dir, "claude");
    if (dir && fs.existsSync(c)) return c;
  }
  return null;
}

async function runProcess(file, args, { cwd, timeoutMs, maxOut = 50_000 }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(file, args, { cwd, env: UTF8_ENV, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "", killed = false;
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const cut = (s) => (s.length > maxOut ? s.slice(0, maxOut / 2) + `\n… [${s.length - maxOut} chars omitted] …\n` + s.slice(-maxOut / 2) : s);
      resolve({ exit_code: code, signal, timed_out: killed, seconds: Math.round((Date.now() - started) / 100) / 10, stdout: cut(out), stderr: cut(err) });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ exit_code: null, error: String(e), stdout: out, stderr: err });
    });
  });
}

async function pbcopy(s) {
  await new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/pbcopy", [], { env: UTF8_ENV, stdio: ["pipe", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited ${code}: ${err}`))));
    child.on("error", reject);
    child.stdin.end(s, "utf8");
  });
}

// --------------------------------------------------------------- tools ------
function buildServer() {
  const server = new McpServer({ name: "law-school-setup-agent", version: "0.1.0" });

  // Wraps a handler so every call is logged and refusals/errors come back as tool errors.
  const tool = (name, description, shape, handler) => {
    server.registerTool(name, { description, inputSchema: shape }, async (args) => {
      log("CALL", name, args ?? {});
      const t0 = Date.now();
      try {
        const result = await handler(args ?? {});
        log("OK", name, { ms: Date.now() - t0 });
        return result;
      } catch (e) {
        const kind = e instanceof Refusal ? "REFUSED" : "ERROR";
        log(kind, name, { ms: Date.now() - t0, error: String(e.message || e) });
        return { isError: true, content: [{ type: "text", text: `${kind}: ${e.message || e}` }] };
      }
    });
  };

  tool("agent_status", "Who and where this agent is: hostname, user, macOS version, Tailscale IP, project root, and whether Terminal has Accessibility and Screen Recording permission.", {}, async () => {
    const [sw, ip, ax, sr] = await Promise.all([
      sh("/usr/bin/sw_vers", ["-productVersion"]).then((r) => r.stdout.trim()).catch(() => null),
      tailscaleIPv4(),
      jxa(JXA_AX_TRUSTED).then((s) => (s === "true" ? true : s === "false" ? false : s)).catch((e) => `unknown: ${e.message}`),
      screenRecordingGranted(),
    ]);
    return text({
      hostname: os.hostname(),
      user: os.userInfo().username,
      macos: sw,
      node: process.version,
      tailscale_ip: ip,
      project_root: PROJECT_ROOT,
      log_file: LOG_FILE,
      claude_cli: findClaudeBinary(),
      permissions: { accessibility: ax, screen_recording: sr },
      note: "If accessibility/screen_recording is false, the classmate grants it to Terminal in System Settings > Privacy & Security, then restarts the agent.",
    });
  });

  tool("list_windows", "List visible apps and their windows (title and bounds in screen points).", {}, async () => text(JSON.parse(await jxa(JXA_LIST_WINDOWS))));

  tool(
    "screenshot",
    "Take a screenshot as a PNG image. Choose an app's front window, a window by title, an explicit region, or the whole screen. Coordinates in the result are screen points; `scale` (default 0.5, i.e. Retina->points) shrinks the image.",
    {
      app: z.string().optional().describe("Process name, e.g. 'Claude', 'Finder'"),
      window_title: z.string().optional().describe("Substring of the window title to capture (used with app)"),
      region: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
      scale: z.number().min(0.1).max(1).optional(),
    },
    async ({ app, window_title, region, scale = 0.5 }) => {
      let rect = region || null;
      if (!rect && app) {
        const b = JSON.parse(await jxa(JXA_WINDOW_BOUNDS, [app, window_title || "", "0"]));
        if (b.error) throw new Error(b.error);
        rect = { x: b.x, y: b.y, w: b.w, h: b.h };
      }
      const file = path.join(os.tmpdir(), `setup-agent-${process.pid}-${Date.now()}.png`);
      const args = ["-x", "-t", "png"];
      if (rect) args.push("-R", `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.w)},${Math.round(rect.h)}`);
      args.push(file);
      try {
        await sh("/usr/sbin/screencapture", args);
      } catch (e) {
        throw explainMacError(e);
      }
      const { stdout: wOut } = await sh("/usr/bin/sips", ["-g", "pixelWidth", file]);
      const pixelWidth = Number(/pixelWidth:\s*(\d+)/.exec(wOut)?.[1] || 0);
      const targetWidth = Math.max(1, Math.round(pixelWidth * scale));
      if (pixelWidth && targetWidth < pixelWidth) await sh("/usr/bin/sips", ["--resampleWidth", String(targetWidth), file]);
      const data = fs.readFileSync(file).toString("base64");
      fs.rmSync(file, { force: true });
      const pointsPerImagePixel = rect ? rect.w / targetWidth : null;
      return {
        content: [
          { type: "text", text: JSON.stringify({ region: rect || "full screen", image_width_px: targetWidth, points_per_image_pixel: pointsPerImagePixel, origin: rect ? { x: rect.x, y: rect.y } : { x: 0, y: 0 } }) },
          { type: "image", data, mimeType: "image/png" },
        ],
      };
    }
  );

  tool(
    "ax_find",
    "Walk the accessibility tree of an app's front window and return matching elements (role, name, description, value, position, size). Capped at `max` (default 200).",
    {
      app: z.string().describe("Process name, e.g. 'Claude'"),
      role: z.string().optional().describe("AX role filter, e.g. 'AXButton', 'AXTextField', 'AXStaticText'"),
      name_contains: z.string().optional().describe("Case-insensitive substring of name or description"),
      max: z.number().int().min(1).max(500).optional(),
      window_index: z.number().int().min(0).optional(),
    },
    async ({ app, role, name_contains, max = 200, window_index = 0 }) => text(JSON.parse(await jxa(JXA_AX_FIND, [app, role || "", name_contains || "", max, window_index])))
  );

  tool(
    "ax_click",
    "Press an accessibility element in an app's front window by role and name (exact match first, then substring). Uses AXPress, falling back to a click.",
    { app: z.string(), role: z.string().describe("e.g. 'AXButton'"), name: z.string(), window_index: z.number().int().min(0).optional() },
    async ({ app, role, name, window_index = 0 }) => {
      const r = JSON.parse(await jxa(JXA_AX_CLICK, [app, role, name, window_index]));
      if (!r.ok) throw new Error(r.error);
      return text(r);
    }
  );

  tool("click", "Click at screen coordinates (points). count=2 double-clicks.", { x: z.number(), y: z.number(), count: z.number().int().min(1).max(3).optional() }, async ({ x, y, count = 1 }) => {
    await applescript(AS_CLICK, [Math.round(x), Math.round(y), count]);
    return text({ ok: true, x, y, count });
  });

  tool(
    "type",
    "Type text into the focused field. Plain ASCII is typed keystroke by keystroke; anything else (em-dashes, accents, emoji) goes through the clipboard with a UTF-8 locale and cmd+v, then the previous clipboard is restored.",
    { text: z.string().min(1).max(20_000) },
    async ({ text: s }) => {
      const asciiOnly = /^[\x20-\x7e\n\t]*$/.test(s);
      if (asciiOnly && s.length <= 2000) {
        const lines = s.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]) await applescript(AS_KEY, [lines[i]]);
          if (i < lines.length - 1) await applescript(AS_KEY, ["code:36"]);
        }
        return text({ ok: true, via: "keystroke", chars: s.length });
      }
      let previous = null;
      try {
        previous = (await sh("/usr/bin/pbpaste", [])).stdout;
      } catch {
        /* clipboard may be empty or non-text */
      }
      await pbcopy(s);
      await sleep(80);
      await applescript(AS_KEY, ["v", "command down"]);
      await sleep(400);
      if (previous !== null) await pbcopy(previous);
      return text({ ok: true, via: "clipboard+cmd+v", chars: s.length });
    }
  );

  tool(
    "key",
    "Press a key or key combo, e.g. 'cmd+shift+g', 'return', 'tab', 'esc', 'cmd+a', 'down'. Modifiers: cmd, shift, alt/opt, ctrl. Specials: return, enter, tab, space, delete, forwarddelete, esc, left/right/up/down, home, end, pageup, pagedown, f1..f12.",
    { combo: z.string().min(1).max(40), repeat: z.number().int().min(1).max(50).optional() },
    async ({ combo, repeat = 1 }) => {
      const parts = combo.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
      const keyName = parts.pop();
      const mods = parts.map((m) => {
        if (!MODS[m]) throw new Error(`unknown modifier '${m}'`);
        return MODS[m];
      });
      let keyArg;
      if (KEY_CODES[keyName] !== undefined) keyArg = `code:${KEY_CODES[keyName]}`;
      else if (keyName.length === 1) keyArg = keyName;
      else throw new Error(`unknown key '${keyName}'`);
      for (let i = 0; i < repeat; i++) {
        await applescript(AS_KEY, [keyArg, ...mods]);
        if (repeat > 1) await sleep(40);
      }
      return text({ ok: true, combo, repeat });
    }
  );

  tool(
    "scroll",
    "Scroll the mouse wheel at a screen point. Positive `lines` scrolls down (content moves up), negative scrolls up. `horizontal` scrolls sideways.",
    { x: z.number().optional(), y: z.number().optional(), lines: z.number().int().min(-100).max(100).optional(), horizontal: z.number().int().min(-100).max(100).optional() },
    async ({ x, y, lines = 5, horizontal = 0 }) => {
      await jxa(JXA_SCROLL, [x ?? "nan", y ?? "nan", -horizontal, -lines]);
      return text({ ok: true, x, y, lines, horizontal });
    }
  );

  tool("clipboard_set", "Put text on the clipboard (UTF-8 safe).", { text: z.string().max(200_000) }, async ({ text: s }) => {
    await pbcopy(s);
    return text({ ok: true, chars: s.length });
  });
  tool("clipboard_get", "Read the clipboard as text (UTF-8 safe).", {}, async () => text((await sh("/usr/bin/pbpaste", [])).stdout));

  tool(
    "run",
    `Run a shell command (zsh) on this Mac, default cwd PROJECT_ROOT (${PROJECT_ROOT}). Refuses sudo/su/doas, the security and tccutil tools, any recursive rm whose target is not strictly inside PROJECT_ROOT or /tmp, and any command that mentions ~/.ssh, ~/.claude.json, ~/.claude/, Keychains, Cookies, or a Claude folder or wildcard under ~/Library. Output is truncated to ~50k chars.`,
    {
      command: z.string().min(1).max(20_000),
      cwd: z.string().optional().describe("Working directory (must exist, not under ~/Library)"),
      timeout: z.number().int().min(1).max(600).optional().describe("Seconds, default 60"),
    },
    async ({ command, cwd, timeout = 60 }) => {
      const dir = resolveCwd(cwd);
      checkCommand(command, dir);
      return text(await runProcess("/bin/zsh", ["-c", command], { cwd: dir, timeoutMs: timeout * 1000 }));
    }
  );

  tool("read_file", `Read a UTF-8 text file inside PROJECT_ROOT (${PROJECT_ROOT}) or /tmp. Relative paths resolve against PROJECT_ROOT. Capped at 200 KB.`, { path: z.string() }, async ({ path: p }) => {
    const real = sandboxedPath(p);
    const st = fs.statSync(real);
    if (!st.isFile()) throw new Error(`not a file: ${real}`);
    const buf = fs.readFileSync(real);
    const cap = 200 * 1024;
    return text(buf.length > cap ? buf.subarray(0, cap).toString("utf8") + `\n… [truncated, ${buf.length} bytes total]` : buf.toString("utf8"));
  });

  tool(
    "write_file",
    `Write (or append to) a UTF-8 text file inside PROJECT_ROOT (${PROJECT_ROOT}) or /tmp, creating parent folders. Relative paths resolve against PROJECT_ROOT.`,
    { path: z.string(), content: z.string().max(5_000_000), append: z.boolean().optional() },
    async ({ path: p, content, append = false }) => {
      const real = sandboxedPath(p);
      fs.mkdirSync(path.dirname(real), { recursive: true });
      if (append) fs.appendFileSync(real, content);
      else fs.writeFileSync(real, content);
      return text({ ok: true, path: real, bytes: Buffer.byteLength(content), append });
    }
  );

  tool("list_dir", `List a folder inside PROJECT_ROOT (${PROJECT_ROOT}) or /tmp.`, { path: z.string().optional() }, async ({ path: p = "." }) => {
    const real = sandboxedPath(p);
    const entries = fs.readdirSync(real, { withFileTypes: true }).map((d) => {
      let size = null;
      try {
        size = d.isFile() ? fs.statSync(path.join(real, d.name)).size : null;
      } catch {
        /* unreadable entry */
      }
      return { name: d.name, type: d.isDirectory() ? "dir" : d.isSymbolicLink() ? "link" : "file", size };
    });
    return text({ path: real, entries });
  });

  tool(
    "claude_run",
    "Run the classmate's OWN Claude Code CLI non-interactively (claude -p ... --output-format text) from this GUI session, so their Keychain login and their connectors/plugins apply. Use for steps that need THEIR account (reading their D2L, their Cowork skills). Default cwd PROJECT_ROOT.",
    {
      prompt: z.string().min(1).max(100_000),
      cwd: z.string().optional(),
      max_turns: z.number().int().min(1).max(200).optional(),
      allowed_tools: z.array(z.string()).optional().describe("Passed as --allowedTools, e.g. ['Read','Edit','Write','Bash(git *)']"),
      timeout: z.number().int().min(10).max(3600).optional().describe("Seconds, default 900"),
    },
    async ({ prompt, cwd, max_turns, allowed_tools, timeout = 900 }) => {
      const bin = findClaudeBinary();
      if (!bin) throw new Error("Claude Code CLI not found (looked in ~/.local/bin, /opt/homebrew/bin, /usr/local/bin, PATH).");
      const dir = resolveCwd(cwd);
      const args = ["-p", prompt, "--output-format", "text"];
      if (max_turns) args.push("--max-turns", String(max_turns));
      if (allowed_tools?.length) args.push("--allowedTools", allowed_tools.join(","));
      return text({ claude: bin, cwd: dir, ...(await runProcess(bin, args, { cwd: dir, timeoutMs: timeout * 1000 })) });
    }
  );

  return server;
}

// ---------------------------------------------------------------- http ------
function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function tokenMatches(candidate) {
  if (typeof candidate !== "string" || candidate.length !== TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(TOKEN));
}

async function handle(req, res) {
  const remote = req.socket.remoteAddress || "";
  if (!isCgnat(remote.replace(/^::ffff:/, ""))) {
    log("DENY", "http", { remote, reason: "not a Tailscale address" });
    res.writeHead(403).end();
    return;
  }
  const m = /^\/([0-9a-f]{64})\/mcp\/?$/.exec(req.url?.split("?")[0] || "");
  if (!m || !tokenMatches(m[1])) {
    log("DENY", "http", { remote, reason: "bad path/token", path: (req.url || "").slice(0, 24) + "…" });
    res.writeHead(404).end();
    return;
  }
  if (!["POST", "GET", "DELETE"].includes(req.method || "")) {
    res.writeHead(405).end();
    return;
  }
  let body;
  if (req.method === "POST") {
    try {
      const raw = await readBody(req);
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
      return;
    }
  }
  // Stateless: a fresh server + transport per request, torn down when the response closes.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

async function main() {
  fs.mkdirSync(PROJECT_ROOT, { recursive: true });
  const ip = await tailscaleIPv4();
  if (!ip) {
    console.error("\n  ✗ No Tailscale IPv4 address found. This agent only ever listens on Tailscale.");
    console.error("    Install Tailscale from https://tailscale.com/download, sign in, make sure it is connected,");
    console.error("    then run start-agent.command again. (It will never bind to 0.0.0.0.)\n");
    process.exit(2);
  }
  const httpServer = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      log("ERROR", "http", { error: String(e) });
      if (!res.headersSent) res.writeHead(500).end();
    });
  });
  httpServer.on("error", (e) => {
    console.error(`\n  ✗ Could not listen on ${ip}:${PORT}: ${e.message}\n`);
    process.exit(1);
  });
  httpServer.listen(PORT, ip, () => {
    const url = `http://${ip}:${PORT}/${TOKEN}/mcp`;
    console.log("\n  law-school setup agent is running (close this Terminal window to stop it)\n");
    console.log(`  Listening ONLY on Tailscale: ${ip}:${PORT}`);
    console.log(`  Project root:               ${PROJECT_ROOT}`);
    console.log(`  Action log:                 ${LOG_FILE}`);
    console.log(`\n  Send this URL to the person helping you (it changes every start):\n\n    ${url}\n`);
    console.log(`  They add it with:\n    claude mcp add --transport http ${os.userInfo().username}-mac ${url}\n`);
    console.log("  Every action they take shows up below, and in the log file.\n");
    log("START", "agent", { ip, port: PORT, project_root: PROJECT_ROOT, node: process.version });
  });
  const stop = (sig) => {
    log("STOP", "agent", { signal: sig });
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGHUP", () => stop("SIGHUP"));
}

// Only start the server when run directly; `test-refusals.mjs` imports the checks without starting anything.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
