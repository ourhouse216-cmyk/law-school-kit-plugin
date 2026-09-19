{{SEMESTER}} — SEMESTER COMMAND FOLDER

{{SCHOOL}} | {{STUDENT_NAME}}, {{YEAR_LABEL}} (J.D. {{JD_YEAR}})

====================================================================
ROOT
{{DRIVE_ROOT}} /
Single source of truth. Nothing permanent lives outside Drive.
Future semesters become siblings of "{{SEMESTER}}" under the school folder.

====================================================================
COURSES

CODE   COURSE                                        D2L ID   PROFESSOR
{{COURSE_TABLE}}

D2L course home: {{D2L_BASE}}/d2l/le/content/<D2L ID>/Home

====================================================================
FOLDER CONTRACT — DOCTRINAL COURSES ({{DOCTRINAL_CODES}})

01 Syllabus and Admin    syllabus, assignment listing, COURSE doc, PROJECT PROMPT
02 D2L Course Content    raw D2L downloads, mirror log, announcements
03 Book Notes            BookNotes-<Assn or date>-<Topic>
04 Class Sessions        ClassNotes-YYYY-MM-DD-<Topics>
05 Weekly Synthesis      WK<NN>-synthesis
06 Master Outline        <CODE>_MASTER_OUTLINE — ONE living file
07 Practice Exams        past exams + model answers + working copies of hypos
08 Assignments           graded work
09 Audio and Podcasts    class recordings + generated review audio
_Templates               book-notes / class-notes / weekly synthesis

Number prefixes exist because Drive sorts alphabetically. They force
workflow order. Do not rename them.

FOLDER CONTRACT — WORKSHOP COURSES ({{WORKSHOP_CODES}})
01 Syllabus and Admin / 02 D2L Course Content / 03 Record /
04 Research / 05 Class Sessions / 06 Drafts / 07 Final Brief / _Templates

No outline, no rule extraction, no practice exams. The deliverable is a
brief. Loop is draft -> critique -> revise.

====================================================================
TOOL BOUNDARIES

GOOGLE DRIVE   Permanent source of truth. All notes, outlines, syntheses.
CLAUDE PROJECT One project per course, instructions = that course's
               PROJECT PROMPT. Learns syllabus, professor quirks, outline
               style, writing preferences.
COWORK         Scheduled tasks run the loop unattended (book notes, D2L
               pull, week-ahead plan, Friday merge). Each task is pointed at
               the course folders plus _Semester.
D2L CONNECTOR  Reads the course shell (content tree, topics, announcements,
               attachments). Upstream source; mirrored into 02.
CASEBOOK       Reads assigned pages of the casebook by printed page number
CONNECTOR      (Casebook Connect). Feeds book notes.
NOTEBOOKLM     Source PDFs and targeted questions ONLY, plus podcast
               generation from 02 and 03. NOT for permanent notes.

====================================================================
WEEKLY LOOP — four named triggers, per course

1. Process reading [course, date]
   Read assigned material, output reading notes in the standard shape.

2. Merge week N
   Reconcile class notes against reading notes. Surface where the
   professor departed from the casebook. That gap is usually the exam
   question.

3. Update outline
   Integrate the synthesis into the single master file. No duplicated
   sections.

4. Audit [course]
   Every 3-4 weeks: dedupe, cross-link concepts, list every rule sitting
   at confidence 1.

====================================================================
ATOMIC DOCTRINE UNIT

Every doctrine extracted to the same shape, or nothing cross-links later:

  Rule
  Elements
  Exceptions
  Controlling authority
  Common trap
  Confidence (1-3)

The confidence score is what makes weak-spot flagging automatic instead
of a separate chore.

====================================================================
TARGET

Each master outline is a merge-and-refine job by late October, not a
build job. Polished and finals-ready well before the exam period.

====================================================================
OPEN ITEMS (fill in as the semester starts)

[ ] Professor names confirmed for every course
[ ] Exam format for every course (open/closed book matters enormously)
[ ] Syllabi into each 01 Syllabus and Admin
[ ] Schedule CSV built into _Semester / 01 Schedule
[ ] A prior outline identified as the house style model
[ ] Templates seeded into each _Templates
[ ] D2L mirrored into each 02 with a dated pull log
