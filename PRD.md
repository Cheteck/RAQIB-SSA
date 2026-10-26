Je suis Reid Hoffman, expert en stratégie produit et en systèmes d’IA autonomes.

Pour RAQIB, je recommande de concevoir un système opérationnel d’entreprise piloté par l’IA, et non un simple agent conversationnel. Son ambition à long terme est de devenir le « JARVIS » de MosaiX / IJIDeals : comprendre les objectifs de l’entreprise, surveiller son fonctionnement, coordonner les agents spécialisés, exécuter les tâches autorisées et développer de nouvelles opportunités économiques.

Le point essentiel du PRD est de séparer l’intelligence de RAQIB de son pouvoir d’action. Un modèle peut proposer une décision ; c’est le système de gouvernance qui détermine si cette décision peut être exécutée, dans quelles limites et avec quelles vérifications.

Le document ci-dessous définit le produit cible, son architecture fonctionnelle, les exigences de sécurité, le MVP et un plan de mise en place progressif. Il tient compte de ton environnement Windows, d’OpenCode, du dépôt MosaiX et de la possibilité de basculer entre modèles IA via API et modèles locaux.

# RAQIB

## Product Requirements Document (PRD)

**Nom de code :** RAQIB\
**Désignation :** Agent Auto-Souverain (SSA)\
**Produit :** Système d'intelligence opérationnelle et d'automatisation d'entreprise\
**Organisation cible :** MosaiX / IJIDeals\
**Version :** 1.0 — Document fondateur\
**Statut :** Proposition pour validation\
**Priorité initiale :** Audit et stabilisation de MosaiX\
**Environnement initial :** Windows, dépôt Git local et distant, OpenCode, modèles IA via API ou localement

---

# 1. Résumé exécutif

RAQIB est un système d'IA conçu pour devenir progressivement le système nerveux opérationnel de MosaiX / IJIDeals.

Son objectif est de permettre à un fondateur de piloter une entreprise technologique avec une équipe humaine réduite, en déléguant à RAQIB une part croissante de l'analyse, de la planification, du développement, du contrôle opérationnel et, à terme, de la recherche d'opportunités commerciales.

RAQIB ne sera pas seulement un chatbot. Il devra pouvoir :

- Comprendre les objectifs et les priorités de l'entreprise.
- Maintenir une représentation actualisée de ses projets, applications, ressources et engagements.
- Détecter les problèmes et les opportunités de manière proactive.
- Décomposer un objectif en missions exécutables.
- Sélectionner les outils et les modèles IA adaptés.
- Exécuter les actions autorisées dans des environnements contrôlés.
- Vérifier indépendamment les résultats.
- Mesurer les coûts, les bénéfices et les risques.
- Rendre compte de ses actions et demander une validation lorsque nécessaire.

La vision finale est celle d'un **directeur opérationnel numérique**, supervisé par le fondateur, capable de coordonner plusieurs agents spécialisés sans leur accorder des pouvoirs illimités.

## 1.1 Vision produit

> RAQIB transforme les objectifs du fondateur en résultats mesurables grâce à une intelligence proactive, une exécution contrôlée et une amélioration continue.

## 1.2 Principes fondateurs

1. **Création de valeur réelle :** chaque mission doit servir un objectif identifiable.
2. **Non-nuisance :** les actions ne doivent pas causer de dommages injustifiés à des personnes, à l'entreprise ou à des tiers.
3. **Transparence :** toute action importante doit être explicable et traçable.
4. **Autonomie gouvernée :** RAQIB peut agir seul uniquement dans les limites préalablement définies.
5. **Souveraineté :** le système doit pouvoir changer de fournisseur IA et, lorsque c'est pertinent, fonctionner avec des modèles locaux.
6. **Vérification :** un résultat déclaré par un agent n'est pas automatiquement considéré comme vrai.
7. **Réversibilité :** privilégier les actions annulables et les environnements isolés.
8. **Responsabilité humaine :** le fondateur conserve l'autorité ultime sur les engagements stratégiques et les risques majeurs.

---

# 2. Problème à résoudre

Le développement de MosaiX et d'IJIDeals nécessite de nombreuses activités complémentaires : architecture, développement, tests, documentation, maintenance, infrastructure, gestion de produits, analyse économique et croissance commerciale.

Les assistants IA actuels peuvent aider ponctuellement, mais ils ne constituent pas nécessairement un système opérationnel persistant capable de :

- Conserver un état fiable des projets.
- Poursuivre des missions sur plusieurs sessions.
- Orchestrer plusieurs outils et agents.
- Respecter des autorisations indépendantes du modèle utilisé.
- Surveiller les coûts et les résultats.
- Détecter les erreurs et reprendre après un échec.
- Transformer une stratégie d'entreprise en tâches suivies jusqu'à leur achèvement.

RAQIB doit résoudre ce problème en créant une couche d'orchestration, de mémoire, de contrôle et d'exécution autour des capacités des modèles IA.

## 2.1 Utilisateurs

| Utilisateur                                  | Besoin                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Fondateur                                    | Définir les objectifs, superviser l'entreprise et arbitrer les décisions importantes |
| RAQIB Executive                              | Prioriser les objectifs et coordonner les missions                                   |
| Agents spécialisés                           | Exécuter des tâches délimitées dans leur domaine                                     |
| Développeur humain ou agent de développement | Développer, tester et maintenir les applications                                     |
| Responsable de contrôle                      | Vérifier les résultats, les permissions, les coûts et les risques                    |

