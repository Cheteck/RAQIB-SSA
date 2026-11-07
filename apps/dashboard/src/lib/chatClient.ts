/**
 * Client HTTP du chat RAQIB (dashboard → runtime → LLM).
 *
 * Règle de transparence : en cas d'échec (HTTP, réseau, timeout, réponse vide),
 * on retourne une erreur explicite. Aucune réponse locale ne doit imiter une
 * réponse du LLM.
 */

export const CHAT_TIMEOUT_MS = 60_000;

export interface ChatResult {
  text: string;
  title: string;
  failed: boolean;
  model?: string;
  conversationId?: string;
  context?: {
    systemTokens?: number;
    historyIncluded?: number;
    historyDropped?: number;
    estimatedTokens?: number;
    messagesSent?: number;
  };
}

export interface ChatRequestOptions {
  apiBase: string;
  prompt: string;
  /** Reprend une conversation existante (historique persistant côté runtime). */
  conversationId?: string;
  /** Rattache l'appel à une mission : son état est injecté dans le contexte. */
  missionId?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function backendError(apiBase: string, reason: string): ChatResult {
  return {
    text: `⚠️ Backend indisponible — aucune réponse LLM obtenue (${reason}). Vérifiez que le runtime est démarré sur ${apiBase}.`,
    title: 'Erreur backend',
    failed: true,
  };
}

export async function sendChatPrompt({
  apiBase,
  prompt,
  conversationId,
  missionId,
  fetchImpl = fetch,
  timeoutMs = CHAT_TIMEOUT_MS,
}: ChatRequestOptions): Promise<ChatResult> {
  const timeoutSec = Math.max(1, Math.round(timeoutMs / 1000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: Record<string, unknown> = { prompt };
    if (conversationId) body.conversationId = conversationId;
    if (missionId) body.missionId = missionId;

    let res: Response;
    try {
      res = await fetchImpl(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      let failureConversationId: string | undefined;
      try {
        const errBody = await res.json();
        if (errBody?.error) detail += ` — ${errBody.error}`;
        failureConversationId = errBody?.conversationId;
      } catch {
        // corps d'erreur non JSON : on garde le statut HTTP
      }
      return { ...backendError(apiBase, detail), conversationId: failureConversationId };
    }

    const data = await res.json();
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    const returnedConversationId =
      typeof data?.conversationId === 'string' ? data.conversationId : undefined;
    if (!text) {
      return {
        text: '⚠️ Le modèle a renvoyé une réponse vide. Aucune réponse LLM exploitable.',
        title: 'Réponse vide',
        failed: true,
        model: data?.model,
        conversationId: returnedConversationId,
        context: data?.context,
      };
    }

    return {
      text,
      title: data?.model ? `Réponse · ${data.model}` : 'Réponse RAQIB',
      failed: false,
      model: data?.model,
      conversationId: returnedConversationId,
      context: data?.context,
    };
  } catch (err: any) {
    const reason =
      err?.name === 'AbortError'
        ? `délai dépassé (${timeoutSec} s)`
        : err?.message || 'cause inconnue';
    return backendError(apiBase, reason);
  }
}
