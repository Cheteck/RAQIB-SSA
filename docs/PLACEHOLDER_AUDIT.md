# Audit des implémentations incomplètes, mocks et simulations — RAQIB

> Audit **read-only**. Aucun fichier de production n'a été modifié pour produire ce rapport.
> Chaque finding porte une preuve exécutable : commande, sortie console, ou `fichier:ligne`.
> Une affirmation sans preuve n'est pas un finding.

Date : 2026-11-06
Périmètre : `packages/`, `services/`, `coding-engine/`, `apps/dashboard/src/`
Hors périmètre : `tests/`, `docs/mockups/`, `scripts/` (sauf quand un script est le seul appelant).

---

## 0. Méthode

```powershell
# 1. Marqueurs classiques
rg -i "\b(mock|stub|fake|dummy|placeholder|not implemented|TODO|FIXME|HACK|simulat)\b" packages services
# → aucun match dans packages/*.ts et services/*.ts
```

Le code ne contient **aucun marqueur explicite**. Les gaps sont structurels : des fonctions
qui compilent, répondent `200 OK`, et ne font pas le travail. C'est pourquoi l'audit a été
complété par une **vérification par exécution réelle** contre le runtime en écoute sur
`http://127.0.0.1:4000`.

```powershell
# 2. Preuve par exécution (runtime réel, PID 8992)
Invoke-WebRequest http://127.0.0.1:4000/api/skills
Invoke-WebRequest -Method Post http://127.0.0.1:4000/api/skills/git_status_check/execute -Body '{"repoPath":"."}'
Invoke-WebRequest -Method Post http://127.0.0.1:4000/api/opencode/execute -Body '{"taskId":"audit-proof-1","projectPath":"...\\docs","prompt":"..."}'
```

```powershell
# 3. Réalité terrain pour comparer
git status --porcelain | Measure-Object -Line
# → dirty_entries=113
```

---

## 1. Synthèse

| ID | Sévérité | Surface | Ce qui est simulé |
|---|---|---|---|
| F-01 | **Critique** | `POST /api/opencode/execute` | une tâche de codage « réussit » en 1 ms sans appeler de LLM ni écrire un fichier |
| F-02 | **Critique** | `POST /api/skills/git_status_check/execute` | `{"status":"clean"}` alors que le dépôt a 113 entrées modifiées |
| F-03 | **Critique** | `verifyAndTransition()` sans checks | vérification vacuous : `0 === 0` → mission `SUCCEEDED` |
| F-04 | Élevée | `Planner.createPlan()` | plan figé de 3 étapes, provider ignoré |
| F-05 | Élevée | `SDKCodingEngine.approve()/cancel()` | approbation = succès vide ; annulation = fonction vide |
| F-06 | Élevée | `apply_patch` (operation `delete`) | supprime rien, retourne `success: true` |
| F-07 | Élevée | `RaqibCodingEngineAdapter` | workspace jamais transmis, `apiKey: 'default-key'`, baseURL hors config |
| F-08 | Moyenne | `codebase_audit` (skill) | retourne un message, n'inspecte rien |
| F-09 | Moyenne | `WorkflowEngine` | aucun nœud enregistré en production → `/workflows` toujours vide |
| F-10 | Faible (latent) | `ShellRailLeft` (dead code) | badges, rôles, CI et jauges codés en dur, dans un composant non monté |
| F-11 | Moyenne | `/api/context` côté dashboard | appelé sans messages → `usedTokens = 0` en permanence |
| F-12 | Faible (latent) | `OpenCodeAdapter` | sans sandbox : `success: true` + sortie fabriquée |

---

## 2. Findings

### F-01 — Le Coding Engine retourne un succès vide

- **Sévérité** : Critique
- **Classe** : `inert-implementation` / `false-success`
- **Emplacement** :
  - `coding-engine/packages/runtime/src/engine.ts:24-65`
  - `coding-engine/packages/runtime/src/engine.js:15-51` (build compilé, même logique)
- **Preuve code** :

```ts
// engine.ts:24-65
async execute(task: CodingTask, options?: ExecuteOptions): Promise<TaskResult> {
  const steps = await this.planner.createPlan(task);   // plan figé
  ...
  options?.onEvent?.({ type: "task.completed", taskId, status: "completed" });
  return {
    taskId,
    status: "completed",
    summary: `Task ${taskId} completed in mode ${mode}.`,
    changes: [],        // ← aucune modification
    validations: [],    // ← aucune validation
  };
}
```

`this.provider` et `this.toolRegistry` ne sont **jamais lus** dans `execute()`. Aucun appel
réseau, aucun `apply_patch`, aucun `ProjectValidator`.

- **Preuve d'exécution** :

