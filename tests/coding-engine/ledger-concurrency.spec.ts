import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createAuditLedger } from '../../coding-engine/packages/runtime/src/ledger';
import { spawn } from 'child_process';

/**
 * Ledger — concurrence multi-processus.
 *
 * Simule deux processus Node distincts qui appendent en parallèle
 * dans le même fichier JSONL. Vérifie :
 * - atomicité des lignes (pas de ligne tronquée/mélangée)
 * - intégrité de la chaîne HMAC après écritures concurrentes
 * - séquentialité préservée (chaque ligne a un seq unique)
 */

const baseDir = path.join(process.cwd(), 'data', 'test-ledger-concurrency');
const missionId = 'mission-concurrency-test';

function mkLedgerPath(name: string) {
  return path.join(baseDir, `${name}.jsonl`);
}

describe('AuditLedger — concurrence 2 processus', () => {
  let ledgerPath: string;

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    fs.mkdirSync(baseDir, { recursive: true });
    ledgerPath = mkLedgerPath('concurrent');
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('deux processus appendent en parallèle sans corrompre le ledger', async () => {
    // Script enfant : append N entrées dans le ledger
    const childScript = `
      const fs = require('fs');
      const path = require('path');
      const { createAuditLedger } = require('../../coding-engine/packages/runtime/src/ledger.ts');
      const ledgerPath = process.argv[2];
      const count = parseInt(process.argv[3], 10);
      const marker = process.argv[4];
      const ledger = createAuditLedger('mission-concurrency-test', ledgerPath, 'shared-secret');
      for (let i = 0; i < count; i++) {
        ledger.append({
          type: 'loop.applied',
          missionId: 'mission-concurrency-test',
          state: 'VERIFYING',
          patchHash: \`hash-\${marker}-\${i}\`,
          evidence: \`write \${i} from \${marker}\`,
        });
      }
      process.exit(0);
    `;

    const scriptPath = path.join(baseDir, 'child-append.js');
    fs.writeFileSync(scriptPath, childScript, 'utf8');

    // Lancer deux enfants en parallèle, chacun append 5 entrées
    const p1 = spawn('node', [scriptPath, ledgerPath, '5', 'P1']);
    const p2 = spawn('node', [scriptPath, ledgerPath, '5', 'P2']);

    const [r1, r2] = await Promise.all([
      new Promise<number>((resolve) => p1.on('exit', resolve)),
      new Promise<number>((resolve) => p2.on('exit', resolve)),
    ]);

    expect(r1).toBe(0);
    expect(r2).toBe(0);

    // Vérifier : 10 lignes, toutes valides JSON, seq uniques, intégrité OK
    const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(10);

    const entries = lines.map((l) => JSON.parse(l));
    const seqs = entries.map((e) => e.seq);
    expect(new Set(seqs).size).toBe(10); // tous uniques

    // Reconstruire un ledger dessus et vérifier l'intégrité
    const ledger = createAuditLedger(missionId, ledgerPath, 'shared-secret');
    const result = ledger.verifyIntegrity();
    expect(result.valid).toBe(true);
  });
});
