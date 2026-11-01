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

    it('converts to markdown when format is markdown', async () => {
      const result = await transformToAgentReady(sampleRawHtml, undefined, {
        format: 'markdown',
      });

      expect(result.contentType).toBe('text/markdown; charset=utf-8');
      expect(result.format).toBe('markdown');
      expect(result.content).toContain('# Platform Overview');
      expect(result.content).not.toContain('<h1');
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
      expect(res?.headers.get('X-Agent-Ready-Cache')).toBe('MISS');
      expect(res?.headers.get('X-Agent-Ready-Compression')).toBeDefined();

      const text = await res?.text();
      expect(text).toContain('Acme AI');
      expect(text).toContain('Platform Overview');

      // Second request should hit cache
      const res2 = await middleware(req);
      expect(res2?.headers.get('X-Agent-Ready-Cache')).toBe('HIT');
    });
  });
});