Dans la première version, le fondateur sera le seul utilisateur humain disposant de l'autorité de gouvernance. Les rôles supplémentaires seront ajoutés si l'organisation évolue.

---

# 3. Objectifs et indicateurs de réussite

## 3.1 Objectifs du produit

- Automatiser progressivement les tâches répétitives et vérifiables.
- Accélérer le diagnostic et la stabilisation de MosaiX.
- Réduire le temps nécessaire entre l'identification d'un problème et sa résolution vérifiée.
- Centraliser les missions, décisions, résultats, coûts et autorisations.
- Construire une base évolutive pour la gestion autonome des opérations de l'entreprise.
- Permettre l'utilisation interchangeable de modèles IA.
- Introduire la recherche proactive de revenus sans donner d'emblée une autonomie financière illimitée.

## 3.2 Indicateurs

Les valeurs initiales sont des objectifs de travail à confirmer après la phase de référence.

| Indicateur                           | Objectif initial                                                        |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Traçabilité des actions exécutées    | 100 % des actions significatives journalisées                           |
| Actions bloquées hors autorisation   | 100 % des tentatives non autorisées bloquées par le système de contrôle |
| Missions terminées avec preuve       | 100 % des missions déclarées réussies accompagnées de preuves adaptées  |
| Reprise après redémarrage            | Récupération de l'état des missions persistées                          |
| Contrôle budgétaire                  | Blocage d'une mission avant dépassement de son budget autorisé          |
| Interchangeabilité IA                | Même interface applicative pour les fournisseurs pris en charge         |
| Audit MosaiX initial                 | Rapport reproductible sur le périmètre du dépôt défini                  |
| Actions destructrices non approuvées | Zéro                                                                    |
| Qualité des missions                 | Taux de réussite, durée, coût et taux de reprise mesurés                |

Une mission ne sera pas considérée comme réussie uniquement parce que le modèle affirme l'avoir terminée. Elle devra satisfaire des critères d'acceptation prédéfinis.

---

# 4. Périmètre fonctionnel

## 4.1 MVP — RAQIB Operator

Le MVP doit constituer un système utilisable, contrôlable et sûr, pas une simulation de JARVIS.

Fonctionnalités obligatoires :

1. Initialisation de la configuration de RAQIB.
2. Inventaire en lecture seule du dépôt MosaiX.
3. Création et suivi de missions.
4. Connexion à au moins un modèle IA via une interface standardisée.
5. Possibilité de configurer un second fournisseur, par exemple Ollama.
6. Planification d'une mission avec objectifs, contraintes et critères de réussite.
7. Contrôle des permissions avant toute action.
8. Journal d'audit persistant.
9. Limites de durée, de coût, de tentatives et de consommation de ressources.
10. Production de rapports structurés.
11. Tableau de bord minimal.
12. Arrêt d'urgence.
13. Tests automatisés des mécanismes de sécurité.

Le MVP n'a pas besoin d'une interface vocale, d'une multitude d'agents ou d'un système commercial autonome pour démontrer sa valeur.

## 4.2 Périmètre ultérieur

- Exécution de code en environnement isolé.
- Création de branches Git et modifications contrôlées.
- Tests et analyse indépendante des changements.
- Surveillance des dépôts et des pipelines.
- Mémoire institutionnelle de l'entreprise.
- Coordination d'agents spécialisés.
- Tableau de bord exécutif.
- Veille technique et commerciale.
- Analyse de revenus et dépenses.
- Exécution de procédures récurrentes.
- Interface conversationnelle et vocale.
- Pilotage multi-projets et multi-applications.

## 4.3 Hors périmètre initial

- Déploiement autonome en production.
- Fusion autonome de code dans la branche principale.
- Accès aux secrets de production.
- Transferts financiers autonomes.
- Signature de contrats ou engagements juridiques.
- Auto-modification de la constitution de RAQIB.
- Auto-augmentation des permissions ou du budget.
- Exécution de commandes arbitraires sur le système hôte.
- Réseau et accès Internet sans restrictions.
- Création d'agents disposant de privilèges illimités.

Ces exclusions pourront être réévaluées séparément, mais jamais supprimées simplement parce qu'un modèle estime qu'elles limitent sa performance.

---

# 5. Modèle d'autonomie

L'autonomie doit être définie par type d'action, et non accordée globalement à l'agent.

| Niveau | Nom                 | Capacités                                                    | Autorisation                         |
| ------ | ------------------- | ------------------------------------------------------------ | ------------------------------------ |
| A0     | Observer            | Lire des informations, inventorier, surveiller               | Accès en lecture seule               |
| A1     | Préparer            | Produire des rapports, plans, propositions de code           | Aucune action externe                |
| A2     | Exécuter en sandbox | Modifier une copie de travail, lancer des tests isolés       | Politique préalable et budget limité |
| A3     | Opérer              | Effectuer des actions opérationnelles réversibles autorisées | Permission explicite par domaine     |
| A4     | Engager             | Paiements, contrats, production critique, accès sensibles    | Approbation humaine obligatoire      |

Une autorisation A3 ne permet pas à RAQIB de réaliser une action A4.

Chaque autorisation doit préciser :

- L'identité de la mission.
- Le périmètre des ressources concernées.
- Les actions autorisées et interdites.
- Le plafond de dépenses.
- La durée de validité.
- Les conditions d'arrêt.
- Les critères de réussite.
- Les preuves exigées.

L'approbation humaine doit être liée à l'action exacte, au périmètre, au coût et à la durée. Une approbation ne doit pas pouvoir être réutilisée pour une action différente.

---

# 6. Architecture fonctionnelle cible

RAQIB sera développé comme une application indépendante capable de piloter des outils externes. Il ne doit pas dépendre d'un seul modèle IA ni de MosaiX pour assurer sa propre gouvernance.

## 6.1 Composants

### A. RAQIB Core

Responsable de l'identité des missions, de leur cycle de vie, de la configuration et de l'état opérationnel.

Fonctions :

- Initialisation et configuration.
- Gestion du cycle de vie des missions.
- Gestion des états et des erreurs.
- Persistance et reprise après redémarrage.
- Gestion des échéances et des limites d'exécution.

### B. Executive Intelligence

Interprète les objectifs de l'entreprise et prépare les plans d'action.

Fonctions :

- Analyse des objectifs.
- Décomposition en missions.
- Priorisation selon valeur, coût, urgence et risque.
- Identification des dépendances.
- Préparation des recommandations.
- Réévaluation après réception des résultats.

Le composant de planification ne doit pas pouvoir contourner les contrôles d'exécution.

### C. Policy Engine

Moteur de règles indépendant du modèle IA.

Il vérifie :

- L'identité de l'acteur.
- Les ressources ciblées.
- Les permissions.
- Le niveau de risque.
- Les plafonds budgétaires.
- Les approbations requises.
- Les conditions de refus et d'arrêt.

Toute action doit passer par ce composant avant exécution.

### D. Model Gateway

Interface uniforme entre RAQIB et les modèles IA.

Adaptateurs prévus :

- Fournisseurs d'API.
- Ollama pour les modèles locaux compatibles.
- Autres fournisseurs ajoutés ultérieurement.

Fonctions :

- Routage selon le type de tâche.
- Configuration par modèle.
- Gestion des erreurs et des délais.
- Comptabilisation des tokens et coûts lorsque disponibles.
- Possibilité de désactiver un fournisseur.
- Contrôle des données envoyées aux services externes.

Le changement de modèle ne doit jamais modifier les permissions de RAQIB.

### E. Tool Gateway

Point de passage unique pour les actions externes.

Exemples :

- Lecture du dépôt Git.
- Création de rapports.
- Exécution de tests.
- Création de branches.
- Accès aux outils de développement.
- Connexion future à des outils de gestion et d'analyse.

Les agents ne doivent pas pouvoir invoquer directement des outils privilégiés en contournant cette passerelle.

### F. Mission Engine

Exécute les missions sous forme d'étapes persistantes.

États recommandés :

`DRAFT → PLANNED → APPROVAL_REQUIRED → APPROVED → RUNNING → VERIFYING → SUCCEEDED`

États alternatifs :

`REJECTED`, `FAILED`, `CANCELLED`, `BLOCKED`, `NEEDS_REVIEW`.

Fonctions :

- Décomposition d'une mission en étapes.
- Gestion des dépendances.
- Limitation des tentatives.
- Reprise après interruption.
- Vérification des critères de réussite.
- Conservation des résultats partiels.
- Annulation et compensation lorsque possible.

### G. Memory System

La mémoire doit distinguer les données de travail, les faits validés et les décisions officielles.

Catégories :

1. **Mémoire de mission :** état, étapes, résultats, erreurs.
2. **Mémoire de projet :** structure, dépendances, conventions et décisions techniques.
3. **Mémoire institutionnelle :** objectifs, règles, décisions et engagements validés.
4. **Mémoire d'expérience :** résultats de missions passées et améliorations proposées.

Chaque élément important doit pouvoir indiquer sa source, sa date, sa portée et son niveau de confiance.

Une sortie de modèle ou un fichier externe ne devient pas automatiquement une vérité institutionnelle.

### H. Audit Ledger

Journal append-only des événements significatifs :

- Missions créées, modifiées ou terminées.
- Décisions du moteur de politiques.
- Approbations.
- Actions demandées et exécutées.
- Changements de configuration.
- Coûts et limites.
- Erreurs et interruptions.
- Résultats de vérification.

La V1 peut utiliser SQLite. La résistance à l'altération doit être renforcée par des droits d'accès séparés, des sauvegardes et, ultérieurement, une chaîne cryptographique ou un stockage externe protégé.

Un journal local append-only n'est pas, à lui seul, une garantie absolue d'immutabilité.

### I. Verification Engine

Évalue les résultats indépendamment de la génération initiale.

Exemples :

- Vérifier qu'un fichier existe et respecte le format attendu.
- Contrôler le code de sortie d'un test.
- Comparer l'état Git avant et après une mission.
- Exécuter des tests de non-régression.
- Vérifier que les limites budgétaires sont respectées.
- Confirmer qu'une opération externe a réellement abouti.

Lorsque les preuves sont insuffisantes, RAQIB doit déclarer le résultat incertain ou bloqué.

### J. Dashboard

Interface de supervision comprenant :

- État général de RAQIB.
- Missions en cours et en attente.
- Approbations requises.
- Historique des actions.
- Coûts et budgets.
- Résultats de vérification.
- Incidents et alertes.
- État des modèles IA.
- Bouton d'arrêt d'urgence.

---

# 7. Architecture technique recommandée

La stack doit rester simple jusqu'à ce que les besoins justifient une complexité supplémentaire.

