import { describe, it, expect } from 'vitest';
import {
  isAiCrawler,
  identifyCrawler,
  getCrawlerDisplayName,
  wantsExplicitMarkdown,
  getRequestedAgentFormat,
  isAgentReadyRequested,
  isRouteExcluded,
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
      expect(isAiCrawler('Mozilla/5.0 (compatible; DuckAssistBot/1.0)')).toBe(true);
      expect(isAiCrawler('Mozilla/5.0 (compatible; YouBot/1.0)')).toBe(true);
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

  describe('identifyCrawler and getCrawlerDisplayName', () => {
    it('returns the crawler name and canonical display name', () => {
      expect(identifyCrawler('ChatGPT-User/1.0')).toBe('chatgpt-user');
      expect(getCrawlerDisplayName('chatgpt-user')).toBe('ChatGPT-User');
      expect(identifyCrawler('ClaudeBot/1.0')).toBe('claudebot');
      expect(getCrawlerDisplayName('claudebot')).toBe('ClaudeBot');
      expect(identifyCrawler('PerplexityBot/1.0')).toBe('perplexitybot');
      expect(getCrawlerDisplayName('perplexitybot')).toBe('PerplexityBot');
      expect(identifyCrawler('DeepSeek/1.0')).toBe('deepseek');
      expect(getCrawlerDisplayName('deepseek')).toBe('DeepSeek');
      expect(identifyCrawler('Chrome/120.0')).toBeNull();
      expect(getCrawlerDisplayName(null)).toBe('Accept-Header-Client');
    });
  });

  describe('wantsExplicitMarkdown', () => {
    it('parses q-values correctly', () => {
      expect(wantsExplicitMarkdown('text/markdown, text/html;q=0.8')).toBe(true);
      expect(wantsExplicitMarkdown('text/html;q=0.9, text/markdown;q=0.95')).toBe(true);
      expect(wantsExplicitMarkdown('text/html;q=0.9, text/markdown;q=0.8')).toBe(false);
      expect(wantsExplicitMarkdown('text/html,application/xhtml+xml')).toBe(false);
      expect(wantsExplicitMarkdown('text/x-markdown')).toBe(true);
      expect(wantsExplicitMarkdown(null)).toBe(false);
    });
  });

  describe('isRouteExcluded', () => {
    it('accurately identifies excluded routes with wildcards and normalization', () => {
      const exclusions = ['/api/*', '/admin*', '/private/dashboard'];

      expect(isRouteExcluded('/api/telemetry', exclusions)).toBe(true);
      expect(isRouteExcluded('/api', exclusions)).toBe(true);
      expect(isRouteExcluded('/admin', exclusions)).toBe(true);
      expect(isRouteExcluded('/admin/settings', exclusions)).toBe(true);
      expect(isRouteExcluded('/private/dashboard', exclusions)).toBe(true);
      expect(isRouteExcluded('/private/dashboard/', exclusions)).toBe(true);
      expect(isRouteExcluded('/private/dashboard?tab=overview#section', exclusions)).toBe(true);

      expect(isRouteExcluded('/about', exclusions)).toBe(false);
      expect(isRouteExcluded('/pricing', exclusions)).toBe(false);
      expect(isRouteExcluded('/private/other', exclusions)).toBe(false);
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

    it('returns html when query param format=html is set', () => {
      const req = new Request('https://example.com/pricing?format=html');
      expect(getRequestedAgentFormat(req)).toBe('html');
    });

    it('returns html when query param agent=1 or agent-ready=1 is set', () => {
      expect(getRequestedAgentFormat(new Request('https://example.com/pricing?agent=1'))).toBe('html');
      expect(getRequestedAgentFormat(new Request('https://example.com/pricing?agent-ready=1'))).toBe('html');
      expect(getRequestedAgentFormat(new Request('https://example.com/pricing?agent-ready'))).toBe('html');
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