```
POST /api/opencode/execute
Body : {"taskId":"audit-proof-1","projectPath":"...\\docs","prompt":"Ajouter une ligne dans un fichier qui n existe pas"}
Réponse: {"result":{"taskId":"audit-proof-1","success":true,
          "output":"Task audit-proof-1 completed in mode apply.","durationMs":1}}
```

`durationMs: 1` est la preuve qu'aucun appel LLM n'a eu lieu (le provider a un timeout de
60 s et une latence réseau non nulle). La tâche demandait une création de fichier : aucun
fichier n'a été créé.

- **Accessibilité** : publique. `POST /api/opencode/execute` (`services/runtime/src/api/server.ts:676`)
  → `SkillsRegistry.execute('opencode_task')` → `RaqibCodingEngineAdapter.executeTask`
  → `SDKCodingEngine.execute`. L'écran `/coding-engine` appelle cette route
  (`apps/dashboard/src/app/coding-engine/page.tsx:19`).
- **Impact** : l'opérateur voit `SUCCESS` pour une tâche que rien n'a exécutée. Combiné à F-03,
  une mission peut être marquée `SUCCEEDED` sans qu'une ligne de code ait changé.
- **Correctif** : soit implémenter la boucle (planner réel → tool calls → patch → validation →
  `changes`/`validations` peuplés), soit **fail-closed** : `status: "unsupported"` +
  `error: "coding engine not wired"` et `success: false`. Un succès vide n'est jamais acceptable.
- **Suite** : dépend de l'arbitrage ChatGPT (voir §5).

### F-02 — `git_status_check` ment sur l'état du dépôt

- **Sévérité** : Critique
- **Classe** : `hardcoded-response`
- **Emplacement** : `packages/tool-gateway/src/SkillsRegistry.ts:76-84`
- **Preuve code** :

```ts
this.register({
  name: 'git_status_check',
  description: 'Inspect current git repository status and diff',
  parameters: z.object({ repoPath: z.string().default('.') }),
  requiredPermission: 'READ',
  handler: async (args) => {
    return { status: 'clean', repo: args.repoPath };   // ← constante
  },
});
```

- **Preuve d'exécution** :

```
POST /api/skills/git_status_check/execute  {"repoPath":"."}
→ {"result":{"status":"clean","repo":"."}}

git status --porcelain | Measure-Object -Line
→ dirty_entries=113
```

- **Accessibilité** : `POST /api/skills/:name/execute` (`server.ts:98`), route publique, sans
  contrôle de permission (voir follow-up FU-02).
- **Impact** : un agent ou un opérateur qui interroge cet outil conclut que le dépôt est propre
  alors que 113 fichiers divergent de HEAD. C'est exactement le signal qui déclenche ou
  annule une décision de gouvernance.
- **Correctif** : implémenter avec `GitTool` (déjà réel : `packages/tool-gateway/src/GitTool.ts:57`)
  ou retirer le skill du registre. Un outil `READ` qui ment est pire que pas d'outil.
- **Suite** : aucun blocage technique — `GitTool` existe et fonctionne.

### F-03 — La vérification de mission passe à vide quand aucun check n'est fourni

- **Sévérité** : Critique
- **Classe** : `vacuous-verification` / `fail-open`
- **Emplacement** : `packages/mission-engine/src/MissionEngine.ts:909-923`
- **Preuve code** :

```ts
const verificationChecks = checks && checks.length > 0 ? checks : mission.successCriteria.map((criterion, idx) => ({
  id: `chk-${idx}`,
  type: 'COMMAND_EXIT_CODE' as const,
  target: '0',      // ← exit code observé, inventé
  expected: 0,      // ← attendu
}));
```

`verifyMission` appelle alors `verifyCommandResult(0, 0)` (`VerificationEngine.ts:188-198`),
qui compare deux constantes et retourne `passed: true`. Le `criterion` (le vrai critère de
succès de la mission) est **ignoré**.

- **Accessibilité** : `verifyAndTransition(missionId)` sans second argument.
  Appelant réel : `scripts/run-mosaix-001.ts:88`.
- **Impact** : n'importe quelle mission peut passer `SUCCEEDED` avec un rapport de vérification
  qui affiche `All N verification checks passed successfully`. C'est une fausse preuve
  *signée par le moteur de preuve lui-même* — le pire endroit pour un fail-open.
- **Correctif** : si `checks` est vide, retourner `verdict: 'BLOCKED'` avec
  `evidence: "No verification checks supplied — cannot certify"`. Ne jamais fabriquer
  le couple `(target, expected)` qui rend le test tautologique.
- **Suite** : à traiter avant toute démonstration de mission « vérifiée ».

