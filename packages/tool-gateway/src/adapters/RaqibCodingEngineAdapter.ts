import { CodingTaskRequest, CodingTaskResult, ICodingEngineAdapter } from './OpenCodeAdapter';
import { SDKCodingEngine } from '../../../../coding-engine/packages/runtime/src/engine';
import { LocalWorkspace } from '../../../../coding-engine/packages/project/src/workspace';

export class RaqibCodingEngineAdapter implements ICodingEngineAdapter {
  public name = 'RaqibCodingEngineAdapter';
  private sdkEngine: SDKCodingEngine;

  constructor() {
    this.sdkEngine = new SDKCodingEngine();
  }

  async executeTask(req: CodingTaskRequest): Promise<CodingTaskResult> {
    const startTime = Date.now();
    const workspace = new LocalWorkspace({ id: `ws-${req.taskId}`, root: req.projectPath });

    const result = await this.sdkEngine.execute({
      id: req.taskId,
      kind: 'modify',
      instruction: req.prompt,
      workspaceId: `ws-${req.taskId}`,
      mode: 'apply',
    });

    return {
      taskId: req.taskId,
      success: result.status === 'completed',
      output: result.summary,
      durationMs: Date.now() - startTime,
    };
  }
}
