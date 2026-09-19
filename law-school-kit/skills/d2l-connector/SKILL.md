---
name: d2l-connector
description: Build, deploy, and register a personal read-only D2L Brightspace MCP connector (six tools) and install the /d2l-updates routine. Use when a student asks to set up D2L access, the D2L connector, or "check D2L for updates" automation.
---
# D2L connector build brief

Work through the sections below in order, confirming with the user after each. The user fills Section 0; if it is empty, ask for the D2L base URL and each course tag, id, and title. Never handle passwords or cookies yourself: they go into environment variables the user sets.

## Instructions to Claude Code

You are building a personal, read-only D2L Brightspace connector for one
law student and a weekly "what changed on D2L" routine. Work through the
sections in order. Confirm with the user after each section. Where a step
needs the user to sign in, approve something in a browser, or paste a
value, stop and hand it to them. Never ask for, echo, or commit passwords
or cookies; they go in environment variables only.

Design constraints, non-negotiable:
- Read-only against D2L. No tool may POST, PUT, or DELETE to D2L.
- One student per deployment. Credentials live in env vars on the server.
- The MCP endpoint is protected only by a long random path segment.
  Generate it; never reuse one from somewhere else.

### Section 0 — what the user provides (fill this in before starting)

```
SCHOOL_D2L_BASE_URL = https://d2l.mu.edu        # no trailing slash
COURSES = {
  # KEY: short all-caps tag you will type in prompts. ID: the number in
  # https://d2l.mu.edu/d2l/le/content/<ID>/Home
  "EXAMPLE": { "id": 000000, "name": "Course Title (LAW 0000)" }
}
HOSTING = railway        # railway | fly | render | local-only
D2L_LOGIN_STYLE = unknown  # unknown | form | cookie   (leave unknown; Section 2 decides)
```

If the user has not filled this in, ask for the D2L base URL and, for
each course, the tag, the course id from the URL, and the title. Do not
guess course ids.

### Section 1 — scaffold the server

Create a Node project `d2l-mcp` (TypeScript, ESM) with:
- `@modelcontextprotocol/sdk` (Streamable HTTP server transport)
- `express`
- `cheerio` (HTML topics to plain text)
- `zod`

Layout:
```
d2l-mcp/
  src/index.ts        express app, mounts MCP at /<MCP_PATH_SECRET>/mcp, 404 everywhere else
  src/d2l.ts          session + fetch wrapper for the Brightspace REST API
  src/tools.ts        the six tools below
  src/courses.ts      parses D2L_COURSES env JSON -> { key: { id, name } }, exports the key enum
  .env.example        every variable, no values
  README.md           how to run, deploy, rotate the secret, refresh login
  Dockerfile          node:20-slim, `npm ci && npm run build`, `node dist/index.js`, PORT from env
```

Environment variables (document all in `.env.example`):
```
D2L_BASE_URL            e.g. https://d2l.mu.edu
D2L_COURSES             JSON map, e.g. {"TE":{"id":654862,"name":"Trusts & Estates (LAW 7332)"}}
MCP_PATH_SECRET         64 hex chars; generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DOWNLOAD_DIR            default /tmp/d2l-downloads
D2L_USERNAME            only for form login (Section 2)
D2L_PASSWORD            only for form login
D2L_COOKIE              only for cookie login: "d2lSessionVal=...; d2lSecureSessionVal=..."
PORT                    provided by the host
```

### Section 2 — the D2L session (`src/d2l.ts`)

Brightspace exposes a REST API under `/d2l/api/`. Use these versions and
endpoints (they are stable across Brightspace releases; if one returns
404, discover the current versions with `GET /d2l/api/versions/`):

| Purpose | Endpoint |
|---|---|
| who am I (session check) | `GET /d2l/api/lp/1.31/users/whoami` |
| my enrollments | `GET /d2l/api/lp/1.31/enrollments/myenrollments/` |
| content table of contents | `GET /d2l/api/le/1.67/{orgUnitId}/content/toc` |
| topic metadata | `GET /d2l/api/le/1.67/{orgUnitId}/content/topics/{topicId}` |
| topic file | `GET /d2l/api/le/1.67/{orgUnitId}/content/topics/{topicId}/file` |
| announcements | `GET /d2l/api/le/1.67/{orgUnitId}/news/` |
| announcement attachment | `GET /d2l/api/le/1.67/{orgUnitId}/news/{newsItemId}/attachments/{fileId}` |

