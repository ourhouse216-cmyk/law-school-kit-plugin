---
name: drive-setup
description: Build and seed the Google Drive semester folder tree the study system depends on (numbered course folders, _Semester, seed documents). Use when a student is starting a semester or asks to set up Drive folders.
---
# Google Drive folder setup

The Drive tree is the whole system's memory. Claude Projects, the
connectors, and the scheduled tasks all assume this exact layout and these
exact names. Build it once, before anything else. Budget an hour, most of
it uploading syllabi.

Two ways to do it: by hand (Section 2), or let Claude build it through
the Google Drive connector (Section 3). Either way, finish with Section 4.

---

## 1. The layout

Root: `My Drive / <School> / <Semester> /`

Example: `My Drive / Marquette Law School / Fall 2026 /`

Inside the semester folder: one folder per course named by its short
all-caps CODE (the same tag you use in the D2L connector and the
prompts), plus `_Semester`. The underscore keeps `_Semester` sorted first.

```
Fall 2026/
├── _Semester/
│   ├── 01 Schedule/
│   ├── 02 OCI Fall 2026/          (or whatever recruiting/other track you run; optional)
│   ├── 03 Admin/
│   ├── _Templates/
│   ├── README - Fall 2026 System          (Google Doc)
│   └── ASSIGNMENT POSITION TRACKER - Fall 2026   (Google Doc)
├── EVID/         doctrinal course
├── BA/           doctrinal course
├── TE/           doctrinal course
├── PRIV/         doctrinal course
└── AWA/          workshop course
```

### Doctrinal course (any class that ends in an exam and gets an outline)

```
<CODE>/
├── 01 Syllabus and Admin/     syllabus (PDF + text extract), assignment listing,
│                              class schedule and deadlines, COURSE doc, PROJECT PROMPT
├── 02 D2L Course Content/     raw D2L mirror: "D2L — <title>" docs filed under the
│                              professor's own module names, plus
│                              "D2L MIRROR LOG — <CODE>" and "D2L ANNOUNCEMENTS — <CODE>"
├── 03 Book Notes/             BookNotes-<Assn or MMDD>-<Topic>
├── 04 Class Sessions/         ClassNotes-YYYY-MM-DD-<Topics>, transcripts
├── 05 Weekly Synthesis/       WK<NN>-synthesis
├── 06 Master Outline/         <CODE>_MASTER_OUTLINE   ← exactly ONE doc, ever
├── 07 Practice Exams/         past exams, model answers, working copies of posted hypos
├── 08 Assignments/            graded work you submit
├── 09 Audio and Podcasts/     class recordings, generated review audio
└── _Templates/                TEMPLATE — BookNotes, TEMPLATE — ClassNotes,
                               TEMPLATE — Weekly Synthesis
```

### Workshop course (writing course; deliverable is a brief, no outline)

```
<CODE>/
├── 01 Syllabus and Admin/     syllabus, COURSE doc, PROJECT PROMPT
├── 02 D2L Course Content/     raw D2L mirror + mirror log + announcements
├── 03 Record/                 the record on appeal / problem file
├── 04 Research/               authorities, and your prior brief and memo work
├── 05 Class Sessions/         ClassNotes-YYYY-MM-DD-<Topics>
├── 06 Drafts/                 versioned drafts (v01, v02, ...)
├── 07 Final Brief/            the filed version
└── _Templates/                TEMPLATE — ClassNotes
```

### Rules that keep it working

- **Never rename the numbered folders.** Drive sorts alphabetically; the
  numbers force workflow order (read → class → merge → outline), and the
  prompts refer to folders by these names.
- **One master outline per course.** If a second one appears, merge it
  back and delete it the same day.
- **Nothing permanent lives outside Drive.** OneDrive, NotebookLM, local
  folders are scratch. If it matters, it lands here.
- **Naming is data.** The scheduled tasks find things by name:
  `BookNotes-…`, `ClassNotes-YYYY-MM-DD-…`, `WK<NN>-synthesis`,
  `D2L — <title>`, `D2L MIRROR LOG — <CODE>`. Keep the patterns.
- **Google Docs, not Word files**, for anything Claude will edit. Upload
  PDFs as PDFs (they are sources, not notes).

---

## 2. Build it by hand (about 15 minutes for five courses)

1. In My Drive, create `<School>` and inside it `<Semester>`.
2. Inside `<Semester>`, create `_Semester` and one folder per course
   CODE.
3. In `_Semester`, create `01 Schedule`, `03 Admin`, `_Templates`, and
   any optional track folder (`02 …`).
4. In each doctrinal course folder, create the ten subfolders listed
   above. Drive cannot copy a folder, so this is New → Folder ten times
   per course; paste the names from this file to keep them exact.
5. In each workshop course folder, create the eight subfolders listed
   above.

If you rendered the kit (`python3 render.py config/courses.json`), the
`out/` folder already mirrors this tree with the seed documents inside.
Uploading `out/<Semester>`'s contents with "Convert uploads to Google
Docs format" turned on (Drive settings → General) creates the folders and
the docs in one drag.

