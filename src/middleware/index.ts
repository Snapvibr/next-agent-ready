/**
 * Next.js Edge and Node middleware for next-agent-ready.
 * Intercepts AI crawlers and serves token-compressed semantic HTML with grounded brand facts.
 */

import { stripHtmlBloat } from '../core/html-stripper.js';
import { cleanSemanticHtml } from '../core/semantic-cleaner.js';
import { injectBrandGrounding, renderGroundingSection } from '../core/grounding-injector.js';
import {
  getCrawlerDisplayName,
  getRequestedAgentFormat,
  identifyCrawler,
  isAiCrawler,
  isRouteExcluded,
  matchesRouteFilters,
  resolveRouteRule,
} from '../core/detector.js';
import { calculateTokenCompression } from '../core/token-counter.js';
import { convertSemanticHtmlToMarkdown } from '../core/text-serializer.js';
import { fetchRemoteBrandGrounding } from '../core/remote-grounding.js';
import { dispatchTelemetry } from '../telemetry/index.js';
import { MemoryCache } from '../cache/index.js';
import type {
  AgentReadyOptions,
  AgentTelemetryEvent,
  BrandGroundingConfig,
  TokenCounterResult,
} from '../types/index.js';

const INTERNAL_HEADER = 'x-agent-ready-internal';

export interface AgentReadyTransformResult {
  content: string;
  contentType: string;
  format: 'html' | 'markdown';
  tokens: TokenCounterResult;
}

/**
 * Transforms raw HTML into clean semantic HTML or markdown with brand grounding.
 */
export async function transformToAgentReady(
  rawHtml: string,
  options?: AgentReadyOptions,
  context?: { url?: string; format?: 'html' | 'markdown'; userAgent?: string }
): Promise<AgentReadyTransformResult> {
  const format = context?.format ?? 'html';

  let pathname = '/';
  try {
    if (context?.url) {
      pathname = new URL(context.url).pathname || '/';
    }
  } catch {}

  // 1. Resolve and inject brand grounding context
  let groundingConfig: BrandGroundingConfig | undefined;
  if (typeof options?.grounding === 'function') {
    const dummyReq = new Request(context?.url ?? 'http://localhost');
    groundingConfig = await options.grounding(dummyReq);
  } else if (options?.grounding) {
    groundingConfig = options.grounding;
  } else if (options?.autoFetchRemoteGrounding !== false) {
    const snapvibrKey =
      options?.snapvibrApiKey ||
      options?.telemetry?.snapvibrApiKey ||
      (typeof process !== 'undefined' ? process.env?.SNAPVIBR_API_KEY : undefined);
    if (snapvibrKey && context?.url) {
      try {
        const hostname = new URL(context.url).hostname;
        groundingConfig = await fetchRemoteBrandGrounding(hostname, snapvibrKey, options?.groundingEndpoint);
      } catch {
        // Continue without remote grounding if URL is malformed
      }
    }
  }

  // 2. Evaluate per-route minification rules and global minification
  const routeRule = resolveRouteRule(groundingConfig?.routeGrounding, pathname);
  const shouldMinify = (routeRule?.minification === 'enable') ? true :
                       (routeRule?.minification === 'disable') ? false :
                       (groundingConfig?.globalMinificationEnabled ?? true);

  let finalContent: string;

  if (!shouldMinify) {
    // Minification disabled: Inject grounding into raw origin HTML right after opening <body> or <main>
    const groundingSection = groundingConfig ? renderGroundingSection(groundingConfig, pathname) : '';
    if (groundingSection) {
      if (/<main\b[^>]*>/i.test(rawHtml)) {
        finalContent = rawHtml.replace(/(<main\b[^>]*>)/i, `$1\n${groundingSection}`);
      } else if (/<body\b[^>]*>/i.test(rawHtml)) {
        finalContent = rawHtml.replace(/(<body\b[^>]*>)/i, `$1\n${groundingSection}`);
      } else {
        finalContent = groundingSection + rawHtml;
      }
    } else {
      finalContent = rawHtml;
    }
  } else {
    // 3. Strip layout chrome, client-side bundles, styles, modals, and bloat
    const stripped = stripHtmlBloat(rawHtml, options?.stripper);

    // 4. Clean and normalize semantic structure (headings, tables, lists, links)
    const baseUrl = options?.cleaner?.baseUrl ?? (context?.url ? new URL(context.url).origin : undefined);
    const cleaned = cleanSemanticHtml(stripped, {
      baseUrl,
      ...options?.cleaner,
    });

    // 5. Inject Brand Grounding context directly
    finalContent = injectBrandGrounding(cleaned, groundingConfig, pathname);

    // 6. Anti-degradation fallback for empty client-side SPA or redirect shells
    const plainText = cleaned
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (plainText.length < 150) {
      const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title\s*>/i);
      let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const metaDescMatch = rawHtml.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                            rawHtml.match(/<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
      let desc = metaDescMatch ? metaDescMatch[1].trim() : '';
      if (!desc) {
        const jsonLdDesc = rawHtml.match(/"description"\s*:\s*"([^"]+)"/i);
        if (jsonLdDesc) desc = jsonLdDesc[1].replace(/\\"/g, '"');
      }
      if (!title || title.toLowerCase() === 'index') {
        const jsonLdName = rawHtml.match(/"name"\s*:\s*"([^"]+)"/i);
        if (jsonLdName) title = jsonLdName[1].replace(/\\"/g, '"');
      }
      if (title || desc) {
        const fallbackSection = `<section data-agent-fallback="true">\n${title ? `<h1>${title}</h1>\n` : ''}${desc ? `<p>${desc}</p>\n` : ''}</section>\n`;
        if (/<body\b[^>]*>/i.test(finalContent)) {
          finalContent = finalContent.replace(/(<body\b[^>]*>)/i, `$1\n${fallbackSection}`);
        } else if (/<main\b[^>]*>/i.test(finalContent)) {
          finalContent = finalContent.replace(/(<main\b[^>]*>)/i, `$1\n${fallbackSection}`);
        } else {
          finalContent = fallbackSection + finalContent;
        }
      }
    }
  }

  // 6. Deliver trimmed, token-efficient semantic HTML with brand grounding
  const contentType = 'text/html; charset=utf-8';

  // 7. Allow optional custom user transform hook
  if (typeof options?.transformHtml === 'function') {
    finalContent = await options.transformHtml(finalContent, {
      url: context?.url ?? '',
      userAgent: context?.userAgent ?? '',
      format,
    });
  }

  // 8. Calculate token reduction metrics
  const tokens = calculateTokenCompression(rawHtml, finalContent);

  return {
    content: finalContent,
    contentType,
    format: 'html',
    tokens,
  };
}

