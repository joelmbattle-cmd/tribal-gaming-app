# Tribal Gaming Compliance & Licensing Platform — Sales Demo

A dual-sided regulatory system-of-record demo for tribal gaming compliance and
licensing operations. Rebuilt from the original HTML/JS prototypes into a
real, persistent, deployable web app: **Next.js (App Router) + Postgres
(Prisma) + NextAuth**, ready to demo from a live URL.

All data is fabricated practice data for pitch purposes — see the banner in
the app itself.

## Stack

- **Next.js 16** (App Router, Server Actions) + TypeScript
- **Postgres** via **Prisma 7** (driver adapter: `@prisma/adapter-pg`) — works
  against any standard Postgres connection string, including
  [Neon](https://neon.tech)
- **NextAuth (Auth.js) v5**, Credentials provider, JWT sessions — role
  (`COMPLIANCE` / `LICENSING` / `APPLICANT`) is enforced server-side in
  `src/proxy.ts` (route-level) and again in every server action via
  `requireRole()` (defense in depth), not just hidden in the UI
- **Vercel Blob** for real document uploads (falls back to metadata-only
  attachments if unconfigured — see below)
- **SheetJS (xlsx)** for the Excel import/export on Machine Records

## Local development

Requires a Postgres database. Point `DATABASE_URL` in `.env` at it, then:

```bash
npm install
npx prisma migrate dev   # creates schema
npx tsx prisma/seed.ts   # loads demo data + demo login accounts
npm run dev
```

Demo accounts (password for all: `demo-pass-2026`):

| Role | Email |
|---|---|
| Compliance | `compliance@demo.gov` |
| Licensing | `licensing@demo.gov` |
| Applicant | `applicant@demo.gov` |

## Deploying a live demo URL (Vercel + Neon)

1. **Database**: create a free [Neon](https://neon.tech) Postgres project.
   Copy its pooled connection string.
2. **Vercel**: import this repo/branch as a new Vercel project.
3. Set these Environment Variables in the Vercel project settings:
   - `DATABASE_URL` — the Neon connection string
   - `AUTH_SECRET` — a random secret (`npx auth secret` or `openssl rand -base64 32`)
   - `BLOB_READ_WRITE_TOKEN` — optional. Add the **Vercel Blob** storage
     integration from the Vercel dashboard (Storage tab) and it sets this
     automatically. Without it, document "Attach" still works but only
     records the filename/date (no real file is stored) — same as the
     original prototype's behavior.
4. After the first deploy, run the schema migration and seed against the
   production database once (from your machine, with `DATABASE_URL` pointed
   at Neon):
   ```bash
   npx prisma migrate deploy
   npx tsx prisma/seed.ts
   ```
5. Reload the deployed URL — you should land on `/login`.

Re-running `npx tsx prisma/seed.ts` at any point resets the demo data back to
its pristine starting state (handy right before a sales call).

## What's preserved from the prototypes

- **R1** Machine Master Records — full profile, permanent document
  attachment, searchable per-machine audit history, one-tap Compliance
  Status (Verified/Flagged/Pending) writing an audit entry
- **R2** Interactive Floor Map — pan/zoom/drag canvas, Areas, drag-and-drop
  banks and machines, editable capacity, expandable canvas, Recent Map
  Changes log — with genuinely separate desktop (top bar + rail + slide-in
  drawer) and mobile (bottom tabs + bottom sheets + FABs + tap-to-move
  fallback) shells, not a CSS resize of one layout
- **R3** Shipment Management — document folder, simulated AI document
  scrubbing, configurable notification list, send notification
- **R4** Role-Based Access — real login per role, server-enforced data
  boundaries (route middleware + per-action checks), not a client toggle
- **R5** Self-Exclusion Module — sensitive case records, restricted/redacted
  presentation (all data fabricated)
- **R6** Licensing — person profiles, documents, background investigation
  status, Licensing-only access
- **R7** AI Software Status Monitoring — status dashboard with
  time-in-status tracking
- **R8** Metrics & Reporting — computed from real data where the seed
  history supports it (time-to-verify, exceptions, backlog, audit readiness)
- **R9** Applicant Portal — read-only-ish scoped view of the applicant's own
  application
- Excel export (all machine fields) and import with a downloadable
  template + legend tab (Serial Number match-in-place, auto-create unknown
  banks, auto-growing capacity)

## Floor setup from AutoCAD + a slot spreadsheet

Floor Map → **Floor Setup** (Compliance only) lets an agency build its real
floor without touching the demo layout. It only ever *adds*: an imported floor
gets its own band below the existing areas, and nothing already on the map is
moved, replaced or deleted.

1. **Floor plan (DXF).** Parsed in the browser with `dxf-parser`; the server
   validates the geometry and applies it. The floor outline (irregular shapes,
   courtyards, curved corners) is drawn as a vector, and every bank keeps its
   exact footprint and position at a uniform scale. Re-uploading an edited
   drawing with "Update floor plan" repositions banks in place.
2. **Machines (Excel).** Columns are auto-detected and can be remapped; Bank
   values that don't match a bank on the map can be assigned by hand. Machines
   are matched by serial number, so re-importing updates instead of duplicating.
3. **Resize fallback.** Edit Layout shows a corner handle on every bank; drag it
   (mouse or touch) if a footprint needs a tweak. "Reset size" returns to the
   footprint-derived size.

**DXF assumptions (v1).** DWG is proprietary, so export with `SAVEAS → AutoCAD
DXF`. One closed shape per bank on a bank layer (closed polyline, a loop of
LINE/ARC segments, or a block instance — shapes nested inside a larger bank
shape are ignored); text inside a shape names the bank. The floor outline is
optional and, if absent, defaults to the banks' bounding box. Model-space 2D
geometry only: splines, ellipses, hatches and 3D entities are skipped with a
warning.

**Excel assumptions.** The first row is headings. Only Serial Number and Bank
are required; Seat, Asset Number, Manufacturer, Model, Game Theme, PAR Sheet,
Seal Number, Compliance Status, Software Status, Status Since and Lifecycle
Status are optional. A Bank cell matches a map bank by name, or — for
CAD-imported banks only — by bare bank number ("104" or "Bank 104"). Seat
numbers above a bank's capacity widen the bank.

Every floor change is written to the Recent Map Changes log (`CAD Import`,
`Import`, `Resize Bank`).

## Project structure

```
prisma/schema.prisma       Data model (see comments for how it reconciles
                            the prototype's fields against the PRD /
                            Data Model Gap Analysis / Access-Control docs)
prisma/seed.ts              Demo data, ported from the two HTML prototypes
src/lib/auth.ts              Full NextAuth config (Node runtime, DB-backed)
src/lib/auth.config.ts       Edge-safe subset used by src/proxy.ts
src/proxy.ts                 Route-level auth + role-boundary enforcement
src/lib/data/                Read-only server-side data fetchers
src/lib/actions/             Server Actions (mutations), each requireRole()-gated
src/components/app-shell.tsx Desktop vs. mobile shell switch
src/components/views/        Shared view components rendered by both shells
```
