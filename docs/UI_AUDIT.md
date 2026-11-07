# AUDIT UI/UX — DASHBOARD RAQIB

**Date :** 2026-11-06  
**Commanditaire :** ChatGPT-web (CTA post-validation G7 Lots 2&3)  
**Objectif :** Inventaire technique, identification AI slop, écarts interface/capacités réelles, priorisation.

---

## 1. INVENTAIRE DES PAGES (10 pages)

| Route | Fichier | Statut | Appel API | Données |
|-------|---------|--------|-----------|---------|
| `/` (overview) | `app/page.tsx` | ❌ **FAKE** | `/api/status` (partiel) | MODS, FL, DIR, TLN, NP, EN = **hardcodé** |
| `/missions` | `app/missions/page.tsx` | ✅ **RÉEL** | `/api/missions` | Missions du runtime |
| `/approvals` | `app/approvals/page.tsx` | ✅ **RÉEL** | `/api/approvals`, `/api/approvals/:id/grant|reject` | Approbations |
| `/audit` | `app/audit/page.tsx` | ⚠️ **PARTIEL** | `/api/audit` | `EVENT_COLORS` obsolète (types G7 manquants) |
| `/memory` | `app/memory/page.tsx` | ✅ **RÉEL** | `/api/memory?namespace=&threadId=` | Mémoires |
| `/context` | `app/context/page.tsx` | ✅ **RÉEL** | `/api/context` | Métriques tokens |
| `/skills` | `app/skills/page.tsx` | ✅ **RÉEL** | `/api/skills`, `/api/skills/:name/execute` | Skills registry |
| `/coding-engine` | `app/coding-engine/page.tsx` | ✅ **RÉEL** | `/api/opencode/execute` | Tâches codage |
| `/settings` | `app/settings/page.tsx` | ✅ **RÉEL** | `/api/status`, `/api/emergency-stop` | Emergency Stop |
| `/workflows` | `app/workflows/page.tsx` | ❌ **FAKE** | **AUCUN** | Message "MOTEUR DE WORKFLOW RAQIB ACTIF" hardcodé |

---

## 2. AI SLOP — ÉLÉMENTS FICTIFS À SUPPRIMER

### 2.1 Page Overview (`/`) — **MASSE CRITIQUE**

**Lignes incriminées :** `apps/dashboard/src/app/page.tsx`

| Élément | Lignes | Description | Problème |
|---------|--------|-------------|----------|
| `MODS` | 8-15 | 6 modules fictifs (Command Center, Neural Core, Fleet Agents, Priorities, Chronos Log, Quantum Mem) | **Aucun appel API** — données statiques |
| `FL` | 17-22 | 4 "agents" (Coding Unit, Aegis Intel, Quantum Mem, Shield Daemon) avec statuts fake | **Aucune source réelle** |
| `DIR` | 26-31 | "Combat & flight directives" (Emergency Lock, Orbital Recon, Arc Overcharge, Mark 85 Deploy) | **Sémantique Iron Man** — hors domaine RAQIB |
| `TLN` | 33-38 | Timeline fictive (Daily Global Intelligence Brief, HUD Holographic Spacing, Vocal Pipeline Calibration) | **Hardcodé** — pas de lien avec missions réelles |
| `NP` | 40 | "Neural Pathways" — jauges animées random 1600ms | **Animation décorative sans donnée** |
| Header | — | "quantum core 1.21 GW · repulsor matrix · 42.894°N 71.021°W" | **Références Marvel** — non professionnel |
| "Missions 08 armed" | — | Compteur hardcodé | **Faux** — devrait afficher `/api/missions` |
| "120 fps" | — | Badge décoratif | **Vanity metric** — sans utilité |
| "Authorize fix" | — | Bouton sans action | **Faux contrôle** — aucune fonction |

**Ce qui est réel dans `/` :**
- `HudContext` (feed, echo, turns, vectors) — **partiellement réel** (voir section 4)
- Fetch `/api/status` pour le statut runtime
- Boutons quick actions ("Analyser le projet", etc.) — **réels** (appellent `go()` → `/api/chat`)

---

### 2.2 Page Workflows (`/workflows`) — **100% FAKE**

**Fichier :** `apps/dashboard/src/app/workflows/page.tsx`

| Problème | Détail |
|----------|--------|
| **Aucun appel API** | Pas de `fetch`, pas de hook |
| Message hardcodé | "MOTEUR DE WORKFLOW RAQIB ACTIF" |
| Input sans effet | `workflowId` modifiable mais aucune action |
| Placeholder | "Aucun workflow enregistré" — statique |

**Recommandation :** Supprimer la page ou implémenter un vrai CRUD workflows (si le module existe).

---

### 2.3 Page Audit (`/audit`) — **TYPES OBSOLÈTES**

