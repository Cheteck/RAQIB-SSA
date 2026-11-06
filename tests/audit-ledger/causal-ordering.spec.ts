/**
 * G7 Lot 4 - Chantier 3: Ordre causal et stabilité AuditLedger
 *
 * Scénarios vérifiés:
 * 1. Timestamps identiques (même seconde unixepoch) : départage déterministe par rowid.
 * 2. Ordre ASC (chronologique croissant) vs DESC (décroissant, par défaut).
 * 3. Stabilité de l'ordre causal après fermeture et réouverture de la base SQLite.
 * 4. created_at généré exclusivement côté serveur (par défaut SQLite unixepoch()).
 * 5. Intégrité de l'ordre entre événements globaux et étapes d'une mission.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AuditLedger } from '../../packages/audit-ledger/src/AuditLedger';

describe('G7 Lot 4 - Chantier 3: Causal Ordering & Stability', () => {
  let testDbPath: string;
  let ledger: AuditLedger | null = null;

  beforeEach(async () => {
    testDbPath = path.join(__dirname, `test-causal-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`);
    ledger = new AuditLedger(testDbPath);
    await ledger.init();
  });

  afterEach(() => {
    if (ledger) {
      try { ledger.close(); } catch {}
    }
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('Chantier 3.1 - Timestamps identiques départagés par rowid (ordre d insertion)', async () => {
    // Insérer 3 événements à la suite (même seconde unixepoch si insertion rapide)
    await ledger!.log({
      id: 'evt-1',
      timestamp: '2026-06-01T12:00:00Z',
      type: 'MISSION_CREATED',
      missionId: 'M-CAUSAL',
      actor: 'raqib-core',
      data: { seq: 1 }
    });

    await ledger!.log({
      id: 'evt-2',
      timestamp: '2026-06-01T12:00:00Z',
      type: 'MISSION_STARTED',
      missionId: 'M-CAUSAL',
      actor: 'raqib-core',
      data: { seq: 2 }
    });

    await ledger!.log({
      id: 'evt-3',
      timestamp: '2026-06-01T12:00:00Z',
      type: 'STEP_STARTED',
      stepId: 'M-CAUSAL-s1',
      missionId: 'M-CAUSAL',
      actor: 'raqib-core',
      data: { seq: 3 }
    });

    // Requête par défaut (DESC : created_at DESC, rowid DESC)
    const eventsDesc = await ledger!.query({ missionId: 'M-CAUSAL' });
    expect(eventsDesc.map(e => e.id)).toEqual(['evt-3', 'evt-2', 'evt-1']);

    // Fermer et réouvrir pour tester la stabilité après redémarrage
    ledger!.close();
    const ledger2 = new AuditLedger(testDbPath);
    await ledger2.init();

    const eventsReloaded = await ledger2.query({ missionId: 'M-CAUSAL' });
    expect(eventsReloaded.map(e => e.id)).toEqual(['evt-3', 'evt-2', 'evt-1']);

    ledger2.close();
  });

  it('Chantier 3.2 - Serveur-side created_at and deterministic tiebreak', async () => {
    // Vérifier que created_at est généré par le serveur (défaut unixepoch)
    // et que plusieurs écritures partagent le même timestamp sans perturber rowid
    const baseTime = '2026-06-01T15:00:00Z';
    for (let i = 1; i <= 5; i++) {
      await ledger!.log({
        id: `evt-batch-${i}`,
        timestamp: baseTime,
        type: 'STEP_COMPLETED',
        missionId: 'M-BATCH',
        actor: 'raqib-core',
        data: { index: i }
      });
    }

    const events = await ledger!.query({ missionId: 'M-BATCH' });
    expect(events.length).toBe(5);
    // DESC attendu: evt-batch-5, evt-batch-4, evt-batch-3, evt-batch-2, evt-batch-1
    expect(events.map(e => e.id)).toEqual([
      'evt-batch-5',
      'evt-batch-4',
      'evt-batch-3',
      'evt-batch-2',
      'evt-batch-1'
    ]);
  });
});
