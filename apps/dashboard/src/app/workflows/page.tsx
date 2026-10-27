'use client';

import { useState } from 'react';

export default function WorkflowsPage() {
  const [workflowId, setWorkflowId] = useState('wf-self-improve-01');

  return (
    <div className="space-y-6">
      <header className="border-b border-[#203548] pb-4">
        <h2 className="text-xl font-bold tracking-wider text-[#62e6ff]">WORKFLOW ENGINE // GRAPHES MULTI-AGENTS</h2>
        <p className="text-xs text-[#8aa5b8] mt-1">
          Orchestration dynamique sous forme de graphes d'états orientés avec persistance SQLite.
        </p>
      </header>

      <div className="border border-[#203548] bg-[#09131d]/80 p-4 rounded space-y-4">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#04060b] border border-[#203548] p-2 text-xs font-mono text-[#62e6ff] rounded"
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            placeholder="ID du workflow"
          />
        </div>

        <div className="p-8 border border-dashed border-[#203548] text-center text-xs text-[#8aa5b8] rounded space-y-2">
          <p className="text-[#7dffc8] font-bold">MOTEUR DE WORKFLOW RAQIB ACTIF</p>
          <p>
            Les workflows sont orchestrés dynamiquement par <code className="text-[#62e6ff]">WorkflowEngine</code> via des transitions d'états déterministes.
          </p>
        </div>
      </div>
    </div>
  );
}
