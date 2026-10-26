# CONFIGURATION EXEMPLE - RAQIB

Copier ces fichiers et adapter aux valeurs réelles.

## config/providers.example.json
```json
{
  "defaultProvider": "api",
  "providers": {
    "api": {
      "type": "api",
      "enabled": true,
      "baseUrl": "https://api.example.com/v1",
      "model": "model-name",
      "apiKeyEnv": "RAQIB_API_KEY",
      "maxTokens": 4096,
      "timeoutMs": 120000,
      "costPer1kInput": 0.001,
      "costPer1kOutput": 0.002
    },
    "ollama": {
      "type": "ollama",
      "enabled": false,
      "baseUrl": "http://localhost:11434",
      "model": "llama-3.1:8b",
      "timeoutMs": 300000
    }
  },
  "routing": {
    "audit": "api",
    "planning": "api",
    "verification": "api"
  }
}
```

## config/raqib.example.env
```env
# Environnement RAQIB
NODE_ENV=development

# Dépôt MosaiX cible
MOSAIX_REPO_PATH=D:\path\to\MosaiX
MOSAIX_REPO_URL=https://github.com/...

# Fournisseur IA
RAQIB_API_KEY=
RAQIB_DEFAULT_PROVIDER=api

# Gouvernance
RAQIB_EMERGENCY_STOP=false
RAQIB_READ_ONLY_MODE=true
RAQIB_REQUIRE_APPROVAL_ABOVE=0

# Budget
RAQIB_BUDGET_GLOBAL_EUR=100
RAQIB_BUDGET_AUTO_CUMUL_EUR=5

# Persistance
RAQIB_DB_PATH=./data/raqib.db

# Docker (Phase 5 uniquement)
RAQIB_DOCKER_ENABLED=false
RAQIB_DOCKER_NETWORK=none
```

## config/policies/default.policy.json
```json
{
  "version": "1.0",
  "constitutionHash": "TO_BE_SET",
  "rules": [
    {
      "id": "deny-write-in-readonly",
      "description": "Refuser toute écriture si mode lecture seule",
      "effect": "DENY",
      "conditions": {
        "mode": "read-only",
        "actionType": ["WRITE", "CREATE", "DELETE", "EXECUTE_DESTRUCTIVE"]
      }
    },
    {
      "id": "allow-qa-001",
      "description": "Autoriser RAQIB-001 en lecture seule",
      "effect": "ALLOW",
      "conditions": {
        "missionId": "RAQIB-001",
        "actionType": ["READ", "INVENTORY"],
        "resource": "MOSAIX_REPO"
      }
    },
    {
      "id": "deny-secrets",
      "description": "Refuser accès aux secrets",
      "effect": "DENY",
      "conditions": {
        "resourcePathPattern": ["**/.env*", "**/credentials*", "**/*.pem", "**/*.key"]
      }
    },
    {
      "id": "deny-network",
      "description": "Refuser accès réseau non autorisé",
      "effect": "DENY",
      "conditions": {
        "actionType": ["NETWORK_REQUEST"]
      }
    },
    {
      "id": "emergency-stop",
      "description": "Arrêt d'urgence bloque tout",
      "effect": "DENY",
      "conditions": {
        "emergencyStop": true
      }
    }
  ]
}
```

## Règles importantes
- **Ne pas commiter** `.env` réel
- **Copier** `*.example.*` vers fichiers réels localement
- **Versionner** politiques une fois validées
- **Mode lecture seule** = `true` par défaut jusqu'à validation explicite
- **Emergency stop** doit pouvoir être activé sans intervention modèle
