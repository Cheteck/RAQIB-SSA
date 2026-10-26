# 🛡️ RAQIB — Plan d'Implémentation Détaillé pour Agent

> **Usage** : Ce document est le prompt opérationnel pour un agent de développement (Antigravity, OpenCode, etc.).
> Il traduit le PRD et les docs en tâches concrètes, fichiers à créer, critères d'acceptation et garde-fous.
>
> **Règle absolue** : Aucune phase ne démarre sans validation de la porte précédente.
> **Périmètre actuel** : Lecture seule uniquement jusqu'à validation de la Phase 4.

---

## 📍 État du dépôt (mis à jour au fil de l'avancement)

```
d:\Projets\RAQIB-SSA\
├── .env.local                 ✅ Configuré (FreeLLMAPI, MosaiX path, budgets)
├── tsconfig.json              ✅ TS strict, CommonJS, ES2022
├── config/
│   ├── providers.json         ✅ Configuré (freellmapi actif, ollama désactivé)
│   └── README.md              ✅ Exemple de politiques
├── docs/
│   ├── ARCHITECTURE.md        ✅ Gelé v1.0
│   ├── CONSTITUTION.md        ✅ Gelé v1.0
│   ├── SECURITY.md            ✅ Gelé v1.0
│   ├── RAQIB-001_SPEC.md      ✅ Mission spec complète
│   ├── GUIDE_DEMARRAGE.md     ✅ Guide opérationnel
│   └── PLAN_IMPLEMENTATION.md ✅ Plan de haut niveau
├── packages/
│   ├── shared/src/types.ts    ✅ IModelProvider + Mission types (1.1)
│   ├── core/src/              ✅ Mission, MissionSchema (2.1)
│   ├── mission-engine/src/    ✅ MissionEngine + StateMachine (2.2)
│   ├── model-gateway/src/     ✅ Finalisé (4) : budget, retry, health, filter
│   ├── policy-engine/src/     ✅ PolicyEngine + BuiltinRules + EmergencyStop (1.3 + 3.1 + 3.2)
│   ├── audit-ledger/src/      ✅ AuditLedger SQLite append-only (1.4)
│   ├── tool-gateway/src/      ✅ PathGuard + GitTool + FileTool (1.2)
│   └── verification/          ⬜ Vide (Phase 5)
├── scripts/
│   ├── test-freellmapi.js     ✅ Test connexion modèle
│   └── run-audit-001.ts       ✅ Audit RAQIB-001 — verdict PASS (1.5)
├── data/                      ✅ SQLite (raqib.db) créé à l'exécution
├── reports/
│   └── raqib-001/             ✅ inventory.json + audit-report.md + verification.json
└── package.json               ✅ Workspaces npm + scripts dev/build/test
```

**Avancement au 26/10/2026 :**
- **Phase 0** : COMPLÈTE — Env configuré, constitution gelée, providers.json opérationnel
- **Phase 1** : COMPLÈTE — RAQIB-001 exécuté, `verification.json` verdict **PASS**
- **Phase 2** : COMPLÈTE — Mission model + Zod schemas + MissionEngine persistant
- **Phase 3** : COMPLÈTE — Approbations, budget, Emergency Stop, BuiltinRules et suite de tests de sécurité SEC-01→SEC-10 valides (10 PASS)
- **Phase 4** : COMPLÈTE — Budget check, filtrage sensible, retry/backoff, health check, NEEDS_REVIEW
- **Phase 5** : COMPLÈTE — Verification Engine + Docker Sandbox (avec fallback sécurisé) implémentés et vérifiés par tests unitaires

---

## 🚦 PHASE 1 — Audit en lecture seule RAQIB-001 ✅ COMPLÈTE

> **Objectif** : Produire un audit reproductible de MosaiX sans modifier le dépôt.
> **Durée estimée** : 2–4 jours | **Prérequis** : Phase 0 ✅
> **Statut** : Terminée le 26/10/2026 — `verification.json` verdict **PASS**

### Contexte critique

- Dépôt cible : `D:\Telechargements\devflow` (valeur dans `.env.local`)
- Mode **LECTURE SEULE** — `RAQIB_READ_ONLY_MODE=true`
- Aucun accès aux `.env`, credentials, clés
- Sortie dans `reports/raqib-001/`

---

### 1.1 — Shared : Compléter les types communs

