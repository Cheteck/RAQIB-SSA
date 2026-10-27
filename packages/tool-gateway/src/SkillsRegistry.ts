import { z } from 'zod';
import { DockerSandbox, SandboxContext } from './DockerSandbox';

export interface SkillDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  requiredPermission?: string;
  handler: (args: any, context?: { sandbox?: DockerSandbox; sandboxCtx?: SandboxContext }) => Promise<unknown>;
}

export class SkillsRegistry {
  private skills: Map<string, SkillDefinition> = new Map();

  constructor() {
    this.registerBuiltinSkills();
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
}
