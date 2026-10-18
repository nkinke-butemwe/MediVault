// src/lib/visits.ts
// Rules for how a clinic visit is allowed to move from one status to the next.
//
// A visit's normal life looks like this:
//
//   WAITING -> CHECKED_IN -> IN_CONSULTATION -> CHECKED_OUT
//
// A visit can also be CANCELLED, but only before the consultation starts.
// CHECKED_OUT and CANCELLED are final: once a visit gets there it can never
// be reopened or moved back (for example CHECKED_OUT -> WAITING is refused).

export type VisitStatus = 'WAITING' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'CHECKED_OUT' | 'CANCELLED'

// For each status, the list of statuses it is allowed to move TO.
// An empty list means the status is final.
export const VISIT_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  WAITING: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
}

// Returns true when a visit may move from `from` to `to`.
// Staying on the same status is NOT a transition, so it returns false.
export function canTransitionVisit(from: VisitStatus, to: VisitStatus): boolean {
  const allowedNextStatuses = VISIT_TRANSITIONS[from]
  return allowedNextStatuses.includes(to)
}

// Returns true when no further status change is possible (CHECKED_OUT or CANCELLED).
export function isFinalVisitStatus(status: VisitStatus): boolean {
  return VISIT_TRANSITIONS[status].length === 0
}
