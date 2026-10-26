import { MissionStatus } from '@raqib/shared';

/**
 * Machine à états RAQIB — transitions autorisées (constitution).
 *
 * DRAFT → PLANNED → APPROVAL_REQUIRED → APPROVED → RUNNING → VERIFYING → SUCCEEDED
 *                                              ↓            ↓          ↓
 *                                          REJECTED     (échecs)  (échecs)
 *                                          
 * Terminal : SUCCEEDED, REJECTED, CANCELLED, FAILED (sauf → NEEDS_REVIEW)
 *
 * Règles spéciales :
 *  - → RUNNING exige que l'état courant soit APPROVED
 *  - → SUCCEEDED exige verdict de vérification PASS (contrôlé à l'appelant)
 *  - FAILED est terminal sauf décision manuelle → NEEDS_REVIEW
 */
const TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['APPROVAL_REQUIRED', 'APPROVED', 'CANCELLED'],
  APPROVAL_REQUIRED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['VERIFYING', 'FAILED', 'BLOCKED', 'NEEDS_REVIEW', 'CANCELLED'],
  VERIFYING: ['SUCCEEDED', 'FAILED', 'NEEDS_REVIEW', 'RUNNING'],
  SUCCEEDED: [],
  REJECTED: [],
  FAILED: ['NEEDS_REVIEW'],
  CANCELLED: [],
  BLOCKED: ['APPROVAL_REQUIRED', 'CANCELLED', 'NEEDS_REVIEW'],
  NEEDS_REVIEW: ['APPROVED', 'CANCELLED'],
};

const TERMINAL_STATES: MissionStatus[] = ['SUCCEEDED', 'REJECTED', 'CANCELLED'];

export class StateTransitionError extends Error {
  constructor(
    public from: MissionStatus,
    public to: MissionStatus,
  ) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = 'StateTransitionError';
  }
}

export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: MissionStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * Règle : → RUNNING exige status === APPROVED.
 * (Déjà couvert par TRANSITIONS, double-contrôle explicite pour audit.)
 */
export function assertTransition(
  from: MissionStatus,
  to: MissionStatus,
): { ok: true } {
  if (!canTransition(from, to)) {
    throw new StateTransitionError(from, to);
  }
  if (to === 'RUNNING' && from !== 'APPROVED') {
    throw new StateTransitionError(from, to);
  }
  return { ok: true };
}
