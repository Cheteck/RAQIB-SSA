# ADR 0001: Maintien de la Structure Monolithe Modulaire (NO-GO Extraction Microservices)

- **Statut :** ACCEPTE
- **Date :** 2026-11-05
- **Décideurs :** CTO / Architecte RAQIB-SSA

## Contexte

Une proposition initiale de refactoring suggérait d'extraire le composant `AuditLedger` (journal d'audit SQLite) dans un microservice indépendant `audit-ledger-service` accessible par gRPC/REST (Strangler Fig Pattern).

Une analyse approfondie du codebase et du contexte de déploiement a révélé les éléments suivants :
1. **Cas d'usage actuel :** RAQIB-SSA s'exécute localement (mono-utilisateur, mono-machine, agent autonome).
2. **Architecture SQLite :** Tous les packages (`@raqib/audit-ledger`, `@raqib/mission-engine`, `@raqib/policy-engine`, etc.) utilisent actuellement la même base de données locale `data/raqib.db` via `better-sqlite3`.
3. **Coût réseau & Latence :** L'écriture d'audit est sur le chemin critique de CHAQUE action et étape. Introduire un saut réseau gRPC/REST ajouterait de la latence et un point de défaillance supplémentaire sur la boucle de gouvernance.
4. **Anti-pattern Shared-Database :** Extraire un seul service tout en maintenant d'autres packages sur le même fichier SQLite local créerait de la contention de verrous (`better-sqlite3` lock contention) et une frontière de responsabilité confuse.
5. **Principe Strangler Fig :** Le but du Strangler Pattern est de **réduire le risque** lors de la migration d'un monolithe sous forte charge ou multi-équipe. Ici, la complexité ajoutée augmenterait le risque sans bénéfice opérationnel.

## Décision

**NO-GO sur l'extraction en microservice d'AuditLedger ou d'autres packages.**

RAQIB-SSA reste un **monolithe modulaire** (npm workspaces avec packages bien isolés : `@raqib/core`, `@raqib/shared`, `@raqib/policy-engine`, `@raqib/audit-ledger`, `@raqib/mission-engine`, `@raqib/tool-gateway`, `@raqib/model-gateway`, `@raqib/context-engine`, `@raqib/workflow-engine`).

## Conditions de réévaluation (Revisit Triggers)

L'extraction en microservice sera réévaluée UNIQUEMENT si l'une des conditions suivantes est remplie :
1. Un deuxième consommateur d'audit distant (ex: SIEM d'entreprise, tableau de bord distant indépendant) nécessite un accès en écriture temps réel indépendant du runtime.
2. Le volume d'événements d'audit dégrade mesurablement les performances I/O du runtime principal.
3. Le produit évolue vers un déploiement multi-tenant/cloud distribué.

## Conséquences

### Positives
- **Simplicité opérationnelle :** Déploiement single-binary / single-process direct.
- **Performance max :** Transactions SQLite locales synchros/WAL sans latence réseau.
- **Fiabilité :** Aucun risque de perte d'audit lié à une panne réseau entre services.
- **Structure déjà propre :** Les packages npm garantissent une frontière de code stricte.

### Négatives / Risques gérés
- Lock SQLite si plusieurs processus tentent d'écrire simultanément (géré via mode WAL et tests d'isolation).