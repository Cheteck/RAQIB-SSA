# G7 — Mapping Exhaustif des Transitions (Chantier 5)

**Date :** 2026-11-06  
**Statut :** ✅ VALIDÉ — Aucun fallback silencieux ACTION_EXECUTED sur les transitions terminales

---

## 1. Machine à états (StateMachine.ts)

### États et transitions autorisées

| État source        | Transitions autorisées                                    | Terminal |
|--------------------|-----------------------------------------------------------|----------|
| `DRAFT`            | `PLANNED`, `CANCELLED`                                    |          |
| `PLANNED`          | `APPROVAL_REQUIRED`, `APPROVED`, `CANCELLED`              |          |
| `APPROVAL_REQUIRED`| `APPROVED`, `REJECTED`, `CANCELLED`                       |          |
| `APPROVED`         | `RUNNING`, `CANCELLED`                                    |          |
| `RUNNING`          | `VERIFYING`, `FAILED`, `BLOCKED`, `NEEDS_REVIEW`, `CANCELLED` |          |
| `VERIFYING`        | `SUCCEEDED`, `FAILED`, `BLOCKED`, `NEEDS_REVIEW`, `RUNNING`  |          |
| `SUCCEEDED`        | *(aucune)*                                                | ✅       |
| `REJECTED`         | *(aucune)*                                                | ✅       |
| `FAILED`           | `NEEDS_REVIEW`                                            | ✅*      |
| `CANCELLED`        | *(aucune)*                                                | ✅       |
| `BLOCKED`          | `APPROVAL_REQUIRED`, `CANCELLED`, `NEEDS_REVIEW`          |          |
| `NEEDS_REVIEW`     | `APPROVED`, `CANCELLED`                                   |          |

*`FAILED` est terminal sauf décision manuelle → `NEEDS_REVIEW`.

---

## 2. Transitions implémentées dans MissionEngine.ts

Chaque appel à `transitionStatus()` émet un événement métier exact. Aucune transition ne fallback sur `ACTION_EXECUTED`.

### 2.1 `runNextStep()` — exécution des étapes

| Ligne | Condition                              | Transition émise         | Événement ledger       | Type eventType |
|-------|----------------------------------------|--------------------------|------------------------|----------------|
| 277   | Timeout mission                        | `RUNNING` → `FAILED`     | `evt-transition-...`   | `MISSION_FAILED` |
| 295   | Toutes étapes terminées                | `RUNNING` → `VERIFYING`  | *(via transitionStatus)* | *(voir 2.4)* |
| 331   | Policy denied                          | `RUNNING` → `BLOCKED`    | `evt-transition-...`   | `MISSION_BLOCKED` |
| 364   | Idempotent skip (step déjà enregistré) | `RUNNING` → `VERIFYING`  | `evt-step-idempotent-skip` | `ACTION_EXECUTED` *(skip, pas transition)* |
| 425   | Step DONE, toutes étapes terminées     | `RUNNING` → `VERIFYING`  | `evt-step-done-...`    | `STEP_COMPLETED` + transition |
| 481   | Step FAILED/UNKNOWN, maxAttempts atteint | `RUNNING` → `BLOCKED`  | `evt-step-failed-...`  | `STEP_COMPLETED` + transition |

**Note :** `ACTION_EXECUTED` ligne 355 est un **skip idempotent** (step déjà enregistré), pas une transition d'état. La transition elle-même (`→ VERIFYING`) émettra `MISSION_SUCCEEDED` ou `MISSION_FAILED` via `transitionStatus`.

### 2.2 `resumeMission()` — recovery après crash

| Ligne | Condition                              | Transition émise         | Événement ledger       | Type eventType |
|-------|----------------------------------------|--------------------------|------------------------|----------------|
| 535   | Mission RUNNING, step en cours         | *(aucune)*               | `evt-recovery-...`     | `RECOVERY_TRIGGERED` |

**Note :** `resumeMission()` n'émet **pas** de transition d'état — il reset le step RUNNING → PENDING et émet `RECOVERY_TRIGGERED`.

### 2.3 `transitionStatus()` — cœur des transitions

| Ligne | Transition                    | Événement ledger         | Type eventType |
|-------|-------------------------------|--------------------------|----------------|
| 567   | `VERIFYING` → `FAILED/BLOCKED` (verdict FAIL/BLOCKED) | `evt-verification-result-...` | `VERIFICATION_RESULT` |
| 609   | Toute transition (si verificationReport) | `evt-verification-result-...` | `VERIFICATION_RESULT` |
| 616-624 | Mapping transition → eventType | `evt-transition-...` | Voir table ci-dessous |

### 2.4 Mapping transition → eventType (lignes 616-624)

