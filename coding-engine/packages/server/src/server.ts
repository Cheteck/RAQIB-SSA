import express from "express";
import { SDKCodingEngine } from "../../runtime/src";
import { InMemoryTaskStore, SQLiteTaskStore } from "../../storage/src";

export function createCodingEngineServer(
  engine: SDKCodingEngine,
  store: InMemoryTaskStore | SQLiteTaskStore = new InMemoryTaskStore()
) {
  const app = express();
  app.use(express.json());

  // Bearer Token Authorization Middleware
  app.use((req, res, next) => {
    const requiredToken = process.env.CODING_ENGINE_API_TOKEN;
    if (!requiredToken) {
      return next(); // Dev mode: no token required
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== requiredToken) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing API token" });
    }
    next();
  });

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

  // Server-Sent Events (SSE) for Realtime Progression
  app.get("/v1/tasks/:id/events", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const record = await store.get(req.params.id);
    if (record) {
      res.write(`data: ${JSON.stringify({ type: "task.status", status: record.task.mode })}\n\n`);
    }

    req.on("close", () => {
      res.end();
    });
  });

  app.post("/v1/tasks/:id/approve", async (req, res) => {
    const { approvalId } = req.body;
    const result = await engine.approve(req.params.id, approvalId);
    res.json({ result });
  });

  app.post("/v1/tasks/:id/cancel", async (req, res) => {
    await engine.cancel(req.params.id);
    res.json({ success: true, taskId: req.params.id });
  });

  return app;
}
