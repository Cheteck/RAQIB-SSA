# PLAN D'IMPLÉMENTATION - RAQIB

Objectif : Aller du PRD à un premier audit fonctionnel **RAQIB-001** en lecture seule, avec garde-fous opérationnels.

## Phase 0 - Préparation et cadrage (1-2 jours)

**Objectif** : Verrouiller le périmètre, configurer l'environnement, geler constitution/architecture.

### Tâches
- [ ] **ENV-01** : Vérifier Node.js LTS, Git, OpenCode sur Windows
- [ ] **ENV-02** : Identifier dépôt MosaiX réel (chemin local + URL distante)
- [ ] **ENV-03** : Créer structure de dossiers `raqib/` selon ARCHITECTURE.md (ou adapter au repo actuel)
- [ ] **CFG-01** : Créer `config/` avec `providers.example.json`, politiques vides versionnées
- [ ] **GOV-01** : Geler `docs/CONSTITUTION.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`
- [ ] **SCOPE-01** : Définir périmètre audit (répertoires/fichiers exclus, limites)
- [ ] **BUDGET-01** : Configurer limites budgétaires initiales (100€ / 5€ cumulés avant validation)

### Critères d'acceptation
- Environnement fonctionnel
- Constitution non-modifiable documentée
- Périmètre audit validé
- Aucune autorisation d'écriture au dépôt MosaiX

**Porte** : Validation fondateur avant Phase 1

## Phase 1 - Prototype d'audit en lecture seule RAQIB-001 (2-4 jours)

**Objectif** : Produire un audit reproductible sans modifier le dépôt.

### Tâches
- [ ] **AUD-01** : Outil d'inventaire (fichiers suivis Git, arborescence)
- [ ] **AUD-02** : Lecture manifestes (package.json, tsconfig, etc.)
- [ ] **AUD-03** : Cartographie packages/applications/modules
- [ ] **AUD-04** : Inventaire tests/doc
- [ ] **AUD-05** : Détection zones sans tests/documentation
- [ ] **AUD-06** : Génération rapports `inventory.json`, `audit-report.md`
- [ ] **SAFE-01** : Validation chemins (éviter hors périmètre)
- [ ] **SAFE-02** : Exclusion fichiers sensibles
- [ ] **VER-01** : Vérification état Git inchangé avant/après

### Livrables
- `reports/raqib-001/inventory.json`
- `reports/raqib-001/audit-report.md`
- `reports/raqib-001/verification.json` (preuve non-modification)

### Critères d'acceptation
- Dépôt MosaiX inchangé
- Preuves vérifiables pour chaque constat important
- Faits vs hypothèses distingués
- Commandes journalisées
- Rapport régénérable

**Porte** : Premier audit réussi et validé

## Phase 2 - RAQIB Core + Mission Engine (4-7 jours)

**Objectif** : Moteur de missions persistant avec reprise après redémarrage.

### Tâches
- [ ] **CORE-01** : Initialisation app TypeScript
- [ ] **CORE-02** : Schémas missions/étapes (zod)
- [ ] **MISS-01** : États et transitions
- [ ] **MISS-02** : Persistance SQLite
- [ ] **MISS-03** : Reprise après interruption/crash
- [ ] **MISS-04** : Limites temps/tentatives/dépendances
- [ ] **MISS-05** : Gestion erreurs structurées
- [ ] **TEST-01** : Tests unitaires/intégration

### Livrables
- `packages/core`, `packages/mission-engine`
- Schémas versionnés
- Tests passant

### Critères d'acceptation
- Mission interrompue retrouvée et reprise sans double-exécution
- États persistés correctement
- Limites appliquées

**Porte** : Reprise validée

## Phase 3 - Policy Engine + Audit Ledger (3-5 jours)

**Objectif** : Gouvernance imposée par le programme.

