/**
 * Audit de consommation de contexte LLM — mesure, ne modifie rien.
 *
 * Usage : npx tsx scripts/llm-context-audit.ts
 *
 * Il n'appelle aucun provider : il mesure uniquement les tokens que RAQIB
 * assemble avant chaque requête (contexte système + historique + prompt).
 */
import { buildAgentSystemContext, buildChatMessages, buildSystemContext, AgentChatSnapshot, ChatSnapshot } from '../services/runtime/src/chat/chatContext';
import { ContextEngine } from '../packages/core/src/ContextEngine';

const engine = new ContextEngine();
const est = (t: string) => engine.estimateTokens(t);

function snapshot(nMissions: number, nSteps: number): ChatSnapshot {
  const missions = Array.from({ length: nMissions }, (_, i) => ({
    id: `M-${100 + i}`,
    name: `Mission ${i}`,
    status: i % 3 === 0 ? 'RUNNING' : 'PENDING',
    objective: "Objectif de démonstration suffisamment long pour représenter un objectif réel d'exécution",
    currentStepIndex: i % Math.max(1, nSteps),
    totalSteps: nSteps,
  }));

  return {
    status: 'OK',
    readOnlyMode: false,
    emergencyStop: false,
    timestamp: new Date().toISOString(),
    missions,
    pendingApprovals: 2,
    recentEvents: Array.from({ length: 5 }, (_, i) => ({
      type: 'ACTION_EXECUTED',
      actor: 'raqib-core',
      missionId: `M-${100 + i}`,
      timestamp: new Date().toISOString(),
    })),
    focusedMission: nMissions > 0
      ? {
          id: missions[0].id,
          name: missions[0].name,
          status: missions[0].status,
          objective: missions[0].objective,
          steps: Array.from({ length: nSteps }, (_, i) => ({ name: `Étape ${i}`, status: 'PENDING' })),
        }
      : null,
  } as unknown as ChatSnapshot;
}

const rows: Array<Record<string, number | string>> = [];

for (const [nMissions, nSteps] of [[0, 0], [3, 6], [10, 8], [20, 12], [50, 12]] as const) {
  const sys = buildSystemContext(snapshot(nMissions, nSteps));
  rows.push({
    scénario: `${nMissions} missions / ${nSteps} étapes`,
    'tokens système': est(sys),
    'caractères système': sys.length,
  });
}

const sys3 = buildSystemContext(snapshot(3, 6));
const history = Array.from({ length: 40 }, (_, i) => ({
  role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
  content: `Message ${i} — contenu de démonstration d'environ cent caractères pour représenter un échange réel dans RAQIB.`,
}));

const built = buildChatMessages({
  systemContext: sys3,
  history,
  prompt: 'Résume l’état des missions en cours.',
  contextEngine: engine,
  maxContextTokens: engine.getMetrics([]).availableTokens,
});

const metrics = engine.getMetrics([]);

console.log('--- Budget du ContextEngine ---');
console.log(JSON.stringify(metrics, null, 2));

console.log('\n--- Coût du contexte système selon la charge ---');
console.table(rows);

console.log('\n--- Assemblage d’une requête type (3 missions, 40 messages) ---');
console.log(JSON.stringify({
  systemTokens: est(sys3),
  historyIncluded: built.includedHistory,
  historyDropped: built.droppedHistory,
  promptTokens: est('Résume l’état des missions en cours.'),
  estimatedTotal: built.estimatedTokens,
  maxContextTokens: built.maxContextTokens,
  messagesSent: built.messages.length,
}, null, 2));

// Projection : coût cumulé d'une conversation de N tours, historique complet re-transmis.
const perTurnBase = est(sys3) + est('Résume l’état des missions en cours.');
const turnCost = (n: number) => {
  const avgMsg = est(history[0].content);
  let total = 0;
  for (let t = 1; t <= n; t++) total += perTurnBase + Math.min(t, 40) * avgMsg;
  return total;
};

console.log('\n--- Projection tokens d’entrée cumulés (contexte système re-transmis à chaque tour) ---');
console.table([
  { tours: 1, 'tokens cumulés': turnCost(1) },
  { tours: 5, 'tokens cumulés': turnCost(5) },
  { tours: 10, 'tokens cumulés': turnCost(10) },
  { tours: 20, 'tokens cumulés': turnCost(20) },
  { tours: 40, 'tokens cumulés': turnCost(40) },
]);