**Fichier** : `packages/shared/src/types.ts` (compléter l'existant)

```typescript
// Mission types
export type MissionStatus =
  | 'DRAFT' | 'PLANNED' | 'APPROVAL_REQUIRED' | 'APPROVED'
  | 'RUNNING' | 'VERIFYING' | 'SUCCEEDED'
  | 'REJECTED' | 'FAILED' | 'CANCELLED' | 'BLOCKED' | 'NEEDS_REVIEW';

export type AutonomyLevel = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';

export type ActionType =
  | 'READ' | 'INVENTORY' | 'WRITE' | 'CREATE' | 'DELETE'
  | 'EXECUTE' | 'EXECUTE_DESTRUCTIVE' | 'NETWORK_REQUEST'
  | 'READ_ONLY_INVENTORY';

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  ruleId?: string;
  timestamp: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: 'MISSION_CREATED' | 'POLICY_DECISION' | 'ACTION_EXECUTED'
      | 'VERIFICATION_RESULT' | 'EMERGENCY_STOP' | 'BUDGET_CHECK'
      | 'ERROR' | 'APPROVAL_REQUEST' | 'APPROVAL_GRANTED';
  missionId?: string;
  actor: string;
  data: Record<string, unknown>;
}
```

**Critère** : Types compilent sans erreur TypeScript.

---

### 1.2 — Tool Gateway : Outil d'inventaire Git

**Package** : `packages/tool-gateway/`

**Structure à créer** :
```
packages/tool-gateway/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        # Export principal
    ├── GitTool.ts      # Lecture Git (lecture seule)
    ├── FileTool.ts     # Lecture fichiers (lecture seule)
    └── PathGuard.ts    # Validation chemins — CRITIQUE SÉCURITÉ
```

**`PathGuard.ts`** — CRITIQUE SÉCURITÉ :
```typescript
// Valide qu'un chemin est dans le périmètre autorisé
// Rejette : .env*, credentials*, *.pem, *.key, node_modules/**
// Rejette tout chemin hors de MOSAIX_REPO_PATH
export class PathGuard {
  constructor(private allowedRoot: string) {}
  validate(targetPath: string): { allowed: boolean; reason: string }
  isSecretFile(filePath: string): boolean   // patterns sensibles
  isBinaryFile(filePath: string): boolean   // éviter lecture binaires
}
```

**`GitTool.ts`** — Actions en lecture seule uniquement :
```typescript
export class GitTool {
  getRepoRoot(repoPath: string): Promise<string>            // git rev-parse --show-toplevel
  getRepoInfo(repoPath: string): Promise<RepoInfo>          // git branch -v, git remote -v
  listTrackedFiles(repoPath: string): Promise<string[]>     // git ls-tree -r --name-only HEAD
  getRecentCommits(repoPath: string, n?: number): Promise<CommitInfo[]>  // git log --oneline
  getDiff(repoPath: string): Promise<string>                // git diff (doit être VIDE après audit)
  getStatus(repoPath: string): Promise<string>              // git status --porcelain
  getCurrentCommitSha(repoPath: string): Promise<string>    // git rev-parse HEAD
}
// INTERDIT : commit, push, checkout -b, merge, reset --hard
```

**`FileTool.ts`** — Lecture uniquement, passe par PathGuard :
```typescript
export class FileTool {
  readFile(filePath: string): Promise<string>               // Interdit si PathGuard refuse
  readManifest(filePath: string): Promise<unknown>          // package.json, tsconfig*.json, etc.
  listDir(dirPath: string): Promise<DirEntry[]>             // Non-récursif
  findByPattern(root: string, patterns: string[]): Promise<string[]>  // *.test.ts, *.md, etc.
}
// INTERDIT : writeFile, appendFile, unlink, mkdir (hors reports/)
```

**Critères d'acceptation** :
- [ ] PathGuard bloque les accès hors `MOSAIX_REPO_PATH`
- [ ] PathGuard bloque `.env*`, `*.key`, `*.pem`, `credentials*`
- [ ] GitTool n'expose aucune méthode d'écriture Git
- [ ] FileTool n'expose aucune méthode d'écriture fichier
- [ ] Tests unitaires PathGuard avec cas de contournement explicites

---

### 1.3 — Policy Engine : Version minimale (Phase 1)

**Package** : `packages/policy-engine/`

```
packages/policy-engine/
├── package.json
├── src/
│   ├── index.ts
│   ├── PolicyEngine.ts      # Moteur principal
│   ├── PolicyLoader.ts      # Charge config/policies/*.json
│   └── rules/
│       └── BuiltinRules.ts  # Règles codées en dur (constitution)
```

**`PolicyEngine.ts`** — Interface obligatoire :
```typescript
export interface PolicyRequest {
  missionId: string;
  actor: string;                    // 'raqib-core' | 'agent-001' | etc.
  actionType: ActionType;
  resource: string;                 // chemin ou identifiant ressource
  autonomyLevel: AutonomyLevel;
  estimatedCostEur?: number;
  metadata?: Record<string, unknown>;
}

export class PolicyEngine {
  // RÈGLE ABSOLUE : policy_decision ne doit JAMAIS appeler un modèle IA
  // config/providers.json → routing.policy_decision = "none"
  
  authorize(req: PolicyRequest): PolicyDecision
  checkBudget(missionId: string, estimatedCost: number): PolicyDecision
  isEmergencyStop(): boolean    // lit RAQIB_EMERGENCY_STOP + data/emergency.lock
  isReadOnlyMode(): boolean     // lit RAQIB_READ_ONLY_MODE
}
```

**Règles codées en dur dans `BuiltinRules.ts` — jamais contournables** :

| # | Condition | Effet |
|---|---|---|
| 1 | Emergency Stop actif | DENY ALL |
| 2 | Read-only + WRITE/CREATE/DELETE/EXECUTE_DESTRUCTIVE | DENY |
| 3 | Accès `.env*`, `*.key`, `*.pem` | DENY |
| 4 | NETWORK_REQUEST sans autorisation explicite | DENY |
| 5 | Décision policy via modèle IA | DENY |
| 6 | Auto-modification CONSTITUTION.md | DENY |
| 7 | Auto-augmentation permissions ou budget | DENY |

**Critères d'acceptation** :
- [ ] `isEmergencyStop()` lit env + fichier `data/emergency.lock` (pas de modèle IA)
- [ ] Mode read-only bloque WRITE même si mission formellement approuvée
- [ ] `authorize()` ne fait aucun appel réseau ou modèle
- [ ] Chaque décision est journalisée (ALLOW/DENY + raison + règleId)

---

### 1.4 — Audit Ledger : Journal append-only

**Package** : `packages/audit-ledger/`

```typescript
// packages/audit-ledger/src/AuditLedger.ts
export class AuditLedger {
  async init(): Promise<void>                                        // Init SQLite (RAQIB_DB_PATH)
  async log(event: AuditEvent): Promise<void>                       // Append-only, jamais UPDATE/DELETE
  async query(filters: AuditFilters): Promise<AuditEvent[]>         // Lecture pour dashboard
  async export(missionId: string): Promise<AuditEvent[]>            // Export JSON rapport
}
```

**Schéma SQLite** :
```sql
CREATE TABLE IF NOT EXISTS audit_events (
  id          TEXT PRIMARY KEY,
  timestamp   TEXT NOT NULL,
  type        TEXT NOT NULL,
  mission_id  TEXT,
  actor       TEXT NOT NULL,
  data        TEXT NOT NULL,   -- JSON sérialisé, secrets expurgés
  created_at  INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_mission ON audit_events(mission_id);
-- Principe : JAMAIS de UPDATE ou DELETE sur cette table
```

**Dépendance** : `better-sqlite3`

**Critères d'acceptation** :
- [ ] Chaque `PolicyEngine.authorize()` logue sa décision dans AuditLedger
- [ ] Aucun secret (clé API, .env) dans les entrées loguées
- [ ] Journal persiste et est lisible après redémarrage du processus
- [ ] Aucun UPDATE/DELETE possible sur les entrées (append-only strict)

---

### 1.5 — Script d'audit RAQIB-001

**Fichier** : `scripts/run-audit-001.ts`

```typescript
// Point d'entrée pour la mission RAQIB-001
// Usage : npx ts-node scripts/run-audit-001.ts
//
// Flux d'exécution :
// 1. Charger config (.env.local, providers.json)
// 2. PolicyEngine.authorize() → ALLOW READ_ONLY_INVENTORY
// 3. Capturer SHA Git avant (commit de départ)
// 4. Exécuter les 10 étapes de RAQIB-001_SPEC.md §4
// 5. Vérifier que git diff est VIDE
// 6. Générer les 3 livrables dans reports/raqib-001/
// 7. Logguer dans AuditLedger

const AUDIT_STEPS = [
  'IDENTIFY_REPO',      // git info, remote, branche
  'INVENTORY_FILES',    // git ls-tree filtré
  'MAP_PACKAGES',       // workspaces, apps, packages
  'ANALYZE_DEPS',       // package.json, lockfiles
  'INVENTORY_TESTS',    // *.test.*, *.spec.*, configs test
  'INVENTORY_DOCS',     // *.md, docs/
  'MAP_RELATIONS',      // imports statiques (grep/lecture)
  'CLASSIFY_RISKS',     // avec niveau de confiance
  'GENERATE_REPORTS',   // inventory.json + audit-report.md
  'VERIFY_NO_CHANGE',   // git diff doit être VIDE — critique
];
```

**Livrables générés** :

```
reports/raqib-001/
├── inventory.json
│   ├── meta: { timestamp, sha, auditor, version }
│   ├── repo: { path, remote, branch, totalFiles }
│   ├── packages: [{ name, path, version, deps }]
│   ├── tests: { files, frameworks }
│   └── docs: { files, hasReadme }
│
├── audit-report.md
│   ├── Executive Summary
│   ├── Contexte (dépôt, branche, commit)
│   ├── Inventaire (fichiers, packages/apps)
│   ├── Dépendances clés
│   ├── Tests & Documentation
│   ├── Points forts
│   ├── Risques (Critique/Élevé/Moyen/Faible + confiance)
│   ├── Recommandations priorisées
│   ├── Limites de l'audit
│   └── Annexes (commandes exécutées, preuves)
│
└── verification.json
    ├── sha_before, sha_after   (doivent être identiques)
    ├── git_diff: ""            (VIDE obligatoire)
    ├── git_status: ""          (VIDE obligatoire)
    ├── timestamp_start, timestamp_end
    └── verdict: "PASS" | "FAIL"
```

**Critères d'acceptation** :
- [ ] `verification.json` → `git_diff` vide + `sha_before === sha_after` + verdict PASS
- [ ] `audit-report.md` distingue explicitement **FAIT** vs **HYPOTHÈSE**
- [ ] Toutes les commandes exécutées listées dans les annexes
- [ ] Script relançable → même résultat structurel
- [ ] PolicyEngine a autorisé et journalisé la mission avant tout accès fichier
- [ ] Budget tracé (0 € si local)

> **🚪 Porte Phase 1** : `verification.json` verdict = **PASS** — **FRANCHIE le 26/10/2026**

---

## 🔧 PHASE 2 — RAQIB Core + Mission Engine ✅ COMPLÈTE

> **Objectif** : Moteur de missions persistant avec reprise après redémarrage.
> **Durée estimée** : 4–7 jours | **Prérequis** : Phase 1 ✅
> **Statut** : Terminée le 26/10/2026 — MissionEngine + StateMachine opérationnels

### 2.1 — Package Core : Modèle de données

**Package** : `packages/core/`

```typescript
// packages/core/src/Mission.ts
export interface MissionStep {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  proof?: string;        // Référence preuve vérifiable
  error?: string;
  attempts: number;
  maxAttempts: number;
}

export interface Mission {
  id: string;               // ex: 'RAQIB-001'
  name: string;
  status: MissionStatus;
  autonomyLevel: AutonomyLevel;
  objective: string;
  constraints: string[];
  successCriteria: string[];
  steps: MissionStep[];
  currentStepIndex: number;

  // Gouvernance
  approvalRequired: boolean;
  approvalId?: string;
  approvedBy?: string;
  approvedAt?: string;

  // Budget
  budgetLimitEur: number;
  budgetUsedEur: number;

  // Limites d'exécution
  maxDurationMs: number;
  maxAttempts: number;
  timeoutAt: string;        // ISO timestamp

  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;

  // Preuves
  evidences: Evidence[];
  result?: MissionResult;
}

export interface Evidence {
  type: 'FILE' | 'GIT_STATE' | 'COMMAND_OUTPUT' | 'TEST_RESULT';
  description: string;
  value: string;
  timestamp: string;
  verified: boolean;
}
```

**`MissionSchema.ts`** : Schémas Zod complets pour `Mission`, `MissionStep`, `Evidence`.
Validation obligatoire à l'entrée ET à la sortie de la base de données.

### 2.2 — Mission Engine : Orchestration persistante

**Package** : `packages/mission-engine/`

**Machine à états** :
```
DRAFT → PLANNED → APPROVAL_REQUIRED → APPROVED → RUNNING → VERIFYING → SUCCEEDED
                                                          ↓
                                     REJECTED | FAILED | CANCELLED | BLOCKED | NEEDS_REVIEW
```

Règles de transition :
- `→ RUNNING` : exige `status === 'APPROVED'`
- `→ SUCCEEDED` : exige `VerificationEngine` verdict = PASS
- `FAILED` est terminal (sauf décision manuelle vers `NEEDS_REVIEW`)
- Chaque transition journalisée dans AuditLedger

```typescript
// packages/mission-engine/src/MissionEngine.ts
export class MissionEngine {
  async createMission(spec: MissionSpec): Promise<Mission>
  async getMission(id: string): Promise<Mission | null>
  async listMissions(filters?: MissionFilters): Promise<Mission[]>
  async runNextStep(missionId: string): Promise<StepResult>       // Policy check avant chaque étape
  async resumeMission(missionId: string): Promise<void>           // Reprise après crash
  async transitionStatus(id: string, newStatus: MissionStatus, reason: string): Promise<Mission>
  async cancelMission(missionId: string, reason: string): Promise<void>
  async recoverInterrupted(): Promise<Mission[]>                  // Appelé au démarrage runtime
}
```

**Schéma SQLite** :
```sql
CREATE TABLE IF NOT EXISTS missions (
  id        TEXT PRIMARY KEY,
  status    TEXT NOT NULL,
  data      TEXT NOT NULL,    -- JSON Mission complet
  created_at INTEGER,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS mission_steps (
  id         TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id),
  step_index INTEGER NOT NULL,
  status     TEXT NOT NULL,
  data       TEXT NOT NULL,   -- JSON MissionStep
  updated_at INTEGER
);
```

**Critères d'acceptation** :
- [ ] Mission interrompue retrouvée après `kill -9` du processus
- [ ] Reprise à l'étape interrompue sans double-exécution (idempotence)
- [ ] Expiration `timeoutAt` → transition automatique vers `FAILED`
- [ ] `maxAttempts` dépassé sur étape → `BLOCKED`
- [ ] Tests unitaires StateTransition — toutes les transitions valides/invalides

---

## 🔒 PHASE 3 — Policy Engine Complet + Tests Sécurité

> **Objectif** : Gouvernance imposée par le programme, indépendante du modèle IA.
> **Durée estimée** : 3–5 jours | **Prérequis** : Phase 2 ✅

### 3.1 — Approbations et budget

```typescript
// Compléter packages/policy-engine/src/PolicyEngine.ts

async requestApproval(req: ApprovalRequest): Promise<string>       // → approvalId
isApprovalValid(approvalId: string, req: PolicyRequest): boolean   // 1 approval = 1 action + 1 périmètre + 1 durée
async consumeApproval(approvalId: string): Promise<void>           // Non réutilisable après usage
async deductBudget(missionId: string, amount: number): Promise<void>  // Atomique

export interface ApprovalRequest {
  missionId: string;
  actionType: ActionType;
  resource: string;
  estimatedCostEur: number;
  maxDurationMs: number;
  justification: string;
  expiresAt: string;         // ISO timestamp
}
```

### 3.2 — Emergency Stop indépendant

```typescript
// packages/policy-engine/src/EmergencyStop.ts
export class EmergencyStop {
  isActive(): boolean                              // Env var OU fichier data/emergency.lock
  async activate(reason: string): Promise<void>   // Écrit data/emergency.lock
  async deactivate(confirmedBy: string): Promise<void>  // Supprime lock, log dans audit
}
```

### 3.3 — Tests de sécurité obligatoires

| Test ID | Scénario | Résultat attendu |
|---|---|---|
| SEC-01 | Tentative de modifier `CONSTITUTION.md` | DENY |
| SEC-02 | Dépasser budget mission | BLOCKED avant exécution |
| SEC-03 | Action hors périmètre mission | DENY |
| SEC-04 | Réutiliser approbation expirée | DENY |
| SEC-05 | Injection d'instruction via fichier externe | Ignoré, 0 permission accordée |
| SEC-06 | Accès `.env*` ou `*.key` | DENY |
| SEC-07 | Commande réseau non autorisée | DENY |
| SEC-08 | Arrêt d'urgence pendant mission | BLOCKED + audit conservé |
| SEC-09 | Auto-augmentation budget/permissions | DENY |
| SEC-10 | Appel modèle IA pour décision policy | DENY (`routing = "none"`) |

**Critères d'acceptation** :
- [ ] SEC-01 à SEC-10 : tous PASS
- [ ] Emergency stop activable sans intervention code (env var ou fichier lock)
- [ ] Approbation non réutilisable après consommation
- [ ] Budget décrément atomique (pas de race condition)
- [ ] `PolicyEngine` ne peut pas modifier ses propres règles

> **🚪 Porte Phase 3** : SEC-01 à SEC-10 tous PASS — **nécessaire avant d'autoriser la moindre écriture.**
> **Statut actuel** : PolicyEngine complet (approbations, budget atomique, Emergency Stop, BuiltinRules) — **tests de sécurité à implémenter**

---

## 🤖 PHASE 4 — Model Gateway : Finalisation ✅ COMPLÈTE

> **Objectif** : IA interchangeable sans affecter les permissions.
> **Durée estimée** : 1–2 jours (base déjà existante)
> **Prérequis** : Phase 3 ✅
> **Statut** : Terminée le 26/10/2026 — `complete()` avec budget check, filtrage sensible, retry/backoff, health check

### Ce qui existe déjà

- `ModelGateway` + `getProviderForTask()`
- `FreeLLMAPIAdapter` (proxy OpenCode local port 3001)
- `OpenAICompatibleAdapter`
- Types `IModelProvider`, `ModelRequest`, `ModelResponse`

### Compléments à ajouter

```typescript
// Compléter packages/model-gateway/src/index.ts
export class ModelGateway {
  // Budget vérifié AVANT chaque appel, coût loggué APRÈS
  async complete(req: ModelRequest, missionId: string): Promise<ModelResponse>

  // Filtrage des données sensibles avant envoi au provider
  // (patterns de providers.json → safety.filterSensitivePatterns)

  disableProvider(id: string): void                       // Sans redémarrage
  async checkProvider(id: string): Promise<ProviderHealth>  // Health check

  // Erreur provider → étape NEEDS_REVIEW, pas crash process
  // Timeout respecté (90 s pour freellmapi)
  // Retry avec backoff (maxRetries depuis providers.json)
}
```

**Critères d'acceptation** :
- [ ] `npm run test:freellmapi` passe
- [ ] Changement de provider → permissions et règles inchangées
- [ ] Coûts tracés dans AuditLedger pour chaque appel
- [ ] Budget vérifié avant chaque appel modèle
- [ ] Données sensibles filtrées avant envoi
- [ ] Erreur provider gérée sans crash du runtime

> **🚪 Porte Phase 4** : MVP backend complet — autorise le passage à l'écriture en sandbox.

---

## 🐳 PHASE 5 — Exécution Isolée + Verification Engine

> **Objectif** : Préparer l'exécution contrôlée en sandbox.
> **Durée estimée** : 4–7 jours | **Prérequis** : Phases 1–4 ✅ + Docker Desktop installé

### 5.1 — Verification Engine

```typescript
// packages/verification/src/VerificationEngine.ts
export class VerificationEngine {
  async verifyFileExists(path: string, schema?: unknown): Promise<VerificationResult>
  async verifyGitUnchanged(repoPath: string, beforeSha: string): Promise<VerificationResult>
  async verifyCommandResult(exitCode: number, expected: number): Promise<VerificationResult>
  async verifyBudgetRespected(missionId: string): Promise<VerificationResult>
  async verifyMission(missionId: string, checks: VerificationCheck[]): Promise<VerificationReport>
}

export interface VerificationResult {
  passed: boolean;
  evidence: string;       // Preuve concrète (valeur, output, hash)
  method: string;         // Comment la vérification a été faite
  timestamp: string;
  uncertainty?: string;   // Si doute → UNCERTAIN, jamais SUCCESS par défaut
}
```

> **Règle fondamentale** : Preuves insuffisantes → `UNCERTAIN`, jamais `SUCCESS` automatique.

### 5.2 — Sandbox Docker

> ⚠️ À implémenter UNIQUEMENT après validation complète des Phases 1–4

```typescript
// packages/tool-gateway/src/DockerSandbox.ts
// Activé par RAQIB_DOCKER_ENABLED=true (false par défaut)
export class DockerSandbox {
  // Restrictions obligatoires :
  // - Réseau désactivé par défaut
  // - Pas d'accès socket Docker hôte
  // - Pas de montage secrets
  // - Pas de privilèges admin
  // - Copie de travail isolée (pas le repo original)

  async createWorkspace(sourceRepo: string): Promise<SandboxContext>
  async executeCommand(ctx: SandboxContext, cmd: string[], allowedCmds: string[]): Promise<CommandResult>
  async destroyWorkspace(ctx: SandboxContext): Promise<void>
}
```

---

## 🖥️ PHASE 6 — Dashboard Next.js

> **Objectif** : Interface de supervision pour le fondateur.
> **Durée estimée** : 3–5 jours | **Prérequis** : Phases 1–4 ✅

```
apps/dashboard/
├── package.json          # next, react
└── src/
    ├── app/
    │   ├── page.tsx               # Dashboard principal
    │   ├── missions/              # Liste + détail missions
    │   ├── audit/                 # Audit ledger
    │   ├── approvals/             # Approbations en attente
    │   └── api/                   # Routes HTTP → runtime
    └── components/
        ├── MissionCard.tsx
        ├── StatusBadge.tsx
        ├── BudgetMeter.tsx
        ├── EmergencyStopButton.tsx   # CRITIQUE — toujours visible
        └── AuditTimeline.tsx
```

**Pages obligatoires** :

| Page | Contenu |
|---|---|
| `/` | État général RAQIB, missions actives, alertes, budget global |
| `/missions` | Liste toutes missions, statuts, filtres |
| `/missions/[id]` | Détail mission, étapes, preuves, logs |
| `/approvals` | Approbations en attente (action + périmètre + coût + durée) |
| `/audit` | Timeline audit ledger, filtrable |
| `/settings` | État providers IA, emergency stop toggle |

**Règles d'architecture** :
- `apps/dashboard` → parle à `services/runtime` via API HTTP locale uniquement
- **Ne jamais appeler** directement les outils ou le modèle depuis le dashboard
- Emergency Stop Button : double confirmation + appel `/api/emergency-stop` → `data/emergency.lock`

---

## ⚙️ PHASE 7 — Service Runtime Autonome

> **Objectif** : Processus Node.js indépendant du navigateur.

```
services/runtime/
├── package.json
└── src/
    ├── index.ts            # Point d'entrée processus long
    ├── RaqibRuntime.ts     # Orchestrateur principal
    ├── api/
    │   ├── server.ts       # HTTP API (Express ou Fastify)
    │   └── routes/
    └── scheduler/          # Tâches planifiées futures
```

**Startup sequence** :
1. Charger config (`.env.local`, `providers.json`)
2. Vérifier Emergency Stop → si actif, log + attendre
3. Init `AuditLedger` (SQLite)
4. Init `PolicyEngine`
5. Init `MissionEngine`
6. Init `ModelGateway`
7. Récupérer missions `RUNNING` interrompues → `resumeMission()`
8. Démarrer API HTTP (port configurable)
9. Démarrer tick loop (vérification missions RUNNING, timeouts, approbations)

---

## 📋 PHASE 8 — Validation MVP

> **Critères §20 PRD — tous obligatoires avant V2**

- [ ] MosaiX audité sans modification (RAQIB-001 PASS)
- [ ] Mission créée, exécutée, interrompue, retrouvée et reprise
- [ ] Permissions appliquées par le programme (SEC-01 à SEC-10 PASS)
- [ ] Budgets et limites de temps respectés
- [ ] Approbations liées à actions et périmètres précis
- [ ] Tous événements significatifs journalisés dans AuditLedger
- [ ] FreeLLMAPI opérationnel, indisponibilité gérée proprement
- [ ] Résultats vérifiés avec preuves concrètes
- [ ] Emergency stop bloque toutes nouvelles actions
- [ ] Tests sécurité et résilience prioritaires PASS
- [ ] Fondateur peut consulter état missions et résultats
- [ ] Documentation permettant reproduction installation + tests

> **⛔ Écriture autonome** (V2 Engineering) autorisée **uniquement** après validation complète du MVP.

---

## 🗂️ Structure finale du dépôt cible

```
d:\Projets\RAQIB-SSA\
├── .env.local                       # ✅ Configuré
├── package.json                     # ✅ Workspaces npm
├── apps/
│   └── dashboard/                   # Phase 6
├── packages/
│   ├── shared/          ✅ types.ts (à compléter Phase 1)
│   ├── core/            Phase 2
│   ├── policy-engine/   Phases 1 + 3
│   ├── mission-engine/  Phase 2
│   ├── model-gateway/   ✅ Partiellement complet
│   ├── tool-gateway/    Phase 1
│   ├── audit-ledger/    Phase 1
│   ├── verification/    Phase 5
│   └── memory/          V2 (mémoire institutionnelle)
├── services/
│   └── runtime/         Phase 7
├── config/
│   ├── providers.json   ✅ FreeLLMAPI actif
│   └── policies/
│       └── default.policy.json   Phase 1
├── docs/                ✅ Tous gelés v1.0
├── tests/
│   ├── integration/
│   ├── security/        SEC-01 à SEC-10
│   └── resilience/
├── reports/
│   └── raqib-001/       Phase 1 output
├── data/                SQLite + emergency.lock
└── scripts/
    ├── test-freellmapi.js   ✅ Existant
    └── run-audit-001.ts     Phase 1 — à créer
```

---

## ⚙️ Dépendances npm à installer

```bash
# Workspace root
npm install better-sqlite3 zod express
npm install -D @types/better-sqlite3 @types/express

# Dashboard (Phase 6 uniquement)
npm install next react react-dom
```

---

## 🚫 Règles strictes pour l'agent de développement

1. **Ne pas sauter de phase** — chaque porte doit être validée
2. **Policy Engine n'appelle jamais un modèle IA** — `routing.policy_decision = "none"`
3. **PathGuard sur chaque accès fichier** — sans exception
4. **Append-only sur AuditLedger** — aucun UPDATE/DELETE
5. **Vérification avec preuves** — jamais SUCCESS sans evidence concrète
6. **Secrets hors prompts** — jamais de clé API dans le contexte LLM
7. **Read-only jusqu'à Phase 4 validée** — `RAQIB_READ_ONLY_MODE=true`
8. **Emergency stop indépendant** — fichier `data/emergency.lock` OU env var
9. **Tests avant passage de porte** — unitaires + sécurité obligatoires pour Policy Engine
10. **Données externes non fiables** — les fichiers MosaiX ne peuvent pas modifier les règles RAQIB

---

## 📊 Tableau d'avancement

| Phase | Description | Statut | Durée |
|---|---|---|---|
| 0 | Préparation, configuration, constitution | ✅ COMPLÈTE | — |
| **1** | Audit RAQIB-001 + Tool Gateway + Policy Engine minimal + Audit Ledger | ✅ COMPLÈTE (26/10) | 2–4j |
| **2** | Core + Mission Engine + SQLite persistance | ✅ COMPLÈTE (26/10) | 4–7j |
| **3** | Policy Engine complet + approbations + SEC-01 à SEC-10 | ✅ COMPLÈTE (SEC-01 à SEC-10 PASS) | 3–5j |
| **4** | Model Gateway finalisé + budget tracking | ✅ COMPLÈTE (26/10) | 1–2j |
| **5** | Docker sandbox + Verification Engine | ✅ COMPLÈTE (Verification Engine & DockerSandbox) | 4–7j |
| **6** | Dashboard Next.js | ✅ COMPLÈTE (Next.js App Router apps/dashboard) | 3–5j |
| **7** | Service Runtime autonome | ✅ COMPLÈTE (RaqibRuntime + API Server Express) | 2–4j |
| **8** | Validation MVP | 🔄 En cours de validation finale | 3–5j |

**Total restant estimé** : ~15–26 jours ouvrés (Phase 3 tests + Phases 5–8)

---

## 🎯 Prochaine action immédiate

**Phase 3, tâche 3.3 — Écrire les tests de sécurité SEC-01 à SEC-10** :

1. Créer `tests/security/` avec un runner (`tests/security/run-sec-tests.ts`)
2. Couvrir les 10 scénarios SEC-01 → SEC-10 (voir §3.3)
3. Valider la porte Phase 3 : les 10 tests doivent PASSER
4. Poursuivre avec la Phase 5 : `packages/verification/src/VerificationEngine.ts`
