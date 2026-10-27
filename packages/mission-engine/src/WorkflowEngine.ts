export interface WorkflowNode {
  id: string;
  name: string;
  execute: (state: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: (state: Record<string, unknown>) => boolean;
}

export class WorkflowEngine {
  private nodes: Map<string, WorkflowNode> = new Map();
  private edges: WorkflowEdge[] = [];

  addNode(node: WorkflowNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(from: string, to: string, condition?: (state: Record<string, unknown>) => boolean): void {
    this.edges.push({ from, to, condition });
  }

  async run(startNodeId: string, initialState: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    let currentNodeId: string | undefined = startNodeId;
    let state = { ...initialState };

    while (currentNodeId) {
      const node = this.nodes.get(currentNodeId);
      if (!node) break;

      state = await node.execute(state);

      const matchingEdges = this.edges.filter((e) => e.from === currentNodeId);
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
}