/* ────────────────────────────────────────────────────────────────
 * Contexte des sous-agents : getAgentChatSnapshot renvoie à CHAQUE
 * tour l'executionContext complet, le contextLog et le résultat.
 * ──────────────────────────────────────────────────────────────── */
function agentSnapshot(logEntries: number, files: number): AgentChatSnapshot {
  return {
    timestamp: new Date().toISOString(),
    readOnlyMode: false,
    emergencyStop: false,
    agent: {
      id: 'A-07',
      name: 'Alpha',
      role: 'implementer',
      specialty: 'TypeScript / tests',
      instructions: 'Implémenter les étapes affectées, ne jamais déclarer une mission réussie, remonter les preuves dans le contextLog.',
      status: 'RUNNING',
      state: 'SUPERVISED',
      stepsExecuted: 12,
    },
    mission: {
      id: 'M-12',
      name: 'Mission Alpha',
      status: 'RUNNING',
      objective: "Exécuter le plan de migration du module de contexte sans casser les tests existants",
      priority: 'HIGH',
      currentStepIndex: 4,
      totalSteps: 9,
      dependsOn: ['M-10', 'M-11'],
      executionContext: {
        projectPath: 'D:\\Projets\\RAQIB-SSA',
        files: Array.from({ length: files }, (_, i) => `services/runtime/src/module-${i}/implementation.ts`),
        instructions: Array.from({ length: 6 }, (_, i) => `Instruction ${i} : respecter la contrainte de compatibilité et journaliser la preuve.`),
        constraints: ['READ-ONLY en production', 'aucune écriture hors workspace', 'tests obligatoires avant clôture'],
        inheritedContext: 'Contexte hérité de M-10 : le schéma de base est figé, seules les colonnes additives sont autorisées.',
      },
      contextLog: Array.from({ length: logEntries }, (_, i) => ({
        version: i + 1,
        timestamp: new Date(Date.now() - (logEntries - i) * 60000).toISOString(),
        updatedBy: 'alpha',
        note: `Ajout de ${files} fichiers au contexte et validation partielle de l'étape ${i}.`,
      })),
      steps: Array.from({ length: 9 }, (_, i) => ({ name: `Étape ${i}`, status: i < 4 ? 'DONE' : 'PENDING' })),
      result: {
        summary: 'Aucun résultat final : mission en cours.',
        success: false,
        artifacts: ['reports/step-1.md', 'reports/step-2.md'],
        modifiedFiles: Array.from({ length: files }, (_, i) => `services/runtime/src/module-${i}/implementation.ts`),
      },
    },
    recentEvents: Array.from({ length: 5 }, () => ({
      type: 'STEP_EXECUTED',
      actor: 'alpha',
      missionId: 'M-12',
      timestamp: new Date().toISOString(),
    })),
  } as unknown as AgentChatSnapshot;
}

const agentRows = [
  { scénario: 'agent sans mission', tokens: est(buildAgentSystemContext({ ...agentSnapshot(0, 0), mission: null } as AgentChatSnapshot)) },
  { scénario: 'mission + 3 fichiers + log 3', tokens: est(buildAgentSystemContext(agentSnapshot(3, 3))) },
  { scénario: 'mission + 20 fichiers + log 10', tokens: est(buildAgentSystemContext(agentSnapshot(10, 20))) },
  { scénario: 'mission + 40 fichiers + log 25', tokens: est(buildAgentSystemContext(agentSnapshot(25, 40))) },
];

console.log('\n--- Contexte système d’un sous-agent (re-transmis à chaque tour) ---');
console.table(agentRows);

const agentHeavy = est(buildAgentSystemContext(agentSnapshot(10, 20)));
const agentTurnCost = (n: number) => {
  const avgMsg = est(history[0].content);
  let total = 0;
  for (let t = 1; t <= n; t++) total += agentHeavy + 9 + Math.min(t, 40) * avgMsg;
  return total;
};
console.log('\n--- Projection sous-agent (mission + 20 fichiers + log 10) ---');
console.table([
  { tours: 10, 'tokens cumulés': agentTurnCost(10) },
  { tours: 20, 'tokens cumulés': agentTurnCost(20) },
  { tours: 40, 'tokens cumulés': agentTurnCost(40) },
]);
