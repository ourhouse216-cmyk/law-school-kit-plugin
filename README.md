# law-school-kit (Claude Code plugin)

A law-school study system for Claude: numbered Google Drive folders as
the single source of truth, one Claude Project per course, a read-only
D2L connector, an optional Casebook Connect connector, and Cowork
scheduled tasks that write book notes nightly, mirror D2L weekly, plan
the week on Sunday, and merge class notes into one living outline every
Friday. Built by Jacob Neaves (Marquette Law, class of 2028) for his own
courses; this plugin generalizes it to yours.

## Install

```
/plugin marketplace add ourhouse216-cmyk/law-school-kit-plugin
/plugin install law-school-kit@law-school-kit
```

Then, in an empty folder you will keep for the semester:

```
/law-school-kit:setup
```

The wizard asks about your courses, generates every document, and walks
you through Drive, Projects, the D2L connector, and Cowork one section at
a time. You sign in to everything yourself; the plugin never handles
passwords or cookies.

## Commands

| Command | What it does |
|---|---|
| `/law-school-kit:setup [section]` | The setup wizard (resume at a section number) |
| `/law-school-kit:d2l-updates [KEY]` | What is new on D2L, mirrored into 02 D2L Course Content |
| `/law-school-kit:process-reading KEY [assn or date]` | Book notes for the next assignment |
| `/law-school-kit:merge-week KEY N` | Weekly synthesis, departures first |
| `/law-school-kit:update-outline KEY N` | Merge the synthesis into the one master outline |
| `/law-school-kit:audit KEY` | Dedupe, cross-link, confidence-1 work list |
| `/law-school-kit:week-ahead` | Next week's assignments and deadlines, checked against the tracker |
| `/law-school-kit:remote-agent <url>` | Build the system on a classmate's Mac through the setup agent they run (`setup-agent/` in the repo), over Tailscale |

Works in the Claude Code CLI and in the Claude Desktop app's Code tab
(Settings → Plugins, or the `/plugin` command). To try it before it is
published: `claude --plugin-dir ./law-school-kit` from a clone of this repo.

## Skills (loaded automatically when relevant)

`law-school-system` (the contract, templates, and render script),
`drive-setup`, `d2l-connector`, `casebook-connector`, `cowork-tasks`.

## Read your syllabi first

Some professors require an AI citation on every AI-phrased rule; some
prohibit AI on statutes or on graded work. The COURSE doc records each
policy and the nightly task honors it, but deciding whether to run
automation for a course is yours.
