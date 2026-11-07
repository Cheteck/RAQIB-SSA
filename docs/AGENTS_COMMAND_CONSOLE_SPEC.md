# RAQIB — Spécification de la console Agents

> **Statut :** spécification convergée, prête pour implémentation du premier incrément.
> **Portée :** écran de supervision des sous-agents (`/agents`) et fiche agent (`/agents/[id]`).
> **Principe directeur :** aucune donnée inventée. Tout champ affiché doit provenir d'un endpoint runtime existant ou être explicitement marqué comme indisponible.

---

## 1. Origine de la décision

Deux sources ont été fusionnées :

1. **Vision ChatGPT** (conversation `6aee0e8b-03f8-83ea-bbec-d4e1524b1bb5`) : Agent Registry à gauche, Agent Constellation au centre, Intelligence Panel à droite, Audit Timeline en bas, modes `COMMAND` / `DEEP INSPECT` / `MISSION CONTROL`.
2. **Critique de l'agent** : une constellation par défaut devient décorative au-delà de quelques agents ; le centre doit rester un « stage » réutilisable comme sur la page principale ; la signature doit être le Context Diff (le contexte est déjà append-only) ; le canal agent doit être visuellement isolé du chat RAQIB.

**Arbitrage retenu par ChatGPT :**

| Proposition | Décision |
|---|---|
| Mixer par défaut, constellation en secondaire | **Validé.** Une ligne par agent, colonnes fixes. Constellation seulement si les relations sont réellement exposées. |
| Stage central réutilisable | **Validé.** `DEEP INSPECT` remplace le contenu du centre sans déplacer les rails. |
| Context Diff comme signature du panneau droit | **Validé.** Diff append-only des versions, avec auteur / date / note quand disponibles. |
| Intercom docké et étiqueté | **Validé.** Mention permanente « AGENT CHANNEL ≠ RAQIB CHAT ». |
| Premier incrément | **Mixer + Agent Stage + sélection clavier + Audit Timeline** avec les données runtime existantes. |
| Reporté | Constellation, diff enrichi si métadonnées absentes, animations, automatisation, intercom avancé. |

---

## 2. Invariants de conception

1. **Un seul système.** `SubagentManager`, `MissionEngine`, `ConversationStore` restent les sources uniques. L'écran ne crée aucun état métier parallèle.
2. **Le centre change de propriétaire, pas de géométrie.** Les rails gauche et droit restent fixes ; le stage central passe de `MIXER` à `AGENT STAGE`.
3. **Pas de faux graphe.** Aucune arête, orbite ou animation relationnelle n'est affichée sans donnée runtime correspondante.
4. **Isolation stricte des conversations.** La conversation agent est persistée avec `scope=agent` et `agent_id=<id>`. Elle n'emprunte jamais le composer ni l'historique du chat principal.
5. **Le sous-agent ne s'auto-valide pas.** L'UI affiche `VERIFYING` comme un état supervisé, jamais comme un succès.
6. **Toute action mutante est gouvernée.** Affectation, désaffectation, exécution et envoi de message respectent le mode READ-ONLY et les erreurs de politique runtime.
7. **Mouvement utile uniquement.** État, progression, nouvel événement. Aucun déplacement artificiel, aucune parallaxe, aucun drift de nœuds.

---

## 3. Wireframe de référence

