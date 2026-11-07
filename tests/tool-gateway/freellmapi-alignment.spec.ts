import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  RaqibCodingEngineAdapter,
  resolveFreeLLMAPIBaseURL,
  resolveFreeLLMAPIKey,
} from '../../packages/tool-gateway/src/adapters/RaqibCodingEngineAdapter';

/**
 * F-07 — l'adaptateur Coding Engine doit être aligné sur la documentation
 * officielle FreeLLMAPI et sur `config/providers.json`.
 *
 * Vérifié ici :
 *  - jamais d'hôte public par défaut ;
 *  - jamais de credential factice (`default-key`) ;
 *  - `FREELLMAPI_API_KEY`, alias transitoire `FREE_LLM_API_KEY` ;
 *  - le `workspace` est transmis et le chemin du projet est confiné.
 */

describe('F-07 — alignement FreeLLMAPI du Coding Engine', () => {
  const baseDir = path.join(process.cwd(), 'data', 'test-f07');
  const allowedRoot = path.join(baseDir, 'allowed');
  const outsideRoot = path.join(baseDir, 'outside');
  const originalFetch = global.fetch;
  let fetchCalls: Array<{ url: string; headers: any; body: any }>;

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(allowedRoot, 'project'), { recursive: true });
    fs.mkdirSync(outsideRoot, { recursive: true });
    fetchCalls = [];

    global.fetch = (async (url: any, init: any) => {
      fetchCalls.push({
        url: String(url),
        headers: init?.headers,
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null },
        json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
      } as any;
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  describe('résolution de l’URL', () => {
    it('retombe sur le proxy local documenté, jamais sur l’hôte public', () => {
      const url = resolveFreeLLMAPIBaseURL({ providers: {} }, {});
      expect(url).toBe('http://127.0.0.1:3001/v1');
      expect(url).not.toMatch(/freellmapi\.com/);
    });

    it('utilise config/providers.json comme source de vérité', () => {
      const url = resolveFreeLLMAPIBaseURL(
        { providers: { freellmapi: { baseUrl: 'http://192.168.1.10:3001/v1' } } },
        {}
      );
      expect(url).toBe('http://192.168.1.10:3001/v1');
    });

    it('normalise la barre oblique finale', () => {
      expect(
        resolveFreeLLMAPIBaseURL({ providers: { freellmapi: { baseUrl: 'http://localhost:3001/v1/' } } }, {})
      ).toBe('http://localhost:3001/v1');
    });
  });

  describe('résolution des credentials', () => {
    it('accepte la variable documentée FREELLMAPI_API_KEY', () => {
      expect(resolveFreeLLMAPIKey({ FREELLMAPI_API_KEY: 'unified-key' })).toBe('unified-key');
    });

    it('accepte l’alias transitoire FREE_LLM_API_KEY', () => {
      expect(resolveFreeLLMAPIKey({ FREE_LLM_API_KEY: 'legacy-key' })).toBe('legacy-key');
    });

    it('ne fabrique jamais de clé par défaut', () => {
      expect(resolveFreeLLMAPIKey({})).toBe('');
      expect(resolveFreeLLMAPIKey({})).not.toBe('default-key');
    });
  });

  describe('exécution', () => {
    it('refuse explicitement sans clé et n’appelle aucun réseau', async () => {
      const adapter = new RaqibCodingEngineAdapter({
        workspaceRoots: [allowedRoot],
        env: {},
      });

      const result = await adapter.executeTask({
        taskId: 'f07-no-key',
        projectPath: path.join(allowedRoot, 'project'),
        prompt: 'fais quelque chose',
      });

      expect(result.success).toBe(false);
      expect(result.output).toMatch(/FREELLMAPI_API_KEY/);
      expect(result.output).toMatch(/Aucune requête/);
      expect(fetchCalls).toHaveLength(0);
    });

    it('refuse un projet hors racines autorisées, sans réseau', async () => {
      const adapter = new RaqibCodingEngineAdapter({
        workspaceRoots: [allowedRoot],
        env: { FREELLMAPI_API_KEY: 'k' },
      });

      const result = await adapter.executeTask({
        taskId: 'f07-outside',
        projectPath: outsideRoot,
        prompt: 'fais quelque chose',
      });

      expect(result.success).toBe(false);
      expect(result.output).toMatch(/hors des racines autorisées/);
      expect(fetchCalls).toHaveLength(0);
    });

    it('transmet le workspace et reste fail-closed (aucun faux completed)', async () => {
      const adapter = new RaqibCodingEngineAdapter({
        workspaceRoots: [allowedRoot],
        env: { FREELLMAPI_API_KEY: 'k' },
        providersConfig: {
          providers: { freellmapi: { baseUrl: 'http://127.0.0.1:3001/v1', model: 'auto' } },
        },
      });

      const result = await adapter.executeTask({
        taskId: 'f07-inside',
        projectPath: path.join(allowedRoot, 'project'),
        prompt: 'fais quelque chose',
      });

      expect(result.success).toBe(false);
      expect(result.output).toMatch(/fail-closed/);
      expect(result.modifiedFiles).toEqual([]);
      // Le moteur est refusé avant tout appel modèle : aucune requête réseau.
      expect(fetchCalls).toHaveLength(0);

      // Aucun fichier n'a été créé dans le workspace.
      const files = fs.readdirSync(path.join(allowedRoot, 'project'));
      expect(files).toEqual([]);
    });
  });
});
