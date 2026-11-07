/**
 * MOSAIX-001 — Orchestrateur de mission RAQIB (READ-ONLY)
 *
 * Rôle du script : orchestrer le cycle RAQIB, pas décider.
 *   initialize runtime
 *   → createMission(spec)
 *   → transition APPROVED (G4 : vérifie le hash du plan côté MissionEngine)
 *   → transition RUNNING
 *   → laisser le tick loop exécuter les étapes (5 s)
 *   → à l'état VERIFYING : verifyAndTransition (VerificationEngine)
 *   → exporter l'AuditLedger
 *   → stop runtime
 */
import { RaqibRuntime } from '../services/runtime/src/RaqibRuntime';
import { setTimeout } from 'node:timers/promises';

const MISSION_ID = 'MOSAIX-001';
const MAX_RUNTIME_MS = 30 * 60 * 1000;

async function main() {
  const runtime = new RaqibRuntime();
  await runtime.initialize();
  console.log('✅ Runtime initialisé.');

  let mission = await runtime.missionEngine.getMission(MISSION_ID);
  if (mission) {
    console.log(`♻️  Mission existante ${mission.id} → ${mission.status} (reprise).`);
  } else {
    mission = await runtime.missionEngine.createMission({
      id: MISSION_ID,
      name: 'MosaiX Architecture Diagnostic',
      objective: 'Documenter sans toucher au code.',
      autonomyLevel: 'A2',
      constraints: ['No code modification', 'Read-only operations only'],
      successCriteria: ['Report generated in docs/'],
      steps: [
        { name: 'Inventory codebase', type: 'INVENTORY' },
        { name: 'Analyse gaps and opportunities', type: 'ANALYZE' },
        { name: 'Propose improvements', type: 'PROPOSE' },
        { name: 'Typecheck codebase', type: 'TYPECHECK' },
        { name: 'Build dashboard', type: 'BUILD' },
        { name: 'Run unit tests', type: 'TEST' },
        { name: 'Generate improvement report', type: 'REPORT' },
      ],
      approvalRequired: true,
      budgetLimitEur: 0,
      maxDurationMs: MAX_RUNTIME_MS,
      maxAttempts: 1,
    });
    console.log(`Mission ${mission.id} créée → ${mission.status}.`);
  }

  if (mission.status === 'PLANNED' || mission.status === 'APPROVAL_REQUIRED') {
    // G4 : MissionEngine recalcule et vérifie le contentHash du plan.
    await runtime.missionEngine.transitionStatus(
      mission.id,
      'APPROVED',
      'Plan approuvé après revue (READ-ONLY).',
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
    console.log('🚀 Mission RUNNING — le tick loop exécute les étapes.');
  }

  const started = Date.now();
  let verified = false;
  let m = (await runtime.missionEngine.getMission(MISSION_ID))!;

  while (['RUNNING', 'VERIFYING'].includes(m.status)) {
    if (Date.now() - started > MAX_RUNTIME_MS) {
      console.error('⏱️  Timeout orchestration dépassé — arrêt.');
      break;
    }
    await setTimeout(3000);
    m = (await runtime.missionEngine.getMission(MISSION_ID))!;

    if (m.status === 'VERIFYING' && !verified) {
      verified = true;
      console.log('🔎 Toutes les étapes terminées → vérification finale.');
      // F-03 : checks explicites — sans eux la vérification est BLOCKED.
      m = await runtime.missionEngine.verifyAndTransition(MISSION_ID, [
        { id: 'repo-present', type: 'FILE_EXISTS', target: 'package.json' },
        {
          id: 'diagnostic-report-present',
          type: 'FILE_EXISTS',
          target: 'docs/MOSAIX_001_DIAGNOSTIC_REPORT.md',
        },
      ]);
      console.log(`📋 Verdict final : ${m.status} (${m.verificationReport?.verdict ?? 'n/a'}).`);
    }
  }

  console.log(`💡 Mission terminée avec état ${m.status}.`);

  const events = await runtime.auditLedger.query({ missionId: MISSION_ID });
  console.log(`✅ ${events.length} événements AuditLedger.`);
  for (const e of events) console.log(`- ${e.type} | ${e.id}`);

  await runtime.stop();
  console.log('✅ Runtime arrêté. Preuves disponibles.');
}

main().catch((err) => {
  console.error('❌ Erreur critique :', err);
  process.exit(1);
});
