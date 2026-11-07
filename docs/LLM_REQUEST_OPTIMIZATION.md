# Optimisation de l'utilisation des requêtes LLM — RAQIB

> Analyse mesurée, pas estimée à vue. Chaque chiffre de ce document est produit par
> `scripts/llm-context-audit.ts`, qui n'appelle aucun provider : il mesure uniquement
> ce que RAQIB assemble **avant** d'envoyer une requête.

```powershell
npx tsx scripts/llm-context-audit.ts
```

---

## 1. Le chemin réel d'une requête

```
Dashboard ──POST /api/chat──► server.ts
                              │
                              ├─ ConversationStore.getMessages(id, 40)      ← historique
                              ├─ RaqibRuntime.getChatSnapshot(missionId)     ← état runtime
                              ├─ buildSystemContext(snapshot)                ← texte système
                              ├─ ContextEngine.getMetrics([])                ← budget
                              ├─ buildChatMessages({...})                    ← assemblage
                              └─ ModelGateway.complete({ taskType: 'default' })
                                       │
                                       ├─ getProviderForTask('default')        → freellmapi
                                       ├─ checkBudget(missionId, 0.01)         → PolicyEngine
                                       ├─ filterSensitiveData()                → regex
                                       └─ OpenAICompatibleAdapter.complete()   → HTTP POST
                                                (maxRetries 2, backoff 2s/4s, timeout 90s)
```

Références : `services/runtime/src/api/server.ts:363-445` (chat principal),
`:573-656` (chat sous-agent), `services/runtime/src/chat/chatContext.ts:217` et `:275`,
`packages/model-gateway/src/index.ts:85-162`,
`packages/model-gateway/src/adapters/openai-compatible.ts:37-102`.

---

## 2. Constats mesurés

### 2.1 Budget de contexte : constant et faux

```
--- Budget du ContextEngine ---
{
  "totalBudget": 128000,
  "responseReserve": 4096,
  "availableTokens": 123904,
  "usedTokens": 0,
  "strategyApplied": "ESTIMATED_FALLBACK"
}
```

`availableTokens = 123 904` est **identique quel que soit le modèle réellement routé**.
Or `config/providers.json` route par défaut vers `freellmapi` (`model: "auto"`), un proxy
qui peut servir un modèle à 8 k de contexte. Le garde-fou ne protège donc que les
modèles à 128 k, jamais les petits.

Aggravant : `getMetrics([])` est appelé avec une liste de messages vide
(`server.ts:387`), donc `usedTokens` vaut toujours 0 et la métrique affichée ne décrit
pas la requête en cours.

### 2.2 Le contexte système croît, puis plafonne silencieusement

| Scénario | Tokens système | Caractères |
|---|---:|---:|
| 0 mission | 226 | 901 |
| 3 missions / 6 étapes | 394 | 1 575 |
| 10 missions / 8 étapes | 644 | 2 575 |
| 20 missions / 12 étapes | 1 015 | 4 059 |
| **50 missions / 12 étapes** | **1 015** | **4 059** |

Le plafond vient de `snapshot.missions.slice(0, 20)` (`chatContext.ts:235`). Au-delà de
20 missions, le LLM reçoit un état **tronqué sans le savoir** : il répond sur une vision
partielle du système, et rien dans le prompt ne l'indique. C'est un problème de
correction autant que de coût.

### 2.3 Une requête « normale » coûte 1 483 tokens, dont 73 % d'historique

```
--- Assemblage d'une requête type (3 missions, 40 messages) ---
{
  "systemTokens": 394,
  "historyIncluded": 40,
  "historyDropped": 0,
  "promptTokens": 9,
  "estimatedTotal": 1483,
  "maxContextTokens": 123904,
  "messagesSent": 42
}
```

**40 messages d'historique sont acceptés sans aucune sélection.** Le seul critère
d'éviction est le budget global (123 904), donc en pratique jamais atteint : la
troncature ne se déclenche pas. Les 40 derniers messages sont renvoyés intégralement,
même s'ils portent sur un sujet clos.

