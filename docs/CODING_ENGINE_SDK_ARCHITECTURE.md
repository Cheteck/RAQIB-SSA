# Architecture de référence — Coding Engine SDK

Je recommande de construire un moteur de codage IA indépendant du langage du projet analysé, avec un cœur TypeScript, une intégration FreeLLMAPI et deux modes de déploiement : bibliothèque embarquée et service backend.

L'objectif n'est pas de développer un IDE, ni un simple wrapper autour d'une API de chat. Il s'agit de créer un moteur réutilisable qui peut recevoir une tâche logicielle, comprendre un dépôt, planifier des modifications, produire des patchs, exécuter des validations et restituer un résultat vérifiable.

Je structurerais le projet autour de cinq principes :

1. Provider-agnostic : FreeLLMAPI est le fournisseur initial, pas une dépendance du cœur.

2. Language-agnostic : le moteur fonctionne avec plusieurs langages et outils de build.

3. Tool-driven : les agents utilisent des outils explicites, avec des permissions contrôlées.

4. Execution-safe : chaque modification et commande passe par des politiques d'exécution.

5. Portable : la même logique métier fonctionne en bibliothèque ou derrière une API distante.

## 1. Vue d'ensemble de l'architecture

Applications clientes

Application existante · CLI · CI/CD · Backend métier

Embedded SDK

Appel direct dans le processus

Remote API

HTTP + événements de progression

Application Service / Engine Facade

Tâches · Sessions · Annulation · Permissions · Résultats

Agent Runtime

Planification · Boucle d'outils · Budget

Project Intelligence

Fichiers · Symboles · Langages · Dépendances

Change Management

Patchs · Diff · Validation · Rollback

Execution Runtime

Tests · Build · Lint · Sandbox

Model Gateway Interface

Adaptateurs · Capacités · Streaming · Retry · Traces

FreeLLMAPI

Autres API / modèles locaux

La règle structurante est que le runtime agentique ne doit connaître ni l'interface cliente, ni les détails HTTP de FreeLLMAPI, ni le langage particulier du dépôt.

Il manipule des contrats métier : `CodingTask`, `Workspace`, `ToolCall`, `Patch`, `ValidationResult` et `TaskResult`.

## 2. Découpage en packages

Je commencerais avec un monorepo TypeScript, mais avec des frontières de modules qui permettent d'extraire les composants plus tard.

| Package                     | Responsabilité                                             |
| --------------------------- | ---------------------------------------------------------- |
| `@coding-engine/core`       | Contrats, tâches, événements, erreurs et types communs     |
| `@coding-engine/runtime`    | Boucle agentique, orchestration, budgets et annulation     |
| `@coding-engine/providers`  | Interface modèle et adaptateur FreeLLMAPI                  |
| `@coding-engine/project`    | Exploration du dépôt, contexte, ignore rules et indexation |
| `@coding-engine/tools`      | Outils de lecture, recherche, patch et exécution           |
| `@coding-engine/execution`  | Exécuteurs de commandes, sandbox et timeouts               |
| `@coding-engine/validation` | Tests, build, lint et critères de réussite                 |
| `@coding-engine/storage`    | Sessions, checkpoints et persistance                       |
| `@coding-engine/server`     | API HTTP, authentification et diffusion d'événements       |

Les packages `server` et `storage` sont optionnels pour un usage embarqué minimal. Le cœur, les outils, le runtime et l'adaptateur de modèles sont les éléments fondamentaux.

Je déconseille de créer immédiatement un microservice par package. Des packages distincts dans un seul processus suffisent pour obtenir une architecture modulaire.

## 3. Contrats TypeScript du noyau

Je définirais les contrats avant les agents. Ils constituent la frontière stable entre ton application, le moteur, les fournisseurs IA et les outils.

### 3.1 Tâche de codage

Une tâche doit exprimer l'objectif, les contraintes, les permissions et les critères de réussite.

```typescript
// packages/core/src/task.ts

export type TaskMode =
  | "analyze"
  | "propose"
  | "apply";

export type TaskKind =
  | "generate"
  | "modify"
  | "refactor"
  | "debug"
  | "test"
  | "document"
  | "implement";

export interface CodingTask {
  id?: string;
  kind: TaskKind;
  instruction: string;
  workspaceId: string;

  mode: TaskMode;

  constraints?: {
    allowedPaths?: string[];
    forbiddenPaths?: string[];
    maxFilesChanged?: number;
    maxIterations?: number;
    timeoutMs?: number;
  };

  acceptanceCriteria?: string[];
  metadata?: Record<string, unknown>;
}
```

Le `workspaceId` est une référence vers un workspace enregistré côté moteur, pas un chemin arbitraire fourni par un utilisateur distant.

Le mode `propose` ne doit pas modifier les fichiers. Le mode `apply` autorise les modifications, mais seulement après vérification des permissions et des politiques d'exécution.

### 3.2 Résultat normalisé

Le résultat ne doit pas dépendre du modèle qui a répondu.

```typescript
// packages/core/src/result.ts

export type TaskStatus =
  | "completed"
  | "needs_approval"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface FileChange {
  path: string;
  operation: "create" | "modify" | "delete";
  diff: string;
}

export interface ValidationResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  summary?: string;
  exitCode?: number;
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  summary: string;
  changes: FileChange[];
  validations: ValidationResult[];
  pendingApproval?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
    provider?: string;
  };
}
```

