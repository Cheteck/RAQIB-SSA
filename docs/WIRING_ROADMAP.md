# RAQIB — Wiring & UI Harness Integration Roadmap

Ce document résume le câblage opérationnel de l'interface Dashboard Next.js (`apps/dashboard`) avec le Runtime RAQIB et ses composants **LLM Harness** (ContextEngine, MemoryEngine, WorkflowEngine, SkillsRegistry).

---

## Statut des Composants & Routes Dashboard

| Route / Panneau | Composants UI | Endpoint Backend Connecté | Statut d'Intégration |
| :--- | :--- | :--- | :--- |
| **`/` (Workspace)** | `ShellCenter`, `ShellRailLeft`, `ShellRailRight` | `/api/status`, `/api/context`, `/api/missions`, `/api/models/health` | **Connecté & Opérationnel** |
| **`/missions`** | `useMissions` | `/api/missions`, `/api/missions/:id/run` | **Connecté & Opérationnel** |
| **`/approvals`** | `useApprovals` | `/api/approvals`, `/api/approvals/:id/grant` | **Connecté & Opérationnel** |
| **`/audit`** | `useAudit` | `/api/audit` | **Connecté & Opérationnel** |
| **`/context`** | `useContextMetrics` | `/api/context` | **Nouveau - Connecté & Opérationnel** |
| **`/memory`** | `useMemory` | `/api/memory` | **Nouveau - Connecté & Opérationnel** |
| **`/workflows`** | `WorkflowsPage` | `/api/workflows/:id` | **Nouveau - Connecté & Opérationnel** |
| **`/skills`** | `useSkills` | `/api/skills`, `/api/skills/:name/execute` | **Nouveau - Connecté & Opérationnel** |
| **`/settings`** | `useEmergencyStop` | `/api/emergency-stop` | **Connecté & Opérationnel** |

---

## Câblage de Layout & Navigation

- **Layout Principal (`layout.tsx`)** : Ingestion de `ShellRailLeft`, `ShellRailRight`, `ModuleOverlay` et `ShellDock`.
- **Barre de Navigation (`Navigation.tsx`)** : Accès direct aux 8 modules RAQIB + Urgence en français.
- **Transparence et Sécurité** : Pas de données fictives ou "slop" — toutes les métriques de jetons, d'audit et d'états proviennent directement du backend SQLite.
