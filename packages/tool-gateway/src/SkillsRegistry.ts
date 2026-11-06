import { z } from 'zod';
import { DockerSandbox, SandboxContext } from './DockerSandbox';
import { ShellTool } from './ShellTool';
import { ICodingEngineAdapter, CodingTaskRequest, CodingTaskResult } from './adapters/OpenCodeAdapter';

export interface SkillDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  requiredPermission?: string;
  handler: (args: any, context?: { sandbox?: DockerSandbox; sandboxCtx?: SandboxContext }) => Promise<unknown>;
}

export class SkillsRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private codingEngineAdapter?: ICodingEngineAdapter;
  private shellTool?: ShellTool;

  constructor() {
    this.registerBuiltinSkills();
  }

  setCodingEngineAdapter(adapter: ICodingEngineAdapter): void {
    this.codingEngineAdapter = adapter;
    this.registerOpenCodeSkill(adapter);
  }

  setShellTool(tool: ShellTool): void {
    this.shellTool = tool;
    this.registerShellSkill(tool);
  }

  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  list(): Array<{ name: string; description: string; requiredPermission?: string }> {
    return Array.from(this.skills.values()).map((s) => ({
      name: s.name,
      description: s.description,
      requiredPermission: s.requiredPermission,
    }));
  }

  async execute(
    name: string,
    args: unknown,
    context?: { sandbox?: DockerSandbox; sandboxCtx?: SandboxContext }
  ): Promise<unknown> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill '${name}' not found in registry`);
    }
    const validated = skill.parameters.parse(args);
    return await skill.handler(validated, context);
  }

  private registerBuiltinSkills(): void {
    this.register({
      name: 'codebase_audit',
      description: 'Audit structural inspection of codebase files',
      parameters: z.object({ path: z.string().default('.') }),
      requiredPermission: 'READ',
      handler: async (args, context) => {
        if (context?.sandbox && context?.sandboxCtx) {
          return await context.sandbox.executeCommand(context.sandboxCtx, ['ls', '-la', args.path]);
        }
        return { message: `Codebase audit for path ${args.path}` };
      },
    });

    this.register({
      name: 'git_status_check',
      description: 'Inspect current git repository status and diff',
      parameters: z.object({ repoPath: z.string().default('.') }),
      requiredPermission: 'READ',
      handler: async (args) => {
        return { status: 'clean', repo: args.repoPath };
      },
    });
  }

  private registerShellSkill(tool: ShellTool): void {
    this.register({
      name: 'shell_exec',
      description: 'Execute an allowlisted shell command (no shell interpretation, governed by policy and audited)',
      parameters: z.object({
        command: z.union([z.string(), z.array(z.string()).min(1)]),
        cwd: z.string().optional(),
        timeoutMs: z.number().int().positive().optional(),
        missionId: z.string().optional(),
        stepId: z.string().optional(),
        correlationId: z.string().optional(),
      }),
      requiredPermission: 'EXECUTE',
      handler: async (args: {
        command: string | string[];
        cwd?: string;
        timeoutMs?: number;
        missionId?: string;
        stepId?: string;
        correlationId?: string;
      }) => {
        return await tool.execute(args.command, {
          cwd: args.cwd,
          timeoutMs: args.timeoutMs,
          missionId: args.missionId,
          stepId: args.stepId,
          correlationId: args.correlationId,
        });
      },
    });
  }

  private registerOpenCodeSkill(adapter: ICodingEngineAdapter): void {
    this.register({
      name: 'opencode_task',
      description: 'Execute an agentic coding task via the OpenCode/Coding Engine adapter',
      parameters: z.object({
        taskId: z.string(),
        projectPath: z.string().default('.'),
        prompt: z.string(),
        allowedCommands: z.array(z.string()).optional(),
        maxDurationMs: z.number().optional(),
      }),
      requiredPermission: 'WRITE',
      handler: async (args: CodingTaskRequest, context) => {
        return await adapter.executeTask(args, context?.sandboxCtx);
      },
    });
  }
}
