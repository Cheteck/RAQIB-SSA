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
| Timeout borné | défaut 30 s, plafond 300 s |
| Sortie bornée | `maxBuffer` 1 Mo par défaut |
| Environnement filtré | seules les variables système utiles sont transmises ; `*KEY*`, `*TOKEN*`, `*SECRET*`, `*PASSWORD*`, `*CREDENTIAL*`, `*AUTH*` sont supprimées |
| Autorisation | hook `authorize` branché sur `PolicyEngine.authorize({ actionType: 'EXECUTE' })` |
| Audit | événement `ACTION_EXECUTED` (command, args, cwd, exitCode, durationMs, timedOut) + `POLICY_DECISION` |
| Windows | shims `npm`/`npx`/`tsc`/`vitest` exécutés via `cmd.exe /d /s /c` avec arguments pré-validés |

Le mode read-only (`RAQIB_READ_ONLY_MODE=true`) refuse toute exécution : `EXECUTE` appartient aux `WRITE_ACTIONS` de la règle `RULE-002`.

---

## 3. Configuration

| Variable | Effet |
|---|---|
| `RAQIB_SHELL_ALLOWLIST` | Liste séparée par virgules remplaçant l'allowlist par défaut |
| `RAQIB_READ_ONLY_MODE` | `true` → toute commande shell est refusée par la politique |

---

## 4. Utilisation

### 4.1 API HTTP

```http
POST /api/shell/execute
Content-Type: application/json

{ "command": ["node", "--version"], "cwd": ".", "timeoutMs": 10000 }
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

- `tests/tool-gateway/shell-tool.spec.ts` — 10 tests : allow, deny, métacaractères, confinement cwd, exit code non nul, timeout, hook authorize, événements, filtrage d'environnement.
- `tests/runtime/shell-execution.spec.ts` — 4 tests : exécution + `ACTION_EXECUTED`, refus hors allowlist, refus read-only + `POLICY_DECISION` DENY, présence du skill `shell_exec`.
- Suite complète : **140 tests verts**, `tsc --noEmit` sans erreur.
- Vérification HTTP réelle :
  - `POST /api/shell/execute` avec `["node","--version"]` → `exitCode: 0`, `stdout: v26.12.1`.
  - `POST /api/shell/execute` avec `["rm","-rf","."]` → **403** `Command 'rm' is not in the shell allowlist`.
  - `GET /api/audit?missionId=shell` → `ACTION_EXECUTED` + `POLICY_DECISION` ALLOW.

---

## 6. Limites connues

- `PathGuard` ne résout pas les liens symboliques (`fs.realpath`) : un symlink interne pointant hors du root n'est pas détecté.
- Le shell interactif (stdin) n'est pas exposé : uniquement des commandes non interactives.
- L'allowlist porte sur le binaire, pas sur ses arguments : `git` peut modifier un dépôt si le répertoire est inscriptible. Le confinement read-only du dépôt reste une responsabilité de la politique de mission.
