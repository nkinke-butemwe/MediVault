// src/app/api/admissions/[id]/discharge/route.ts
// POST /api/admissions/:id/discharge — discharge a current admission.
//
// Rules (all in src/lib/admissions.ts):
//   - only an ADMITTED stay can be discharged (a second discharge is a 409 and changes nothing)
//   - the discharge date cannot be before the admission date
//   - each outcome needs its own fields (home, transfer, left against advice, deceased)
//   - only a doctor may record a death
// Discharge never deletes or detaches linked prescriptions, lab orders, notes or vitals.
// If some are still open, the response carries warnings, but the discharge still goes ahead.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { DischargeAdmissionSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { buildDischargeWarnings, canTransition, canUseDisposition, validateDischarge } from '@/src/lib/admissions'
import { ADMISSION_DETAIL_INCLUDE, toClinicalView } from '@/src/lib/admission-views'
import { notifyPatientAndKin } from '@/src/lib/admission-access'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'DOCTOR' && role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const validation = DischargeAdmissionSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid discharge', details: validation.error.flatten() },
      { status: 400 }
    )
  }
  const input = validation.data

  // Permission rule: only a doctor may record a death (403, not 400)
  if (!canUseDisposition(role, input.disposition)) {
    return NextResponse.json(
      { success: false, error: 'Only a doctor can record a death' },
      { status: 403 }
    )
  }

  const admission = await prisma.admission.findUnique({ where: { id: params.id } })
  if (!admission) {
    return NextResponse.json({ success: false, error: 'Admission not found' }, { status: 404 })
  }

  // Only a current admission can move to DISCHARGED
  if (!canTransition(admission.status, 'DISCHARGED')) {
    return NextResponse.json(
      { success: false, error: `This admission is already ${admission.status.toLowerCase()}` },
      { status: 409 }
    )
  }

  // Check the discharge fields for this outcome
  const now = new Date()
  const dischargedAt = input.dischargedAt ?? now
  const problems = validateDischarge(
    {
      disposition: input.disposition,
      dischargedAt,
      finalDiagnosis: input.finalDiagnosis,
      dischargeSummary: input.dischargeSummary,
      dischargeInstructions: input.dischargeInstructions,
      transferDestination: input.transferDestination,
      timeOfDeath: input.timeOfDeath,
      causeOfDeath: input.causeOfDeath,
    },
    admission.admittedAt,
    now
  )
  if (problems.length > 0) {
    return NextResponse.json({ success: false, error: problems[0], details: problems }, { status: 400 })
  }

  // Save the discharge. "status: ADMITTED" in the where clause is the safety net for two doctors
  // discharging at the same moment: only one update can match, the other gets count 0.
  const discharged = await prisma.$transaction(async (tx: typeof prisma) => {
    const result = await tx.admission.updateMany({
      where: { id: params.id, status: 'ADMITTED' },
      data: {
        status: 'DISCHARGED',
        dischargedAt,
        dischargedById: actorId,
        dischargeDisposition: input.disposition,
        finalDiagnosis: input.finalDiagnosis,
        dischargeSummary: input.dischargeSummary ?? null,
        dischargeInstructions: input.dischargeInstructions ?? null,
        followUpDate: input.followUpDate ?? null,
        transferDestination: input.transferDestination ?? null,
        timeOfDeath: input.disposition === 'DECEASED' ? input.timeOfDeath : null,
        causeOfDeath: input.disposition === 'DECEASED' ? input.causeOfDeath : null,
      },
    })
    if (result.count !== 1) {
      return null
    }
    return tx.admission.findUnique({ where: { id: params.id }, include: ADMISSION_DETAIL_INCLUDE })
  })

  if (!discharged) {
    return NextResponse.json({ success: false, error: 'This admission is no longer current' }, { status: 409 })
  }

  // Look for open work linked to this stay. This only produces warnings.
  const [pendingLabOrders, undispensedPrescriptions] = await Promise.all([
    prisma.labOrder.count({ where: { admissionId: params.id, status: { in: ['ORDERED', 'COLLECTED'] } } }),
    prisma.prescription.count({ where: { admissionId: params.id, status: 'PENDING' } }),
  ])
  const warnings = buildDischargeWarnings({ pendingLabOrders, undispensedPrescriptions })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: admission.patientId,
    action: 'EDIT',
    resourceType: 'ADMISSION',
    resourceId: admission.id,
    details: { event: 'DISCHARGE', disposition: input.disposition, warnings: warnings.length },
    ...getRequestMeta(request),
  })

  // Tell the patient and consenting next of kin. A patient who has died is not notified.
  await notifyPatientAndKin(
    admission.patientId,
    {
      type: 'ADMISSION_DISCHARGED',
      title: 'Discharged from the clinic ward',
      body: `Admission ${admission.admissionNumber} has ended.`,
    },
    { includePatient: input.disposition !== 'DECEASED' }
  )

  return NextResponse.json({ success: true, data: toClinicalView(discharged), warnings })
}
