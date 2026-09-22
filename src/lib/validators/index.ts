// src/lib/validators/index.ts
// Zod schemas for validating all API input.
// Using Zod means we get automatic type safety + clear error messages.

import { z } from 'zod'

// Every role the system knows about (the admin screen can now create all of them,
// including PHARMACIST and LAB_TECHNICIAN which were missing from these schemas).
const ROLE_VALUES = [
  'PATIENT',
  'RECEPTIONIST',
  'DOCTOR',
  'ADMIN',
  'NEXT_OF_KIN',
  'PHARMACIST',
  'LAB_TECHNICIAN',
] as const

// ─── Auth ─────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  // identifier can be either an email address or a student number
  identifier: z.string().min(1, 'Email or student number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(ROLE_VALUES, {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
})

// ─── Users ────────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  studentNumber: z.string().optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLE_VALUES),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional().nullable(),
  // Patient profile fields (only required when role is PATIENT)
  dateOfBirth: z.string().optional().nullable(),
  bloodType: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
})

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  role: z.enum(ROLE_VALUES).optional(),
})

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

// ─── Medical Records ──────────────────────────────────────────────────────

const MedicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dose: z.string().min(1, 'Dose is required'),
  duration: z.string().min(1, 'Duration is required'),
})

export const CreateMedicalRecordSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  diagnosis: z.string().min(3, 'Diagnosis must be at least 3 characters'),
  medications: z.array(MedicationSchema).optional(),
  allergies: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  visitDate: z.string().optional(), // ISO date string
  followUpDate: z.string().optional().nullable(),
})

export const UpdateMedicalRecordSchema = CreateMedicalRecordSchema.partial().omit({
  patientId: true,
})

// ─── Visits ───────────────────────────────────────────────────────────────

export const CreateVisitSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  reason: z.string().min(3, 'Reason for visit is required'),
  vitals: z.string().optional().nullable(),
  visitDate: z.string().optional(),
})

export const UpdateVisitSchema = z.object({
  status: z.enum(['WAITING', 'CHECKED_IN', 'IN_CONSULTATION', 'CHECKED_OUT', 'CANCELLED']).optional(),
  vitals: z.string().optional().nullable(),
  doctorNotes: z.string().optional().nullable(),
  reason: z.string().optional(),
})

// ─── Next of Kin ──────────────────────────────────────────────────────────

export const CreateNextOfKinSchema = z.object({
  // The patient assigns a next of kin either by their user ID (if they have a MediVault account)
  // or by providing their contact details
  kinUserId: z.string().min(1, 'Next of kin user ID is required'),
})

export const UpdateNextOfKinSchema = z.object({
  isActive: z.boolean().optional(),
  emergencyConsentGiven: z.boolean().optional(),
})

// ─── Patient Profile ──────────────────────────────────────────────────────

export const UpdatePatientProfileSchema = z.object({
  dateOfBirth: z.string().optional().nullable(),
  bloodType: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  // User-level fields that patients can update
  phone: z.string().optional().nullable(),
})

// ─── Prescriptions ────────────────────────────────────────────────────────

const PrescribedMedicationSchema = z.object({
  name: z.string().trim().min(1, 'Medication name is required'),
  dose: z.string().trim().min(1, 'Dose is required'),
  duration: z.string().trim().min(1, 'Duration is required'),
  // The pharmacy takes this many units out of stock, so it must be a real number.
  // The form sends text ("10"), so coerce it.
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .positive('Quantity must be at least 1'),
})

export const CreatePrescriptionSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  medications: z.array(PrescribedMedicationSchema).min(1, 'At least one medication is required'),
  medicalRecordId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// ─── Lab ──────────────────────────────────────────────────────────────────

export const CreateLabOrderSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  testIds: z.array(z.string().min(1)).min(1, 'Select at least one test').max(20, 'Too many tests in one order'),
  priority: z.enum(['ROUTINE', 'URGENT']).default('ROUTINE'),
  clinicalNotes: z.string().trim().max(1000).optional().nullable(),
})

// One result row entered by the lab technician: a number OR a text result
export const LabResultEntrySchema = z
  .object({
    itemId: z.string().min(1),
    valueNumeric: z.number().finite().optional().nullable(),
    valueText: z.string().trim().min(1).max(100).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((r) => (r.valueNumeric ?? null) !== null || (r.valueText ?? null) !== null, {
    message: 'Enter a result value',
  })

export const EnterLabResultsSchema = z.object({
  results: z.array(LabResultEntrySchema).min(1, 'Enter at least one result'),
})

export const LabOrderActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('collect') }),
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('review'), doctorComment: z.string().trim().max(1000).optional().nullable() }),
])
