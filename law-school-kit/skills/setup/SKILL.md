---
name: setup
description: Set up the whole law-school study system for this student - courses config, Drive tree, Claude Projects, D2L connector, Cowork tasks - one section at a time
disable-model-invocation: true
---

Usage: `/law-school-kit:setup [section number to resume at]`

You are running the study-system setup wizard for the student at the
keyboard. Work one section at a time and stop for confirmation after each.
The student signs in to everything themselves; you never enter passwords,
cookies, or payment details, and you never create accounts for them.
If `$ARGUMENTS` names a section, resume there.

Load the `law-school-system` skill first.

SECTION 1 — COURSES CONFIG
Ask for, per course: a short all-caps tag, the course title and number,
the D2L course id (the number in the D2L content URL), professor,
meeting days/times, no-class dates, casebook (and whether it is on
Casebook Connect), where the reading schedule lives, exam format if known,
type (doctrinal or workshop), and a paragraph on how the professor tests
and any AI policy. Also: name, how to be addressed, school, year, JD year,
semester, and the Monday of week 1.
Write `./law-school/courses.json` in the schema of
`${CLAUDE_SKILL_DIR}/../law-school-system/courses.template.json`.
Run: `python3 "${CLAUDE_SKILL_DIR}/../law-school-system/render.py" ./law-school/courses.json ./law-school/out`
Report unfilled placeholders and fix them with the student.

SECTION 2 — GOOGLE DRIVE
Load the `drive-setup` skill. If Google Drive is connected in this
session, build the tree through it (its Section 3 prompt); otherwise
hand the student the manual steps. Then upload or paste every document
from `./law-school/out/` into its folder. Finish with the per-course seed
order in that skill's Section 4.

SECTION 3 — CLAUDE PROJECTS
For each course: the student creates a claude.ai Project named by the
course, pastes `./law-school/out/<CODE>/01 Syllabus and Admin/PROJECT PROMPT - <CODE>.md`
into its instructions, and enables Google Drive in it. First message to
each: "Read the COURSE doc in 01 and the README in _Semester, then tell
me what is missing from the STATUS list."

SECTION 4 — D2L CONNECTOR (optional today, needed for automation)
Load the `d2l-connector` skill and run it; `./law-school/out/connectors/d2l-courses.json`
is the D2L_COURSES value. Stop where it needs a Railway login, a browser
sign-in, or a cookie paste and hand those to the student.

SECTION 5 — CASEBOOK CONNECTOR (optional)
Only for courses with `on_casebook_connect: true`. Load `casebook-connector`.

SECTION 6 — COWORK TASKS
Load `cowork-tasks`. Walk the student through installing
`./law-school/out/scheduled-tasks/*/SKILL.md` in Claude Desktop → Cowork,
starting with book-notes-nightly. Have them "Run now" once and read the
result together.

SECTION 7 — VERIFY
- d2l_status shows every course key (if Section 4 done)
- one Project answers the STATUS question from the COURSE doc
- one nightly book-notes run produced a doc in 03 Book Notes
Then summarize what is live and what was skipped.
