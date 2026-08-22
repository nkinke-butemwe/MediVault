// src/types/index.ts
// Central type definitions used throughout MediVault

// ─── Enums (mirror Prisma enums for frontend use) ──────────────────────────

export type Role = 'PATIENT' | 'RECEPTIONIST' | 'DOCTOR' | 'ADMIN' | 'NEXT_OF_KIN'
export type VisitStatus = 'WAITING' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'CHECKED_OUT' | 'CANCELLED'

// ─── Auth ─────────────────────────────────────────────────────────────────

// The data encoded inside a JWT token
export interface JWTPayload {
  userId: string
  email: string
  role: Role
  fullName: string
}

// The user object returned from /api/auth/me
export interface AuthUser {
  id: string
  email: string
  studentNumber: string | null
  role: Role
  fullName: string
  phone: string | null
  isActive: boolean
  createdAt: string
}

// ─── Users ────────────────────────────────────────────────────────────────

export interface UserWithProfile extends AuthUser {
  patientProfile?: PatientProfile | null
}

export interface PatientProfile {
  userId: string
  dateOfBirth: string | null
  bloodType: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  address: string | null
}

// ─── Medical Records ──────────────────────────────────────────────────────

// A single medication entry stored in the medications JSON field
export interface Medication {
  name: string
  dose: string
  duration: string
}

export interface MedicalRecord {
  id: string
  patientId: string
  doctorId: string
  doctor: Pick<AuthUser, 'id' | 'fullName' | 'email'>
  diagnosis: string
  medications: Medication[] | null
  allergies: string | null
  notes: string | null
  visitDate: string
  followUpDate: string | null
  createdAt: string
  updatedAt: string
}

// ─── Visits ───────────────────────────────────────────────────────────────

export interface Visit {
  id: string
  patientId: string
  patient: Pick<AuthUser, 'id' | 'fullName' | 'email' | 'studentNumber'>
  visitDate: string
  reason: string
  vitals: string | null
  doctorNotes: string | null
  status: VisitStatus
  createdById: string
  createdBy: Pick<AuthUser, 'id' | 'fullName'>
  createdAt: string
  updatedAt: string
}

// ─── Next of Kin ──────────────────────────────────────────────────────────

export interface NextOfKinAssignment {
  id: string
  patientId: string
  patient: Pick<AuthUser, 'id' | 'fullName' | 'email'>
  kinUserId: string
  nextOfKin: Pick<AuthUser, 'id' | 'fullName' | 'email' | 'phone'>
  isActive: boolean
  delegatedAt: string
  emergencyConsentGiven: boolean
  consentGivenAt: string | null
  updatedAt: string
}

// ─── Access Logs ──────────────────────────────────────────────────────────

export interface AccessLog {
  id: string
  accessedByUserId: string
  accessedBy: Pick<AuthUser, 'id' | 'fullName' | 'email' | 'role'>
  targetPatientId: string | null
  targetPatient: Pick<AuthUser, 'id' | 'fullName' | 'email'> | null
  action: string
  resourceType: string
  resourceId: string | null
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  timestamp: string
}

// ─── API Responses ────────────────────────────────────────────────────────

// Standard success response wrapper
export interface ApiSuccess<T> {
  success: true
  data: T
  message?: string
}

// Standard error response wrapper
export interface ApiError {
  success: false
  error: string
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Pagination ───────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
