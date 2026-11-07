# RAQIB FOUNDATION READINESS — Phase 1 Gate Document

**Statut :** En cours de validation – G7 en cours  
**Dernière mise à jour :** 2026-11-06  
**Objectif :** Définir les critères de sortie de la Phase 1, auditer l'observabilité (G7), consolider G6, et établir le Gate vers la Phase 2.

---

## 0. Principes Directeurs

1. **Aucune nouvelle architecture parallèle** — Réutiliser les 9 packages existants.
2. **Pas de microservices prématurés** — Monolithe modulaire (ADR 0001).
3. **Preuves dans le code + tests** — Aucune affirmation sans implémentation et suite de tests.
4. **Pas de refactoring massif sans justification** — Renforcer l'existant avant de remplacer.

---

## 1. Critères de Sortie par Gap (G1–G6)

Chaque gap doit passer de **NOT READY** → **READY WITH CONDITIONS** → **READY** avec :
- ✅ Critères d'acceptation vérifiables (code + tests positifs)
- ❌ Tests négatifs (refus explicites, échecs attendus)
- 📊 Métriques de couverture (lignes de code, branches, événements)

---

### G1 — VerificationEngine : Verdict PASS obligatoire pour SUCCEEDED

**Responsable :** `packages/verification`, `packages/mission-engine`

#### État Actuel
- `VerificationEngine.verifyMission()` retourne `VerificationReport { passed: boolean, results: VerificationResult[] }`
- `StateMachine.assertTransition()` mentionne `// → SUCCEEDED exige verdict PASS (contrôlé à l'appelant)` mais **ne l'impose pas**
- Aucun événement `VERIFICATION_RESULT` n'est journalisé dans `AuditLedger`

#### Critères d'Acceptation (READY)
1. **Contrat tri-état** : `VerificationVerdict = 'PASS' | 'FAIL' | 'BLOCKED'`
2. **Verrouillage** : `MissionEngine.transitionStatus(id, 'SUCCEEDED', reason, report)` **exige** `report.verdict === 'PASS'`
3. **Journalisation** : Événement `VERIFICATION_RESULT` émis avec :
   ```typescript
   {
     type: 'VERIFICATION_RESULT',
     missionId: string,
     data: {
       verdict: 'PASS' | 'FAIL' | 'BLOCKED',
       summary: string,
       results: VerificationResult[]
     }
   }
   ```
4. **Transition automatique** : Si verdict `FAIL` → `FAILED`, si `BLOCKED` → `BLOCKED`

#### Tests Requis
- ✅ **Positif** : Mission avec toutes preuves → `SUCCEEDED`
- ❌ **Négatif 1** : Preuve manquante → `FAILED` (non `SUCCEEDED`)
- ❌ **Négatif 2** : Incertitude critique (ressource inaccessible) → `BLOCKED`
- ❌ **Négatif 3** : Appel `transitionStatus('SUCCEEDED')` sans rapport → Exception

#### Statut : NOT READY

---

### G2 — MemoryEngine : Capitalisation qualifiée (Leçons)

**Responsable :** `packages/mission-engine/MemoryEngine.ts`

#### État Actuel
- `MemoryEngine` étendue avec `CapitalizedLesson` et schémas Zod.
- Méthodes `recordLesson`, `validateLesson`, `getLessons` implémentées.
- **Leçons :** Provenance `missionId` obligatoire, filtrage par confiance.

#### Critères d'Acceptation (READY)
1. ✅ **Modèle `CapitalizedLesson`** implémenté et validé par Zod.
2. ✅ **Méthode `recordLesson(lesson)`** : Stocke sous `namespace='lessons'`, `type='SEMANTIC'`.
3. ✅ **Filtrage** : `getLessons(minConfidence)` exclut les leçons < seuil ou expirées.
4. ✅ **Validation** : `validateLesson(id, score)` permet la validation humaine.

#### Tests Requis
- ✅ **Positif** : Leçon enregistrée avec provenance et score.
- ✅ **Négatif** : Leçon sans `missionId` → Rejetée (via Zod).
- ✅ **Négatif** : `confidenceScore < 0.5` → Non restituée par `getLessons()`.