### F-04 — Le planner ignore le provider et produit un plan constant

- **Sévérité** : Élevée
- **Classe** : `placeholder-branch`
- **Emplacement** : `coding-engine/packages/runtime/src/planner.ts:10-19` (`planner.js:1-13`)
- **Preuve code** :

```ts
export class Planner {
  constructor(private provider?: ModelProvider) {}     // ← jamais utilisé

  async createPlan(task: CodingTask): Promise<ExecutionStep[]> {
    return [
      { id: "step-1", description: `Analyze workspace for instruction: ${task.instruction}`, status: "pending" },
      { id: "step-2", description: `Generate patch for task ${task.kind}`, status: "pending" },
      { id: "step-3", description: "Validate changes and run tests", status: "pending" },
    ];
  }
}
```

- **Impact** : le plan n'a aucune valeur informationnelle : il est identique pour « renommer
  une variable » et « migrer le module d'authentification ». Il ne peut pas guider une boucle
  d'outils.
- **Correctif** : soit un vrai appel provider contraint par un schéma JSON de plan, soit
  supprimer la classe et faire du plan une donnée fournie par l'appelant.
- **Statut : CORRIGÉ**. `Planner` appelle réellement le provider (`temperature: 0`,
  prompt système strict) puis valide un schéma : tableau `steps` non vide, 1..`maxSteps`,
  ids uniques sans espace, descriptions non triviales, statut normalisé `pending`.
  Toute anomalie lève `PlanningError` (`PLANNER_NOT_CONFIGURED`,
  `PLANNER_MODEL_ERROR`, `PLANNER_INVALID_RESPONSE`) — aucun plan de repli.
  Preuve : `tests/coding-engine/planner-real.spec.ts` (10 tests).
  Le moteur, encore fail-closed, refuse **avant** de planifier (0 appel provider).

### F-05 — `approve()` et `cancel()` ne font rien

- **Sévérité** : Élevée
- **Classe** : `inert-implementation` / `false-success`
- **Emplacement** : `coding-engine/packages/runtime/src/engine.ts:67-77`
- **Preuve code** :

```ts
async approve(taskId: string, approvalId: string): Promise<TaskResult> {
  return {
    taskId,
    status: "completed",                       // ← succès immédiat
    summary: `Approval ${approvalId} granted for task ${taskId}.`,
    changes: [],                               // ← rien appliqué
    validations: [],
  };
}

async cancel(taskId: string): Promise<void> {}  // ← corps vide
```

- **Impact** : approuver une tâche en mode `propose` ne produit aucun patch ; annuler une
  tâche en cours ne l'arrête pas. `AbortSignal` est pourtant présent dans `ExecuteOptions`
  (`engine.ts:9`) et n'est jamais propagé.
- **Correctif** : `approve()` doit rejouer le patch stocké et retourner les `changes` réels ;
  `cancel()` doit déclencher l'`AbortSignal` et retourner un statut `cancelled` traçable.

### F-06 — `apply_patch --delete` retourne `success: true` sans supprimer

- **Sévérité** : Élevée
- **Classe** : `no-op-success`
- **Emplacement** : `coding-engine/packages/tools/src/apply-patch.ts:18-20` (`apply-patch.js:10-12`)
- **Preuve code** :

```ts
execute: async (input, context) => {
  if (input.operation === "delete") {
    return { success: true, path: input.filePath };   // ← aucune suppression
  }
  ...
}
```

- **Impact** : le seul outil d'écriture du SDK ne sait pas supprimer. Un agent qui demande
  une suppression reçoit une confirmation et le fichier reste.
- **Correctif** : `Workspace` n'expose pas `deleteFile()` (`project/src/workspace.ts`) —
  il faut l'ajouter, avec `PathGuard`, puis l'appeler ici.
- **Statut : CORRIGÉ**. `Workspace.deleteFile()` existe et supprime réellement
  (`workspace.ts`) ; le confinement est ancré sur `root` et refuse `..`, chemins
  absolus et symlinks sortants. `apply_patch` échoue explicitement si la capacité
  est absente, si le fichier n'existe pas, ou si l'absence post-suppression n'est
  pas constatée. Preuve : `tests/coding-engine/apply-patch-f06.spec.ts` (11 tests,
  dont 5 de confinement) et `tests/governance/success-evidence-contract.spec.ts`.

### F-07 — L'adaptateur Coding Engine n'aligne ni workspace ni credentials

- **Sévérité** : Élevée
- **Classe** : `misconfiguration` / `dummy-credential`
- **Emplacement** : `packages/tool-gateway/src/adapters/RaqibCodingEngineAdapter.ts:10-29`
- **Preuve code** :

