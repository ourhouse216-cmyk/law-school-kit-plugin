---
name: d2l-updates
description: Walk every course's D2L shell, report what is new or revised, and mirror it into 02 D2L Course Content
disable-model-invocation: true
---

Usage: `/law-school-kit:d2l-updates [course key, or blank for all]`

Requires the D2L connector (tools d2l_status, d2l_content_toc, d2l_news,
d2l_read_topic, d2l_read_attachment). If they are not available, say so
and point to the `d2l-connector` skill.

Scope: `$ARGUMENTS` if it names a course key, otherwise every course from
d2l_status. Notes root and state file: read `./law-school/courses.json`
for the Drive root; state lives at `<Drive root>/_Semester/d2l-state.json`
(create on first run).

For each course:
1. d2l_content_toc and d2l_news.
2. Diff against the state file: new topics, changed lastModified, new
   announcement ids. First run = everything is new; count, do not flood.
3. Read each new or revised item (d2l_read_topic / d2l_read_attachment).
   File text topics as "D2L — <title>" under the professor's module name
   in 02 D2L Course Content; binaries by filename; a PDF with no text
   layer gets a one-line pointer. Append new announcements verbatim to
   "D2L ANNOUNCEMENTS — <CODE>".
4. Append a dated block to "D2L MIRROR LOG — <CODE>".
5. Update the state file.

Lead the summary with SIGNALS: revised syllabus, re-posted assignment
listing, exam format or date, schedule change, new hypo or problem set,
syllabus-vs-announcement conflict (say which controls). Put every hard
deadline on the calendar if one is connected; otherwise list them. Then
one line per course. If nothing changed: "D2L: no changes."
