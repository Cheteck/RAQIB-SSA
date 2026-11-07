Architecture de référence — Coding Engine SDK
Je recommande de construire un moteur de codage IA indépendant du langage du projet analysé, avec un cœur TypeScript, une intégration FreeLLMAPI et deux modes de déploiement : bibliothèque embarquée et service backend.

L'objectif n'est pas de développer un IDE, ni un simple wrapper autour d'une API de chat. Il s'agit de créer un moteur réutilisable qui peut recevoir une tâche logicielle, comprendre un dépôt, planifier des modifications, produire des patchs, exécuter des validations et restituer un résultat vérifiable.

Je structurerais le projet autour de cinq principes :

1. Provider-agnostic : FreeLLMAPI est le fournisseur initial, pas une dépendance du cœur.
2. Language-agnostic : le moteur fonctionne avec plusieurs langages et outils de build.
3. Tool-driven : les agents utilisent des outils explicites, avec des permissions contrôlées.
4. Execution-safe : chaque modification et commande passe par des politiques d'exécution.
5. Portable : la même logique métier fonctionne en bibliothèque ou derrière une API distante.
6. Vue d'ensemble de l'architecture
   Applications clientes

Application existante · CLI · CI/CD · Backend métier

Embedded SDK

Appel direct dans le processus

Remote API

HTTP + événements de progression

Application Service / Engine Facade

Tâches · Sessions · Annulation · Permissions · Résultats

Agent Runtime

Planification · Boucle d'outils · Budget

Project Intelligence

Fichiers · Symboles · Langages · Dépendances

Change Management

Patchs · Diff · Validation · Rollback

Execution Runtime

Tests · Build · Lint · Sandbox

Model Gateway Interface

Adaptateurs · Capacités · Streaming · Retry · Traces

FreeLLMAPI

Autres API / modèles locaux

La règle structurante est que le runtime agentique ne doit connaître ni l'interface cliente, ni les détails HTTP de FreeLLMAPI, ni le langage particulier du dépôt.

Il manipule des contrats métier : CodingTask, Workspace, ToolCall, Patch, ValidationResult et TaskResult.

2. Découpage en packages
   Je commencerais avec un monorepo TypeScript, mais avec des frontières de modules qui permettent d'extraire les composants plus tard.
   Package Responsabilité
   @coding-engine/core Contrats, tâches, événements, erreurs et types communs
   @coding-engine/runtime Boucle agentique, orchestration, budgets et annulation
   @coding-engine/providers Interface modèle et adaptateur FreeLLMAPI
   @coding-engine/project Exploration du dépôt, contexte, ignore rules et indexation
   @coding-engine/tools Outils de lecture, recherche, patch et exécution
   @coding-engine/execution Exécuteurs de commandes, sandbox et timeouts
   @coding-engine/validation Tests, build, lint et critères de réussite
   @coding-engine/storage Sessions, checkpoints et persistance
   @coding-engine/server API HTTP, authentification et diffusion d'événements

Les packages server et storage sont optionnels pour un usage embarqué minimal. Le cœur, les outils, le runtime et l'adaptateur de modèles sont les éléments fondamentaux.

Je déconseille de créer immédiatement un microservice par package. Des packages distincts dans un seul processus suffisent pour obtenir une architecture modulaire. 3. Contrats TypeScript du noyau
Je définirais les contrats avant les agents. Ils constituent la frontière stable entre ton application, le moteur, les fournisseurs IA et les outils.
3.1 Tâche de codage
Une tâche doit exprimer l'objectif, les contraintes, les permissions et les critères de réussite.
// packages/core/src/task.ts

export type TaskMode =
| "analyze"
| "propose"
| "apply";

export type TaskKind =
| "generate"
| "modify"
| "refactor"
| "debug"
| "test"
| "document"
| "implement";

export interface CodingTask {
id?: string;
kind: TaskKind;
instruction: string;
workspaceId: string;

mode: TaskMode;

constraints?: {
allowedPaths?: string[];
forbiddenPaths?: string[];
maxFilesChanged?: number;
maxIterations?: number;
timeoutMs?: number;
};

acceptanceCriteria?: string[];
metadata?: Record<string, unknown>;
}

Le workspaceId est une référence vers un workspace enregistré côté moteur, pas un chemin arbitraire fourni par un utilisateur distant.

Le mode propose ne doit pas modifier les fichiers. Le mode apply autorise les modifications, mais seulement après vérification des permissions et des politiques d'exécution.
3.2 Résultat normalisé
Le résultat ne doit pas dépendre du modèle qui a répondu.
// packages/core/src/result.ts

