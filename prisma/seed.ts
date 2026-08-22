// prisma/seed.ts
// Seeds the database with demo users for each role.
// All demo passwords are: password123

import { PrismaClient, Role, VisitStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

async function main() {
  console.log('🌱 Seeding MediVault database...')

  const passwordHash = await hashPassword('password123')

  // ─── Admin ──────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@unza.zm' },
    update: {},
    create: {
      email: 'admin@unza.zm',
      passwordHash,
      role: Role.ADMIN,
      fullName: 'System Administrator',
      phone: '+260977000001',
      isActive: true,
    },
  })
  console.log('✅ Created admin:', admin.email)

  // ─── Receptionist ────────────────────────────────────────────────────────
  const receptionist = await prisma.user.upsert({
    where: { email: 'receptionist@unza.zm' },
    update: {},
    create: {
      email: 'receptionist@unza.zm',
      passwordHash,
      role: Role.RECEPTIONIST,
      fullName: 'Mary Banda',
      phone: '+260977000002',
      isActive: true,
    },
  })
  console.log('✅ Created receptionist:', receptionist.email)

  // ─── Doctors ─────────────────────────────────────────────────────────────
  const doctor1 = await prisma.user.upsert({
    where: { email: 'dr.mwanza@unza.zm' },
    update: {},
    create: {
      email: 'dr.mwanza@unza.zm',
      passwordHash,
      role: Role.DOCTOR,
      fullName: 'Dr. James Mwanza',
      phone: '+260977000003',
      isActive: true,
    },
  })

  const doctor2 = await prisma.user.upsert({
    where: { email: 'dr.phiri@unza.zm' },
    update: {},
    create: {
      email: 'dr.phiri@unza.zm',
      passwordHash,
      role: Role.DOCTOR,
      fullName: 'Dr. Grace Phiri',
      phone: '+260977000004',
      isActive: true,
    },
  })
  console.log('✅ Created doctors:', doctor1.email, doctor2.email)

  // ─── Next of Kin ─────────────────────────────────────────────────────────
  const nextOfKin = await prisma.user.upsert({
    where: { email: 'kin.chanda@gmail.com' },
    update: {},
    create: {
      email: 'kin.chanda@gmail.com',
      passwordHash,
      role: Role.NEXT_OF_KIN,
      fullName: 'Patricia Chanda',
      phone: '+260977000005',
      isActive: true,
    },
  })
  console.log('✅ Created next of kin:', nextOfKin.email)

  // ─── Patients ─────────────────────────────────────────────────────────────
  const patient1 = await prisma.user.upsert({
    where: { email: 'butemwe.nkinke@students.unza.zm' },
    update: {},
    create: {
      email: 'butemwe.nkinke@students.unza.zm',
      studentNumber: '2022082613',
      passwordHash,
      role: Role.PATIENT,
      fullName: 'Butemwe Nkinke',
      phone: '+260977000006',
      isActive: true,
      patientProfile: {
        create: {
          dateOfBirth: new Date('2002-03-15'),
          bloodType: 'O+',
          emergencyContactName: 'Patricia Chanda',
          emergencyContactPhone: '+260977000005',
          address: 'UNZA Campus, Lusaka',
        },
      },
    },
  })

  const patient2 = await prisma.user.upsert({
    where: { email: 'keila.ngandu@students.unza.zm' },
    update: {},
    create: {
      email: 'keila.ngandu@students.unza.zm',
      studentNumber: '2022009908',
      passwordHash,
      role: Role.PATIENT,
      fullName: 'Keila Ketlan Ngandu',
      phone: '+260977000007',
      isActive: true,
      patientProfile: {
        create: {
          dateOfBirth: new Date('2001-07-22'),
          bloodType: 'A+',
          emergencyContactName: 'John Ngandu',
          emergencyContactPhone: '+260977000008',
          address: 'Woodlands, Lusaka',
        },
      },
    },
  })

  const patient3 = await prisma.user.upsert({
    where: { email: 'chanda.mutale@students.unza.zm' },
    update: {},
    create: {
      email: 'chanda.mutale@students.unza.zm',
      studentNumber: '2021089932',
      passwordHash,
      role: Role.PATIENT,
      fullName: 'Chanda Mutale',
      phone: '+260977000009',
      isActive: true,
      patientProfile: {
        create: {
          dateOfBirth: new Date('2000-06-18'),
          bloodType: 'B+',
          emergencyContactName: 'Joseph Mutale',
          emergencyContactPhone: '+260977000010',
          address: 'Chelstone, Lusaka',
        },
      },
    },
  })

  const patient4 = await prisma.user.upsert({
    where: { email: 'luyando.phiri@students.unza.zm' },
    update: {},
    create: {
      email: 'luyando.phiri@students.unza.zm',
      studentNumber: '2023040215',
      passwordHash,
      role: Role.PATIENT,
      fullName: 'Luyando Phiri',
      phone: '+260977000011',
      isActive: true,
      patientProfile: {
        create: {
          dateOfBirth: new Date('2003-01-25'),
          bloodType: 'AB+',
          emergencyContactName: 'Grace Phiri',
          emergencyContactPhone: '+260977000012',
          address: 'Kabulonga, Lusaka',
        },
      },
    },
  })

  const patient5 = await prisma.user.upsert({
    where: { email: 'mwamba.sichone@students.unza.zm' },
    update: {},
    create: {
      email: 'mwamba.sichone@students.unza.zm',
      studentNumber: '2019031233',
      passwordHash,
      role: Role.PATIENT,
      fullName: 'Mwamba Sichone',
      phone: '+260977000013',
      isActive: true,
      patientProfile: {
        create: {
          dateOfBirth: new Date('1999-09-07'),
          bloodType: 'O-',
          emergencyContactName: 'Ruth Sichone',
          emergencyContactPhone: '+260977000014',
          address: 'Meanwood, Lusaka',
        },
      },
    },
  })

  console.log('✅ Created patients:', patient1.email, patient2.email, patient3.email, patient4.email, patient5.email)

  // ─── Next of Kin Assignment ───────────────────────────────────────────────
  await prisma.nextOfKinAssignment.upsert({
    where: { id: 'seed-kin-assignment-1' },
    update: {},
    create: {
      id: 'seed-kin-assignment-1',
      patientId: patient1.id,
      kinUserId: nextOfKin.id,
      isActive: true,
      emergencyConsentGiven: true,
      consentGivenAt: new Date(),
    },
  })
  console.log('✅ Created next of kin assignment')

  // ─── Sample Medical Records ───────────────────────────────────────────────
  await prisma.medicalRecord.createMany({
    skipDuplicates: true,
    data: [
      {
        patientId: patient1.id,
        doctorId: doctor1.id,
        diagnosis: 'Acute Pharyngitis (Sore Throat)',
        medications: JSON.stringify([
          { name: 'Amoxicillin', dose: '500mg', duration: '7 days' },
          { name: 'Paracetamol', dose: '1g', duration: 'As needed for pain' },
        ]),
        allergies: 'Penicillin (rash)',
        notes: 'Patient presented with 3-day history of sore throat and mild fever.',
        visitDate: new Date('2026-01-15'),
        followUpDate: new Date('2026-01-22'),
      },
      {
        patientId: patient1.id,
        doctorId: doctor2.id,
        diagnosis: 'Tension Headache',
        medications: JSON.stringify([
          { name: 'Ibuprofen', dose: '400mg', duration: 'As needed, max 3x daily' },
        ]),
        allergies: 'Penicillin (rash)',
        notes: 'Likely stress-related. Advised on hydration and sleep hygiene.',
        visitDate: new Date('2026-02-20'),
      },
      {
        patientId: patient2.id,
        doctorId: doctor1.id,
        diagnosis: 'Allergic Rhinitis',
        medications: JSON.stringify([
          { name: 'Cetirizine', dose: '10mg', duration: 'Once daily, ongoing' },
          { name: 'Fluticasone nasal spray', dose: '2 puffs each nostril', duration: 'Morning' },
        ]),
        allergies: 'Dust mites, pollen',
        notes: 'Seasonal allergy. Patient to avoid dusty environments.',
        visitDate: new Date('2026-03-05'),
        followUpDate: new Date('2026-04-05'),
      },
      {
        patientId: patient3.id,
        doctorId: doctor1.id,
        diagnosis: 'Malaria (Uncomplicated)',
        medications: JSON.stringify([
          { name: 'Artemether-Lumefantrine', dose: '80/480mg', duration: '3 days' },
          { name: 'Paracetamol', dose: '1g', duration: 'Every 6 hours for fever' },
        ]),
        allergies: 'None known',
        notes: 'RDT positive for malaria. Patient to rest and maintain hydration.',
        visitDate: new Date('2026-04-10'),
        followUpDate: new Date('2026-04-17'),
      },
      {
        patientId: patient4.id,
        doctorId: doctor2.id,
        diagnosis: 'Iron Deficiency Anaemia',
        medications: JSON.stringify([
          { name: 'Ferrous Sulphate', dose: '200mg', duration: '3 months' },
          { name: 'Folic Acid', dose: '5mg', duration: '3 months' },
        ]),
        allergies: 'None known',
        notes: 'Haemoglobin 9.2 g/dL. Dietary advice given — increase leafy vegetables and red meat.',
        visitDate: new Date('2026-05-02'),
        followUpDate: new Date('2026-08-02'),
      },
      {
        patientId: patient5.id,
        doctorId: doctor1.id,
        diagnosis: 'Hypertension (Stage 1)',
        medications: JSON.stringify([
          { name: 'Amlodipine', dose: '5mg', duration: 'Once daily, long-term' },
        ]),
        allergies: 'Sulfonamides',
        notes: 'BP 148/92 on two readings. Lifestyle modification advised alongside medication.',
        visitDate: new Date('2026-05-20'),
        followUpDate: new Date('2026-06-20'),
      },
    ],
  })
  console.log('✅ Created sample medical records')

  // ─── Sample Visits ────────────────────────────────────────────────────────
  await prisma.visit.createMany({
    skipDuplicates: true,
    data: [
      {
        patientId: patient1.id,
        reason: 'Sore throat and fever',
        vitals: 'BP: 118/76, Temp: 38.1°C, Weight: 68kg, Pulse: 88bpm',
        status: VisitStatus.CHECKED_OUT,
        createdById: receptionist.id,
        visitDate: new Date('2026-01-15'),
        doctorNotes: 'Diagnosed with acute pharyngitis. Prescribed antibiotics.',
      },
      {
        patientId: patient1.id,
        reason: 'Persistent headache',
        vitals: 'BP: 120/80, Temp: 36.8°C, Weight: 68kg, Pulse: 72bpm',
        status: VisitStatus.CHECKED_OUT,
        createdById: receptionist.id,
        visitDate: new Date('2026-02-20'),
        doctorNotes: 'Tension headache. Conservative management recommended.',
      },
      {
        patientId: patient2.id,
        reason: 'Nasal congestion and sneezing',
        vitals: 'BP: 110/70, Temp: 36.9°C, Weight: 58kg, Pulse: 76bpm',
        status: VisitStatus.CHECKED_OUT,
        createdById: receptionist.id,
        visitDate: new Date('2026-03-05'),
        doctorNotes: 'Allergic rhinitis confirmed. Long-term antihistamine prescribed.',
      },
      {
        patientId: patient3.id,
        reason: 'Fever and chills',
        vitals: 'BP: 105/68, Temp: 39.2°C, Weight: 72kg, Pulse: 102bpm',
        status: VisitStatus.CHECKED_OUT,
        createdById: receptionist.id,
        visitDate: new Date('2026-04-10'),
        doctorNotes: 'Malaria confirmed via RDT. Treatment commenced.',
      },
      {
        patientId: patient4.id,
        reason: 'Fatigue and dizziness',
        vitals: 'BP: 108/65, Temp: 36.6°C, Weight: 55kg, Pulse: 94bpm',
        status: VisitStatus.CHECKED_OUT,
        createdById: receptionist.id,
        visitDate: new Date('2026-05-02'),
        doctorNotes: 'Anaemia confirmed. Iron supplementation started.',
      },
      {
        patientId: patient5.id,
        reason: 'Routine blood pressure check',
        vitals: 'BP: 148/92, Temp: 36.7°C, Weight: 85kg, Pulse: 80bpm',
        status: VisitStatus.CHECKED_OUT,
        createdById: receptionist.id,
        visitDate: new Date('2026-05-20'),
        doctorNotes: 'Stage 1 hypertension. Medication and lifestyle changes advised.',
      },
      {
        patientId: patient1.id,
        reason: 'Follow-up check',
        vitals: 'BP: 116/74, Temp: 36.7°C, Weight: 68kg, Pulse: 70bpm',
        status: VisitStatus.WAITING,
        createdById: receptionist.id,
        visitDate: new Date(),
      },
    ],
  })
  console.log('✅ Created sample visits')

  // ─── Sample Access Logs ───────────────────────────────────────────────────
  await prisma.accessLog.createMany({
    skipDuplicates: true,
    data: [
      {
        accessedByUserId: doctor1.id,
        targetPatientId: patient1.id,
        action: 'VIEW',
        resourceType: 'MEDICAL_RECORD',
        details: JSON.stringify({ reason: 'Clinic consultation' }),
        ipAddress: '127.0.0.1',
        timestamp: new Date('2026-01-15T09:30:00'),
      },
      {
        accessedByUserId: doctor1.id,
        targetPatientId: patient1.id,
        action: 'CREATE',
        resourceType: 'MEDICAL_RECORD',
        details: JSON.stringify({ diagnosis: 'Acute Pharyngitis' }),
        ipAddress: '127.0.0.1',
        timestamp: new Date('2026-01-15T10:00:00'),
      },
      {
        accessedByUserId: receptionist.id,
        targetPatientId: patient1.id,
        action: 'VIEW',
        resourceType: 'PROFILE',
        details: JSON.stringify({ reason: 'Student verification' }),
        ipAddress: '127.0.0.1',
        timestamp: new Date('2026-01-15T09:00:00'),
      },
    ],
  })
  console.log('✅ Created sample access logs')

  console.log('\n🎉 Seeding complete!')
  console.log('\nDemo login credentials (all passwords: password123):')
  console.log('  Admin:        admin@unza.zm')
  console.log('  Receptionist: receptionist@unza.zm')
  console.log('  Doctor 1:     dr.mwanza@unza.zm')
  console.log('  Doctor 2:     dr.phiri@unza.zm')
  console.log('  Patient 1:    butemwe.nkinke@students.unza.zm    (student: 2022082613)')
  console.log('  Patient 2:    keila.ngandu@students.unza.zm      (student: 2022009908)')
  console.log('  Patient 3:    chanda.mutale@students.unza.zm     (student: 2021089932)')
  console.log('  Patient 4:    luyando.phiri@students.unza.zm     (student: 2023040215)')
  console.log('  Patient 5:    mwamba.sichone@students.unza.zm    (student: 2019031233)')
  console.log('  Next of Kin:  kin.chanda@gmail.com')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })