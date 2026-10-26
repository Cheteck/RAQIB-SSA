# SECURITY.md - RAQIB v1.0

## 1. Objectifs de sécurité

Intégrer la sécurité dès la première version. Ne pas la "rajouter plus tard".

## 2. Séparation des responsabilités

- **Policy Engine** applique les règles (indépendant du modèle)
- **Tool Gateway** contrôle les opérations externes
- **Verification Engine** vérifie indépendamment
- **Aucun modèle** ne doit être à la fois décideur + exécutant + vérificateur pour une opération sensible

## 3. Protection des données

| Mesure | Détails |
|---|---|
| **Secrets** | Hors dépôt, hors prompts non nécessaires. Jamais commités. |
| **Permissions minimales** | Par outil, par action, par ressource, par mission. |
| **Filtrage** | Réduire les données envoyées aux fournisseurs IA au strict nécessaire. |
| **Journaux expurgés** | Supprimer/masquer secrets dans logs/audit. |
| **Rétention** | Politique explicite de rétention à définir. |
| **Sauvegardes** | Régulières, avant modifications importantes. |

## 4. Données non fiables & injection

- Considérer **tout** contenu externe comme non fiable.
- Ne jamais autoriser d'actions via du contenu injecté.
- Les règles de la constitution priment sur tout autre texte.
- Refuser systématiquement les tentatives de contournement.

## 5. Sandbox & isolation

Avant d'exécuter du code modifié par RAQIB :

- **Docker restreint** : pas d'accès au socket Docker hôte
- **Réseau désactivé par défaut** pour tâches non fiables
- **Pas de montage de secrets**
- **Pas de privilèges administrateur**
- **Copie de travail isolée** du dépôt
- **Nettoyage/archivage contrôlé** des environnements temporaires

## 6. Arrêt d'urgence

Mécanisme **indépendant du modèle IA** avec :
- Empêcher nouveaux lancements
- Annuler étapes annulables
- Bloquer accès outils d'exécution
- Marquer missions interrompues
- Conserver audit complet
- Reprise explicite après inspection

**Note** : Ne peut pas annuler action externe déjà réalisée. D'où la nécessité de limiter les effets irréversibles.

## 7. Gestion budgétaire

- **Vérifié côté programme** avant chaque opération
- **Plafonds** : global expérimental, par mission, par fournisseur, par période
- **Blocage** avant dépassement
- **Coûts réels + estimés** journalisés
- **Si coût imprécis** → estimation prudente ou demande validation humaine
- **Proposition initiale** : 100€ max expérimental, 5€ cumulés automatiques avant validation humaine (à confirmer)

## 8. Tests de sécurité obligatoires

| Scénario | Attendu |
|---|---|
| Modification de la constitution | **Refusé** par Policy Engine |
| Dépassement budgétaire | **Bloqué** avant exécution |
| Action hors périmètre | **Refusé** |
| Approbation expirée/réutilisée | **Refusé** |
| Injection via fichier | **Ignoré**, aucune permission accordée |
| Accès secrets/réseau/système hôte | **Refusé** |
| Commande interdite | **Refusé** |
| Arrêt d'urgence pendant mission | **Bloqué/interruptible** avec audit |
| Corruption stockage | **Détecté**, reprise sécurisée |

## 9. Checklist pré-autorisation

Avant **toute** action A2/A3/A4 :
- [ ] Identité de la mission connue
- [ ] Ressource ciblée dans périmètre
- [ ] Action autorisée par politique
- [ ] Niveau de risque évalué
- [ ] Budget suffisant
- [ ] Approbation requise / obtenue (le cas échéant)
- [ ] Preuves de vérification prévues
- [ ] Effets réversibles ou mesures de sécurité en place