Écran large (≥ 1440 px). Les proportions reprennent la grille de la page principale : `minmax(280px, 320px) 1fr minmax(280px, 320px)`.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ RAQIB // AGENTS   [RUNTIME: ONLINE] [READ-WRITE]            12:42:07        [⌘] [AGENTS] [◉] │
├───────────────────────┬──────────────────────────────────────────────────┬───────────────────┤
│ AGENT REGISTRY        │  STAGE · MIXER                                   │ INTELLIGENCE      │
│ [/ recherche…]        │  ┌────────────────────────────────────────────┐  │ [CONTEXT][RESULT] │
│ [TOUS 12][DISP 5]     │  │ ÉTAT  AGENT        MISSION      PRIO  PROG │  │ [INTERCOM]        │
│ [OCCUP 4][ERR 1]      │  ├────────────────────────────────────────────┤  │                   │
│                       │  │  ●   ORION         M-204  RUN    HIGH  3/5 │  │ CONTEXT DIFF      │
│ ▸ ORION      ● OCCUPÉ │  │      executor      audit      ███░ 60 %   │  │ v1 → v2           │
│   audit · M-204       │  │      audit sécu    ⚠ 1 err               │  │ + files[2]        │
│                       │  ├────────────────────────────────────────────┤  │ + constraints[1]  │
│   VEGA       ● DISP   │  │  ●   VEGA          M-205  PLAN   MED   0/4 │  │ ~ inherited       │
│   recherche · M-205   │  │      researcher    planif     ░░░░  0 %   │  │ par operator      │
│                       │  ├────────────────────────────────────────────┤  │ 12:38 · note      │
│   NOVA       ● ERR    │  │  ●   NOVA          M-206  BLOCK  CRIT  2/3 │  │                   │
│   vérif · M-206       │  │      verifier      vérif      ██░░ 66 %   │  │ ───────────────   │
│                       │  │      ⚠ READ-ONLY                         │  │ CANAL AGENT       │
│                       │  └────────────────────────────────────────────┘  │ ≠ CHAT RAQIB      │
│ [+ CRÉER UN AGENT]    │                                                  │ [messages…]       │
│                       │  DEEP INSPECT → remplace ce stage                │ [instruction…] ↑  │
├───────────────────────┴──────────────────────────────────────────────────┴───────────────────┤
│ AUDIT TIMELINE · agent sélectionné · 5 derniers événements                                   │
│ 12:41 MISSION_RESULT_RECORDED  │ 12:40 MISSION_CONTEXT_UPDATED │ 12:39 STEP_COMPLETED …      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Zone A — Header

Réutilise `HUDHeader` / `.top` :
- marque `RAQIB` + suffixe de section `// AGENTS` ;
- pastille runtime (`ONLINE` / `DEGRADED` / `OFFLINE`) ;
- pastille mode (`READ-WRITE` vert / `READ-ONLY` ambre) ;
- horloge ;
- accès direct au chat RAQIB et au dock.

**Règle :** le mode READ-ONLY est visible en permanence, pas seulement au moment d'une action refusée.

### 3.2 Zone B — Rail gauche : Agent Registry

Largeur 280–320 px, scroll vertical indépendant, même grammaire `.p` / `.fi` / `.feed`.

Contenu :
1. **Recherche** (`/` pour focus) : filtre sur `name`, `specialty`, `role`, `mission.name`.
2. **Filtres d'état** : `TOUS`, `DISPONIBLE`, `OCCUPÉ`, `INACTIF`, `ERREUR`, avec compteurs.
3. **Ligne agent compacte** (une par agent) :
   - pastille d'état colorée (`available` cyan, `busy` ambre, `inactive` gris, `error` rouge) ;
   - nom + spécialité ;
   - mission courante (`[STATUT] nom`) ou `AUCUNE MISSION` ;
   - dernière activité (`updatedAt`, format court).
4. **Sélection** : la ligne sélectionnée reçoit un liseré cyan à gauche + fond `rgba(var(--c), 0.08)`.
5. **Bouton** `+ CRÉER UN AGENT` : ouvre un panneau de création replié (nom, rôle, spécialité, instructions, mission optionnelle). Le formulaire actuel est conservé, mais replié par défaut pour ne pas écraser la densité.

Ne pas afficher dans ce rail : instructions complètes, contexte, résultats, chat. Ils appartiennent au stage ou au panneau droit.

### 3.3 Zone C — Centre : Stage

Le stage occupe la colonne centrale et possède **deux propriétaires** :

#### Mode `MIXER` (défaut)

Une ligne par agent, colonnes alignées, en `JetBrains Mono` 10,5–11 px pour les valeurs.

| Colonne | Source | Rendu |
|---|---|---|
| `ÉTAT` | `subagent.state` | pastille + libellé court |
| `AGENT` | `name`, `role`, `specialty` | nom en Oxanium, rôle/spécialité en mono |
| `MISSION` | `missionId` → mission | `id court` + `status` |
| `PRIO` | `mission.priority ?? 'MEDIUM'` | `LOW/MEDIUM/HIGH/CRITICAL`, couleur ambre→rouge |
| `PROG` | `currentStepIndex / steps.length` | barre fine + `n/m` + `%` |
| `ALERTE` | `lastError` ou `mission.result.errors[0]` ou `step.error` | icône ⚠ + texte tronqué, rouge |
| `DERNIER` | dernier événement d'audit de la mission | type + heure courte |

