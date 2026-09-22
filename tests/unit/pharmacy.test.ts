// tests/unit/pharmacy.test.ts
//
// Tests for src/lib/pharmacy.ts — how dispensing a prescription takes stock
// out of the drug inventory.

import { describe, it, expect } from 'vitest'
import { parsePrescribedItems, planStockDeductions, type InventoryRow } from '@/src/lib/pharmacy'
import { CreatePrescriptionSchema } from '@/src/lib/validators'

const NOW = new Date('2026-09-21T10:00:00Z')
const future = new Date('2027-06-01T00:00:00Z')
const soon = new Date('2026-11-01T00:00:00Z')
const past = new Date('2026-01-01T00:00:00Z')

const row = (id: string, drugName: string, quantity: number, expiryDate: Date | null = future, genericName: string | null = null): InventoryRow =>
  ({ id, drugName, genericName, quantity, expiryDate })

describe('parsePrescribedItems', () => {
  it('reads the JSON stored on a prescription, turning text quantities into numbers', () => {
    const json = JSON.stringify([{ name: 'Amoxicillin', dose: '500mg', duration: '5 days', quantity: '15' }])
    expect(parsePrescribedItems(json)).toEqual([
      { name: 'Amoxicillin', dose: '500mg', duration: '5 days', quantity: 15 },
    ])
  })

  it('leaves quantity undefined when it is blank, zero, negative or not a whole number', () => {
    const json = JSON.stringify([
      { name: 'A', quantity: '' }, { name: 'B', quantity: 0 }, { name: 'C', quantity: -3 }, { name: 'D', quantity: 2.5 },
    ])
    expect(parsePrescribedItems(json).map((i) => i.quantity)).toEqual([undefined, undefined, undefined, undefined])
  })

  it('returns an empty list for invalid JSON or the wrong shape', () => {
    expect(parsePrescribedItems('not json')).toEqual([])
    expect(parsePrescribedItems('{"name":"x"}')).toEqual([])
    expect(parsePrescribedItems(JSON.stringify([{ dose: 'no name' }, null, 5]))).toEqual([])
  })
})

describe('planStockDeductions', () => {
  it('takes the prescribed quantity from a matching drug (case-insensitive)', () => {
    const plan = planStockDeductions([{ name: 'amoxicillin', quantity: 15 }], [row('a', 'Amoxicillin', 100)], NOW)
    expect(plan).toEqual({ ok: true, deductions: [{ inventoryId: 'a', drugName: 'Amoxicillin', quantity: 15 }], warnings: [] })
  })

  it('matches on the generic name too', () => {
    const plan = planStockDeductions([{ name: 'Acetaminophen', quantity: 10 }], [row('p', 'Paracetamol', 50, future, 'Acetaminophen')], NOW)
    expect(plan.ok).toBe(true)
  })

  it('fails when there is not enough stock, and says how much is there', () => {
    const plan = planStockDeductions([{ name: 'Amoxicillin', quantity: 50 }], [row('a', 'Amoxicillin', 20)], NOW)
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.problems[0]).toContain('need 50, only 20 in stock')
  })

  it('fails when the drug is not in the inventory at all', () => {
    const plan = planStockDeductions([{ name: 'Coartem', quantity: 6 }], [row('a', 'Amoxicillin', 100)], NOW)
    expect(plan.ok).toBe(false)
  })

  it('never uses an expired batch', () => {
    const plan = planStockDeductions([{ name: 'Amoxicillin', quantity: 5 }], [row('old', 'Amoxicillin', 500, past)], NOW)
    expect(plan.ok).toBe(false)
  })

  it('takes from the batch that expires first, then the next', () => {
    const inventory = [row('later', 'Amoxicillin', 50, future), row('sooner', 'Amoxicillin', 10, soon)]
    const plan = planStockDeductions([{ name: 'Amoxicillin', quantity: 25 }], inventory, NOW)
    expect(plan).toMatchObject({
      ok: true,
      deductions: [
        { inventoryId: 'sooner', quantity: 10 },
        { inventoryId: 'later', quantity: 15 },
      ],
    })
  })

  it('plans nothing at all if any one item cannot be filled (no half-dispensing)', () => {
    const plan = planStockDeductions(
      [{ name: 'Amoxicillin', quantity: 5 }, { name: 'Coartem', quantity: 6 }],
      [row('a', 'Amoxicillin', 100)],
      NOW
    )
    expect(plan.ok).toBe(false)
  })

  it('does not promise the same stock twice when a drug is listed twice', () => {
    const plan = planStockDeductions(
      [{ name: 'Paracetamol', quantity: 8 }, { name: 'Paracetamol', quantity: 8 }],
      [row('p', 'Paracetamol', 10)],
      NOW
    )
    expect(plan.ok).toBe(false)
  })

  it('allows an item with no quantity but warns that stock was not adjusted', () => {
    const plan = planStockDeductions([{ name: 'ORS' }], [], NOW)
    expect(plan).toEqual({ ok: true, deductions: [], warnings: ['No quantity was set for ORS, so its stock was not adjusted.'] })
  })

  it('fails for a prescription with no valid medications', () => {
    expect(planStockDeductions([], [row('a', 'Amoxicillin', 10)], NOW).ok).toBe(false)
  })
})

describe('CreatePrescriptionSchema', () => {
  const valid = { patientId: 'p1', medications: [{ name: 'Amoxicillin', dose: '500mg', duration: '5 days', quantity: '15' }] }

  it('accepts a prescription and turns the text quantity into a number', () => {
    const parsed = CreatePrescriptionSchema.parse(valid)
    expect(parsed.medications[0].quantity).toBe(15)
  })

  it('rejects a missing, zero or non-numeric quantity', () => {
    for (const quantity of ['', '0', 'abc', '-2', '1.5']) {
      const result = CreatePrescriptionSchema.safeParse({ ...valid, medications: [{ ...valid.medications[0], quantity }] })
      expect(result.success, `quantity "${quantity}"`).toBe(false)
    }
  })

  it('rejects an empty medication list', () => {
    expect(CreatePrescriptionSchema.safeParse({ patientId: 'p1', medications: [] }).success).toBe(false)
  })
})