#### Statut : READY

---

### G3 — DockerSandbox : Politique Fail Closed

**Responsable :** `packages/tool-gateway/DockerSandbox.ts`

#### État Actuel
- Mode `FALLBACK_LOCAL` activé si Docker indisponible (l. 63–71)
- Exécution `execAsync` sur l'hôte en fallback

#### Critères d'Acceptation (READY)
1. **Suppression de `FALLBACK_LOCAL`** pour les étapes `BUILD`, `TEST`, `EXECUTE`
2. **Exception bloquante** : `SandboxUnavailableError` si Docker requis et indisponible
3. **Isolation stricte** : `docker run --rm --network none -v <workspace>:/workspace`
4. **Whitelist de commandes** : Maintenir `allowedCmds` dans `executeCommand()`

#### Tests Requis
- ✅ **Positif** : Commande autorisée dans Docker → Succès
- ❌ **Négatif 1** : Docker indisponible + mission isolée → `BLOCKED` (non fallback)
- ❌ **Négatif 2** : Commande hors whitelist → Rejetée avant exécution

#### Statut : NOT READY

---

### G4 — Plan Approval : Artefact de mission lisible

**Responsable :** `packages/core`, `packages/mission-engine`, `services/runtime/api/server.ts`

#### État Actuel
- Approbation via `/api/missions/:id/transition` (status=`APPROVED`)
- Aucun artefact de plan structuré exigé

#### Critères d'Acceptation (READY)
1. **Modèle `MissionPlanArtifact`** :
   ```typescript
   interface MissionPlanArtifact {
     missionId: string;
     generatedAt: string;
     summary: string;
     scope: { targetFiles: string[]; allowedActions: ActionType[] };
     stepPlan: Array<{ stepIndex, name, type, riskLevel, expectedOutput }>;
     riskAnalysis: string[];
     successCriteria: string[];
     estimatedBudgetEur: number;
   }
   ```
2. **Génération automatique** : Lors de `createMission()` si `approvalRequired: true`
3. **Verrouillage API** : `/api/missions/:id/transition` → `APPROVED` refuse si artefact absent

#### Tests Requis
- ✅ **Positif** : Mission approuvée avec artefact valide
- ❌ **Négatif** : Transition `APPROVED` sans artefact → 400 Bad Request

#### Statut : NOT READY

---

### G6 — Recovery : Persistance, idempotence, opérations incertaines

**Responsable :** `packages/mission-engine/MissionEngine.ts`

#### État Actuel
- `idempotencyKey: string` et `executionRecorded: boolean` sur `MissionStep`
- `resumeMission()` remet à `PENDING` si `executionRecorded=false`
- SQLite WAL activé (l. 59), mais pas de `synchronous` ou `busy_timeout` explicites
- Statut d'étape : `PENDING | RUNNING | DONE | FAILED | SKIPPED` (pas de `UNKNOWN`)

#### Décisions d'Ingénierie (validées ChatGPT)
1. **SQLite WAL** : Ajouter `PRAGMA synchronous=FULL` et `PRAGMA busy_timeout=5000`
2. **Statut UNKNOWN** : Introduire pour opérations à résultat incertain (timeout, réseau coupé)
3. **VERIFICATION_RESULT** : Journaliser dans `MissionEngine.runNextStep()` après vérification

#### Critères d'Acceptation (READY)
1. **Durabilité** : `synchronous=FULL`, `busy_timeout=5000` sur toutes les connexions
2. **Idempotence** : Étape avec `executionRecorded=true` **jamais** ré-exécutée
3. **UNKNOWN** : Statut ajouté, réconciliation explicite au recovery (non rejoué automatiquement)
4. **Journalisation** : `RECOVERY_TRIGGERED`, `STEP_RESUMED`, `VERIFICATION_RESULT` dans AuditLedger

#### Tests Requis
- ✅ **Positif** : Crash après `executionRecorded=true` → Zéro ré-exécution
- ❌ **Négatif 1** : Crash avec `executionRecorded=false` → Ré-exécution unique
- ❌ **Négatif 2** : Timeout → statut `UNKNOWN`, non rejoué sans validation humaine
- ❌ **Négatif 3** : Multiple `resumeMission()` → Idempotent (aucun effet secondaire)

