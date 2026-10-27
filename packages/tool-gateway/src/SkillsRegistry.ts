import { z } from 'zod';

export interface SkillDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  handler: (args: any) => Promise<unknown>;
}

export class SkillsRegistry {
  private skills: Map<string, SkillDefinition> = new Map();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  list(): Array<{ name: string; description: string }> {
    return Array.from(this.skills.values()).map((s) => ({
      name: s.name,
      description: s.description,
    }));
  }

  async execute(name: string, args: unknown): Promise<unknown> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill ${name} not found in registry`);
    }
    const validated = skill.parameters.parse(args);
    return await skill.handler(validated);
  }
}
