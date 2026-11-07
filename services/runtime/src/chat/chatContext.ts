import type { MessageItem } from '@raqib/core';

export interface ChatSnapshot {
  status: string;
  readOnlyMode: boolean;
  emergencyStop: boolean;
  timestamp: string;
  missions: Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
    currentStepIndex: number;
    totalSteps: number;
  }>;
  pendingApprovals: number;
  recentEvents: Array<{ type: string; actor: string; missionId?: string; timestamp: string }>;
  focusedMission?: {
    id: string;
    name: string;
    status: string;
    objective: string;
    steps: Array<{ name: string; status: string }>;
  } | null;
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentChatSnapshot {
  timestamp: string;
  readOnlyMode: boolean;
  emergencyStop: boolean;
  agent: {
    id: string;
    name: string;
    role: string;
    specialty?: string;
    instructions?: string;
    status: string;
    state: string;
    stepsExecuted: number;
    lastError?: string;
  };
  mission: {
    id: string;
    name: string;
    status: string;
    objective: string;
    priority?: string;
    currentStepIndex: number;
    totalSteps: number;
    dependsOn?: string[];
    executionContext?: {
      projectPath?: string;
      files: string[];
      instructions: string[];
      constraints: string[];
      inheritedContext?: string;
    };
    contextLog?: Array<{ version: number; timestamp: string; updatedBy: string; note?: string }>;
    steps: Array<{ name: string; status: string; error?: string }>;
    result?: {
      summary?: string;
      success?: boolean;
      artifacts?: string[];
      reports?: string[];
      modifiedFiles?: string[];
      errors?: string[];
    };
  } | null;
  recentEvents: Array<{ type: string; actor: string; missionId?: string; timestamp: string }>;
}

/**
 * Contexte système d'une conversation dédiée à un sous-agent.
 *
 * Il rappelle explicitement l'identité de l'agent, sa mission et son contexte
 * d'exécution. Cette conversation est isolée du chat principal RAQIB : l'agent
 * ne doit jamais s'y présenter comme le coordinateur.
 */