Règles :
- 0 étape → progression `—`, pas `0 %` trompeur.
- Mission absente → `LIBRE`, pas de barre.
- L'agent sélectionné est mis en évidence ; le reste reste lisible.
- Tri par défaut : `error` → `busy` → `available` → `inactive`, puis `updatedAt` décroissant. Tri secondaire stable par nom.
- Au-delà de 30 agents, le Mixer reste la vue par défaut mais le rail gauche devient le point d'entrée (filtre/recherche). Pas de pagination cachée : compteur explicite `n / total`.

**Pourquoi pas une constellation par défaut :** une ligne répond immédiatement à « qui est bloqué, sur quoi, à quelle étape ». Un graphe répond à « qui est connecté à qui », information que le runtime n'expose pas aujourd'hui entre agents.

#### Mode `AGENT STAGE` (`DEEP INSPECT`)

Déclenché par `Entrée` sur l'agent sélectionné. Le stage central est remplacé, les rails restent en place.

En-tête du stage :
- `AGENT / <nom>` + `role` + `specialty` ;
- état supervisé + `status` natif ;
- `ID court` (cliquable pour copier), `stepsExecuted`, `updatedAt` ;
- boutons : `AFFECTER`, `DÉSAFFECTER`, `EXÉCUTER` (désactivés selon état / mission / READ-ONLY), `RETOUR MIXER` (`Échap`).

Corps du stage, dans cet ordre :
1. **Mission courante** : id, nom, statut, priorité, objectif.
2. **Progression** : étapes avec statut (`PENDING/RUNNING/DONE/FAILED/SKIPPED`), erreur par étape.
3. **Contexte d'exécution courant** : `projectPath`, `files`, `instructions`, `constraints`, `inheritedContext`.
4. **Résultats remontés** : `summary`, `success`, `modifiedFiles`, `reports`, `errors`, `artifacts`, `metrics`.
5. **Historique d'affectation** : `subagent_missions` (mission, statut, affectée le, clôturée le, par qui).

Le panneau droit ne duplique pas ces blocs : il porte le **diff** du contexte, les résultats synthétiques et l'intercom.

#### Mode `MISSION CONTROL`

Panneau latéral ou volet bas du stage, pas un troisième écran :
- sélection d'une mission assignable ;
- confirmation d'affectation avec `assignedBy = operator` ;
- avertissement si la mission est déjà affectée à un autre agent ;
- si READ-ONLY : sélecteur et bouton désactivés avec raison explicite.

### 3.4 Zone D — Rail droit : Intelligence Panel

Trois onglets, un seul visible à la fois, hauteur fixe, scroll interne.

#### Onglet `CONTEXT`

Source : `mission.executionContext` + `mission.contextLog[]`.

- **Contexte courant** : champs structurés, listes compactes.
- **Context Diff** : comparaison `v(n-1) → v(n)`.
  - entrées ajoutées : `+ files[2]`, `+ constraints[1]` ;
  - entrées modifiées : `~ inheritedContext` ;
  - entrées retirées : `- instructions[1]` ;
  - métadonnées : `updatedBy`, `timestamp`, `note`.
- **Limite assumée :** le runtime fournit `patch`, `updatedBy`, `timestamp`, `note`. Il ne fournit pas de diff ligne-à-ligne avec motif d'affectation métier. On affiche donc un diff structurel par champ, pas un diff textuel inventé.

#### Onglet `RESULTS`

Source : `mission.result`.
- `summary` en texte ;
- `success` : badge `SUCCÈS` / `ÉCHEC` / `NON RENSEIGNÉ` ;
- `modifiedFiles`, `reports`, `artifacts` en listes mono ;
- `errors` en rouge ;
- `metrics` en paires clé/valeur.

#### Onglet `INTERCOM`

Source : `GET /api/subagents/:id/conversation`, envoi `POST /api/subagents/:id/chat`.

