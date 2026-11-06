# G7 - Sandbox Unavailable / Docker Integration Status

> **Statut : Non applicable provisoirement (Deferred / Phase 2)**  
> **Date :** Novembre 2026  
> **Contexte :** MosaiX Operator / RAQIB-SSA Phase 1 (Gate G7)

---

## 1. Contexte et Constat Technique

Le module `DockerSandbox` (`packages/sandbox/src/DockerSandbox.ts`) implémente un pattern *Fail-Closed* robuste pour l'exécution isolée de conteneurs. Cependant, dans le cadre actuel du **Runtime Raqib** (`services/runtime/src/RaqibRuntime.ts`) et de sa boucle de synchronisation (tick loop de 5s), les étapes de mission (`BUILD`, `TEST`, `EXECUTE`) s'exécutent via l'interpréteur de code ou l'executor synchrone configuré, et **ne sont pas branchées en production sur le cycle DockerSandbox**.

Par conséquent :
- Aucun événement de type `SANDBOX_UNAVAILABLE` ou d'échec d'isolation conteneur n'est émis sur le parcours réel des missions Phase 1.
- La gestion d'indisponibilité du sandbox (Docker daemon éteint, socket non accessible) relève pour l'instant d'une garde de sécurité statique (Fail-Closed) mais n'alimente pas l'AuditLedger en runtime continu.

---

## 2. Responsabilité Future (Phase 2)

Lors de la transition vers la Phase 2 (intégration complète du conteneur d'exécution), le *Step Executor* du runtime sera responsable de :
1. Tenter l'instanciation ou la communication avec le daemon Docker avant l'exécution d'une étape critique.
2. Intercepter toute exception d'indisponibilité (ex: `ECONNREFUSED` sur le socket Docker, daemon arrêté).
3. Émettre un événement spécifique `SANDBOX_UNAVAILABLE` dans l'**AuditLedger** avec :
   - `missionId` et `stepId` concernés.
   - `correlationId` pour la traçabilité.
   - Motif explicite de l'indisponibilité (ex: `DOCKER_DAEMON_OFFLINE`).
4. Basculer la mission en état `BLOCKED` ou `FAILED` selon la politique Fail-Closed.

---

## 3. Critère de Réactivation

Le chantier `SANDBOX_UNAVAILABLE` sera considéré comme actif et testable lorsque les conditions suivantes seront réunies :
1. **Intégration du Runtime** : Le tick loop de `RaqibRuntime` délègue l'exécution des étapes à `DockerSandbox`.
2. **Scénario d'indisponibilité testé** : Un test E2E dédié simule un daemon Docker absent ou arrêté pendant l'exécution d'une étape.
3. **Traçabilité Ledger** : Vérification que l'événement `SANDBOX_UNAVAILABLE` est persisté dans l'AuditLedger et que la mission récupère proprement après restauration du service (idempotence restaurative).

En attendant ces conditions, l'événement `SANDBOX_UNAVAILABLE` est officiellement **NON APPLICABLE PROVISOIREMENT** et ne fait pas l'objet de tests ou de métriques de couverture dans le Gate G7.
