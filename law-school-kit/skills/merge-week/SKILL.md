---
name: merge-week
description: Merge week N - reconcile class notes against book notes for one course into WK<NN>-synthesis, leading with where the professor departed from the casebook
disable-model-invocation: true
---

Usage: `/law-school-kit:merge-week <course key> <week number>`

Load `law-school-system` and read `references/TEMPLATE-WeeklySynthesis.md`.
For the course and week in `$ARGUMENTS`: gather that week's ClassNotes (04),
BookNotes (03), and any transcript (09). If there are no class notes, stop
and say so; do not synthesize from the book alone. Write WK<NN>-synthesis
to 05 Weekly Synthesis in the template shape: departures first (book said
/ professor said / why it matters), rules settled this week in the atomic
unit, application patterns, cross-links, confidence-1 items. If the
course has posted hypo sets, say whether this week's doctrine appears in
them. End with the "into the outline" checklist unfilled; `/update-outline`
fills it.
