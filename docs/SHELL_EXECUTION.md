# RAQIB — Exécution de commandes shell gouvernée

> **Statut :** Implémenté et testé  
> **Date :** 2026-11-06  
> **Composant :** `packages/tool-gateway/src/ShellTool.ts`

---

## 1. Objectif

Donner à RAQIB la capacité d'exécuter des commandes shell **sans ouvrir une porte d'exécution arbitraire** : allowlist, arguments séparés (pas de shell implicite), confinement du répertoire de travail, timeout borné, environnement filtré, autorisation par le `PolicyEngine` et journalisation dans l'`AuditLedger`.

---

## 2. Garanties de sécurité

| Garantie | Implémentation |
|---|---|
| Pas de shell implicite | `execFile` + tableau d'arguments (`shell: false`) |
| Allowlist de commandes | basename validé contre `allowedCommands` (défaut : `git`, `node`, `npm`, `npx`, `tsc`, `vitest`, `docker`, `ls`, `cat`, `pwd`, `echo`) |
| Métacaractères refusés | forme chaîne : `; & \| > < \` $ ( ) { } [ ] \` et retours ligne rejetés |
| Confinement cwd | `PathGuard` sur `cwdRoot` ; `..` et chemins hors racine refusés |
| Symlinks résolus | `PathGuard.realpathDeep` résout les liens sur la plus longue portion existante ; un lien (ou un ancêtre) pointant hors du root est refusé (CWE-59) |
| Timeout borné | défaut 30 s, plafond 300 s |
| Sortie bornée | `maxBuffer` 1 Mo par défaut |
| Environnement filtré | seules les variables système utiles sont transmises ; `*KEY*`, `*TOKEN*`, `*SECRET*`, `*PASSWORD*`, `*CREDENTIAL*`, `*AUTH*` sont supprimées |
| Autorisation | hook `authorize` branché sur `PolicyEngine.authorize({ actionType: 'EXECUTE' })` |
| Audit | événement `ACTION_EXECUTED` (command, args, cwd, exitCode, durationMs, timedOut, **outcome**) + `POLICY_DECISION` ; **refus tracés** même quand aucun processus n'est lancé |
| Corrélation | `missionId`, `stepId`, `correlationId` propagés dans les événements d'audit et dans `POLICY_DECISION` (colonnes dédiées de `audit_events`) |
| Windows | shims `npm`/`npx`/`tsc`/`vitest` exécutés via `cmd.exe /d /s /c` avec arguments pré-validés |

Le mode read-only (`RAQIB_READ_ONLY_MODE=true`) refuse toute exécution : `EXECUTE` appartient aux `WRITE_ACTIONS` de la règle `RULE-002`.

---

## 3. Configuration

| Variable | Effet |
|---|---|
| `RAQIB_SHELL_ALLOWLIST` | Liste séparée par virgules remplaçant l'allowlist par défaut |
| `RAQIB_SHELL_CWD_ROOT` | Racine de confinement du `cwd` shell (défaut : `process.cwd()`). Le shell n'est jamais rattaché automatiquement au dépôt cible `targetRepoPath`. |
| `RAQIB_READ_ONLY_MODE` | `true` → toute commande shell est refusée par la politique |

---

## 4. Utilisation

### 4.1 API HTTP

```http
POST /api/shell/execute
Content-Type: application/json

{
  "command": ["node", "--version"],
  "cwd": ".",
  "timeoutMs": 10000,
  "missionId": "MOSAIX-001",
  "stepId": "step-3",
  "correlationId": "corr-abc"
}
```

Réponse :

```json
{
  "result": {
    "command": "node",
    "args": ["--version"],
    "cwd": "D:\\Projets\\RAQIB-SSA",
    "exitCode": 0,
    "stdout": "v26.12.1\r\n",
    "stderr": "",
    "durationMs": 68,
    "timedOut": false
  }
}
```

Une commande refusée renvoie **HTTP 403** avec `{"error": "..."}`.

### 4.2 Skill (registry)

```ts
await runtime.skillsRegistry.execute('shell_exec', { command: ['git', 'status', '--porcelain'] });
```

### 4.3 Runtime

```ts
const result = await runtime.executeShell({ command: ['node', '--version'] });
```

---

## 5. Preuves

- `tests/tool-gateway/shell-tool.spec.ts` — 13 tests : allow, deny, métacaractères, confinement cwd, exit code non nul, timeout, hook authorize, événements, filtrage d'environnement, **corrélation + issue**, **cwd = junction sortante refusée**.
- `tests/tool-gateway/path-guard-symlinks.spec.ts` — 6 tests CWE-59 : refus d'un lien sortant (fichier, lien lui-même, chemin inexistant sous un ancêtre lien), autorisation d'un lien interne, autorisation d'un chemin futur sous le root.
- `tests/runtime/shell-execution.spec.ts` — 6 tests : exécution + `ACTION_EXECUTED`, refus hors allowlist, refus read-only + `POLICY_DECISION` DENY, présence du skill `shell_exec`, **corrélation des refus et issue `failure`**, **`targetRepoPath` externe inaccessible au shell**.
- Suite complète : **150 tests verts sur 30 fichiers**, `tsc -p tsconfig.build.json --noEmit` sans erreur.
- Vérification manuelle des symlinks sur cette machine (junction Windows créable sans admin) :
  - `junction created: true`
  - `validate escape/secret.txt` → `{"allowed":false,"reason":"Access denied: Path outside allowed root"}`
  - `validate inside/new.txt` → `{"allowed":true,"reason":"Allowed"}`
- Vérification HTTP réelle :
  - `POST /api/shell/execute` avec `["node","--version"]` + `correlationId=corr-ok-1` → `exitCode: 0`, `stdout: v26.12.1`, audit `ACTION_EXECUTED` `outcome=success`.
  - `POST /api/shell/execute` avec `node -e "process.exit(4)"` + `correlationId=corr-fail-2` → `exitCode: 4`, audit `ACTION_EXECUTED` `outcome=failure`.
  - `POST /api/shell/execute` avec `["rm","-rf","."]` + `correlationId=corr-deny-3` → **403** `Command 'rm' is not in the shell allowlist`, audit `POLICY_DECISION` `verdict=DENY`, `phase=SHELL_ALLOWLIST`.
  - `GET /api/audit?missionId=MOSAIX-DEMO` → lignes corrélées `stepId=step-shell` avec `corr-ok-1`/`corr-fail-2`/`corr-deny-3`, `verdict`, `outcome` et `exitCode` visibles.

---

## 6. Limites connues

- **Accès shell aux dépôts externes suspendu** : `ShellTool` est confiné à `RAQIB_SHELL_CWD_ROOT` ou `process.cwd()`, jamais à `targetRepoPath`. Un `cwd` pointant vers un dépôt cible externe est refusé (`Working directory refused`). Réactivation = décision architecturale explicite.
- Le shell interactif (stdin) n'est pas exposé : uniquement des commandes non interactives.
- L'allowlist porte sur le binaire, pas sur ses arguments : `git` peut modifier un dépôt si le répertoire est inscriptible. Le confinement read-only du dépôt reste une responsabilité de la politique de mission.
- Les shims Windows (`npm`, `npx`, `tsc`, `vitest`) passent par `cmd.exe /d /s /c` ; la sécurité repose sur le refus préalable des métacaractères et l'absence de shell pour les autres binaires.
