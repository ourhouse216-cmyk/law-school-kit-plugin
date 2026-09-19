---
name: process-reading
description: Write book notes for one course's next (or a named) assignment from the casebook and D2L, in the atomic doctrine shape
disable-model-invocation: true
---

Usage: `/law-school-kit:process-reading <course key> [assignment number or class date]`

Load the `law-school-system` skill and read `references/TEMPLATE-BookNotes.md`.
Then follow the book-notes procedure in
`${CLAUDE_SKILL_DIR}/../cowork-tasks/templates/book-notes-nightly.md`
for the single course named in `$ARGUMENTS` (and the assignment or date
given, else the next one after the ASSIGNMENT POSITION TRACKER's
position). Read the course's PROJECT PROMPT and COURSE doc in 01 first
and honor the AI policy recorded there. Save the result as one Google Doc
in 03 Book Notes (or, without Drive access, as a markdown file in
`./law-school/out/<CODE>/03 Book Notes/`) and report the page range read,
what could not be read, and the confidence-1 count.