#### Statut : NOT READY

---

## 2. G7 — Mission Observability (Audit de l'existant)

**Question :** L'`AuditLedger` existant couvre-t-il intégralement le cycle de mission sans doublon ?

### Audit des Événements Actuels

Types définis dans `@raqib/shared/types.ts` :
```typescript
type AuditEventType =
  | 'MISSION_CREATED'          // ✅ Émis dans MissionEngine.createMission()
  | 'POLICY_DECISION'          // ✅ Émis dans MissionEngine.runNextStep()
  | 'ACTION_EXECUTED'          // ✅ Émis dans MissionEngine.runNextStep()
  | 'VERIFICATION_RESULT'      // ❌ NON ÉMIS (gap G1)
  | 'EMERGENCY_STOP'           // ✅ Émis via EmergencyStop
  | 'BUDGET_CHECK'             // ✅ Émis dans ModelGateway
  | 'ERROR'                    // ✅ Émis dans MissionEngine.runNextStep()
  | 'APPROVAL_REQUEST'         // ✅ Émis via PolicyEngine
  | 'APPROVAL_GRANTED'         // ✅ Émis via PolicyEngine
  | 'APPROVAL_REJECTED'        // ✅ Émis via PolicyEngine
  | 'AGENT_BEFORE_EXECUTION'   // ❓ NON UTILISÉ
  | 'AGENT_AFTER_EXECUTION';   // ❓ NON UTILISÉ
```

### Couverture du Cycle de Mission

| Phase du Cycle          | Événement Associé              | Statut          |
|-------------------------|--------------------------------|-----------------|
| Mission créée           | `MISSION_CREATED`              | ✅ Couvert      |
| Plan généré             | (aucun)                        | ❌ Non couvert  |
| Approbation demandée    | `APPROVAL_REQUEST`             | ✅ Couvert      |
| Approbation accordée    | `APPROVAL_GRANTED`             | ✅ Couvert      |
| Étape démarrée          | `ACTION_EXECUTED` (status)     | ✅ Couvert      |
| Étape terminée          | `ACTION_EXECUTED` (proof)      | ✅ Couvert      |
| Vérification            | `VERIFICATION_RESULT`          | ❌ Non émis     |
| Mission clôturée        | (aucun)                        | ❌ Non couvert  |
| Recovery triggered      | (aucun)                        | ❌ Non couvert  |
| Leçon capitalisée       | (aucun)                        | ❌ Non couvert  |

### Recommandation G7

**Ne pas créer de second ledger.** Étendre `AuditLedger` avec :
1. **Nouveaux événements** : `PLAN_GENERATED`, `MISSION_CLOSED`, `RECOVERY_TRIGGERED`, `LESSON_RECORDED`
2. **Corrélation** : Chaque événement doit avoir `mission_id`, `step_id?`, `event_id`, `timestamp`
3. **Export complet** : `AuditLedger.export(missionId)` doit restituer 100% du cycle

#### Statut : PARTIELLEMENT READY (extensions mineures requises)

---

## 3. Contrats Partagés entre Packages

| Interface                    | Fournisseur                | Consommateurs                     | Version |
|------------------------------|----------------------------|-----------------------------------|---------|
| `VerificationVerdict`        | `@raqib/shared/types.ts`   | `VerificationEngine`, `MissionEngine` | v1 (à créer) |
| `CapitalizedLesson`          | `@raqib/shared/types.ts`   | `MemoryEngine`, `MissionEngine`     | v1 (à créer) |
| `MissionPlanArtifact`        | `@raqib/core/Mission.ts`   | `MissionEngine`, `PolicyEngine`, API | v1 (à créer) |
| `StepType`                   | `@raqib/shared/types.ts`   | Tous (✅ déjà implémenté)          | v1 ✅   |
| `AuditEvent`                 | `@raqib/shared/types.ts`   | `AuditLedger`, tous les moteurs    | v1 ✅   |
| `PolicyDecision`             | `@raqib/shared/types.ts`   | `PolicyEngine`, `MissionEngine`    | v1 ✅   |
| `SandboxContext`             | `@raqib/tool-gateway`      | `RaqibRuntime`, step executors    | v1 ✅   |

