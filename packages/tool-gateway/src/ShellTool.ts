import { execFile } from 'child_process';
import path from 'path';
import { PathGuard } from './PathGuard';

export interface ShellToolOptions {
  /** Commandes autorisées (basename, insensible à la casse sur Windows). */
  allowedCommands?: string[];
  /** Répertoire racine de confinement pour `cwd`. */
  cwdRoot?: string;
  /** Timeout par défaut (ms). */
  defaultTimeoutMs?: number;
  /** Timeout maximal autorisé (ms). */
  maxTimeoutMs?: number;
  /** Taille maximale de sortie capturée (octets). */
  maxOutputBytes?: number;
  /**
   * Profils d'arguments par commande. Une commande sans profil est refusée
   * quand `enforceArgumentProfiles` est vrai (fail-closed).
   */
  argumentProfiles?: ArgumentProfiles;
  /** Active l'application systématique des profils d'arguments. */
  enforceArgumentProfiles?: boolean;
  /** Hook de politique : refus explicite avant exécution. */
  authorize?: (
    command: string,
    args: string[],
    context: ShellCorrelation,
  ) => { allowed: boolean; reason?: string };
  /** Hook d'audit (started / completed / denied). */
  onEvent?: (event: ShellEvent) => void | Promise<void>;
}

/** Un profil d'arguments : liste de motifs `argv` autorisés. */
export interface ArgumentProfile {
  /** Motif de tokens. `*` = un token, `**` = zéro ou plusieurs tokens restants. */
  args: string[];
  description: string;
}

export type ArgumentProfiles = Record<string, ArgumentProfile[]>;

/** Corrélation propagée de la mission/étape jusqu'à l'audit. */
export interface ShellCorrelation {
  missionId?: string;
  stepId?: string;
  correlationId?: string;
}

export interface ShellExecutionOptions extends ShellCorrelation {
  cwd?: string;
  timeoutMs?: number;
  /**
   * Applique le profil d'inspection READ-ONLY (`READ_ONLY_ARGUMENT_PROFILES`) :
   * seules les commandes d'observation sont autorisées, toute commande capable
   * d'écrire (npm, tsc, vitest, docker, git commit/push/...) est refusée.
   */
  readOnly?: boolean;
}

export type ShellEvent =
  | { type: 'shell.started'; command: string; args: string[]; cwd: string; correlation: ShellCorrelation }
  | {
      type: 'shell.completed';
      command: string;
      args: string[];
      cwd: string;
      exitCode: number;
      durationMs: number;
      timedOut: boolean;
      /** `success` (exit 0), `failure` (exit != 0) ou `timeout`. */
      outcome: 'success' | 'failure' | 'timeout';
      correlation: ShellCorrelation;
    }
  | { type: 'shell.denied'; command: string; args: string[]; reason: string; correlation: ShellCorrelation };

export interface ShellExecutionResult {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/** Erreur de politique : la commande n'a pas été exécutée. */
export class ShellPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShellPolicyError';
  }
}

export const DEFAULT_ALLOWED_COMMANDS = [
  'git',
  'node',
  'npm',
  'npx',
  'tsc',
  'vitest',
  'docker',
  'ls',
  'cat',
  'pwd',
  'echo',
];

