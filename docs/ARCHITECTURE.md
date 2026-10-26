# ARCHITECTURE.md - RAQIB v1.0

## 1. Vue d'ensemble

RAQIB est une application indépendante capable d'orchestrer des outils externes. **L'interface (Next.js) ne doit pas héberger le moteur d'exécution autonome.** Le moteur doit pouvoir fonctionner sans onglet de navigateur ouvert et reprendre les missions après redémarrage.

## 2. Composants principaux

| Composant | Rôle | Notes |
|---|---|---|
| **RAQIB Core** | Identité des missions, cycle de vie, config, état | Point d'entrée logique du système |
| **Executive Intelligence** | Interpréter objectifs, décomposer en missions, prioriser | Ne contourne **jamais** les contrôles d'exécution |
| **Policy Engine** | Règles indépendantes du modèle IA. Autorise/refuse | Obligatoire pour **toute** action |
| **Model Gateway** | Interface uniforme vers API + Ollama | Changement de modèle n'affecte pas permissions/règles |
| **Tool Gateway** | Point unique vers outils externes (git, fichiers, tests, etc.) | Agents n'invoquent **pas** directement outils privilégiés |
| **Mission Engine** | Exécution par étapes persistantes avec états | États: `DRAFT→PLANNED→APPROVAL_REQUIRED→APPROVED→RUNNING→VERIFYING→SUCCEEDED` + alternatifs |
| **Memory System** | Mémoire de mission/projet/institutionnelle/expérience avec provenance | Une sortie modèle n'est pas une vérité institutionnelle |
| **Audit Ledger** | Journal append-only | Traçabilité complète |
| **Verification Engine** | Vérification indépendante avec preuves | Si preuves insuffisantes → `UNCERTAIN` ou `BLOCKED` |
| **Dashboard** | Supervision (missions, approbations, coûts, audit, arrêt d'urgence) | Interface uniquement, pas moteur |

## 3. Cycle opérationnel

`THINK → PLAN → AUTHORIZE → ACT → VERIFY → REPORT → ADAPT`

- Si problème récupérable → peut recommencer
- Si limite de sécurité atteinte / hors périmètre / non-vérifiable → **STOP**

## 4. Stack technique recommandée

| Couche | Choix | Justification |
|---|---|---|
| Environnement | Windows 10/11 | Environnement initial spécifié |
| Runtime | Node.js LTS | Compatible OpenCode/TypeScript |
| Langage | TypeScript | Typage strict, sécurité accrue |
| Interface | Next.js | Dashboard uniquement |
| Service applicatif | Processus Node.js séparé (runtime) | Autonome du navigateur |
| Persistance | SQLite | Simple, local, suffisant MVP |
| Validation | Schémas stricts (zod) côté serveur | Prévention d'entrées invalides |
| IA | Adaptateurs API + Ollama | Interchangeable |
| VCS | Git | Requis |
| Isolation | Docker (restreint) | Avant exécution de code modifié |
| Tests | Vitest/Jest + tests sécurité/résilience | Obligatoire |

**Important** : `apps/dashboard` communique avec `services/runtime`, pas directement avec les outils privilégiés.

## 5. Structure de dépôt proposée

```
raqib/
├── apps/
│   └── dashboard/        # Next.js (UI uniquement)
├── packages/
│   ├── core/             # Types, config, cycle de vie
│   ├── policy-engine/     # Autorisations, règles, constitution
│   ├── mission-engine/    # États, étapes, reprise
│   ├── model-gateway/     # Adaptateurs IA
│   ├── tool-gateway/      # Outils contrôlés
│   ├── audit-ledger/      # Journal append-only
│   ├── verification/      # Vérification indépendante
│   ├── memory/            # Mémoire + provenance
│   └── shared/            # Schémas/zod, utils
├── services/
│   └── runtime/           # Processus d'orchestration autonome
├── config/
│   ├── policies/          # Politiques versionnées
│   └── providers.example.json
├── docs/                  # PRD, CONSTITUTION, ARCHITECTURE, SECURITY
├── tests/
│   ├── integration/
│   ├── security/
│   └── resilience/
└── scripts/
```

## 6. Principes d'implémentation

- **Séparation stricte** : runtime autonome, UI séparée.
- **Fail-safe** : Refuser par défaut si doute.
- **Least privilege** : Permissions minimales par action/ressource.
- **Idempotence** : Gérer les reprises sans double-exécution.
- **Append-only** : Journal d'audit non destructif.
- **Isolation** : Docker avant écriture/modification de code.
- **Provenance** : Tout fait validé doit avoir source/date/confiance.
