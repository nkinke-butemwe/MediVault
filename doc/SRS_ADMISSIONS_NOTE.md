# SRS and Traceability Note: Inpatient Admissions (Phase 1)

Paste-ready text for `MediVault_Reverse_Engineered_SRS_and_Audit.docx` and
`MediVault_Requirements_Traceability_Matrix.xlsx`. Those two files were **not** edited.

Requirement IDs use the prefix `FR-ADM` (functional) and `NFR-ADM` (non-functional). Rename them to
match the numbering scheme already used in your SRS if it differs.

## 1. Scope sentence (for the SRS introduction or a new section)

The system shall support inpatient admissions: an inpatient stay or short-stay observation under a
doctor. A patient may have many admissions over time but at most one with status ADMITTED. Wards and
beds are out of scope for this release; admissions are fully usable without them.

## 2. Functional requirements

| ID | Requirement | Roles |
| --- | --- | --- |
| FR-ADM-01 | A doctor shall be able to admit a registered, active patient, giving the presenting complaint, reason, priority, source and who gave consent. | Doctor, Admin |
| FR-ADM-02 | The system shall give every admission a unique number in the form ADM-YYYY-NNNNNN. | System |
| FR-ADM-03 | The system shall refuse a second ADMITTED admission for the same patient (HTTP 409). | System |
| FR-ADM-04 | Where the next of kin gave consent, the system shall accept it only if that next-of-kin assignment is active and has emergency consent on record. | System |
| FR-ADM-05 | An admission shall move only from ADMITTED to DISCHARGED or CANCELLED. It shall never be reactivated. A second discharge or cancel shall be refused (HTTP 409). | System |
| FR-ADM-06 | Discharge shall require a final diagnosis and the fields for the chosen outcome: Home (summary, instructions), Transferred out (destination, summary), Left against advice (summary), Deceased (time and cause of death). | Doctor, Admin |
| FR-ADM-07 | Only a doctor shall be able to discharge a patient as Deceased. | Doctor |
| FR-ADM-08 | The discharge date shall not be before the admission date or in the future; the admission date shall not be in the future; the expected discharge shall not be before the admission date. | System |
| FR-ADM-09 | A cancelled admission shall require a reason, remain visible in the history and be shown as cancelled. | Doctor, Admin |
| FR-ADM-10 | While a patient is admitted, doctors and admins shall be able to add append-only notes and structured vitals readings. Notes and vitals shall be refused once the admission is discharged or cancelled. | Doctor, Admin |
| FR-ADM-11 | Discharging shall not delete or detach linked prescriptions, lab orders, notes or vitals. It shall warn about pending lab orders and undispensed prescriptions without blocking. | System |
| FR-ADM-12 | Lab orders and prescriptions shall be linkable to the current admission. Patients shall still see lab results only after the doctor releases them. | Doctor |
| FR-ADM-13 | The system shall show a patient's admission history with length of stay and a 30-day readmission flag. | Doctor, Admin, Patient |
| FR-ADM-14 | The system shall provide statistics: current admissions, discharges today, completed admissions, average length of stay, readmission count. | Doctor, Admin |
| FR-ADM-15 | The patient and the consenting next of kin shall be notified when an admission starts, ends or is cancelled. | System |
| FR-ADM-16 | The admitting and attending doctors shall become part of the patient's care team. | System |
| FR-ADM-17 | The patient care timeline shall show admitted, discharged and cancelled events. | Patient, Doctor |

## 3. Access control requirements

| ID | Requirement |
| --- | --- |
| FR-ADM-AC-01 | Doctor and admin: full clinical detail (admin cannot record a death). |
| FR-ADM-AC-02 | Receptionist: census view only (patient, admission number, dates, status). No diagnoses, notes, vitals or discharge summaries. |
| FR-ADM-AC-03 | Patient: read-only access to their own admissions, including discharge summary and instructions. Never another patient's. |
| FR-ADM-AC-04 | Next of kin: admitted or discharged status and dates only, for their assigned patient, only while the assignment is active with consent given. |
| FR-ADM-AC-05 | Pharmacist and lab technician: no access. |
| FR-ADM-AC-06 | A caller who is not logged in shall receive HTTP 401. |

## 4. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-ADM-01 (Audit) | Every create, view of clinical detail, update, discharge and cancel shall be written to the access log. Updates log field names only, never clinical text. |
| NFR-ADM-02 (Integrity) | The one-active-admission rule shall be enforced by the database (partial unique index `one_active_admission_per_patient`), and admission numbers by a per-year counter row updated inside the creating transaction. |
| NFR-ADM-03 (Integrity) | Multi-step writes shall be atomic (single database transaction). |
| NFR-ADM-04 (Time) | Timestamps shall be stored in UTC and displayed in Africa/Lusaka as dd/mm/yyyy. |
| NFR-ADM-05 (Security) | Every API route shall verify the caller's token via `getRoleAndActor()` and shall not trust request headers. |
| NFR-ADM-06 (Maintainability) | Business rules shall live in pure functions (`src/lib/admissions.ts`) with unit tests. |