export type TaskStatus =
| "completed"
| "needs_approval"
| "failed"
| "cancelled"
| "timed_out";

export interface FileChange {
path: string;
operation: "create" | "modify" | "delete";
diff: string;
}

export interface ValidationResult {
name: string;
status: "passed" | "failed" | "skipped";
summary?: string;
exitCode?: number;
}

export interface TaskResult {
taskId: string;
status: TaskStatus;
summary: string;
changes: FileChange[];
validations: ValidationResult[];
pendingApproval?: string;
usage?: {
inputTokens?: number;
outputTokens?: number;
model?: string;
provider?: string;
};
}

Il faut distinguer completed de needs_approval. Un patch préparé mais non appliqué ne doit jamais être présenté comme une modification terminée.
3.3 Événements et progression
Pour permettre aux applications embarquées comme aux services distants d'afficher une progression, je choisirais des événements typés.
// packages/core/src/events.ts

export type CodingEvent =
| {
type: "task.started";
taskId: string;
}
| {
type: "plan.created";
taskId: string;
steps: string[];
}
| {
type: "tool.started";
taskId: string;
toolName: string;
}
| {
type: "tool.completed";
taskId: string;
toolName: string;
durationMs: number;
}
| {
type: "patch.proposed";
taskId: string;
files: string[];
}
| {
type: "validation.completed";
taskId: string;
result: ValidationResult;
}
| {
type: "task.completed";
taskId: string;
status: TaskStatus;
};

Les erreurs doivent également être normalisées : ProviderUnavailable, QuotaExceeded, ModelCapabilityMismatch, ToolPermissionDenied, PatchRejected, ExecutionTimeout et TaskCancelled.

Cette normalisation permettra de traiter de manière cohérente une panne de FreeLLMAPI, un quota épuisé ou une erreur de compilation. 4. Interfaces des composants
4.1 Fournisseur de modèles
L'adaptateur FreeLLMAPI doit être un composant remplaçable.
// packages/providers/src/provider.ts

export interface ModelCapabilities {
streaming: boolean;
toolCalling: boolean;
structuredOutput: boolean;
maxContextTokens?: number;
}

export interface ModelRequest {
model: string;
messages: ModelMessage[];
tools?: ModelToolDefinition[];
temperature?: number;
maxOutputTokens?: number;
signal?: AbortSignal;
}

export interface ModelResponse {
message: ModelMessage;
finishReason?: string;
usage?: {
inputTokens?: number;
outputTokens?: number;
};
servedModel?: string;
routedVia?: string;
}

export interface ModelProvider {
readonly id: string;

complete(
request: ModelRequest
): Promise<ModelResponse>;

stream?(
request: ModelRequest
): AsyncIterable<ModelStreamEvent>;

listModels?(): Promise<ModelInfo[]>;
}

ModelMessage, ModelToolDefinition, ModelStreamEvent et ModelInfo seront des types communs à définir dans core, sans importer les types propres au SDK d'un fournisseur.

Je conserverais un contrat minimal : le noyau n'a pas besoin de connaître les clés API, les routes HTTP ou les en-têtes spécifiques à FreeLLMAPI.
4.2 Adaptateur FreeLLMAPI
FreeLLMAPI expose une API compatible OpenAI, avec POST /v1/chat/completions, le streaming, les appels d'outils et les informations de routage dans X-Routed-Via.
GitHub+1

L'adaptateur pourra donc s'appuyer sur le SDK OpenAI en configurant baseURL.
// packages/providers/src/freellmapi.ts

import OpenAI from "openai";

export interface FreeLLMAPIConfig {
baseURL: string;
apiKey: string;
defaultModel: string;
timeoutMs?: number;
}

export function createFreeLLMAPIClient(
config: FreeLLMAPIConfig
) {
return new OpenAI({
baseURL: config.baseURL,
apiKey: config.apiKey,
timeout: config.timeoutMs ?? 60_000,
maxRetries: 0,
});
}

maxRetries: 0 est volontaire dans cet exemple : je préfère centraliser les tentatives dans le runtime et éviter que plusieurs couches réessaient simultanément. Il faudra néanmoins distinguer les erreurs transitoires des erreurs définitives et tenir compte des mécanismes de fallback internes à FreeLLMAPI.

