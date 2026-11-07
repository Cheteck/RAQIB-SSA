import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AuditLedger, createAuditLedger } from '../../coding-engine/packages/runtime/src/ledger';

/**
 * Ledger d'audit — tests de sécurité P1.
 *
 * Vérifie : chaîne de confiance HMAC, détection de falsification,
 * idempotence du replay, lecture incrémentale (JSONL), et replay de crash.
 */

const baseDir = path.join(process.cwd(), 'data', 'test-ledger');
const missionId = 'mission-ledger-test';

function mkLedgerPath(name: string) {
  return path.join(baseDir, `${name}.jsonl`);
}

describe('AuditLedger — chaîne de confiance', () => {
  let ledgerPath: string;
  let ledger: AuditLedger;

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    fs.mkdirSync(baseDir, { recursive: true });
    ledgerPath = mkLedgerPath('chain');
    ledger = createAuditLedger(missionId, ledgerPath, 'test-secret');
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('écrit une ligne JSONL par entrée, séq incrémental', () => {
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });
    ledger.append({ type: 'loop.planning', missionId, state: 'PLANNING', patchHash: 'abc' });
    ledger.append({ type: 'loop.applied', missionId, state: 'VERIFYING' });

    const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(3);

    const e0 = JSON.parse(lines[0]);
    expect(e0.seq).toBe(1);
    expect(e0.type).toBe('loop.created');
    expect(e0.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(e0.prevSignature).toMatch(/^[a-f0-9]{64}$/);

    const e2 = JSON.parse(lines[2]);
    expect(e2.seq).toBe(3);
    expect(e2.type).toBe('loop.applied');
  });

  it('vérifie l\'intégrité d\'un ledger valide', () => {
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });
    ledger.append({ type: 'loop.applied', missionId, state: 'VERIFYING' });

    const result = ledger.verifyIntegrity();
    expect(result.valid).toBe(true);
  });

  it('détecte une falsification du contentHash', () => {
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });
    ledger.append({ type: 'loop.applied', missionId, state: 'VERIFYING' });

    // Corrompre le contentHash de la ligne 1
    let lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
    const e0 = JSON.parse(lines[0]);
    e0.contentHash = '0'.repeat(64);
    lines[0] = JSON.stringify(e0);
    fs.writeFileSync(ledgerPath, lines.join('\n') + '\n', 'utf8');

    const result = ledger.verifyIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('contentHash');
      expect(result.atSeq).toBe(1);
    }
  });

  it('détecte une rupture de chaîne HMAC', () => {
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });
    ledger.append({ type: 'loop.applied', missionId, state: 'VERIFYING' });

    // Corrompre le prevSignature de la ligne 2
    let lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
    const e1 = JSON.parse(lines[1]);
    e1.prevSignature = '0'.repeat(64);
    lines[1] = JSON.stringify(e1);
    fs.writeFileSync(ledgerPath, lines.join('\n') + '\n', 'utf8');

    const result = ledger.verifyIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('prevSignature');
      expect(result.atSeq).toBe(2);
    }
  });

  it('détecte l\'ajout d\'une ligne orpheline', () => {
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });

    // Injecter une ligne qui ne signe pas sur le precedent
    const fakeLine = JSON.stringify({
      seq: 2,
      timestamp: new Date().toISOString(),
      type: 'loop.applied',
      missionId,
      state: 'VERIFYING',
      contentHash: '0'.repeat(64),
      prevSignature: '0'.repeat(64),
    });
    fs.appendFileSync(ledgerPath, fakeLine + '\n', 'utf8');

    const result = ledger.verifyIntegrity();
    expect(result.valid).toBe(false);
  });

  it('reprend un ledger existant et continue la séquence', () => {
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });

    // Re-ouvrir le même ledger
    const ledger2 = createAuditLedger(missionId, ledgerPath, 'test-secret');
    ledger2.append({ type: 'loop.applied', missionId, state: 'VERIFYING' });

    const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2);

    const e1 = JSON.parse(lines[1]);
    expect(e1.seq).toBe(2);

    // Intégrité globale toujours valide
    const result = ledger2.verifyIntegrity();
    expect(result.valid).toBe(true);
  });

  it('refuse un secret différent pour la vérification', () => {
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });
    ledger.append({ type: 'loop.applied', missionId, state: 'VERIFYING' });

    // Vérifier avec un secret différent
    const other = createAuditLedger(missionId, ledgerPath, 'wrong-secret');
    const result = other.verifyIntegrity();
    expect(result.valid).toBe(false);
  });
});

