import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "identity.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Performance + safety
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create table + indexes on first run
db.exec(`
  CREATE TABLE IF NOT EXISTS Contact (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phoneNumber     TEXT,
    email           TEXT,
    linkedId        INTEGER,
    linkPrecedence  TEXT NOT NULL CHECK(linkPrecedence IN ('primary','secondary')),
    createdAt       DATETIME NOT NULL DEFAULT (datetime('now')),
    updatedAt       DATETIME NOT NULL DEFAULT (datetime('now')),
    deletedAt       DATETIME,
    FOREIGN KEY (linkedId) REFERENCES Contact(id)
  );

  CREATE INDEX IF NOT EXISTS idx_email    ON Contact(email);
  CREATE INDEX IF NOT EXISTS idx_phone    ON Contact(phoneNumber);
  CREATE INDEX IF NOT EXISTS idx_linkedId ON Contact(linkedId);
`);

export default db;
