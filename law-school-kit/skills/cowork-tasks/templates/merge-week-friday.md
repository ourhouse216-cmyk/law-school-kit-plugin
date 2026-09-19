---
name: merge-week-friday
description: Friday evening — for each doctrinal course with class notes this week, run "Merge week N" into 05 Weekly Synthesis, then "Update outline" into the single master outline.
---
[RECONSTRUCTED from the four-trigger loop defined in every course PROJECT PROMPT.]

Automated run; the user is not present. Skip a course rather than merge
from thin material.

STUDENT: {{STUDENT_NAME}}, {{SEMESTER}}. DRIVE ROOT: {{DRIVE_ROOT}}
DOCTRINAL COURSES: {{DOCTRINAL_CODES}}
SEMESTER WEEK 1 = week of Mon {{WEEK1_MONDAY}}.

For each doctrinal course:

1. Compute the semester week number N. In 04 Class Sessions, find the
   ClassNotes docs dated this week; in 03 Book Notes, find the BookNotes
   docs for the same assignments; in 09 Audio and Podcasts, any transcript
   for this week's sessions.
   - No class notes and no transcript this week: skip the course, say so.
   - A WK<NN>-synthesis already exists for N: skip unless the class notes
     are newer than it.

2. MERGE WEEK N. Read the course PROJECT PROMPT and the TEMPLATE — Weekly
   Synthesis. Write "WK<NN>-synthesis" in 05 Weekly Synthesis, leading with
   every place the professor DEPARTED from the casebook (book said / prof
   said / why it matters), then the rules settled this week in the atomic
   shape, application patterns, cross-links, and the confidence-1 list.
   Where the course has posted hypo sets, say whether this week's doctrine
   appears in them.

3. UPDATE OUTLINE. Open the ONE master outline in 06. Merge the synthesis
   into the existing sections: departures at the top of the section marked
   [CLASS], rules into their units, confidence-1 items onto the work list.
   Never append a parallel section; never create a second outline file. If
   the course requires AI cites, add the ledger entries in Appendix C.
   Report the outline's page count against the exam ceiling if one exists.

4. Every fourth week (N divisible by 4), also run AUDIT on the outline:
   remove duplication, cross-link related concepts, rebuild the
   confidence-1 list, and end the outline's work list with a ranked "work
   on this before the next audit".

SUMMARY: per course, the synthesis doc name, the outline sections touched,
the page count, and the top three confidence-1 items. Skipped courses in
one line each.
