---
name: audit
description: Full pass over a course's master outline - dedupe, cross-link, list every confidence-1 rule, rank what to work on next
disable-model-invocation: true
---

Usage: `/law-school-kit:audit <course key>`

Load `law-school-system`. Open the master outline in 06 for the course in
`$ARGUMENTS`. Remove duplicated rules (keep the better-cited one), add
cross-references between related units, rebuild the CONFIDENCE 1 work
list from every unit still at 1, check every unit has all six fields of
the atomic shape, and flag units whose headers are case names. End with
a ranked list of what the student should work on before the next audit,
with the reason for each rank. Do not raise any confidence score.
