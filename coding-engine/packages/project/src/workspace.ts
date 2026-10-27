import fs from "fs";
import path from "path";

export interface WorkspaceInfo {
  id: string;
  root: string;
}

export interface WorkspaceFile {
  path: string;
  language?: string;
  size: number;
}

export interface Workspace {
  getInfo(): Promise<WorkspaceInfo>;
  listFiles(options?: { include?: string[]; exclude?: string[]; maxFiles?: number }): Promise<WorkspaceFile[]>;
  readFile(filePath: string): Promise<string>;
  exists(filePath: string): Promise<boolean>;
  writeFile?(filePath: string, content: string): Promise<void>;
}

export class LocalWorkspace implements Workspace {
  constructor(private info: WorkspaceInfo) {}

  async getInfo(): Promise<WorkspaceInfo> {
    return this.info;
  }

  async listFiles(): Promise<WorkspaceFile[]> {
    if (!fs.existsSync(this.info.root)) return [];
    const files = fs.readdirSync(this.info.root);
    return files.map((f) => {
      const full = path.join(this.info.root, f);
      const stat = fs.statSync(full);
      return { path: f, size: stat.size };
    });
  }

  async readFile(filePath: string): Promise<string> {
    const full = path.join(this.info.root, filePath);
    return fs.readFileSync(full, "utf8");
  }

  async exists(filePath: string): Promise<boolean> {
    const full = path.join(this.info.root, filePath);
    return fs.existsSync(full);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const full = path.join(this.info.root, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
  }
}
