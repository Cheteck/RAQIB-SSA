import fs from 'fs/promises';
import path from 'path';
import { PathGuard } from './PathGuard';

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export class FileTool {
  constructor(private guard: PathGuard) {}

  async readFile(filePath: string): Promise<string> {
    const check = this.guard.validate(filePath);
    if (!check.allowed) throw new Error(check.reason);
    return await fs.readFile(filePath, 'utf8');
  }

  async readManifest(filePath: string): Promise<unknown> {
    const content = await this.readFile(filePath);
    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    }
    return content;
  }

  async listDir(dirPath: string): Promise<DirEntry[]> {
    const check = this.guard.validate(dirPath);
    if (!check.allowed) throw new Error(check.reason);

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
    }));
  }

  async findByPattern(root: string, patterns: string[]): Promise<string[]> {
    const check = this.guard.validate(root);
    if (!check.allowed) throw new Error(check.reason);

    const results: string[] = [];
    const walk = async (dir: string) => {
      const entries = await this.listDir(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory) {
          if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
            await walk(fullPath);
          }
        } else if (entry.isFile) {
          const match = patterns.some((p) => {
            if (p.startsWith('*.')) {
              return entry.name.endsWith(p.slice(1));
            }
            return entry.name.includes(p);
          });
          if (match) {
            results.push(fullPath);
          }
        }
      }
    };

    await walk(root);
    return results;
  }
}
