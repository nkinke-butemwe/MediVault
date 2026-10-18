// src/lib/datetime-input.ts
// Helpers for HTML date/time input boxes.
//
// A <input type="datetime-local"> gives text like "2026-10-16T08:30" with no timezone.
// The browser reads it in the viewer's own timezone (Lusaka at the clinic), and we convert it to a
// UTC ISO string ("2026-10-16T06:30:00.000Z") before sending it to the server, which stores UTC.

// Returns an ISO string, or undefined when the box was left empty (meaning "use the default").
export function localInputToIso(text: string): string | undefined {
  if (text.trim() === '') {
    return undefined
  }
  const date = new Date(text)
  if (isNaN(date.getTime())) {
    return undefined
  }
  return date.toISOString()
}
