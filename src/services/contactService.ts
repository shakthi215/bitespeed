import db from "../db/database";
import { Contact, IdentifyRequest, ConsolidatedContact } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

function findByEmailOrPhone(
  email: string | null,
  phoneNumber: string | null
): Contact[] {
  const conditions: string[] = [];
  const params: (string | null)[] = [];

  if (email)       { conditions.push("email = ?");       params.push(email); }
  if (phoneNumber) { conditions.push("phoneNumber = ?"); params.push(phoneNumber); }
  if (!conditions.length) return [];

  return db
    .prepare(
      `SELECT * FROM Contact
       WHERE (${conditions.join(" OR ")}) AND deletedAt IS NULL
       ORDER BY createdAt ASC`
    )
    .all(...params) as Contact[];
}

function getCluster(primaryId: number): Contact[] {
  return db
    .prepare(
      `SELECT * FROM Contact
       WHERE (id = ? OR linkedId = ?) AND deletedAt IS NULL
       ORDER BY createdAt ASC`
    )
    .all(primaryId, primaryId) as Contact[];
}

function getPrimaryOf(contact: Contact): Contact {
  if (contact.linkPrecedence === "primary") return contact;
  const parent = db
    .prepare("SELECT * FROM Contact WHERE id = ? AND deletedAt IS NULL")
    .get(contact.linkedId!) as Contact | undefined;
  if (!parent) return contact;
  return getPrimaryOf(parent);
}

function insertContact(
  email: string | null,
  phoneNumber: string | null,
  linkedId: number | null,
  linkPrecedence: "primary" | "secondary"
): Contact {
  const res = db
    .prepare(
      `INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .run(email, phoneNumber, linkedId, linkPrecedence);

  return db
    .prepare("SELECT * FROM Contact WHERE id = ?")
    .get(res.lastInsertRowid) as Contact;
}

function demotePrimary(oldPrimaryId: number, newPrimaryId: number): void {
  // Demote the old primary itself
  db.prepare(
    `UPDATE Contact SET linkPrecedence = 'secondary', linkedId = ?, updatedAt = datetime('now')
     WHERE id = ?`
  ).run(newPrimaryId, oldPrimaryId);

  // Re-point all its old secondaries to the new true primary
  db.prepare(
    `UPDATE Contact SET linkedId = ?, updatedAt = datetime('now')
     WHERE linkedId = ? AND id != ?`
  ).run(newPrimaryId, oldPrimaryId, oldPrimaryId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Response builder
// ─────────────────────────────────────────────────────────────────────────────

function buildResponse(cluster: Contact[]): ConsolidatedContact {
  const primary = cluster.find((c) => c.linkPrecedence === "primary")!;
  const secondaries = cluster.filter((c) => c.linkPrecedence === "secondary");

  const emails: string[] = [];
  const phones: string[] = [];

  // Primary values always go first
  if (primary.email)       emails.push(primary.email);
  if (primary.phoneNumber) phones.push(primary.phoneNumber);

  for (const c of secondaries) {
    if (c.email       && !emails.includes(c.email))       emails.push(c.email);
    if (c.phoneNumber && !phones.includes(c.phoneNumber)) phones.push(c.phoneNumber);
  }

  return {
    primaryContatctId:    primary.id,
    emails,
    phoneNumbers:         phones,
    secondaryContactIds:  secondaries.map((c) => c.id),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported function
// ─────────────────────────────────────────────────────────────────────────────

export function identifyContact(req: IdentifyRequest): ConsolidatedContact {
  const email       = req.email?.trim()             || null;
  const phoneNumber = req.phoneNumber?.toString().trim() || null;

  // 1. Find all contacts that match email OR phone
  const matches = findByEmailOrPhone(email, phoneNumber);

  // 2. No matches → brand-new primary contact
  if (!matches.length) {
    const created = insertContact(email, phoneNumber, null, "primary");
    return buildResponse([created]);
  }

  // 3. Resolve the true primary for each match, collect unique primaries
  const primaries = Array.from(
    new Map(matches.map(getPrimaryOf).map((p) => [p.id, p])).values()
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const [truePrimary, ...olderPrimaries] = primaries;

  // 4. Merge: demote any extra primaries under the oldest one
  for (const extra of olderPrimaries) {
    demotePrimary(extra.id, truePrimary.id);
  }

  // 5. Re-fetch full merged cluster
  let cluster = getCluster(truePrimary.id);

  // 6. If request carries brand-new info → create a new secondary
  const knownEmails  = new Set(cluster.map((c) => c.email).filter(Boolean));
  const knownPhones  = new Set(cluster.map((c) => c.phoneNumber).filter(Boolean));

  const hasNewEmail  = email       && !knownEmails.has(email);
  const hasNewPhone  = phoneNumber && !knownPhones.has(phoneNumber);

  if (hasNewEmail || hasNewPhone) {
    insertContact(email, phoneNumber, truePrimary.id, "secondary");
    cluster = getCluster(truePrimary.id);
  }

  return buildResponse(cluster);
}
