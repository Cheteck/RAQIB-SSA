# RAQIB — Feuille de route Wiring (UI ↔ Runtime)

> Objectif : passer de l'interface visuelle (HUD) déjà intégrée à un système pleinement câblé au runtime RAQIB.

## État actuel (diagnostic)

### Câblé et fonctionnel
- `GET /api/status` → Navigation, ShellRailLeft, HudContext (polling 15s), Settings.
- `GET /api/missions` → Missions page, HudContext (compteur).
- `GET /api/audit` → Audit page, HudContext (compteur).
- `POST /api/emergency-stop` → Settings (activate/deactivate).
- `GET /api/budget/:missionId`, `POST /api/budget/:missionId` → endpoints existants.

### Non câblé / partiel
- **Approvals** : la page appelle `GET /api/approvals` qui **n'existe pas** côté runtime (seuls `POST /api/approvals/request` et `POST /api/approvals/:id/grant`). La liste est donc toujours vide.
- **Model Gateway** : aucun endpoint HTTP n'expose `complete()` / `healthCheck()`. Le HUD (`HudContext.go`) renvoie des réponses **cannées** (RS), pas l'IA réelle.
- **Verification Engine** : non exposé par l'API.
- **Création / pilotage de mission** : pas de formulaire ni de déclenchement depuis le dashboard (seule la liste est affichée).
- **Temps réel** : polling uniquement (15s status, pas de push). Aucun SSE/WebSocket.
- **Authentification** : aucune (runtime suppose un environnement local de confiance).
- **Gestion d'erreurs centralisée** : fetch ad hoc dans chaque composant, pas de client API commun.

---

## Phase 0 — Stabilisation & vérification E2E

**Objectif** : s'assurer que l'environnement dev tourne de bout en bout avant d'ajouter du câblage.

