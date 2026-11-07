'use client';

import { useState, useCallback } from 'react';

export interface UsePuterAiOptions {
  /** Modèle à utiliser (ex: 'openai/gpt-5.4-nano', 'openai/gpt-4o') */
  model?: string;
  /** Température (0.0–1.8) — bas pour déterministe, haut pour créatif */
  temperature?: number;
  /** Limite de tokens en sortie */
  maxTokens?: number;
}

/**
 * Hook pour appels IA non critiques via l'API HTTP de Puter.
 *
 * ⚠️ **Limites importantes :**
 * - **Coûts facturés à l'utilisateur final** (modèle User-Pays de Puter)
 * - **Pas de contrôle budgétaire RAQIB** (BudgetChecker non appliqué)
 * - **Pas de journalisation** dans l'Audit Ledger
 * - **Dépendance réseau** (nécessite connexion Internet vers api.puter.com)
 * - **Pas de filtrage automatique** des données sensibles
 *
 * **Cas d'usage recommandés :**
 * - Reformulation de requêtes utilisateur
 * - Classification de tâches (indicative)
 * - Explications de concepts techniques
 * - Correction orthographique et style
 * - Génération de commentaires de code (non sensible)
 * - Démo / prototype de l'interface
 *
 * **À éviter :**
 * - Décisions de mission critiques
 * - Données sensibles ou secrets
 * - Appels nécessitant un audit réglementaire
 *
 * @see https://developer.puter.com/tutorials/use-openai-sdk-with-puter/
 */
export function usePuterAi(options: UsePuterAiOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ promptTokens?: number; completionTokens?: number; totalTokens?: number } | null>(null);

  const ask = useCallback(async (prompt: string, messages?: Array<{ role: string; content: string }>) => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setUsage(null);

    try {
      const token = process.env.NEXT_PUBLIC_PUTER_AUTH_TOKEN;
      if (!token) {
        throw new Error('NEXT_PUBLIC_PUTER_AUTH_TOKEN non configuré');
      }

      const res = await fetch('https://api.puter.com/puterai/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: options.model || 'openai/gpt-5.4-nano',
          messages: messages || [{ role: 'user', content: prompt }],
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 500,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Puter API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      setResponse(text);
      setUsage(data.usage || null);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Puter AI error';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  return { ask, loading, error, response, usage };
}
