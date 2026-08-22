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

### Fixed

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
