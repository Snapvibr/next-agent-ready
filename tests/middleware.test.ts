import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAgentReadyMiddleware,
  transformToAgentReady,
} from '../src/middleware/index.js';

describe('middleware', () => {
  const sampleRawHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Demo Page</title>
        <style>.header{color:red;padding:20px;margin:0;display:flex}.btn{background:blue}.hero{font-size:32px}</style>
        <script src="/_next/static/chunks/app.js"></script>
        <script src="/_next/static/chunks/webpack.js"></script>
        <script src="/_next/static/chunks/framework.js"></script>
        <script>(self.__next_f=self.__next_f||[]).push([0,"1:[\"$\",\"div\",null,{\"className\":\"flex p-4\"}]"])</script>
      </head>
      <body>
        <nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav>
        <main>
          <h1>Platform Overview</h1>
          <p>This is the core product.</p>
        </main>
        <aside><p>Sidebar promotional ad banner</p></aside>
        <footer>Footer fluff and legal terms and copyright 2026</footer>
      </body>
    </html>
  `;

  describe('transformToAgentReady', () => {
    it('strips bloat and injects brand grounding', async () => {
      const result = await transformToAgentReady(sampleRawHtml, {
        grounding: {
          brandName: 'SnapVibr Ready',
          canonicalUrl: 'https://snapvibr.com',
          verifiedPricing: [
            { plan: 'Core', price: '$49/mo' },
          ],
        },
      });

      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(result.format).toBe('html');
      expect(result.content).toContain('SnapVibr Ready');
      expect(result.content).toContain('Core');
      expect(result.content).toContain('$49/mo');
      expect(result.content).toContain('Platform Overview');
      expect(result.content).not.toContain('<script');
      expect(result.content).not.toContain('<nav');
      expect(result.tokens.savedTokens).toBeGreaterThan(0);
    });

    it('serves clean semantic HTML even if format is markdown', async () => {
      const result = await transformToAgentReady(sampleRawHtml, undefined, {
        format: 'markdown',
      });

      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(result.format).toBe('html');
      expect(result.content).toContain('Platform Overview');
      expect(result.content).not.toContain('<script');
    });
  });

  describe('createAgentReadyMiddleware', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('passes through non-crawler requests without modification', async () => {
      const middleware = createAgentReadyMiddleware();
      const req = new Request('https://example.com/pricing', {
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      });

      const res = await middleware(req);
      expect(res).toBeUndefined();
    });

    it('intercepts AI crawlers and serves token-compressed semantic HTML with proper headers', async () => {
      // Mock global fetch for upstream request
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(sampleRawHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      );
      vi.stubGlobal('fetch', mockFetch);

      const middleware = createAgentReadyMiddleware({
        grounding: {
          brandName: 'Acme AI',
        },
      });

      const req = new Request('https://example.com/pricing', {
        headers: {
          'user-agent': 'ChatGPT-User/1.0',
        },
      });

      const res = await middleware(req);
      expect(res).toBeDefined();
      expect(res?.status).toBe(200);
      expect(res?.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      expect(res?.headers.get('X-SnapVibr-Agent')).toBe('ready');
      expect(res?.headers.get('X-SnapVibr-Cache')).toBe('MISS');
      expect(res?.headers.get('X-Agent-Ready-Cache')).toBe('MISS');
      expect(res?.headers.get('X-SnapVibr-Raw-Bytes')).toBeDefined();
      expect(res?.headers.get('X-SnapVibr-Clean-Bytes')).toBeDefined();
      expect(res?.headers.get('X-Agent-Ready-Compression')).toBeDefined();

      const text = await res?.text();
      expect(text).toContain('Acme AI');
      expect(text).toContain('Platform Overview');

      // Second request should hit cache
      const res2 = await middleware(req);
      expect(res2?.headers.get('X-Agent-Ready-Cache')).toBe('HIT');
      expect(res2?.headers.get('X-SnapVibr-Cache')).toBe('HIT');
    });

    it('bypasses agent middleware on routes matching remote excludedRoutes', async () => {
      // Mock fetch: first call is remote grounding fetch, second call would be upstream
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/ai-visibility/grounding')) {
          return new Response(JSON.stringify({
            domain: 'example.com',
            enabled: true,
            groundingEnabled: true,
            brandFacts: 'Acme Grounding Facts',
            excludedRoutes: ['/api/*', '/checkout', '/admin*'],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('<h1>Normal Upstream</h1>', { status: 200, headers: { 'Content-Type': 'text/html' } });
      });
      vi.stubGlobal('fetch', mockFetch);

      const middleware = createAgentReadyMiddleware({
        snapvibrApiKey: 'sk_test_remote_bypass',
      });

      // Request on excluded route should return undefined (bypassed)
      const excludedReq = new Request('https://example.com/api/v1/users', {
        headers: { 'user-agent': 'ChatGPT-User/1.0' },
      });
      const excludedRes = await middleware(excludedReq);
      expect(excludedRes).toBeUndefined();

      // Request on non-excluded route should be handled
      const allowedReq = new Request('https://example.com/pricing', {
        headers: { 'user-agent': 'ChatGPT-User/1.0' },
      });
      const allowedRes = await middleware(allowedReq);
      expect(allowedRes).toBeDefined();
      expect(allowedRes?.status).toBe(200);
      expect(allowedRes?.headers.get('X-SnapVibr-Agent')).toBe('ready');
    });
  });
});