export interface CachedAgentResponse {
  content: string;
  contentType: string;
  format: 'html' | 'markdown';
  tokens: TokenCounterResult;
  rawBytes: number;
  cleanBytes: number;
}

/**
 * Creates a Next.js middleware that intercepts AI crawlers and returns token-compressed semantic HTML.
 */
export function createAgentReadyMiddleware(options?: AgentReadyOptions) {
  const cache = options?.cache?.enabled !== false
    ? new MemoryCache<CachedAgentResponse>(
        options?.cache?.maxEntries ?? 500,
        options?.cache?.ttlMs ?? 300000
      )
    : null;

  return async function middleware(
    request: Request & { nextUrl?: { pathname: string } },
    event?: { waitUntil?: (p: Promise<unknown>) => void }
  ): Promise<Response | undefined> {
    const startTime = Date.now();

    // Prevent recursive self-fetching
    if (request.headers.get(INTERNAL_HEADER) === '1') {
      return undefined;
    }

    const url = new URL(request.url);
    const pathname = request.nextUrl?.pathname ?? url.pathname;

    // Check include / exclude route filters
    if (!matchesRouteFilters(pathname, options?.include, options?.exclude)) {
      return undefined;
    }

    // Check if the request is from an AI crawler or explicitly requests agent format
    const format = getRequestedAgentFormat(request, options?.detection);
    if (!format) {
      return undefined;
    }

    const userAgent = request.headers.get('user-agent') ?? '';
    const rawCrawler = identifyCrawler(userAgent, options?.detection?.customUserAgents);
    const crawlerName = rawCrawler ?? 'Accept-Header-Client';
    const botDisplayName = getCrawlerDisplayName(rawCrawler);
    const siteId =
      options?.siteId ||
      (typeof process !== 'undefined' ? process.env?.SNAPVIBR_SITE_ID : undefined) ||
      url.hostname;
    const isBot = isAiCrawler(userAgent, options?.detection);
    const sample = request.headers.get('x-snapvibr-test') === '1' || !isBot;

    // Check remote excluded routes if SnapVibr API key is present
    const snapvibrKey =
      options?.snapvibrApiKey ||
      options?.telemetry?.snapvibrApiKey ||
      (typeof process !== 'undefined' ? process.env?.SNAPVIBR_API_KEY : undefined);

    let remote: (BrandGroundingConfig & { excludedRoutes?: string[] }) | undefined;
    if (snapvibrKey && options?.autoFetchRemoteGrounding !== false) {
      try {
        remote = await fetchRemoteBrandGrounding(url.hostname, snapvibrKey, options?.groundingEndpoint);
        if (remote?.excludedRoutes && isRouteExcluded(pathname, remote.excludedRoutes)) {
          return undefined;
        }
      } catch {
        // Fallback to serving request if remote check fails
      }
    }

    // Check cache (using cache epoch if available from remote config)
    const epoch = remote?.cacheEpoch ?? 1;
    const cacheKey = `${pathname}:${format}:${epoch}`;
    if (cache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        const durationMs = Date.now() - startTime;
        const effectiveTelemetry = {
          ...options?.telemetry,
          snapvibrApiKey:
            options?.telemetry?.snapvibrApiKey ??
            options?.snapvibrApiKey ??
            (typeof process !== 'undefined' ? process.env?.SNAPVIBR_API_KEY : undefined),
        };

        const telemetryPayload: AgentTelemetryEvent = {
          domain: url.hostname,
          siteId,
          path: pathname,
          bot: botDisplayName,
          userAgent,
          status: 200,
          cached: true,
          sample,
          durationMs,
          format: 'clean-html',
          rawBytes: cached.rawBytes,
          cleanBytes: cached.cleanBytes,
          htmlBytes: cached.rawBytes,
          markdownBytes: cached.cleanBytes,
          rawTokens: cached.tokens.rawTokens,
          cleanTokens: cached.tokens.cleanTokens,
          savedTokens: cached.tokens.savedTokens,
          reductionPercentage: cached.tokens.reductionPercentage,
          timestamp: Date.now(),
          // Compatibility aliases
          crawler: crawlerName,
          statusCode: 200,
          cacheHit: true,
        };

        dispatchTelemetry(telemetryPayload, effectiveTelemetry, event?.waitUntil);

        return new Response(cached.content, {
          status: 200,
          headers: {
            'Content-Type': cached.contentType,
            'X-SnapVibr-Agent': 'ready',
            'X-SnapVibr-Cache': 'HIT',
            'X-Agent-Ready-Cache': 'HIT',
            'X-Agent-Ready-Tokens-Raw': String(cached.tokens.rawTokens),
            'X-Agent-Ready-Tokens-Clean': String(cached.tokens.cleanTokens),
            'X-Agent-Ready-Compression': `${cached.tokens.reductionPercentage}%`,
            'X-SnapVibr-Raw-Bytes': String(cached.rawBytes),
            'X-SnapVibr-Clean-Bytes': String(cached.cleanBytes),
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            'Vary': 'Accept, User-Agent',
          },
        });
      }
    }

    // Clone request headers and add internal loop protection
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set(INTERNAL_HEADER, '1');

    try {
      const upstreamRes = await fetch(request.url, {
        headers: upstreamHeaders,
        method: request.method,
      });

      const contentType = upstreamRes.headers.get('content-type') ?? '';
      // Only process HTML upstream responses
      if (!upstreamRes.ok || !contentType.includes('text/html')) {
        return upstreamRes;
      }

      const rawHtml = await upstreamRes.text();
      const rawBytes = new TextEncoder().encode(rawHtml).byteLength;

      // Transform HTML
      const transformed = await transformToAgentReady(rawHtml, options, {
        url: request.url,
        format,
        userAgent,
      });

      const cleanBytes = new TextEncoder().encode(transformed.content).byteLength;

      // Save to cache
      if (cache) {
        cache.set(cacheKey, {
          ...transformed,
          rawBytes,
          cleanBytes,
        });
      }

      const durationMs = Date.now() - startTime;

      // Dispatch non-blocking telemetry
      const telemetryEvent: AgentTelemetryEvent = {
        domain: url.hostname,
        siteId,
        path: pathname,
        bot: botDisplayName,
        userAgent,
        status: upstreamRes.status,
        cached: false,
        sample,
        durationMs,
        format: 'clean-html',
        rawBytes,
        cleanBytes,
        htmlBytes: rawBytes,
        markdownBytes: cleanBytes,
        rawTokens: transformed.tokens.rawTokens,
        cleanTokens: transformed.tokens.cleanTokens,
        savedTokens: transformed.tokens.savedTokens,
        reductionPercentage: transformed.tokens.reductionPercentage,
        timestamp: Date.now(),
        // Compatibility aliases
        crawler: crawlerName,
        statusCode: upstreamRes.status,
        cacheHit: false,
      };

      const effectiveTelemetry = {
        ...options?.telemetry,
        snapvibrApiKey:
          options?.telemetry?.snapvibrApiKey ??
          options?.snapvibrApiKey ??
          (typeof process !== 'undefined' ? process.env?.SNAPVIBR_API_KEY : undefined),
      };

      dispatchTelemetry(telemetryEvent, effectiveTelemetry, event?.waitUntil);

      return new Response(transformed.content, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': transformed.contentType,
          'X-SnapVibr-Agent': 'ready',
          'X-SnapVibr-Cache': 'MISS',
          'X-Agent-Ready-Cache': 'MISS',
          'X-Agent-Ready-Tokens-Raw': String(transformed.tokens.rawTokens),
          'X-Agent-Ready-Tokens-Clean': String(transformed.tokens.cleanTokens),
          'X-Agent-Ready-Compression': `${transformed.tokens.reductionPercentage}%`,
          'X-SnapVibr-Raw-Bytes': String(rawBytes),
          'X-SnapVibr-Clean-Bytes': String(cleanBytes),
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'Vary': 'Accept, User-Agent',
        },
      });
    } catch {
      // Fallback: continue default pipeline if internal fetch fails
      return undefined;
    }
  };
}