Authentication is a browser session cookie, not OAuth. Implement two
modes and pick one with the user:

**Mode A, cookie (works everywhere, do this first).** The user signs in
to D2L in a normal browser, opens DevTools > Application > Cookies for
the D2L domain, and copies the values of `d2lSessionVal` and
`d2lSecureSessionVal` into `D2L_COOKIE`. The server sends that cookie
header on every request. On a 401, 403, or a redirect to a login page,
tools return a clear error: "D2L session expired: refresh D2L_COOKIE".
Sessions typically last days to weeks; the README documents the refresh.

**Mode B, form login (only if the school's login is a plain form).** Fetch
the D2L login page; if it is a Brightspace form (`/d2l/lp/auth/login/login.d2l`)
with username/password fields, POST them, capture the two cookies, and
re-login automatically on expiry. If the page redirects to a university
single sign-on (SAML, Microsoft, Shibboleth), do NOT try to script the
SSO; stay on Mode A and tell the user why. Marquette's D2L is expected
to be SSO, so Mode A is the default there.

Wrapper requirements: base URL from env, cookie header, `Accept:
application/json`, follow no redirects (a 302 means the session is dead),
JSON parse with a helpful error on HTML responses, and a binary path for
files (stream to `DOWNLOAD_DIR/<orgUnitId>/<topicId>-<filename>`).

### Section 3 — the six tools (`src/tools.ts`)

Register exactly these. `course` is a `z.enum` of the keys from
`D2L_COURSES` so the model cannot invent one. Descriptions matter; the
model reads them. Use the text given.

1. `d2l_status()` — "Check the D2L session: returns the logged-in user
   and the enrolled course keys/ids this server knows."
   Calls whoami; returns `{ loggedInAs, name, courses }`.

2. `d2l_content_toc({ course })` — "Get a course's Content table of
   contents: modules and topics with TopicId, title, type, and
   last-modified. Use d2l_read_topic to read one."
   Walk the toc recursively; return a flat, indented text tree plus the
   JSON: `{ modules: [{ id, title, topics: [{ id, title, type, lastModified, url }], modules: [...] }] }`.

3. `d2l_read_topic({ course, topic_id })` — "Read a content topic's file.
   HTML/text topics return plain text. Binary files (PDF, DOCX, PPTX) are
   saved to a local file and the path is returned."
   Fetch metadata for the type and filename, then the file. HTML -> text
   with cheerio (keep headings and list structure as line breaks). Link
   topics return the URL. Binary -> save, return `{ path, bytes, contentType }`.

4. `d2l_news({ course })` — "List announcements for a course (id, title,
   posted date, plain-text body). This is where most professors publish
   updates."
   Return newest first, body stripped to text, and each item's
   attachments as `{ file_id, filename, size }`.

5. `d2l_read_attachment({ course, news_id, file_id })` — "Download an
   announcement's attachment (ids from d2l_news) to a local file and
   return the path. Professors who post course materials as announcement
   attachments, rather than Content topics, distribute files this way."

6. `d2l_api_get({ path })` — "Power tool: GET any Brightspace REST path
   (must start with /d2l/api/) using the logged-in session and return the
   JSON. Use for endpoints the other tools don't cover (dropbox folders,
   quizzes, grades, calendar)." Validate `^/d2l/api/`; refuse anything
   else; GET only.

Errors: return them as tool results with `isError: true` and a sentence
the model can act on, never a stack trace.

### Section 4 — run it locally and test

```
npm install && npm run build
MCP_PATH_SECRET=<generated> D2L_BASE_URL=... D2L_COURSES='{...}' D2L_COOKIE='...' PORT=3000 node dist/index.js
```
Verify with an MCP client (`npx @modelcontextprotocol/inspector` pointed
at `http://localhost:3000/<secret>/mcp`): `d2l_status` shows the user and
every course key; `d2l_content_toc` on one course returns modules;
`d2l_news` returns announcements; `GET /` returns 404.

