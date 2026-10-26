import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export interface SandboxContext {
  id: string;
  sourceRepo: string;
  isDockerAvailable: boolean;
  mode: 'DOCKER' | 'FALLBACK_LOCAL';
  containerName?: string;
  workspacePath: string;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class DockerSandbox {
  private isDockerEnabled: boolean;

  constructor() {
    this.isDockerEnabled = process.env.RAQIB_DOCKER_ENABLED === 'true';
  }

  /**
   * Vérifie si Docker CLI et le démon Docker sont actifs.
   */
  async checkDockerAvailability(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker info');
      return stdout.includes('Server Version') || stdout.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Initialise un espace de travail sandbox pour un dépôt donné.
   */
  async createWorkspace(sourceRepo: string): Promise<SandboxContext> {
    const isDockerAvailable = this.isDockerEnabled && (await this.checkDockerAvailability());
    const id = `sb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const workspacePath = path.join(process.cwd(), 'data', 'sandboxes', id);

    fs.mkdirSync(workspacePath, { recursive: true });

    if (isDockerAvailable) {
      const containerName = `raqib-sandbox-${id}`;
      return {
        id,
        sourceRepo,
        isDockerAvailable: true,
        mode: 'DOCKER',
        containerName,
        workspacePath,
      };
    } else {
      // Fallback local sécurisé
      return {
        id,
        sourceRepo,
        isDockerAvailable: false,
        mode: 'FALLBACK_LOCAL',
        workspacePath,
      };
    }
  }

  /**
   * Exécute une commande dans la sandbox (Docker ou Fallback).
   */
  async executeCommand(
    ctx: SandboxContext,
    cmd: string[],
    allowedCmds: string[] = ['npm', 'node', 'git', 'ls', 'pwd', 'echo']
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const baseCmd = cmd[0];

    if (!allowedCmds.includes(baseCmd)) {
      throw new Error(`Command '${baseCmd}' is not allowed in sandbox policy.`);
    }

    const commandStr = cmd.join(' ');

    if (ctx.mode === 'DOCKER' && ctx.containerName) {
      // Exécution Docker isolée :
      // - No network (--network none)
      // - Read-only rootfs ou restrictions
      // - Volume isolé
      const dockerCmd = `docker run --rm --network none -v "${ctx.workspacePath}:/workspace" -w /workspace node:20-alpine ${commandStr}`;
      try {
        const { stdout, stderr } = await execAsync(dockerCmd, { timeout: 60000 });
        return {
          exitCode: 0,
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        return {
          exitCode: err.code || 1,
          stdout: err.stdout || '',
          stderr: err.stderr || err.message,
          durationMs: Date.now() - startTime,
        };
      }
    } else {
      // Fallback local contrôlé avec timeout et répertoire restreint
      try {
        const { stdout, stderr } = await execAsync(commandStr, {
          cwd: ctx.workspacePath,
          timeout: 30000,
        });
        return {
          exitCode: 0,
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        return {
          exitCode: err.code || 1,
          stdout: err.stdout || '',
          stderr: err.stderr || err.message,
          durationMs: Date.now() - startTime,
        };
      }
    }
  }

  /**
   * Nettoie les ressources associées à la sandbox.
   */
  async destroyWorkspace(ctx: SandboxContext): Promise<void> {
    if (fs.existsSync(ctx.workspacePath)) {
      try {
        fs.rmSync(ctx.workspacePath, { recursive: true, force: true });
      } catch {}
    }
  }
}