export function buildAgentSystemContext(snapshot: AgentChatSnapshot): string {
  const { agent, mission } = snapshot;
  const lines: string[] = [
    `Tu es le sous-agent « ${agent.name} » (rôle : ${agent.role}${agent.specialty ? `, spécialité : ${agent.specialty}` : ''}).`,
    "Cette conversation est PRIVÉE et DISTINCTE du chat principal RAQIB. Tu ne parles pas au nom du coordinateur et tu ne prétends jamais avoir exécuté une action sans preuve.",
    "Toute action réelle passe par le MissionEngine, le PolicyEngine et l'AuditLedger. Tu ne déclares jamais une mission réussie : le VerificationEngine seul peut le faire.",
    '',
    '=== IDENTITÉ DU SOUS-AGENT ===',
    `ID : ${agent.id}`,
    `État de supervision : ${agent.state}`,
    `Statut d'exécution : ${agent.status}`,
    `Étapes exécutées : ${agent.stepsExecuted}`,
    `Horodatage : ${snapshot.timestamp}`,
    `PolicyEngine : ${snapshot.readOnlyMode ? 'READ-ONLY (écritures et exécutions refusées)' : 'READ/WRITE'}`,
    `Arrêt d\'urgence : ${snapshot.emergencyStop ? 'ACTIF' : 'désactivé'}`,
  ];

  if (agent.instructions) {
    lines.push('', "=== INSTRUCTIONS PERMANENTES DE L'AGENT ===", agent.instructions);
  }

  if (agent.lastError) {
    lines.push('', `Dernière erreur connue : ${agent.lastError}`);
  }

  if (!mission) {
    lines.push('', '=== MISSION ===', "Aucune mission n'est actuellement affectée à cet agent.");
  } else {
    lines.push(
      '',
      `=== MISSION AFFECTÉE : ${mission.name} (${mission.id}) ===`,
      `Statut : ${mission.status}`,
      `Priorité : ${mission.priority ?? 'MEDIUM'}`,
      `Objectif : ${mission.objective}`,
      `Progression : étape ${mission.currentStepIndex}/${mission.totalSteps}`,
    );

    if (mission.dependsOn && mission.dependsOn.length > 0) {
      lines.push(`Dépendances : ${mission.dependsOn.join(', ')}`);
    }

    const ctx = mission.executionContext;
    lines.push('', "=== CONTEXTE D'EXÉCUTION (transmis explicitement) ===");
    if (!ctx) {
      lines.push('Aucun contexte structuré enregistré.');
    } else {
      if (ctx.projectPath) lines.push(`Chemin du projet : ${ctx.projectPath}`);
      lines.push(
        `Fichiers / ressources : ${ctx.files.length > 0 ? ctx.files.join(', ') : 'aucun'}`,
        `Contraintes : ${ctx.constraints.length > 0 ? ctx.constraints.join(' · ') : 'aucune'}`,
      );
      if (ctx.instructions.length > 0) {
        lines.push('Instructions spécifiques :');
        for (const instruction of ctx.instructions) lines.push(`- ${instruction}`);
      }
      if (ctx.inheritedContext) {
        lines.push('Contexte hérité :', ctx.inheritedContext);
      }
    }

    if (mission.contextLog && mission.contextLog.length > 0) {
      lines.push('', '=== JOURNAL DE CONTEXTE (append-only) ===');
      for (const entry of mission.contextLog.slice(-10)) {
        lines.push(
          `- v${entry.version} · ${entry.timestamp} · par ${entry.updatedBy}${entry.note ? ` · ${entry.note}` : ''}`,
        );
      }
    }

    if (mission.steps.length > 0) {
      lines.push('', '=== ÉTAPES ===');
      for (const step of mission.steps) {
        lines.push(`- [${step.status}] ${step.name}${step.error ? ` — ${step.error}` : ''}`);
      }
    }

    if (mission.result) {
      lines.push('', '=== RÉSULTATS REMONTÉS ===');
      lines.push(`Résumé : ${mission.result.summary ?? '—'}`);
      if (mission.result.reports && mission.result.reports.length > 0) {
        lines.push(`Rapports : ${mission.result.reports.join(', ')}`);
      }
      if (mission.result.modifiedFiles && mission.result.modifiedFiles.length > 0) {
        lines.push(`Fichiers modifiés : ${mission.result.modifiedFiles.join(', ')}`);
      }
      if (mission.result.errors && mission.result.errors.length > 0) {
        lines.push(`Erreurs : ${mission.result.errors.join(' · ')}`);
      }
    }
  }

  lines.push('', "=== 5 DERNIERS ÉVÉNEMENTS D'AUDIT ===");
  if (snapshot.recentEvents.length === 0) {
    lines.push('Aucun événement.');
  } else {
    for (const event of snapshot.recentEvents) {
      lines.push(
        `- ${event.timestamp} · ${event.type} · acteur=${event.actor}${event.missionId ? ` · mission=${event.missionId}` : ''}`,
      );
    }
  }

  return lines.join('\n');
}

export interface BuildChatMessagesInput {
  systemContext: string;
  history: HistoryMessage[];
  prompt: string;
  /** Garde-fou : nombre maximal de messages d'historique conservés. */
  maxHistoryMessages?: number;
  contextEngine?: {
    estimateTokens(text: string): number;
  };
  /** Budget total en tokens alloué aux messages (hors réserve réponse). */
  maxContextTokens?: number;
}

export interface BuiltChatMessages {
  messages: MessageItem[];
  includedHistory: number;
  droppedHistory: number;
  estimatedTokens: number;
  maxContextTokens: number;
}

/**
 * Construit le bloc de contexte système envoyé au LLM à chaque appel.
 *
 * Il contient l'état réel du runtime (statut, policy, missions, approbations,
 * audit récent) et la mission éventuellement ciblée. Aucune valeur n'est
 * inventée : tout vient de RaqibRuntime.getChatSnapshot().
 */