### Tâches
- [ ] **POL-01** : Autorisations par action/ressource/mission
- [ ] **POL-02** : Plafonds budgétaires + validation
- [ ] **POL-03** : Demandes d'approbation liées à action exacte
- [ ] **AUDL-01** : Journal append-only
- [ ] **EMERG-01** : Arrêt d'urgence indépendant du modèle
- [ ] **SEC-01** : Tests contournement
- [ ] **SEP-01** : Séparation fonctions admin/agent

### Livrables
- `packages/policy-engine`, `packages/audit-ledger`
- Mécanisme approbation
- Tests sécurité

### Critères d'acceptation
- Refus imposé même si modèle demande ignorer
- Approbation non réutilisable
- Audit complet
- Arrêt d'urgence fonctionnel

**Porte** : Gouvernance validée

## Phase 4 - Model Gateway (2-4 jours)

**Objectif** : IA interchangeable sans affecter permissions.

### Tâches
- [ ] **GW-01** : Contrat commun fournisseurs
- [ ] **GW-02** : Adaptateur API
- [ ] **GW-03** : Adaptateur Ollama (si disponible)
- [ ] **GW-04** : Routage par type tâche
- [ ] **GW-05** : Comptabilisation coûts/tokens
- [ ] **GW-06** : Gestion erreurs/timeouts
- [ ] **TEST-02** : Changement de modèle

### Livrables
- `packages/model-gateway`

### Critères d'acceptation
- Changement modèle n'altère pas permissions/règles
- Erreurs normalisées
- Coûts tracés

**Porte** : Interchangeabilité validée

## Phase 5 - Exécution isolée + Verification (4-7 jours)

**Objectif** : Préparer écriture contrôlée (après audit validé).

### Tâches
- [ ] **ISO-01** : Configuration Docker restreint
- [ ] **ISO-02** : Commandes autorisées + réseau désactivé par défaut
- [ ] **ISO-03** : Copie de travail isolée
- [ ] **ISO-04** : Interdiction socket Docker/secrets/privs
- [ ] **VER-02** : Vérification état Git
- [ ] **VER-03** : Exécution tests + preuves
- [ ] **CLEAN-01** : Nettoyage/archivage contrôlé

### Livrables
- `packages/verification`, sandbox fonctionnel
- Rapport sécurité sandbox

### Critères d'acceptation
- Tests sécurité sandbox OK
- Preuves vérifiables
- Environnements nettoyés

**Porte** : Isolation validée

## Phase 6 - Tableau de bord (3-5 jours)

**Objectif** : Supervision claire pour le fondateur.

### Tâches
- [ ] **UI-01** : Structure Next.js (apps/dashboard)
- [ ] **UI-02** : Vue missions/états
- [ ] **UI-03** : Coûts/budgets
- [ ] **UI-04** : Approbations
- [ ] **UI-05** : Audit ledger
- [ ] **UI-06** : Arrêt d'urgence / contrôle
- [ ] **UI-07** : Détails mission + preuves

### Livrables
- Dashboard opérationnel

### Critères d'acceptation
- Comprendre actions passées/présentes/prévues et décisions requises

**Porte** : Supervision validée

## Phase 7 - Validation sur MosaiX (3-5 jours)

**Objectif** : Validation complète MVP.

### Tâches
- [ ] **VAL-01** : Audits successifs multiples
- [ ] **VAL-02** : Interruption/reprise
- [ ] **VAL-03** : Limites budget/temps
- [ ] **VAL-04** : Tests sécurité/résilience
- [ ] **VAL-05** : Reproductibilité
- [ ] **VAL-06** : Rapport validation + risques résiduels
- [ ] **DEC-01** : Décision passage à écriture isolée

### Livrables
- `docs/VALIDATION_MVP.md`

### Critères MVP prêt
Voir section 20 PRD - tous obligatoires

**Estimation totale** : 22-39 jours ouvrés

## Règle d'or

**Ne pas sauter de porte. Ne pas autoriser écriture avant validation Phases 0-4 + tests sécurité.**
