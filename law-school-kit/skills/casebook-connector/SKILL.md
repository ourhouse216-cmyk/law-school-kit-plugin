---
name: casebook-connector
description: Spec and build guidance for a personal Casebook Connect MCP connector that reads assigned casebook pages by printed page number (status, toc, read, figure, search, api_post). Use when a student wants casebook text in their book notes or asks to set up the casebook connector.
---
# Casebook Connect connector

Build it the same way as the D2L connector (see the d2l-connector skill for the server skeleton, hosting, and claude.ai registration): Node + MCP SDK, streamable HTTP, secret path, env-var credentials, read-only. The tool surface and API notes below are the spec. The user signs in to Casebook Connect themselves and captures the session calls in DevTools; you never handle their password.

# casebook-mcp — Casebook Connect connector

Purpose: turn "read pp. 65-95" into the actual casebook text, page by page,
with figures, so book notes cite real page pins instead of reconstructing
from memory. Backed by the student's own Casebook Connect (Aspen/Wolters
Kluwer) account and shelf.

## Hosting (as observed)

- Railway service, public URL `https://casebook-mcp-production.up.railway.app`.
- Generic endpoint `/<secret>/mcp` -> connector "TE Casebook" (tools take a
  `book` argument).
- Pinned-book endpoint `/<secret>/<key>/mcp`, e.g. `/<secret>/ba/mcp` ->
  connector "BA Casebook". Same server, same session; the tools are
  prefixed with the key (`ba_read`, `ba_toc`, ...), drop the `book`
  argument, and their descriptions are prefixed with the book title. One
  pinned connector per casebook gives each course Project an unambiguous
  tool set.
- Root returns 404. Streamable-HTTP MCP.

## Config model (environment variables)

| Var | Meaning |
|---|---|
| `CBC_USERNAME`, `CBC_PASSWORD` | Casebook Connect login. Session is cached (`savedAt`) and refreshed on failure. `school` was "Other". |
| `CBC_KEYS` | JSON map course key -> book title fragment, used to resolve `book` and to build pinned routes. Generated as `out/connectors/casebook-keys.json`. |
| `MCP_PATH_SECRET` | random path segment |

`casebook_status` reports: `session { live, loggedInAs, school, savedAt, via: "credentials", credentials: true }`, `keys { TE: "...", BA: "..." }`, and `shelf[] { key, bookId, title, author, isbn, type, expires }`. Books on the shelf that match no key have `key: null`.

## Tools (generic endpoint; pinned endpoints are identical minus `book`)

### `casebook_status()`
Check the session and list the books on the shelf (course key, bookId,
ISBN, expiry). Call first if another tool reports a session problem.

### `casebook_toc(book)`
Table of contents: chapter titles with the printed page each one starts
and ends on. Turns "Chapter 7" into a page range for `casebook_read`.
- `book`: a course key (`TE`, `BA`), a bookId, an ISBN, or part of the title.

### `casebook_read(book, from_page, to_page?, figures?)`
Read the assigned pages. Returns the exact text page by page, with
headings, markdown tables, and an inline marker wherever a figure sits.
Charts (family trees, diagrams) are attached as images so they can be
recreated in notes; photos and cartoons are only listed.
- `from_page`: number or string like `"C-12"` (required)
- `to_page`: inclusive; omit for one page
- `figures`: `"charts"` (default) | `"all"` | `"none"`

### `casebook_figure(book, page, n?)`
Fetch the image of a figure from a page (family tree, diagram, photo).
`n` is the figure number on that page as reported by `casebook_read`;
omit for every figure on the page.

### `casebook_search(book, query, limit?)`
Search inside a casebook for a case name or phrase; returns the
chapters/sections that mention it. Use when you know the case but not the
page, then read it with `casebook_read`.

### `casebook_api_post(endpoint, body?)`
Power tool: POST any Casebook Connect REST endpoint (e.g.
`bookShelfRetrivalService/globalSearch`) with a JSON body, using the
logged-in session. The `userVO` envelope is added automatically.
- `endpoint`: service path, e.g. `bookContentRetrievalService/getBookContent`
- `body`: extra JSON merged alongside `userVO`

## Underlying API notes

Casebook Connect's web app (`www.casebookconnect.com`) talks to JSON
services that take a `userVO` object (user id + session token) in every
POST body. Services seen in use: `bookShelfRetrivalService/*` (shelf,
global search), `bookContentRetrievalService/getBookContent` (page
content by book id and printed page). Printed page numbers map onto the
book's internal page ids through the TOC; the connector caches that map
per book. Figures come back as image URLs behind the same session.

If rebuilding: sign in in a browser, open dev tools, open a book to a page,
and capture the three calls (shelf, TOC, page content). The `userVO` shape
and the session token lifetime are visible there.

## How the system uses it

- Nightly book-notes run: `casebook_toc` to resolve the assignment's
  chapter, `casebook_read(from, to)` for the assigned range, write the
  doctrine units with real page pins, attach chart figures where a family
  tree or diagram matters, and state in the notes' SOURCING box that the
  text was read directly (as opposed to "reconstructed, no casebook
  text", which is how the system labels notes written when the connector
  was unavailable).
- Courses not on Casebook Connect (course packets on D2L) read their
  material through the D2L connector instead.