| Couche               | Choix initial                                     |
| -------------------- | ------------------------------------------------- |
| Environnement        | Windows 10/11                                     |
| Runtime              | Node.js LTS                                       |
| Langage              | TypeScript                                        |
| Interface            | Next.js                                           |
| Service applicatif   | Processus Node.js séparé                          |
| Persistance initiale | SQLite                                            |
| Validation           | Schémas stricts et validation côté serveur        |
| Modèles IA           | Adaptateurs API et Ollama                         |
| Contrôle de version  | Git                                               |
| Exécution isolée     | Docker avec restrictions                          |
| Tests                | Tests unitaires, intégration et tests de sécurité |
| Documentation        | Markdown et contrats versionnés                   |

### Décision importante

**Next.js doit servir à l'interface, pas constituer à lui seul le moteur d'exécution autonome.**

Le processus d'orchestration doit pouvoir continuer à gérer ses missions sans dépendre d'un onglet de navigateur ouvert. Il doit également pouvoir redémarrer, récupérer les missions persistées et fonctionner indépendamment de l'interface.

Docker sera introduit avant l'exécution de code modifié par RAQIB. L'isolation doit être conçue explicitement : pas d'accès au socket Docker hôte, pas de montage de secrets, pas de privilèges administrateur et réseau désactivé par défaut pour les tâches de code non fiables.

---

# 8. Cycle opérationnel RAQIB

RAQIB utilisera le cycle suivant :

**THINK → PLAN → AUTHORIZE → ACT → VERIFY → REPORT → ADAPT**

1. **THINK :** comprendre l'objectif, le contexte et les contraintes.
2. **PLAN :** proposer des étapes, leurs dépendances, leurs coûts et leurs critères de réussite.
3. **AUTHORIZE :** vérifier les permissions et demander les validations nécessaires.
4. **ACT :** exécuter uniquement les actions autorisées.
5. **VERIFY :** vérifier les résultats avec des preuves adaptées.
6. **REPORT :** présenter les résultats, les écarts et les coûts.
7. **ADAPT :** améliorer les plans futurs à partir des résultats validés.

Le système peut recommencer le cycle si un problème est récupérable. Il doit arrêter la mission si une limite de sécurité est atteinte, si une action devient hors périmètre ou si les résultats ne peuvent pas être vérifiés.

---

# 9. Sécurité et gouvernance

La sécurité doit être intégrée à l'architecture dès la première version, et non ajoutée à la fin.

## 9.1 Constitution de RAQIB

La constitution définit les règles fondamentales du système :

- Non-nuisance.
- Respect du périmètre autorisé.
- Transparence des actions.
- Respect des budgets.
- Protection des données et des secrets.
- Refus de contourner les approbations.
- Arrêt en cas d'incertitude critique.
- Interdiction de s'accorder de nouveaux privilèges.
- Conservation de preuves vérifiables.

La constitution ne doit pas être modifiable par RAQIB lui-même. Toute évolution nécessite une modification externe contrôlée, une revue et des tests.

## 9.2 Séparation des responsabilités

Aucun modèle ne doit être à la fois l'unique décideur, l'unique exécutant et l'unique vérificateur d'une opération sensible.

Le moteur de politiques applique les règles ; la passerelle d'outils contrôle les opérations ; le moteur de vérification évalue les résultats.

Pour les opérations critiques, la vérification doit utiliser des éléments indépendants de la réponse du modèle.

## 9.3 Protection des données

- Secrets stockés hors du dépôt et hors des prompts non nécessaires.
- Permissions minimales par outil.
- Filtrage des données transmises aux fournisseurs IA.
- Journaux expurgés des secrets.
- Sauvegardes régulières.
- Environnements distincts pour développement et production.
- Politique explicite de rétention des données.

## 9.4 Défense contre les instructions malveillantes

Les fichiers du dépôt, issues, pages Web, documents et sorties d'outils doivent être considérés comme des données non fiables.

Ils peuvent contenir des instructions malveillantes ou des tentatives de détournement. Ils ne peuvent jamais remplacer les règles de RAQIB ni autoriser de nouvelles permissions.

## 9.5 Arrêt d'urgence

Le mécanisme d'arrêt doit être indépendant du modèle IA.

Il doit pouvoir :

- Empêcher le lancement de nouvelles actions.
- Annuler les étapes annulables en cours.
- Bloquer les accès aux outils d'exécution.
- Marquer les missions interrompues.
- Conserver les éléments d'audit.
- Permettre une reprise explicite après inspection.

Un arrêt ne peut pas annuler magiquement une action externe déjà réalisée. Les opérations doivent donc être conçues pour limiter les effets irréversibles.

---

# 10. Gestion du budget

RAQIB doit posséder un budget opérationnel contrôlé par le programme, et non par le modèle.

Le budget est distinct selon les catégories :

- Appels aux modèles IA.
- Infrastructure.
- Outils et services externes.
- Dépenses commerciales.
- Engagements financiers de l'entreprise.

## 10.1 Paramètres initiaux proposés

À confirmer au lancement :

- Budget global expérimental : **100 € maximum**.
- Plafond cumulé de dépenses automatiques : **5 € avant validation humaine**.
- Aucun paiement ou engagement financier autonome.
- Limites par mission, par fournisseur et par période.
- Blocage avant le dépassement d'un plafond.
- Journalisation des coûts réels et estimés.

Ces montants sont des contraintes de départ proposées, pas des capacités de dépense déjà configurées.

