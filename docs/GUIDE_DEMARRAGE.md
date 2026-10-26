# GUIDE DE DÉMARRAGE - RAQIB

## Objectif
Démarrer RAQIB proprement avec OpenCode, en validant d'abord un audit **en lecture seule** de MosaiX.

## Prérequis
- [ ] Windows 10/11
- [ ] Node.js LTS installé
- [ ] Git installé
- [ ] OpenCode disponible
- [ ] Docker Desktop (à valider en Phase 5, pas nécessaire pour Phases 0-1)
- [ ] Accès au dépôt MosaiX (local ou clonable)

## Étape 1 : Cadrage initial (obligatoire)
1. **Définir le dépôt cible**
   - Chemin local exact : `MOSAIX_REPO_PATH=...`
   - URL distante : `MOSAIX_REPO_URL=...`
   
2. **Choisir fournisseur IA initial**
   - API (clé nécessaire) OU Ollama local (modèle choisi)

3. **Confirmer limites**
   - Budget expérimental : 100€
   - Cumul automatique avant validation : 5€
   - Périmètre : **lecture seule uniquement** pour démarrage

4. **Vérifier périmètre**
   - Créer liste fichiers/répertoires exclus
   - S'assurer qu'aucun secret n'est dans le périmètre d'analyse

## Étape 2 : Initialiser la structure
Depuis la racine de RAQIB (`D:\Projets\RAQIB-SSA` ou dépôt dédié), créer la structure si elle n'existe pas.

Structure minimale pour démarrer :
```
raqib/
├── apps/dashboard/
├── packages/core/
├── packages/policy-engine/
├── packages/mission-engine/
├── packages/model-gateway/
├── packages/tool-gateway/
├── packages/audit-ledger/
├── packages/verification/
├── packages/memory/
├── packages/shared/
├── services/runtime/
├── config/
├── docs/
├── tests/
└── scripts/
```

## Étape 3 : Premier test - RAQIB-001 (Phase 1)
Lancer l'audit en lecture seule **sans autoriser aucune écriture**.

Commande conceptuelle (à adapter selon implémentation) :
```bash
# Depuis services/runtime ou via script
node ./scripts/run-audit.js --mission=RAQIB-001 --read-only
```

Vérifier :
- [ ] Dépôt inchangé (`git diff` vide)
- [ ] `reports/raqib-001/inventory.json` généré
- [ ] `reports/raqib-001/audit-report.md` généré
- [ ] `reports/raqib-001/verification.json` présent avec preuve non-modification
- [ ] Tous les constats ont une référence fichier ou preuve

## Étape 4 : Règles avec OpenCode
Lors du développement avec OpenCode :
1. **Toujours partir du PRD + docs/** - Ne pas improviser hors périmètre
2. **Phase par phase** - Terminer et valider une phase avant la suivante
3. **Tests obligatoires** - Exiger tests pour Policy Engine, Mission Engine, Audit
4. **Sécurité first** - Refuser par défaut si ambigu
5. **Pas d'accès aux secrets** - Ne jamais fournir de clés dans contexte inutile
6. **Garder séparation** - Ne pas faire que runtime dépende du dashboard
7. **Journaliser** - Tout changement significatif doit être traçable

## Avertissements
- **Ne pas autoriser écriture** tant que Phases 0-4 non validées
- **Policy Engine doit être imposé** - ne pas le rendre "conseil uniquement"
- **Arrêt d'urgence indépendant** du modèle
- **Données externes non fiables** - appliquer ce principe systématiquement
- **Coûts tracés** même en lecture seule

## Prochaine action concrète
**Phase 0 complète** → Démarrer **Phase 1** : Développer RAQIB-001 en lecture seule.
