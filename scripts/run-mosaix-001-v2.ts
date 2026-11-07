/**
 * MOSAIX-001 v2 — Diagnostic READ-ONLY du dépôt cible, orchestré par RAQIB.
 *
 * Différences avec la v1 (requalifiée GOVERNANCE_SMOKE_TEST) :
 *  - cible explicite : MOSAIX_REPO_PATH (jamais process.cwd())
 *  - accès fichiers via PathGuard + FileTool, git via GitTool (read-only)
 *  - pas de BUILD/TEST/TYPECHECK sur la cible (aucune commande exécutée)
 *  - vérification métier non vacueuse : rapport existant, package.json cible
 *    lisible, working tree identique au baseline (GIT_STATUS_UNCHANGED)
 */
import path from 'path';
import fs from 'fs';
import { RaqibRuntime } from '../services/runtime/src/RaqibRuntime';
import { GitTool } from '../packages/tool-gateway/src/GitTool';
import { setTimeout } from 'node:timers/promises';

const MISSION_ID = 'MOSAIX-001-V2';
const MAX_RUNTIME_MS = 10 * 60 * 1000;

async function main() {
  const target = path.resolve(process.env.MOSAIX_REPO_PATH || 'D:\\Projets\\atelierpro');
  if (!fs.existsSync(target)) throw new Error(`Cible absente : ${target}`);

  // Baseline Git AVANT toute exécution.
  const git = new GitTool();
  const baselineSha = await git.getCurrentCommitSha(target);
  const baselineStatus = await git.getStatus(target);

  console.log(`🎯 Cible : ${target}`);
  console.log(`📌 Baseline HEAD : ${baselineSha}`);
  console.log(`📌 Baseline status : ${baselineStatus.trim() ? 'arbre déjà modifié' : 'arbre propre'}`);

  const runtime = new RaqibRuntime({ targetRepoPath: target });
  await runtime.initialize();
  console.log('✅ Runtime initialisé (handlers ciblés read-only).');

  let mission = await runtime.missionEngine.getMission(MISSION_ID);
  if (mission) {
    console.log(`♻️  Mission existante ${mission.id} → ${mission.status}.`);
  } else {
    mission = await runtime.missionEngine.createMission({
      id: MISSION_ID,
      name: 'MosaiX Architecture Diagnostic v2 (READ-ONLY)',
      objective: `Diagnostic read-only de ${target} : inventaire, dépendances, rapport de preuves.`,
      autonomyLevel: 'A2',
      constraints: [
        'No code modification',
        'Read-only operations only',
        `target:${target}`,
      ],
      successCriteria: [
        'Inventory of packages documented',
        'Git HEAD and working tree baseline identified',
        'Dependency analysis produced',
        'Report contains verifiable evidence',
        'Target working tree unchanged',
      ],
      steps: [
        { name: 'Inventory target repository', type: 'INVENTORY' },
        { name: 'Analyse architecture and dependencies', type: 'ANALYZE' },
        { name: 'Propose stabilisation actions', type: 'PROPOSE' },
        { name: 'Generate diagnostic report', type: 'REPORT' },
      ],
      approvalRequired: true,
      budgetLimitEur: 0,
      maxDurationMs: MAX_RUNTIME_MS,
      maxAttempts: 1,
    });
    console.log(`Mission ${mission.id} créée → ${mission.status}.`);
  }

  if (mission.status === 'PLANNED' || mission.status === 'APPROVAL_REQUIRED') {
    await runtime.missionEngine.transitionStatus(
      mission.id,
      'APPROVED',
      'Plan approuvé après revue (READ-ONLY, cible explicite).',
    );
    console.log('✅ Plan approuvé (hash G4 vérifié par MissionEngine).');
  }

  mission = (await runtime.missionEngine.getMission(MISSION_ID))!;
  if (mission.status === 'APPROVED') {
    await runtime.missionEngine.transitionStatus(
      mission.id,
      'RUNNING',
      'Mission démarrée via le runtime RAQIB.',
    );
    console.log('🚀 Mission RUNNING — tick loop actif.');
  }

  const started = Date.now();
  let verified = false;
  let m = (await runtime.missionEngine.getMission(MISSION_ID))!;

  while (['RUNNING', 'VERIFYING'].includes(m.status)) {
    if (Date.now() - started > MAX_RUNTIME_MS) {
      console.error('⏱️  Timeout orchestration dépassé.');
      break;
    }
    await setTimeout(3000);
    m = (await runtime.missionEngine.getMission(MISSION_ID))!;

    if (m.status === 'VERIFYING' && !verified) {
      verified = true;
      console.log('🔎 Étapes terminées → vérification métier.');
      const safeId = MISSION_ID.replace(/[^A-Za-z0-9._-]/g, '_');
      const reportPath = path.join(process.cwd(), 'reports', safeId, 'MOSAIX_001_DIAGNOSTIC_REPORT.md');

      m = await runtime.missionEngine.verifyAndTransition(MISSION_ID, [
        {
          id: 'report-exists',
          type: 'FILE_EXISTS',
          target: reportPath,
        },
        {
          id: 'target-manifest-readable',
          type: 'FILE_EXISTS',
          target: path.join(target, 'package.json'),
        },
        {
          id: 'target-working-tree-unchanged',
          type: 'GIT_STATUS_UNCHANGED',
          target,
          expected: baselineStatus,
        },
      ]);
      console.log(`📋 Verdict : ${m.status} (${m.verificationReport?.verdict ?? 'n/a'}).`);
      for (const r of m.verificationReport?.results ?? []) {
        console.log(`   ${r.passed ? '✅' : '❌'} ${r.checkId} — ${r.evidence}`);
      }
    }
  }

  console.log(`💡 État final : ${m.status}.`);

  const events = await runtime.auditLedger.query({ missionId: MISSION_ID });
  console.log(`✅ ${events.length} événements AuditLedger.`);

  const outDir = path.join(process.cwd(), 'reports', 'mosaix-001-v2');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mission.json'), JSON.stringify(m, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'audit-events.json'), JSON.stringify(events, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'baseline.json'),
    JSON.stringify({ target, baselineSha, baselineStatus }, null, 2),
    'utf8',
  );
  console.log(`📦 Preuves écrites dans ${outDir}`);

  await runtime.stop();
  console.log('✅ Runtime arrêté.');
}

main().catch((err) => {
  console.error('❌ Erreur critique :', err);
  process.exit(1);
});
