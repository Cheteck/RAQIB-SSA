import { describe, expect, it, vi } from 'vitest';
import { sendChatPrompt } from '../../apps/dashboard/src/lib/chatClient';

const API_BASE = 'http://localhost:4000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('sendChatPrompt (dashboard → runtime → LLM)', () => {
  it('succès: renvoie le texte du LLM et le modèle', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: any) =>
      jsonResponse({ text: '  Bonjour, je suis un LLM.  ', model: 'auto' }),
    );

    const result = await sendChatPrompt({
      apiBase: API_BASE,
      prompt: 'salut',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.failed).toBe(false);
    expect(result.text).toBe('Bonjour, je suis un LLM.');
    expect(result.title).toContain('auto');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0] as [string, any];
    expect(url).toBe(`${API_BASE}/api/chat`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ prompt: 'salut' });
  });

  it('erreur HTTP: expose le statut et le message backend, sans réponse simulée', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: any) =>
      jsonResponse({ error: 'Budget denied: No budget initialized for mission raqib-chat' }, 502),
    );

    const result = await sendChatPrompt({
      apiBase: API_BASE,
      prompt: 'salut',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.failed).toBe(true);
    expect(result.title).toBe('Erreur backend');
    expect(result.text).toContain('HTTP 502');
    expect(result.text).toContain('Budget denied');
    expect(result.text).not.toContain('Commander');
  });

  it('backend injoignable: erreur explicite, pas de réponse locale', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: any) => {
      throw new TypeError('Failed to fetch');
    });

    const result = await sendChatPrompt({
      apiBase: API_BASE,
      prompt: 'salut',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.failed).toBe(true);
    expect(result.title).toBe('Erreur backend');
    expect(result.text).toContain('aucune réponse LLM');
    expect(result.text).toContain('Failed to fetch');
    expect(result.text).not.toContain('Commander');
  });

  it('timeout: erreur explicite après dépassement du délai', async () => {
    const fetchImpl = vi.fn((_url: string, init: any) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      }),
    );

    const result = await sendChatPrompt({
      apiBase: API_BASE,
      prompt: 'salut',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 25,
    });

    expect(result.failed).toBe(true);
    expect(result.title).toBe('Erreur backend');
    expect(result.text).toContain('délai dépassé');
  });

  it('réponse vide: signalée comme telle, pas comme succès', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: any) =>
      jsonResponse({ text: '   ', model: 'auto' }),
    );

    const result = await sendChatPrompt({
      apiBase: API_BASE,
      prompt: 'salut',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.failed).toBe(true);
    expect(result.title).toBe('Réponse vide');
    expect(result.text).toContain('réponse vide');
  });
});
