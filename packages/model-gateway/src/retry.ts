/**
 * Classification des erreurs provider pour la politique de retry.
 *
 * Objectif : ne jamais rejouer une requête que le provider a déjà rejetée
 * définitivement (400, 401, 403, 404, 422). Rejouer un 4xx multiplie le coût
 * d'entrée sans aucune chance de succès.
 */
export interface RetryableErrorLike {
  status?: number;
  name?: string;
  message?: string;
}

/** Codes HTTP pour lesquels un nouvel essai peut aboutir. */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429]);

export function isRetryableError(err: unknown): boolean {
  const e = (err ?? {}) as RetryableErrorLike;

  if (typeof e.status === 'number') {
    return RETRYABLE_STATUS.has(e.status) || e.status >= 500;
  }

  const name = e.name ?? '';
  if (name === 'AbortError' || name === 'TimeoutError') return true;

  const message = e.message ?? '';
  if (/fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|network error/i.test(message)) {
    return true;
  }

  // Erreur non identifiée : on conserve le comportement historique (retry).
  return true;
}
