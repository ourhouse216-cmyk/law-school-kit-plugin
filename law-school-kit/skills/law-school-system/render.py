#!/usr/bin/env python3
"""Render the Law School Claude Kit for one student's courses.

Usage:  python3 render.py config/courses.json [out_dir]

Reads the config, fills every template in templates/ and scheduled-tasks/,
and writes a ready-to-upload folder tree:

  out/_Semester/README - <Semester> System.md
  out/_Semester/ASSIGNMENT POSITION TRACKER - <Semester>.md
  out/<CODE>/01 Syllabus and Admin/PROJECT PROMPT - <CODE>.md
  out/<CODE>/01 Syllabus and Admin/COURSE - <CODE> <Title>.md
  out/<CODE>/02 D2L Course Content/D2L MIRROR LOG - <CODE>.md
  out/<CODE>/06 Master Outline/<CODE>_MASTER_OUTLINE.md      (doctrinal only)
  out/<CODE>/_Templates/TEMPLATE - BookNotes.md, ClassNotes.md, Weekly Synthesis.md
  out/connectors/d2l-courses.json, casebook-keys.json
  out/scheduled-tasks/<task>/SKILL.md

Placeholders are {{KEY}}. Blocks between {{#doctrinal}}...{{/doctrinal}} or
{{#workshop}}...{{/workshop}} are kept only for that course type. Blocks
between {{#assistant}}...{{/assistant}} are kept only when an assistant name
is set; {{^assistant}}...{{/assistant}} only when it is not. No dependencies.
"""
import json, os, re, sys, shutil

HERE = os.path.dirname(os.path.abspath(__file__))