Configuration locale typique :
const provider = createFreeLLMAPIClient({
baseURL: "http://localhost:3001/v1",
apiKey: process.env.FREELLMAPI_API_KEY!,
defaultModel: "auto",
});

C'est un fragment d'initialisation du client HTTP, pas encore l'implémentation complète de ModelProvider.

Règle importante : ne suppose pas que le modèle réellement utilisé est toujours celui demandé. Enregistre les métadonnées de routage retournées par FreeLLMAPI et adapte les tests à la compatibilité effective du modèle.
4.3 Workspace et exploration du projet
Pour gérer plusieurs langages, je séparerais l'accès au système de fichiers de l'intelligence propre aux langages.
// packages/project/src/workspace.ts

export interface WorkspaceInfo {
id: string;
root: string;
}

export interface WorkspaceFile {
path: string;
language?: string;
size: number;
}

export interface Workspace {
getInfo(): Promise<WorkspaceInfo>;

listFiles(options?: {
include?: string[];
exclude?: string[];
maxFiles?: number;
}): Promise<WorkspaceFile[]>;

readFile(path: string): Promise<string>;

exists(path: string): Promise<boolean>;
}

export interface LanguageAdapter {
readonly id: string;
readonly extensions: string[];

detect(workspace: Workspace): Promise<boolean>;

inspect?(
workspace: Workspace
): Promise<ProjectInspection>;
}

Les adaptateurs de langage pourront être ajoutés progressivement :

- TypeScript et JavaScript : package.json, TypeScript compiler API, Tree-sitter.
- Python : pyproject.toml, AST Python, pytest.
- Java : Maven ou Gradle, analyse syntaxique dédiée.
- Rust : Cargo, rustfmt, Clippy et tests Cargo.
  Je ne construirais pas un parseur universel. Le moteur doit d'abord comprendre les fichiers, les dépendances et les commandes de validation ; l'analyse AST avancée vient ensuite, par adaptateur.
  4.4 Outils contrôlés
  Le modèle ne doit pas pouvoir appeler directement le système d'exploitation. Chaque outil est déclaré, validé et exécuté par le runtime.
  // packages/tools/src/tool.ts

export interface ToolContext {
taskId: string;
workspace: Workspace;
signal: AbortSignal;
}

export interface ToolDefinition<TInput, TOutput> {
name: string;
description: string;
inputSchema: unknown;

execute(
input: TInput,
context: ToolContext
): Promise<TOutput>;
}

export interface ToolRegistry {
register<TInput, TOutput>(
tool: ToolDefinition<TInput, TOutput>
): void;

get(name: string):
| ToolDefinition<unknown, unknown>
| undefined;

list(): ToolDefinition<unknown, unknown>[];
}

L'implémentation réelle doit utiliser un schéma validé, par exemple Zod, et contrôler les entrées avant chaque exécution.

Je commencerais avec ces outils :
Outil Permission
list_files Lecture
read_file Lecture
search_code Lecture
inspect_project Lecture
propose_patch Préparation de changements
apply_patch Écriture contrôlée
run_validation Exécution de commandes autorisées

Ne donne pas à l'agent un outil générique execute_shell(command: string) sans garde-fous. Préfère un exécuteur acceptant une commande autorisée, des arguments séparés, un répertoire de travail défini, un timeout et un environnement filtré. 5. Runtime agentique : le cœur du moteur
Le runtime est responsable de la boucle d'exécution. Il transforme une demande utilisateur en une suite d'actions contrôlées.

Je recommande un agent principal unique au MVP, avec des phases distinctes plutôt que plusieurs agents autonomes.

1. Analyse

Comprendre l'objectif et inspecter le dépôt

2. Planification

Découper la tâche en étapes vérifiables

3. Exécution

Appels de modèles et outils autorisés

4. Validation

Vérifier les patchs, lancer les tests et analyser les erreurs

5. Décision

Terminer, demander une approbation ou effectuer une nouvelle tentative limitée

Contrat du moteur
// packages/runtime/src/engine.ts

export interface ExecuteOptions {
signal?: AbortSignal;
onEvent?: (event: CodingEvent) => void;
}

export interface CodingEngine {
execute(
task: CodingTask,
options?: ExecuteOptions
): Promise<TaskResult>;

approve(
taskId: string,
approvalId: string
): Promise<TaskResult>;

cancel(taskId: string): Promise<void>;
}

Les méthodes approve et cancel nécessitent un état de tâche persistant ou un gestionnaire de tâches vivant. En mode embarqué simple, cet état peut rester en mémoire ; en mode serveur, il faut le stocker durablement.