- en-tête : `CANAL AGENT · <nom>` + badge ambre `≠ CHAT RAQIB` ;
- messages : opérateur à gauche (cyan), agent à droite (vert), horodatage + modèle si présent ;
- composer mono, entrée = envoi, `Maj+Entrée` = nouvelle ligne ;
- état vide explicite : « Aucun message. Ce canal est propre à l'agent. » ;
- READ-ONLY : composer désactivé, message « Envoi bloqué par la politique runtime » ;
- scroll interne, jamais de fusion avec le chat principal.

### 3.5 Zone E — Audit Timeline

Bandeau bas pleine largeur, 5 événements les plus récents de l'agent sélectionné (ou de toutes les missions en mode Mixer sans sélection).

Source : `GET /api/audit` puis filtrage client par `missionId` de l'agent sélectionné. Chaque entrée :
- heure `HH:MM:SS` ;
- type (`MISSION_ASSIGNED`, `MISSION_CONTEXT_UPDATED`, `MISSION_RESULT_RECORDED`, `STEP_COMPLETED`, `SUBAGENT_COMPLETED`, `POLICY_DECISION`, `MISSION_BLOCKED`, `ERROR`…) ;
- acteur ;
- mission / step si présents.

Règles :
- largeur fixe par entrée, texte tronqué avec `title` complet ;
- couleur par famille : contexte cyan, résultat vert, blocage/politique rouge, étape neutre ;
- nouveau événement → apparition discrète (opacité + translation 4 px), pas de flash.

---

## 4. Modes, sélection et navigation

### 4.1 États d'écran

| État | Rendu |
|---|---|
| Chargement initial | squelettes de lignes + `SYNC…` dans le header, jamais un écran vide |
| Runtime injoignable | panneau d'erreur rouge dans le stage + bouton `RÉESSAYER`, rails en état `OFFLINE` |
| Aucun agent | état vide dans le rail + CTA `CRÉER UN AGENT` + rappel « les affectations sont journalisées » |
| Aucun agent sélectionné | Mixer complet, panneau droit en état `SÉLECTIONNEZ UN AGENT` |
| Agent sans mission | stage affiche `AUCUNE MISSION AFFECTÉE`, actions `EXÉCUTER` désactivées |
| Agent `RUNNING` | bouton `EXÉCUTER` désactivé, libellé `EN COURS`, progression visible |
| Agent `BLOCKED` / `FAILED` | bandeau rouge avec `lastError` / `result.errors`, Audit Timeline mise en avant |
| READ-ONLY | pastille ambre header + actions mutantes désactivées avec raison |

### 4.2 Raccourcis clavier

| Touche | Action |
|---|---|
| `/` | focus recherche du registry |
| `↑` / `↓` ou `k` / `j` | déplacer la sélection dans le Mixer |
| `Entrée` | ouvrir `AGENT STAGE` (DEEP INSPECT) |
| `Échap` | revenir au Mixer / fermer le volet Mission Control |
| `a` | ouvrir l'affectation de l'agent sélectionné |
| `u` | désaffecter (confirmation) |
| `x` | exécuter la mission (confirmation, si supporté et autorisé) |
| `c` | focus composer Intercom |
| `1` / `2` / `3` | onglets `CONTEXT` / `RESULTS` / `INTERCOM` |
| `R` | rafraîchir manuellement |
| `?` | afficher la couche des raccourcis |

Les raccourcis sont inertes quand le focus est dans un champ de saisie, sauf `Échap`.

### 4.3 Rafraîchissement

- Aucun WebSocket n'est exposé aujourd'hui : **polling**.
- Mixer : `/api/subagents`, `/api/missions`, `/api/audit` toutes les 4 s quand l'onglet est visible ; pause quand `document.hidden`.
- Agent Stage : détail agent + conversation toutes les 5 s.
- Indicateur `SYNC` avec heure du dernier cycle réussi ; en cas d'échec, conserver les dernières données et afficher `DERNIÈRE SYNC HH:MM` en ambre.
- Pas de rechargement complet de la page, pas de perte de sélection ni de brouillon de message.

### 4.4 Mouvement

| Élément | Animation | Durée |
|---|---|---|
| Changement d'état d'un agent | transition de couleur + pastille | 180 ms |
| Progression | largeur de barre | 400 ms ease-out |
| Nouvel événement d'audit | opacité + 4 px | 220 ms |
| Ouverture du stage | fondu du contenu central | 160 ms |
| Sélection | liseré + fond | 120 ms |