### 2.4 Croissance quadratique sur la durée d'une conversation

```
--- Projection tokens d’entrée cumulés (40 tours) ---
 tours │ tokens cumulés
───────┼────────────────
  1    │     430
  5    │   2 420
 10    │   5 515
 20    │  13 730
 40    │  38 260
```

Décomposition des 38 260 tokens :

| Poste | Tokens | Part |
|---|---:|---:|
| Historique re-transmis | 22 140 | 57,9 % |
| Contexte système re-transmis | 15 760 | 41,2 % |
| Prompt courant | 360 | 0,9 % |

Le prompt utile représente **moins de 1 %** de ce qui est facturé. Le reste est de la
redite : la même horloge, les mêmes statuts, les mêmes 40 messages, à chaque tour.

### 2.5 Le chat sous-agent est plus lourd que le chat principal

| Scénario sous-agent | Tokens système |
|---|---:|
| agent sans mission | 320 |
| mission + 3 fichiers + log 3 | 820 |
| mission + 20 fichiers + log 10 | **1 447** |
| mission + 40 fichiers + log 25 | **1 952** |

Sur 40 tours avec 20 fichiers et 10 entrées de journal : **80 380 tokens d'entrée
cumulés**, soit 2,1× le chat principal.

Cause : `getAgentChatSnapshot` renvoie `executionContext` (liste complète des fichiers,
instructions, contraintes, contexte hérité), `contextLog` complet et `mission.result`
à **chaque** appel (`chatContext.ts:125-170`). Ces blocs sont stables d'un tour à
l'autre et pourtant re-sérialisés à l'identique.

### 2.6 Les quatre leviers structurels sont absents

| Levier | État | Preuve |
|---|---|---|
| Prompt caching | absent | l'horodatage est en tête de prompt (`chatContext.ts:223`), donc le préfixe change à chaque seconde |
| Streaming | absent | `openai-compatible.ts:66-79` : `fetch` + `res.json()`, pas de `stream: true` |
| Routage par tâche | inutilisé | `taskType: 'default'` codé en dur (`server.ts:399` et `:620`) alors que `getProviderForTask` sait router (`model-gateway/src/index.ts:60-79`) |
| Tokenizer réel | absent | `estimateTokens = chars × 0.25` (`ContextEngine.ts`), `strategyApplied: ESTIMATED_FALLBACK` |

### 2.7 Le budget en euros n'est jamais débité

`estimatedCost = (maxTokens/1000) × 0.001`, soit **0,01 €** par défaut
(`model-gateway/src/index.ts:100`). Puis :

```
const costIn  = this.cfg.costPer1kInput  ?? 0;   // absent de config/providers.json
const costOut = this.cfg.costPer1kOutput ?? 0;   // absent de config/providers.json
```

Résultat : `response.cost.total = 0` à chaque appel, donc `deductBudget(missionId, 0)`.
La table `budgets.used_eur` reste à 0 : le PolicyEngine autorise indéfiniment.
`BUDGET-002` ne peut jamais se déclencher en pratique.

### 2.8 Les retries renvoient tout le prompt

`maxRetries: 2` (`config/providers.json:13`) avec backoff 2 s puis 4 s, et chaque
tentative renvoie **l'intégralité** des messages (`model-gateway/src/index.ts:119-149`).
Un provider lent mais qui répond au 3ᵉ essai coûte 3× le prompt. Aucune distinction
entre erreur réseau (retry utile) et 4xx de validation (retry inutile).

### 2.9 `/api/models/health` consomme de vrais tokens

`checkProvider` envoie une complétion réelle (`messages: [ping]`, `maxTokens: 1`,
timeout 5 s) par provider (`model-gateway/src/index.ts:198-218`). Le dashboard l'appelle
toutes les 30 s (`apps/dashboard/src/components/HUDDock.tsx:86`) et au chargement de la
page principale (`apps/dashboard/src/app/page.tsx:409`). C'est petit, mais ce n'est pas
gratuit et ce n'est pas un health-check.