---

## 3. Let Claude build it (Google Drive connector)

With Google Drive connected in claude.ai (Settings → Connectors), paste
this into a new chat. Edit the first three lines.

```
SCHOOL FOLDER: Marquette Law School
SEMESTER FOLDER: Fall 2026
COURSES: EVID (doctrinal), BA (doctrinal), TE (doctrinal), PRIV (doctrinal), AWA (workshop)

Build my semester folder tree in Google Drive. Do not create anything that
already exists; if a folder with the same name is already there, use it.

1. In My Drive, ensure a folder named <SCHOOL FOLDER> exists, and inside
   it a folder named <SEMESTER FOLDER>.
2. Inside the semester folder create: `_Semester`, and one folder per
   course named exactly by its code.
3. Inside `_Semester` create: `01 Schedule`, `03 Admin`, `_Templates`.
4. Inside every DOCTRINAL course folder create exactly these ten:
   `01 Syllabus and Admin`, `02 D2L Course Content`, `03 Book Notes`,
   `04 Class Sessions`, `05 Weekly Synthesis`, `06 Master Outline`,
   `07 Practice Exams`, `08 Assignments`, `09 Audio and Podcasts`, `_Templates`.
5. Inside every WORKSHOP course folder create exactly these eight:
   `01 Syllabus and Admin`, `02 D2L Course Content`, `03 Record`,
   `04 Research`, `05 Class Sessions`, `06 Drafts`, `07 Final Brief`, `_Templates`.
6. In each course's `02 D2L Course Content` create two empty Google Docs:
   `D2L MIRROR LOG — <CODE>` and `D2L ANNOUNCEMENTS — <CODE>`.
7. In each doctrinal course's `06 Master Outline` create one empty Google
   Doc named `<CODE>_MASTER_OUTLINE`.
8. When done, print the full tree with folder links so I can check it.
```

Then paste the seed documents from `out/` (Section 4) into the docs it
created, or upload them.

---

## 4. Seed the documents (the part that matters)

Empty folders do nothing. These documents are what the course Projects
and the scheduled tasks read first. All of them are generated by
`render.py` into `out/`; names below match the generated files.

| Where | Document | What it is |
|---|---|---|
| `_Semester/` | `README - <Semester> System` | The system contract: folder rules, tool boundaries, the four triggers, the atomic doctrine unit. Every Project is told to read it. |
| `_Semester/` | `ASSIGNMENT POSITION TRACKER - <Semester>` | Meeting patterns per course and a "last assignment covered" line per course that you correct by hand when a professor drifts. The Sunday and nightly runs check themselves against it. |
| `<CODE>/01` | `PROJECT PROMPT - <CODE>` | The text you paste into that course's Claude Project instructions. Keep a copy here so it is versioned with everything else. |
| `<CODE>/01` | `COURSE - <CODE> <Title>` | Logistics, exam format, grade weights, how the professor tests, AI policy, live deadlines, status checklist. Update it after the first D2L pull. |
| `<CODE>/01` | Syllabus (PDF and a text-extract Google Doc), assignment listing, `<CODE> <Semester> — Class Schedule and Deadlines` | The schedule doc maps numbered assignments onto real dates and pulls every hard deadline out of the syllabus. Build it once from the syllabus. |
| `<CODE>/02` | `D2L MIRROR LOG — <CODE>`, `D2L ANNOUNCEMENTS — <CODE>` | Start empty. The D2L updates run appends to them. |
| `<CODE>/06` | `<CODE>_MASTER_OUTLINE` | Start from the shell: build rules at the top, one PART per syllabus unit, cross-cutting threads, confidence-1 work list at the bottom. |
| `<CODE>/_Templates` | `TEMPLATE — BookNotes`, `TEMPLATE — ClassNotes`, `TEMPLATE — Weekly Synthesis` | Formatting models the tasks copy. |
| `<CODE>/07` | working copies of any hypo sets or past exams the professor posted | Copy them here from 02 so you can write answers without touching the mirror. |

Per-course seed order that works: upload syllabus → fill COURSE doc → build
the Class Schedule and Deadlines doc → build the outline shell's PARTs from
the syllabus units → paste the PROJECT PROMPT into the Claude Project →
first message to the Project: "Read the COURSE doc in 01 and the README in
_Semester, then tell me what is missing from the STATUS list."

---

## 5. Sharing and sync notes

- Cowork on a Mac or Windows PC can work on this tree either through the
  Google Drive connector or through a locally synced copy (Google Drive
  for desktop). If you use a local copy, give Cowork only the semester
  folder, not all of My Drive.
- Do not share the semester folder with classmates. Book notes and
  outlines are your work product; some professors' AI policies treat
  shared AI-generated notes as a violation.
- Next semester: create a sibling of `<Semester>` under `<School>` and
  repeat. Do not reuse the folder; the tracker and mirror logs are
  semester-specific.
