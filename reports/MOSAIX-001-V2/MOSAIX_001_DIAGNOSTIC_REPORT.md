# MOSAIX-001 — Diagnostic READ-ONLY (RAQIB v2)

- Mission : `MOSAIX-001-V2`
- Généré : 2026-11-06T02:31:59.031Z
- Cible : `D:\Projets\atelierpro`
- HEAD : `c31221d27360e3162c0bc4f4b53e531abcf256e2`
- Branche : `plan-execution`
- État Git (status --porcelain) : modifications présentes

## 1. Inventaire
- Entrées racine : 42
- Workspaces analysés : 7

| Scope | Nom | Version | Test | tsconfig |
|---|---|---|---|---|
| packages | @raqib/audit-ledger | 0.1.0 | non | non |
| packages | @raqib/core | 0.1.0 | non | non |
| packages | @raqib/mission-engine | 0.1.0 | non | non |
| packages | @raqib/policy-engine | 0.1.0 | non | non |
| packages | @raqib/tool-gateway | 0.1.0 | oui | non |
| packages | @raqib/verification | 0.1.0 | non | non |
| apps | @raqib/dashboard | 0.1.0 | non | oui |

## 2. Dépendances
- Arêtes internes : 3
- Dépendances externes distinctes : 15

## 3. Risques observés (faits)
- Sans script de test : @raqib/audit-ledger, @raqib/core, @raqib/mission-engine, @raqib/policy-engine, @raqib/verification, @raqib/dashboard
- Sans tsconfig : @raqib/audit-ledger, @raqib/core, @raqib/mission-engine, @raqib/policy-engine, @raqib/tool-gateway, @raqib/verification

## 4. Preuves
- Aucune écriture dans la cible : vérifiée par GIT_UNCHANGED après la mission.
- HEAD identifié : `c31221d27360e3162c0bc4f4b53e531abcf256e2`.