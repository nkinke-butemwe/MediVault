# MediVault

**A Role-Based Patient Portal for the University of Zambia Clinic**

> Final Year Project · University of Zambia · Department of Computing and Informatics · 2026  
> Authors: Butemwe Nkinke (2022082613) & Keila Ketlan Ngandu (2022009908)  
> Supervisor: Mrs. Monica Kabemba

---

## Overview

MediVault is a secure, web-based patient portal that digitises student medical records at the UNZA Clinic. It replaces physical ID checks with student number verification, introduces role-based access control, and provides a delegated consent mechanism for emergencies.

### Key Features

- **5 User Roles**: Patient, Receptionist, Doctor, Administrator, Next of Kin — each with distinct permissions
- **Student Number Verification**: Receptionists confirm eligibility by looking up a student number — no physical ID card required
- **Electronic Medical Profiles**: Structured records of diagnoses, medications, allergies, and visit history
- **Next of Kin Consent**: Patients pre-assign a trusted person to grant emergency treatment consent
- **Access Audit Logging**: Every access to patient data is logged — who, when, what action
- **JWT Authentication**: Tokens stored in httpOnly cookies (XSS-safe)
- **RBAC Middleware**: Every route is protected; users can only access their own dashboards

---
[![Open in VS Code](https://img.shields.io/badge/Open%20in-VS%20Code-007ACC?logo=visualstudiocode)](https://vscode.dev/github/nkinke-butemwe/MediVault)
## Prerequisites

- **Node.js** v20 or higher — [nodejs.org](https://nodejs.org)
- **PostgreSQL** 15 or higher — [postgresql.org](https://www.postgresql.org/download/)
- **npm** v9+ (comes with Node.js)

---

## Setup Instructions

### 1. Get the code

```bash
# If you have git:
git clone <your-repo-url>
cd medivault

# Or just unzip the project folder and open a terminal there
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the PostgreSQL database

Open your PostgreSQL client (pgAdmin, DBeaver, or the `psql` terminal) and run:

```sql
CREATE DATABASE medivault;
```

### 4. Configure environment variables

```bash
# Copy the example file to create your local config
cp .env.example .env.local
```

Now open `.env.local` in a text editor and set these two values:

```env
# Replace "yourpassword" with your PostgreSQL password
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/medivault"

# Replace with a long random string — paste this in:
# Run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET="paste_your_generated_secret_here"
```

### 5. Run database migrations

This creates all the tables defined in `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name init
```

### 6. Seed demo data

This populates the database with demo users for each role:

```bash
npm run db:seed
```

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
| Next of Kin | `kin.chanda@gmail.com` | — |

**To test student verification**: log in as Receptionist, go to "Verify Student", and enter `2022082613`.

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
| `npm run db:reset` | Drop and recreate the database (⚠️ destroys data) |

---

## Building for Production

```bash
# Build the optimised production bundle
npm run build

# Start the production server
npm start
```

For production, also set `NODE_ENV=production` in your `.env.local`.

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
│   │   │   └── next-of-kin/   # Next of Kin dashboard
│   │   ├── layout.tsx         # Root HTML layout
│   │   ├── globals.css        # Tailwind CSS + global styles
│   │   └── page.tsx           # Root redirect (→ dashboard or login)
│   ├── hooks/
│   │   └── useAuth.ts         # Custom auth hook (fetch /api/auth/me)
│   ├── lib/
│   │   ├── auth.ts            # JWT sign/verify + cookie helpers
│   │   ├── logger.ts          # Access logging utility + pino app logger
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── rate-limit.ts      # In-memory rate limiter for login
│   │   └── validators/        # Zod input validation schemas
│   └── types/
│       └── index.ts           # TypeScript type definitions
├── middleware.ts               # Next.js route protection + RBAC
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
| Session tokens | JWT in httpOnly cookies (XSS-safe) |
| Route protection | Next.js middleware on all /dashboard and /api routes |
| Input validation | Zod schemas on all API endpoints |
| SQL injection | Prevented by Prisma ORM (parameterised queries) |
| Rate limiting | 5 login attempts per 15 minutes per IP |
| Security headers | X-Frame-Options, CSP, HSTS, etc. (next.config.js) |
| XSS | React escapes output by default |
| Audit trail | Every patient data access logged to AccessLog table |

---

## Deployment to UNZA IT

### Environment Variables (Server)

On the production server, set these environment variables (do NOT use `.env.local`):

```bash
export DATABASE_URL="postgresql://medivault_user:STRONG_PASSWORD@db-host:5432/medivault_prod"
export JWT_SECRET="your_64_char_random_hex_string"
export NODE_ENV="production"
```

### Database Migration (First Deploy)

```bash
npx prisma migrate deploy   # Run migrations without prompting
```

### Reverse Proxy (Nginx Example)

```nginx
server {
    listen 80;
    server_name clinic.unza.zm;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name clinic.unza.zm;

    ssl_certificate /etc/ssl/certs/clinic.unza.zm.crt;
    ssl_certificate_key /etc/ssl/private/clinic.unza.zm.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Process Manager (PM2)

```bash
npm install -g pm2
npm run build
pm2 start npm --name "medivault" -- start
pm2 save
pm2 startup    # Auto-start on server reboot
```

---

## Future Enhancements

These features are outside the current scope but planned for future versions:

- **Docker containerisation** — package the app + database into containers for easier deployment
- **AES-256 encryption** — encrypt sensitive fields (diagnoses, medications) at rest in the database
- **Native mobile apps** — iOS and Android apps for patients and staff
- **Telemedicine** — video consultation integration for remote care
- **NHIMA/MOH integration** — connect with national health systems
- **Appointment booking** — patient-facing appointment scheduling
- **Prescription printing** — formatted PDF prescriptions
- **Two-factor authentication** — SMS or email OTP as a second login factor
- **Image attachments** — scan/upload lab results and X-rays to medical records

---

## References

See `MEDIVAULT_PROJECT_PROPOSAL.md` for the full academic references list.

---

*MediVault · University of Zambia Clinic · 2026*