Les budgets doivent être vérifiés côté programme avant chaque opération. Les limites du fournisseur IA doivent également être configurées lorsque disponibles. Si le coût réel est impossible à mesurer précisément, le système doit appliquer une estimation prudente ou demander une validation.

---

# 11. Premier cas d'usage : audit MosaiX

La première mission officielle sera :

**RAQIB-001 — Audit initial de MosaiX Core**

### Objectif

Comprendre l'état du dépôt et produire une évaluation structurée de la maturité, de la qualité et des risques du framework MosaiX, sans modifier le code.

### Autorisations

- Lecture des fichiers du dépôt.
- Lecture de l'historique Git.
- Analyse des manifestes de packages.
- Inventaire des tests et de la documentation.
- Génération de rapports dans un dossier dédié.
- Aucune modification du dépôt.
- Aucune installation de dépendance non approuvée.
- Aucun accès aux secrets.
- Aucune commande destructive.

### Étapes

1. Identifier le dépôt et son état Git.
2. Inventorier les fichiers suivis.
3. Repérer les packages, applications et composants.
4. Lire les manifestes et scripts de test.
5. Identifier les dépendances et relations entre modules.
6. Repérer les zones manquant de tests ou de documentation.
7. Classer les risques par gravité et confiance.
8. Produire un rapport avec références aux fichiers.
9. Vérifier que le dépôt est resté inchangé.
10. Présenter les recommandations au fondateur.

### Livrables

- Inventaire JSON du dépôt.
- Carte des packages et composants.
- Rapport Markdown d'audit.
- Liste priorisée des risques.
- Plan de stabilisation proposé.
- Rapport de vérification de non-modification.

### Critères d'acceptation

- Le dépôt n'a subi aucune modification.
- Chaque constat technique important est accompagné d'une preuve vérifiable.
- Les faits et les hypothèses sont distingués.
- Les commandes exécutées sont documentées.
- Les limites de l'audit sont explicites.
- Le rapport peut être régénéré.
- Le budget et le temps d'exécution sont connus.

Cette mission est volontairement limitée : elle valide les fondations de RAQIB avant de lui permettre de modifier du code.

---

# 12. Plan de mise en place

La mise en œuvre sera organisée en phases avec des portes de validation. Les durées sont indicatives et supposent un développement principalement assisté par OpenCode, avec revue humaine.

## Phase 0 — Préparation et cadrage

**Durée indicative : 1 à 2 jours**

Actions :

- Installer ou vérifier Node.js LTS et Git.
- Vérifier OpenCode.
- Identifier le chemin réel du dépôt MosaiX.
- Définir les dossiers de travail, rapports, configuration et sauvegardes.
- Définir les limites budgétaires.
- Valider la constitution initiale.
- Choisir le premier fournisseur IA.
- Définir les actions interdites.

Livrables :

- Environnement de développement prêt.
- Fichier de configuration initial.
- Constitution versionnée.
- Périmètre de l'audit confirmé.

**Porte de validation :** aucun accès en écriture au dépôt cible pour RAQIB.

## Phase 1 — Prototype d'audit en lecture seule

**Durée indicative : 2 à 4 jours**

Actions :

- Développer l'outil d'inventaire du dépôt.
- Collecter les informations Git et les manifestes de packages.
- Générer des rapports JSON et Markdown.
- Ajouter une validation des chemins.
- Éviter les fichiers sensibles et les répertoires volumineux inutiles.
- Vérifier que le dépôt reste inchangé.

Livrable :

- Première exécution reproductible de RAQIB-001.

**Porte de validation :** l'audit fonctionne et produit un rapport exploitable sans modification du dépôt.

## Phase 2 — RAQIB Core et moteur de missions

**Durée indicative : 4 à 7 jours**

Actions :

- Créer l'application TypeScript.
- Définir le modèle de données des missions.
- Implémenter les états et transitions.
- Ajouter la persistance SQLite.
- Ajouter la reprise après redémarrage.
- Définir les limites de temps et de tentatives.
- Ajouter les erreurs structurées et les journaux techniques.

Livrables :

- Moteur de missions persistant.
- Schémas de données versionnés.
- Tests unitaires et d'intégration.

**Porte de validation :** une mission interrompue peut être retrouvée et reprise sans exécution accidentelle en double.

## Phase 3 — Policy Engine et Audit Ledger

**Durée indicative : 3 à 5 jours**

Actions :

- Implémenter les autorisations par action et ressource.
- Ajouter les plafonds budgétaires.
- Ajouter les demandes d'approbation.
- Enregistrer les décisions et les résultats d'autorisation.
- Implémenter l'arrêt d'urgence.
- Tester les tentatives de contournement.
- Séparer les fonctions d'administration de celles de l'agent.

Livrables :

- Moteur de politiques.
- Journal d'audit.
- Mécanisme d'approbation.
- Tests de sécurité.

**Porte de validation :** les refus d'autorisation sont imposés par le programme, même lorsque le modèle demande explicitement de les ignorer.

## Phase 4 — Model Gateway

**Durée indicative : 2 à 4 jours**

Actions :

- Définir un contrat commun pour les fournisseurs IA.
- Implémenter le premier adaptateur API.
- Ajouter un adaptateur local, par exemple Ollama, si le matériel et le modèle retenu le permettent.
- Normaliser les erreurs et les délais d'attente.
- Mesurer les coûts lorsqu'ils sont disponibles.
- Ajouter une configuration de routage.
- Tester le changement de modèle.