Je définirais aussi une interface TaskStore pour lire, créer, mettre à jour et reprendre une tâche. Les événements ne remplacent pas cet état : un client qui se reconnecte doit pouvoir récupérer le statut courant.
Limites d'exécution
Chaque tâche doit avoir un budget explicite :

- nombre maximal d'itérations de l'agent ;
- nombre maximal d'appels de modèles ;
- budget de tokens ou de coût lorsque l'information est disponible ;
- timeout global et timeout par outil ;
- taille maximale du contexte et des sorties d'outils ;
- nombre maximal de fichiers modifiés.
  Le runtime doit arrêter proprement la tâche lorsqu'un budget est épuisé, au lieu de boucler jusqu'à épuisement des quotas de FreeLLMAPI.

6. Gestion des changements et validation
   Je traiterais les modifications de code comme des transactions logiques, même si le système de fichiers ne fournit pas une transaction atomique multi-fichiers.

Le processus serait :

1. Capturer l'état initial pertinent du workspace.
2. Préparer un patch et vérifier qu'il ne sort pas des chemins autorisés.
3. Contrôler les conflits et les modifications concurrentes.
4. Demander l'approbation lorsque le mode l'exige.
5. Appliquer les changements et enregistrer un checkpoint.
6. Exécuter les validations configurées.
7. Enregistrer le résultat et proposer un rollback si nécessaire.
   Un patch doit être vérifié par rapport au contenu actuel des fichiers. Ne l'applique pas aveuglément si les fichiers ont changé entre sa génération et son application.
   Le rôle de l'adaptateur de validation
   // packages/validation/src/validator.ts

export interface ValidationContext {
workspace: Workspace;
changedFiles: string[];
signal: AbortSignal;
}

export interface Validator {
readonly id: string;

supports(
project: ProjectInspection
): boolean;

validate(
context: ValidationContext
): Promise<ValidationResult[]>;
}

Un adaptateur TypeScript pourra exécuter les scripts définis dans package.json, tandis qu'un adaptateur Python pourra utiliser les commandes de test déclarées dans le projet.

Les commandes doivent provenir d'une configuration de confiance ou d'une liste autorisée, pas d'une instruction générée librement par le modèle. Une sandbox, des limites CPU/mémoire, un réseau désactivé par défaut et un environnement filtré sont recommandés pour les tâches autonomes.

7. Deux modes de déploiement, un seul moteur
   La portabilité doit être une propriété de l'architecture, pas un second moteur à maintenir.
   Mode A — Bibliothèque embarquée
   import { createEngine } from "@coding-engine/runtime";
   import { createFreeLLMAPIProvider } from "@coding-engine/providers";
   import { createLocalWorkspace } from "@coding-engine/project";

const engine = createEngine({
provider: createFreeLLMAPIProvider({
baseURL: process.env.FREELLMAPI_BASE_URL!,
apiKey: process.env.FREELLMAPI_API_KEY!,
defaultModel: "auto",
}),
workspace: createLocalWorkspace({
root: "/path/to/project",
}),
});

const result = await engine.execute({
kind: "modify",
instruction: "Ajoute une validation des entrées utilisateur",
workspaceId: "project-1",
mode: "propose",
});

console.log(result.status);

Les fonctions de création sont des API proposées, à implémenter. En production, le workspace doit être enregistré et autorisé avant de recevoir une tâche.
Mode B — Service backend
Le serveur utilise les mêmes objets internes, mais expose un contrat HTTP stable.
Endpoint Fonction
POST /v1/tasks Créer et démarrer une tâche
GET /v1/tasks/:id Récupérer son état
GET /v1/tasks/:id/events Suivre la progression par SSE
POST /v1/tasks/:id/approve Approuver un changement en attente
POST /v1/tasks/:id/cancel Annuler une tâche
GET /v1/workspaces/:id Consulter les métadonnées d'un workspace autorisé

Pour le transport, je choisirais REST avec Server-Sent Events (SSE) pour la progression. Le WebSocket n'est pas nécessaire au départ.

Le service doit authentifier ses clients, contrôler les droits sur les workspaces, limiter les requêtes et ne jamais accepter un chemin local arbitraire comme autorisation d'accès.
La couche d'abstraction indispensable
Je séparerais le moteur de son environnement d'exécution grâce à trois interfaces :
export interface WorkspaceResolver {
resolve(workspaceId: string): Promise<Workspace>;
}

