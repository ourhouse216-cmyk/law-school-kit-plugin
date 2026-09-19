---
name: d2l-mirror-weekly
description: Monday morning — walk every course's D2L shell, mirror anything new into 02 D2L Course Content, log the pull, and surface schedule or exam signals.
---
[RECONSTRUCTED from the live system's documents; the original runs on Jacob's Windows PC.]

Automated run; the user is not present. Read-only against D2L. Write only
to Google Drive.

STUDENT: {{STUDENT_NAME}}, {{SEMESTER}}. DRIVE ROOT: {{DRIVE_ROOT}}
COURSES: {{COURSE_CODES}}

For each course, in order:

1. STATUS. Call `d2l_status` once at the start. If a course key is missing
   from the connector's list, report it and continue with the others.

2. WALK. `d2l_content_toc(course)` for the full module/submodule/topic tree,
   and `d2l_news(course)` for announcements.

3. DIFF. Open "D2L MIRROR LOG — <CODE>" in the course's 02 folder and the
   "D2L ANNOUNCEMENTS — <CODE>" doc. Compare topic ids and last-modified
   stamps against the last PULL block, and announcement ids against the
   announcements doc.

4. PULL what is new or revised:
   - Text/HTML topics: `d2l_read_topic` -> create a Google Doc in 02 under
     the professor's own module name, titled "D2L — <topic title>".
   - Binary topics (PDF/DOCX/PPTX): `d2l_read_topic` returns a local file;
     upload it to 02 with the same title. If a PDF has no text layer, file
     a one-paragraph POINTER doc instead and list it under GAP.
   - Announcement attachments: `d2l_read_attachment` -> upload to 02.
   - New announcements: append verbatim (date, title, body) to
     "D2L ANNOUNCEMENTS — <CODE>".
   - Route by content: a syllabus or assignment listing also gets a text
     extract in 01; past exams and hypos also get a working copy in 07
     (05 Drafts / 03 Record for a workshop course).

5. LOG. Append a new dated PULL block to the mirror log: content tree as
   found, what was filed where, gaps, signals surfaced, what the next pull
   should check for. Never rewrite old blocks.

6. SIGNALS. A revised syllabus, a re-posted assignment listing, an exam
   format announcement, a schedule change, a new hypo set, or a conflict
   between the syllabus and an announcement is a signal, not housekeeping.
   List every one in the summary. Where two sources conflict, say which one
   controls (the newer announcement usually does).
{{#assistant}}
7. DEADLINES. Hand every new hard deadline to {{ASSISTANT_NAME}} so it
   lands on the calendar. Do not keep a separate schedule.
{{/assistant}}{{^assistant}}
7. DEADLINES. Put every new hard deadline on Google Calendar with the
   course code in the title. Do not keep a separate schedule.
{{/assistant}}
SUMMARY. One line per course: N new items, N revised, N announcements,
then the signals list. If nothing changed anywhere, one line: "D2L: no
changes this week." and nothing else.