**Fichier :** `apps/dashboard/src/app/audit/page.tsx`

**`EVENT_COLORS` (lignes 7-16) :**

```ts
const EVENT_COLORS: Record<string, string> = {
  MISSION_CREATED:   'rgb(var(--m))',
  MISSION_UPDATED:   'rgb(var(--c))',    // ❌ N'existe plus dans AuditEventType G7
  MISSION_COMPLETED: 'rgb(var(--m))',    // ❌ N'existe plus
  EMERGENCY_STOP:    'rgb(var(--r))',
  POLICY_VIOLATION:  'rgb(var(--r))',    // ❌ N'existe plus
  APPROVAL_GRANTED:  'rgb(var(--m))',
  APPROVAL_REJECTED: 'rgb(var(--r))',
  SYSTEM_BOOT:       'rgb(var(--g))',    // ❌ N'existe plus
};
```

**Types G7 manquants (à ajouter) :**
- `PLAN_GENERATED`, `PLAN_APPROVED`, `PLAN_REJECTED`
- `MISSION_STARTED`, `MISSION_SUCCEEDED`, `MISSION_FAILED`, `MISSION_BLOCKED`
- `STEP_STARTED`, `STEP_COMPLETED`
- `LESSON_RECORDED`, `LESSON_VALIDATED`
- `RECOVERY_TRIGGERED`
- `SANDBOX_UNAVAILABLE`
- `VERIFICATION_RESULT` (existant mais manquant dans la carte)

---

## 3. COMPOSANTS GLOBAUX

### 3.1 `HudContext.tsx` — **SOURCE DU FEED OVERVIEW**

**Fichier :** `apps/dashboard/src/components/HudContext.tsx`

| Champ | Source | Réel/Fake |
|-------|--------|-----------|
| `feed` | Généré par réponses `/api/chat` ou règles regex (`RS`) | ⚠️ **Hybride** |
| `echo` | Input utilisateur | ✅ Réel |
| `turns` | `22 + random` au montage, +1 par commande | ❌ **Initialisation fake** |
| `vectors` | `3380 + random` au montage, +random par commande | ❌ **Initialisation fake** |
| `defenseText` | Réponses `/api/chat` ou règles | ✅ Réel (si API OK) |
| `mode`, `statusLabel`, `output` | État local animé | ✅ Réel (animation) |
| `online` | Poll `/api/status` toutes les 15s | ✅ Réel |
| `theme` | localStorage + toggle | ✅ Réel |

**Règles de réponse (`RS` — lignes 43-114) :**
- 9 patterns regex avec réponses contextuelles (ex: `/stop|emergency/i`, `/audit|ledger/i`, `/mission|objectif/i`)
- Fallback `defaultResp` si aucun pattern matché
- **Problème :** Si `/api/chat` échoue, le fallback est utilisé — **comportement acceptable** (degraded mode)

---

### 3.2 `Navigation.tsx` — **RÉEL**

**Fichier :** `apps/dashboard/src/components/Navigation.tsx`

- 10 liens de navigation — **tous valides**
- Poll `/api/status` au montage
- Affiche statut emergency stop
- Boutons thème + focus mode — **fonctionnels**

---

### 3.3 `HUDHeader.tsx` — **RÉEL**

- Affiche `defenseText` via `HudContext`
- Boutons "Engage Defense Protocol", "Analyze Threat Vector" — **appellent `go()`**
- Clock + timezone — **réels**

---

### 3.4 `HUDDock.tsx` — **RÉEL**

- Input directive → `go()` → `/api/chat`
- Quick actions (4 boutons) — **réels**
- Fetch `/api/models/health` au montage — **réel**
- Waveform visuelle (9 barres `<i>`) — **décoratif** (pas de lien avec audio réel)

---

### 3.5 `BootScreen.tsx` — **DÉCORATIF**

**Fichier :** `apps/dashboard/src/components/BootScreen.tsx`

```ts
const BL = [
  'neural lattice ......... assembled',
  'arc reactor ............ 98.4%',
  'voice pipeline ......... synced',
  'RAQIB ................. online',
];
```

- Animation de boot (4 lignes, 400ms chacune)
- **Fonction :** UX onboarding — **acceptable** (ne prétend pas être réel)

---

### 3.6 `ModuleOverlay.tsx` — **RÉEL**

- Gère les transitions de pages (exit/enter)
- Masqué sur `/` (home)
- **Fonction :** Router layout — **correct**

---

## 4. HOOKS — ÉTAT DES LIEUX

