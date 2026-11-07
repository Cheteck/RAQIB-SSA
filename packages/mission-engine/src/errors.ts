/**
 * Erreurs typées du Mission Engine.
 *
 * Objectif : distinguer, au niveau de l'API HTTP, une ressource inexistante
 * (404) d'une transition ou d'une donnée invalide (400), sans se fier au
 * texte du message d'erreur.
 */

/** Code d'erreur stable, transporté jusqu'à la couche HTTP. */
export type MissionEngineErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'INVALID_ARGUMENT';

export class MissionEngineError extends Error {
  readonly code: MissionEngineErrorCode;

  constructor(code: MissionEngineErrorCode, message: string) {
    super(message);
    this.name = 'MissionEngineError';
    this.code = code;
  }
}

/** Ressource absente (sous-agent, mission) → HTTP 404. */
export class NotFoundError extends MissionEngineError {
  constructor(message: string) {
    super('NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

/** Transition refusée par les règles métier (mission terminale, etc.) → HTTP 400. */
export class InvalidTransitionError extends MissionEngineError {
  constructor(message: string) {
    super('INVALID_TRANSITION', message);
    this.name = 'InvalidTransitionError';
  }
}

/** Requête mal formée (champ requis manquant) → HTTP 400. */
export class InvalidArgumentError extends MissionEngineError {
  constructor(message: string) {
    super('INVALID_ARGUMENT', message);
    this.name = 'InvalidArgumentError';
  }
}

/** Vrai si l'erreur porte le code NOT_FOUND (compatible instances multi-bundles). */
export function isNotFoundError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'NOT_FOUND';
}
