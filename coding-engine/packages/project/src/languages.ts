import { Workspace } from "./workspace";

export interface ProjectInspection {
  language: "typescript" | "python" | "generic";
  buildScript?: string;
  testScript?: string;
  lintScript?: string;
}

export interface LanguageAdapter {
  readonly id: string;
  readonly extensions: string[];
  detect(workspace: Workspace): Promise<boolean>;
  inspect(workspace: Workspace): Promise<ProjectInspection>;
}

export class TypeScriptLanguageAdapter implements LanguageAdapter {
  public readonly id = "typescript";
  public readonly extensions = [".ts", ".tsx", ".js", ".jsx"];

  async detect(workspace: Workspace): Promise<boolean> {
    return (await workspace.exists("package.json")) || (await workspace.exists("tsconfig.json"));
  }

  async inspect(workspace: Workspace): Promise<ProjectInspection> {
    let buildScript: string | undefined;
    let testScript: string | undefined;

    if (await workspace.exists("package.json")) {
      try {
        const content = await workspace.readFile("package.json");
        const pkg = JSON.parse(content);
        if (pkg.scripts?.build) buildScript = "npm run build";
        if (pkg.scripts?.test) testScript = "npm test";
      } catch {}
    }

    return {
      language: "typescript",
      buildScript: buildScript || "npx tsc --noEmit",
      testScript: testScript || "npx vitest run",
    };
  }
}

export class PythonLanguageAdapter implements LanguageAdapter {
  public readonly id = "python";
  public readonly extensions = [".py"];

  async detect(workspace: Workspace): Promise<boolean> {
    return (await workspace.exists("pyproject.toml")) || (await workspace.exists("setup.py")) || (await workspace.exists("requirements.txt"));
  }

  async inspect(workspace: Workspace): Promise<ProjectInspection> {
    return {
      language: "python",
      testScript: "pytest",
    };
  }
}