---

## 4. Gate Phase 1 → Phase 2 : Suite de Tests E2E

**Objectif :** Démontrer que RAQIB peut exécuter une mission individuelle de bout en bout en environnement contrôlé.

### Scénario E2E Requis

```gherkin
Scénario: Mission autonome vérifiée et capitalisée
  Étant donné une mission "RAQIB-E2E-001" avec approvalRequired=true
  Quand le plan est généré et approuvé par un humain
  Et la mission passe en RUNNING
  Et les étapes INVENTORY, TYPECHECK, BUILD, TEST sont exécutées dans Docker
  Et la vérification retourne un verdict PASS
  Alors la mission passe en SUCCEEDED
  Et une leçon est capitalisée avec provenance et confiance
  Et l'AuditLedger contient 100% des événements du cycle

Scénario: Recovery post-crash sans double exécution
  Étant donné une mission en RUNNING avec step[0].executionRecorded=true
  Quand le runtime crash et redémarre
  Alors recoverInterrupted() trouve la mission
  Et step[0] n'est PAS ré-exécuté (idempotence)
  Et l'AuditLedger journalise RECOVERY_TRIGGERED

Scénario: Sandbox Fail Closed
  Étant donné Docker indisponible (mock)
  Quand une mission requiert BUILD ou TEST
  Alors la mission passe en BLOCKED (non FALLBACK_LOCAL)
  Et AuditLedger journalise SANDBOX_UNAVAILABLE
```

### Critères de Réussite du Gate

- [ ] **77 tests existants** : Toujours passants (100%)
- [ ] **Nouveaux tests G1–G6** : ≥10 tests ajoutés, tous passants
- [ ] **Couverture AuditLedger** : 100% des événements du cycle E2E
- [ ] **Build TypeScript** : 0 erreur
- [ ] **Documentation** : Ce document validé et signé

---

## 5. Roadmap d'Implémentation (Ordre de Priorité)

```
P1.1 ✅ StepType Enum (COMPLÉTÉ)
  ↓
G1 — VerificationEngine (Verdict PASS + VERIFICATION_RESULT)
  ↓
G6 — Recovery (WAL FULL, UNKNOWN, idempotence)
  ↓
G3 — DockerSandbox (Fail Closed)
  ↓
G4 — Plan Approval (Artefact lisible)
  ↓
G2 — Capitalisation (Leçons qualifiées)
  ↓
G7 — Observability (Événements manquants)
  ↓
Gate E2E → Phase 2
```

---

## 6. Décisions en Attente de Validation

| # | Décision                                     | Impact                  | Statut        |
|---|----------------------------------------------|-------------------------|---------------|
| D1 | Introduire `StepStatus = 'UNKNOWN'`          | G6 — Recovery           | ✅ Validé ChatGPT |
| D2 | `PRAGMA synchronous=FULL` + `busy_timeout=5000` | G6 — Persistance     | ✅ Validé ChatGPT |
| D3 | Journaliser `VERIFICATION_RESULT` dans `MissionEngine` | G1 — Traçabilité | ✅ Validé ChatGPT |
| D4 | Supprimer `FALLBACK_LOCAL` de `DockerSandbox` | G3 — Fail Closed     | ⏳ En attente |
| D5 | Créer `MissionPlanArtifact` dans `@raqib/core` | G4 — Approval       | ⏳ En attente |

---

## 7. Prochaines Actions

1. **Valider ce document** (Reid Hoffman / Architecture Board)
2. **Implémenter G1** (VerificationEngine + VERIFICATION_RESULT)
3. **Implémenter G6** (WAL, UNKNOWN, idempotence)
4. **Exécuter la suite E2E** et valider le Gate

---

**Sign-off :**
- [ ] Architecture : _________________
- [ ] Sécurité : _________________
- [ ] Produit : _________________