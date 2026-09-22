# MediVault

**A Role-Based Patient Portal for the University of Zambia Clinic**

> Final Year Project · University of Zambia · Department of Computing and Informatics · 2026  
> Authors: Butemwe Nkinke (2022082613) & Keila Ketlan Ngandu (2022009908)  
> Supervisor: Mrs. Monde Kabemba

---

## Overview

MediVault is a secure, web-based patient portal that digitises student medical records at the UNZA Clinic. It replaces physical ID checks with student number verification, introduces role-based access control, and provides a delegated consent mechanism for emergencies.

### Key Features

- **7 User Roles**: Patient, Receptionist, Doctor, Administrator, Next of Kin, Pharmacist, Lab Technician — each with distinct permissions
- **Student Number Verification**: Receptionists confirm eligibility by looking up a student number — no physical ID card required
- **Electronic Medical Profiles**: Structured records of diagnoses, medications, allergies, and visit history
- **Next of Kin Consent**: Patients pre-assign a trusted person to grant emergency treatment consent
- **Pharmacy**: Doctors send prescriptions to the pharmacy; dispensing one takes the stock out of the drug inventory (earliest-expiry batch first, never below zero) in a single database transaction
- **Laboratory**: Doctors order tests from a catalogue with reference ranges; the lab technician records results; the server flags each one (normal / low / high / critical); the doctor reviews and releases results before the patient can see them
- **Access Audit Logging**: Every access to patient data is logged — who, when, what action
- **JWT Authentication**: Tokens stored in httpOnly cookies (XSS-safe)
- **RBAC Middleware**: Every route is protected; users can only access their own dashboards. Every token's signature is verified — in the middleware and again inside every API route

---

## Prerequisites