`prefers-reduced-motion: reduce` → aucune translation, transitions instantanées ou fondus ≤ 80 ms.

---

## 5. Mapping champ → source runtime

Toutes les sources sont des endpoints existants vérifiés dans `services/runtime/src/api/server.ts`.

| Élément UI | Champ | Endpoint / structure |
|---|---|---|
| Agent — nom, rôle, spécialité | `subagent.name`, `.role`, `.specialty` | `GET /api/subagents` → `{ subagents }` |
| Agent — état supervisé | `subagent.state` (`available/busy/inactive/error`) | idem |
| Agent — statut natif | `subagent.status` (`IDLE/RUNNING/COMPLETED/BLOCKED/FAILED`) | idem |
| Agent — étapes exécutées | `subagent.stepsExecuted` | idem |
| Agent — dernière erreur | `subagent.lastError` | idem |
| Agent — mission courante | `subagent.mission` / `subagent.missionId` | idem |
| Agent — historique | `history[]` | `GET /api/subagents/:id` → `{ history }` |
| Mission — titre, objectif | `mission.name`, `.title`, `.objective` | `GET /api/missions` → `{ missions }` |
| Mission — statut, priorité | `mission.status`, `.priority` | idem |
| Mission — progression | `mission.currentStepIndex`, `.steps[]` | idem |
| Mission — étapes et erreurs | `mission.steps[].status`, `.error` | idem |
| Contexte courant | `mission.executionContext` | idem |
| Context Diff | `mission.contextLog[]` (`version`, `timestamp`, `updatedBy`, `note`, `patch`) | idem |
| Résultats | `mission.result` (`summary`, `success`, `modifiedFiles`, `reports`, `errors`, `artifacts`, `metrics`) | idem |
| Historique de statut mission | `mission.statusHistory[]` | `GET /api/missions/:id/context` |
| Audit | `event.type`, `.timestamp`, `.actor`, `.missionId`, `.stepId`, `.data` | `GET /api/audit` |
| Conversation agent | `conversation.messages[]` | `GET /api/subagents/:id/conversation` |
| Envoi message | `{ prompt }` | `POST /api/subagents/:id/chat` |
| Affectation | `{ missionId, assignedBy }` | `POST /api/subagents/:id/assign` |
| Désaffectation | `{ reason }` | `POST /api/subagents/:id/unassign` |
| Exécution | `{}` | `POST /api/subagents/:id/run` |
| Création agent | `{ name, role, specialty, instructions, missionId? }` | `POST /api/subagents` |
| Mode READ-ONLY | `RAQIB_READ_ONLY_MODE` exposé par le statut runtime | `GET /api/status` (à confirmer côté payload) |

### 5.1 Champs explicitement indisponibles

Ces informations **ne doivent pas** être affichées ni simulées :

