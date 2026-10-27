'use client';

import { useState } from 'react';
import { api } from '../../lib/api';

export default function CodingEnginePage() {
  const [prompt, setPrompt] = useState('');
  const [projectPath, setProjectPath] = useState('.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRunTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await api.post('/api/opencode/execute', {
        taskId: `coding-task-${Date.now()}`,
        projectPath,
        prompt,
      });
      setResult(res);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-[#203548] pb-4">
        <h2 className="text-xl font-bold tracking-wider text-[#62e6ff]">CODING ENGINE SDK // MOTEUR DE CODAGE IA</h2>
        <p className="text-xs text-[#8aa5b8] mt-1">
          Exécution agentique de tâches de codage, génération de diffs et validation autonome.
        </p>
      </header>

      <form onSubmit={handleRunTask} className="border border-[#203548] bg-[#09131d]/80 p-4 rounded space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#8aa5b8] mb-1">Chemin du Workspace</label>
          <input
            className="w-full bg-[#04060b] border border-[#203548] p-2 text-xs font-mono text-[#62e6ff] rounded"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#8aa5b8] mb-1">Instruction de Codage / Prompt</label>
          <textarea
            className="w-full bg-[#04060b] border border-[#203548] p-2 text-xs font-mono text-[#62e6ff] rounded h-24"
            placeholder="e.g. Refactoriser les utilitaires et ajouter des validations de types..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#203548] hover:bg-[#62e6ff]/20 text-[#62e6ff] border border-[#62e6ff]/30 py-2 rounded text-xs font-bold transition-colors"
        >
          {loading ? 'Exécution de la tâche en cours...' : 'Lancer la Tâche de Codage'}
        </button>
      </form>

      {result && (
        <div className="border border-[#203548] bg-[#09131d]/80 p-4 rounded space-y-2">
          <h3 className="text-xs font-bold text-[#7dffc8]">RÉSULTAT DU CODING ENGINE</h3>
          <pre className="p-3 bg-[#04060b] text-[#d9e6ef] font-mono text-xs overflow-x-auto rounded border border-[#203548]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
