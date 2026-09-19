---
name: cowork-tasks
description: The scheduled automations of the study system as Cowork scheduled-task prompts - nightly book notes, weekly D2L mirror, Sunday week-ahead plan, Friday merge and outline update, class-recording watcher (Mac). Use when installing or editing the automated loop.
---
# Cowork scheduled tasks

`templates/` holds one prompt per task with `{{PLACEHOLDERS}}`; the
law-school-system render script fills them from the student's
`courses.json` into `<out>/scheduled-tasks/<task>/SKILL.md`. Install each
in Claude Desktop → Cowork → Scheduled tasks, or copy the folder into
`~/Documents/Claude/Scheduled/` (Mac) or
`%USERPROFILE%\Documents\Claude\Scheduled\` (Windows).

| Task | Schedule | Needs |
|---|---|---|
| book-notes-nightly | daily 5:00 PM | Drive, D2L connector, Casebook connector (optional) |
| d2l-mirror-weekly | Monday 6:00 AM | Drive, D2L connector |
| week-ahead-sunday | Sunday 7:00 PM | Drive, calendar |
| merge-week-friday | Friday 6:00 PM | Drive |
| class-recording-watcher | every 15 min in class hours | Mac only; scripts in `templates/class-recording-watcher-scripts/` |

Cowork tasks live on the machine that created them and run only while it
is awake. Run each once with "Run now" and read the output before trusting
the schedule. The first three tasks read the ASSIGNMENT POSITION TRACKER
and report mismatches instead of guessing; the student corrects the
tracker's POSITION lines by hand when a professor drifts.
