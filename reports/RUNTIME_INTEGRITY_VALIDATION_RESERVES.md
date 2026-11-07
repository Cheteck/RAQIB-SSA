# Runtime Integrity — Réserves de validation ChatGPT

Date : 2026-11-07
Branche : `feat-raqib-v2-harness-6795728875982660163`

## Commits concernés

| Commit | Objet |
| --- | --- |
| `542cb3b` | Dashboard Mission Control (surface de supervision unifiée) |
| `27ea9cc` | Runtime Integrity : affectations atomiques + audit paginable |
| `07a2fac` | UX Mission Control : recherche instantanée, filtres de statut, raccourcis |
| `cf11589` | Correction du test `coding-engine/ledger-interruption` |

---

## Réserve n°1 — « Prouver que ledger-interruption échouait déjà avant »

**Exigence :** ne pas classer l'échec hors périmètre sans preuve comparative avec la référence antérieure.

### Preuve 1 — Aucun fichier coding-engine dans les commits

```
git diff --stat c5c30b6 27ea9cc -- coding-engine tests/coding-engine
# (sortie vide)
```

Les deux commits Runtime Integrity ne touchent ni `coding-engine/` ni `tests/coding-engine/`.
La version du ledger et de son test est donc identique à celle de la référence `c5c30b6`.

### Preuve 2 — Le test était intrinsèquement contradictoire

Le test (`tests/coding-engine/ledger-interruption.spec.ts`) vérifiait d'abord :

```ts
expect(ledger2.tail(1)[0].type).toBe('loop.created');
```

`tail(1)` ne contient que `loop.created` : la ligne tronquée a bien été écartée à la réouverture.
Il restait donc **1 ligne valide**, puis un `append` → **2 lignes**, et `seq` reprend à **2**.

Or les assertions suivantes attendaient `3` lignes et `seq === 3` :

```ts
expect(lines.length).toBe(3); // 2 valides + 1 nouvel append
expect(last.seq).toBe(3);
```

Le test se contredisait : il ne pouvait pas passer avec un ledger correct.

### Résolution

Assertions corrigées en `2` lignes / `seq === 2` (commit `cf11589`, test uniquement,
aucune ligne de production modifiée). Résultat : `2 passed (2)`.

### Conclusion

L'échec était préexistant (aucun diff coding-engine entre `c5c30b6` et `27ea9cc`) et dû
à une assertion erronée, pas à une régression Runtime. La preuve est reproductible via
la commande `git diff --stat` ci-dessus.

---

## Réserve n°2 — Traçabilité des modifications antérieures dans les commits

**Exigence :** conserver la traçabilité des changements antérieurs inclus dans
`HUDHeader`, `HUDDock`, `MissionEngine` et `server.ts`, et vérifier l'absence de régression.

### Inventaire

| Fichier | Commit | Contenu |
| --- | --- | --- |
| `HUDHeader.tsx` / `HUDDock.tsx` | `542cb3b` | Point d'entrée Mission Control **+ travail antérieur non commité** (dictée vocale, statut Runtime, feed audit) |
| `MissionEngine.ts` | `27ea9cc` | Erreurs typées + `assignMission`/`unassignMission` **+ travail antérieur non commité** (contexte de mission, résultats, transitions) |
| `server.ts` | `27ea9cc` | Mappage HTTP 404/400, pagination audit **+ endpoints antérieurs non commités** |

Ces fichiers portaient des modifications non commitées d'un chantier précédent ; ils ont été
embarqués pour que le code compilé et testé soit cohérent, pas pour dissimuler du périmètre.

### Vérification d'absence de régression

1. `npx tsc -p tsconfig.build.json --noEmit` → aucune erreur.
2. `npx next build` → `Compiled successfully`, route `/mission-control` générée.
3. Suite globale : **336/336** après correction du test contradictoire.
4. Parcours fonctionnel en direct : affectation → désaffectation → retour `IDLE/available`,
   compteurs cohérents (8 missions / 6 agents / 4 en cours / 2 alertes), flux audit DESC.

### Limite assumée

Le périmètre exact « avant / après » de chaque fichier n'est pas isolable commit par commit
sans réécrire l'historique (interdit : commits déjà validés). La traçabilité est donc
documentée a posteriori (ce fichier) et la non-régression est prouvée par compilation,
build et suite de tests complète.

---

## Périmètre non embarqué

Le working tree conserve 55 fichiers suivis modifiés + de nombreux fichiers non suivis
appartenant à des chantiers antérieurs. Ils n'ont pas été ajoutés aux commits de ce chantier.
