/**
 * Contrat de preuve de succès — invariant architectural RAQIB.
 *
 * Règle : un composant ne peut déclarer un succès que s'il fournit au moins
 * une preuve *observée* (changement de fichier, résultat de commande, rapport
 * de vérification, état de dépôt mesuré). Une chaîne narrative
 * (« completed in mode apply ») n'est pas une preuve.
 *
 * Ce module est volontairement sans dépendance : il est utilisable par les
 * tests de contrat, les moteurs et les adaptateurs.
 */

export type EvidenceKind =
  | 'FILE_CHANGE'
  | 'COMMAND_RESULT'
  | 'VERIFICATION_RESULT'
  | 'REPO_STATE'
  | 'INVENTORY'
  | 'EXPLICIT_NO_CHANGE';

export interface ObservedEvidence {
  kind: EvidenceKind;
  detail: string;
}

export interface SuccessVerdict {
  /** Le résultat prétend-il un succès ? */
  successClaimed: boolean;
  /** Le succès est-il adossé à au moins une preuve observée ? */
  proven: boolean;
  reason: string;
  evidence: ObservedEvidence[];
}

export class UnprovenSuccessError extends Error {
  constructor(
    public readonly surface: string,
    public readonly verdict: SuccessVerdict
  ) {
    super(
      `[${surface}] succès non prouvé : ${verdict.reason}. ` +
        `Fournir une preuve observée (changes, validations, results, dirtyCount+source) ` +
        `ou déclarer explicitement noChangeRequired + justification.`
    );
    this.name = 'UnprovenSuccessError';
  }
}

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function presentItems(value: unknown): unknown[] {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
}

/**
 * Un résultat « prétend » le succès selon l'une des conventions du codebase :
 * - `success: true`                (adaptateurs / outils)
 * - `status: 'completed'`          (TaskResult du Coding Engine)
 * - `verdict: 'PASS'`              (StructuredVerificationReport)
 * - `passed: true`                 (VerificationResult / rapport)
 * - `status: 'clean'`              (état de dépôt git)
 */
export function claimsSuccess(input: unknown): boolean {
  if (!isDict(input)) return false;
  return (
    input.success === true ||
    input.status === 'completed' ||
    input.verdict === 'PASS' ||
    input.passed === true ||
    input.status === 'clean'
  );
}

/** Extrait les preuves réellement observables d'un résultat. */
export function collectEvidence(input: unknown): ObservedEvidence[] {
  if (!isDict(input)) return [];
  const evidence: ObservedEvidence[] = [];

  const changes = presentItems(input.changes);
  if (changes.length > 0) {
    evidence.push({ kind: 'FILE_CHANGE', detail: `${changes.length} changement(s) rapporté(s)` });
  }

  const validations = presentItems(input.validations);
  if (validations.length > 0) {
    evidence.push({ kind: 'COMMAND_RESULT', detail: `${validations.length} validation(s) exécutée(s)` });
  }

  const modifiedFiles = presentItems(input.modifiedFiles);
  if (modifiedFiles.length > 0) {
    evidence.push({ kind: 'FILE_CHANGE', detail: `${modifiedFiles.length} fichier(s) modifié(s)` });
  }

  // Rapport de vérification : PASS exige des résultats eux-mêmes prouvés.
  const results = presentItems(input.results);
  if (
    results.length > 0 &&
    results.every((r) => isDict(r) && r.passed === true && nonEmptyString(r.evidence))
  ) {
    evidence.push({
      kind: 'VERIFICATION_RESULT',
      detail: `${results.length} vérification(s) avec preuve`,
    });
  }

  // État de dépôt : exige une mesure et la commande qui l'a produite.
  if (typeof input.dirtyCount === 'number' && nonEmptyString(input.source)) {
    evidence.push({
      kind: 'REPO_STATE',
      detail: `dirtyCount=${input.dirtyCount} via ${input.source}`,
    });
  }

  // Effet fichier ou inventaire déclaré par un outil, uniquement s'il est
  // marqué observé. Un `{ message }` ne satisfait jamais cette branche.
  if (input.observed === true && nonEmptyString(input.evidenceRef)) {
    evidence.push({
      kind: input.evidenceKind === 'INVENTORY' ? 'INVENTORY' : 'FILE_CHANGE',
      detail: input.evidenceRef,
    });
  }

  // Tâche légitimement sans modification : opt-in explicite, jamais par défaut.
  if (input.noChangeRequired === true && nonEmptyString(input.justification)) {
    evidence.push({ kind: 'EXPLICIT_NO_CHANGE', detail: input.justification });
  }

  return evidence;
}

/** Évalue un résultat et retourne un verdict motivé. */
export function evaluateSuccessClaim(input: unknown): SuccessVerdict {
  if (!isDict(input)) {
    return { successClaimed: false, proven: false, reason: 'objet de résultat invalide', evidence: [] };
  }
  if (!claimsSuccess(input)) {
    return { successClaimed: false, proven: false, reason: 'aucun succès revendiqué', evidence: [] };
  }

  const evidence = collectEvidence(input);
  if (evidence.length === 0) {
    return {
      successClaimed: true,
      proven: false,
      reason: 'succès déclaré sans preuve observée',
      evidence: [],
    };
  }

  return {
    successClaimed: true,
    proven: true,
    reason: `prouvé par ${evidence.map((e) => e.kind).join(', ')}`,
    evidence,
  };
}

/** Lève si le résultat revendique un succès sans preuve observée. */
export function assertProvenSuccess(surface: string, input: unknown): SuccessVerdict {
  const verdict = evaluateSuccessClaim(input);
  if (verdict.successClaimed && !verdict.proven) {
    throw new UnprovenSuccessError(surface, verdict);
  }
  return verdict;
}
