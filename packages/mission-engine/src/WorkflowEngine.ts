import Database from 'better-sqlite3';

export interface WorkflowNode {
  id: string;
  name: string;
  execute: (state: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  priority?: number;
  condition?: (state: Record<string, unknown>) => boolean;
}

export interface WorkflowOptions {
  maxSteps?: number;
  dbPath?: string;
}

export class WorkflowEngine {
  private nodes: Map<string, WorkflowNode> = new Map();
  private edges: WorkflowEdge[] = [];
  private maxSteps: number;
  private db?: Database.Database | null = null;

  constructor(options: WorkflowOptions = {}) {
    this.maxSteps = options.maxSteps ?? 50;
    if (options.dbPath) {
      this.db = new Database(options.dbPath);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS workflow_states (
          workflow_id TEXT PRIMARY KEY,
          current_node_id TEXT NOT NULL,
          state_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    }
  }

  addNode(node: WorkflowNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(from: string, to: string, condition?: (state: Record<string, unknown>) => boolean, priority: number = 0): void {
    this.edges.push({ from, to, condition, priority });
  }

  async run(workflowId: string, startNodeId: string, initialState: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    let currentNodeId: string | undefined = startNodeId;
    let state = { ...initialState };
    let stepCount = 0;

    while (currentNodeId) {
      if (stepCount >= this.maxSteps) {
        throw new Error(`Workflow ${workflowId} exceeded max steps limit of ${this.maxSteps}`);
      }

      const node = this.nodes.get(currentNodeId);
      if (!node) break;

      state = await node.execute(state);
      stepCount++;

      if (this.db) {
        this.db.prepare(`
          INSERT INTO workflow_states (workflow_id, current_node_id, state_json, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(workflow_id) DO UPDATE SET
            current_node_id = excluded.current_node_id,
            state_json = excluded.state_json,
            updated_at = excluded.updated_at
        `).run(workflowId, currentNodeId, JSON.stringify(state), new Date().toISOString());
      }

      const matchingEdges = this.edges
        .filter((e) => e.from === currentNodeId)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      let nextNodeId: string | undefined = undefined;
      for (const edge of matchingEdges) {
        if (!edge.condition || edge.condition(state)) {
          nextNodeId = edge.to;
          break;
        }
      }

      currentNodeId = nextNodeId;
    }

    return state;
  }

  async getSavedState(workflowId: string): Promise<{ currentNodeId: string; state: Record<string, unknown> } | null> {
    if (!this.db) return null;
    const row = this.db.prepare(`
      SELECT current_node_id as currentNodeId, state_json as stateJson FROM workflow_states WHERE workflow_id = ?
    `).get(workflowId) as { currentNodeId: string; stateJson: string } | undefined;

    if (!row) return null;
    return {
      currentNodeId: row.currentNodeId,
      state: JSON.parse(row.stateJson),
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
