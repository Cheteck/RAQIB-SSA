import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  ActionType,
  AutonomyLevel,
  PolicyDecision,
  AuditEvent,
} from '@raqib/shared';
import { createBuiltinRules, BuiltinRule } from './rules/BuiltinRules';

export interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}

export interface ApprovalRequest {
  missionId: string;
  actionType: ActionType;
  resource: string;
  estimatedCostEur: number;
  maxDurationMs: number;
  justification: string;
  expiresAt: string;
}

export type ApprovalStatus = 'PENDING' | 'GRANTED' | 'CONSUMED' | 'EXPIRED' | 'REJECTED';

export interface PolicyRequest {
  missionId: string;
  actor: string;
  actionType: ActionType;
  resource: string;
  autonomyLevel: AutonomyLevel;
  estimatedCostEur?: number;
  metadata?: Record<string, unknown>;
}

export interface ApprovalRecord {
  id: string;
  missionId: string;
  actionType: string;
  resource: string;
  estimatedCostEur: number;
  maxDurationMs: number;
  justification: string;
  expiresAt: string;
  status: ApprovalStatus;
  grantedBy: string | null;
  consumedAt: string | null;
  createdAt: number;
}


export class PolicyEngine {
  private db: Database.Database;
  private logger: AuditLogger | null = null;
  private builtinRules: BuiltinRule[];

