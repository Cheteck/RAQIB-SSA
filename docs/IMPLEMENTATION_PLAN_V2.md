# Plan d'implémentation — RAQIB v2.0 (PRD révisé)

> Basé sur `RAQIB-PRD-v2.0-revise.md`. État actuel : fondations runtime + dashboard en place.

## Constat (ce qui existe déjà)

| Composant PRD | État actuel |
|---|---|
| RAQIB Core (missions, config) | ✅ MissionEngine + RaqibRuntime |
| Policy Engine | ✅ PolicyEngine (rules, budgets, approvals) |
| Model Gateway | ✅ + endpoint HTTP `/api/chat` |
| Tool Gateway | ⚠️ Partiel (pas de sandbox Docker) |
| Mission Engine | ✅ + step executor + self-improve mission |
| Memory System | ❌ Non implémenté |
| Audit Ledger | ✅ SQLite append-only |
| Verification Engine | ⚠️ Existe, pas exposé HTTP |
| Dashboard (Next.js) | ✅ Shell + pages + hooks |
| Shell persistant | ✅ layout.tsx (ShellDock, Navigation, rails) |
| Arrêt d'urgence | ✅ Endpoint + UI Settings |
| Budget | ✅ Endpoints + PolicyEngine |
| Approbations | ✅ Endpoints + page + hook |
| Audit (filtres) | ⚠️ Endpoint basique, pas de filtres |

## Phases proposées (alignées PRD)

### Phase A — Stabiliser l'existant (1-2 j)
- Vérifier que toutes les routes fonctionnent en accès direct et après rafraîchissement.
- Ajouter transitions légères (opacity/translate, 250-400ms) dans ModuleOverlay (déjà partiellement).
- Respecter `prefers-reduced-motion` (déjà dans CSS).
- Tester l'arrêt d'urgence depuis le shell sur toutes les routes.

### Phase B — Audit MosaiX (RAQIB-001) (2-3 j)
- Créer la mission `RAQIB-001` (lecture seule) via `POST /api/missions` ou un script seed.
- Implémenter les steps : inventory, git status, manifests, tests/docs, risques, rapport, vérification non-modification.
- Exposer `GET /api/missions/:id/steps` pour le détail.
- Générer le rapport dans `reports/raqib-001/`.

### Phase C — Exposer Verification + Memory (3-4 j)
- Endpoint `POST /api/verify` et `GET /api/verify/:id`.
- Implémenter `MemorySystem` (mémoire de mission, projet, institutionnelle, expérience) avec provenance.
- Endpoint `GET /api/memory/:missionId`.

### Phase D — Dashboard temps réel (2-3 j)
- SSE `/api/events` côté runtime.
- Consommation côté dashboard (mise à jour instantanée audit/missions).
- Filtres audit (type, date, pagination).
- Error boundaries + skeletons.

### Phase E — Self-improvement mission (RAQIB) (2-3 j)
- Laisser RAQIB créer et exécuter `RAQIB-SELF-IMPROVE-001` via l'endpoint existant.
- Ajouter `POST /api/missions/:id/run` (déjà fait) pour pilotage.
- Générer le rapport `reports/raqib-self-improvement.md`.

### Phase F — Sécurité & tests (3-4 j)
- Tests de sécurité (injection, budget, permissions, emergency stop).
- Tests de résilience (reprise après crash, reconnexion).
- Sandbox Docker (isolation réseau, pas de socket hôte).
- Audit de non-régression.

### Phase G — Production (2-3 j)
- Authentification (clé API).
- `.env.example` documenté.
- CI (GitHub Actions).
- Dockerisation + docker-compose.

## Priorité immédiate

1. **Phase B** — créer et exécuter RAQIB-001 (audit MosaiX) pour valider les fondations.
2. **Phase C** — exposer Verification Engine.
3. **Phase D** — temps réel.

## Risques

- Le runtime bloque pendant les steps longs (execSync) → rendre le step executor asynchrone (exec + promisify).
- Pas de sandbox Docker → exécution de code non isolée.
- Pas de Memory System → RAQIB ne conserve pas de contexte entre missions.
- Pas d'authentification → environnement local uniquement.

## Prochaine action

Créer la mission `RAQIB-001` (audit MosaiX) via l'endpoint existant et la laisser s'exécuter. Valider le rapport généré.