/**
 * G7 Lot 4 - Chantier 2: Test migration SQLite ancienne base (step_id)
 *
 * Scénario:
 * 1. Créer une base "ancienne" SANS step_id (schéma pré-G7)
 * 2. Insérer des événements historiques (sans step_id)
 * 3. Fermer la base
 * 4. Réouvrir avec AuditLedger.init() → migration ALTER TABLE
 * 5. Vérifier: (a) step_id ajouté, (b) données historiques conservées,
 *    (c) nouveaux événements avec step_id acceptés, (d) ORDER BY rowid stable
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { AuditLedger } from '../../packages/audit-ledger/src/AuditLedger';

describe('G7 Lot 4 - Chantier 2: Migration SQLite (step_id)', () => {
  let testDbPath: string;
  let ledger: AuditLedger | null = null;

  beforeEach(() => {
    testDbPath = path.join(__dirname, `test-migration-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`);
  });

  afterEach(() => {
    if (ledger) {
      try { ledger.close(); } catch {}
    }
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('Chantier 2 - Migration ancienne base sans step_id', async () => {
    // ÉTAPE 1: Créer une base "ancienne" SANS step_id
    const oldDb = new Database(testDbPath);
    oldDb.exec(`
      CREATE TABLE audit_events (
        id          TEXT PRIMARY KEY,
        timestamp   TEXT NOT NULL,
        type        TEXT NOT NULL,
        mission_id  TEXT,
        actor       TEXT NOT NULL,
        data        TEXT NOT NULL,
        created_at  INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX idx_mission ON audit_events(mission_id);
    `);

    // ÉTAPE 2: Insérer des événements historiques (SANS step_id)
    const insert = oldDb.prepare(`
      INSERT INTO audit_events (id, timestamp, type, mission_id, actor, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run('evt-old-1', '2026-01-01T00:00:00Z', 'MISSION_CREATED', 'M1', 'raqib-core', '{"historical": true}');
    insert.run('evt-old-2', '2026-01-01T00:00:01Z', 'MISSION_STARTED', 'M1', 'raqib-core', '{"historical": true}');
    insert.run('evt-old-3', '2026-01-01T00:00:02Z', 'STEP_STARTED', 'M1', 'raqib-core', '{"step": "step-0", "historical": true}');

    const countBefore = oldDb.prepare('SELECT COUNT(*) as n FROM audit_events').get() as { n: number };
    expect(countBefore.n).toBe(3);

    // Vérifier que step_id n'existe PAS encore
    const hasStepIdBefore = oldDb
      .prepare("SELECT 1 FROM pragma_table_info('audit_events') WHERE name = 'step_id'")
      .get();
    expect(hasStepIdBefore).toBeUndefined();

    oldDb.close();

    // ÉTAPE 3 & 4: Réouvrir avec AuditLedger.init() → migration
    ledger = new AuditLedger(testDbPath);
    await ledger.init();

    // ÉTAPE 5a: Vérifier que step_id a été ajouté
    const newDb = new Database(testDbPath);
    const hasStepIdAfter = newDb
      .prepare("SELECT 1 FROM pragma_table_info('audit_events') WHERE name = 'step_id'")
      .get();
    expect(hasStepIdAfter).toEqual({ 1: 1 });

    // ÉTAPE 5b: Vérifier que les données historiques sont conservées
    const countAfter = newDb.prepare('SELECT COUNT(*) as n FROM audit_events').get() as { n: number };
    expect(countAfter.n).toBe(3);

    // ÉTAPE 5c: Insérer un NOUVEL événement AVEC step_id
    const insertWithStepId = newDb.prepare(`
      INSERT INTO audit_events (id, timestamp, type, mission_id, step_id, actor, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertWithStepId.run('evt-new-1', '2026-01-01T00:00:03Z', 'STEP_COMPLETED', 'M1', 'M1-step-0', 'raqib-core', '{"step": "step-0"}');

    const countFinal = newDb.prepare('SELECT COUNT(*) as n FROM audit_events').get() as { n: number };
    expect(countFinal.n).toBe(4);

    // ÉTAPE 5d: Vérifier ORDER BY created_at DESC, rowid DESC (stable)
    const rows = newDb.prepare('SELECT id, created_at, rowid FROM audit_events ORDER BY created_at DESC, rowid DESC').all() as any[];
    expect(rows.map(r => r.id)).toEqual(['evt-new-1', 'evt-old-3', 'evt-old-2', 'evt-old-1']);

    // ÉTAPE 5e: Vérifier via AuditLedger.query()
    const events = await ledger.query({ missionId: 'M1' });
    expect(events.length).toBe(4);
    expect(events.some(e => e.stepId === 'M1-step-0')).toBe(true);
    expect(events.some(e => e.data.historical === true)).toBe(true);

    newDb.close();
    ledger.close();
  });

  it('Chantier 2 - Migration idempotente (appel multiple de init())', async () => {
    // Créer une base "ancienne"
    const oldDb = new Database(testDbPath);
    oldDb.exec(`
      CREATE TABLE audit_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        mission_id TEXT,
        actor TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      );
    `);
    oldDb.close();

    // Appeler init() MULTIPLE fois → migration idempotente
    ledger = new AuditLedger(testDbPath);
    await ledger.init();
    await ledger.init(); // 2e appel
    await ledger.init(); // 3e appel

    // Vérifier qu'aucune erreur n'a été levée et que step_id existe
    const db = new Database(testDbPath);
    const hasStepId = db
      .prepare("SELECT 1 FROM pragma_table_info('audit_events') WHERE name = 'step_id'")
      .get();
    expect(hasStepId).toEqual({ 1: 1 });

    // Vérifier qu'aucune colonne step_id dupliquée n'a été créée
    const columns = db.prepare("PRAGMA table_info('audit_events')").all() as any[];
    const stepIdColumns = columns.filter(c => c.name === 'step_id');
    expect(stepIdColumns.length).toBe(1);

    db.close();
    ledger.close();
  });
});
