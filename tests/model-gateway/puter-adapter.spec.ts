import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PuterAdapter, PuterConfig } from '../../packages/model-gateway/src/adapters/puter';

const mockConfig: PuterConfig = {
  name: 'PuterAI',
  baseUrl: 'https://api.puter.com/puterai/openai/v1',
  apiKey: 'test-token',
  model: 'openai/gpt-5.4-nano',
  timeoutMs: 5000,
  costPer1kInput: 0,
  costPer1kOutput: 0,
};

const mockResponse = {
  choices: [
    {
      message: { content: 'Bonjour, comment puis-je aider ?', role: 'assistant' },
    },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
};

describe('PuterAdapter', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('retourne true quand baseUrl et token sont présents', () => {
      const adapter = new PuterAdapter(mockConfig);
      expect(adapter.isEnabled()).toBe(true);
    });

    it('retourne false quand le token est absent', () => {
      const adapter = new PuterAdapter({ ...mockConfig, apiKey: undefined });
      expect(adapter.isEnabled()).toBe(false);
    });

    it('retourne false quand baseUrl est absent', () => {
      const adapter = new PuterAdapter({ ...mockConfig, baseUrl: '' });
      expect(adapter.isEnabled()).toBe(false);
    });

    it('retourne true avec un token depuis la variable d\'environnement', () => {
      process.env.PUTER_AUTH_TOKEN = 'env-token';
      const cfg: PuterConfig = {
        name: 'PuterEnv',
        baseUrl: 'https://api.puter.com/puterai/openai/v1',
        apiKeyEnv: 'PUTER_AUTH_TOKEN',
        model: 'openai/gpt-5.4-nano',
      };
      const adapter = new PuterAdapter(cfg);
      expect(adapter.isEnabled()).toBe(true);
      delete process.env.PUTER_AUTH_TOKEN;
    });
  });

  describe('type et name', () => {
    it('expose type === "puter"', () => {
      const adapter = new PuterAdapter(mockConfig);
      expect(adapter.type).toBe('puter');
    });

    it('expose le nom configuré', () => {
      const adapter = new PuterAdapter(mockConfig);
      expect(adapter.name).toBe('PuterAI');
    });
  });

  describe('complete', () => {
    it('renvoie une ModelResponse correcte', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const adapter = new PuterAdapter(mockConfig);
      const res = await adapter.complete({
        model: 'openai/gpt-5.4-nano',
        messages: [{ role: 'user', content: 'Bonjour' }],
        temperature: 0.1,
        maxTokens: 100,
      });

      expect(res.content).toBe('Bonjour, comment puis-je aider ?');
      expect(res.model).toBe('openai/gpt-5.4-nano');
      expect(res.provider).toBe('PuterAI');
      expect(res.usage?.promptTokens).toBe(12);
      expect(res.usage?.completionTokens).toBe(8);
      expect(res.usage?.totalTokens).toBe(20);
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('envoie le bon endpoint avec le Bearer token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const adapter = new PuterAdapter(mockConfig);
      await adapter.complete({
        model: 'openai/gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(global.fetch).toHaveBeenCalledOnce();
      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('https://api.puter.com/puterai/openai/v1/chat/completions');
      expect(opts.headers['Authorization']).toBe('Bearer test-token');
      expect(opts.headers['Content-Type']).toBe('application/json');
    });

    it('utilise les valeurs par défaut quand req.model est absent', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const adapter = new PuterAdapter(mockConfig);
      await adapter.complete({
        messages: [{ role: 'user', content: 'test' }],
      });

      const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.model).toBe('openai/gpt-5.4-nano');
    });

    it('lève une erreur sur code HTTP 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const adapter = new PuterAdapter(mockConfig);
      await expect(adapter.complete({
        model: 'openai/gpt-5.4-nano',
        messages: [{ role: 'user', content: 'test' }],
      })).rejects.toThrow('Puter API error 401: Unauthorized');
    });

    it('lève une erreur sur timeout', async () => {
      // Le mock fetch respecte le signal d'abort : il ne résout jamais tant que
      // l'adapter n'a pas interrompu la requête via AbortController.
      global.fetch = vi.fn().mockImplementation((_url, opts: RequestInit) => new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted due to timeout')));
      }));

      const adapter = new PuterAdapter({ ...mockConfig, timeoutMs: 50 });

      await expect(adapter.complete({
        model: 'openai/gpt-5.4-nano',
        messages: [{ role: 'user', content: 'test' }],
      })).rejects.toThrow();
    });

    it('estime les coûts à 0 quand costPer1k n\'est pas configuré', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const cfg: PuterConfig = {
        ...mockConfig,
        costPer1kInput: undefined,
        costPer1kOutput: undefined,
      };
      const adapter = new PuterAdapter(cfg);
      const res = await adapter.complete({
        model: 'openai/gpt-5.4-nano',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(res.cost).toEqual({ input: 0, output: 0, total: 0 });
    });

    it('calcule les coûts quand costPer1k est configuré', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const cfg: PuterConfig = {
        ...mockConfig,
        costPer1kInput: 1.5,
        costPer1kOutput: 2.0,
      };
      const adapter = new PuterAdapter(cfg);
      const res = await adapter.complete({
        model: 'openai/gpt-5.4-nano',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(res.cost?.input).toBeCloseTo((12 / 1000) * 1.5, 5);
      expect(res.cost?.output).toBeCloseTo((8 / 1000) * 2.0, 5);
      expect(res.cost?.total).toBe(res.cost?.input + res.cost?.output);
    });

    it('gère une réponse vide sans crash', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const adapter = new PuterAdapter(mockConfig);
      const res = await adapter.complete({
        model: 'openai/gpt-5.4-nano',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(res.content).toBe('');
      expect(res.usage).toEqual({ promptTokens: undefined, completionTokens: undefined, totalTokens: undefined });
    });
  });
});