```ts
const provider = new FreeLLMAPIProvider({
  baseURL: process.env.FREE_LLM_API_BASE_URL || 'https://freellmapi.com/api/v1',  // ← public
  apiKey: process.env.FREE_LLM_API_KEY || 'default-key',                          // ← credential factice
  defaultModel: 'auto',
});
...
const workspace = new LocalWorkspace({ id: `ws-${req.taskId}`, root: req.projectPath });
const result = await this.sdkEngine.execute({ ... });   // ← workspace jamais passé
```

- **Preuve de configuration** : `config/providers.json` route vers un proxy **local**
  (`127.0.0.1:3001`, cf. `free-llm-api.ts:8`) et s'appuie sur `FREE_LLM_API_KEY`. L'adaptateur,
  lui, pointe par défaut vers `https://freellmapi.com/api/v1` avec la chaîne `default-key`.
- **Impact** : deux chemins d'appel LLM divergent dans le même processus. En l'absence de
  variable d'environnement, l'adaptateur envoie `Bearer default-key` à un hôte public au lieu
  du proxy local. Le `workspace` construit est jeté : même si `engine.execute` utilisait
  `this.workspace`, il serait `undefined`.
- **Conformité documentaire** : confronté à la documentation officielle FreeLLMAPI
  (`docs/en/clients/01-agent-clients.md`), l'écart est confirmé : base attendue
  `http://localhost:3001/v1`, variable `FREELLMAPI_API_KEY`, Bearer obligatoire.
  Détail et 14 points de contrôle : `docs/FREELLMAPI_CONFORMANCE.md`.
- **Sous-finding F-07b (bloquant pour la boucle P1)** : `ModelRequest.tools` est déclaré
  (`coding-engine/packages/providers/src/provider.ts:15`) mais jamais sérialisé dans le corps
  de la requête (`freellmapi.ts:23-28`). Même un moteur câblé ne pourrait pas déclencher de
  `tool_calls` : la boucle planner → outil → patch est structurellement impossible sans ce
  correctif.
- **Correctif** : construire le provider depuis `config/providers.json` (une seule source de
  vérité), supprimer le fallback `default-key` (échouer si absent), passer `workspace` au
  constructeur, sérialiser `tools`/`tool_choice` et remonter `tool_calls`.
  `LocalWorkspace.root` doit être confiné par `PathGuard`.
- **Statut : CORRIGÉ** (F-07 et F-07b).
  - URL : `resolveFreeLLMAPIBaseURL()` — `providers.json` → overrides d'env explicites →
    `http://127.0.0.1:3001/v1`. Plus aucun hôte public.
  - Credentials : `resolveFreeLLMAPIKey()` — `FREELLMAPI_API_KEY` (doc) puis alias
    `FREE_LLM_API_KEY`. Clé absente ⇒ refus explicite, **aucune requête réseau**.
  - Workspace : `LocalWorkspace` réellement passé à `new SDKCodingEngine(provider, workspace)`
    et `projectPath` confiné aux racines autorisées (`RaqibCodingEngineAdapter.ts`).
  - `ModelGateway` : `apiKeyEnvAlt`, base locale par défaut, `isEnabled()` fail-closed.
  - Preuves : `tests/tool-gateway/freellmapi-alignment.spec.ts` (9 tests) et
    `tests/model-gateway/freellmapi-adapter.spec.ts` (5 tests).

### F-08 — `codebase_audit` n'audite rien

- **Sévérité** : Moyenne
- **Classe** : `placeholder-branch`
- **Emplacement** : `packages/tool-gateway/src/SkillsRegistry.ts:63-74`
- **Preuve code** :

```ts
handler: async (args, context) => {
  if (context?.sandbox && context?.sandboxCtx) {
    return await context.sandbox.executeCommand(context.sandboxCtx, ['ls', '-la', args.path]);
  }
  return { message: `Codebase audit for path ${args.path}` };   // ← sans sandbox
}
```

- **Preuve d'exécution** :

```
POST /api/skills/codebase_audit/execute  {"path":"services"}
→ {"result":{"message":"Codebase audit for path services"}}
```

- **Accessibilité** : `POST /api/skills/:name/execute` n'injecte **aucun** `context`
  (`server.ts:100` appelle `execute(name, req.body)` sans troisième argument). La branche
  sandbox est donc structurellement inatteignable par l'API.
- **Impact** : l'écran `/skills` liste un skill qui « audite le codebase » et retourne une
  phrase. Le nom du skill est un contrat non tenu.
- **Correctif** : brancher `codebase_audit` sur `GitTool` + `FileTool` + `PathGuard`
  (tous réels), ou retirer l'entrée du registre.

### F-09 — Le WorkflowEngine n'a aucun nœud en production

