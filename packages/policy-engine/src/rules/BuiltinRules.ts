import { ActionType, PolicyDecision } from '@raqib/shared';

/**
 * Règles codées en dur — jamais contournables.
 * Appliquées AVANT tout appel au PolicyEngine.
 */
export interface BuiltinRule {
  id: string;
  name: string;
  /** Retourne { allowed: false, reason } si la règle bloque, sinon { allowed: true, reason: '' } */
  check(actionType: ActionType, resource: string, metadata?: Record<string, unknown>): {
    allowed: boolean;
    reason: string;
  };
}

const SECRET_PATTERNS = ['.env', '.key', '.pem', 'credentials', '.secret', 'id_rsa', 'id_ed25519'];
const READ_ONLY_ACTIONS: ActionType[] = ['READ', 'INVENTORY', 'READ_ONLY_INVENTORY'];
const WRITE_ACTIONS: ActionType[] = ['WRITE', 'CREATE', 'DELETE', 'EXECUTE', 'EXECUTE_DESTRUCTIVE'];

export function createBuiltinRules(
  isReadOnly: boolean,
  isEmergencyStop: boolean,
): BuiltinRule[] {
  return [
    // 1 — Emergency Stop
    {
      id: 'RULE-001',
      name: 'Emergency Stop',
      check: () => {
        if (isEmergencyStop) {
          return { allowed: false, reason: 'Emergency stop active: all actions denied' };
        }
        return { allowed: true, reason: '' };
      },
    },

    // 2 — Read-only mode bloque WRITE/CREATE/DELETE/EXECUTE_DESTRUCTIVE
    {
      id: 'RULE-002',
      name: 'Read-only Mode',
      check: (actionType) => {
        if (isReadOnly && WRITE_ACTIONS.includes(actionType)) {
          return { allowed: false, reason: 'Read-only mode active: write actions denied' };
        }
        return { allowed: true, reason: '' };
      },
    },

    // 3 — Accès aux fichiers secrets
    {
      id: 'RULE-003',
      name: 'Secret File Access',
      check: (_, resource) => {
        const lower = resource.toLowerCase();
        if (SECRET_PATTERNS.some((p) => lower.includes(p))) {
          return { allowed: false, reason: 'Access denied: sensitive file' };
        }
        return { allowed: true, reason: '' };
      },
    },

    // 4 — NETWORK_REQUEST sans autorisation explicite
    {
      id: 'RULE-004',
      name: 'Network Request',
      check: (actionType) => {
        if (actionType === 'NETWORK_REQUEST') {
          return {
            allowed: false,
            reason: 'Network requests require explicit authorization',
          };
        }
        return { allowed: true, reason: '' };
      },
    },

    // 5 — Policy decision via modèle IA → DENY (routing = "none")
    {
      id: 'RULE-005',
      name: 'AI Policy Decision',
      check: (_, _, metadata) => {
        if (metadata?.aiPolicyDecision === true) {
          return {
            allowed: false,
            reason: 'AI models cannot make policy decisions',
          };
        }
        return { allowed: true, reason: '' };
      },
    },

    // 6 — Auto-modification CONSTITUTION.md
    {
      id: 'RULE-006',
      name: 'Constitution Protection',
      check: (_, resource) => {
        if (resource.includes('CONSTITUTION.md')) {
          return { allowed: false, reason: 'Auto-modification of CONSTITUTION.md is forbidden' };
        }
        return { allowed: true, reason: '' };
      },
    },

    // 7 — Auto-augmentation permissions ou budget
    {
      id: 'RULE-007',
      name: 'Self-Permission Boost',
      check: (_, _, metadata) => {
        if (metadata?.selfPermissionBoost === true || metadata?.budgetIncrease === true) {
          return {
            allowed: false,
            reason: 'Self-augmentation of permissions/budget is forbidden',
          };
        }
        return { allowed: true, reason: '' };
      },
    },
  ];
}