Livrables :

- Interface IA indépendante du fournisseur.
- Configuration documentée.
- Tests de compatibilité.

**Porte de validation :** un changement de modèle ne modifie ni les permissions ni les règles d'exécution.

## Phase 5 — Exécution isolée et vérification

**Durée indicative : 4 à 7 jours**

Actions :

- Configurer un environnement Docker restreint.
- Définir les commandes autorisées.
- Désactiver le réseau par défaut pour les tâches non fiables.
- Empêcher l'accès aux secrets et au socket Docker hôte.
- Créer des copies de travail isolées du dépôt.
- Ajouter des vérifications de l'état Git.
- Exécuter les tests et enregistrer les preuves.
- Prévoir la suppression ou l'archivage contrôlé des environnements temporaires.

Livrables :

- Exécution contrôlée de tâches de développement.
- Vérification indépendante des résultats.
- Rapport de sécurité de la sandbox.

**Porte de validation :** les tests de sécurité confirment que les actions restent dans le périmètre autorisé.

## Phase 6 — Tableau de bord RAQIB

**Durée indicative : 3 à 5 jours**

Actions :

- Créer l'interface Next.js.
- Afficher les missions et leurs états.
- Afficher les coûts et budgets.
- Présenter les demandes d'approbation.
- Consulter l'audit.
- Ajouter les contrôles de démarrage, d'annulation et d'arrêt.
- Ajouter les détails des résultats et des preuves.

Livrable :

- Interface de supervision opérationnelle.

**Porte de validation :** le fondateur peut comprendre ce que RAQIB fait, ce qu'il a fait, ce qu'il prévoit et ce qui exige une décision.

## Phase 7 — Validation sur MosaiX

**Durée indicative : 3 à 5 jours**

Actions :

- Exécuter plusieurs audits successifs.
- Comparer les rapports.
- Tester les interruptions et les erreurs.
- Tester les limites de budget.
- Vérifier la reproductibilité.
- Corriger les problèmes détectés.
- Documenter les limites du système.
- Décider si l'exécution en écriture peut être ouverte sur une branche isolée.

Livrables :

- Rapport de validation du MVP.
- Liste des risques résiduels.
- Décision de passage à la phase suivante.

### Estimation globale

| Étape               | Durée indicative       |
| ------------------- | ---------------------- |
| Phases 0–1          | 3–6 jours              |
| Phases 2–4          | 9–16 jours             |
| Phases 5–6          | 7–12 jours             |
| Phase 7             | 3–5 jours              |
| **Total indicatif** | **22–39 jours ouvrés** |

Ce calendrier correspond à un prototype sérieux, pas à un système d'entreprise entièrement autonome. Il devra être révisé après les premières phases, selon les résultats d'OpenCode, les contraintes matérielles et les difficultés d'intégration.

---

# 13. Feuille de route après le MVP

## V1 — RAQIB Operator

Objectif : réaliser des missions techniques bornées, vérifiables et persistantes.

- Moteur de missions.
- Politiques et approbations.
- Audit.
- Model Gateway.
- Exécution isolée.
- Tableau de bord.
- Audit MosaiX.

## V2 — RAQIB Engineering

Objectif : contribuer au développement de MosaiX et des applications de l'écosystème.

- Création de branches.
- Modifications contrôlées.
- Tests automatiques.
- Revue des changements.
- Analyse des dépendances.
- Détection des régressions.
- Propositions de correctifs.
- Préparation de pull requests.

Les fusions et déploiements risqués restent soumis à validation humaine.

## V3 — RAQIB Business OS

Objectif : construire une représentation opérationnelle de l'entreprise.

- Registre des projets et applications.
- Objectifs et indicateurs.
- Budgets et dépenses.
- Incidents et risques.
- Calendrier opérationnel.
- Mémoire institutionnelle.
- Rapports exécutifs.
- Surveillance proactive.

## V4 — RAQIB Autonomous Operations

Objectif : prendre en charge des opérations récurrentes préapprouvées.

- Surveillance planifiée.
- Détection d'anomalies.
- Interventions réversibles.
- Reprise après incident.
- Escalade automatique des problèmes.
- Coordination d'agents spécialisés.
- Rapports réguliers.

## V5 — RAQIB Executive Intelligence

Objectif : aider à piloter l'entreprise et anticiper son évolution.

- Analyse de marché.
- Identification d'opportunités.
- Prévisions et scénarios.
- Comparaison des stratégies.
- Allocation proposée des ressources.
- Évaluation du retour sur investissement.
- Planification multi-projets.

## V6 — RAQIB JARVIS

Objectif : une interface personnelle et opérationnelle plus naturelle.

- Conversation continue.
- Interface vocale.
- Accès multi-appareil.
- Notifications proactives.
- Contexte opérationnel en temps réel.
- Coordination des systèmes connectés.
- Explications et comptes rendus à la demande.

La voix et la personnalité sont des couches d'interface. Elles ne doivent pas être confondues avec les mécanismes de sécurité et d'autonomie.

---

# 14. Agents spécialisés futurs

Les agents spécialisés seront introduits uniquement lorsqu'un domaine possède des tâches, des outils et des critères de vérification clairement définis.

