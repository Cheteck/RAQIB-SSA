/**
 * Couleurs de statut — tokens RAQIB (--c cyan, --m menthe, --g ambre, --r corail, --mu muted).
 * Statut de mission et statut d'agent sont volontairement des échelles distinctes.
 */

export const MISSION_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'rgb(var(--mu))',
  PLANNED: 'rgb(var(--g))',
  APPROVAL_REQUIRED: 'rgb(var(--g))',
  APPROVED: 'rgb(var(--c))',
  RUNNING: 'rgb(var(--m))',
  VERIFYING: 'rgb(var(--m))',
  SUCCEEDED: 'rgb(var(--c))',
  COMPLETED: 'rgb(var(--c))',
  FAILED: 'rgb(var(--r))',
  BLOCKED: 'rgb(var(--g))',
  NEEDS_REVIEW: 'rgb(var(--r))',
  CANCELLED: 'rgb(var(--mu))',
};

export const AGENT_STATUS_COLORS: Record<string, string> = {
  IDLE: 'rgb(var(--mu))',
  RUNNING: 'rgb(var(--m))',
  COMPLETED: 'rgb(var(--c))',
  BLOCKED: 'rgb(var(--g))',
  FAILED: 'rgb(var(--r))',
};

export function missionColor(status?: string): string {
  return (status && MISSION_STATUS_COLORS[status]) || 'rgb(var(--mu))';
}

export function agentColor(status?: string): string {
  return (status && AGENT_STATUS_COLORS[status]) || 'rgb(var(--mu))';
}

export const ROLE_ICONS: Record<string, string> = {
  executor: 'build',
  researcher: 'manage_search',
  verifier: 'verified',
};

export const ROLE_LABELS: Record<string, string> = {
  executor: 'Exécuteur',
  researcher: 'Chercheur',
  verifier: 'Vérificateur',
};

/** Rang d'affichage des missions : actives → alertes → en attente → terminales. */
export function missionRank(status: string): number {
  const s = (status || '').toUpperCase();
  if (s === 'RUNNING' || s === 'VERIFYING' || s === 'APPROVED') return 0;
  if (s === 'BLOCKED' || s === 'FAILED' || s === 'NEEDS_REVIEW') return 1;
  if (s === 'PLANNED' || s === 'DRAFT' || s === 'APPROVAL_REQUIRED') return 2;
  return 3;
}

/**
 * Statut d'ÉTAPE (vocabulaire MissionEngine : PENDING / RUNNING / DONE / SKIPPED / FAILED / BLOCKED).
 * Distinct des statuts de mission et d'agent : une étape DONE ne dit rien du statut de la mission.
 */
export interface StepVisual {
  icon: string;
  color: string;
  label: string;
}

export function stepVisual(status?: string): StepVisual {
  switch ((status || '').toUpperCase()) {
    case 'DONE':
      return { icon: 'check_circle', color: 'rgb(var(--m))', label: 'terminée' };
    case 'RUNNING':
      return { icon: 'play_circle', color: 'rgb(var(--c))', label: 'en cours' };
    case 'FAILED':
      return { icon: 'cancel', color: 'rgb(var(--r))', label: 'échouée' };
    case 'BLOCKED':
      return { icon: 'block', color: 'rgb(var(--g))', label: 'bloquée' };
    case 'SKIPPED':
      return { icon: 'skip_next', color: 'rgb(var(--mu))', label: 'ignorée' };
    default:
      return { icon: 'radio_button_unchecked', color: 'rgb(var(--mu))', label: 'en attente' };
  }
}

/** Une étape est « faite » si DONE ou SKIPPED. */
export function isStepDone(status?: string): boolean {
  const s = (status || '').toUpperCase();
  return s === 'DONE' || s === 'SKIPPED';
}
