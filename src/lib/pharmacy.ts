// src/lib/pharmacy.ts
// Pure helpers for the pharmacy flow (no database calls, so they are easy to test).
//
// The dispense route uses these to work out which inventory rows to take stock
// from when a prescription is dispensed — so the pharmacy inventory and the
// prescriptions are one connected system rather than two separate lists.

export interface PrescribedItem {
  name: string
  dose?: string
  duration?: string
  // Number of units (tablets, ml, ...) to dispense. Older prescriptions may not have one.
  quantity?: number
}

export interface InventoryRow {
  id: string
  drugName: string
  genericName: string | null
  quantity: number
  expiryDate: Date | null
}

export interface StockDeduction {
  inventoryId: string
  drugName: string
  quantity: number
}

export type StockPlan =
  | { ok: true; deductions: StockDeduction[]; warnings: string[] }
  | { ok: false; problems: string[] }

// Turns the medications JSON string stored on a Prescription into clean items.
// Anything that is not valid JSON, or has no drug name, is dropped.
export function parsePrescribedItems(json: string): PrescribedItem[] {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []

  const items: PrescribedItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const name = typeof e.name === 'string' ? e.name.trim() : ''
    if (!name) continue

    // The doctor form sends quantity as text ("10"); older data may be a number or empty
    const q = typeof e.quantity === 'string' ? Number(e.quantity.trim()) : e.quantity
    const quantity = typeof q === 'number' && Number.isInteger(q) && q > 0 ? q : undefined

    items.push({
      name,
      dose: typeof e.dose === 'string' ? e.dose : undefined,
      duration: typeof e.duration === 'string' ? e.duration : undefined,
      quantity,
    })
  }
  return items
}

function sameDrug(row: InventoryRow, prescribedName: string): boolean {
  const wanted = prescribedName.trim().toLowerCase()
  return (
    row.drugName.trim().toLowerCase() === wanted ||
    (row.genericName?.trim().toLowerCase() ?? '') === wanted
  )
}

// Works out how to fill every item of a prescription from the current stock.
//
// - A drug may be spread over several inventory rows (different batches), so
//   stock is taken from the batch that expires first (rows with no expiry last).
// - Expired batches and empty batches are never used.
// - If ANY item cannot be filled in full, nothing is planned (ok: false) so a
//   prescription is never half-dispensed.
// - Items with no quantity cannot be deducted; they are allowed but produce a warning.
export function planStockDeductions(
  items: PrescribedItem[],
  inventory: InventoryRow[],
  now: Date = new Date()
): StockPlan {
  const problems: string[] = []
  const warnings: string[] = []
  const deductions: StockDeduction[] = []

  if (items.length === 0) {
    return { ok: false, problems: ['This prescription has no valid medications.'] }
  }

  // Track what we have already promised, in case two items use the same drug
  const promised = new Map<string, number>()

  for (const item of items) {
    if (!item.quantity) {
      warnings.push(`No quantity was set for ${item.name}, so its stock was not adjusted.`)
      continue
    }

    const batches = inventory
      .filter((row) => sameDrug(row, item.name))
      .filter((row) => !row.expiryDate || row.expiryDate.getTime() > now.getTime())
      .map((row) => ({ row, available: row.quantity - (promised.get(row.id) ?? 0) }))
      .filter((b) => b.available > 0)
      .sort((a, b) => {
        const ax = a.row.expiryDate ? a.row.expiryDate.getTime() : Infinity
        const bx = b.row.expiryDate ? b.row.expiryDate.getTime() : Infinity
        return ax - bx
      })

    const totalAvailable = batches.reduce((sum, b) => sum + b.available, 0)
    if (batches.length === 0) {
      problems.push(`${item.name} is not in stock (or every batch has expired).`)
      continue
    }
    if (totalAvailable < item.quantity) {
      problems.push(`Not enough ${item.name}: need ${item.quantity}, only ${totalAvailable} in stock.`)
      continue
    }

    let remaining = item.quantity
    for (const { row, available } of batches) {
      if (remaining === 0) break
      const take = Math.min(available, remaining)
      deductions.push({ inventoryId: row.id, drugName: row.drugName, quantity: take })
      promised.set(row.id, (promised.get(row.id) ?? 0) + take)
      remaining -= take
    }
  }

  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, deductions, warnings }
}