---

## 3. Stratégies d'optimisation

### S1 — Stabiliser le préfixe pour le prompt caching (impact le plus fort)

**Problème** : l'horodatage et les compteurs volatils sont en tête du prompt système,
donc aucun préfixe n'est jamais réutilisable.

**Correctif** : ordonner le prompt du plus stable au plus volatil.

```
[STATIQUE]  identité, règles, politique, format de réponse attendu
[STABLE]    missions (ids, noms, objectifs) — change rarement
[VOLATIL]   horodatage, compteurs, 5 derniers événements, progression
```

Concrètement : déplacer `Horodatage` et les événements d'audit **en fin** de
`buildSystemContext` / `buildAgentSystemContext`, et sortir l'horodatage du bloc
système pour le mettre dans le dernier message utilisateur.

**Gain attendu** : sur un provider supportant le cache de préfixe, la partie statique
(≈ 60 % du système) est facturée au tarif cache. Sur 40 tours : de l'ordre de
**−20 à −30 %** de tokens d'entrée facturés. À vérifier provider par provider : tous ne
pratiquent pas le cache.

**Coût** : faible (réordonnancement de chaînes, aucun changement d'API).

### S2 — Fenêtre glissante + résumé de conversation

**Problème** : 40 messages intégraux, 57,9 % du coût.

**Correctif** : garder les 8 derniers messages verbatim, résumer les précédents en un
bloc de 150–200 tokens, et réécrire le résumé tous les 4 tours (pas à chaque tour).

**Gain attendu** : sur 40 tours, l'historique passe de 22 140 à ≈ 5 500 tokens, soit
**−40 %** du total cumulé. Le résumé doit rester déterministe et auditable (il est
persisté dans `ConversationStore`, pas recalculé en silence).

**Coût** : moyen (une colonne `summary` + un job de compaction).

### S3 — Budget de contexte par modèle réel

**Problème** : 123 904 tokens annoncés quel que soit le modèle.

**Correctif** : déclarer `contextWindow` par modèle dans `config/providers.json`, et
faire `ContextEngine` dépendre du modèle résolu, pas d'une constante. Ajouter un
avertissement explicite dans le prompt quand la liste est tronquée :

```
[ATTENTION] Seules 20 missions sur 50 sont incluses. Ne pas conclure sur les absentes.
```

**Gain** : évite les erreurs de raisonnement sur état partiel, et empêche l'envoi d'un
prompt trop long à un modèle 8 k (qui échoue ou tronque côté provider).

**Coût** : faible à moyen.

### S4 — Routage par type de tâche

**Problème** : tout passe par `taskType: 'default'`.

**Correctif** : classer la demande avant l'appel.

| Tâche | Route | Justification |
|---|---|---|
| `status_query`, `list`, `filter` | modèle local / petit | réponse factuelle, contexte court |
| `summary`, `reformulation` | modèle milieu | tolérant aux approximations |
| `approval_analysis`, `risk_review` | modèle fort | conséquence irréversible |

**Gain** : baisse du coût unitaire et de la latence sur la majorité des tours, sans
dégrader les décisions sensibles.

**Coût** : moyen (classifieur + table de routage). Le classifieur peut être déterministe
(mots-clés) avant d'être un modèle.

### S5 — Sérialisation compacte du contexte

**Problème** : le contexte est en prose, avec des titres et des libellés répétés.

**Correctif** : passer les structures à un format compact (une ligne par entité,
séparateur stable), et ne pas répéter les champs vides.

**Gain mesuré à vérifier** : 15–25 % sur le bloc système, sans perte d'information.

**Coût** : faible, mais nécessite des tests de non-régression sur les réponses.

### S6 — Idempotence des appels et cache de réponse

**Problème** : deux clics sur « résumé » produisent deux appels identiques.

**Correctif** : clé `hash(prompt normalisé + version de contexte)` → réponse cachée
avec TTL court (60 s). Invalider dès qu'un événement d'audit change l'état.

**Gain** : variable, mais élimine les doublons UI, qui sont la première source de
gaspillage en usage réel.

**Coût** : faible.

### S7 — Politique de retry consciente de l'erreur

**Problème** : 3 tentatives pour tout, y compris les 4xx.

**Correctif** : ne retenter que sur `429`, `5xx`, timeout et erreur réseau ; jamais sur
`400`, `401`, `403`, `422`. Backoff avec jitter. Annuler la requête précédente si
l'utilisateur en envoie une nouvelle.

**Gain** : supprime les multiplications ×2 et ×3 sur les erreurs définitives.

**Coût** : faible (une quinzaine de lignes dans `ModelGateway.complete`).

### S8 — Coûts réels et budget effectif

**Problème** : `costPer1kInput/Output` à 0, budget jamais débité.

**Correctif** : renseigner les tarifs par provider (0 pour un proxy local, tarif réel
sinon), calculer sur les `usage` retournés, et **refuser** l'appel si le budget estimé
dépasse le reste. Journaliser `tokens_in`, `tokens_out`, `cost` par requête.

**Gain** : rend `BUDGET-002` opérationnel ; sans cela, tout le discours sur les budgets
est décoratif.

**Coût** : faible.

### S9 — Health-check sans complétion

**Problème** : `/api/models/health` fait une vraie génération.

**Correctif** : `GET /models` du provider, ou ping TCP/HTTP sur `baseUrl`, avec un
timeout de 1 s. Réserver la complétion à un test explicite déclenché par l'opérateur.

**Coût** : faible.

---

## 4. Priorisation arbitrée avec ChatGPT-web

Arbitrage rendu (conversation `3d544508-6e2a-406b-82d8-f5a2aec90d54`) :

| Priorité | Levier | Justification donnée |
|---|---|---|
| **P0** | S3 budget par modèle | protection réelle contre le dépassement |
| **P0** | S8 coûts réels | sans tarif, la protection est fictive |
| **P0** | S7 retry ciblé | supprime les multiplications ×2/×3 |
| **P0** | S2 fenêtre + résumé | empêche la croissance cumulative |
| **P1** | S1 préfixe stable | cache, gain conditionnel au provider |
| **P1** | S5 sérialisation compacte | réduction des tokens de sérialisation |
| **P1** | S9 health-check sans complétion | supprime la conso de fond |
| **P2** | S4 routage par tâche | utile mais secondaire |
| **P2** | S6 cache de réponse | **conditionnel** : uniquement requêtes réellement idempotentes |

Aucun levier supprimé. En revanche, deux choses à supprimer purement et simplement :
le retry sur les 4xx, et le health-check par complétion.

Ordre d'exécution du CTA : **S3 → S8 → S7 → S2**, avec tests de non-régression avant
déploiement.

### État d'implémentation

| Levier | État | Preuve |
|---|---|---|
| S3 (correction de troncature) | **fait** — avertissement explicite dans le prompt | `chatContext.ts:242` + 2 tests |
| S8 (coût estimé réel) | **partiel** — estimation calculée sur la taille réelle du prompt, plancher 0,01 € si le provider n'a pas de tarif | `model-gateway/src/index.ts:164-183` |
| S7 (retry ciblé) | **fait** — 400/401/403/404/422 jamais rejoués, statut HTTP propagé par les adaptateurs | `model-gateway/src/retry.ts` + 4 tests |
| S2 (fenêtre + résumé) | **à faire** — conception arrêtée (extractif déterministe) | — |
| S1, S5, S9 | à faire (P1) | — |
| S4, S6 | à faire (P2) | — |

`config/providers.json` déclare désormais `costPer1kInput` / `costPer1kOutput` à 0 pour
les providers gratuits. Tant qu'un tarif réel n'est pas renseigné, `estimatedCost`
retombe sur le plancher conservateur et **le budget en euros reste un garde-fou, pas une
comptabilité** : c'est exactement le point soulevé par l'arbitrage.

Écarts assumés par rapport à ma première proposition :

- je plaçais S1 en P0 ; l'arbitrage le rétrograde en P1, car son gain dépend d'un cache
  de préfixe que le provider par défaut n'expose pas forcément ;
- je plaçais S7 en P0 également, ce qui est confirmé ;
- S3 passe devant S8 : la correction (ne pas raisonner sur un état tronqué) prime sur
  la comptabilité.

---

## 5. Décisions figées

| Question | Décision | Critère |
|---|---|---|
| Résumé de conversation (S2) | **extractif déterministe** en première intention | ce qui doit être conservé exactement pour décider ne dépend jamais d'un résumé génératif |
| Classifieur de routage (S4) | **déterministe par règles et mots-clés** | latence, coût, testabilité, routage explicable |
| Catégorie inconnue | routée vers le modèle généraliste | ne jamais laisser un mot-clé isolé déclencher une opération sensible |

---

## 6. Risque de correction prioritaire

**Le plafond silencieux de 20 missions.** Le modèle peut prendre une décision sur un
ensemble incomplet sans savoir qu'il lui manque des missions. C'est un défaut de
correction fonctionnelle, pas seulement de consommation. Second risque : `usedTokens = 0`
et budget à 0 rendent les protections financières fictives.

---

## 7. Piège non listé initialement : les doublons d'exécution

Les retries créent des **courses concurrentes et des effets de bord**. Une mission peut
être exécutée deux fois si le fournisseur a traité la requête alors que le client a subi
un timeout. Correctif : clé d'idempotence, identifiant d'exécution unique, journalisation
des tentatives. C'est à traiter avec S7, pas après.

### S10 — Idempotence des exécutions

- clé d'idempotence par couple `(missionId, stepId, tentative logique)` ;
- identifiant d'exécution propagé jusqu'au journal d'audit ;
- avant de rejouer une étape, vérifier dans l'`AuditLedger` qu'elle n'a pas déjà abouti ;
- journaliser `attempt`, `provider`, `latencyMs`, `outcome` par requête.

---

## 8. Instrumentation demandée

À mesurer séparément, avant et après :

1. tokens réels entrée/sortie par fournisseur (`usage.prompt_tokens` / `completion_tokens`) ;
2. taille du contexte avant et après troncature ;
3. coût réel par mission ;
4. nombre de retries et doublons d'exécution détectés.

Tant que (1) n'est pas en place, tous les gains annoncés restent des estimations
`chars / 4`. C'est le premier prérequis de mesure.

---

## 9. Ce que je ne recommande pas

- **Réduire `max_tokens` globalement** : cela coupe les réponses longues légitimes sans
  toucher au problème (l'entrée, pas la sortie).
- **Passer tous les appels en streaming** : le streaming améliore la latence perçue,
  pas le coût. À faire pour l'UX, pas pour l'optimisation.
- **Supprimer l'historique** : la qualité conversationnelle s'effondre. La fenêtre
  glissante + résumé (S2) est la bonne réponse.
- **Compter sur le cache du provider sans réordonner le prompt** : le cache est un
  préfixe exact ; un horodatage en tête l'annule à chaque seconde.

---

## 10. Question restante (non tranchée)

Le provider réellement utilisé en production (`freellmapi`, proxy local) expose-t-il un
cache de préfixe ? Si non, S1 perd son intérêt et reste en P1 voire descend en P2. À
vérifier avant d'investir dans S1.

Quelle est la fenêtre de contexte **minimale garantie** parmi les modèles routés ? C'est
elle qui doit fixer le budget (S3), pas 128 k.
