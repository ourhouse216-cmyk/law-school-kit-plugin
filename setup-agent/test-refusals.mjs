#!/usr/bin/env node
// Unit test for the refusal rules. Pure function calls: nothing here runs a
// shell, touches the GUI, or starts the server. Run with `npm test`.
//
// NEVER test these rules by sending a destructive command to a live agent.

import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "setup-agent-test-"));
process.env.SETUP_AGENT_PROJECT_ROOT = root;
fs.mkdirSync(path.join(root, "out"), { recursive: true });

const { checkCommand, sandboxedPath, resolveCwd, Refusal } = await import("./server.mjs");
const HOME = os.homedir();

// [command, expectAllowed]
const commands = [
  // recursive rm: only strictly inside PROJECT_ROOT or /tmp, literal targets only
  ["rm -rf ~/", false],
  ["rm -rf ~", false],
  ["rm -rf /", false],
  ["rm -rf /*", false],
  ["rm -rf $HOME", false],
  ['rm -rf "$HOME/x"', false],
  ["rm -rf ~/Desktop", false],
  ["rm -fr /Users/someone", false],
  ["rm -r ~/Library", false],
  ["rm -R ~/Documents/x", false],
  ["rm --recursive ~/x", false],
  [`rm -rf ${root}`, false], // the root itself
  [`rm -rf ${root}/..`, false],
  ["cd .. && rm -rf law-school", false],
  ["echo hi; rm -rf ~/", false],
  ["find . | xargs rm -rf ~/", false],
  ["rm -rf `pwd`", false],
  ["rm -rf junk", true],
  ["mkdir -p junk && rm -rf junk", true],
  [`rm -rf ${root}/out/*`, true],
  ["rm -rf out/*", true],
  ["rm -rf /tmp/setup-agent-scratch", true],
  ["rm foo.txt", true],
  ["rm -f ~/law-school/foo.txt", true], // not recursive: file-level rm is not sandboxed
  // privilege / secrets tools
  ["sudo ls", false],
  ["ls; sudo -s", false],
  ["doas ls", false],
  ["su -", false],
  ["security find-generic-password -s x", false],
  ["tccutil reset All", false],
  ["echo security-camera", true],
  // credential paths
  ["ls ~/.ssh", false],
  ["cat ~/.ssh/id_ed25519", false],
  ["cat ~/.claude.json", false],
  ["cat $HOME/.claude/settings.json", false],
  ["ls ~/.claude", false],
  ["ls .claude-plugin", true],
  ["cat law-school-kit-plugin/.claude-plugin/marketplace.json", true],
  ["ls ~/Library/Keychains", false],
  ["ls ~/Library/Cookies", false],
  ["ls ~/Library/Application\\ Support/Claude", false],
  ["ls ~/Library/'Application Support'/Claude", false],
  ['ls "$HOME/Library/Application Support/Claude/"', false],
  ["ls ~/Library/App*/Cl*", false],
  ["ls ~/Library/Application\\ Support/Claude*", false],
  ["cat ~/.aws/credentials", false],
  ["cat ~/.netrc", false],
  // legitimate work
  ["ls ~/Documents/Claude/Scheduled", true],
  ["git clone https://github.com/ourhouse216-cmyk/law-school-kit-plugin.git", true],
  ["python3 law-school-kit-plugin/law-school-kit/skills/law-school-system/render.py courses.json out", true],
  ["claude plugin install law-school-kit@law-school-kit", true],
  ["mkdir -p ~/Documents/Claude/Scheduled && cp -R out/scheduled-tasks/* ~/Documents/Claude/Scheduled/", true],
];

// [cwd, expectAllowed]
const cwds = [
  [undefined, true],
  [root, true],
  ["out", true],
  ["~/Library/Application Support", false],
  [`${HOME}/Library`, false],
  ["~/.ssh", false],
];

// [path, expectAllowed]
const paths = [
  ["notes/hi.md", true],
  [`${root}/out/x.md`, true],
  ["/tmp/x.txt", true],
  [`${HOME}/.zshrc`, false],
  ["../../../etc/passwd", false],
  ["~/.ssh/config", false],
  ["~/Library/Keychains/login.keychain-db", false],
];

let failures = 0;
function expect(label, fn, allowed) {
  let refused = false, other = null;
  try {
    fn();
  } catch (e) {
    if (e instanceof Refusal) refused = true;
    else other = e;
  }
  const ok = allowed ? !refused && !other : refused;
  if (!ok) {
    failures++;
    console.log(`  FAIL ${label}  (expected ${allowed ? "allowed" : "REFUSED"}, got ${refused ? "REFUSED" : other ? "error: " + other.message : "allowed"})`);
  }
}

for (const [cmd, allowed] of commands) expect(`run  ${JSON.stringify(cmd)}`, () => checkCommand(cmd, root), allowed);
for (const [cwd, allowed] of cwds) expect(`cwd  ${JSON.stringify(cwd)}`, () => resolveCwd(cwd), allowed);
for (const [p, allowed] of paths) expect(`path ${JSON.stringify(p)}`, () => sandboxedPath(p), allowed);

fs.rmSync(root, { recursive: true, force: true });
const total = commands.length + cwds.length + paths.length;
if (failures) {
  console.log(`\n${failures} of ${total} refusal checks FAILED`);
  process.exit(1);
}
console.log(`all ${total} refusal checks passed`);
