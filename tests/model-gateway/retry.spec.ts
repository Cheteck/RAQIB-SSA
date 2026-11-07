import { describe, it, expect } from 'vitest';
import { isRetryableError } from '../../packages/model-gateway/src/retry';

describe('isRetryableError', () => {
  it('ne rejoue jamais un 4xx définitif', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isRetryableError(Object.assign(new Error('nope'), { status }))).toBe(false);
    }
  });

  it('rejoue les statuts récupérables', () => {
    for (const status of [408, 409, 425, 429, 500, 502, 503]) {
      expect(isRetryableError(Object.assign(new Error('later'), { status }))).toBe(true);
    }
  });

  it('rejoue les timeouts et erreurs réseau', () => {
    expect(isRetryableError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(true);
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    expect(isRetryableError(new Error('read ECONNRESET'))).toBe(true);
  });

  it('rejoue une erreur inconnue (comportement historique)', () => {
    expect(isRetryableError(new Error('something odd'))).toBe(true);
    expect(isRetryableError(null)).toBe(true);
  });
});