- **Sévérité** : Moyenne
- **Classe** : `unwired-surface`
- **Emplacement** : `packages/mission-engine/src/WorkflowEngine.ts:42-48`,
  `services/runtime/src/RaqibRuntime.ts:61`
- **Preuve** : `addNode()` n'est appelé **que** dans `tests/runtime/workflow-skills.spec.ts:33-71`.
  Aucun appel dans `services/`, `packages/`, `apps/`.

```
rg "addNode\(" → 18 matches, dont 0 hors tests pour un enregistrement réel
```

- **Impact** : `GET /api/workflows` retourne toujours `{"workflows":[]}` et l'écran
  `/workflows` est vide par construction — pas parce qu'il n'y a pas eu d'exécution, mais
  parce que le moteur ne peut pas exécuter. Le moteur lui-même (SQLite, reprise d'état,
  conditions d'arêtes) est correct ; c'est le câblage qui manque.
- **Correctif** : enregistrer au démarrage les workflows réellement supportés
  (`MOSAIX-001`, self-improvement, audit) avec leurs nœuds et arêtes, ou retirer l'écran
  du menu tant que ce n'est pas fait.
- **Suite** : décision produit — quels workflows sont censés exister ?

### F-10 — Les rails HUD affichent des états codés en dur (composant non monté)

- **Sévérité** : Faible (latent)
- **Classe** : `misleading-ui` / `dead-code`
- **Emplacement** : `apps/dashboard/src/components/ShellRailLeft.tsx:34-48, 81, 89-92`
- **Preuve code** :

```ts
const WORK_MODS = [
  { icon: 'terminal', label: 'Workspace', badge: 'PROD' },
  { icon: 'account_tree', label: 'Workflows', badge: 'ACTIVE' },   // ← moteur sans nœuds (F-09)
  ...
];
const ROLES = [
  { label: 'Tests & Qualité', sub: 'PASSED', active: true },       // ← constante
  ...
];
const gauges = [
  { label: 'Rules',   pct: status?.emergencyStop ? 100 : 85 },     // ← 85 arbitraire
  { label: 'Memory',  pct: 42 },                                    // ← 42 arbitraire
  { label: 'Context', pct: ctxPct },                                // ← fallback 12
];
// envLinks
{ label: 'CI / CD', value: 'Vitest / Build OK' }                    // ← constante
```

- **Accessibilité** : **aucune aujourd'hui**. `rg "ShellRailLeft|ShellRailRight"` ne retourne
  que leurs propres définitions — ils ne sont importés ni par `layout.tsx` ni par
  `page.tsx`. `docs/WIRING_ROADMAP.md:25-26` les décrit comme « disponibles pour
  intégration future » : le mensonge est donc dormant, pas visible. Il le deviendrait
  au premier remontage.
- **Impact** : les badges `PROD`, `ACTIVE`, `PASSED`, et la ligne `CI / CD : Vitest / Build OK`
  affirment un état que rien ne mesure. Sur un HUD de gouvernance, une pastille verte qui
  ment est un défaut de sûreté, pas d'esthétique.
- **Correctif** : dériver chaque badge d'une source réelle (`/api/status`, `/api/audit`,
  `/api/workflows`), et afficher `INCONNU` quand la source est absente. Supprimer les
  pourcentages arbitraires ou les remplacer par une valeur `null` rendue comme `—`.

### F-11 — `/api/context` est appelé sans messages, donc `usedTokens = 0` toujours

- **Sévérité** : Moyenne
- **Classe** : `misleading-metric` (déjà identifié dans `docs/LLM_REQUEST_OPTIMIZATION.md` §2.1)
- **Emplacement** : `services/runtime/src/api/server.ts:54-58`, appelants dashboard
  `ShellRailLeft.tsx:66`, `HUDDock.tsx:71`, `hooks/useContextMetrics.ts`
- **Preuve code** :

```ts
app.get('/api/context', (req, res) => {
  const messages = (req.query.messages ? JSON.parse(req.query.messages) : []) as any[];
  const metrics = runtime.contextEngine.getMetrics(messages, tools);   // ← []
```

- **Impact** : la page `/context` affiche une jauge d'utilisation à 0 % en permanence, alors
  que le budget réellement consommé par les conversations n'est pas mesuré. C'est la même
  racine que le constat LLM : `availableTokens = 123 904` constant.
- **Correctif** : S3 (budget par modèle réel) + exposer les tokens réellement envoyés par le
  dernier tour de chat (`usage.prompt_tokens` quand disponible, estimation sinon).

### F-12 — `OpenCodeAdapter` fabrique un succès quand il n'a pas de sandbox