| Hook | Fichier | API calls | Statut |
|------|---------|-----------|--------|
| `useMissions` | `hooks/useMissions.ts` | `GET /api/missions` | ✅ Réel |
| `useAudit` | `hooks/useAudit.ts` | `GET /api/audit[?filters]` | ✅ Réel |
| `useApprovals` | `hooks/useApprovals.ts` | `GET /api/approvals`, `POST /api/approvals/:id/grant|reject` | ✅ Réel |
| `useSkills` | `hooks/useSkills.ts` | `GET /api/skills`, `POST /api/skills/:name/execute` | ✅ Réel |
| `useMemory` | `hooks/useMemory.ts` | `GET /api/memory?namespace=&threadId=` | ✅ Réel |
| `useEmergencyStop` | `hooks/useEmergencyStop.ts` | `GET /api/status`, `POST /api/emergency-stop` | ✅ Réel |
| `useContextMetrics` | `hooks/useContextMetrics.ts` | `GET /api/context` | ✅ Réel |
| `useStatus` | `hooks/useStatus.ts` | `GET /api/status` (poll 15s) | ✅ Réel |
| `usePuterAi` | `hooks/usePuterAi.ts` | `POST https://api.puter.com/puterai/openai/v1/chat/completions` | ⚠️ **Externe** (hors RAQIB) |