| Agent             | Responsabilité                               | Limite principale                                        |
| ----------------- | -------------------------------------------- | -------------------------------------------------------- |
| RAQIB Engineering | Développement et maintenance                 | Pas de fusion ni déploiement critique autonome           |
| RAQIB Product     | Analyse des besoins et priorisation          | Ne décide pas seul de la stratégie produit               |
| RAQIB Finance     | Analyse des coûts et prévisions              | Pas de transfert de fonds autonome                       |
| RAQIB Growth      | Veille, prospects et stratégies commerciales | Pas d'engagement externe non autorisé                    |
| RAQIB Operations  | Surveillance et procédures récurrentes       | Pas de modification des politiques                       |
| RAQIB Risk        | Analyse des risques et conformité            | Ne remplace pas un avis professionnel lorsque nécessaire |

Les agents ne constituent pas des autorités indépendantes. Ils sont des composants subordonnés au moteur de missions et au moteur de politiques.

Leur multiplication ne sera justifiée que si elle améliore effectivement la qualité, la spécialisation ou le contrôle des résultats.

---

# 15. Recherche proactive de revenus

La capacité économique de RAQIB représente une ambition distincte de son rôle d'opérateur technique.

Elle sera introduite progressivement.

### Niveau 1 — Veille

- Identifier des besoins du marché.
- Surveiller les concurrents et les tendances.
- Détecter des problèmes pouvant devenir des produits.
- Recenser les opportunités pour MosaiX et IJIDeals.

### Niveau 2 — Analyse

- Estimer le coût de développement.
- Évaluer la demande potentielle.
- Comparer les alternatives.
- Construire des scénarios de revenus.
- Identifier les risques juridiques et opérationnels.

### Niveau 3 — Préparation

- Produire des prototypes.
- Préparer des offres et des campagnes.
- Créer des plans d'expérimentation.
- Préparer des listes de prospects à examiner.

### Niveau 4 — Expérimentation autorisée

- Réaliser des tests à faible risque.
- Lancer des expériences internes ou des campagnes préapprouvées.
- Mesurer les résultats.
- Arrêter automatiquement les expériences qui dépassent leurs limites.

### Niveau 5 — Développement économique

RAQIB pourra proposer des initiatives et gérer certaines opérations commerciales dans un cadre autorisé. Les engagements financiers, contractuels et juridiques importants resteront soumis à approbation.

**Principe : RAQIB peut rechercher la création de valeur, mais ne peut pas décider seul de redéfinir les intérêts, les obligations ou les limites de risque de l'entreprise.**

---

# 16. Stratégie de tests

Les tests doivent couvrir les fonctionnalités normales et les scénarios d'abus.

## Tests fonctionnels

- Création et exécution d'une mission.
- Persistance et reprise après redémarrage.
- Production d'un rapport.
- Changement de modèle IA.
- Respect des limites de temps et de tentatives.
- Vérification des résultats.

## Tests de sécurité

- Tentative de modification de la constitution.
- Tentative de dépassement budgétaire.
- Action hors périmètre.
- Réutilisation d'une approbation expirée.
- Injection d'instructions malveillantes via un fichier.
- Tentative d'accès aux secrets.
- Tentative d'accès au réseau ou au système hôte.
- Tentative de lancement d'une commande interdite.
- Arrêt d'urgence pendant une mission.
- Corruption ou indisponibilité du stockage.

## Tests de résilience

- Redémarrage du processus.
- Coupure du fournisseur IA.
- Réponse IA invalide.
- Dépassement du délai d'attente.
- Échec d'un outil.
- Échec de la vérification.
- Perte temporaire de connectivité.
- Tentative de double exécution d'une opération.

Pour les actions externes, RAQIB devra distinguer les opérations idempotentes des opérations qui peuvent produire des effets en double. Une reprise automatique ne doit pas répéter aveuglément une opération dont le résultat précédent est incertain.

---

# 17. Risques et mesures d'atténuation

| Risque                                 | Mesure                                                  |
| -------------------------------------- | ------------------------------------------------------- |
| Hallucinations ou fausses affirmations | Vérification par preuves                                |
| Injection de prompt                    | Données externes non fiables et permissions hors modèle |
| Dépenses incontrôlées                  | Plafonds vérifiés par le programme                      |
| Action destructive                     | Sandbox, sauvegardes, permissions minimales             |
| Dépendance à un fournisseur            | Model Gateway et adaptateurs interchangeables           |
| Fausse autonomie                       | Indicateurs fondés sur des résultats vérifiés           |
| Complexité excessive                   | Phases successives et périmètre réduit                  |
| Corruption de mémoire                  | Schémas versionnés, sauvegardes et provenance           |
| Reprise dangereuse après crash         | États persistants et gestion des doublons               |
| Agent compromis ou mal orienté         | Contrôle d'accès, journalisation et arrêt indépendant   |
| Exécution trop coûteuse                | Limites de temps, tentatives et budget                  |
| Erreurs commerciales                   | Validation humaine des engagements sensibles            |

---

# 18. Organisation du développement avec OpenCode

OpenCode sera utilisé comme outil de développement assisté pour construire RAQIB. Il ne doit pas être confondu avec RAQIB lui-même.

### Méthode recommandée

1. Créer un dépôt dédié à RAQIB.
2. Versionner le PRD et la constitution.
3. Demander à OpenCode d'analyser le PRD et de proposer un plan d'implémentation.
4. Faire développer une phase à la fois.
5. Exiger des tests avant de passer à la phase suivante.
6. Examiner les modifications et les dépendances.
7. Valider les mécanismes de sécurité indépendamment de l'agent de développement.
8. Conserver les décisions d'architecture dans des documents versionnés.
9. Effectuer des sauvegardes avant les modifications importantes.
10. Ne pas fournir à OpenCode de secrets de production non nécessaires.