- **Sévérité** : Faible (latent)
- **Classe** : `false-success`
- **Emplacement** : `packages/tool-gateway/src/adapters/OpenCodeAdapter.ts:53-59`
- **Preuve code** :

```ts
return {
  taskId: req.taskId,
  success: true,
  output: `[OpenCode Engine] Executed task '${req.taskId}' on path '${req.projectPath}' with prompt: ${req.prompt}`,
  modifiedFiles: [],
  durationMs: Date.now() - startTime,
};
```

- **Accessibilité** : `OpenCodeAdapter` est exporté (`packages/tool-gateway/src/index.ts`) mais
  le runtime enregistre `RaqibCodingEngineAdapter` (`RaqibRuntime.ts:66`). **Non atteignable
  aujourd'hui** — d'où la sévérité Faible.
- **Impact** : si un jour quelqu'un bascule l'enregistrement sur `OpenCodeAdapter` sans passer
  de sandbox, il obtient un succès sans exécution — même piège que F-01.
- **Correctif** : `throw new SandboxUnavailableError(...)` au lieu du fallback, comme
  `DockerSandbox` le fait déjà correctement (`DockerSandbox.ts:81-90`).
- **Statut : CORRIGÉ**. Sans sandbox, ou avec sandbox mais sans `sandboxCtx`,
  l'adaptateur retourne `success: false` avec un motif `BLOCKED` explicite ; le
  succès n'est possible que si `executeCommand` renvoie `exitCode === 0`.
  Preuve : `tests/tool-gateway/opencode-adapter.spec.ts` (5 tests).

---

## 3. Ce qui est réel (vérifié, à ne pas « réparer »)