export interface TaskStore {
create(task: CodingTask): Promise<void>;
get(taskId: string): Promise<TaskRecord | undefined>;
update(record: TaskRecord): Promise<void>;
}

export interface CommandExecutor {
execute(
command: AllowedCommand,
context: ExecutionContext
): Promise<CommandResult>;
}

Une implémentation locale peut utiliser le système de fichiers, SQLite et un exécuteur de processus contrôlé. Une implémentation distante peut utiliser un workspace monté dans un conteneur, une base persistante et un exécuteur isolé.

Cela permet de partager l'orchestration sans supposer que les deux environnements ont le même système de fichiers ou le même modèle de sécurité. 8. Structure du monorepo
Voici la structure que je retiendrais pour la première version. Elle est assez modulaire pour évoluer, mais ne nécessite pas de déployer neuf services distincts.
coding-engine/
├── apps/
│ └── server/
│ └── src/
│ ├── routes/
│ ├── auth/
│ ├── events/
│ └── main.ts
├── packages/
│ ├── core/
│ │ └── src/
│ │ ├── task.ts
│ │ ├── result.ts
│ │ ├── events.ts
│ │ ├── errors.ts
│ │ └── policies.ts
│ ├── runtime/
│ │ └── src/
│ │ ├── engine.ts
│ │ ├── loop.ts
│ │ ├── planner.ts
│ │ ├── budget.ts
│ │ └── cancellation.ts
│ ├── providers/
│ │ └── src/
│ │ ├── provider.ts
│ │ ├── freellmapi.ts
│ │ └── openai-compatible.ts
│ ├── project/
│ │ └── src/
│ │ ├── workspace.ts
│ │ ├── discovery.ts
│ │ ├── ignore.ts
│ │ └── languages/
│ ├── tools/
│ │ └── src/
│ │ ├── registry.ts
│ │ ├── search-code.ts
│ │ ├── read-file.ts
│ │ └── apply-patch.ts
│ ├── execution/
│ │ └── src/
│ │ ├── executor.ts
│ │ └── sandbox.ts
│ ├── validation/
│ │ └── src/
│ ├── storage/
│ │ └── src/
│ └── server/
│ └── src/
│ └── adapter.ts
├── tests/
│ ├── fixtures/
│ ├── contract/
│ ├── integration/
│ └── e2e/
├── examples/
│ ├── embedded/
│ └── backend/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md

apps/server est le point d'entrée déployable ; packages/server contient, si nécessaire, les adaptateurs HTTP réutilisables. Si tu préfères réduire le nombre de packages au début, fusionne ces deux répertoires et extrais-les lorsque la séparation devient utile.

Je choisirais pnpm pour le monorepo, TypeScript en mode strict, Vitest pour les tests et une validation des entrées à l'exécution avec Zod. 9. Stratégie de tests
Le moteur doit être testable sans connexion Internet et sans consommer les quotas gratuits à chaque exécution.

Je construirais quatre niveaux de tests.

Niveau 1 — Tests unitaires

Vérifier les budgets, les transitions d'état, les permissions, la validation des patchs, la normalisation des erreurs et les règles de chemin.

Aucune requête réseau ; modèles simulés.

Niveau 2 — Tests de contrats

Vérifier que chaque ModelProvider, Workspace, TaskStore et CommandExecutor respecte les mêmes comportements attendus.

Utiliser les mêmes suites pour les implémentations locales et distantes.

Niveau 3 — Tests d'intégration

Simuler des appels d'outils, des erreurs de fournisseur, des timeouts, des interruptions et des modifications concurrentes.

Tester le runtime avec un faux fournisseur déterministe.

Niveau 4 — Tests de bout en bout

Utiliser de petits dépôts fixtures TypeScript, Python et Java. Mesurer si une tâche produit un patch valide, respecte les permissions et passe les tests attendus.

Exécuter des tests FreeLLMAPI réels de façon limitée, séparément de la CI standard.

Les scénarios de non-régression prioritaires

- Un modèle retourne du texte au lieu d'un appel d'outil structuré.
- FreeLLMAPI retourne 429, 5xx ou un timeout.
- Un modèle de fallback ne prend pas en charge le tool calling.
- Le modèle propose un chemin en dehors du workspace.
- Un patch est basé sur une ancienne version d'un fichier.
- Un test échoue après l'application du patch.
- Une tâche est annulée pendant l'exécution d'une commande.
- Le service redémarre alors qu'une tâche est en attente d'approbation.
- Deux tâches essaient de modifier le même fichier.
  FreeLLMAPI gère déjà des mécanismes de routage et de fallback. Il faut donc tester le comportement global observé, sans supposer que chaque requête correspond à un seul appel fournisseur.
  GitHub+1

