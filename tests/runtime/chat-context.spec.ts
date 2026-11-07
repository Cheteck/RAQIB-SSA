import { describe, it, expect } from 'vitest';
import { buildChatMessages, buildSystemContext, ChatSnapshot } from '../../services/runtime/src/chat/chatContext';

const snapshot: ChatSnapshot = {
  status: 'OK',
  readOnlyMode: false,
  emergencyStop: false,
  timestamp: '2026-11-06T10:00:00.000Z',
  missions: [
    {
      id: 'mission-1',
      name: 'Audit du dépôt',
      status: 'RUNNING',
      objective: 'Vérifier les dépendances',
      currentStepIndex: 1,
      totalSteps: 3,
    },
  ],
  pendingApprovals: 2,
  recentEvents: [
    { type: 'MISSION_STARTED', actor: 'raqib-core', missionId: 'mission-1', timestamp: '2026-11-06T09:59:00.000Z' },
  ],
  focusedMission: {
    id: 'mission-1',
    name: 'Audit du dépôt',
    status: 'RUNNING',
    objective: 'Vérifier les dépendances',
    steps: [
      { name: 'inventory', status: 'DONE' },
      { name: 'analyze', status: 'PENDING' },
    ],
  },
};

describe('buildSystemContext', () => {
  it('injecte l\'état réel du runtime, les missions, les approbations et l\'audit', () => {
    const context = buildSystemContext(snapshot);

    expect(context).toContain('Statut : OK');
    expect(context).toContain('PolicyEngine : READ/WRITE');
    expect(context).toContain('Approbations en attente : 2');
    expect(context).toContain('[RUNNING] Audit du dépôt (id=mission-1)');
    expect(context).toContain('MISSION CIBLÉE : Audit du dépôt');
    expect(context).toContain('[DONE] inventory');
    expect(context).toContain('MISSION_STARTED');
  });

  it('signale explicitement le mode READ-ONLY et l\'arrêt d\'urgence', () => {
    const context = buildSystemContext({ ...snapshot, readOnlyMode: true, emergencyStop: true });
    expect(context).toContain('READ-ONLY');
    expect(context).toContain("Arrêt d'urgence : ACTIF");
  });

  it('avertit le modèle quand la liste de missions est tronquée à 20', () => {
    const many = Array.from({ length: 32 }, (_, i) => ({
      id: `mission-${i}`,
      name: `Mission ${i}`,
      status: 'RUNNING',
      objective: 'Objectif',
      currentStepIndex: 0,
      totalSteps: 1,
    }));
    const context = buildSystemContext({ ...snapshot, missions: many });

    expect(context).toContain('=== MISSIONS (32) ===');
    expect(context).toContain('Seules 20 missions sur 32');
    expect(context).toContain('mission-19');
    expect(context).not.toContain('mission-20');
  });

  it('n\'ajoute aucun avertissement quand toutes les missions sont listées', () => {
    const context = buildSystemContext(snapshot);
    expect(context).not.toContain('Seules 20 missions');
  });
});

describe('buildChatMessages', () => {
  it('place system, puis l\'historique dans l\'ordre, puis le prompt courant', () => {
    const built = buildChatMessages({
      systemContext: 'CONTEXTE RUNTIME',
      history: [
        { role: 'user', content: 'premier message' },
        { role: 'assistant', content: 'première réponse' },
        { role: 'user', content: 'deuxième message' },
        { role: 'assistant', content: 'deuxième réponse' },
      ],
      prompt: 'question courante',
    });

    expect(built.messages.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
      'assistant',
      'user',
    ]);
    expect(built.messages[0].content).toBe('CONTEXTE RUNTIME');
    expect(built.messages[1].content).toBe('premier message');
    expect(built.messages[4].content).toBe('deuxième réponse');
    expect(built.messages[5].content).toBe('question courante');
    expect(built.includedHistory).toBe(4);
    expect(built.droppedHistory).toBe(0);
  });

  it('tronque l\'historique le plus ancien pour tenir dans le budget, sans perdre system ni prompt', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message-${i} ` + 'x'.repeat(400),
    }));

    const built = buildChatMessages({
      systemContext: 'SYSTEM',
      history,
      prompt: 'PROMPT FINAL',
      maxContextTokens: 600,
      contextEngine: { estimateTokens: (t: string) => Math.ceil(t.length / 4) },
    });

    expect(built.messages[0].content).toBe('SYSTEM');
    expect(built.messages[built.messages.length - 1].content).toBe('PROMPT FINAL');
    expect(built.includedHistory).toBeLessThan(history.length);
    expect(built.droppedHistory).toBeGreaterThan(0);
    // Les messages conservés sont les plus récents.
    expect(built.messages[built.messages.length - 2].content).toContain(`message-${history.length - 1}`);
  });

  it('respecte maxHistoryMessages', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `m${i}`,
    }));
    const built = buildChatMessages({
      systemContext: 'S',
      history,
      prompt: 'P',
      maxHistoryMessages: 3,
    });
    expect(built.includedHistory).toBe(3);
    expect(built.messages[1].content).toBe('m7');
  });
});