- **Node.js** v20 or higher — [nodejs.org](https://nodejs.org)
- **PostgreSQL** 15 or higher — [postgresql.org](https://www.postgresql.org/download/)
- **npm** v9+ (comes with Node.js)

---

## Setup Instructions

### 1. Get the code

```bash
git clone https://github.com/nkinke-butemwe/MediVault.git
cd MediVault
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the PostgreSQL database

Open pgAdmin or psql and run:

```sql
CREATE DATABASE medivault;
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/medivault"
JWT_SECRET="paste_your_generated_secret_here"
```

### 5. Run database migrations

```bash
npx prisma migrate dev --name init
```

### 6. Seed demo data

```bash
npm run db:seed
```

> **Already have a database from an earlier version?** Run `npx prisma migrate dev` (it applies the new lab migration), then `npm run db:seed` again. The seed only adds what is missing, so it will not duplicate your existing users.

### 7. Start the development server

```bash
npm run dev
```

Open your browser at **http://localhost:3000**

---

## Demo Login Credentials

All accounts use the password: **`password123`**

| Role | Email | Student Number |
|------|-------|----------------|
| Administrator | `admin@unza.zm` | — |
| Receptionist | `receptionist@unza.zm` | — |
| Doctor 1 | `dr.mwanza@unza.zm` | — |
| Doctor 2 | `dr.phiri@unza.zm` | — |
| Patient 1 | `butemwe.nkinke@students.unza.zm` | `2022082613` |
| Patient 2 | `keila.ngandu@students.unza.zm` | `2022009908` |
| Patient 3 | `chanda.mutale@students.unza.zm` | `2021089932` |
| Patient 4 | `luyando.phiri@students.unza.zm` | `2023040215` |
| Patient 5 | `mwamba.sichone@students.unza.zm` | `2019031233` |
| Next of Kin | `kin.chanda@gmail.com` | — |
| Pharmacist | `pharmacist@unza.zm` | — |
| Lab Technician | `lab@unza.zm` | — |

**To test student verification**: log in as Receptionist, go to "Verify Student", and enter `2022082613`.

**To test the lab flow**: log in as Doctor 1 (`dr.mwanza@unza.zm`), search for a patient, open "Lab Tests" and order some tests. Then log in as the Lab Technician, record results in the Work Queue, go back to the Doctor, and use "Review results" to release them. The patient (for example Patient 1) will then see them under "Lab Results". The seed already contains one released result (Patient 1), one critical result waiting for review (Patient 3) and one order waiting in the lab queue (Patient 2).

---

## Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build optimised production bundle |
| `npm start` | Run the production build |
| `npm run lint` | Run Next.js ESLint checks |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Run pending database migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:reset` | Drop and recreate the database (destroys data) |

---

## Project Structure

```
medivault/
├── prisma/
│   ├── schema.prisma          # Database schema (models, enums, relations)
│   ├── seed.ts                # Demo data seeder
│   └── migrations/            # Auto-generated SQL migration files
├── src/
│   ├── app/
│   │   ├── api/               # REST API endpoints (Next.js Route Handlers)
│   │   │   ├── auth/          # login, logout, me
│   │   │   ├── patients/      # patient CRUD + search + verify-student
│   │   │   ├── medical-records/  # records CRUD
│   │   │   ├── visits/        # visits CRUD
│   │   │   ├── prescriptions/ # create + dispense (takes stock from inventory)
│   │   │   ├── pharmacy/      # drug inventory
│   │   │   ├── lab/           # test catalogue, orders, results, review
│   │   │   ├── next-of-kin/   # assignments + consent toggle
│   │   │   ├── access-logs/   # audit log read + CSV export
│   │   │   └── admin/users/   # admin user management
│   │   ├── login/             # Login page (+ landing page toggle)
│   │   ├── dashboard/
│   │   │   ├── layout.tsx     # Shared sidebar + header for all dashboards
│   │   │   ├── patient/       # Patient dashboard
│   │   │   ├── receptionist/  # Receptionist dashboard
│   │   │   ├── doctor/        # Doctor dashboard
│   │   │   ├── admin/         # Admin dashboard + users page + logs page
│   │   │   ├── pharmacy/      # Pharmacist dashboard
│   │   │   ├── lab/           # Lab technician dashboard
│   │   │   └── next-of-kin/   # Next of Kin dashboard
│   │   ├── layout.tsx         # Root HTML layout
│   │   ├── globals.css        # Tailwind CSS + global styles
│   │   └── page.tsx           # Root redirect (→ dashboard or login)
│   ├── components/lab/        # Lab order card + doctor lab panel
│   ├── hooks/
│   │   └── useAuth.ts         # Custom auth hook (fetch /api/auth/me)
│   ├── middleware.ts          # Next.js route protection + RBAC (must live in src/)
│   ├── lib/
│   │   ├── jwt.ts             # Sign + VERIFY the session token (Edge-safe)
│   │   ├── auth.ts            # Cookie helpers + getRoleAndActor() used by every API route
│   │   ├── pharmacy.ts        # Stock deduction planning for dispensing
│   │   ├── lab.ts             # Result flagging + reference-range helpers
│   │   ├── logger.ts          # Access logging utility + pino app logger
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── rate-limit.ts      # In-memory rate limiter for login
│   │   └── validators/        # Zod input validation schemas
│   └── types/
│       └── index.ts           # TypeScript type definitions
├── .env.example               # Environment variable template
├── next.config.js             # Next.js + security headers config
├── tailwind.config.js         # Tailwind CSS config
└── README.md

```

---

## Security Architecture

| Feature | Implementation |
|---------|----------------|
| Password hashing | bcrypt (12 salt rounds) |
| Session tokens | JWT in httpOnly cookies (XSS-safe); signature and expiry verified on every request |
| Route protection | `src/middleware.ts` on all /dashboard and /api routes, plus a second check inside every API route (`getRoleAndActor`) |
| Input validation | Zod schemas on all API endpoints |
| SQL injection | Prevented by Prisma ORM (parameterised queries) |
| Rate limiting | 5 login attempts per 15 minutes per IP |
| XSS | React escapes output by default |
| Audit trail | Every patient data access logged to AccessLog table |

---

## Future Enhancements

- Docker containerisation
- AES-256 encryption for sensitive fields at rest
- Native mobile apps (iOS and Android)
- Telemedicine / video consultation integration
- NHIMA/MOH integration
- Two-factor authentication
- Image attachments for X-rays and scanned lab reports
- Correcting a lab result after it is completed (currently results are final once an order is completed)
- Rejecting tokens of deactivated users straight away (today a deactivated user's session lasts until it expires, up to 8 hours)

---

*MediVault · University of Zambia Clinic · 2026*
