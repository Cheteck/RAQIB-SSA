import fs from 'fs/promises';
import { PathGuard } from './PathGuard';

export class FileTool {
  constructor(private guard: PathGuard) {}

  async readFile(filePath: string): Promise<string> {
    const check = this.guard.validate(filePath);
    if (!check.allowed) throw new Error(check.reason);
    return await fs.readFile(filePath, 'utf8');
  }

  async listDir(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => e.name);
  }
}
