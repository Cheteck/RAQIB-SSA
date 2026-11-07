# RAQIB — Spécification des interfaces compatibles commande vocale

> **Statut :** spécification convergée après 8 rounds de discussion avec ChatGPT.
> **Conversation :** https://chatgpt.com/c/6aee102d-db6c-83ea-a034-69a0ea2d64f5
> **Portée :** 11 pages du dashboard + couche vocale transverse.
> **Règle de lecture :** `ACTIVE` = l'endpoint existe réellement dans `services/runtime/src/api/server.ts`, sous réserve des permissions et du mode READ-ONLY. `BACKEND REQUIS` = l'action n'est pas exposée aujourd'hui et ne doit pas être présentée comme opérationnelle.

---

## 1. Méthode et traçabilité

Le travail a été mené en allers-retours contradictoires, pas en une seule réponse :

| Round | Objet | Résultat |
|---|---|---|
| 1 | Vision libre des 11 pages | Sommaire générique, rejeté |
| 2 | Wireframes Missions / Approbations / Audit | Structure 3 colonnes exploitable |
| 3 | Contrat vocal global | États, grammaire, confirmation, PTT |
| 4 | Fusion wireframe + Voice Strip | Arbitrage : dernier geste visuel |
| 5 | 8 pages restantes | Structures + commandes par page |
| 6 | Vérification runtime + ergonomie | Table endpoint, placement, raccourci, historique |
| 7 | Spec finale | Contrat figé + MVP Missions |
| 8 | Audit critique final | FEU VERT + 4 précisions intégrées |

**Point de vigilance permanent :** ChatGPT a d'abord proposé des actions inexistantes (`context.reset`, `workflow.resume`, `coding.apply`, `security.enableReadOnly`). Elles ont été retirées ou marquées `BACKEND REQUIS` après confrontation à la carte réelle des endpoints.

---

## 2. Carte vérifiée des endpoints

Source : `services/runtime/src/api/server.ts`.

