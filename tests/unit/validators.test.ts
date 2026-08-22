// tests/unit/validators.test.ts
//
// Tests for src/lib/validators/index.ts — the Zod schemas that check
// every piece of data coming into the API routes before it touches
// the database. Good validation here is what stops bad or malicious
// data from ever reaching patient records.

import { describe, it, expect } from 'vitest'
import {
  LoginSchema,
  CreateUserSchema,
  CreateMedicalRecordSchema,
  CreateVisitSchema,
  UpdateVisitSchema,
} from '@/src/lib/validators'

describe('LoginSchema', () => {
  it('accepts a valid login payload', () => {
    const result = LoginSchema.safeParse({
      identifier: 'student@unza.zm',
      password: 'password123',
      role: 'PATIENT',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a password that is too short', () => {
    const result = LoginSchema.safeParse({
      identifier: 'student@unza.zm',
      password: '123', // fewer than 6 characters
      role: 'PATIENT',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a role that is not one of the five recognized roles', () => {
    const result = LoginSchema.safeParse({
      identifier: 'student@unza.zm',
      password: 'password123',
      role: 'SUPER_ADMIN', // not a real role in this app
    })
    expect(result.success).toBe(false)
  })

  it('rejects a payload missing the identifier field entirely', () => {
    const result = LoginSchema.safeParse({
      password: 'password123',
      role: 'PATIENT',
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateUserSchema', () => {
  it('accepts a valid new-patient payload', () => {
    const result = CreateUserSchema.safeParse({
      email: 'newstudent@unza.zm',
      password: 'password123',
      role: 'PATIENT',
      fullName: 'Mwansa Chilufya',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email address', () => {
    const result = CreateUserSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
      role: 'PATIENT',
      fullName: 'Mwansa Chilufya',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a full name that is only one character long', () => {
    const result = CreateUserSchema.safeParse({
      email: 'newstudent@unza.zm',
      password: 'password123',
      role: 'PATIENT',
      fullName: 'M',
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateMedicalRecordSchema', () => {
  it('accepts a valid medical record with medications', () => {
    const result = CreateMedicalRecordSchema.safeParse({
      patientId: 'patient-123',
      diagnosis: 'Seasonal flu',
      medications: [{ name: 'Paracetamol', dose: '500mg', duration: '5 days' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a diagnosis that is too short to be meaningful', () => {
    const result = CreateMedicalRecordSchema.safeParse({
      patientId: 'patient-123',
      diagnosis: 'ok', // fewer than 3 characters
    })
    expect(result.success).toBe(false)
  })

  it('rejects a medication that is missing its dose', () => {
    const result = CreateMedicalRecordSchema.safeParse({
      patientId: 'patient-123',
      diagnosis: 'Seasonal flu',
      medications: [{ name: 'Paracetamol', duration: '5 days' }], // no dose
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateVisitSchema', () => {
  it('accepts a valid walk-in visit', () => {
    const result = CreateVisitSchema.safeParse({
      patientId: 'patient-123',
      reason: 'Fever and headache',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a visit with no reason given', () => {
    const result = CreateVisitSchema.safeParse({
      patientId: 'patient-123',
      reason: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateVisitSchema', () => {
  it('accepts a valid status transition', () => {
    const result = UpdateVisitSchema.safeParse({ status: 'CHECKED_IN' })
    expect(result.success).toBe(true)
  })

  it('rejects a status value that does not exist', () => {
    const result = UpdateVisitSchema.safeParse({ status: 'ON_HOLIDAY' })
    expect(result.success).toBe(false)
  })

  it('accepts an empty object, since every field is optional', () => {
    const result = UpdateVisitSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
