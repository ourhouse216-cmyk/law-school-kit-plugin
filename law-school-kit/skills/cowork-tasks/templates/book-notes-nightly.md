---
name: book-notes-nightly
description: Every evening, write book notes for every class meeting tomorrow, from the casebook and D2L, into each course's 03 Book Notes folder.
---
[RECONSTRUCTED from the live system's documents and outputs; the original runs on Jacob's Windows PC. Diff against it when available.]

This is an automated run. The user is not present. Execute autonomously,
make reasonable choices, and never fabricate: if you cannot read a source,
say so in the notes rather than inventing text.

STUDENT: {{STUDENT_NAME}} ({{HONORIFIC}}), {{YEAR_LABEL}}, {{SCHOOL}}, {{SEMESTER}}.
DRIVE ROOT: {{DRIVE_ROOT}}

COURSES AND MEETING PATTERNS
{{MEETING_LINES}}

CASEBOOKS
{{CASEBOOK_LINES}}

STEP 1 — WHICH CLASSES MEET TOMORROW
Compute tomorrow's date. Using the meeting patterns above and the no-class
dates, list every doctrinal course that meets tomorrow. Workshop courses
({{WORKSHOP_CODES}}) are skipped by this task. If nothing meets tomorrow,
stop with the one-line message "No classes tomorrow; no book notes
written." and do not send anything else.

STEP 2 — WHAT IS ASSIGNED
For each course that meets tomorrow:
  a. Open _Semester / "ASSIGNMENT POSITION TRACKER - {{SEMESTER}}". Read
     the POSITION line for the course (last assignment covered, as of date).
  b. Open the course's assignment source (named in the tracker: the
     schedule doc in 01 Syllabus and Admin, or the syllabus schedule
     section). Resolve the NEXT assignment after the tracked position, and
     cross-check it against the class-by-class calendar if one exists.
  c. If the tracker and the calendar disagree, do NOT guess. Write notes
     for the calendar's answer, label the doc "(position mismatch — verify)",
     and report the mismatch in the summary.
  d. Check 03 Book Notes for an existing doc for that assignment. If one
     exists and is not marked SUPERSEDED, skip the course and say so.

STEP 3 — READ THE MATERIAL, IN THIS ORDER
  a. Casebook pages: if the course is on Casebook Connect, use the casebook
     connector: `*_toc` to confirm the chapter, then `*_read(from_page,
     to_page)` for the exact assigned range, figures = charts. If the course
     is not on Casebook Connect, read the assigned pages from the materials
     mirrored in 02 D2L Course Content (course packets, PDFs).
  b. Professor-posted supplements for this assignment: walk the D2L
     content tree with the D2L connector (`d2l_content_toc`, `d2l_news`) and
     read anything tied to this class (edited cases, hypos, slides, case
     studies, statutes) with `d2l_read_topic` / `d2l_read_attachment`. Mirror
     anything new into 02 as a Google Doc named "D2L — <title>" and note it
     in the D2L MIRROR LOG for that course.
  c. Assigned statutes or rules: read them from the posted packet or the
     official source. HONOR COURSE AI POLICY: if the COURSE doc says the
     professor prohibits AI parsing of a statute, leave that section as a
     labeled blank for the student to fill by reading it themselves.

STEP 4 — WRITE THE NOTES
Read the course's PROJECT PROMPT in 01 and the TEMPLATE — BookNotes in
_Templates before writing. Produce ONE Google Doc in 03 Book Notes named
  BookNotes-<AssnNN or MMDD>-<Topic-With-Dashes>
(follow whatever naming the existing docs in that folder already use).

Shape, in order:
  1. Title line: course, assignment, topic, class date (weekday, date, week N).
  2. Assigned reading, itemized, with page ranges and D2L items.
  3. Two boxed notes: AI-POLICY NOTE (what the professor permits/prohibits
     and how these notes comply; include the AI cite if required) and
     SOURCING (what was read directly, with edition/ISBN; what could not be
     reached; nothing reconstructed without saying so).
  4. Doctrine extracted: one numbered unit per rule in the atomic shape —
     Rule / Elements / Exceptions / Controlling authority (with page pin) /
     Split or state variation / Common trap / Confidence (start every unit
     at 1) / AI cite if the course requires it.
  5. Cases: for each principal case, facts in three lines, holding in one,
     the reasoning move that matters, and the note questions that follow it
     in the book, answered.
  6. Problems and exercises: every assigned problem, worked out in full.
  7. Contestable: what the book treats as settled that is not.
  8. Questions for class.
  9. Post-class checklist, ending with the next class date, topic, and pages.

Formal, precise, concise. Real page pins. No filler.

STEP 5 — BOOKKEEPING
  - Append one line to the tracker's RUN LOG: date | course | assignment
    written | doc name | any mismatch.
  - Do not advance the POSITION line; the student or the Sunday run does that.
{{#assistant}}  - Hand {{ASSISTANT_NAME}} anything with a deadline found in the D2L pull.
{{/assistant}}
STEP 6 — SUMMARY
End with a short message: one line per course (doc name and page range
read), one line per skipped course and why, and any mismatch or unreadable
source. Nothing else.