Il faut distinguer `completed` de `needs_approval`. Un patch préparé mais non appliqué ne doit jamais être présenté comme une modification terminée.

### 3.3 Événements et progression

Pour permettre aux applications embarquées comme aux services distants d'afficher une progression, je choisirais des événements typés.

```typescript
// packages/core/src/events.ts

export type CodingEvent =
  | {
      type: "task.started";
      taskId: string;
    }
  | {
      type: "plan.created";
      taskId: string;
      steps: string[];
    }
  | {
      type: "tool.started";
      taskId: string;
      toolName: string;
    }
  | {
      type: "tool.completed";
      taskId: string;
      toolName: string;
      durationMs: number;
    }
  | {
      type: "patch.proposed";
      taskId: string;
      files: string[];
    }
  | {
      type: "validation.completed";
      taskId: string;
      result: ValidationResult;
    }
  | {
      type: "task.completed";
      taskId: string;
      status: TaskStatus;
    };
```

Les erreurs doivent également être normalisées : `ProviderUnavailable`, `QuotaExceeded`, `ModelCapabilityMismatch`, `ToolPermissionDenied`, `PatchRejected`, `ExecutionTimeout` et `TaskCancelled`.

Cette normalisation permettra de traiter de manière cohérente une panne de FreeLLMAPI, un quota épuisé ou une erreur de compilation.

## 4. Interfaces des composants

### 4.1 Fournisseur de modèles

L'adaptateur FreeLLMAPI doit être un composant remplaçable.

```typescript
// packages/providers/src/provider.ts

export interface ModelCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  maxContextTokens?: number;
}

export interface ModelRequest {
  model: string;
  messages: ModelMessage[];
  tools?: ModelToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface ModelResponse {
  message: ModelMessage;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  servedModel?: string;
  routedVia?: string;
}

export interface ModelProvider {
  readonly id: string;

  complete(
    request: ModelRequest
  ): Promise<ModelResponse>;

  stream?(
    request: ModelRequest
  ): AsyncIterable<ModelStreamEvent>;

  listModels?(): Promise<ModelInfo[]>;
}
```

### 4.2 Adaptateur FreeLLMAPI

FreeLLMAPI expose une API compatible OpenAI, avec `POST /v1/chat/completions`, le streaming, les appels d'outils et les informations de routage dans `X-Routed-Via`.

L'adaptateur s'appuie sur le client OpenAI ou des requêtes HTTP directes.

```typescript
// packages/providers/src/freellmapi.ts

export interface FreeLLMAPIConfig {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs?: number;
}
```

### 4.3 Workspace et exploration du projet

```typescript
// packages/project/src/workspace.ts

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

  listFiles(options?: {
    include?: string[];
    exclude?: string[];
    maxFiles?: number;
  }): Promise<WorkspaceFile[]>;

  readFile(path: string): Promise<string>;

  exists(path: string): Promise<boolean>;
}

export interface LanguageAdapter {
  readonly id: string;
  readonly extensions: string[];

  detect(workspace: Workspace): Promise<boolean>;

  inspect?(
    workspace: Workspace
  ): Promise<ProjectInspection>;
}
```

### 4.4 Outils contrôlés

```typescript
// packages/tools/src/tool.ts

export interface ToolContext {
  taskId: string;
  workspace: Workspace;
  signal: AbortSignal;
}

export interface ToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: unknown;

  execute(
    input: TInput,
    context: ToolContext
  ): Promise<TOutput>;
}

export interface ToolRegistry {
  register<TInput, TOutput>(
    tool: ToolDefinition<TInput, TOutput>
  ): void;

  get(name: string):
    | ToolDefinition<unknown, unknown>
    | undefined;

  list(): ToolDefinition<unknown, unknown>[];
}
```

## 5. Runtime agentique : le cœur du moteur

```typescript
// packages/runtime/src/engine.ts

export interface ExecuteOptions {
  signal?: AbortSignal;
  onEvent?: (event: CodingEvent) => void;
}

export interface CodingEngine {
  execute(
    task: CodingTask,
    options?: ExecuteOptions
  ): Promise<TaskResult>;

  approve(
    taskId: string,
    approvalId: string
  ): Promise<TaskResult>;

  cancel(taskId: string): Promise<void>;
}
```

## 6. Gestion des changements et validation

```typescript
// packages/validation/src/validator.ts

export interface ValidationContext {
  workspace: Workspace;
  changedFiles: string[];
  signal: AbortSignal;
}

export interface Validator {
  readonly id: string;

  supports(
    project: ProjectInspection
  ): boolean;

  validate(
    context: ValidationContext
  ): Promise<ValidationResult[]>;
}
```

## 7. Couche d'abstraction globale

```typescript
export interface WorkspaceResolver {
  resolve(workspaceId: string): Promise<Workspace>;
}

export interface TaskStore {
  create(task: CodingTask): Promise<void>;
  get(taskId: string): Promise<TaskRecord | undefined>;
  update(record: TaskRecord): Promise<void>;
}

export interface CommandExecutor {
  execute(
    command: AllowedCommand,
    context: ExecutionContext
  ): Promise<CommandResult>;
}
```
