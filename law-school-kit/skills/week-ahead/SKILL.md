---
name: week-ahead
description: Compute next week's assignments per course from the meeting calendar, check them against the assignment position tracker, and write the Week Ahead plan
disable-model-invocation: true
---

Usage: `/law-school-kit:week-ahead`

Follow `${CLAUDE_SKILL_DIR}/../cowork-tasks/templates/week-ahead-sunday.md`
for every course in `./law-school/courses.json`. Report MISMATCH and
UNRESOLVED items rather than guessing; never edit the tracker's POSITION
lines.