**Note sur `usePuterAi` :**
- Hook bien documenté (avertissements coûts, pas d'audit, pas de budget)
- **Usage légitime** pour démo/prototype, mais **à éviter en production**

---

## 5. ROUTES API — CORRESPONDANCE DASHBOARD/RUNTIME

**Routes appelées par le dashboard :**

| Endpoint | Utilisé par | Implementé dans `server.ts` |
|----------|-------------|----------------------------|
| `GET /api/status` | Navigation, HudContext, useStatus, useEmergencyStop | ✅ Ligne 30 |
| `GET /api/missions` | useMissions | ✅ Ligne 103 |
| `GET /api/audit` | useAudit, HudContext | ✅ Ligne 173 |
| `GET /api/approvals` | useApprovals | ✅ Ligne 137 |
| `POST /api/approvals/:id/grant\|reject` | useApprovals | ✅ Lignes 147-162 |
| `GET /api/memory` | useMemory | ✅ Ligne 47 |
| `GET /api/context` | useContextMetrics | ✅ Ligne 40 |
| `GET /api/skills` | useSkills | ✅ Ligne 74 |
| `POST /api/skills/:name/execute` | useSkills | ✅ Ligne 82 |
| `POST /api/opencode/execute` | coding-engine/page | ✅ Ligne 261 |
| `POST /api/emergency-stop` | useEmergencyStop | ✅ Ligne 283 |
| `POST /api/chat` | HudContext, HUDDock | ✅ Ligne 226 |
| `GET /api/models/health` | HUDDock | ✅ Ligne 254 |

**Couverture API : 13/13 routes implémentées ✅**

---

## 6. ÉCARTS MAJEURS

| Écart | Sévérité | Impact | Recommandation |
|-------|----------|--------|----------------|
| Overview (`/`) = AI slop massif | 🔴 **CRITIQUE** | Crédibilité dashboard, confusion utilisateur | **Réécrire complètement** avec vraies données |
| Workflows (`/workflows`) = 100% fake | 🔴 **CRITIQUE** | Page inutile, mensonge fonctionnel | **Supprimer** ou implémenter vrai module |
| `EVENT_COLORS` obsolète (audit) | 🟠 **MOYEN** | Couleurs incorrectes, types G7 manquants | **Mettre à jour** avec `AuditEventType` G7 |
| `turns`/`vectors` initialisés fake | 🟡 **MINEUR** | Vanity metrics sans signification | **Initialiser à 0** ou supprimer |
| Waveform HUDDock décorative | 🟡 **MINEUR** | Fausse visualisation audio | **Documenter** comme décoratif ou supprimer |

---

## 7. PRIORISATION DES CORRECTIONS

### Phase 1 — **Urgent (avant Gate Phase 2)**

1. **Supprimer `workflows/page.tsx`** ou ajouter un vrai CRUD
2. **Nettoyer overview (`/`)** :
   - Supprimer `MODS`, `FL`, `DIR`, `TLN`, `NP`, `EN`
   - Remplacer par :
     - Statistiques réelles (nb missions, approbations en attente, événements audit 24h)
     - Dernières missions créées (via `/api/missions`)
     - Derniers événements audit (via `/api/audit?limit=5`)
     - Statut runtime (déjà présent via `/api/status`)
3. **Mettre à jour `EVENT_COLORS`** dans `audit/page.tsx` avec tous les types G7

### Phase 2 — **Important**

4. **Initialiser `turns`/`vectors` à 0** dans `HudContext`
5. **Documenter waveform HUDDock** comme décoratif (commentaire dans le code)
6. **Ajouter des tests E2E** pour vérifier que chaque page appelle bien ses API

### Phase 3 — **Nice to have**

7. **Améliorer BootScreen** avec vraies étapes d'initialisation (ex: "AuditLedger initialized", "PolicyEngine armed")
8. **Ajouter des graphiques** (ex: missions par statut, budget consommé)

---

## 8. RECOMMANDATIONS UX GLOBALES

| Axe | Recommandation |
|-----|----------------|
| **Cohérence sémantique** | Supprimer toutes références Iron Man/Marvel ("repulsor", "Mark 85", "arc reactor") — remplacer par vocabulaire RAQIB ("quantum" → "mission", "neural" → "workflow") |
| **Hiérarchie visuelle** | Overview actuelle = trop chargée (7 sections fictives). Simplifier : 3-4 sections max, toutes réelles |
| **Accessibilité** | Boutons sans `aria-label` (ex: waveform, mic). Ajouter descriptions pour lecteurs d'écran |
| **Reduced motion** | Aucun `prefers-reduced-motion` dans les animations (BootScreen, waveform, HUD). À implémenter |
| **Erreurs utilisateur** | Pages affichent "Erreur de connexion" mais sans guide de résolution. Ajouter : "Vérifiez que `npm run dev:runtime` tourne sur le port 4000" |

---

## 9. CONCLUSION

**État actuel :**
- ✅ **7 pages sur 10** sont fonctionnelles et appelant les bonnes API
- ✅ **9 hooks sur 9** sont réels (1 externe : PuterAI)
- ✅ **13 routes API** appelées sont toutes implémentées dans le runtime
- ❌ **2 pages critiques** sont entièrement fictives (overview + workflows)
- ❌ **1 page partiellement obsolète** (audit — types G7 manquants)

**Effort estimé :**
- **Nettoyage overview** : 4-6h (suppression AI slop + intégration vraies données)
- **Suppression/Refonte workflows** : 1h (suppression) ou 2-3j (implémentation complète)
- **Mise à jour EVENT_COLORS** : 30min
- **Tests E2E** : 1-2j

**Validation ChatGPT requise avant exécution.**

---

## 10. STATUT D'EXÉCUTION (2026-11-06)

**CTA ChatGPT-web du 2026-11-06 — VALIDÉ ET EXÉCUTÉ :**

| Action | Statut | Détails |
|--------|--------|---------|
| **A. Workflows** | ✅ **FAIT** | `apps/dashboard/src/app/workflows/page.tsx` réécrite : squelette « Fonctionnalité non implémentée », suppression totale du faux fonctionnel, objectif futur documenté |
| **B. Overview** | ✅ **FAIT** | `apps/dashboard/src/app/page.tsx` entièrement réécrite : données 100% réelles (missions, approvals, audit events, runtime status), zéro AI slop, gestion explicite des erreurs API, polling 30s |
| **C. Audit colors** | ✅ **FAIT** | `apps/dashboard/src/app/audit/page.tsx` : `EVENT_COLORS` aligné sur `AuditEventType` G7 (28 types), `FALLBACK_COLOR` pour événements inconnus, `WARNING_TYPES` explicite |
| **D. Hash chain (fausse revendication)** | ✅ **FAIT** | Supprimée de `audit/page.tsx` — remplacée par « Append-only · Tri causal garanti (created_at, rowid) » |
| **E. Overview hash claim** | ✅ **FAIT** | Remplacé par « Journal append-only — chaque événement est persisté dans le registre SQLite (rowid séquentiel) » |
| **F. turns/vectors à 0** | ✅ **FAIT** | `HudContext.tsx` : initialisation à 0 (plus de `22` / `3380` factices) |
| **G. Références Marvel** | ✅ **FAIT** | `BootScreen.tsx` : « arc reactor » → « policy engine » ; `HUDHeader.tsx` : « sector 7G » → « local », « MARK LXXXV » → « WORKSPACE » |
| **H. Waveform décorative** | ✅ **FAIT** | `HUDDock.tsx` : commentaire « décorative (état écoute simulé pour le retour visuel) » + `aria-hidden="true"` |
| **I. Build & tests** | ✅ **FAIT** | `npm run build` : 0 erreur TypeScript, Next.js 12 pages compilées ; `npm test` : 91/91 tests passants |

**Pages nettoyées :** 3/3 (overview, workflows, audit)  
**Composants nettoyés :** 4/4 (HudContext, BootScreen, HUDHeader, HUDDock)  
**AI slop éliminé :** ~15 éléments (MODS, FL, DIR, TLN, NP, header Iron Man, boutons fake, etc.)  
**Vocabulaire RAQIB :** restauré (plus de Marvel, plus de « quantum », « repulsor », « Mark 85 »)

**Prochaine étape (CTA ChatGPT) :** Attendre validation de l'audit UI avant de reprendre G7 Lot 4.
