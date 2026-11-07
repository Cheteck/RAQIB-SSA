# Conformité FreeLLMAPI — Coding Engine & Model Gateway

> Vérification **read-only**. Aucune modification de code n'a été faite pour produire ce document.
> Source de vérité : documentation officielle FreeLLMAPI,
> [`docs/en/clients/01-agent-clients.md`](https://github.com/tashfeenahmed/freellmapi/blob/main/docs/en/clients/01-agent-clients.md)
> (consultée le 2026-11-06).
> Chaque ligne du tableau est confrontée à un `fichier:ligne` du dépôt.

---

## 1. Ce que la documentation impose

| # | Exigence documentaire | Référence doc |
|---|---|---|
| D1 | Base URL OpenAI-compatible : `http://localhost:3001/v1` — **avec** le suffixe `/v1` | « set `base_url` to `http://localhost:3001/v1` » |
| D2 | Clé unifiée créée depuis le dashboard, envoyée en `Authorization: Bearer <unified-key>` | « use the unified key from the dashboard » |
| D3 | Variable d'environnement de référence : `FREELLMAPI_API_KEY` | `export FREELLMAPI_API_KEY=<unified-key>` |
| D4 | OpenCode / clients « Chat » : base `http://localhost:3001/v1`, wire **OpenAI Chat** | tableau Coding agents, ligne OpenCode |
| D5 | Le catalogue live `GET /v1/models` fournit les ids et les fenêtres de contexte | « The live `/v1/models` catalog supplies the model ids » |
| D6 | Le routage (`auto`, fallback, cache, compression) est fait **par le proxy**, pas par le client | « model routing, fallback, response caching… stay consistent » |
| D7 | Ne jamais mettre la clé unifiée dans une URL ; les tokens d'URL sont un mécanisme distinct et révocable | section « Headerless clients » |
| D8 | Identification client : `User-Agent` / `x-title` alimentent la page Agents | sections OpenClaw/Hermes/Pi/ZCode |

---

## 2. Confrontation au code

| # | Exigence | Implémentation | Verdict | Preuve |
|---|---|---|---|---|
| C1 | D1 — base locale `/v1` | `RaqibCodingEngineAdapter` : `providers.json` → env explicite → `http://127.0.0.1:3001/v1` ; plus d'hôte public | **CONFORME** | `RaqibCodingEngineAdapter.ts:33-49` ; `tests/tool-gateway/freellmapi-alignment.spec.ts` |
| C2 | D2 — clé unifiée réelle | `FREELLMAPI_API_KEY` puis alias `FREE_LLM_API_KEY` ; clé absente ⇒ refus explicite, aucune requête | **CONFORME** | `RaqibCodingEngineAdapter.ts:52-57, 104-116` ; `tests/tool-gateway/freellmapi-alignment.spec.ts` |
| C3 | D3 — `FREELLMAPI_API_KEY` | Variable documentée en primaire, alias `FREE_LLM_API_KEY` conservé pour l'existant | **CONFORME** | `config/providers.json:9-10` ; `free-llm-api.ts:18-19` ; `openai-compatible.ts:15-21` |
| C4 | D4 — wire OpenAI Chat | `POST ${baseURL}/chat/completions` avec `model`/`messages`/`temperature`/`max_tokens` | **CONFORME** (si C1 corrigé) | `coding-engine/packages/providers/src/freellmapi.ts:16-29` |
| C5 | D4 — base avec `/v1` | Normalisation de la barre oblique finale dans l'adaptateur et dans le provider | **CONFORME** | `freellmapi.ts:29` ; `RaqibCodingEngineAdapter.ts` |
| C6 | D5 — catalogue live | Modèles figés en dur : `["auto", "fusion", "gemini-flash"]` ; aucun appel à `/v1/models` | **NON CONFORME** | `config/providers.json:11` |
| C7 | D6 — routage délégué au proxy | Le client envoie `model` (défaut `auto`) et lit `x-routed-via` ; pas de fallback côté client | **CONFORME** | `freellmapi.ts:24,37` |
| C8 | D7 — clé jamais dans l'URL | Clé uniquement en en-tête `Authorization` | **CONFORME** | `freellmapi.ts:19-22` |
| C9 | D8 — identification client | `User-Agent: RAQIB-SSA/1.0` + `x-title: RAQIB-SSA` | **CONFORME** (ModelGateway seulement) | `packages/model-gateway/src/adapters/openai-compatible.ts:54-55` |
| C10 | Robustesse attendue d'un client HTTP | Timeout borné (90 s par défaut), `request.signal` propagé, `TIMEOUT`/`ABORTED` distincts, aucun retry automatique sur un POST non idempotent | **CONFORME** | `freellmapi.ts:96-160` ; `tests/coding-engine/freellmapi-tools.spec.ts` (C10) |
| C11 | Appels d'outils (prérequis boucle Coding Engine) | `tools` + `tool_choice: "auto"` sérialisés ; `tool_calls` remontés dans `ModelResponse.toolCalls` | **CONFORME** | `freellmapi.ts:23-35, 55-77` ; `provider.ts:22-36` ; `tests/coding-engine/freellmapi-tools.spec.ts` (3 tests) |
| C12 | Diagnostic d'erreur | Statut + corps de réponse tronqué (500 car.), sans ajout de secret | **CONFORME** | `freellmapi.ts:41-52` |
| C13 | Clé absente ⇒ échec explicite | `isEnabled()` exige la clé dès qu'un mécanisme de clé est configuré ; un endpoint local sans auth reste activable | **CONFORME** | `openai-compatible.ts:34-41` ; `tests/model-gateway/freellmapi-adapter.spec.ts` |
| C14 | Deux chemins d'appel cohérents | `config/providers.json` et l'adaptateur Coding Engine partagent désormais la même résolution (URL + clé) | **CONFORME** | `config/providers.json:8-10` ; `RaqibCodingEngineAdapter.ts` |

### Preuve de divergence interne

Le document de conception du dépôt lui-même est aligné sur la doc officielle :

```
Coding engin.md:279   baseURL: "http://localhost:3001/v1",
Coding engin.md:280   apiKey: process.env.FREELLMAPI_API_KEY!,
```

alors que le code d'exécution utilise l'hôte public et un autre nom de variable.
La divergence n'est donc pas une ambiguïté documentaire : c'est un écart
entre la conception et l'implémentation.

### Ce que C11 signifiait concrètement

> **Corrigé** — conservé comme trace de l'écart initial.

`ModelRequest.tools` existait (`provider.ts:15`), mais `complete()` ne construisait
le corps qu'avec `model`, `messages`, `temperature`, `max_tokens`
(`freellmapi.ts:23-28`). Même un `SDKCodingEngine.execute()` câblé avec un
`ToolRegistry` peuplé n'aurait jamais exposé les outils au modèle : aucun
`tool_calls` ne pouvait revenir, la boucle réelle était structurellement
impossible.

Correction livrée : `tools` est mappé au format OpenAI
(`{ type: "function", function: { name, description, parameters } }`),
`tool_choice: "auto"` est ajouté uniquement quand des outils sont déclarés, et
`tool_calls` est normalisé dans `ModelResponse.toolCalls`. Régression verrouillée
par `tests/coding-engine/freellmapi-tools.spec.ts` (3 tests : sérialisation +
remontée, absence de clé sans outils, normalisation d'arguments non-chaîne).

---

## 3. Synthèse

- **13 conformités** : base locale, clé documentée, clé hors URL, wire OpenAI Chat,
  normalisation d'URL, routage délégué, identification client, appels d'outils,
  timeout/annulation, diagnostic d'erreur, fail-closed sans clé, cohérence des
  deux chemins d'appel, alias de transition.
- **1 non-conformité restante, non bloquante** : catalogue de modèles figé (C6).
  Les ids `auto` / `fusion` / `gemini-flash` peuvent diverger du `GET /v1/models`
  réel, mais le routage reste délégué au proxy (D6) et `auto` reste le défaut.

**F-07, F-07b et les écarts C1–C5, C10, C12–C14 sont corrigés.** Aucun écart
bloquant ne subsiste entre `config/providers.json`, le ModelGateway et
l'adaptateur Coding Engine.

---

## 4. Correctifs restants (non appliqués — en attente d'arbitrage)

1. **Catalogue** : `GET /v1/models` au démarrage, cache mémoire, ids issus du
   catalogue ; `auto` reste le défaut de routage (D6). **(C6 — ouvert, non bloquant)**
