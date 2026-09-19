---
name: week-ahead-sunday
description: Sunday evening — compute next week's assignments per course from the meeting calendar, check them against the ASSIGNMENT POSITION TRACKER, and write the "Week Ahead" plan.
---
[RECONSTRUCTED. The live system produces a "Week Ahead <start> to <end>" doc in the semester root and appends to the tracker's RUN LOG; this prompt reproduces that.]

Automated run; the user is not present. Report mismatches rather than guessing.

STUDENT: {{STUDENT_NAME}}, {{SEMESTER}}. DRIVE ROOT: {{DRIVE_ROOT}}
SEMESTER WEEK 1 = week of Mon {{WEEK1_MONDAY}}.

COURSES AND MEETING PATTERNS
{{MEETING_LINES}}

1. Open _Semester / "ASSIGNMENT POSITION TRACKER - {{SEMESTER}}". Read every
   POSITION line and the meeting patterns.

2. For Monday through Sunday of the coming week, list every class meeting
   (honor the no-class dates and holidays). Number the semester week.

3. For each meeting, resolve the assignment: next after the tracked
   position, in order, from the course's assignment source (schedule doc
   in 01, syllabus schedule section, or assignment listing). For a course
   whose source says "per class from D2L", read `d2l_news` and the content
   tree for that week's posting; if nothing is posted yet, mark it
   UNRESOLVED.

4. Check each answer against the class-by-class calendar doc in 01 where
   one exists. Any disagreement is reported as MISMATCH with both answers;
   do not pick one.

5. Pull the week's hard deadlines from each COURSE doc's LIVE DEADLINES and
   from the calendar (reflections, quizzes, drafts, forms, sign-ups).

6. Write "Week Ahead YYYY-MM-DD to MM-DD" in the semester root folder:
   - a day-by-day table: date, course, assignment number, topic, pages,
     posted supplements, book-notes status (exists / to be written);
   - deadlines this week;
   - reading load estimate per day (pages) and where the heavy days are;
   - open items: unresolved assignments, mismatches, empty D2L modules
     that should have filled by now.
{{#assistant}}
7. Send {{ASSISTANT_NAME}} the deadlines and the heavy-reading days so
   the daily plan and morning brief reflect them.
{{/assistant}}{{^assistant}}
7. Create a Google Task per deadline (course code in the title, due date
   set) if one does not already exist.
{{/assistant}}
8. Append one line per course to the tracker's RUN LOG:
   date | course | computed next assignment | tracker position | OK or MISMATCH.
   Do not edit POSITION lines; those are the student's to correct.

SUMMARY: the week's table in brief and every MISMATCH / UNRESOLVED item.
