'use client';

import { useContextMetrics } from '../../hooks/useContextMetrics';

export default function ContextPage() {
  const { metrics, loading } = useContextMetrics();

  return (
    <div className="space-y-6">
      <header className="border-b border-[#203548] pb-4">
        <h2 className="text-xl font-bold tracking-wider text-[#62e6ff]">CONTEXT ENGINE // BUDGET DE TOKENS</h2>
        <p className="text-xs text-[#8aa5b8] mt-1">
          Supervision de la fenêtre glissante de contexte et allocation budgétaire de tokens.
        </p>
      </header>

      {loading ? (
        <div className="p-8 text-center text-xs text-[#8aa5b8] animate-pulse">Chargement des métriques de contexte...</div>
      ) : !metrics ? (
        <div className="p-8 border border-red-500/30 bg-red-500/10 rounded text-red-300 text-xs">
          Impossible de contacter l'API Runtime ContextEngine.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-[#203548] bg-[#09131d]/80 p-4 rounded space-y-3">
            <h3 className="text-xs font-bold text-[#7dffc8] tracking-wider">UTILISATION DU BUDGET TOKENS</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Total Budget</span>
                <span className="font-mono text-[#62e6ff]">{metrics.totalBudget} tokens</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Tokens Utilisés</span>
                <span className="font-mono text-amber-300">{metrics.usedTokens} tokens</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Tokens Disponibles</span>
                <span className="font-mono text-emerald-400">{metrics.availableTokens} tokens</span>
              </div>
              <div className="w-full bg-[#04060b] h-3 rounded overflow-hidden border border-[#203548]">
                <div
                  className="bg-[#62e6ff] h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((metrics.usedTokens / metrics.totalBudget) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="border border-[#203548] bg-[#09131d]/80 p-4 rounded space-y-3">
            <h3 className="text-xs font-bold text-[#7dffc8] tracking-wider">VENTILATION PAR COMPOSANT</h3>
            <ul className="space-y-2 text-xs font-mono">
              <li className="flex justify-between border-b border-[#203548]/50 pb-1">
                <span className="text-[#8aa5b8]">Réserve Prompt Système:</span>
                <span>{metrics.systemTokens} tokens</span>
              </li>
              <li className="flex justify-between border-b border-[#203548]/50 pb-1">
                <span className="text-[#8aa5b8]">Réserve Définitions Outils:</span>
                <span>{metrics.toolsTokens} tokens</span>
              </li>
              <li className="flex justify-between border-b border-[#203548]/50 pb-1">
                <span className="text-[#8aa5b8]">Réserve Réponse Attendu:</span>
                <span>{metrics.responseReserve} tokens</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[#8aa5b8]">Stratégie de Comptage:</span>
                <span className="text-[#62e6ff]">{metrics.strategyApplied}</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
