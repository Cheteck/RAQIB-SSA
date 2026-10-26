# RAQIB-001 - Audit initial de MosaiX Core (Lecture Seule)

**Mission ID**: `RAQIB-001`  
**Type**: Audit / Observation (A0)  
**Autonomie**: Lecture seule uniquement  
**Priorité**: Critique (fondation)  
**État initial**: DRAFT → PLANNED

## 1. Objectif
Comprendre l'état du dépôt MosaiX et produire une évaluation structurée de la maturité, de la qualité et des risques, **sans modifier le code**.

## 2. Périmètre autorisé
- Lecture des fichiers suivis par Git
- Lecture de l'historique Git (résumé)
- Lecture des manifestes de packages (`package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, etc.)
- Inventaire tests et documentation
- Génération de rapports dans `reports/raqib-001/`

## 3. Périmètre interdit
- Écriture/modification/suppression de fichiers
- Création de branches/commits
- Installation/désinstallation de dépendances
- Exécution de commandes destructrices
- Accès aux secrets (.env, credentials, clés)
- Exécution de code arbitraire non nécessaire à l'inventaire
- Accès réseau
- Toute action non listée ci-dessus

## 4. Étapes d'exécution

| Étape | Action | Preuve attendue |
|---|---|---|
| 1 | **Identifier dépôt** - Vérifier chemin, remote Git, branche actuelle | `git rev-parse --show-toplevel`, `git branch -v`, `git remote -v` |
| 2 | **Inventaire fichiers** - Lister fichiers suivis | `git ls-tree -r --name-only HEAD` + filtre |
| 3 | **Packages/Apps** - Repérer workspaces, apps/packages | Lecture manifestes + arborescence |
| 4 | **Dépendances** - Analyser dépendances directes/indirectes | `package.json`, lockfiles |
| 5 | **Tests** - Inventorier fichiers de test/config | Patterns `*.test.*`, `*.spec.*`, `jest.config.*`, `vitest.config.*` |
| 6 | **Documentation** - Inventorier README, docs/ | Liste fichiers .md |
| 7 | **Relations** - Cartographier imports/exports basiques | Analyse statique légère (lecture seule) |
| 8 | **Risques** - Classer par gravité/confiance | Justifié par preuves |
| 9 | **Rapport** - Générer JSON + Markdown | Fichiers dans `reports/raqib-001/` |
| 10 | **Vérification** - Confirmer dépôt inchangé | `git diff` vide, `git status` cohérent |

## 5. Livrables

| Fichier | Description |
|---|---|
| `reports/raqib-001/inventory.json` | Inventaire structuré (fichiers, packages, tests, deps) |
| `reports/raqib-001/audit-report.md` | Rapport lisible avec constats, risques, recommandations |
| `reports/raqib-001/verification.json` | Preuve non-modification (git diff/status, timestamp, sha) |

## 6. Critères d'acceptation

- [ ] **Non-modification** : `git diff` vide avant et après exécution
- [ ] **Preuves** : Chaque constat important accompagne d'une preuve (fichier/ligne/commande)
- [ ] **Faits vs hypothèses** : Distinction explicite dans le rapport
- [ ] **Traçabilité** : Commandes exécutées listées
- [ ] **Limites** : Limites de l'audit clairement énoncées
- [ ] **Régénérable** : Peut être relancé avec même résultat structurel
- [ ] **Budget tracé** : Coûts/tokens enregistrés (même si 0€ en local)
- [ ] **Vérification indépendante** : `verification.json` généré par Verification Engine

## 7. Validation du Policy Engine

Pour cette mission, le Policy Engine doit **impérativement** vérifier :
- Action = `READ_ONLY_INVENTORY`
- Ressource = dépôt MosaiX dans périmètre autorisé
- Niveau = A0
- Budget = dans limites
- Aucune action écriture demandée
- Refuser si tentative d'écriture détectée

## 8. Rapport type - Structure attendue

**audit-report.md** doit contenir :
1. Executive Summary
2. Contexte (dépôt, branche, commit)
3. Inventaire (fichiers, packages/apps)
4. Dépendances clés
5. Tests & Documentation
6. Points forts
7. Risques identifiés (Critique/Élevé/Moyen/Faible + confiance)
8. Recommandations priorisées
9. Limites de l'audit
10. Annexes (commandes, preuves)

**Règle** : *"Une affirmation non prouvée doit être marquée comme hypothèse."*