Le développement de RAQIB ne doit pas lui donner immédiatement le contrôle de son propre dépôt, de ses politiques ou de ses permissions. Cette séparation évite qu'un défaut du système en construction compromette simultanément le mécanisme chargé de le contrôler.

---

# 19. Structure de dépôt proposée

```
raqib/
├── apps/
│   └── dashboard/              # Interface Next.js
├── packages/
│   ├── core/                   # Missions et cycle de vie
│   ├── policy-engine/           # Autorisations et règles
│   ├── mission-engine/         # Orchestration persistante
│   ├── model-gateway/           # Adaptateurs IA
│   ├── tool-gateway/            # Outils contrôlés
│   ├── audit-ledger/            # Journal d'audit
│   ├── verification/            # Vérification des résultats
│   ├── memory/                  # Mémoire et provenance
│   └── shared/                  # Schémas et types communs
├── services/
│   └── runtime/                 # Processus d'exécution autonome
├── config/
│   ├── policies/
│   └── providers.example.json
├── docs/
│   ├── PRD.md
│   ├── CONSTITUTION.md
│   ├── ARCHITECTURE.md
│   └── SECURITY.md
├── tests/
│   ├── integration/
│   ├── security/
│   └── resilience/
├── scripts/
├── .env.example
└── package.json
```

Cette structure est une proposition. Les packages ne doivent être séparés que lorsque cela facilite réellement les tests, les responsabilités ou les évolutions indépendantes.

---

# 20. Critères de validation du MVP

RAQIB Operator sera considéré comme prêt pour une utilisation expérimentale lorsque :

- Le dépôt MosaiX peut être audité sans être modifié.
- Une mission peut être créée, exécutée, interrompue et retrouvée.
- Les permissions sont appliquées par le programme.
- Les budgets et limites de temps sont respectés.
- Les approbations sont liées à des actions et périmètres précis.
- Les événements significatifs sont journalisés.
- Le système peut fonctionner avec le fournisseur IA configuré et gérer proprement son indisponibilité.
- Les résultats sont vérifiés avec des preuves.
- L'arrêt d'urgence bloque les nouvelles actions.
- Les tests de sécurité et de résilience prioritaires réussissent.
- Le fondateur peut consulter l'état des missions et leurs résultats.
- La documentation permet de reproduire l'installation et les tests.

La réussite de ces critères autorise le passage à des tâches de développement isolées. Elle n'autorise pas automatiquement la production autonome.

---

# 21. Décisions à confirmer avant le développement

Les choix suivants doivent être confirmés au démarrage :

1. **Dépôt cible :** chemin local exact et URL distante du dépôt MosaiX.
2. **Fournisseur IA initial :** API privilégiée ou modèle local privilégié.
3. **Budget expérimental :** confirmation du plafond proposé de 100 €, dont 5 € de dépenses automatiques cumulées avant validation.
4. **Données :** définition des fichiers et répertoires exclus de l'analyse.
5. **Interface :** tableau de bord dès le MVP ou interface en ligne de commande dans un premier temps.
6. **Sandbox :** validation de Docker Desktop et de sa configuration de sécurité.
7. **Périmètre initial :** audit MosaiX Core uniquement, sans modification du dépôt.

Ces décisions doivent être documentées avant d'accorder de nouvelles capacités à RAQIB.

---

# Conclusion

RAQIB doit évoluer d'un outil d'audit en lecture seule vers un opérateur technique contrôlé, puis vers un système de gestion et d'intelligence opérationnelle de l'entreprise.

La priorité n'est pas de rendre RAQIB aussi autonome que possible dès le premier jour. Elle est de construire une base dans laquelle chaque capacité supplémentaire peut être accordée, mesurée, vérifiée et révoquée.

La trajectoire est donc :

**Observer → Comprendre → Planifier → Exécuter sous contrôle → Vérifier → Coordonner → Optimiser l'entreprise.**

Le succès de RAQIB ne se mesurera pas au nombre d'agents ou de fonctionnalités, mais à sa capacité à produire des résultats fiables, utiles et économiquement pertinents sans mettre en danger MosaiX, IJIDeals ou les intérêts de leur fondateur.

**Première mission officielle : RAQIB-001 — Audit de MosaiX Core en lecture seule.**

## Ce que je recommande de faire maintenant

Ne commence pas par développer tous les modules du PRD. Le meilleur enchaînement est :

1. Geler la V1 du PRD et de la constitution dans le dépôt dédié à RAQIB.
2. Préparer l'environnement et vérifier le dépôt MosaiX réel.
3. Développer RAQIB-001, l'audit en lecture seule.
4. Tester le moteur de politiques et l'audit avant d'autoriser l'exécution de code.
5. Introduire progressivement la sandbox, puis le tableau de bord.

Le point à ne pas sous-estimer : le calendrier de 22 à 39 jours ouvrés est une estimation de développement, pas une garantie. Les phases de sécurité, de reprise après interruption et de contrôle des permissions peuvent demander davantage de travail que les fonctions IA elles-mêmes.

La prochaine étape concrète serait de transformer ce PRD en plan d'implémentation pour OpenCode, avec les tâches dans l'ordre, les fichiers à créer, les critères d'acceptation de chaque étape et les instructions empêchant l'agent de dépasser le périmètre prévu.