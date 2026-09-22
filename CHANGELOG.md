# Changelog

All notable changes to MediVault are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and version numbers follow [Semantic Versioning](https://semver.org/):
`MAJOR.MINOR.PATCH` — MAJOR for breaking changes, MINOR for new
backwards-compatible features, PATCH for fixes and small internal
improvements.

New entries are added **above** the `1.0.0` baseline, in a new section at
the top of the file, as changes are made. The `1.0.0` entry below is a
snapshot of the application in its initial, fully-featured state and
should not be edited once later versions exist.

---

## [Unreleased]

### Security

- **Anyone could log in as any user by writing their own cookie.** The
  middleware and 14 API routes read the user's role out of the
  `medivault_token` cookie with `JSON.parse(atob(token.split('.')[1]))`.
  That only base64-decodes the middle part of the token — it never checks
  the signature — so a hand-made token such as
  `header.{"role":"ADMIN","userId":"x","exp":9999999999}.anything` was
  accepted as a genuine administrator session.
  - Added `src/lib/jwt.ts` with `signToken()` and `verifyToken()` (moved out
    of `src/lib/auth.ts`, which re-exports them so existing imports still
    work). `verifyToken()` checks the signature and the expiry, pins the
    algorithm to HS256, and rejects a token that is missing its fields. It
    has no `next/headers` import, so the Edge middleware can use it too.
  - Added `getRoleAndActor(request)` to `src/lib/auth.ts`. It is the one
    way an API route learns who is calling, and it verifies the cookie. All
    16 routes now use it: 14 had their own copy of the unsafe decode and 2
    read the `x-user-role` / `x-user-id` headers directly. It no longer
    trusts those headers at all, because a client can send any header it
    likes.
- **The route-protection middleware was not running at all**, for two
  separate reasons, so no page or API route was protected by it:
  1. `middleware.ts` was in the project root, but this project keeps its
     code in `src/`, and Next.js only loads middleware from `src/` in that
     case. The build's middleware manifest was empty. Moved it to
     `src/middleware.ts`; the build now reports "Middleware" and the
     manifest lists it. (This is also why every API route had grown its own
     "middleware didn't attach headers" fallback.)
  2. `PUBLIC_PATHS` contained `'/'` and paths were matched with
     `startsWith`, so **every** path counted as public and the middleware
     returned immediately. `/` is now matched exactly and the other public
     paths by prefix.
  - The middleware now verifies the token with `verifyToken()` and no
    longer sets `x-user-*` headers, and the `console.log` that printed the
    role and path of every request was removed.
  - Checked against the real production server (`next build` + `next
    start`): no cookie is redirected to `/login` (pages) or gets `401`
    (API); a forged token and a token signed with another secret are both
    rejected; a genuine token reaches its own dashboard; a lab technician
    who opens `/dashboard/admin` is redirected to `/dashboard/lab`.
- **Removed the `/api/debug` route.** It was listed in `PUBLIC_PATHS` (open
  to anyone) and its file contained a copy of the `/api/auth/me` code.

### Added

- **Laboratory module**: doctors order tests, a lab technician records the
  results, the doctor reviews them, and only then does the patient see them.
  - New role `LAB_TECHNICIAN` (demo login `lab@unza.zm`) with its own
    dashboard at `/dashboard/lab`: a work queue (urgent orders first, then
    oldest first) with "Mark sample collected" and a results form, plus a
    Completed tab.
  - New database tables `LabTest` (the catalogue and its reference ranges),
    `LabOrder` and `LabOrderItem`, new enums `LabOrderStatus`,
    `LabPriority` and `LabFlag`, and the migration
    `20260921120000_add_lab_module`. Each ordered test **copies** its unit
    and ranges from the catalogue at the time of ordering, so editing the
    catalogue later never changes what an old result means.
  - Order lifecycle: `ORDERED` -> `COLLECTED` -> `COMPLETED` (or
    `CANCELLED`). Each step is a guarded database update, so two people
    cannot both move the same order.
  - Results are flagged **by the server**, never by the browser:
    `NORMAL`, `LOW`, `HIGH`, `CRITICAL_LOW`, `CRITICAL_HIGH`, or `ABNORMAL`
    for yes/no tests such as the malaria RDT (see `computeFlag()` in
    `src/lib/lab.ts`). The lab technician gets a warning toast on a
    critical value and the order card shows a red banner.
  - Release step: the patient only sees an order once it is `COMPLETED` and
    the ordering doctor has reviewed it (optionally with a comment).
    Next of Kin accounts cannot see lab results.
  - New API: `GET /api/lab/tests`, `GET`/`POST /api/lab/orders`,
    `PATCH /api/lab/orders/:id` (`collect`, `cancel`, `review`) and
    `PUT /api/lab/orders/:id/results`. Ordering, entering results, collecting
    and reviewing are written to the access log, as is viewing a patient's
    lab orders.
  - UI: a "Lab Tests" tab on the doctor dashboard, a "Lab Results" tab on
    the patient dashboard, a shared `LabOrderCard` component, a `FlaskIcon`,
    and sidebar entries for all three roles.
  - The seed adds the lab technician, a catalogue of 8 tests, and three
    sample orders (one released, one with a critical result waiting for
    review, one waiting in the queue).
- **The seed now stocks the pharmacy** (5 common drugs) if the inventory is
  empty, because dispensing now needs stock to exist.

### Fixed

- **Sidebar links did nothing on every account.** The Patient,
  Receptionist, Doctor, Next of Kin and Pharmacist dashboards are each a
  single page whose sections (tabs) are chosen by React state, while the
  sidebar links point at URLs like `/dashboard/patient#records`. Nothing on
  those pages ever read the `#records` part of the URL, and Next.js does
  not re-render a page for a hash-only change, so clicking a sidebar link
  changed the address bar at most and the screen stayed the same.
  - Added `src/hooks/useHashSection.ts`. The URL hash is now the source of
    truth for the active section. Pages use `useHashSection()` instead of
    `useState()`, so the sidebar, the tab buttons, the browser back
    button and direct links all stay in sync.
  - `src/app/dashboard/layout.tsx` now handles clicks on links that point
    at the current page (updates the hash itself) and highlights the
    sidebar item that matches both the page and the section. Previously
    every link on the same page was highlighted at once.
  - Updated the patient, receptionist, doctor and pharmacy dashboards to
    use the hook. On the doctor dashboard, "Add Record" and "Send
    Prescription" need a selected patient, so choosing them from the
    sidebar without one shows the search view with a short notice.
  - Added `id="patients"` to the Next of Kin patient list so its sidebar
    link scrolls to it.
- **Admin "Access Logs" (sidebar, stat card and quick action) led to a
  404.** The `/dashboard/admin/logs` page was linked in three places but
  had never been created. Added it (`src/app/dashboard/admin/logs/page.tsx`)
  using the existing `GET /api/access-logs` endpoint, with search,
  pagination and a CSV export button.
- **`.gitignore` contained `logs/`, which would have hidden the new admin
  logs page from Git** because that pattern matches a folder named `logs`
  anywhere in the project. Changed it to `/logs/` (project root only).
- **Pharmacist login opened the patient dashboard first and only switched
  after the page was interacted with.** The login page, the root page and
  the `useAuth` hook each kept their own copy of the role-to-dashboard map,
  and none contained `PHARMACIST`, so the lookup fell back to
  `/dashboard/patient`. The `Role` type in `src/types/index.ts` was also
  missing `PHARMACIST`.
  - Added `src/lib/roles.ts` as the single source of truth
    (`ROLE_DASHBOARDS`, `getDashboardPath`) and switched the login page,
    root page and `useAuth` to use it.
  - An unknown role now goes to `/login` instead of silently landing on
    the patient dashboard.
  - Added `PHARMACIST` to the `Role` type.
- **Doctor names showed as "Dr. Dr. Grace Phiri" on the patient's medical
  records.** The seed data stores names with the title included
  ("Dr. Grace Phiri") and the patient dashboard added another "Dr. " in
  front. Added `formatDoctorName()` in `src/lib/format.ts`, which strips
  any existing title before adding exactly one, and used it in both places
  on the patient dashboard.

- **"Create User" modal on the admin User Management page rendered off
  screen / cut off instead of centered.** The dashboard layout wraps every
  page's content in a `div` with the `animate-fade-in` class, which plays
  a short entry animation using CSS `transform`. In CSS, any ancestor
  element with a `transform` (even one that settles at `translateY(0)`)
  creates a new *containing block* for any descendant using
  `position: fixed`. Because the "Create User" and "Reset Password"
  modals lived inside that animated wrapper, they were no longer
  positioned relative to the browser window — they were positioned
  relative to that inner div instead, which is why the modal appeared
  shifted upward and cut off at the bottom of the screen.
  - Added a new reusable `src/components/Modal.tsx` component that
    renders modal content through a React Portal directly into
    `document.body`, so modals are always positioned relative to the
    real viewport regardless of any animation classes elsewhere on the
    page.
  - The modal component also closes on `Escape`, closes when clicking
    the dark backdrop, and locks background scrolling while open.
  - Added a separate, opacity-only `animate-fade-in-modal` CSS animation
    (`globals.css`) for modal content, intentionally avoiding
    `transform` so this class of bug can't be reintroduced by future
    modals.
  - Updated `src/app/dashboard/admin/users/page.tsx` to use the new
    `Modal` component for both the "Create User" and "Reset Password"
    dialogs.
- **Dates were shown as m/d/yyyy (for example 3/4/2026) instead of the
  day-first dd/mm/yyyy format used in Zambia.** Every date was printed with
  `toLocaleDateString()` / `toLocaleString()`, which follow the *browser's*
  language setting, so a browser set to English (US) printed the American
  order. That is ambiguous as well as unfamiliar: 3/4/2026 is 4 March in
  Zambia but reads as 3 April in the US format.
  - Added `formatDate()` (`04/03/2026`) and `formatDateTime()`
    (`04/03/2026, 14:30`, 24-hour clock) to `src/lib/format.ts`. They
    build the text by hand so the result is identical on every computer,
    and show `—` for a missing or invalid date instead of "Invalid Date".
  - Replaced all `toLocaleDateString()` / `toLocaleString()` calls on the
    patient, doctor, next of kin, pharmacy, admin users and admin logs
    pages. The long header dates (for example "Saturday, 19 September
    2026") already spell out the month, so they were left alone.

- **Dispensing a prescription did not work, and never touched the stock.**
  - The route folder was named `[Id]` (capital I) but the code read
    `params.id`, so the prescription id was `undefined`. Renamed the folder
    to `[id]`. (On Windows, if Git does not pick up a case-only rename, run
    `git mv "src/app/api/prescriptions/[Id]" tmp && git mv tmp "src/app/api/prescriptions/[id]"`.)
  - Even when it ran, it only flipped the status to `DISPENSED`; the drug
    inventory was never reduced. Dispensing now runs in one transaction that
    (1) claims the prescription, so two pharmacists cannot dispense it
    twice, (2) takes the prescribed quantities out of the inventory, using
    the batch that expires first and never an expired or empty batch, and
    (3) rolls everything back with a clear message if any drug is missing or
    short (for example "Not enough Amoxicillin: need 50, only 20 in
    stock"). Stock updates are guarded so a quantity can never go below
    zero. The planning logic is in `src/lib/pharmacy.ts`.
  - Prescriptions now require a whole-number quantity for every medication
    (checked on the doctor form and by a new Zod schema on
    `POST /api/prescriptions`, which previously had no validation). Older
    prescriptions with no quantity can still be dispensed, with a warning
    that their stock was not adjusted.
- **The admin screens could not create or filter Pharmacist accounts.**
  `PHARMACIST` was missing from the role dropdowns on the admin Users page
  and from `CreateUserSchema` / `UpdateUserSchema`, so the API refused it.
  Both schemas, the dropdowns and the role colours now include `PHARMACIST`
  and `LAB_TECHNICIAN`, and the roles are defined once in `ROLE_VALUES`.
  The "User roles" figure on the login page now says 7 (it said 5).
- **`npm run build` failed on a type error in `src/lib/rate-limit.ts`**
  (iterating a `Map` with `for...of`). Wrapped it in `Array.from()`.

### Changed

- **`middleware.ts` moved to `src/middleware.ts`** (see Security). `middleware-old.ts`
  in the project root is unused and can be deleted.
- **Removed emoji from the prescription buttons and headings**, in line
  with the rest of the UI using the SVG icon set instead of emoji:
  "Prescribe" (patient header card), "Send Prescription to Pharmacy"
  (form heading) and "Send to Pharmacy" (submit button) on the doctor
  dashboard, and the check mark on "Mark Dispensed" plus stray leading
  spaces on the two tab labels on the pharmacy dashboard.
- **Logging out now shows a skeleton loading screen straight away.**
  Previously nothing changed on screen until the logout request finished
  and the login page loaded, which felt like a delay or a frozen button.
  - Added `src/components/DashboardSkeleton.tsx`, a grey pulsing
    placeholder shaped like the dashboard (sidebar, header, stat cards).
  - `handleLogout` in `src/app/dashboard/layout.tsx` switches to it the
    instant the button is clicked. If the logout request fails, the
    dashboard comes back with an error message.
  - The layout also prefetches `/login` so the login page loads faster
    after logout.

### Tests

- Added `tests/unit/middleware.test.ts` (15 tests). It checks the middleware
  with hand-made tokens, tokens signed with another secret, expired tokens,
  `alg: none` tokens and forged `x-user-role` headers, that unauthenticated
  requests are stopped, that `/`, `/login` and `/api/auth/login` stay public,
  and the role-to-dashboard rules (including `LAB_TECHNICIAN`). 12 of the 15
  fail against the previous middleware.
- Added `tests/unit/request-auth.test.ts` for `getRoleAndActor()`.
- Added `tests/unit/pharmacy.test.ts` for stock deduction (case-insensitive
  and generic-name matching, expiry, earliest-expiry-first across batches,
  no half-dispensing, no double promising) and the prescription schema.
- Added `tests/unit/lab.test.ts` for result flagging (limits, critical
  values, a value of zero, yes/no tests), the reference-range text and the
  lab input schemas.
- Added `tests/unit/route-safety.test.ts`, which reads the source and fails
  if anything decodes a token with `atob`, an API route reads `x-user-*`
  headers, an API route does not call `getRoleAndActor`, a route file
  exports anything other than HTTP handlers (this breaks `next build`), or a
  dynamic folder name does not match the `params` key it reads (the `[Id]`
  bug).
- Updated the role test for `LAB_TECHNICIAN` and added `FlaskIcon` to the
  icon test. The suite went from 78 to 140 tests.
- Added `tests/unit/roles-and-format.test.ts` covering the role-to-dashboard
  map (including `PHARMACIST` and unknown roles) and `formatDoctorName`
  (with and without an existing title, `Dr`/`dr`/repeated titles, a name
  like "Drake", and a missing doctor), and for `formatDate` /
  `formatDateTime` (day before month, leading zeros, 24-hour time, ISO
  strings, missing/invalid dates).

---

## [1.0.0] - Initial release

This entry describes MediVault's complete, initial feature set: a
role-based patient portal built for the University of Zambia Clinic,
built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma ORM,
and PostgreSQL.

### User roles & authentication

- **Five distinct user roles**, each with its own dashboard and permissions:
  - **Patient** — views their own medical profile, visit history, and
    next-of-kin assignments.
  - **Receptionist** — verifies student eligibility, registers walk-in
    patients, and manages the day's visit queue.
  - **Doctor** — searches for patients, reviews their full medical
    history, and adds new medical records.
  - **Administrator** — manages user accounts and reviews system-wide
    access logs.
  - **Next of Kin** — views the patients who have delegated them as an
    emergency contact, and can grant emergency treatment consent.
- **Login page** (`/login`) with a landing/marketing view and a login
  form, supporting login by email or student number plus password, with
  role selection.
- **JWT-based session authentication** using the `jose` library, stored
  in an `httpOnly` cookie (`medivault_token`) so the token cannot be read
  by client-side JavaScript.
- **Password hashing** with `bcryptjs` — plaintext passwords are never
  stored.
- **Route protection middleware** (`middleware.ts`) that runs on every
  request to a protected path:
  - Redirects unauthenticated users to `/login`, preserving the page they
    were trying to reach so they can be sent back after logging in.
  - Enforces role-based access to each dashboard section (e.g. only
    `DOCTOR` and `ADMIN` roles may reach `/dashboard/doctor`).
  - Returns a JSON `401 Unauthorized` response for blocked API requests
    instead of a redirect.
- **Login rate limiting** (`src/lib/rate-limit.ts`) — after 5 failed
  login attempts from the same source within the tracking window,
  further attempts are blocked and the caller is told how many seconds
  to wait before trying again. Each source (e.g. IP address) is tracked
  independently.
- **Logout** clears the session cookie and returns the user to the login
  page.

### Student verification (replacing physical ID cards)

- **Student number verification** (`/api/verify-student/[studentNumber]`)
  simulates a lookup against the UNZA Student Information System
  (`src/lib/unza-sis-mock.ts`), returning:
  - Whether the student number is recognized at all.
  - Whether the student is currently eligible for care (active
    enrollment), or a reason why not (e.g. suspended, or an alumnus who
    has since graduated).
- Receptionists use this feature on the **Verify Student** tab of their
  dashboard to confirm a student's eligibility before registering a
  visit, removing the need to physically inspect a university ID card.

### Patient records & clinical workflow

- **Electronic medical profiles** for every patient, covering:
  - Diagnoses
  - Medications (name, dose, and duration for each)
  - Known allergies
  - Free-text clinical notes
  - Follow-up dates
  - Full visit history
- **Doctor dashboard** (`/dashboard/doctor`) with two workflows:
  - **Patient Search & History** — search for a patient and review their
    complete medical record history, including allergy warnings,
    medication lists, and follow-up reminders.
  - **Add Medical Record** — create a new medical record for a selected
    patient, including diagnosis, a dynamic list of medications, known
    allergies, clinical notes, and an optional follow-up date.
- **Patient dashboard** (`/dashboard/patient`) showing:
  - Summary stat cards: total medical records, total visits, upcoming
    visits, and next-of-kin assignment status.
  - The most recent medical record, including allergy warnings and
    follow-up reminders.
  - Full medical record history with medications and notes.
  - The patient's next-of-kin assignments and each one's emergency
    consent status (given or pending).

### Visit management

- **Visit registration** — receptionists can register a walk-in visit
  for a verified student, capturing the reason for the visit.
- **Visit status tracking** through a defined lifecycle: `WAITING` →
  `CHECKED_IN` → `IN_CONSULTATION` → `CHECKED_OUT`, with `CANCELLED` as
  an additional terminal state.
- **Receptionist dashboard** (`/dashboard/receptionist`) with:
  - Live stat cards for patients currently Waiting, In Progress, and
    Completed Today.
  - A **Verify Student** tab for eligibility lookups.
  - A **Today's Visits** tab listing the day's queue with status badges
    and a manual refresh control.
  - A **Register Patient** tab to create a new patient account directly
    from the front desk.

### Next of kin & delegated consent

- **Next-of-kin delegation** — patients can pre-assign a trusted next of
  kin who can act on their behalf if they become incapacitated.
- **Emergency consent workflow** — a next of kin can grant emergency
  treatment consent for a patient, with the consent timestamp recorded.
- **Next of Kin dashboard** (`/dashboard/next-of-kin`) showing:
  - Every patient who has delegated the logged-in user as their next of
    kin.
  - Each assignment's consent status (Consent Given / Consent Pending).
  - An expandable visit history per patient.
  - An informational banner explaining the purpose of the delegated
    consent feature.

### Administration

- **Admin dashboard** (`/dashboard/admin`) with:
  - Stat cards summarizing total users, patients, doctors,
    receptionists, next of kin, and recent access log entries — each
    card links through to a filtered view.
  - Quick actions to manage user accounts, view the access audit log,
    and export access logs as a CSV file.
  - A system status panel showing live database connectivity.
- **User management** (`/dashboard/admin/users`) with:
  - A searchable, paginated table of all user accounts.
  - Account creation for any role.
  - Password reset for any user account.
  - Pagination controls for browsing large user lists.

### Accountability & audit logging

- **Access logging** — every significant action (viewing or modifying a
  patient record, creating a visit, granting consent, managing user
  accounts, etc.) is recorded with who performed it, what was accessed,
  and when.
- **Access log viewer** (`/dashboard/admin/logs`) — a paginated,
  filterable table of all recorded access log entries, viewable by
  administrators.
- **CSV export** of the full access log for offline review or
  compliance record-keeping.

### Data model

- PostgreSQL database managed through Prisma ORM, with these core
  tables: `User`, `PatientProfile`, `MedicalRecord`, `Visit`,
  `NextOfKinAssignment`, and `AccessLog`.
- Seed script (`prisma/seed.ts`) for populating the database with
  synthetic demonstration data (no real patient data is ever used).

### User interface

- **"Clinical-refined" visual design**: a deep navy, warm ivory, and
  sage green color palette, paired with Crimson Pro (headings) and IBM
  Plex Sans (body text) typography.
- **Collapsible sidebar navigation** in the dashboard layout, with
  role-specific menu items and icons, and a persistent logout control.
- **Toast notifications** (via `react-hot-toast`) for success and error
  feedback throughout the app.
- **Custom SVG icon library** (`src/components/icons.tsx`) used
  consistently across the entire app in place of emoji characters, so
  every icon renders identically regardless of the operating system or
  font the person viewing MediVault has installed. Icons cover
  navigation, status indicators (success/warning/error/pending),
  medical concepts (medication, calendar, records), and general UI
  actions (search, save, close, refresh, pagination).
- Responsive, card-based layouts throughout, with full-height,
  square-cornered colored accent bars on stat cards and result panels
  (implemented as a separate layered element so the accent bar is never
  visually clipped by the card's rounded corners).

### Testing

- Automated test suite (run with `npm test`, powered by Vitest) covering:
  - Login rate limiting behavior.
  - The mock UNZA Student Information System lookup.
  - All Zod input-validation schemas used by the API routes.
  - JWT session token signing and verification, including rejection of
    tampered or invalid tokens.
  - The SVG icon library, confirming every icon renders as valid markup
    and correctly accepts sizing and styling props.

### Known environment-specific notes

The following Windows-specific behaviors were discovered and worked
around during development; they don't affect functionality on other
platforms but are documented here for anyone continuing development on
Windows:

- Prisma cannot read `.env.local` on Windows — use `.env` instead.
- `npm run db:seed` (which uses `ts-node`) can fail on Windows; running
  it via `npx tsx prisma/seed.ts` is a reliable alternative.
- Setting a cookie via `response.cookies.set()` can be silently dropped
  when the response also has a JSON body — using
  `response.headers.set('Set-Cookie', rawString)` avoids this.
- `jose`'s `jwtVerify` can fail silently when run inside Next.js
  middleware (the Edge Runtime) on Windows. Middleware therefore performs
  only a lightweight, unverified decode of the token for routing
  decisions; every API route still performs full cryptographic
  verification via `verifyToken()` before trusting the token's contents.
- Custom `x-user-*` headers injected by middleware can fail to reach API
  routes in some Next.js 14 / Windows configurations, so API routes are
  written to be self-contained: each one reads and verifies the session
  cookie directly rather than relying on middleware-injected headers.