## 5. Traceability (requirement to code to tests)

| Requirement | Implementation | Tests |
| --- | --- | --- |
| FR-ADM-01, 02 | `src/app/api/admissions/route.ts` (POST), `src/lib/admissions.ts` (`nextAdmissionNumber`) | `admission-routes.test.ts` "POST /api/admissions (admit)"; `admissions-logic.test.ts` "admission numbers" |
| FR-ADM-03 | `route.ts` step 7 and unique-violation handling; migration index | `admission-routes.test.ts` "refuses a second ACTIVE admission", "turns a database unique violation"; verified on PostgreSQL 16 (see below) |
| FR-ADM-04 | `route.ts` step 5; `CreateAdmissionSchema` | `admission-routes.test.ts` "admitting with next of kin consent" |
| FR-ADM-05 | `canTransition`; guarded `updateMany` in `discharge/route.ts`, `cancel/route.ts` | `admissions-logic.test.ts` "canTransition"; `admission-routes.test.ts` "refuses to discharge twice", "race" |
| FR-ADM-06, 08 | `validateDischarge`, `validateAdmissionDates` | `admissions-logic.test.ts` "validateDischarge", "validateAdmissionDates"; routes "discharge before the admission date" |
| FR-ADM-07 | `canUseDisposition`; `discharge/route.ts` | `admission-routes.test.ts` "lets only a DOCTOR record a death" |
| FR-ADM-09 | `cancel/route.ts`; `AdmissionBadges.tsx` | `admission-routes.test.ts` "POST /api/admissions/:id/cancel" |
| FR-ADM-10 | `notes/route.ts`, `vitals/route.ts` | `admission-routes.test.ts` "notes and vitals"; `route-safety.test.ts` "notes route has no edit or delete handler" |
| FR-ADM-11 | `buildDischargeWarnings`; `discharge/route.ts` | `admissions-logic.test.ts` "buildDischargeWarnings"; routes "discharges anyway but warns" |
| FR-ADM-12 | `lab/orders/route.ts`, `prescriptions/route.ts` (`admissionId`) | `admission-routes.test.ts` "ordering lab tests from an admission" |
| FR-ADM-13 | `patients/[id]/admissions/route.ts`, `flagReadmissions` | `admission-routes.test.ts` "GET /api/patients/:id/admissions"; `admissions-logic.test.ts` readmission tests |
| FR-ADM-14 | `admissions/stats/route.ts` | `admission-routes.test.ts` "GET /api/admissions/stats" |
| FR-ADM-15 | `admission-access.ts` (`notifyPatientAndKin`) | `admission-routes.test.ts` "notifies the patient and the consenting next of kin" |
| FR-ADM-16 | `src/lib/care-team.ts` | `admissions-logic.test.ts` "care team includes admission doctors" |
| FR-ADM-17 | `src/lib/timeline.ts`, `/api/timeline` | `admissions-logic.test.ts` "timeline with admissions" |
| FR-ADM-AC-01 to 06 | `admission-views.ts`; role checks in every route | `admission-routes.test.ts` "access control", "GET /api/admissions/:id"; `admissions-logic.test.ts` "admission views" |
| NFR-ADM-01 | `logAccess` calls in every admissions route | `admission-routes.test.ts` (access log assertions) |
| NFR-ADM-02 | `prisma/migrations/20261016090000_add_admissions/migration.sql` | Applied to a scratch PostgreSQL 16 database: a second ADMITTED row for one patient is rejected, and a new one is accepted after discharge |
| NFR-ADM-05 | `getRoleAndActor()` in every route | `route-safety.test.ts` |

## 6. Known limitations to state in the audit

- Wards, beds, medication orders and medication administration are not part of this release (planned
  as later phases).
- There is no nurse role. Doctors and admins record notes and vitals.
- NFR-ADM-04: dates are displayed with the existing format helpers, which use the viewer's browser
  timezone. This is correct for browsers set to Lusaka time; it is not forced to Africa/Lusaka for
  viewers elsewhere.
- Clearing a field on update (for example removing an expected discharge date) is not supported: an
  empty box is treated as "not sent".
- Admissions can be created from the UI only by doctors. An admin can use the API but must name an
  attending doctor.