export function buildSystemContext(snapshot: ChatSnapshot): string {
  const lines: string[] = [
    'Tu es RAQIB, un orchestrateur autonome gouverné. Réponds en français, de façon concise et factuelle.',
    "Tu ne peux exécuter aucune action toi-même : toute action passe par le PolicyEngine, le MissionEngine et l'AuditLedger.",
    '',
    '=== ÉTAT DU RUNTIME (données réelles, horodatées) ===',
    `Horodatage : ${snapshot.timestamp}`,
    `Statut : ${snapshot.status}`,
    `PolicyEngine : ${snapshot.readOnlyMode ? 'READ-ONLY (écritures et exécutions refusées)' : 'READ/WRITE'}`,
    `Arrêt d'urgence : ${snapshot.emergencyStop ? 'ACTIF' : 'désactivé'}`,
    `Approbations en attente : ${snapshot.pendingApprovals}`,
    '',
    `=== MISSIONS (${snapshot.missions.length}) ===`,
  ];

  if (snapshot.missions.length === 0) {
    lines.push('Aucune mission enregistrée.');
  } else {
    for (const mission of snapshot.missions.slice(0, 20)) {
      lines.push(
        `- [${mission.status}] ${mission.name} (id=${mission.id}) — étape ${mission.currentStepIndex}/${mission.totalSteps} — ${mission.objective}`,
      );
    }
    // Le prompt est volontairement plafonné à 20 missions : sans cet avertissement,
    // le modèle conclut sur un état partiel en croyant avoir la liste complète.
    if (snapshot.missions.length > 20) {
      lines.push(
        `[ATTENTION] Seules 20 missions sur ${snapshot.missions.length} sont listées ci-dessus. ` +
          "Ne pas conclure sur l'absence d'une mission non listée ; le signaler si la réponse en dépend.",
      );
    }
  }

  if (snapshot.focusedMission) {
    const m = snapshot.focusedMission;
    lines.push('', `=== MISSION CIBLÉE : ${m.name} (${m.id}) ===`, `Statut : ${m.status}`, `Objectif : ${m.objective}`);
    if (m.steps.length > 0) {
      lines.push('Étapes :');
      for (const step of m.steps) {
        lines.push(`- [${step.status}] ${step.name}`);
      }
    }
  }

  lines.push('', '=== 5 DERNIERS ÉVÉNEMENTS D\'AUDIT ===');
  if (snapshot.recentEvents.length === 0) {
    lines.push('Aucun événement.');
  } else {
    for (const event of snapshot.recentEvents) {
      lines.push(
        `- ${event.timestamp} · ${event.type} · acteur=${event.actor}${event.missionId ? ` · mission=${event.missionId}` : ''}`,
      );
    }
  }

  return lines.join('\n');
}

/**
 * Assemble les messages envoyés au LLM : system (contexte runtime) + historique
 * de conversation + prompt courant.
 *
 * L'historique est tronqué par le plus ancien jusqu'à tenir dans le budget,
 * afin de garantir que le contexte système et le prompt courant sont toujours
 * transmis.
 */
export function buildChatMessages(input: BuildChatMessagesInput): BuiltChatMessages {
  const {
    systemContext,
    history,
    prompt,
    maxHistoryMessages = 40,
    contextEngine,
    maxContextTokens = 100_000,
  } = input;

  const estimate = contextEngine
    ? (text: string) => contextEngine.estimateTokens(text)
    : (text: string) => Math.max(Math.ceil(text.length / 4), Math.ceil(text.trim().split(/\s+/).length * 1.3));

  const systemMessage: MessageItem = { role: 'system', content: systemContext };
  const userMessage: MessageItem = { role: 'user', content: prompt };

  let budget = maxContextTokens - estimate(systemContext) - estimate(prompt);
  const recentHistory = history.slice(-maxHistoryMessages);

  const kept: MessageItem[] = [];
  let dropped = 0;
  // On repart de la fin (les messages les plus récents sont les plus utiles).
  for (let i = recentHistory.length - 1; i >= 0; i--) {
    const item = recentHistory[i];
    const tokens = estimate(item.content);
    if (tokens > budget) {
      dropped = i + 1;
      break;
    }
    kept.unshift({ role: item.role, content: item.content, tokens });
    budget -= tokens;
  }

  const messages = [systemMessage, ...kept, userMessage];
  const estimatedTokens = messages.reduce(
    (acc, message) => acc + (message.tokens ?? estimate(message.content)),
    0,
  );

  return {
    messages,
    includedHistory: kept.length,
    droppedHistory: dropped,
    estimatedTokens,
    maxContextTokens,
  };
}
