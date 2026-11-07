import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FreeLLMAPIAdapter } from '../../packages/model-gateway/src/adapters/free-llm-api';

/**
 * F-07 / C13 — le ModelGateway doit suivre la documentation FreeLLMAPI :
 *  - variable documentée `FREELLMAPI_API_KEY`, alias `FREE_LLM_API_KEY` ;
 *  - base locale par défaut (jamais l'hôte public) ;
 *  - fail-closed : sans clé, le provider n'est pas activé.
 */

const originalFetch = global.fetch;
const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of ['FREELLMAPI_API_KEY', 'FREE_LLM_API_KEY', 'FREELLMAPI_BASE_URL', 'FREE_LLM_API_BASE_URL']) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL_ENV[key];
  }
}

describe('FreeLLMAPIAdapter — alignement F-07', () => {
  beforeEach(() => {
    delete process.env.FREELLMAPI_API_KEY;
    delete process.env.FREE_LLM_API_KEY;
    delete process.env.FREELLMAPI_BASE_URL;
    delete process.env.FREE_LLM_API_BASE_URL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    restoreEnv();
  });

  it('est désactivé sans clé (fail-closed)', () => {
    const adapter = new FreeLLMAPIAdapter({});
    expect(adapter.isEnabled()).toBe(false);
  });

  it('est activé avec la variable documentée', () => {
    process.env.FREELLMAPI_API_KEY = 'unified-key';
    const adapter = new FreeLLMAPIAdapter({});
    expect(adapter.isEnabled()).toBe(true);
  });

  it('accepte l’alias transitoire FREE_LLM_API_KEY', () => {
    process.env.FREE_LLM_API_KEY = 'legacy-key';
    const adapter = new FreeLLMAPIAdapter({});
    expect(adapter.isEnabled()).toBe(true);
  });

  it('appelle le proxy local avec la clé en Bearer et l’identification client', async () => {
    process.env.FREELLMAPI_API_KEY = 'unified-key';
    let captured: { url: string; headers: any; body: any } | undefined;

    global.fetch = (async (url: any, init: any) => {
      captured = {
        url: String(url),
        headers: init.headers,
        body: JSON.parse(init.body),
      };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'bonjour' } }],
          usage: { prompt_tokens: 3, completion_tokens: 2 },
        }),
      } as any;
    }) as any;

    const adapter = new FreeLLMAPIAdapter({});
    const res = await adapter.complete({ messages: [{ role: 'user', content: 'salut' }] } as any);

    expect(captured?.url).toBe('http://127.0.0.1:3001/v1/chat/completions');
    expect(captured?.headers.Authorization).toBe('Bearer unified-key');
    expect(captured?.headers['User-Agent']).toBe('RAQIB-SSA/1.0');
    expect(captured?.headers['x-title']).toBe('RAQIB-SSA');
    expect(res.content).toBe('bonjour');
  });

  it('respecte la baseUrl de config/providers.json', async () => {
    process.env.FREELLMAPI_API_KEY = 'k';
    let capturedUrl = '';
    global.fetch = (async (url: any) => {
      capturedUrl = String(url);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '' } }] }) } as any;
    }) as any;

    const adapter = new FreeLLMAPIAdapter({ baseUrl: 'http://192.168.1.10:3001/v1' });
    await adapter.complete({ messages: [{ role: 'user', content: 'x' }] } as any);

    expect(capturedUrl).toBe('http://192.168.1.10:3001/v1/chat/completions');
    expect(capturedUrl).not.toMatch(/freellmapi\.com/);
  });
});
