'use client';

import { useState } from 'react';
import { useMemory } from '../../hooks/useMemory';

export default function MemoryPage() {
  const [namespace, setNamespace] = useState('global');
  const [threadId, setThreadId] = useState('');
  const { memories, loading, refetch } = useMemory(namespace, threadId || undefined);

  return (
    <div className="space-y-6">
      <header className="border-b border-[#203548] pb-4">
        <h2 className="text-xl font-bold tracking-wider text-[#62e6ff]">MEMORY ENGINE // MÉMOIRE MULTI-TIER</h2>
        <p className="text-xs text-[#8aa5b8] mt-1">
          Consultation des mémoires de travail (Checkpoints), épisodiques et sémantiques.
        </p>
      </header>

      <div className="flex gap-4 bg-[#09131d]/80 p-4 border border-[#203548] rounded">
        <div className="flex-1">
          <label className="block text-xs font-bold text-[#8aa5b8] mb-1">Espace de Noms (Namespace)</label>
          <input
            className="w-full bg-[#04060b] border border-[#203548] p-2 text-xs font-mono text-[#62e6ff] rounded"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-[#8aa5b8] mb-1">ID Fil (Thread ID Optionnel)</label>
          <input
            className="w-full bg-[#04060b] border border-[#203548] p-2 text-xs font-mono text-[#62e6ff] rounded"
            placeholder="e.g. thread-100"
            value={threadId}
            onChange={(e) => setThreadId(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-[#8aa5b8] animate-pulse">Chargement de la mémoire...</div>
      ) : memories.length === 0 ? (
        <div className="p-8 border border-[#203548] bg-[#09131d]/80 text-center text-xs text-[#8aa5b8] rounded">
          Aucun enregistrement mémoire trouvé pour le namespace '{namespace}'.
        </div>
      ) : (
        <div className="space-y-3 font-mono text-xs">
          {memories.map((mem) => (
            <div key={mem.id} className="border border-[#203548] bg-[#09131d]/80 p-3 rounded space-y-2">
              <div className="flex justify-between items-center text-[#7dffc8]">
                <span className="font-bold">{mem.key}</span>
                <span className="text-[10px] bg-[#203548] px-2 py-0.5 rounded text-[#62e6ff]">{mem.type}</span>
              </div>
              <pre className="p-2 bg-[#04060b] text-[#d9e6ef] overflow-x-auto rounded border border-[#203548]/50">
                {mem.value}
              </pre>
              <div className="text-[10px] text-[#8aa5b8] flex justify-between">
                <span>Fil: {mem.threadId || 'Global'}</span>
                <span>Modifié le: {new Date(mem.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