- relations agent↔agent (aucune arête runtime) → pas de constellation par défaut ;
- coût / tokens par agent (le budget est au niveau mission) ;
- ETA de fin de mission ;
- diff textuel ligne-à-ligne du contexte avec justification métier ;
- streaming temps réel des messages (l'endpoint est requête/réponse) ;
- notifications push d'un agent vers l'opérateur ;
- métriques de performance par agent.

---

## 6. Premier incrément implémentable

**Périmètre :** `Mixer + Agent Stage + sélection clavier + Audit Timeline`, avec les données existantes.

### 6.1 Fichiers à créer / modifier

| Fichier | Travail |
|---|---|
| `apps/dashboard/src/app/agents/page.tsx` | Remplacer la grille de cartes par le layout 3 colonnes `.st` + rails + stage Mixer. Conserver le formulaire de création replié. |
| `apps/dashboard/src/app/agents/[id]/page.tsx` | Devenir le rendu `AGENT STAGE` (ou rediriger vers `/agents?agent=<id>` pour garder un seul écran). Conserver le chat dans l'onglet Intercom. |
| `apps/dashboard/src/components/agents/AgentRegistry.tsx` | Rail gauche : recherche, filtres, lignes. |
| `apps/dashboard/src/components/agents/AgentMixer.tsx` | Table de voies agent. |
| `apps/dashboard/src/components/agents/AgentStage.tsx` | Stage détaillé (mission, étapes, contexte, résultats, historique). |
| `apps/dashboard/src/components/agents/IntelligencePanel.tsx` | Onglets Context / Results / Intercom. |
| `apps/dashboard/src/components/agents/AuditTimeline.tsx` | Bandeau bas 5 événements. |
| `apps/dashboard/src/components/agents/useAgentsConsole.ts` | Chargement, jointure agents×missions, polling, sélection, actions. |
| `apps/dashboard/src/app/globals.css` | Ajouter uniquement les classes spécifiques (`.mixer-row`, `.mixer-grid`, `.stage-head`, `.ctx-diff`, `.audit-strip`) en réutilisant les variables existantes. |

### 6.2 Ordre de livraison

1. Hook de données + jointure + polling.
2. Agent Registry (recherche, filtres, sélection).
3. Mixer (colonnes, tri, états vides).
4. Agent Stage (mission, étapes, contexte, résultats).
5. Intelligence Panel (Context Diff, Results, Intercom).
6. Audit Timeline.
7. Raccourcis clavier.
8. READ-ONLY et erreurs.
9. Build, typecheck, tests, captures.

### 6.3 Critères d'acceptation

- [ ] `/agents` affiche une ligne par agent avec état, mission, priorité, progression, alerte, dernier événement.
- [ ] La sélection au clavier (`↑/↓`, `Entrée`, `Échap`) fonctionne sans souris.
- [ ] `DEEP INSPECT` remplace le stage central sans déplacer les rails.
- [ ] Le Context Diff affiche les versions `contextLog` avec auteur/date/note, sans inventer de contenu.
- [ ] La conversation agent est visuellement et fonctionnellement distincte du chat RAQIB.
- [ ] Les actions mutantes sont désactivées en READ-ONLY avec une raison visible.
- [ ] Une mission `BLOCKED` affiche son erreur dans le Mixer, le stage et la timeline.
- [ ] Le polling ne perd ni la sélection ni le brouillon de message.
- [ ] `next build` passe ; les tests existants restent verts ; aucune donnée de démonstration n'est codée en dur.
- [ ] Captures fournies : Mixer, Agent Stage, Context Diff, Intercom, READ-ONLY.

### 6.4 Reporté explicitement

- Constellation / graphe relationnel.
- Diff textuel enrichi au-delà des patchs disponibles.
- Animations avancées, parallaxe, transitions de vues.
- Automatisation d'affectation ou d'exécution.
- Intercom avancé (streaming, pièces jointes, mentions, notifications).
- Exécution multi-agents parallèle pilotée depuis l'écran.

---

## 7. Anti-patterns interdits

1. **Ne pas simuler** un agent, une mission, une progression ou un événement pour « remplir » l'écran.
2. **Ne pas dupliquer** le chat RAQIB dans l'intercom, ni partager le même `conversationId`.
3. **Ne pas afficher** un succès quand la mission est `VERIFYING` : le sous-agent remonte, le coordinateur valide.
4. **Ne pas masquer** une erreur de politique derrière un état générique : afficher le message runtime.
5. **Ne pas transformer** le Mixer en tableau de bord décoratif : chaque colonne doit déclencher une décision opérateur.
6. **Ne pas créer** un second modèle d'agent ou de mission côté dashboard.

---

## 8. Références

- `packages/core/src/Mission.ts` — modèle Mission, contexte, résultats, historique.
- `packages/mission-engine/src/MissionEngine.ts` — affectation, contexte append-only, résultats.
- `packages/mission-engine/src/SubagentManager.ts` — état supervisé, historique, exécution.
- `services/runtime/src/ConversationStore.ts` — isolation `scope=agent`.
- `services/runtime/src/api/server.ts` — endpoints.
- `apps/dashboard/src/app/page.tsx` — grammaire visuelle de référence.
- `apps/dashboard/src/app/globals.css` — variables, `.st`, `.rail`, `.p`, `.fi`, `.feed`, `.bf`.
- `tests/runtime/conversations-subagents.spec.ts` — preuves d'affectation, contexte, isolation, persistance, READ-ONLY.
- `test-results/orchestration-demo.json` — parcours API complet.
