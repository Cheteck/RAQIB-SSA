# Rapport de Diagnostic MOSAIX-001 : Architecture et Readiness d'AtelierPro

> **Statut :** Exécuté (READ-ONLY)  
> **Date :** Novembre 2026  
> **Cible inspectée :** Dépôt `atelierpro` (`D:\Projets\atelierpro`)  
> **Commit de référence cible :** `c31221d27360e3162c0bc4f4b53e531abcf256e2` (`plan-execution`)  
> **Opérateur :** RAQIB-SSA (Phase 2 - MosaiX Developer)

---

## 1. Architecture Réelle du Projet

Le projet est structuré comme un monorepo pnpm contenant deux applications principales et des packages partagés :

- **Applications (`apps/`) :**
  - `apps/api` : Service Backend propulsé par Fastify, Drizzle ORM et Better-SQLite3.
  - `apps/web` : Application Frontend SPA propulsée par React, Vite, Tailwind CSS et Lucide Icons.
- **Packages Partagés (`packages/`) :**
  - `packages/types` : Définitions TypeScript communes du domaine AtelierPro.
  - `packages/core` : Logique métier centrale et règles de gestion d'atelier.
  - `packages/activity-modules/base` : Module d'activité de base.
  - `packages/activity-modules/menuiserie-mdf` : Spécialisation métier pour atelier menuiserie/MDF.

---

## 2. Dépendances et Contrats

- **Gestionnaire de Monorepo :** `pnpm` workspaces avec résolution `@atelierpro/*`.
- **Typage partagé :** Très propre au niveau des modèles métier via `packages/types`.
- **Persistance :** Drizzle ORM couplé à SQLite (`apps/api/src/db/index.ts`). Le schéma Drizzle structure les tables `users`, `stock`, `audit`, etc.

---

## 3. Qualité Technique et État des Tests

- **Build de Production :** ✅ **SUCCÈS**
  - `apps/api` compile sans erreur via `tsc --noEmit`.
  - `apps/web` compile avec succès sous Vite (2308 modules transformés, bundle de production généré dans `dist/`).
- **Exécution des Tests (`vitest run`) :** ⚠️ **ÉCHEC PARTIEL (2 suites échouées)**
  - `packages/core` : 8 tests passés avec succès.
  - `apps/api` : **Échec d'exécution** sur `auth.test.ts` et `stock.test.ts`.
  - **Preuve d'erreur :**
    ```text
    TypeError: Cannot open database because the directory does not exist
      at new Database (better-sqlite3)
      at apps/api/src/db/index.ts:7:16
    ```
  - **Cause racine observée :** Dans `apps/api/src/db/index.ts`, SQLite tente d'ouvrir une base dans `process.cwd()/data/atelierpro.db` mais le dossier parent `data/` n'est pas créé automatiquement avant l'initialisation de la base par better-sqlite3 lors de l'exécution des tests depuis la racine du monorepo.

---

## 4. Analyse des Risques et Dette Technique

| ID | Priorité | Description | Localisation | Impact |
|---|---|---|---|---|
| **RSK-01** | **P1 (Bloquant CI)** | L'initialisation de la base SQLite échoue si le dossier cible n'existe pas. | `apps/api/src/db/index.ts:7` | Empêche l'exécution de la suite de tests d'intégration API en environnement vierge. |
| **RSK-02** | **P2 (Dette)** | Taille de chunk JS de l'app web > 500 kB (1.1 MB). | `apps/web` (Vite build) | Impact sur le temps de chargement initial du dashboard frontend. |
| **RSK-03** | **P3 (Hygiène)** | Fichier `FEUILLE_DE_ROUTE.md` modifié localement dans le working directory sans commit. | Racine `atelierpro` | Risque de conflit lors des futures synchronisations Git. |

---

## 5. Recommandations et Missions Correctives Proposées

1. **Mission MOSAIX-002 (Corrective - P1) :**
   - Assurer la création idempotente du dossier parent dans `apps/api/src/db/index.ts` via `fs.mkdirSync(path.dirname(dbPath), { recursive: true })`.
   - Valider que `npm test` repasse à 100% vert sur l'ensemble du monorepo (Core + API).
2. **Mission MOSAIX-003 (Optimisation - P2) :**
   - Introduire du code-splitting dynamique dans `apps/web` (lazy loading des routes lourdes) pour ramener le chunk sous 500 kB.