const SHELL_METACHARACTERS = /[;&|><`$(){}[\]\\\n\r]/;
const WINDOWS_SHIMS = new Set(['npm', 'npx', 'pnpm', 'yarn', 'tsc', 'vitest']);
const SAFE_ENV_KEYS = new Set([
  'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'SystemDrive',
  'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
  'ComSpec', 'COMSPEC', 'OS', 'SHELL', 'TERM', 'LANG', 'LC_ALL', 'NODE_ENV',
]);

/**
 * Profils d'arguments READ-ONLY pour l'inspection d'un dépôt.
 *
 * Les commandes absentes de ce dictionnaire sont refusées lorsque le profil
 * read-only est actif (fail-closed) : `npm`, `npx`, `tsc`, `vitest`, `docker`
 * ne peuvent donc pas écrire dans le dépôt inspecté pendant une mission.
 */
export const READ_ONLY_ARGUMENT_PROFILES: ArgumentProfiles = {
  git: [
    { args: ['--version'], description: 'git --version' },
    { args: ['status', '**'], description: 'git status' },
    { args: ['rev-parse', '**'], description: 'git rev-parse' },
    { args: ['log', '**'], description: 'git log' },
    { args: ['show', '**'], description: 'git show' },
    { args: ['diff', '**'], description: 'git diff' },
    { args: ['branch', '--list', '**'], description: 'git branch --list' },
    { args: ['branch', '-a'], description: 'git branch -a' },
    { args: ['ls-tree', '**'], description: 'git ls-tree' },
    { args: ['ls-files', '**'], description: 'git ls-files' },
    { args: ['remote', '-v'], description: 'git remote -v' },
    { args: ['describe', '**'], description: 'git describe' },
    { args: ['cat-file', '**'], description: 'git cat-file' },
    { args: ['grep', '**'], description: 'git grep' },
  ],
  node: [
    { args: ['--version'], description: 'node --version' },
    { args: ['-v'], description: 'node -v' },
  ],
  ls: [{ args: ['**'], description: 'ls (lecture seule)' }],
  cat: [{ args: ['**'], description: 'cat (lecture seule)' }],
  pwd: [{ args: [], description: 'pwd' }],
  echo: [{ args: ['**'], description: 'echo' }],
};

/**
 * Vérifie qu'un `argv` correspond à un motif de profil.
 * `*` consomme exactement un token, `**` consomme le reste.
 */
export function matchesArgumentPattern(args: string[], pattern: string[]): boolean {
  const match = (i: number, j: number): boolean => {
    if (j === pattern.length) return i === args.length;
    const token = pattern[j];
    if (token === '**') {
      for (let k = i; k <= args.length; k++) {
        if (match(k, j + 1)) return true;
      }
      return false;
    }
    if (i >= args.length) return false;
    if (token === '*' || token === args[i]) return match(i + 1, j + 1);
    return false;
  };
  return match(0, 0);
}

/**
 * ShellTool — exécution de commandes shell gouvernée.
 *
 * Garanties :
 *  - pas de shell implicite : `execFile` avec un tableau d'arguments ;
 *  - allowlist de commandes (basename) ;
 *  - refus des métacaractères shell dans la forme chaîne ;
 *  - `cwd` confiné par PathGuard quand `cwdRoot` est fourni ;
 *  - timeout borné, sortie bornée ;
 *  - environnement enfant filtré (pas de fuite d'API keys/tokens) ;
 *  - hook `authorize` (PolicyEngine) et hook `onEvent` (AuditLedger).
 */
export class ShellTool {
  private allowed: Set<string>;
  private guard?: PathGuard;
  private defaultTimeoutMs: number;
  private maxTimeoutMs: number;
  private maxOutputBytes: number;
  private argumentProfiles: ArgumentProfiles;
  private enforceArgumentProfiles: boolean;
  private authorize?: ShellToolOptions['authorize'];
  private onEvent?: ShellToolOptions['onEvent'];

  constructor(options: ShellToolOptions = {}) {
    this.allowed = new Set(
      (options.allowedCommands ?? DEFAULT_ALLOWED_COMMANDS).map((c) => this.normalize(c)),
    );
    this.guard = options.cwdRoot ? new PathGuard(options.cwdRoot) : undefined;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
    this.maxTimeoutMs = options.maxTimeoutMs ?? 300_000;
    this.maxOutputBytes = options.maxOutputBytes ?? 1_000_000;
    this.argumentProfiles = options.argumentProfiles ?? {};
    this.enforceArgumentProfiles = options.enforceArgumentProfiles ?? false;
    this.authorize = options.authorize;
    this.onEvent = options.onEvent;
  }

  private normalize(cmd: string): string {
    return process.platform === 'win32' ? cmd.toLowerCase() : cmd;
  }

  private assertArgumentsAllowed(
    base: string,
    args: string[],
    profiles: ArgumentProfiles,
  ): void {
    const profile = profiles[base];
    if (!profile || profile.length === 0) {
      throw new ShellPolicyError(
        `Command '${base}' has no allowed argument profile in this mode`,
      );
    }
    const matched = profile.some((rule) => matchesArgumentPattern(args, rule.args));
    if (!matched) {
      const allowed = profile.map((r) => (r.args.length ? r.args.join(' ') : '(no args)')).join(' | ');
      throw new ShellPolicyError(
        `Arguments not allowed for '${base}': [${args.join(' ')}]. Allowed: ${allowed}`,
      );
    }
  }

  /** Tokenisation sûre de la forme chaîne (pas de shell, pas de métacaractères). */
  parseCommand(command: string | string[]): { cmd: string; args: string[] } {
    if (Array.isArray(command)) {
      if (command.length === 0 || !command[0]) {
        throw new ShellPolicyError('Empty command');
      }
      const [cmd, ...args] = command;
      this.assertSafeArgs([cmd, ...args]);
      return { cmd, args };
    }

    if (typeof command !== 'string' || !command.trim()) {
      throw new ShellPolicyError('Empty command');
    }
    if (SHELL_METACHARACTERS.test(command)) {
      throw new ShellPolicyError(
        'Shell metacharacters are not allowed. Pass an argv array instead of a shell string.',
      );
    }

    const tokens = this.tokenize(command);
    if (tokens.length === 0) {
      throw new ShellPolicyError('Empty command');
    }
    const [cmd, ...args] = tokens;
    this.assertSafeArgs(tokens);
    return { cmd, args };
  }

  private assertSafeArgs(tokens: string[]): void {
    for (const token of tokens) {
      // NUL byte interdit ; les métacaractères sont inertes en execFile mais
      // on les refuse pour éviter toute ambiguïté d'interprétation.
      if (token.includes('\0')) {
        throw new ShellPolicyError('NUL byte in command argument');
      }
    }
  }

  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;
    let hasToken = false;

    for (const ch of input) {
      if (quote) {
        if (ch === quote) {
          quote = null;
        } else {
          current += ch;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        hasToken = true;
        continue;
      }
      if (/\s/.test(ch)) {
        if (hasToken) {
          tokens.push(current);
          current = '';
          hasToken = false;
        }
        continue;
      }
      current += ch;
      hasToken = true;
    }

    if (quote) throw new ShellPolicyError('Unterminated quote in command');
    if (hasToken) tokens.push(current);
    return tokens;
  }

  private resolveCwd(cwd?: string): string {
    if (!this.guard) return cwd ? path.resolve(cwd) : process.cwd();
    const target = cwd ?? '.';
    const check = this.guard.validate(target);
    if (!check.allowed) {
      throw new ShellPolicyError(`Working directory refused: ${check.reason}`);
    }
    return this.guard.resolve(target);
  }

  private sanitizedEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      const upper = key.toUpperCase();
      const isSecret = /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH/.test(upper);
      if (SAFE_ENV_KEYS.has(key) && !isSecret) {
        env[key] = value;
      }
    }
    return env;
  }

  private buildInvocation(cmd: string, args: string[]): { file: string; args: string[]; shell: boolean } {
    const base = this.normalize(path.basename(cmd));
    if (process.platform === 'win32' && WINDOWS_SHIMS.has(base) && !path.extname(cmd)) {
      // Les shims npm/npx/tsc/vitest sont des .cmd : ils nécessitent cmd.exe.
      // Les arguments sont préalablement validés (pas de métacaractères).
      const comspec = process.env.ComSpec || 'cmd.exe';
      const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
      const line = [quote(cmd), ...args.map(quote)].join(' ');
      return { file: comspec, args: ['/d', '/s', '/c', line], shell: false };
    }
    return { file: cmd, args, shell: false };
  }

  async execute(
    command: string | string[],
    options: ShellExecutionOptions = {},
  ): Promise<ShellExecutionResult> {
    const correlation: ShellCorrelation = {
      missionId: options.missionId,
      stepId: options.stepId,
      correlationId: options.correlationId,
    };
    const { cmd, args } = this.parseCommand(command);
    const base = this.normalize(path.basename(cmd));

    if (!this.allowed.has(base)) {
      const reason = `Command '${base}' is not in the shell allowlist`;
      await this.onEvent?.({ type: 'shell.denied', command: base, args, reason, correlation });
      throw new ShellPolicyError(reason);
    }

    // Profils d'arguments : mode read-only explicite, ou profils configurés.
    try {
      if (options.readOnly) {
        this.assertArgumentsAllowed(base, args, READ_ONLY_ARGUMENT_PROFILES);
      } else if (this.enforceArgumentProfiles) {
        this.assertArgumentsAllowed(base, args, this.argumentProfiles);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await this.onEvent?.({ type: 'shell.denied', command: base, args, reason, correlation });
      throw err;
    }

    const cwd = this.resolveCwd(options.cwd);

    if (this.authorize) {
      const decision = this.authorize(base, args, correlation);
      if (!decision.allowed) {
        const reason = decision.reason || 'Denied by policy';
        await this.onEvent?.({ type: 'shell.denied', command: base, args, reason, correlation });
        throw new ShellPolicyError(reason);
      }
    }

    const requested = options.timeoutMs ?? this.defaultTimeoutMs;
    const timeout = Math.max(1, Math.min(requested, this.maxTimeoutMs));
    const { file, args: fileArgs, shell } = this.buildInvocation(cmd, args);

    await this.onEvent?.({ type: 'shell.started', command: base, args, cwd, correlation });

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    let timedOut = false;

    try {
      const res = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFile(
          file,
          fileArgs,
          {
            cwd,
            timeout,
            maxBuffer: this.maxOutputBytes,
            windowsHide: true,
            shell,
            env: this.sanitizedEnv(),
            encoding: 'utf8',
          },
          (err, out, errOut) => {
            if (err) {
              (err as any).stdout = out;
              (err as any).stderr = errOut;
              reject(err);
              return;
            }
            resolve({ stdout: out, stderr: errOut });
          },
        );
      });
      stdout = res.stdout;
      stderr = res.stderr;
    } catch (err: any) {
      stdout = err.stdout ?? '';
      stderr = err.stderr ?? err.message ?? String(err);
      timedOut = err.killed === true || err.signal === 'SIGTERM' || err.code === 'ETIMEDOUT';
      exitCode = typeof err.code === 'number' ? err.code : 1;
    }

    const durationMs = Date.now() - startTime;
    const outcome: 'success' | 'failure' | 'timeout' = timedOut
      ? 'timeout'
      : exitCode === 0
        ? 'success'
        : 'failure';
    const result: ShellExecutionResult = {
      command: base,
      args,
      cwd,
      exitCode,
      stdout,
      stderr,
      durationMs,
      timedOut,
    };

    await this.onEvent?.({
      type: 'shell.completed',
      command: base,
      args,
      cwd,
      exitCode,
      durationMs,
      timedOut,
      outcome,
      correlation,
    });

    return result;
  }
}
