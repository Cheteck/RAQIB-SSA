import { describe, it, expect, afterEach } from 'vitest';
import { FreeLLMAPIProvider } from '../../coding-engine/packages/providers/src/freellmapi';

/**
 * F-07b — régression : les outils déclarés dans `ModelRequest.tools` doivent
 * réellement être sérialisés dans le corps de la requête. Sans cela, le modèle
 * ne peut jamais répondre par un `tool_calls` et la boucle du Coding Engine
 * (planner → outil → patch → validation) est structurellement impossible.
 */

const originalFetch = global.fetch;

function fakeResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    json: async () => payload,
  } as any;
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('FreeLLMAPIProvider — sérialisation des tools (F-07b)', () => {
  it('envoie tools + tool_choice et remonte toolCalls', async () => {
    let sentBody: any;
    let sentUrl: string | undefined;

    global.fetch = (async (url: any, init: any) => {
      sentUrl = String(url);
      sentBody = JSON.parse(init.body);
      return fakeResponse({
        model: 'gemini-flash',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'apply_patch', arguments: '{"filePath":"a.ts"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 4 },
      });
    }) as any;

    const provider = new FreeLLMAPIProvider({
      baseURL: 'http://127.0.0.1:3001/v1',
      apiKey: 'test-key',
      defaultModel: 'auto',
    });

    const result = await provider.complete({
      model: 'auto',
      messages: [{ role: 'user', content: 'Crée a.ts' }],
      tools: [
        {
          name: 'apply_patch',
          description: 'Applique un patch',
          inputSchema: { type: 'object', properties: { filePath: { type: 'string' } } },
        },
      ],
    });

    expect(sentUrl).toBe('http://127.0.0.1:3001/v1/chat/completions');
    expect(sentBody.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'apply_patch',
          description: 'Applique un patch',
          parameters: { type: 'object', properties: { filePath: { type: 'string' } } },
        },
      },
    ]);
    expect(sentBody.tool_choice).toBe('auto');

    expect(result.toolCalls).toEqual([
      { id: 'call_1', name: 'apply_patch', arguments: '{"filePath":"a.ts"}' },
    ]);
    expect(result.finishReason).toBe('tool_calls');
    expect(result.message.content).toBe('');
  });

  it("n'ajoute aucune clé tools quand la requête n'en déclare pas", async () => {
    let sentBody: any;
    global.fetch = (async (_url: any, init: any) => {
      sentBody = JSON.parse(init.body);
      return fakeResponse({
        model: 'auto',
        choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      });
    }) as any;

    const provider = new FreeLLMAPIProvider({
      baseURL: 'http://127.0.0.1:3001/v1',
      apiKey: 'test-key',
      defaultModel: 'auto',
    });

    const result = await provider.complete({
      model: 'auto',
      messages: [{ role: 'user', content: 'Bonjour' }],
    });

    expect(sentBody).not.toHaveProperty('tools');
    expect(sentBody).not.toHaveProperty('tool_choice');
    expect(result.toolCalls).toBeUndefined();
  });

  it('normalise des arguments non-chaîne sans perdre leur contenu', async () => {
    global.fetch = (async () =>
      fakeResponse({
        model: 'auto',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [{ id: 'c2', function: { name: 'read_file', arguments: { path: 'x.ts' } } }],
            },
            finish_reason: 'tool_calls',
          },
        ],
      })) as any;

    const provider = new FreeLLMAPIProvider({
      baseURL: 'http://127.0.0.1:3001/v1',
      apiKey: 'test-key',
      defaultModel: 'auto',
    });

    const result = await provider.complete({
      model: 'auto',
      messages: [{ role: 'user', content: 'lis x.ts' }],
    });

    expect(result.toolCalls?.[0].arguments).toBe('{"path":"x.ts"}');
  });

  it('C10 : abandonne après timeout et le signale (jamais un succès)', async () => {
    let aborted = false;
    global.fetch = ((_url: any, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborted = true;
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      })) as any;

    const provider = new FreeLLMAPIProvider({
      baseURL: 'http://127.0.0.1:3001/v1',
      apiKey: 'test-key',
      defaultModel: 'auto',
      timeoutMs: 10,
    });

    await expect(
      provider.complete({ model: 'auto', messages: [{ role: 'user', content: 'lent' }] })
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(aborted).toBe(true);
  });

  it('C10 : propage l’annulation de l’appelant', async () => {
    global.fetch = ((_url: any, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      })) as any;

    const provider = new FreeLLMAPIProvider({
      baseURL: 'http://127.0.0.1:3001/v1',
      apiKey: 'test-key',
      defaultModel: 'auto',
      timeoutMs: 5000,
    });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);

    await expect(
      provider.complete({
        model: 'auto',
        messages: [{ role: 'user', content: 'annule' }],
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('C10 : aucun retry automatique sur une erreur HTTP', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls += 1;
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => null },
        json: async () => ({}),
      } as any;
    }) as any;

    const provider = new FreeLLMAPIProvider({
      baseURL: 'http://127.0.0.1:3001/v1',
      apiKey: 'test-key',
      defaultModel: 'auto',
    });

    await expect(
      provider.complete({ model: 'auto', messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toMatchObject({ code: 'HTTP_ERROR' });
    expect(calls).toBe(1);
  });
});
