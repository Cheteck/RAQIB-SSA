# RAQIB-SSA — Feuille de Route & Statut d'Avancement

## Vision Produit
RAQIB-SSA est un système souverain d'agent IA gouverné, aligné avec sa Constitution interne, garantissant la sécurité, la traçabilité et l'auto-amélioration contrôlée.

---

## Phase 0 : Audit & Sécurisation Prioritaire (P0) — COMPLÉTÉE

- [x] **T1 (P0 - Constitution §2) : Fix `approvalRequired: false`**
  - *Problème :* `createSelfImprovementMission()` créait la mission auto avec `approvalRequired: false`, lui permettant d'exécuter du code sans approbation humaine.
  - *Correction :* `approvalRequired: true` forcé dans `RaqibRuntime.ts`. Mission créée en état `PLANNED`.
  - *Vérification :* Couvert par la suite de tests de sécurité `tests/security/approval-gate.spec.ts` (SEC-11).

- [x] **T1.1 (P0 - Bypass API Server) : Fix auto-start bypass dans `/api/missions/self-improve`**
  - *Problème :* L'endpoint API basculait la mission en `RUNNING` même quand elle était `PLANNED`.
  - *Correction :* Bloqué dans `server.ts`. Ne démarre automatiquement que si `status === 'APPROVED'`.

- [x] **T2 (P0 - Constitution §1 & §8) : Logging des erreurs du boucle tick**
  - *Problème :* Bloc `catch (err) {}` vide dans `startTickLoop()`, masquant silencieusement les pannes.
  - *Correction :* Remplacé par `auditLedger.log({ type: 'ERROR', actor: 'raqib-runtime', data: { message, stack } })`.

- [x] **T3 (P0 - Sécurité) : Vérification de l'Arrêt d'Urgence (Emergency Stop)**
  - *Vérification :* Double mécanisme confirmé opérationnel (Var d'env `RAQIB_EMERGENCY_STOP` + fichier lock `data/emergency.lock`). Intégré dans l'API et le tick loop.

- [x] **T4 (P1 - Robustesse) : Matching strict des étapes de mission**
  - *Problème :* Le matching par sous-chaîne (`name.includes('test')`) pouvait déclencher le mauvais exécuteur.
  - *Correction :* Remplacé par un dictionnaire de handlers à correspondance exacte (`stepHandlers`), avec cas par défaut retournant `status: 'FAILED'` explicite.

- [x] **T5 (P1 - Tests) : Suite de tests d'approbation et sécurité**
  - *Correction :* Ajout de `tests/security/approval-gate.spec.ts` (6 tests). Suite globale : **75 tests / 15 fichiers tous au vert**.

- [x] **T6 (P2 - Architecture) : Statut de `coding-engine/`**
  - *Analyse :* Sous-projet actif et sain (9 packages dans `workspaces`, adapté via `RaqibCodingEngineAdapter`, câblé dans la skills registry et `/api/opencode/execute`).

- [x] **T7 (P2 - Architecture) : ADR 0001 — Monolithe Modulaire**
  - *Action :* Rédigé et consigné dans `docs/adr/0001-modular-monolith-over-microservices.md`.

---

## Phase 1 : Consolidation & Qualité de Code (En Cours)

- [x] **P1.1 : Modélisation des types d'étapes (`StepType`)**
  - Ajout du type enum `StepType` (`INVENTORY`, `ANALYZE`, `PROPOSE`, `TYPECHECK`, `BUILD`, `TEST`, `REPORT`, `CUSTOM`) dans `@raqib/shared` & `@raqib/core`.
  - Prise en compte dans le `MissionStepSchema` de Zod et le dispatching explicite de `RaqibRuntime`.
  - Couvert par `tests/runtime/steptype-contract.spec.ts`.

- [ ] **P1.2 : Isolation des bases SQLite de test**
  - Configurer un verrouillage explicite ou un nettoyage propre post-test pour éviter les conflits `EPERM` SQLite intermittents sous Windows lors des exécutions parallèles de Vitest.

- [ ] **P1.3 : Hardening du Docker Sandbox**
  - Vérifier l'étanchéité du `DockerSandbox` pour l'exécution d'outils potentiellement dangereux (ex: `execSync` sans conteneurisation).

---

## Phase 2 : Dashboard UI & Observabilité

- [ ] **P2.1 : Alignement des routes API et du Dashboard Next.js**
  - Audit complet du dashboard (`apps/dashboard`) et validation E2E avec Playwright.

- [ ] **P2.2 : Visualisation du Journal d'Audit & Graphe de Missions**
  - Interface graphique pour la revue et l'approbation des missions en attente (`APPROVAL_REQUIRED`).

---

## Indicateurs de Santé du Projet

| Métrique | Valeur | Statut |
|---|---|---|
| Tests unitaires & intégration | 75 / 75 passés (100%) | 🟢 Vert |
| Compilation TypeScript (`npm run build`) | 0 erreur | 🟢 Vert |
| Violations Constitutionnelles connues | 0 | 🟢 Vert |
| Couverture de la suite Sécurité | SEC-01 à SEC-11 | 🟢 Vert |