  constructor(options: {
    dbPath: string;
    logger?: AuditLogger;
  }) {
    this.db = new Database(options.dbPath);
    this.logger = options.logger ?? null;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approvals (
        id              TEXT PRIMARY KEY,
        mission_id      TEXT NOT NULL,
        action_type     TEXT NOT NULL,
        resource        TEXT NOT NULL,
        estimated_cost  REAL NOT NULL DEFAULT 0,
        max_duration_ms INTEGER NOT NULL,
        justification   TEXT NOT NULL,
        expires_at      TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'PENDING',
        granted_by      TEXT,
        consumed_at     TEXT,
        created_at      INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_approvals_mission ON approvals(mission_id);
      CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

      CREATE TABLE IF NOT EXISTS budgets (
        mission_id  TEXT PRIMARY KEY,
        limit_eur   REAL NOT NULL,
        used_eur    REAL NOT NULL DEFAULT 0,
        updated_at  INTEGER DEFAULT (unixepoch())
      );
    `);

    this.builtinRules = createBuiltinRules(
      () => this.isReadOnlyMode(),
      () => this.isEmergencyStop(),
    );
  }

  isEmergencyStop(): boolean {
    if (process.env.RAQIB_EMERGENCY_STOP === 'true') return true;
    try {
      const lockPath = path.join(process.cwd(), 'data', 'emergency.lock');
      return fs.existsSync(lockPath);
    } catch {
      return false;
    }
  }

  isReadOnlyMode(): boolean {
    return process.env.RAQIB_READ_ONLY_MODE === 'true';
  }

  authorize(req: PolicyRequest): PolicyDecision {
    const now = new Date().toISOString();
    for (const rule of this.builtinRules) {
      const result = rule.check(req.actionType, req.resource, req.metadata);
      if (!result.allowed) {
        const decision: PolicyDecision = {
          allowed: false,
          reason: result.reason,
          ruleId: rule.id,
          timestamp: now,
        };
        this.logDecision('DENY', req, decision);
        return decision;
      }
    }

    if (req.estimatedCostEur && req.estimatedCostEur > 0) {
      const budgetResult = this.checkBudget(req.missionId, req.estimatedCostEur);
      if (!budgetResult.allowed) {
        this.logDecision('DENY', req, budgetResult);
        return budgetResult;
      }
    }

    const decision: PolicyDecision = {
      allowed: true,
      reason: 'Authorized',
      timestamp: now,
    };
    this.logDecision('ALLOW', req, decision);
    return decision;
  }

  setBudget(missionId: string, limitEur: number): void {
    this.db.prepare(
      `INSERT INTO budgets (mission_id, limit_eur, used_eur, updated_at)
       VALUES (?, ?, 0, unixepoch())
       ON CONFLICT(mission_id) DO UPDATE SET limit_eur=?, updated_at=unixepoch()`,
    ).run(missionId, limitEur, limitEur);
  }

  checkBudget(missionId: string, estimatedCost: number): PolicyDecision {
    const row = this.db
      .prepare('SELECT limit_eur, used_eur FROM budgets WHERE mission_id = ?')
      .get(missionId) as { limit_eur: number; used_eur: number } | undefined;

    if (!row) {
      return {
        allowed: false,
        reason: `No budget initialized for mission ${missionId}`,
        ruleId: 'BUDGET-001',
        timestamp: new Date().toISOString(),
      };
    }

    if (row.used_eur + estimatedCost > row.limit_eur) {
      return {
        allowed: false,
        reason: `Budget exceeded: ${(row.used_eur).toFixed(2)}/${row.limit_eur} EUR`,
        ruleId: 'BUDGET-002',
        timestamp: new Date().toISOString(),
      };
    }

    return { allowed: true, reason: 'Budget OK', timestamp: new Date().toISOString() };
  }

  async deductBudget(missionId: string, amount: number): Promise<{
    success: boolean;
    remaining: number;
  }> {
    const tx = this.db.transaction(() => {
      const row = this.db
        .prepare('SELECT limit_eur, used_eur FROM budgets WHERE mission_id = ?')
        .get(missionId) as { limit_eur: number; used_eur: number } | undefined;

      if (!row) return { success: false, remaining: 0 };
      if (row.used_eur + amount > row.limit_eur) return { success: false, remaining: 0 };

      this.db
        .prepare('UPDATE budgets SET used_eur = used_eur + ?, updated_at = unixepoch() WHERE mission_id = ?')
        .run(amount, missionId);

      return { success: true, remaining: row.limit_eur - row.used_eur - amount };
    });
    return tx();
  }

  getBudget(missionId: string): { limitEur: number; usedEur: number } | null {
    const row = this.db
      .prepare('SELECT limit_eur as limitEur, used_eur as usedEur FROM budgets WHERE mission_id = ?')
      .get(missionId);
    return row as { limitEur: number; usedEur: number } | null;
  }

  async requestApproval(req: ApprovalRequest): Promise<string> {
    const approvalId = `appr-${req.missionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.db.prepare(
      `INSERT INTO approvals (id, mission_id, action_type, resource, estimated_cost,
       max_duration_ms, justification, expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    ).run(
      approvalId,
      req.missionId,
      req.actionType,
      req.resource,
      req.estimatedCostEur,
      req.maxDurationMs,
      req.justification,
      req.expiresAt,
    );

    await this.logger?.log({
      id: `evt-approval-request-${approvalId}`,
      timestamp: new Date().toISOString(),
      type: 'APPROVAL_REQUEST',
      missionId: req.missionId,
      actor: 'raqib-core',
      data: { approvalId, actionType: req.actionType, resource: req.resource },
    });

    return approvalId;
  }

  async grantApproval(approvalId: string, grantedBy: string): Promise<boolean> {
    const result = this.db
      .prepare(`UPDATE approvals SET status = 'GRANTED', granted_by = ? WHERE id = ? AND status = 'PENDING'`)
      .run(grantedBy, approvalId);

    if (result.changes === 0) return false;

    await this.logger?.log({
      id: `evt-approval-granted-${approvalId}`,
      timestamp: new Date().toISOString(),
      type: 'APPROVAL_GRANTED',
      actor: grantedBy,
      data: { approvalId, grantedBy },
    });

    return true;
  }

  listApprovals(status?: string): ApprovalRecord[] {
    const rows = status
      ? this.db
          .prepare(
            `SELECT id, mission_id as missionId, action_type as actionType, resource,
                    estimated_cost as estimatedCostEur, max_duration_ms as maxDurationMs,
                    justification, expires_at as expiresAt, status, granted_by as grantedBy,
                    consumed_at as consumedAt, created_at as createdAt
             FROM approvals WHERE status = ? ORDER BY created_at DESC`,
          )
          .all(status)
      : this.db
          .prepare(
            `SELECT id, mission_id as missionId, action_type as actionType, resource,
                    estimated_cost as estimatedCostEur, max_duration_ms as maxDurationMs,
                    justification, expires_at as expiresAt, status, granted_by as grantedBy,
                    consumed_at as consumedAt, created_at as createdAt
             FROM approvals ORDER BY created_at DESC`,
          )
          .all();
    return rows as ApprovalRecord[];
  }

  getApproval(approvalId: string): ApprovalRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, mission_id as missionId, action_type as actionType, resource,
                estimated_cost as estimatedCostEur, max_duration_ms as maxDurationMs,
                justification, expires_at as expiresAt, status, granted_by as grantedBy,
                consumed_at as consumedAt, created_at as createdAt
         FROM approvals WHERE id = ?`,
      )
      .get(approvalId);
    return (row as ApprovalRecord) ?? null;
  }

  async rejectApproval(approvalId: string, rejectedBy: string): Promise<boolean> {
    const result = this.db
      .prepare(`UPDATE approvals SET status = 'REJECTED', granted_by = ? WHERE id = ? AND status = 'PENDING'`)
      .run(rejectedBy, approvalId);

    if (result.changes === 0) return false;

    await this.logger?.log({
      id: `evt-approval-rejected-${approvalId}`,
      timestamp: new Date().toISOString(),
      type: 'APPROVAL_REJECTED',
      actor: rejectedBy,
      data: { approvalId, rejectedBy },
    });

    return true;
  }


  isApprovalValid(approvalId: string, req: PolicyRequest): boolean {
    const row = this.db
      .prepare(
        `SELECT status, action_type, resource, expires_at FROM approvals WHERE id = ?`,
      )
      .get(approvalId) as {
        status: ApprovalStatus;
        action_type: string;
        resource: string;
        expires_at: string;
      } | undefined;

    if (!row) return false;
    if (row.status !== 'GRANTED') return false;
    if (row.action_type !== req.actionType) return false;
    if (row.resource !== req.resource) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) return false;

    return true;
  }

  async consumeApproval(approvalId: string): Promise<boolean> {
    const result = this.db
      .prepare(
        `UPDATE approvals SET status = 'CONSUMED', consumed_at = ? WHERE id = ? AND status = 'GRANTED'`,
      )
      .run(new Date().toISOString(), approvalId);

    return result.changes > 0;
  }

  private logDecision(
    verdict: 'ALLOW' | 'DENY',
    req: PolicyRequest,
    decision: PolicyDecision,
  ): void {
    this.logger?.log({
      id: `evt-policy-${verdict}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: decision.timestamp,
      type: 'POLICY_DECISION',
      missionId: req.missionId,
      stepId: typeof req.metadata?.stepId === 'string' ? req.metadata.stepId : undefined,
      correlationId:
        typeof req.metadata?.correlationId === 'string' ? req.metadata.correlationId : undefined,
      actor: req.actor,
      data: {
        verdict,
        actionType: req.actionType,
        resource: req.resource,
        reason: decision.reason,
        ruleId: decision.ruleId,
        allowed: decision.allowed,
      },
    });
  }

  close(): void {
    this.db.close();
  }
}
