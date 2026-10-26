import { z } from 'zod';

export const MissionStatusSchema = z.enum([
  'DRAFT',
  'PLANNED',
  'APPROVAL_REQUIRED',
  'APPROVED',
  'RUNNING',
  'VERIFYING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'CANCELLED',
  'BLOCKED',
  'NEEDS_REVIEW',
]);

export const AutonomyLevelSchema = z.enum(['A0', 'A1', 'A2', 'A3', 'A4']);

export const MissionStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED']),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  result: z.unknown().optional(),
  proof: z.string().optional(),
  error: z.string().optional(),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
});

export const EvidenceSchema = z.object({
  type: z.enum(['FILE', 'GIT_STATE', 'COMMAND_OUTPUT', 'TEST_RESULT']),
  description: z.string(),
  value: z.string(),
  timestamp: z.string(),
  verified: z.boolean(),
});

export const MissionResultSchema = z.object({
  summary: z.string(),
  success: z.boolean(),
  artifacts: z.array(z.string()).optional(),
  metrics: z.record(z.number()).optional(),
});

export const MissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: MissionStatusSchema,
  autonomyLevel: AutonomyLevelSchema,
  objective: z.string(),
  constraints: z.array(z.string()),
  successCriteria: z.array(z.string()),
  steps: z.array(MissionStepSchema),
  currentStepIndex: z.number().int().min(0),

  approvalRequired: z.boolean(),
  approvalId: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),

  budgetLimitEur: z.number().min(0),
  budgetUsedEur: z.number().min(0),

  maxDurationMs: z.number().positive(),
  maxAttempts: z.number().int().min(1),
  timeoutAt: z.string(),

  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  failedAt: z.string().optional(),

  evidences: z.array(EvidenceSchema),
  result: MissionResultSchema.optional(),
});
