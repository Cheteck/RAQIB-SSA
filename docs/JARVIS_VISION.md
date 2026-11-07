# Vision JARVIS pour RAQIB — arbitrage et capacités retenues

> Ce document applique l'arbitrage rendu sur l'audit `docs/PLACEHOLDER_AUDIT.md`.
> Il ne crée aucune fonctionnalité : il fixe ce qui est **autorisé à être
> construit** et sur quel composant existant chaque capacité se branche.
> Règle transverse : aucune capacité ne doit introduire une nouvelle simulation.

Date : 2026-11-06

---

## 1. Principe directeur

JARVIS (MCU) fait trois choses que RAQIB ne fait pas :

1. il agit dans le monde via des effecteurs à permissions contextuelles ;
2. il anticipe et propose sans qu'on le lui demande ;
3. il rend l'état du système perceptible en une seconde (voix, interruption).

L'arbitrage retient **un seul axe immédiat** : l'anticipation. Les effecteurs
autonomes sont refusés tant que les fondations d'exécution ne sont pas fiables
(F-01, F-03, F-07b). Un système qui agit vite mais invente ses résultats est
plus dangereux qu'un système qui refuse d'agir.

---

## 2. Ce qui ne doit pas être copié

**L'autonomie spectaculaire.** JARVIS décide, engage des ressources et se
justifie après. RAQIB doit rester : traçable, consenti, à permissions explicites.

Conséquence concrète : aucune capacité ci-dessous ne peut, seule, faire passer
une mission d'un état à un autre. Toute transition reste soumise au
`PolicyEngine` et au `AuditLedger`.

---

## 3. Les trois capacités retenues

### C-1 — Détection proactive des anomalies

- **Ce qu'elle fait** : signale une incohérence entre l'état revendiqué et
  l'état observé (ex. mission `SUCCEEDED` sans preuve, skill qui répond
  `clean` sur un dépôt sale, budget dépassé non audité).
- **Branchement existant** : `MissionEngine` (transitions et états) +
  `AuditLedger` (source des événements).
- **Risque de dérive** : inventer des anomalies à partir de données
  incomplètes. **Garde-fou** : une anomalie sans identifiant d'événement source
  n'est pas affichée. Pas d'événement ⇒ pas d'anomalie, jamais « suspicion ».
- **Statut** : le contrat `packages/shared/src/evidence.ts` fournit déjà le
  prédicat objectif (`evaluateSuccessClaim`) sur lequel s'appuyer.

### C-2 — Conseiller de prochaine action

- **Ce qu'elle fait** : propose la prochaine étape utile (mission à relancer,
  approbation en attente, finding à traiter) sans l'exécuter.
- **Branchement existant** : `SubagentManager` (connaissance de l'état des
  agents et des missions) + `PolicyEngine` (ce qui serait autorisé).
- **Risque de dérive** : présenter une recommandation comme une action
  exécutée. **Garde-fou** : deux objets distincts dans l'API et l'UI —
  `PROPOSAL` (lecture seule, sans effet) et `EXECUTION` (soumise à approbation).
  Une proposition ne peut jamais Transitionner une mission.
- **Statut** : aucun code spécifique ; réutilise les statuts existants.

### C-3 — HUD vocal contextuel

- **Ce qu'elle fait** : rendre l'état perceptible à la voix (« trois missions
  bloquées, une approbation en attente »), sans action implicite.
- **Branchement existant** : spécification vocale déjà écrite + `SkillsRegistry`
  (les skills `READ` sont interrogeables).
- **Risque de dérive** : une interprétation ambiguë déclenche une mutation.
  **Garde-fou** : la voix ne peut lire que des données, ou ouvrir une
  **confirmation explicite** ; toute demande d'action passe par le même chemin
  d'approbation que l'UI. Aucun skill `WRITE`/`EXECUTE` n'est appelable
  directement depuis la voix.
- **Statut** : dépend de FU-02 (application de `requiredPermission`) avant
  d'être sûre.

---

## 4. Séquence d'implémentation arbitrée

| Ordre | Action | Finding | Effort | Dépendance |
|---|---|---|---|---|
| 1 | Coding Engine fail-closed : aucun `completed` sans preuve | F-01, F-05 | 0,5 j | contrat de preuve ✅ |
| 2 | Vérification sans checks ⇒ `BLOCKED` | F-03 | 0,5 j | — |
| 3 | `git_status_check` réel via `GitTool` | F-02 | 0,5 j | — |
| 4 | `codebase_audit` réel ou retiré | F-08 | 0,5 j | — |
| 5 | Provider aligné sur `config/providers.json`, `tools` transmis | F-07, F-07b | 1 j | — |
| 6 | Boucle minimale planner → outil → patch → validation | F-01, F-04, F-06 | 3–5 j | 1, 5 |
| 7 | C-1 Détection proactive (événements sourcés) | — | 2 j | 1, 2 |
| 8 | C-2 Conseiller de prochaine action (PROPOSAL) | — | 2 j | 7 |
| 9 | C-3 HUD vocal en lecture + confirmation | FU-02 | 2 j | 8 |

**Règle d'arrêt** (boucle minimale) : aucune déclaration `completed` sans
changement vérifiable, ou sans `noChangeRequired` explicitement justifié.
Toute erreur, absence de preuve ou interruption ⇒ `BLOCKED`.

---

## 5. Invariant vérifiable en CI

`SUCCESS ⇒ preuve d'exécution + preuve de vérification`

- Contrat : `packages/shared/src/evidence.ts` (`evaluateSuccessClaim`,
  `assertProvenSuccess`).
- Verrou : `tests/governance/success-evidence-contract.spec.ts` — toute nouvelle
  surface qui revendique un succès sans preuve échoue ; les surfaces non
  conformes sont en quarantaine explicite, rattachée à un finding, et le test
  échoue dès qu'elles sont corrigées pour forcer la mise à jour.

Cet invariant précède l'intelligence proactive : il rend ses observations
fiables.
