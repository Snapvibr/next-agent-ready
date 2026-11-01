import { describe, it, expect } from 'vitest';
import {
  isAiCrawler,
  identifyCrawler,
  getRequestedAgentFormat,
  isAgentReadyRequested,
  matchesRouteFilters,
} from '../src/core/detector.js';

describe('detector', () => {
  describe('isAiCrawler', () => {
    it('detects primary AI crawlers', () => {
      expect(isAiCrawler('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)')).toBe(true);
      expect(isAiCrawler('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toBe(true);
      expect(isAiCrawler('Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)')).toBe(true);
      expect(isAiCrawler('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)')).toBe(true);
      expect(isAiCrawler('Mozilla/5.0 (compatible; DeepSeek; +https://deepseek.com)')).toBe(true);
      expect(isAiCrawler('Mozilla/5.0 (compatible; Google-Extended; +https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)')).toBe(true);
      expect(isAiCrawler('Mozilla/5.0 (compatible; bytespider)')).toBe(true);
    });

    it('returns false for standard consumer browsers', () => {
      expect(isAiCrawler('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36')).toBe(false);
      expect(isAiCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0')).toBe(false);
      expect(isAiCrawler('')).toBe(false);
      expect(isAiCrawler(null)).toBe(false);
    });

    it('supports custom user-agents', () => {
      expect(isAiCrawler('MyCustomAgentBot/2.0', { customUserAgents: ['MyCustomAgentBot'] })).toBe(true);
      expect(isAiCrawler('RandomBot/1.0', { customUserAgents: ['MyCustomAgentBot'] })).toBe(false);
    });
  });

  describe('identifyCrawler', () => {
    it('returns the crawler name', () => {
      expect(identifyCrawler('ChatGPT-User/1.0')).toBe('chatgpt-user');
      expect(identifyCrawler('ClaudeBot/1.0')).toBe('claudebot');
      expect(identifyCrawler('PerplexityBot/1.0')).toBe('perplexitybot');
      expect(identifyCrawler('DeepSeek/1.0')).toBe('deepseek');
      expect(identifyCrawler('Chrome/120.0')).toBeNull();
    });
  });

  describe('getRequestedAgentFormat', () => {
    it('returns html for AI search crawlers requesting normal pages', () => {
      const req = new Request('https://example.com/pricing', {
        headers: {
          'user-agent': 'ChatGPT-User/1.0',
          'accept': 'text/html,application/xhtml+xml',
        },
      });
      expect(getRequestedAgentFormat(req)).toBe('html');
    });

    it('returns markdown when Accept header prioritizes text/markdown', () => {
      const req = new Request('https://example.com/pricing', {
        headers: {
          'user-agent': 'Claude-Code/1.0',
          'accept': 'text/markdown, text/html;q=0.8',
        },
      });
      expect(getRequestedAgentFormat(req)).toBe('markdown');
    });

    it('returns markdown when query param format=markdown is set', () => {
      const req = new Request('https://example.com/pricing?format=markdown');
      expect(getRequestedAgentFormat(req)).toBe('markdown');
    });

    it('returns html when query param agent=ready is set', () => {
      const req = new Request('https://example.com/pricing?agent=ready');
      expect(getRequestedAgentFormat(req)).toBe('html');
    });

    it('returns null for normal browser requests', () => {
      const req = new Request('https://example.com/pricing', {
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        },
      });
      expect(getRequestedAgentFormat(req)).toBeNull();
      expect(isAgentReadyRequested(req)).toBe(false);
    });
  });

  describe('matchesRouteFilters', () => {
    it('includes all by default', () => {
      expect(matchesRouteFilters('/about')).toBe(true);
      expect(matchesRouteFilters('/pricing')).toBe(true);
    });

    it('respects exclude filters', () => {
      const exclude = ['/api/*', '/_next/*', '/favicon.ico'];
      expect(matchesRouteFilters('/api/checkout', undefined, exclude)).toBe(false);
      expect(matchesRouteFilters('/_next/static/chunk.js', undefined, exclude)).toBe(false);
      expect(matchesRouteFilters('/favicon.ico', undefined, exclude)).toBe(false);
      expect(matchesRouteFilters('/about', undefined, exclude)).toBe(true);
    });

    it('respects include filters', () => {
      const include = ['/docs/*', '/pricing'];
      expect(matchesRouteFilters('/docs/intro', include)).toBe(true);
      expect(matchesRouteFilters('/pricing', include)).toBe(true);
      expect(matchesRouteFilters('/blog/post-1', include)).toBe(false);
    });
  });
});
