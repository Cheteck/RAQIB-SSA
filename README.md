# RAQIB — Autonomous Enterprise Intelligence System

**Nom de code :** RAQIB\
**Désignation :** Agent Auto-Souverain (SSA)\
**Version :** 2.0 — PRD révisé avec LLM Harness (Skills, Memory, Workflows, Context)

---

## Vue d'Ensemble

RAQIB est un système d'IA d'entreprise conçu pour la supervision, l'automatisation et le contrôle sécurisé de missions. Il combine :
- **Policy Engine & Audit Ledger** : Contrôle de gouvernance Zero-Trust et registre d'audit immuable.
- **Model Gateway & FreeLLMAPI** : Routage multi-modèles (OpenAI, Anthropic, Ollama, FreeLLMAPI) avec fallbacks et vérification budgétaire.
- **LLM Harness Framework** :
  - **ContextEngine** : Fenêtre glissante et régulation de tokens.
  - **MemoryEngine** : Mémoire court terme par `thread_id` et long terme épisodique/sémantique.
  - **WorkflowEngine** : Orchestration sous forme de graphe d'états orienté.
  - **SkillsRegistry** : Catalogue dynamique de compétences sandboxées via DockerSandbox.
  - **MiddlewarePipeline** : Crochets `beforeAgent` et `afterAgent` pour intercepter les flux d'IA.
- **Dashboard Command Center** : Interface Next.js complète avec monitoring temps réel.

---

## Configuration de FreeLLMAPI

RAQIB supporte l'intégration directe ou via proxy avec [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi).

Dans `config/providers.json` :
```json
{
  "defaultProvider": "freellmapi",
  "providers": {
    "freellmapi": {
      "name": "FreeLLMAPI",
      "type": "openai-compatible",
      "enabled": true,
      "baseUrl": "https://freellmapi.com/api/v1",
      "apiKeyEnv": "FREE_LLM_API_KEY",
      "model": "auto",
      "models": ["auto", "free-gpt-4o", "free-claude-3-5-sonnet"]
    }
  }
}
```

Dans `.env.local` :
```env
FREE_LLM_API_KEY=votre_cle_unified_freellmapi
```

---

## Installation & Démarrage

### Préréquis
- Node.js 20+
- npm 9+

### Commande d'installation
```bash
npm install
```

### Exécution des tests (100% verts)
```bash
npm test
```

### Compilation globale
```bash
npm run build
```

---

## CI/CD GitHub Actions

Le workflow `.github/workflows/ci.yml` exécute automatiquement à chaque push/PR :
1. Installation `npm ci`
2. Compilation des packages TypeScript
3. Pre-rendering statique du Dashboard Next.js
4. Exécution de la suite de tests Vitest
