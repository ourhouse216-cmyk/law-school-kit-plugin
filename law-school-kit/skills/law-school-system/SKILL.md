---
name: law-school-system
description: The law-school study system contract - Drive folder tree, the four triggers (Process reading / Merge week / Update outline / Audit), the atomic doctrine unit, naming rules, and the render script that generates every per-course document from courses.json. Load whenever a task touches course notes, outlines, syntheses, the semester tracker, or setup.
---
# Law school study system

Read `references/README-Semester-System.md` first: it is the contract every
other command assumes. Then the template that matches the task:

| Task | Read |
|---|---|
| writing book notes | `references/TEMPLATE-BookNotes.md` |
| class notes | `references/TEMPLATE-ClassNotes.md` |
| weekly synthesis | `references/TEMPLATE-WeeklySynthesis.md` |
| master outline | `references/MASTER-OUTLINE-SHELL.md` |
| per-course Project instructions | `references/PROJECT-PROMPT.md` |
| COURSE doc, mirror log, tracker | `references/COURSE-DOC.md`, `references/D2L-MIRROR-LOG.md`, `references/ASSIGNMENT-POSITION-TRACKER.md` |

## Generating a student's documents

`courses.template.json` is the schema; `courses.example.json` is a filled
example. Render with:

```
python3 "${CLAUDE_SKILL_DIR}/render.py" <courses.json> <out_dir>
```

It writes the full Drive-ready tree (semester README, tracker, per-course
Project prompt, COURSE doc, mirror log, outline shell, templates),
`connectors/d2l-courses.json`, `connectors/casebook-keys.json`, and the
Cowork task prompts with the course list filled in. It prints any
placeholder it could not fill.

## Non-negotiables

- Google Drive is the source of truth; nothing permanent lives elsewhere.
- Numbered folders are never renamed. One master outline per course.
- Every doctrine is captured in the atomic unit: Rule / Elements /
  Exceptions / Authority / Common trap / Confidence 1-3. Confidence is the
  student's grasp, starts at 1, and only the student raises it.
- Lead every synthesis with where the professor departed from the
  casebook. That gap is usually the exam question.
- Honor each professor's AI policy as recorded in the COURSE doc (AI
  cites, statute sections left blank, no AI on graded work).
- Never fabricate a page pin, a holding, or a rule. Say what was read
  directly and what was not.
