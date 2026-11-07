# RAQIB — Maquettes HTML de visualisation

Maquettes autonomes (CSS + JS inline, aucune dépendance) servant à **visualiser** les interfaces décrites dans
[`../VOICE_COMMAND_INTERFACE_SPEC.md`](../VOICE_COMMAND_INTERFACE_SPEC.md).

**Règles :**
- Les données affichées sont des **placeholders de démonstration**, clairement identifiables. Aucune donnée runtime réelle n'est prétendue.
- Le **Voice Strip** est passif : il n'écoute pas, ne confirme pas, n'exécute rien. Le micro reste dans le dock global.
- Les boutons d'état du Voice Strip sont des **commutateurs de maquette** pour visualiser les états, pas des fonctionnalités.
- Aucune maquette n'appelle le runtime : aucun endpoint n'est requis pour les ouvrir.
- Les actions sans endpoint réel restent marquées `BACKEND REQUIS`.

## État de production

| # | Page | Fichier | Statut |
|---|---|---|---|
| 01 | Missions | `01-missions.html` | livré |
| 02 | Approbations | `02-approbations.html` | à faire |
| 03 | Audit | `03-audit.html` | à faire |
| 04 | Context Engine | `04-context.html` | à faire |
| 05 | Memory Engine | `05-memory.html` | à faire |
| 06 | Workflow Engine | `06-workflows.html` | à faire |
| 07 | Skills Registry | `07-skills.html` | à faire |
| 08 | Coding Engine | `08-coding.html` | à faire |
| 09 | Agents | `09-agents.html` | à faire |
| 10 | Conversations | `10-conversations.html` | à faire |
| 11 | Paramètres / Urgence | `11-settings-urgence.html` | à faire |

## Prévisualisation

Les fichiers s'ouvrent directement dans un navigateur (aucun serveur requis). Pour un rendu servi en HTTP :

```powershell
node "C:\Users\EH\AppData\Local\Temp\opencode\serve-mockups.mjs"
# http://127.0.0.1:4399/01-missions.html
```

## Charte visuelle commune

| Rôle | Valeur |
|---|---|
| Fond | `#04060b` |
| Texte | `#d9e6ef` |
| Texte secondaire | `#7f95a6` |
| Cyan (accent principal) | `#62e6ff` |
| Vert (succès / actif) | `#7dffc8` |
| Ambre (attention / requête) | `#ffb347` |
| Rouge (erreur / urgence) | `#ff6b5e` |
| Titres | Oxanium |
| Données et labels | JetBrains Mono |
| Texte courant | Geist, system-ui |

Structure transverse : header runtime → 3 colonnes (rail / stage / inspecteur) → barre d'actions → Voice Strip → dock global.
