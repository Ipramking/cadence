/**
 * Phone → payee directory. In a real deployment this maps a phone number to a
 * BMONI userId (so transfers resolve to `toUserId`). For the sandbox demo it's a
 * small seeded contact book; unknown numbers are payable as a new payee.
 */
const CONTACTS: Record<string, { name: string; userId?: string }> = {
  "8031234567": { name: "Chidi Okeke" },
  "9087654321": { name: "Amaka Eze" },
  "7011122233": { name: "Musa Bello" },
  "8090001122": { name: "Tunde Bakare" },
  "8145559090": { name: "Ngozi Umeh" },
};

/** Normalise a Nigerian number to its 10-digit core (e.g. 8031234567). */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length === 10 && ["7", "8", "9"].includes(d[0]!) ? d : null;
}

export function isPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

export interface Payee {
  name: string;
  phone?: string;
  userId?: string;
  known: boolean;
}

/** Resolve a recipient string (name or phone) to a payee. */
export function resolvePayee(recipient: string): Payee {
  const norm = normalizePhone(recipient);
  if (!norm) return { name: recipient.trim(), known: true };
  const pretty = "0" + norm;
  const hit = CONTACTS[norm];
  return hit
    ? { name: hit.name, phone: pretty, userId: hit.userId, known: true }
    : { name: "New payee", phone: pretty, known: false };
}