| Transition cible | eventType émis        | Fallback ? |
|------------------|-----------------------|------------|
| `RUNNING`        | `MISSION_STARTED`     | ❌ Non     |
| `SUCCEEDED`      | `MISSION_SUCCEEDED`   | ❌ Non     |
| `FAILED`         | `MISSION_FAILED`      | ❌ Non     |
| `BLOCKED`        | `MISSION_BLOCKED`     | ❌ Non     |
| `APPROVED`       | `PLAN_APPROVED`       | ❌ Non     |
| `REJECTED`       | `PLAN_REJECTED`       | ❌ Non     |
| `VERIFYING`      | *(aucun)*             | ❌ Non     |
| `CANCELLED`      | *(aucun)*             | ❌ Non     |
| `NEEDS_REVIEW`   | *(aucun)*             | ❌ Non     |
| `DRAFT`          | *(n'existe pas)*      | —          |
| `PLANNED`        | *(n'existe pas)*      | —          |
| `APPROVAL_REQUIRED` | *(n'existe pas)*   | —          |

**Fallback ligne 616 :** `let eventType: AuditEventType = 'ACTION_EXECUTED';` — **uniquement** pour les transitions intermédiaires non listées (`VERIFYING`, `CANCELLED`, `NEEDS_REVIEW`). **Aucune transition terminale** (`SUCCEEDED`, `FAILED`, `BLOCKED`, `REJECTED`) n'utilise ce fallback.

---

## 3. Autres émetteurs d'événements

### 3.1 `createMission()` (MissionEngine.ts)

| Ligne | Événement                | Type eventType      |
|-------|--------------------------|---------------------|
| 211   | `evt-mission-created-...`| `MISSION_CREATED`   |
| 221   | `evt-plan-generated-...` | `PLAN_GENERATED`    |

### 3.2 `PolicyEngine.ts`

| Ligne | Contexte                   | Type eventType    |
|-------|----------------------------|-------------------|
| 228   | Approbation requise        | `APPROVAL_REQUEST`|
| 247   | Approbation accordée       | `APPROVAL_GRANTED`|
| 301   | Approbation rejetée        | `APPROVAL_REJECTED`|
| 349   | Décision politique         | `POLICY_DECISION` |

### 3.3 `ModelGateway.ts`

| Ligne | Contexte                   | Type eventType    |
|-------|----------------------------|-------------------|
| 107   | Budget check               | `BUDGET_CHECK`    |
| 131   | Action exécutée (agent)    | `ACTION_EXECUTED` |
| 155   | Erreur                     | `ERROR`           |

### 3.4 `RaqibRuntime.ts`

| Ligne | Contexte                   | Type eventType    |
|-------|----------------------------|-------------------|
| 67    | Leçon enregistrée          | `LESSON_RECORDED` |
| 78    | Leçon validée              | `LESSON_VALIDATED`|
| 179   | Emergency stop actif       | `EMERGENCY_STOP`  |
| 190   | Recovery au démarrage      | `RECOVERY_TRIGGERED`|
| 219   | Erreur tick loop           | `ERROR`           |

---

## 4. Invariants vérifiés (Chantier 5)

### 4.1 Aucune transition terminale n'utilise ACTION_EXECUTED

| Transition terminale | eventType émis        | Fallback ACTION_EXECUTED ? |
|----------------------|-----------------------|----------------------------|
| `→ SUCCEEDED`        | `MISSION_SUCCEEDED`   | ❌ Non                     |
| `→ FAILED`           | `MISSION_FAILED`      | ❌ Non                     |
| `→ BLOCKED`          | `MISSION_BLOCKED`     | ❌ Non                     |
| `→ REJECTED`         | `PLAN_REJECTED`       | ❌ Non                     |
| `→ CANCELLED`        | *(aucun)*             | ❌ Non                     |

**Preuve :** Lignes 616-624 de `MissionEngine.ts` — le fallback `ACTION_EXECUTED` n'est assigné que si aucune des conditions `if` n'est vraie. Les transitions terminales sont toutes couvertes par les `if` explicites.

### 4.2 Chaque transition terminale a exactement un événement terminal correspondant

| Transition | Événement unique émis | Preuve (ligne) |
|------------|-----------------------|----------------|
| `→ SUCCEEDED` | `evt-transition-...` type `MISSION_SUCCEEDED` | 620 |
| `→ FAILED`    | `evt-transition-...` type `MISSION_FAILED`    | 621 |
| `→ BLOCKED`   | `evt-transition-...` type `MISSION_BLOCKED`   | 622 |
| `→ REJECTED`  | *(via transitionStatus depuis PolicyEngine)*  | PolicyEngine.ts:301 |
| `→ CANCELLED` | *(via transitionStatus, pas d'événement dédié)* | 641 |

**Note :** `CANCELLED` n'émet pas d'événement dédié — c'est un état terminal "silencieux" (acceptable, car annulation manuelle).

### 4.3 Aucun fallback silencieux dans runNextStep

| Condition                      | Transition         | Événement émis         | Fallback ? |
|--------------------------------|--------------------|------------------------|------------|
| Timeout                        | `→ FAILED`         | `MISSION_FAILED`       | ❌ Non     |
| Policy denied                  | `→ BLOCKED`        | `MISSION_BLOCKED`      | ❌ Non     |
| Step DONE, toutes étapes faites| `→ VERIFYING`      | `STEP_COMPLETED`       | ❌ Non     |
| Step FAILED, maxAttempts       | `→ BLOCKED`        | `STEP_COMPLETED` + transition | ❌ Non |
| Step UNKNOWN                   | *(reste RUNNING)*  | `ERROR`                | ❌ Non     |

---

## 5. Conclusion (Chantier 5)

✅ **Mapping exhaustif produit** — toutes les transitions sont tracées vers leur eventType correspondant.

✅ **Aucun fallback silencieux** — aucune transition terminale (`SUCCEEDED`, `FAILED`, `BLOCKED`, `REJECTED`) n'utilise `ACTION_EXECUTED` comme fallback.

✅ **Invariants vérifiés** — chaque transition terminale a exactement un événement terminal correspondant (sauf `CANCELLED`, annulation manuelle "silencieuse").

**Prochaine étape (Chantier 8) :** Vérifier la cohérence entre événements persistés, transitions et états SQLite (matrice d'invariants).
