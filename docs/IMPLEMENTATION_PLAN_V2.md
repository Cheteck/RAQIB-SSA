# RAQIB — Plan d'Implémentation v2.0 Enrichi LLM Harness (8 Phases)

Ce document définit la feuille de route d'implémentation opérationnelle en **8 phases** pour l'Agent Auto-Souverain **RAQIB**, basée sur le PRD révisé v2.0 (`RAQIB-PRD-v2.0-revise.md`) enrichi des patrons de conception d'**Harness LLM Open Source** (LangChain, DeepAgents, AutoGen).

---

## Vue d'ensemble des 8 phases d'implémentation (avec Harness LLM)

| Phase | Intitulé / Domaine Fonctionnel | Packages & Composants Cibles | Objectifs Majeurs & Enrichissements Harness LLM |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Core Domain Architecture, Data Models & Context Engine** | `packages/core`, `packages/shared` | Modèles typés (Mission, Plan, Action, Policy, Verification, Governance), schémas Zod, **Context Window Manager & Token Budget Control**. |
| **Phase 2** | **Guardrails Engine, Dynamic Policy & Middleware Execution** | `packages/policy-engine` | Moteur de garde-fous, évaluation des niveaux d'autonomie (Level 0 à 4), **Hooks Middleware (`beforeAgent`, `afterAgent`)** et demandes d'approbation. |
| **Phase 3** | **Evaluation Framework & Advanced Metrics Engine** | `packages/verification`, `packages/mission-engine` | Moteur de vérification indépendante post-exécution, contrôle d'intégrité (git diff, linter, tests, sécurité) et calcul de métriques. |
| **Phase 4** | **Skills Engine & Multi-Tier Memory Framework** | `packages/mission-engine`, `packages/tool-gateway` | **Skills Registry (chargement dynamique/lazy `load_skill`)**, **Short-Term Checkpointer Memory (State Graphs)** & **Long-Term Episodic Memory**. |
| **Phase 5** | **API Gateway, Dynamic Workflows & Services Runtime Layer** | `services/runtime`, `packages/model-gateway`, `packages/tool-gateway` | Serveur Runtime Express, **Workflow Engine (State Graph Multi-Agents)**, Model Gateway (OpenAI, Anthropic, Ollama) et Sandbox isolée. |
| **Phase 6** | **Security, RBAC, Governance & Immutable Audit Logging** | `packages/audit-ledger`, `packages/policy-engine` | Registre d'audit append-only cryptographiquement sécurisé, gestion des rôles (Admin/Operator/Auditor) et Kill Switch / Mode Urgence. |
| **Phase 7** | **Dashboard Supervision & Observability Layer** | `apps/dashboard` | Interconnexion de l'UI Next.js avec le runtime tout en conservant **scrupuleusement l'intégrité et le design visuel UI/UX d'origine** (Missions, Approvals, Audit, Emergency). |
| **Phase 8** | **Quality Assurance, CI/CD Pipeline & End-to-End Verification** | `tests/`, `vitest.config.ts`, `.github/workflows` | Validation E2E complète, suite de tests d'intégration, conformité stricte au PRD v2.0 enrichi et livraison d'artefacts d'audit. |

---

## Détail des Phases d'Implémentation Enrichies

### Phase 1: Core Domain Architecture, Data Models & Context Engine
- **Objectifs Core :** Structurer le domaine métier de RAQIB avec typage TypeScript strict et validation Zod (`AgentMission`, `ExecutionPlan`, `ActionStep`, `PolicyRule`).
- **Enrichissement Harness LLM (Context Engine) :**
  - Implémentation du gestionnaire de fenêtre de contexte (Context Window Manager) avec élagage automatique des messages verbeux.
  - Calculateur et contrôleur de budget de jetons (Token Budget Manager) prévenant les dérives.

### Phase 2: Guardrails Engine, Dynamic Policy & Middleware Execution
- **Objectifs Core :** Moteur d'évaluation des règles de sécurité et gouvernance pré-exécution avec niveaux d'autonomie (L0 à L4).
- **Enrichissement Harness LLM (Middleware Hooks) :**
  - Architecture Middleware pour intercepter le déroulement des agents avant l'appel modèle (`beforeAgent`) et après l'exécution (`afterAgent`).
  - Validation automatique des garde-fous pour le code Shell, Git, Réseau et fichiers système.

### Phase 3: Evaluation Framework & Advanced Metrics Engine
- **Objectifs Core :** Moteur de vérification post-exécution (Syntaxe, Linter, Tests d'intégration, Analyse statique).
- **Enrichissement Harness LLM :**
  - Évaluation de l'intégrité du code via git diff et vérification par LLM-as-a-Judge en bac à sable.
  - Génération automatique du score de complétude et de sécurité.

### Phase 4: Skills Engine & Multi-Tier Memory Framework
- **Enrichissement Harness LLM (Skills Engine & Memory Engine) :**
  - **Skills Registry :** Système de déclaration et de découverte dynamique de compétences réutilisables avec chargement lazy `load_skill(name)`.
  - **Short-Term Checkpointer Memory :** Sauvegarde et reprise des états de conversations/missions par fil (`thread_id`) avec persistance SQLite.
  - **Long-Term Episodic Memory :** Registre de mémoires persistantes synchronisées dynamiquement avec la sandbox de l'agent.

### Phase 5: API Gateway, Dynamic Workflows & Services Runtime Layer
- **Objectifs Core :** API Express REST, Model Gateway (OpenAI, Anthropic, Ollama local), Tool Gateway (Docker Sandbox).
- **Enrichissement Harness LLM (Dynamic Workflows Engine) :**
  - Modélisation de l'exécution des missions sous forme de graphes d'états orientés (State Graphs).
  - Support de l'orchestration multi-agents avec sous-agents spécialisés (Audit Agent, Security Agent, Refactoring Agent).

### Phase 6: Security, RBAC, Governance & Immutable Audit Logging
- **Objectifs Core :** Registre d'audit append-only avec hachage cryptographique (Merkle Chain).
- **Enrichissement Harness LLM :**
  - Traçabilité complète des appels de Skills, des prompts système injectés et des transitions de mémoire.
  - Emergency Kill Switch coupant instantanément le runtime et désactivant l'accès aux Skills.

### Phase 7: Dashboard Supervision & Observability Layer
- **Objectifs Core :** Intégrité et préservation totale du design et du code de l'interface Next.js existante dans `apps/dashboard`.
- **Enrichissement Harness LLM (Visualisation du Harness) :**
  - Restitution en temps réel des étapes du Workflow Engine (State Graph), de la mémoire consommée et des requêtes d'approbations en attente.

### Phase 8: Quality Assurance, CI/CD Pipeline & End-to-End Verification
- **Objectifs Core :** Execution de la suite complète de tests (unitaires, intégration, sécurité, sandbox, E2E).
- **Enrichissement Harness LLM :**
  - Banc de test de red-teaming (attaques par injection de prompt et tentatives de contournement de garde-fous).
  - Validation de build (`npm run build`, `npm test`) et alignement PRD v2.0 révisé.