def load(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

def section(text, name, keep):
    pat = re.compile(r"\{\{#%s\}\}(.*?)\{\{/%s\}\}" % (name, name), re.S)
    text = pat.sub((lambda m: m.group(1)) if keep else "", text)
    inv = re.compile(r"\{\{\^%s\}\}(.*?)\{\{/%s\}\}" % (name, name), re.S)
    return inv.sub("" if keep else (lambda m: m.group(1)), text)

def fill(text, vals):
    for k, v in vals.items():
        text = text.replace("{{%s}}" % k, str(v))
    leftover = sorted(set(re.findall(r"\{\{([A-Z_]+)\}\}", text)))
    return text, leftover

def student_vals(s):
    return {
        "STUDENT_NAME": s["name"], "HONORIFIC": s["honorific"], "SCHOOL": s["school"],
        "YEAR_LABEL": s["year_label"], "JD_YEAR": s["jd_year"], "SEMESTER": s["semester"],
        "WEEK1_MONDAY": s.get("semester_week1_monday", ""), "D2L_BASE": s["d2l_base"].rstrip("/"),
        "DRIVE_ROOT": s.get("drive_root", ""), "ASSISTANT_NAME": s.get("assistant_name", "") or "",
    }

def course_vals(c, s):
    v = student_vals(s)
    cb = c.get("casebook") or {}
    v.update({
        "CODE": c["code"], "COURSE_TITLE": c["title"], "COURSE_NUMBER": c.get("number", ""),
        "D2L_ID": c.get("d2l_id", ""), "D2L_URL": "%s/d2l/le/content/%s/Home" % (v["D2L_BASE"], c.get("d2l_id", "")),
        "PROFESSOR": c.get("professor", "TBD"), "PROF_EMAIL": c.get("prof_email", ""),
        "MEETS": c.get("meets", ""), "NO_CLASS": c.get("no_class", "") or "none listed",
        "CASEBOOK": cb.get("title", "") or "(none / course packets)", "CASEBOOK_ISBN": cb.get("isbn", ""),
        "CASEBOOK_CONNECT": "yes" if cb.get("on_casebook_connect") else "no",
        "ASSIGNMENT_SOURCE": c.get("assignment_source", ""), "EXAM": c.get("exam", "TBD"),
        "COURSE_NOTES": c.get("notes", ""), "COURSE_TYPE": c.get("type", "doctrinal"),
    })
    return v

def render(template, vals, ctype, assistant):
    t = section(template, "doctrinal", ctype == "doctrinal")
    t = section(t, "workshop", ctype == "workshop")
    t = section(t, "assistant", bool(assistant))
    t, leftover = fill(t, vals)
    return t, leftover

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "out")
    s, courses = cfg["student"], cfg["courses"]
    assistant = s.get("assistant_name", "")
    T = os.path.join(HERE, "references")
    warnings = []

    def write(rel, text):
        p = os.path.join(out, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f: f.write(text)
        print("wrote", rel)

    # Semester-level docs: need a course table.
    rows = []
    for c in courses:
        rows.append("%-6s %-45s %-8s %s" % (c["code"], (c.get("number","") + " " + c["title"]).strip(), c.get("d2l_id",""), c.get("professor","TBD")))
    patterns = []
    for c in courses:
        patterns.append("%s    %s, %s, Prof. %s\n      %s\n      NO CLASS: %s\n      Assignment source: %s\n" % (
            c["code"], c["title"], c.get("number",""), c.get("professor","TBD"), c.get("meets",""), c.get("no_class","") or "none listed", c.get("assignment_source","")))
    positions = "\n".join("%-5s| 0 | %s | not yet started" % (c["code"], s.get("semester_week1_monday","")) for c in courses)
    sv = student_vals(s)
    sv.update({"COURSE_TABLE": "\n".join(rows), "MEETING_PATTERNS": "\n".join(patterns), "POSITION_LINES": positions,
               "COURSE_CODES": ", ".join(c["code"] for c in courses),
               "DOCTRINAL_CODES": ", ".join(c["code"] for c in courses if c.get("type","doctrinal") == "doctrinal"),
               "WORKSHOP_CODES": ", ".join(c["code"] for c in courses if c.get("type") == "workshop") or "none"})
    for name, dest in [("README-Semester-System.md", "_Semester/README - %s System.md" % s["semester"]),
                       ("ASSIGNMENT-POSITION-TRACKER.md", "_Semester/ASSIGNMENT POSITION TRACKER - %s.md" % s["semester"])]:
        t, left = render(load(os.path.join(T, name)), sv, "doctrinal", assistant)
        if left: warnings.append((name, left))
        write(dest, t)

    # Per-course docs.
    per_course = [
        ("PROJECT-PROMPT.md", "01 Syllabus and Admin/PROJECT PROMPT - {CODE}.md", None),
        ("COURSE-DOC.md", "01 Syllabus and Admin/COURSE - {CODE} {TITLE}.md", None),
        ("D2L-MIRROR-LOG.md", "02 D2L Course Content/D2L MIRROR LOG - {CODE}.md", None),
        ("MASTER-OUTLINE-SHELL.md", "06 Master Outline/{CODE}_MASTER_OUTLINE.md", "doctrinal"),
        ("TEMPLATE-BookNotes.md", "_Templates/TEMPLATE - BookNotes.md", "doctrinal"),
        ("TEMPLATE-ClassNotes.md", "_Templates/TEMPLATE - ClassNotes.md", None),
        ("TEMPLATE-WeeklySynthesis.md", "_Templates/TEMPLATE - Weekly Synthesis.md", "doctrinal"),
    ]
    for c in courses:
        ctype = c.get("type", "doctrinal")
        cv = course_vals(c, s)
        for name, dest, only in per_course:
            if only and ctype != only: continue
            t, left = render(load(os.path.join(T, name)), cv, ctype, assistant)
            if left: warnings.append((name + " [" + c["code"] + "]", left))
            write(c["code"] + "/" + dest.format(CODE=c["code"], TITLE=c["title"]), t)

    # Connector config snippets.
    d2l = {c["code"]: {"id": c.get("d2l_id"), "name": "%s (%s)" % (c["title"], c.get("number",""))} for c in courses}
    write("connectors/d2l-courses.json", json.dumps(d2l, indent=2))
    cbk = {c["code"]: {"title": c["casebook"]["title"], "isbn": c["casebook"].get("isbn","")}
           for c in courses if (c.get("casebook") or {}).get("on_casebook_connect")}
    write("connectors/casebook-keys.json", json.dumps(cbk, indent=2))

    # Scheduled tasks.
    ST = os.path.join(HERE, "..", "cowork-tasks", "templates")
    sched_lines = "\n".join("- %s: %s (%s); no class %s" % (c["code"], c.get("meets",""), c["title"], c.get("no_class","") or "none") for c in courses)
    cb_lines = "\n".join("- %s: %s%s" % (c["code"], c["casebook"]["title"], " [Casebook Connect key: %s]" % c["code"] if c["casebook"].get("on_casebook_connect") else " [not on Casebook Connect: read from D2L materials / PDFs in 02]")
                         for c in courses if c.get("type","doctrinal") == "doctrinal")
    sv.update({"MEETING_LINES": sched_lines, "CASEBOOK_LINES": cb_lines})
    for fn in sorted(os.listdir(ST)):
        if not fn.endswith(".md"): continue
        task = fn[:-3]; src = os.path.join(ST, fn)
        t, left = render(load(src), sv, "doctrinal", assistant)
        if left: warnings.append(("scheduled-tasks/" + task, left))
        write("scheduled-tasks/%s/SKILL.md" % task, t)
        scripts = os.path.join(ST, task + "-scripts")
        if os.path.isdir(scripts):
            shutil.copytree(scripts, os.path.join(out, "scheduled-tasks", task, "scripts"), dirs_exist_ok=True)

    print("\nDone ->", out)
    if warnings:
        print("\nUnfilled placeholders (fill by hand):")
        for n, l in warnings: print("  %s: %s" % (n, ", ".join(l)))

if __name__ == "__main__":
    main()