describe('AuditLedger — lecture incrémentale', () => {
  let ledgerPath: string;

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    fs.mkdirSync(baseDir, { recursive: true });
    ledgerPath = mkLedgerPath('tail');
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('tail(n) retourne les n dernières entrées', () => {
    const ledger = createAuditLedger(missionId, ledgerPath, 'key');
    for (let i = 0; i < 10; i++) {
      ledger.append({
        type: i % 2 === 0 ? 'loop.planning' : 'loop.applied',
        missionId,
        state: i % 2 === 0 ? 'PLANNING' : 'VERIFYING',
        patchHash: `hash-${i}`,
      });
    }

    const last3 = ledger.tail(3);
    expect(last3.length).toBe(3);
    expect(last3[0].seq).toBe(8);
    expect(last3[2].seq).toBe(10);
  });

  it('tail sur un ledger vide retourne []', () => {
    const ledger = createAuditLedger(missionId, ledgerPath, 'key');
    expect(ledger.tail(5)).toEqual([]);
  });
});

describe('AuditLedger — sécurité P1', () => {
  let ledgerPath: string;

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    fs.mkdirSync(baseDir, { recursive: true });
    ledgerPath = mkLedgerPath('security');
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('rejoue un scenario apply → rollback avec chaîne intègre', () => {
    const ledger = createAuditLedger(missionId, ledgerPath, 'p1-secret');

    // Phase APPLYING
    ledger.append({
      type: 'loop.applying',
      missionId,
      state: 'APPLYING',
      patchHash: 'real-hash',
      approvalId: 'apr-1',
      contextDigest: 'ctx-abc',
      files: ['src/a.ts', 'src/b.ts'],
    });

    // Échec + rollback
    ledger.append({
      type: 'applier.rollback',
      missionId,
      state: 'BLOCKED',
      patchHash: 'real-hash',
      approvalId: 'apr-1',
      files: ['src/a.ts'],
      evidence: 'rollback appliqué (1 fichier(s) appliqué(s)) — cause : écriture échouée',
    });

    const result = ledger.verifyIntegrity();
    expect(result.valid).toBe(true);

    // Replay avec re-ouverture
    const ledger2 = createAuditLedger(missionId, ledgerPath, 'p1-secret');
    expect(ledger2.tail(2)[1].type).toBe('applier.rollback');
    expect(ledger2.verifyIntegrity().valid).toBe(true);
  });

  it('un ledger vide est valide (pas de crash)', () => {
    const ledger = createAuditLedger(missionId, ledgerPath, 'secret');
    const result = ledger.verifyIntegrity();
    expect(result.valid).toBe(true);
  });

  it('un fichier supprimé rend la vérification invalide (ou vide)', () => {
    const ledger = createAuditLedger(missionId, ledgerPath, 'secret');
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });
    fs.rmSync(ledgerPath);
    // Re-open sur fichier absent → ledger vide, valide
    const ledger2 = createAuditLedger(missionId, ledgerPath, 'secret');
    expect(ledger2.verifyIntegrity().valid).toBe(true);
  });

  it('idempotence : deux vérifications consécutives donnent le même résultat', () => {
    const ledger = createAuditLedger(missionId, ledgerPath, 'secret');
    ledger.append({ type: 'loop.created', missionId, state: 'PLANNING' });
    ledger.append({ type: 'loop.applied', missionId, state: 'VERIFYING' });

    const r1 = ledger.verifyIntegrity();
    const r2 = ledger.verifyIntegrity();
    expect(r1).toEqual(r2);
  });
});