| Domaine | Endpoints | Statut |
|---|---|---|
| Statut | `GET /api/status` | ACTIVE |
| Contexte | `GET /api/context?messages=&tools=` | ACTIVE (lecture) |
| Mémoire | `GET /api/memory`, `POST /api/memory` | ACTIVE (pas de suppression) |
| Workflows | `GET /api/workflows`, `GET /api/workflows/:id` | ACTIVE (lecture seule) |
| Skills | `GET /api/skills`, `POST /api/skills/:name/execute` | ACTIVE |
| Coding | `POST /api/opencode/execute` | ACTIVE (pas de diff/validate/apply séparés) |
| Urgence | `POST /api/emergency-stop { action: activate\|deactivate }` | ACTIVE |
| Missions | `GET /api/missions`, `GET /api/missions/:id`, `POST /api/missions`, `POST /api/missions/:id/transition`, `assign`, `unassign`, `context`, `result`, `run` | ACTIVE |
| Approbations | `GET /api/approvals`, `GET /api/approvals/:id`, `POST /api/approvals/request`, `POST /api/approvals/:id/grant`, `POST /api/approvals/:id/reject` | ACTIVE |
| Audit | `GET /api/audit?missionId=` | ACTIVE (pas d'export) |
| Conversations | `GET /api/conversations`, `GET /api/conversations/:id`, `PATCH`, `DELETE` | ACTIVE |
| Agents | `GET /api/subagents`, `GET /api/subagents/:id`, `POST /api/subagents`, `assign`, `unassign`, `run`, `chat`, `conversation`, `history` | ACTIVE |
| Providers | `GET /api/models/health` | ACTIVE |

Payloads utiles :
- `POST /api/subagents/:id/assign` → `{ missionId, assignedBy }`
- `POST /api/subagents/:id/run` → `{ maxSteps? }`
- `POST /api/missions/:id/transition` → `{ status, reason? }`
- `POST /api/missions/:id/context` → `{ projectPath, files, instructions, constraints, inheritedContext, updatedBy, note }`
- `GET /api/subagents/:id/conversation` → `{ conversation }`

---

## 3. Contrat vocal global

### 3.1 Principes

1. **Un seul micro**, dans le dock global persistant. Aucun micro dans les pages.
2. **Push-to-talk** : `Ctrl+Espace` maintenu, ou maintien du bouton micro. `Espace` seul reste réservé au dock quand le focus y est.
3. **La voix commande, elle ne converse pas** : grammaire impérative courte, slots, pas d'interprétation libre.
4. **Le dernier geste est toujours visuel ou clavier.** La voix prépare, décrit, donne le focus ; elle n'autorise jamais seule une action à risque.
5. **Dégradation permanente** : la même grammaire est tapable en `/commande` dans le dock.
6. **Barge-in** : toute pression PTT coupe immédiatement la synthèse (`speechSynthesis.cancel()`).
7. **Le backend applique READ-ONLY et l'arrêt d'urgence**, indépendamment du frontend.

### 3.1.1 Robustesse du push-to-talk

- `Ctrl+Espace` peut être intercepté par le système ou le navigateur : tester Windows, Linux et macOS.
- Ignorer les événements répétitifs (`keydown` auto-repeat).
- Libérer l'écoute sur `keyup`, `blur`, perte de focus et changement d'onglet.
- Aucun micro actif après `blur`.
- Si le raccourci est indisponible, le bouton micro reste le déclencheur de secours.

### 3.2 États

| État | Visuel | Audio |
|---|---|---|
| REPOS | 3 suggestions + badges READ-ONLY / URGENCE | silence |
| ÉCOUTE | micro rouge, onde animée, transcription provisoire | « Je vous écoute. » |
| TRANSCRIPTION | texte provisoire dans le strip | — |
| INTERPRÉTATION | commande comprise + cible + risque | « Commande comprise : [action], cible [ID]. » |
| AMBIGUÏTÉ | candidats numérotés, aucune action | « Plusieurs cibles correspondent. Sélectionnez une cible. » |
| CONFIRMATION REQUISE | cible résolue + contrôle réel mis en évidence | « [Action], [cible], risque [niveau]. Confirmez visuellement. » |
| EXÉCUTION | spinner + action affichée | silence |
| SUCCÈS | vert + preuve visuelle | silence, sauf action critique |
| REFUS POLITIQUE | rouge + motif | « Action refusée par la politique de sécurité : [motif]. » |
| ERREUR | rouge + motif | « Échec de reconnaissance ou d'exécution. Aucune action confirmée. » |
| ANNULÉ | gris | « Commande annulée. Aucune action exécutée. » |
| INDISPONIBLE | micro grisé + raison | silence |
| PERMISSION REFUSÉE | bandeau rouge + lien réglages | « Accès au microphone refusé. » |
| TIMEOUT | état d'erreur, aucune action | « Délai dépassé. Aucune action. » |
| ANNULATION TECHNIQUE | retour au repos | « Écoute interrompue. » |

**Règle :** aucun échec de reconnaissance ne doit déclencher une commande partiellement reconnue.

### 3.3 Grammaire

`VERBE + OBJET + SLOTS`

- Verbes : `afficher`, `filtrer`, `sélectionner`, `inspecter`, `approuver`, `rejeter`, `démarrer`, `mettre en pause`, `annuler`, `affecter`, `exécuter`.
- Objets : `mission`, `demande`, `agent`, `événement`, `skill`, `conversation`, `workflow`.
- Slots : identifiant, nom, statut, période, montant.
- Synonymes : `lancer` = `démarrer` ; `suspendre` = `mettre en pause`.
- Invalides : « fais ce qui semble nécessaire », « approuve tout ».

### 3.4 Défaillances

| Situation | Comportement |
|---|---|
| Bruit / micro coupé | retour à `/commande`, aucune action |
| API Web Speech indisponible | fallback textuel, micro désactivé avec explication |
| READ-ONLY | toute mutation refusée, même confirmée |
| Arrêt d'urgence | démarrages et exécutions bloqués, contrôle dédié |
| Refus politique runtime | motif affiché et lu, aucune trace de succès |
| Langue différente | interface textuelle, aucune reconnaissance supposée |

### 3.5 Confidentialité

- Indicateur micro permanent ; aucune écoute hors PTT.
- Web Speech ne garantit ni traitement local, ni confidentialité du traitement.
- Ne jamais stocker les transcriptions brutes côté serveur sans politique explicite.
- Un TTS/STT serveur ou un journal centralisé **nécessite un backend**.

---

## 4. Voice Strip

### 4.1 Placement

- Bandeau **pleine largeur**, immédiatement au-dessus du dock global.
- Hauteur 64–88 px, repliable.
- Visible sur les 11 pages, y compris Contexte et Audit (en lecture seule).
- Il ne recouvre jamais les rails ni le stage.
- Le micro reste dans le dock. Le strip n'écoute pas.

### 4.2 États visuels

**Repos**
```text
┌──────────────────────────────────────────────────────────────┐
│ Suggestions : Afficher missions | Filtrer | Inspecter        │
│ READ-ONLY OFF   URGENCE INACTIVE              [? Aide vocale]│
└──────────────────────────────────────────────────────────────┘
```

**Écoute**
```text
┌──────────────────────────────────────────────────────────────┐
│ 🔴 ÉCOUTE — Transcription en cours…                          │
└──────────────────────────────────────────────────────────────┘
```

**Ambiguïté**
```text
┌──────────────────────────────────────────────────────────────┐
│ Cibles possibles : M-12 / M-13                               │
│ Sélection requise — aucune action exécutée                   │
└──────────────────────────────────────────────────────────────┘
```

**Confirmation requise**
```text
┌──────────────────────────────────────────────────────────────┐
│ Approuver A-12 | 42 € | RISQUE CRITIQUE                      │
│ Cible résolue : A-12                                         │
│ → Inspecteur : AUTORISER A-12                                │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Ce que le strip ne fait jamais

- Écouter.
- Confirmer.
- Exécuter.
- Modifier une permission.
- Contourner READ-ONLY ou l'arrêt d'urgence.
- Afficher un bouton « Confirmer » générique : il pointe vers le contrôle réel.

---

## 5. Résolution de cible

1. Recherche exacte par identifiant (`M-12`, `A-12`, `E-12`).
2. Sinon correspondance exacte sur le nom dans le contexte de la page.
3. Sinon normalisation (casse, accents, pluriel), sans fusion automatique d'homophones.
4. Un seul résultat → afficher `CIBLE RÉSOLUE : M-12` + nom complet.
5. Plusieurs résultats → candidats numérotés, aucune action.
6. **Revérification après chargement du détail** : un ID résolu ne garantit pas que la ressource existe encore ou reste autorisée. Si le détail renvoie 404 ou un refus, le strip passe en `ERREUR` / `REFUS POLITIQUE` et aucune action n'est proposée.
7. Correction par slot : « Remplacer cible par M-13 », sans recommencer la commande.
8. Ambiguïté persistante → refus explicite.
9. Avant tout geste : ID, nom, scope, permissions et risque visibles dans le strip **et** sur le contrôle réel.

---

## 6. Politique de confirmation

| Action | Confirmation | Justification |
|---|---|---|
| Afficher / filtrer / inspecter | immédiate | lecture seule |
| Mettre en pause | immédiate | réversible |
| Approuver / rejeter | **contrôle visuel réel** | dépense, usage unique, audit |
| Démarrer une mission | **contrôle visuel réel** | écriture/exécution |
| Annuler une mission | **contrôle visuel réel** | irréversible |
| Affecter un agent | **contrôle visuel réel** | écriture |
| Exécuter un skill / un agent | **contrôle visuel réel** | exécution |
| Supprimer une conversation | **contrôle visuel réel** | destruction |
| Désactiver l'arrêt d'urgence | **contrôle visuel renforcé** | signature fondateur |
| Activer l'arrêt d'urgence | bouton dédié immédiat | sécurité |
| READ-ONLY | aucune mutation autorisée | politique runtime |

**Règle unique :** la voix peut donner le focus au contrôle, jamais l'activer.

---

## 7. Propositions d'interfaces par page

Les wireframes ci-dessous sont des propositions de structure, pas des maquettes finales. Les exemples d'identifiants sont des placeholders.

### 7.1 Missions

```text
┌───────────┬──────────────────────────┬─────────────────────┐
│ FILTRES   │ MISSIONS                 │ INSPECTEUR          │
│           │                          │                     │
│ Statut    │ ID   NOM    STATUT AGENT │ M-12                │
│ □ Actives │ M12  Alpha  Active Nova  │ Mission Alpha       │
│ □ Pause   │ M13  Beta   Pause  —     │ Statut : Active     │
│ Priorité  │ M14  Gamma  Attente —    │ Permissions         │
│ Agent     │                          │ Fichiers : écriture │
│           │ [ligne M-12 sélectionnée]│                     │
│           │                          │ [Inspecter]         │
│           │                          │ [Pause] [Annuler]   │
├───────────┴──────────────────────────┴─────────────────────┤
│ ACTIONS : Démarrer | Pause | Annuler | Affecter            │
├───────────────────────────────────────────────────────────┤
│ VOICE STRIP — lecture seule                                │
│ Suggestions | commande comprise | cible | risque           │
├───────────────────────────────────────────────────────────┤
│ DOCK GLOBAL : [🎙 PTT] [/commande] [Historique]            │
└───────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher les missions | `GET /api/missions` | lecture | non | ACTIVE |
| Filtrer les missions en cours | `GET /api/missions?status=RUNNING` | lecture | non | ACTIVE |
| Inspecter la mission M-12 | `GET /api/missions/:id` | lecture | non | ACTIVE |
| Démarrer la mission M-12 | `POST /api/missions/:id/transition {status:RUNNING}` | exécution | oui | ACTIVE |
| Affecter l'agent Alpha à M-12 | `POST /api/missions/:id/assign {subagentId}` | écriture | oui | ACTIVE |

### 7.2 Approbations

```text
┌──────────────────────────────────────────────────────────────┐
│ APPROVAL GATE       PENDING: 03       LEDGER: CONNECTED      │
├───────────────┬──────────────────────────┬───────────────────┤
│ FILE          │ DEMANDE SÉLECTIONNÉE    │ CONTEXTE          │
│ #A01 Écriture │ ID / TYPE ACTION         │ Mission liée      │
│ 42€ EXP 10:42 │ Ressource                │ Pas lié           │
│ #A02 Dépense  │ JUSTIFICATION            │ Agent lié         │
│ 15€ EXP 11:10 │ COÛT ESTIMÉ              │ Auteur            │
│ #A03 Exécution│ DURÉE MAX / EXPIRATION   │ Usage unique      │
│               │ [ AUTORISER ] [ REJETER ]│ Consommation: 0   │
├───────────────┴──────────────────────────┴───────────────────┤
│ DÉCISION → SIGNATURE → LEDGER → AUTORISATION CONSOMMÉE       │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : cible | montant | permissions | contrôle réel  │
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher les approbations | `GET /api/approvals` | lecture | non | ACTIVE |
| Inspecter la demande A-12 | `GET /api/approvals/:id` | lecture | non | ACTIVE |
| Approuver la demande A-12 | `POST /api/approvals/:id/grant` | dépense | oui | ACTIVE |
| Rejeter la demande A-12 | `POST /api/approvals/:id/reject` | écriture | oui | ACTIVE |
| Demander une autorisation | `POST /api/approvals/request` | écriture | oui | ACTIVE |

### 7.3 Audit

```text
┌──────────────────────────────────────────────────────────────┐
│ IMMUTABLE LEDGER       APPEND-ONLY       ORDER: CAUSAL       │
├───────────────┬──────────────────────────┬───────────────────┤
│ FILTRES       │ FLUX D'ÉVÉNEMENTS        │ INSPECTEUR        │
│ Mission ID    │ 18:02 MISSION_CREATED    │ EVENT ID          │
│ Step ID       │ 18:03 PLAN_GENERATED     │ Horodatage        │
│ Correlation   │ 18:04 APPROVAL_REQUEST   │ Type              │
│ Acteur        │ 18:05 APPROVAL_GRANTED   │ Mission ID        │
│ Type / Période│ 18:07 STEP_STARTED       │ Step ID           │
│ Recherche     │ 18:08 ERROR              │ Correlation ID    │
│               │ [Sélection événement]    │ Acteur / JSON     │
│               │                          │ Lecture seule     │
├───────────────┴──────────────────────────┴───────────────────┤
│ TOTAL | DERNIER ÉVÉNEMENT | EXPORT (BACKEND REQUIS)          │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : filtres et cible | aucune mutation             │
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher le journal | `GET /api/audit` | lecture | non | ACTIVE |
| Filtrer par mission M-12 | `GET /api/audit?missionId=` | lecture | non | ACTIVE |
| Inspecter l'événement E-12 | données déjà chargées | lecture | non | ACTIVE |
| Afficher les événements récents | `GET /api/audit` + tri client | lecture | non | ACTIVE |
| Exporter l'audit | — | lecture | non | BACKEND REQUIS |

### 7.4 Context Engine

```text
┌────────────── CONTEXT ENGINE ────────────────────────────────┐
│ Budget total │ Consommé │ Disponible                         │
│ [Jauge de consommation]                                       │
│                                                              │
│ Ventilation par composant                                     │
│ [Prompt système | Outils | Réserve réponse | Stratégie]       │
│                                                              │
│ Fenêtre glissante : BACKEND REQUIS                           │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : lecture seule | cible = métrique ou composant  │
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher le budget tokens | `GET /api/context` | lecture | non | ACTIVE |
| Lire la ventilation | `GET /api/context` | lecture | non | ACTIVE |
| Afficher les tokens disponibles | `GET /api/context` | lecture | non | ACTIVE |
| Inspecter le composant [nom] | données déjà chargées | lecture | non | ACTIVE |
| Filtrer la fenêtre glissante | — | lecture | non | BACKEND REQUIS |

### 7.5 Memory Engine

```text
┌────────────── MEMORY ENGINE ─────────────────────────────────┐
│ Namespaces │ Threads │ Recherche                            │
│─────────────┬────────────────────────────────────────────────│
│ Working     │ Clé | Valeur | Type | Horodatage               │
│ Épisodique  │ Sélection / Détail                             │
│ Sémantique  │ Historique                                     │
│             │ [Enregistrer] [Supprimer]                      │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : cible = namespace/thread/clé | écriture risquée│
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher la mémoire | `GET /api/memory` | lecture | non | ACTIVE |
| Inspecter le thread [ID] | `GET /api/memory?threadId=` | lecture | non | ACTIVE |
| Rechercher la clé [nom] | `GET /api/memory?query=` | lecture | non | ACTIVE |
| Enregistrer [valeur] dans [clé] | `POST /api/memory` | écriture | oui | ACTIVE |
| Supprimer la mémoire [ID] | — | destruction | oui | BACKEND REQUIS |

### 7.6 Workflow Engine

```text
┌────────────── WORKFLOW ENGINE ───────────────────────────────┐
│ Instances │ Recherche │ Statuts                            │
│──────────────┬───────────────────────────────────────────────│
│ Liste        │ Nœud courant                                  │
│              │ État persisté JSON                            │
│              │ Historique                                    │
│              │ [Inspecter]                                   │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : cible = workflow/nœud | reprise BACKEND REQUIS│
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher les workflows | `GET /api/workflows` | lecture | non | ACTIVE |
| Inspecter le workflow W-12 | `GET /api/workflows/:id` | lecture | non | ACTIVE |
| Afficher le nœud courant | `GET /api/workflows/:id` | lecture | non | ACTIVE |
| Afficher l'état JSON | `GET /api/workflows/:id` | lecture | non | ACTIVE |
| Reprendre le workflow W-12 | — | exécution | oui | BACKEND REQUIS |

### 7.7 Skills Registry

```text
┌────────────── SKILLS REGISTRY ───────────────────────────────┐
│ Recherche │ Catégories │ Permissions                        │
│ Catalogue des skills                                         │
│──────────────┬───────────────────────────────────────────────│
│ Nom | Statut │ Description                                   │
│              │ Permissions                                   │
│              │ Sandbox / Résultat JSON                       │
│              │ [Exécuter]                                    │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : cible = skill | exécution = confirmation      │
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher les skills | `GET /api/skills` | lecture | non | ACTIVE |
| Filtrer les skills autorisés | `GET /api/skills` + filtre client | lecture | non | ACTIVE |
| Inspecter le skill [nom] | données déjà chargées | lecture | non | ACTIVE |
| Lire les permissions du skill [nom] | données déjà chargées | lecture | non | ACTIVE |
| Exécuter le skill [nom] | `POST /api/skills/:name/execute` | exécution | oui | ACTIVE |

### 7.8 Coding Engine

```text
┌────────────── CODING ENGINE ─────────────────────────────────┐
│ Workspace                                                    │
│──────────────┬───────────────────────────────────────────────│
│ Fichiers     │ Prompt                                        │
│              │ Résultat d'exécution                          │
│              │ Diff affiché si fourni                        │
│              │ [Exécuter]                                    │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : cible = workspace/tâche | exécution risquée    │
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher le workspace | état client | lecture | non | ACTIVE |
| Inspecter le prompt | état client | lecture | non | ACTIVE |
| Envoyer le prompt | `POST /api/opencode/execute` | exécution | oui | ACTIVE |
| Inspecter le résultat | réponse de l'exécution | lecture | non | ACTIVE |
| Appliquer le diff | — | écriture | oui | BACKEND REQUIS |

### 7.9 Agents

```text
┌────────────── AGENTS ────────────────────────────────────────┐
│ Registry : recherche | filtres | statut                      │
├────────────────┬────────────────────┬────────────────────────┤
│ AGENTS         │ MIXER / STAGE      │ INSPECTEUR             │
│ Agent Alpha    │ Affectations       │ ID agent               │
│ Agent Beta     │ Ordre d'exécution  │ Permissions            │
│ Agent Gamma    │ État courant       │ Contexte versionné     │
│                │                    │ Résultats              │
│                │                    │ [Assigner]             │
│                │                    │ [Désassigner]          │
│                │                    │ [Exécuter]             │
│                │                    │ [Conversation]         │
├────────────────┴────────────────────┴────────────────────────┤
│ CONVERSATION ISOLÉE : messages | historique | résultat       │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : cible = agent/mission | risque | contrôle réel │
│ DOCK GLOBAL : [🎙 PTT] [/commande] [Historique]              │
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher les agents | `GET /api/subagents` | lecture | non | ACTIVE |
| Inspecter l'agent Alpha | `GET /api/subagents/:id` | lecture | non | ACTIVE |
| Créer un agent [nom] | `POST /api/subagents` | écriture | oui | ACTIVE |
| Affecter Alpha à M-12 | `POST /api/subagents/:id/assign {missionId}` | écriture | oui | ACTIVE |
| Exécuter l'agent Alpha | `POST /api/subagents/:id/run` | exécution | oui | ACTIVE |

### 7.10 Conversations

```text
┌────────────── CONVERSATIONS ─────────────────────────────────┐
│ Scope : MAIN | AGENT                                         │
│──────────────┬───────────────────────────────────────────────│
│ Threads      │ Messages                                      │
│ Recherche    │ Détail                                        │
│              │ [Reprendre] [Supprimer]                       │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : cible = conversation | suppression risquée     │
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher les conversations main | `GET /api/conversations?scope=main` | lecture | non | ACTIVE |
| Afficher les conversations agent | `GET /api/conversations?scope=agent` | lecture | non | ACTIVE |
| Inspecter la conversation [ID] | `GET /api/conversations/:id` | lecture | non | ACTIVE |
| Reprendre la conversation [ID] | état client / navigation | lecture | non | ACTIVE |
| Supprimer la conversation [ID] | `DELETE /api/conversations/:id` | destruction | oui | ACTIVE |

### 7.11 Paramètres / Urgence

```text
┌────────────── SETTINGS ──────────────────────────────────────┐
│ Providers : santé / disponibilité                            │
│ Sécurité : READ-ONLY (état affiché)                          │
│ Emergency Stop : état                                        │
│                                                              │
│ [ACTIVER L'ARRÊT D'URGENCE]                                  │
│                                                              │
│ Configuration et permissions                                 │
├──────────────────────────────────────────────────────────────┤
│ VOICE STRIP : état sécurité | urgence = contrôle dédié      │
└──────────────────────────────────────────────────────────────┘
```

Commandes :

| Commande | Endpoint | Risque | Confirmation | État |
|---|---|---|---|---|
| Afficher les providers | `GET /api/models/health` | lecture | non | ACTIVE |
| Vérifier la santé | `GET /api/models/health` | lecture | non | ACTIVE |
| Afficher le statut | `GET /api/status` | lecture | non | ACTIVE |
| Activer l'arrêt d'urgence | `POST /api/emergency-stop {action:activate}` | urgence | bouton dédié | ACTIVE |
| Désactiver READ-ONLY | — | politique | renforcée | BACKEND REQUIS |

---

## 8. Découvrabilité des commandes

Trois niveaux, sans catalogue permanent dans le HUD :

```text
Dock : [🎙 PTT] [/________________] [?]
                    ↓
/ = palette filtrable des commandes de la page
Strip au repos = 3 suggestions contextuelles maximum
? = overlay complet : verbes, exemples, risques
```

- La palette `/` liste les commandes de la page courante, puis les commandes globales.
- Chaque entrée indique le risque et si une confirmation visuelle est requise.
- Les commandes `BACKEND REQUIS` apparaissent grisées avec la mention « indisponible ».
- Aucune commande non vérifiée n'est exécutable.

---

## 9. Checklist « voice-ready »

Une page ne peut être déclarée compatible voix que si les 6 preuves sont visibles à l'écran :

1. Micro unique dans le dock global.
2. Voice Strip visible, passif, sans bouton de confirmation.
3. Trois suggestions contextuelles exactes pour la page.
4. Cible résolue avec son identifiant réel.
5. Niveau de risque et contrôle d'action réel visibles.
6. READ-ONLY, URGENCE et erreurs visibles.

---

## 10. Premier incrément implémentable

**Périmètre : Missions en lecture seule.** Aucune mutation vocale.

Composants :
- `VoiceController` : PTT, Web Speech fr-FR, états, barge-in, fallback.
- `VoiceStrip` : bandeau passif, 4 états, suggestions.
- `CommandParser` : grammaire fermée, verbes/objets/slots.
- `TargetResolver` : résolution exacte, candidats, correction.
- `MissionCommandAdapter` : `afficher`, `filtrer`, `inspecter` uniquement.

Contraintes :
- `GET /api/missions` et `GET /api/missions/:id` seulement.
- `Ctrl+Espace` maintenu ou bouton micro ; libération sur `keyup`, `blur`, perte de focus.
- Aucune interprétation libre.
- Aucun déclenchement ambigu, aucune commande partiellement reconnue.
- Revalidation de la cible après chargement du détail (404 / refus → aucune action).
- Fallback `/commande` identique.
- TTS interrompu au PTT.
- READ-ONLY et Emergency Stop vérifiés côté runtime, pas seulement dans l'UI.
- Transcriptions conservées en mémoire de session uniquement pour le MVP.

Critères d'acceptation :
- [ ] « Afficher les missions » ouvre la page Missions.
- [ ] « Filtrer les missions en cours » applique `status=RUNNING`.
- [ ] « Inspecter la mission M-12 » sélectionne la bonne mission et affiche son ID réel.
- [ ] Une cible ambiguë affiche des candidats et n'exécute rien.
- [ ] Le strip montre la commande comprise, la cible et le risque.
- [ ] Le fallback textuel produit le même résultat.
- [ ] READ-ONLY et URGENCE restent visibles.
- [ ] Aucun appel mutant n'est déclenché par le MVP (vérifié par logs réseau).
- [ ] Aucun micro actif après `blur` ou changement d'onglet.
- [ ] La transcription est corrigeable avant exécution.
- [ ] Les états `INDISPONIBLE`, `PERMISSION REFUSÉE` et `TIMEOUT` sont couverts.
- [ ] Les tests READ-ONLY et Emergency Stop passent avant activation.

Reporté : mutations vocales, historique serveur corrélé à l'audit, autres pages, reprise de workflow, export d'audit, application de diff, bascule READ-ONLY.

---

## 11. Backend requis (à ne pas simuler)

| Fonction | Raison |
|---|---|
| Export d'audit | aucun endpoint |
| Reprise de workflow | aucun endpoint |
| Suppression mémoire | aucun endpoint DELETE |
| Diff / validation / application séparés | seul `POST /api/opencode/execute` existe |
| Bascule READ-ONLY | variable d'environnement, pas d'endpoint |
| Filtre de période du contexte | `GET /api/context` ne renvoie pas d'historique |
| Identifiant de commande vocale corrélé à l'audit | type d'événement non exposé |
| TTS/STT serveur, journal centralisé | Web Speech natif seulement |

---

## 12. Limites assumées

- **Web Speech API** : reconnaissance non déterministe, dépendante du navigateur, qualité variable en environnement bruyant, traitement potentiellement distant. Ce n'est pas un moteur de commande critique.
- **Pas de wake word** dans le MVP : le PTT est le seul déclencheur.
- **Pas de confirmation vocale finale** : le dernier geste est visuel ou clavier.
- **Pas d'historique serveur** sans backend et sans politique de confidentialité.
- **Les wireframes sont des structures**, pas des captures : les identifiants et montants affichés sont des placeholders de conception.
- **`ACTIVE` ne signifie pas « implémenté côté UI »** : cela signifie que l'endpoint runtime existe. Le raccordement vocal reste à faire.

---

## 13. Audit critique final (ChatGPT)

Verdict : **FEU VERT** pour le MVP Missions en lecture seule, sous réserve des tests navigateur, permissions micro et garde-fous.

Points ajoutés à la spec après cet audit :

1. **Raccourci** : tester `Ctrl+Espace` sur Windows, Linux et macOS ; ignorer les répétitions ; libérer sur `keyup`, `blur`, perte de focus.
2. **Cible** : revérifier l'existence et l'autorisation après chargement du détail ; un ID résolu n'est pas une garantie.
3. **Sécurité** : READ-ONLY et Emergency Stop sont appliqués par le runtime ; le frontend n'est pas une frontière de sécurité.
4. **États manquants** : `INDISPONIBLE`, `PERMISSION REFUSÉE`, `TIMEOUT`, `ANNULATION TECHNIQUE` ; aucun échec ne doit déclencher une commande partiellement reconnue.
5. **Critères ajoutés** : zéro mutation réseau, zéro action sur cible ambiguë, aucun micro après `blur`, transcription corrigeable, fallback slash, tests READ-ONLY et urgence.
6. **Confidentialité** : transcriptions en mémoire de session uniquement pour le MVP.

Condition de sortie : réussir les tests d'acceptation du `VoiceController` avant toute activation en environnement opérationnel.
