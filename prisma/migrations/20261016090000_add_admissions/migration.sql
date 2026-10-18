-- Inpatient admissions module (Phase 1).
-- Hand-written to match prisma/schema.prisma, plus one partial unique index
-- that Prisma cannot describe in the schema file.

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED', 'CANCELLED');
CREATE TYPE "AdmissionPriority" AS ENUM ('EMERGENCY', 'URGENT', 'ROUTINE');
CREATE TYPE "AdmissionSource" AS ENUM ('WALK_IN', 'APPOINTMENT', 'REFERRAL', 'TRANSFER_IN', 'EMERGENCY');
CREATE TYPE "DischargeDisposition" AS ENUM ('HOME', 'TRANSFERRED_OUT', 'LEFT_AGAINST_ADVICE', 'DECEASED');
CREATE TYPE "AdmissionNoteKind" AS ENUM ('PROGRESS', 'WARD_ROUND', 'PROCEDURE', 'DIAGNOSIS_UPDATE');

-- AlterTable: optional link from existing tables (existing rows stay NULL)
ALTER TABLE "MedicalRecord" ADD COLUMN "admissionId" TEXT;
ALTER TABLE "Prescription" ADD COLUMN "admissionId" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN "admissionId" TEXT;

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admittingDoctorId" TEXT NOT NULL,
    "attendingDoctorId" TEXT NOT NULL,
    "visitId" TEXT,
    "priority" "AdmissionPriority" NOT NULL,
    "source" "AdmissionSource" NOT NULL,
    "referralFrom" TEXT,
    "presentingComplaint" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "provisionalDiagnosis" TEXT,
    "admissionNotes" TEXT,
    "examinationFindings" TEXT,
    "knownAllergies" TEXT,
    "existingConditions" TEXT,
    "currentMedication" TEXT,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDischargeAt" TIMESTAMP(3),
    "consentBy" TEXT NOT NULL,
    "consentKinAssignmentId" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "dischargedAt" TIMESTAMP(3),
    "dischargedById" TEXT,
    "dischargeDisposition" "DischargeDisposition",
    "finalDiagnosis" TEXT,
    "dischargeSummary" TEXT,
    "dischargeInstructions" TEXT,
    "followUpDate" TIMESTAMP(3),
    "transferDestination" TEXT,
    "timeOfDeath" TIMESTAMP(3),
    "causeOfDeath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdmissionNote" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "AdmissionNoteKind" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VitalsReading" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "pulse" INTEGER,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "respRate" INTEGER,
    "spo2" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "VitalsReading_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdmissionCounter" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdmissionCounter_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admission_admissionNumber_key" ON "Admission"("admissionNumber");
CREATE INDEX "Admission_patientId_admittedAt_idx" ON "Admission"("patientId", "admittedAt");
CREATE INDEX "Admission_status_admittedAt_idx" ON "Admission"("status", "admittedAt");
CREATE INDEX "AdmissionNote_admissionId_createdAt_idx" ON "AdmissionNote"("admissionId", "createdAt");
CREATE INDEX "VitalsReading_admissionId_recordedAt_idx" ON "VitalsReading"("admissionId", "recordedAt");
CREATE INDEX "MedicalRecord_admissionId_idx" ON "MedicalRecord"("admissionId");
CREATE INDEX "Prescription_admissionId_idx" ON "Prescription"("admissionId");
CREATE INDEX "LabOrder_admissionId_idx" ON "LabOrder"("admissionId");

-- The rule Prisma cannot express: a patient may have many admissions over time,
-- but at most ONE of them can be ADMITTED at once. The database enforces it,
-- so two requests arriving together cannot both succeed.
CREATE UNIQUE INDEX one_active_admission_per_patient ON "Admission"("patientId") WHERE status = 'ADMITTED';

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_admittingDoctorId_fkey" FOREIGN KEY ("admittingDoctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_attendingDoctorId_fkey" FOREIGN KEY ("attendingDoctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_dischargedById_fkey" FOREIGN KEY ("dischargedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdmissionNote" ADD CONSTRAINT "AdmissionNote_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdmissionNote" ADD CONSTRAINT "AdmissionNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VitalsReading" ADD CONSTRAINT "VitalsReading_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VitalsReading" ADD CONSTRAINT "VitalsReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