Critères de qualité pour le MVP
Je définirais les critères de sortie suivants :

- aucun changement de fichier en mode analyze ou propose ;
- aucune exécution d'outil sans permission ;
- aucun patch appliqué hors des chemins autorisés ;
- toute tâche terminée possède un statut et un rapport cohérents ;
- les timeouts et annulations ne laissent pas une tâche déclarée comme réussie ;
- une panne du fournisseur produit une erreur structurée ou une reprise contrôlée ;
- les mêmes tests de contrat passent pour le mode embarqué et le mode backend.

10. Plan d'implémentation incrémental
    Je découperais le développement en six phases, chacune livrant une capacité utilisable.

Phase 1 — Foundation
Socle

Contrats, configuration, erreurs, événements, provider FreeLLMAPI et fournisseur simulé.

Livrable : une bibliothèque qui se connecte au modèle et passe ses tests de contrats.

Phase 2 — Project Intelligence

Exploration des fichiers, règles d'exclusion, détection des langages et recherche textuelle.

Livrable : l'agent peut analyser un dépôt et retrouver les fichiers utiles.

Phase 3 — Code Generation & Patch

Génération structurée, propositions de patchs, validation et aperçu des modifications.

Livrable : génération de code et modifications multi-fichiers sans application automatique.

Phase 4 — Agent Runtime

Boucle d'outils, permissions, budgets, annulation, application des patchs et tests.

Livrable : tâches de développement exécutées avec validation et rapport final.

Phase 5 — Persistance et résilience

SQLite au départ, checkpoints, reprise, journal des événements et gestion des erreurs.

Livrable : tâches récupérables après interruption et traçabilité complète.

Phase 6 — Backend portable

API REST, SSE, authentification, autorisations et workspace isolé.

Livrable : la même API métier accessible en bibliothèque ou via HTTP.

Je ne fixerais pas de durée rigide avant d'avoir évalué le dépôt existant et les exigences de sécurité. En revanche, je ferais de chaque phase un jalon vérifiable, sans commencer la suivante tant que les tests critiques de la précédente ne passent pas. 11. Les décisions à verrouiller dès maintenant
Sujet Décision recommandée
Architecture Monorepo modulaire TypeScript
Agent Un agent principal avec plusieurs phases
Fournisseur initial FreeLLMAPI via API OpenAI-compatible
Modèles auto au départ, profils spécifiques après évaluation
Langages Détection générique et adaptateurs progressifs
Modifications Patchs vérifiés et approbation configurable
Persistance Interface TaskStore, SQLite pour la première implémentation
Exécution Commandes autorisées dans un environnement isolé
Transport distant REST + SSE
Observabilité Événements structurés, traces, modèle servi et erreurs
Dépendances Interfaces métier indépendantes des SDK fournisseurs

Un point mérite une attention particulière : le modèle auto de FreeLLMAPI peut choisir des modèles différents au fil du temps. Le moteur doit donc rester résilient aux variations de capacité, de format de réponse et de contexte. Pour une tâche critique, il doit pouvoir détecter qu'un modèle ne fournit pas les capacités requises et arrêter proprement ou sélectionner une stratégie compatible. 12. Ce que je construirais en premier
La première version ne devrait pas encore contenir tout le monorepo présenté. Je commencerais par six modules réellement fonctionnels :

1. core — contrats et erreurs.
2. providers — FreeLLMAPI et fournisseur simulé.
3. project — workspace, détection de langages et recherche.
4. tools — lecture, recherche et propositions de patchs.
5. runtime — orchestration, budgets et événements.
6. validation — vérification des patchs et tests.
   Le serveur HTTP, la persistance avancée, l'indexation AST et les agents spécialisés viendraient ensuite.

La définition de réussite du premier MVP serait la suivante : depuis ton application existante, un appel à engine.execute(task) permet d'analyser un projet réel, de proposer une modification cohérente, de l'appliquer uniquement selon les permissions prévues, de lancer ses tests et de retourner un résultat structuré. Le même contrat doit ensuite pouvoir être exposé via un backend sans réécrire le moteur.

C'est cette API métier stable — et non le choix du modèle IA ou de l'interface — qui constituera le véritable produit réutilisable.
