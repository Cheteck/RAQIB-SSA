import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { LocalWorkspace } from '../../coding-engine/packages/project/src/workspace';
import { inspectProjectTool, searchCodeTool } from '../../coding-engine/packages/tools/src/advanced';

describe('Coding Engine Multi-Language & Tool Suite', () => {
  const testDir = path.join(process.cwd(), 'data', 'test-multi-lang');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('inspects TypeScript workspace setup correctly', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }), 'utf8');
    const workspace = new LocalWorkspace({ id: 'ws-ts', root: testDir });

    const result = await inspectProjectTool.execute({}, { taskId: 't-ts', workspace });
    expect(result.detectedLanguage).toBe('typescript');
    expect(result.inspection.buildScript).toBe('npm run build');
  });

  it('inspects Python workspace setup correctly', async () => {
    fs.writeFileSync(path.join(testDir, 'pyproject.toml'), '[tool.poetry]\nname = "demo"', 'utf8');
    const workspace = new LocalWorkspace({ id: 'ws-py', root: testDir });

    const result = await inspectProjectTool.execute({}, { taskId: 't-py', workspace });
    expect(result.detectedLanguage).toBe('python');
    expect(result.inspection.testScript).toBe('pytest');
  });

  it('searches workspace code symbols using searchCodeTool', async () => {
    fs.writeFileSync(path.join(testDir, 'main.py'), 'def calculate_sum(a, b):\n    return a + b\n', 'utf8');
    const workspace = new LocalWorkspace({ id: 'ws-search', root: testDir });

    const result = await searchCodeTool.execute({ query: 'calculate_sum' }, { taskId: 't-search', workspace });
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].path).toBe('main.py');
    expect(result.matches[0].line).toBe(1);
  });
});
