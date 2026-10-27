import express from "express";
import { SDKCodingEngine } from "../../runtime/src";
import { InMemoryTaskStore } from "../../storage/src";

export function createCodingEngineServer(engine: SDKCodingEngine, store = new InMemoryTaskStore()) {
  const app = express();
  app.use(express.json());

  app.post("/v1/tasks", async (req, res) => {
    try {
      const task = req.body;
      await store.create(task);
      const result = await engine.execute(task);
      await store.update({ task, result, updatedAt: new Date().toISOString() });
      res.status(201).json({ result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/v1/tasks/:id", async (req, res) => {
    const record = await store.get(req.params.id);
    if (!record) return res.status(404).json({ error: "Task not found" });
    res.json(record);
  });

  app.post("/v1/tasks/:id/approve", async (req, res) => {
    const { approvalId } = req.body;
    const result = await engine.approve(req.params.id, approvalId);
    res.json({ result });
  });

  return app;
}