| Composant | Preuve |
|---|---|
| `ShellTool` | allowlist + policy + audit, `ShellTool.ts:345` |
| `GitTool` | `git` réel, `GitTool.ts:57-80` |
| `PathGuard` | confinement + fichiers sensibles, `PathGuard.ts:74-82` |
| `DockerSandbox` | fail-closed, isolation `--network none`, `DockerSandbox.ts:81-163` |
| `VerificationEngine` | 6 types de checks réels (sauf le défaut d'appel F-03) |
| `MemoryEngine` | SQLite réel, `MemoryEngine.ts:104-180` |
| `WorkflowEngine` (le moteur) | exécution réelle, persistance d'état |
| `SubagentManager` | exécution réelle, refuse de simuler un succès (`SubagentManager.ts:509-538`) |
| `MissionEngine.runNextStep` | PolicyEngine + audit + idempotence + fail-closed sans handler |
| `ModelGateway` | retry ciblé, budget, adaptateurs HTTP réels |
| `HudContext` | `/api/status` + `/api/chat` réels |
| Pages `/missions`, `/agents`, `/audit`, `/approvals`, `/memory`, `/conversations` | toutes branchées sur `/api/*` |

---

## 4. Needs follow-up (signaux faibles, pas des findings)

- **FU-01 — `ToolRegistry` du Coding Engine est vide.** `new ToolRegistry()` (`engine.ts:19`)
  n'enregistre aucun outil ; `builtin.ts`, `apply-patch.ts` et `advanced.ts` exportent des
  outils que personne n'appelle `register()`. Conséquence logique de F-01, mais à traiter
  séparément : même un moteur câblé n'aurait aucun outil.
- **FU-02 — `/api/skills/:name/execute` n'applique pas `requiredPermission`.**
  `SkillsRegistry` déclare `requiredPermission: 'READ' | 'WRITE' | 'EXECUTE'`
  (`SkillsRegistry.ts:67,80,100,133`) mais `execute()` (`:49-60`) ne consulte jamais le
  `PolicyEngine`. Un skill `WRITE` est appelable sans passer par la gouvernance. À confronter
  à `docs/CONSTITUTION.md` avant correction.
- **FU-03 — `ShellRailLeft`/`ShellRailRight` sont du code mort.** Vérifié : aucune importation
  hors de leurs propres fichiers. 165+ lignes de HUD qui ne s'affichent nulle part. Décider :
  les câbler (après avoir retiré les constantes de F-10) ou les supprimer.
- **FU-04 — `coding-engine/packages/server` et `storage` ne sont pas montés.**
  `SQLiteTaskStore` et le serveur HTTP du SDK existent mais le runtime utilise son propre
  serveur. Duplication de surface à trancher (réutiliser ou supprimer).
- **FU-05 — `MiniMax`/`puter` : coûts non retournés.** `puter.ts:90-93` estime les coûts,
  ce qui est honnête, mais aucun tarif réel n'est configuré → `cost.total = 0` pour ce
  provider (même racine que S8).
- **FU-06 — `NeuralCanvas` utilise `Math.random`.** `NeuralCanvas.tsx:101-103,154`. C'est
  cosmétique (bruit visuel), pas une donnée affichée. **Exclu** des findings, listé pour
  mémoire.

---

## 5. Excluded (faux positifs écartés)

| Élément | Pourquoi ce n'est pas un finding |
|---|---|
| `tests/**` | fixtures de test, non packagées, non atteignables en production |
| `docs/mockups/*.html` | maquettes explicitement identifiées comme telles, hors runtime |
| `scripts/llm-context-audit.ts` | script de mesure, données synthétiques assumées |
| `NeuralCanvas` `Math.random` | bruit visuel décoratif, aucune affirmation d'état |
| `placeholder="..."` dans les formulaires | attribut HTML standard, pas un stub |
| `Mockup`/`demo` dans les libellés UI | aucun cas trouvé dans `apps/dashboard/src` |

---

## 6. Plan de câblage arbitré

| Priorité | Ordre | Action | Finding | Effort | Risque |
|---|---|---|---|---|---|
| **P0** | 1 | ✅ Coding Engine fail-closed tant que la boucle n'existe pas | F-01, F-05 | 0,5 j | nul — supprime un mensonge |
| **P0** | 2 | ✅ Vérification sans checks → `BLOCKED` | F-03 | 0,5 j | faible |
| **P0** | 3 | ✅ `git_status_check` → `GitTool` réel | F-02 | 0,5 j | faible |
| **P0** | 4 | ✅ `codebase_audit` → inventaire `fs` + `PathGuard` | F-08 | 0,5 j | faible |
| **P1** | 5 | ✅ Provider aligné, `tools` transmis (F-07b) — credentials/workspace restants | F-07, F-07b | 1 j | moyen |
| **P1** | 6 | ✅ Contrat de boucle livré (machine à états, approbation par hash, reprise crash) — applier réel non branché | F-01, F-04, F-06, FU-01 | 3–5 j | élevé |
| **P1** | 7 | Enregistrer les workflows de production | F-09 | 1–2 j | moyen |
| **P2** | 8 | C-1 Détection proactive à événements sourcés | — | 2 j | moyen |
| **P2** | 9 | C-2 Conseiller de prochaine action (`PROPOSAL` seule) | — | 2 j | moyen |
| **P2** | 10 | Rails HUD dérivés de l'état réel | F-10 | 1 j | faible |
| **P2** | 11 | `/api/context` alimenté par le dernier tour réel | F-11 | 1 j | moyen |
| **P3** | 12 | C-3 HUD vocal en lecture + confirmation | FU-02 | 2 j | élevé |

La séquence P0 ne dépend d'aucune décision produit : elle remplace des mensonges par des
refus explicites. C'est le seul chemin qui rend les findings suivants mesurables.

**Invariant CI déjà en place** : `SUCCESS ⇒ preuve d'exécution + preuve de vérification`
(`packages/shared/src/evidence.ts`, verrouillé par
`tests/governance/success-evidence-contract.spec.ts`). Toute nouvelle surface qui revendique
un succès sans preuve échoue en CI ; les surfaces non conformes sont en quarantaine
explicite, rattachée à un finding, et le test échoue dès qu'elles sont corrigées.

**Vision** : les capacités inspirées de JARVIS (anticipation, conseil, voix) et leurs
garde-fous anti-simulation sont spécifiés dans `docs/JARVIS_VISION.md` — aucune d'elles ne
peut transitionner une mission sans passer par `PolicyEngine` + `AuditLedger`.

---

## 7. État du câblage après exécution du P0

> Cette section consigne ce qui a été **corrigé et vérifié**, avec la preuve associée.
> Les findings ci-dessus restent la trace de l'état initial ; ils ne sont pas réécrits.

| Finding | Statut | Ce qui a changé | Preuve |
|---|---|---|---|
| F-01 | **Corrigé (fail-closed)** | `execute()` retourne `blocked`, `changes: []`, sans événement de succès ; plus aucun `completed` sans boucle réelle | `coding-engine/packages/runtime/src/engine.ts:63-78` ; test `tests/coding-engine/coding-engine.spec.ts` |
| F-02 | **Corrigé** | `git_status_check` mesure via `GitTool` : `dirtyCount`, `entries`, `source`, `observed` | `packages/tool-gateway/src/SkillsRegistry.ts` ; test F-02 (dépôt temporaire, 1 entrée) |
| F-03 | **Corrigé** | `verifyMission([])` → `BLOCKED` ; `MissionEngine` ne fabrique plus `(0,0)` | `packages/verification/src/VerificationEngine.ts:200-213` ; `MissionEngine.ts:909-918` ; test « sans aucun check » |
| F-05 | **Corrigé (fail-closed)** | `approve()` retourne `blocked` ; `cancel()` lève une erreur explicite ; route HTTP → 501 | `engine.ts:80-99` ; `coding-engine/packages/server/src/server.ts:65-74` |
| F-07b | **Corrigé** | `tools` + `tool_choice` sérialisés ; `toolCalls` remontés dans `ModelResponse` | `coding-engine/packages/providers/src/freellmapi.ts` ; `tests/coding-engine/freellmapi-tools.spec.ts` (3 tests) |
| F-08 | **Corrigé** | `codebase_audit` produit un inventaire réel (fichiers, octets, extensions) ; confinement ancré sur `workspaceRoot` (pas sur le chemin demandé), secrets exclus ; évasion `../..` refusée | `SkillsRegistry.ts` ; test F-08 (`.ts > 0`, `INVENTORY`) ; `tests/security/harness-redteaming.spec.ts` (audit réel + refus hors racine) |
| F-06 | **Corrigé** | `deleteFile()` réel + confinement ancré sur `root` ; `apply_patch` fail-closed (capacité absente, fichier absent, postcondition non observée) | `coding-engine/packages/project/src/workspace.ts` ; `apply-patch.ts` ; `tests/coding-engine/apply-patch-f06.spec.ts` |
| F-07 | **Corrigé** | URL locale par défaut, `FREELLMAPI_API_KEY` + alias, clé absente ⇒ refus sans réseau, `workspace` transmis et confiné, `isEnabled()` fail-closed | `RaqibCodingEngineAdapter.ts` ; `free-llm-api.ts` ; `openai-compatible.ts` ; `tests/tool-gateway/freellmapi-alignment.spec.ts` ; `tests/model-gateway/freellmapi-adapter.spec.ts` |
| F-04 | **Corrigé** | Planner réel : appel provider + validation stricte ; erreurs explicites, aucun plan constant | `coding-engine/packages/runtime/src/planner.ts` ; `tests/coding-engine/planner-real.spec.ts` (10 tests) |
| F-12 | **Corrigé** | Sans sandbox/contexte : `success: false` + `BLOCKED` ; succès uniquement sur `exitCode === 0` | `packages/tool-gateway/src/adapters/OpenCodeAdapter.ts` ; `tests/tool-gateway/opencode-adapter.spec.ts` (5 tests) |
| P1 (contrat) | **Livré, non branché** | Machine à états `PLANNING → AWAITING_APPROVAL → APPLYING → VERIFYING → COMPLETED` (+ `BLOCKED`) ; approbation liée au hash exact, expiration, timeout, confinement du patch, vérification exigeante en preuve, reprise crash ⇒ `BLOCKED`, workspaces isolés ; contexte d'approbation capturé puis re-vérifié (anti-TOCTOU) ; applier confiné avec rollback d'échec partiel ; aucun branchement HTTP | `coding-engine/packages/runtime/src/loop.ts` ; `applier.ts` ; `tests/coding-engine/loop-contract.spec.ts` (41 tests) ; `tests/coding-engine/applier-p1.spec.ts` (25 tests) ; `docs/P1_LOOP_CONTRACT.md` |
| F-09, F-10, F-11 | **Ouverts** | non traités | — |

### Invariant CI

`tests/governance/success-evidence-contract.spec.ts` (17 tests) :
- toute surface qui revendique un succès sans preuve échoue ;
- la quarantaine est exacte : une surface corrigée fait échouer le test tant qu'elle n'est
  pas retirée de la liste ;
- **la quarantaine est vide** : F-06 est le dernier finding qui y figurait, il est corrigé.

Un `{ message }` ou un objet vide ne satisfait jamais le contrat ; un skill à contrat de
travail (`claimsOnAnyResponse`) doit fournir une preuve observée pour être considéré
comme réussi.

### Preuves d'exécution

```
npx vitest run tests/governance tests/tool-gateway tests/integration  → 48 passed
npx vitest run tests/verification tests/governance/coherence-invariants tests/mission-engine → 34 passed
npx vitest run tests/coding-engine tests/governance/success-evidence-contract → 22 passed
npx vitest run tests/coding-engine/apply-patch-f06.spec.ts → 11 passed
npx vitest run tests/tool-gateway/freellmapi-alignment.spec.ts → 9 passed
npx vitest run tests/model-gateway/freellmapi-adapter.spec.ts → 5 passed
npx vitest run tests/coding-engine/planner-real.spec.ts → 10 passed
npx vitest run tests/tool-gateway/opencode-adapter.spec.ts → 5 passed
npm test (suite complète) → 41 fichiers, 247 tests passed
npx tsc --noEmit → 978 erreurs préexistantes dans tests/, 0 dans les fichiers modifiés
```
