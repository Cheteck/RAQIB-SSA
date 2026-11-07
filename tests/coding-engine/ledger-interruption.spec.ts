import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createAuditLedger } from '../../coding-engine/packages/runtime/src/ledger';

/**
 * Ledger — reprise après interruption (crash).
 *
 * Simule un crash en tronquant la dernière ligne (écriture non commitée).
 * Vérifie :
 * - le constructeur ne lève PAS sur une ligne finale tronquée
 * - la ligne tronquée est ignorée (non comptée)
 * - l'intégrité est vérifiée sur les lignes complètes restantes
 * - un nouvel append reprend correctement après la dernière ligne valide
 */

const baseDir = path.join(process.cwd(), 'data', 'test-ledger-interruption');
const missionId = 'mission-interruption-test';

function mkLedgerPath(name: string) {
  return path.join(baseDir, `${name}.jsonl`);
}

describe('AuditLedger — interruption/crash', () => {
  let ledgerPath: string;

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    fs.mkdirSync(baseDir, { recursive: true });
    ledgerPath = mkLedgerPath('interrupt');
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('reprend après une ligne finale tronquée (crash mid-write)', () => {
    const ledger = createAuditLedger(missionId, ledgerPath, 'secret');
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });
    ledger.append({ type: 'loop.applied', missionId, state: 'VERIFYING' });

    // Tronquer la dernière ligne (simule crash en milieu d'append)
    const raw = fs.readFileSync(ledgerPath, 'utf8');
    const truncated = raw.slice(0, -20); // coupe 20 octets à la fin
    fs.writeFileSync(ledgerPath, truncated, 'utf8');

    // Re-ouvrir : ne doit pas lever, doit ignorer la ligne tronquée
    const ledger2 = createAuditLedger(missionId, ledgerPath, 'secret');
    const tail = ledger2.tail(1);
    expect(tail.length).toBe(1);
    expect(tail[0].type).toBe('loop.created');

    // Nouvel append reprend correctement après la dernière ligne valide.
    // La ligne tronquée a été discardée à la réouverture (tail(1) ci-dessus
    // ne contient que loop.created) : il reste donc 1 ligne valide + 1 append,
    // et la séquence reprend à 2 (pas 3).
    ledger2.append({ type: 'loop.blocked', missionId, state: 'BLOCKED' });
    const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2); // 1 valide (loop.created) + 1 nouvel append
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.type).toBe('loop.blocked');
    expect(last.seq).toBe(2);
  });

  it('lève sur une ligne tronquée INTERMÉDIAIRE (corruption)', () => {
    const ledger = createAuditLedger(missionId, ledgerPath, 'secret');
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });
    ledger.append({ type: 'loop.applied', missionId, state: 'VERIFYING' });
    ledger.append({ type: 'loop.blocked', missionId, state: 'BLOCKED' });

    // Tronquer la ligne du milieu (position 2 sur 3)
    const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n');
    lines[1] = lines[1].slice(0, -30); // tronque ligne 2
    fs.writeFileSync(ledgerPath, lines.join('\n'), 'utf8');

    // Re-ouvrir : doit lever (corruption intermédiaire)
    expect(() => createAuditLedger(missionId, ledgerPath, 'secret')).toThrow('Ledger corrompu');
  });
});