- [ ] Documenter la procédure de démarrage (`npm run dev` → runtime 4000 + dashboard 3000).
- [ ] Ajouter un script `dev:check` qui vérifie que le runtime répond (`/api/status`) avant de lancer le dashboard.
- [ ] Smoke test manuel de chaque route (`/`, `/missions`, `/approvals`, `/audit`, `/settings`) avec runtime actif.
- [ ] Vérifier CORS, `NEXT_PUBLIC_API_URL`, et le mode offline (runtime arrêté → messages d'erreur clairs).

**Livrable** : checklist E2E validée, aucun crash console.

---

## Phase 1 — Compléter la surface API du runtime

**Objectif** : exposer tout ce que le dashboard doit consommer.

### 1.1 Approvals
- [ ] `GET /api/approvals` — liste des demandes en attente (avec filtre `?status=pending|granted|rejected`).
- [ ] `GET /api/approvals/:id` — détail d'une demande.
- [ ] `POST /api/approvals/:id/reject` — refus (symétrique de `grant`).
- [ ] S'assurer que `requestApproval` persiste et que la liste se rafraîchit.

### 1.2 Missions
- [ ] `POST /api/missions/:id/run` — déclencher l'exécution du prochain step (ou boucle complète).
- [ ] `POST /api/missions/:id/pause` / `resume` (si supporté par le moteur).
- [ ] `GET /api/missions/:id/steps` — détail des steps + preuves.

### 1.3 Model Gateway
- [ ] `POST /api/chat` — `{ prompt, context? }` → `{ text, model, latencyMs, cost }`, avec budget check.
- [ ] `GET /api/models/health` — health check des providers configurés.
- [ ] `GET /api/budget` (global) — synthèse des budgets par mission.

### 1.4 Verification
- [ ] `POST /api/verify` — lancer une vérification sur un fichier / mission.
- [ ] `GET /api/verify/:id` — résultat.

### 1.5 Audit
- [ ] Filtres `?type=`, `?from=`, `?to=`, `?limit=`, `?offset=` sur `GET /api/audit`.
- [ ] `GET /api/audit/export` — export JSON/CSV.

### 1.6 Temps réel (optionnel Phase 1)
- [ ] `GET /api/events` (SSE) — stream des nouveaux événements d'audit + changements de statut mission.

**Livrable** : surface API complète et documentée (OpenAPI ou Markdown).

---

## Phase 2 — Couche données dashboard (client API + hooks)

**Objectif** : centraliser les appels et éviter la duplication.

- [ ] Créer `apps/dashboard/src/lib/api.ts` : wrapper fetch avec `API_BASE`, gestion d'erreurs typées, timeout, retry léger.
- [ ] Créer des hooks dans `apps/dashboard/src/hooks/` :
  - `useStatus()` (polling + état online)
  - `useMissions()`
  - `useApprovals()`
  - `useAudit(filters)`
  - `useEmergencyStop()`
- [ ] Remplacer les `fetch` ad hoc dans les pages par ces hooks.
- [ ] Ajouter un état global léger (React Context) pour le statut runtime et les compteurs (déjà partiellement dans `HudContext`).

**Livrable** : aucune page n'appelle `fetch` directement ; toutes passent par la couche API.

---

## Phase 3 — Câblage des interactions cœur

**Objectif** : rendre les pages pleinement interactives.

### 3.1 Approvals
- [ ] Liste réelle via `GET /api/approvals`.
- [ ] Boutons Autoriser/Rejeter → endpoints grant/reject, mise à jour optimiste + refresh.
- [ ] Affichage des détails (mission liée, budget, justification).

### 3.2 Missions
- [ ] Formulaire de création de mission (nom, objectif, budget, autonomie).
- [ ] Bouton "Exécuter" / "Pause" par mission.
- [ ] Panneau de détail : steps, preuves, timeline.

### 3.3 Settings
- [ ] Toggle Emergency Stop (déjà fait) + affichage de l'état read-only.
- [ ] Configuration des budgets par mission.
- [ ] Sélecteur de provider/modèle IA (si multi-provider).

### 3.4 Audit
- [ ] Filtres par type / date.
- [ ] Pagination.
- [ ] Export.

### 3.5 HUD command bar
- [ ] Remplacer les réponses cannées de `HudContext.go` par un appel `POST /api/chat`.
- [ ] Affichage en streaming (typewriter déjà présent, adapter au flux).
- [ ] Journaliser chaque commande dans l'audit ledger (côté runtime).

**Livrable** : toutes les actions UI déclenchent de vraies opérations runtime et mettent à jour l'affichage.
---

## Phase 4 — IA & budget

**Objectif** : intégrer le Model Gateway dans l'expérience.

- [ ] Indicateur de santé des providers dans le HUD (dot vert/rouge).
- [ ] Affichage du coût / latence par réponse.
- [ ] Garde-fous budgétaires visibles (barre de budget par mission).
- [ ] Fallback gracieux si le provider est indisponible (réponse locale).

**Livrable** : le HUD répond avec l'IA réelle et respecte les budgets.

---

## Phase 5 — Robustesse & temps réel

**Objectif** : rendre l'expérience fiable et réactive.

- [ ] SSE (`/api/events`) côté runtime + consommation côté dashboard (mise à jour instantanée audit/missions).
- [ ] Error boundaries React sur chaque page.
- [ ] Skeletons de chargement uniformes.
- [ ] Mode dégradé hors ligne (bannière + données en cache).
- [ ] Reconnexion automatique avec backoff.

**Livrable** : aucune page ne reste bloquée ; les mises à jour sont quasi temps réel.

---

## Phase 6 — Production & qualité

**Objectif** : préparer le déploiement.

- [ ] Authentification (clé API ou JWT) sur le runtime + stockage sécurisé côté dashboard.
- [ ] Variables d'environnement documentées (`.env.example`).
- [ ] Build de production testé (`npm run build` + `npm run start`).
- [ ] Tests E2E Playwright des flux critiques (emergency stop, création mission, approbation).
- [ ] CI (GitHub Actions) : lint, typecheck, tests, build.
- [ ] Dockerisation (runtime + dashboard) + docker-compose.

**Livrable** : déploiement reproductible et testé.

---

## Priorités recommandées (ordre d'exécution)

1. **Phase 1.1 (Approvals GET)** — débloque immédiatement la page Approvals.
2. **Phase 3.5 (HUD → Model Gateway)** — donne vie à la commande centrale.
3. **Phase 2 (couche API)** — refactor nécessaire avant d'aller plus loin.
4. **Phase 1.3 (Model Gateway HTTP)** — prérequis de 3.5.
5. **Phase 3.1–3.2** — interactions missions/approbations.
6. **Phase 5 (temps réel)** — polish.
7. **Phase 6** — production.

## Risques & points d'attention

- **CORS / ports** : le dashboard (3000) dépend du runtime (4000). Toujours démarrer le runtime d'abord.
- **Données SQLite** : un seul fichier `data/raqib.db` ; attention aux accès concurrents si plusieurs instances.
- **Budget** : `getBudget` est synchrone et peut retourner `undefined` ; gérer côté API.
- **Modèle IA** : nécessite `config/providers.json` valide ; prévoir un mode mock pour le dev sans clé API.
- **Hydratation** : tout nouveau composant lisant `window`/`localStorage` doit suivre le pattern `useState` + `useEffect` (cf. ShellDock).

---

## Prochaine action immédiate

Commencer par **Phase 1.1** (ajouter `GET /api/approvals`) + **Phase 2** (client API + hooks), puis **Phase 1.3** (endpoint chat). Cela débloque la page Approvals et donne une base propre pour câbler le HUD.
