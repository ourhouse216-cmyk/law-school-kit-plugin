---
name: update-outline
description: Integrate a week's synthesis into the course's single master outline without creating duplicate sections
disable-model-invocation: true
---

Usage: `/law-school-kit:update-outline <course key> <week number>`

Load `law-school-system` and read `references/MASTER-OUTLINE-SHELL.md`.
Open the ONE master outline in 06 for the course in `$ARGUMENTS` and the
WK<NN>-synthesis for the week. Merge: departures at the top of their
section marked [CLASS], rules into their existing units (edit in place,
never append a parallel section), confidence-1 items onto the work list,
AI-cite ledger entries in Appendix C if the course requires them. Never
create a second outline file. Report sections touched and the page count
against the exam ceiling if the COURSE doc states one.
