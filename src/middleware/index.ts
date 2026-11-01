/**
 * Next.js Edge and Node middleware for next-agent-ready.
 * Intercepts AI crawlers and serves token-compressed semantic HTML with grounded brand facts.
 */

import { stripHtmlBloat } from '../core/html-stripper.js';
import { cleanSemanticHtml } from '../core/semantic-cleaner.js';
import { injectBrandGrounding } from '../core/grounding-injector.js';
import {
  getCrawlerDisplayName,
  getRequestedAgentFormat,
  identifyCrawler,
  isAiCrawler,
  isRouteExcluded,
  matchesRouteFilters,
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

  // 1. Strip layout chrome, client-side bundles, styles, modals, and bloat
  const stripped = stripHtmlBloat(rawHtml, options?.stripper);

  // 2. Clean and normalize semantic structure (headings, tables, lists, links)
  const baseUrl = options?.cleaner?.baseUrl ?? (context?.url ? new URL(context.url).origin : undefined);
  const cleaned = cleanSemanticHtml(stripped, {
    baseUrl,
    ...options?.cleaner,
  });

  // 3. Resolve and inject brand grounding context
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

  const grounded = injectBrandGrounding(cleaned, groundingConfig);

  // 4. If markdown format requested, convert clean semantic HTML to markdown
  let finalContent: string;
  let contentType: string;

  if (format === 'markdown') {
    finalContent = convertSemanticHtmlToMarkdown(grounded);
    contentType = 'text/markdown; charset=utf-8';
  } else {
    finalContent = grounded;
    contentType = 'text/html; charset=utf-8';
  }

  // 5. Allow optional custom user transform hook
  if (typeof options?.transformHtml === 'function') {
    finalContent = await options.transformHtml(finalContent, {
      url: context?.url ?? '',
      userAgent: context?.userAgent ?? '',
      format,
    });
  }

  // 6. Calculate token reduction metrics
  const tokens = calculateTokenCompression(rawHtml, finalContent);

  return {
    content: finalContent,
    contentType,
    format,
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

    if (snapvibrKey && options?.autoFetchRemoteGrounding !== false) {
      try {
        const remote = await fetchRemoteBrandGrounding(url.hostname, snapvibrKey, options?.groundingEndpoint);
        if (remote?.excludedRoutes && isRouteExcluded(pathname, remote.excludedRoutes)) {
          return undefined;
        }
      } catch {
        // Fallback to serving request if remote check fails
      }
    }

    // Check cache
    const cacheKey = `${pathname}:${format}`;
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
          format,
          rawBytes: cached.rawBytes,
          cleanBytes: cached.cleanBytes,
          htmlBytes: format === 'html' ? cached.rawBytes : 0,
          markdownBytes: format === 'markdown' ? cached.cleanBytes : 0,
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
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=600',
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
        format,
        rawBytes,
        cleanBytes,
        htmlBytes: format === 'html' ? rawBytes : 0,
        markdownBytes: format === 'markdown' ? cleanBytes : 0,
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
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=600',
          'Vary': 'Accept, User-Agent',
        },
      });
    } catch {
      // Fallback: continue default pipeline if internal fetch fails
      return undefined;
    }
  };
}