### Section 5 — deploy (Railway default)

1. `railway login`, `railway init` (new project `d2l-mcp`), `railway up`.
2. Set every env var in the Railway service (Variables tab). Paste the
   `D2L_COURSES` JSON from Section 0. Set `PORT` only if Railway does not
   inject it.
3. Generate a public domain (Settings > Networking). The connector URL is
   `https://<domain>/<MCP_PATH_SECRET>/mcp`. Show it to the user once; do
   not write it into any file that gets committed.
4. Confirm with `curl -s -o /dev/null -w "%{http_code}" https://<domain>/`
   (expect 404) and the inspector against the public URL.

Fly, Render, or any Docker host work the same way: build the Dockerfile,
set the env vars, expose the port.

### Section 6 — add it to claude.ai

Tell the user: claude.ai > Settings > Connectors > Add custom connector.
Name: `d2l`. URL: the connector URL from Section 5. No OAuth fields. Save,
then enable the connector in each course Project (Project > tools) and in
Cowork.

Test from a Claude chat: "Run d2l_status, then show me the content tree
for <KEY> and the last three announcements." Every course key should
appear.

### Section 7 — the "D2L updates" routine

Install this as a Cowork scheduled task (Claude Desktop > Cowork >
Scheduled tasks, Monday 6:00 AM, plus "Run now" whenever the user asks
"check D2L for updates"), and also save it as a Claude Code slash command
`/d2l-updates` in `~/.claude/commands/d2l-updates.md` so it can be run from
a terminal. Substitute the user's course keys and their Drive (or local)
notes folder path.

```
---
name: d2l-updates
description: Walk every course's D2L shell, report what is new or revised since the last check, and mirror it into the course's "02 D2L Course Content" folder.
---
Automated run; the user may not be present. Read-only against D2L. Write
only to the notes folders.

COURSES: <KEY1>, <KEY2>, ...
NOTES ROOT: <Google Drive path or local folder>/<Semester>/<KEY>/02 D2L Course Content
STATE FILE: <NOTES ROOT>/../_Semester/d2l-state.json  (per course: topic ids
with lastModified, announcement ids seen, last run timestamp)

For each course, in order:
1. d2l_status once at the start. If a key is missing, report it and go on.
2. d2l_content_toc(course) and d2l_news(course).
3. Compare with the state file: new topics, topics whose lastModified
   moved, new announcement ids. First run ever = everything is new; say so
   and do not flood the summary, just count.
4. For each new or revised item: d2l_read_topic / d2l_read_attachment.
   Save text topics as a document named "D2L — <title>" under the
   professor's own module name; save binaries with their filename; a PDF
   with no text layer gets a one-line pointer note instead. Append new
   announcements verbatim (date, title, body) to "D2L ANNOUNCEMENTS — <KEY>".
5. Append a dated block to "D2L MIRROR LOG — <KEY>": what was found, what
   was filed where, gaps, and what the next pull should check for.
6. Update the state file.

SIGNALS: a revised syllabus, a re-posted assignment listing, an exam
format or date announcement, a schedule change, a new hypo or problem
set, or a conflict between the syllabus and an announcement is a signal,
not housekeeping. Put each one at the top of the summary with the course
key and say which source controls (the newer announcement usually does).
Put every hard deadline found on the calendar (Google Calendar if
connected; otherwise list them under DEADLINES).

SUMMARY: signals first, then one line per course (N new, N revised, N
announcements). If nothing changed anywhere: one line, "D2L: no changes."
```

### Section 8 — hand-off checklist

Confirm each with the user before declaring done:
- [ ] `d2l_status` from claude.ai shows their name and every course key
- [ ] `d2l_read_topic` returns text for an HTML topic and a file path for a PDF
- [ ] `/d2l-updates` run once by hand produced a mirror log block and the state file
- [ ] The README explains how to refresh `D2L_COOKIE` and rotate `MCP_PATH_SECRET`
- [ ] No credentials in git history (`git log -p | grep -i d2lSecureSessionVal` is empty)

Optional next step, same pattern: a Casebook Connect connector that reads
assigned casebook pages by printed page number (tools: status, toc, read
page range, figure, search). Ask the user if they want it after this one
is working.
