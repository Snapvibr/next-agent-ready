/**
 * User-agent detection and content negotiation for next-agent-ready.
 */

import type { DetectionOptions } from '../types/index.js';

export const DEFAULT_AI_CRAWLERS: readonly string[] = [
  'chatgpt-user',
  'gptbot',
  'chatgpt',
  'oai-searchbot',
  'claudebot',
  'claude-web',
  'anthropic-ai',
  'perplexitybot',
  'perplexity',
  'applebot-extended',
  'applebot',
  'deepseekbot',
  'deepseek',
  'google-extended',
  'gemini',
  'cohere-ai',
  'meta-externalagent',
  'facebookbot',
  'bytespider',
  'diffbot',
  'ccbot',
  'amazonbot',
  'youbot',
  'duckassistbot',
];

export const DEFAULT_QUERY_PARAM_KEYS: readonly string[] = [
  'agent',
  'agent-ready',
  'agent_ready',
  'format',
  'md',
];

const BOT_DISPLAY_MAP: Record<string, string> = {
  'chatgpt-user': 'ChatGPT-User',
  'gptbot': 'GPTBot',
  'chatgpt': 'ChatGPT-User',
  'oai-searchbot': 'OAI-SearchBot',
  'claudebot': 'ClaudeBot',
  'claude-web': 'Claude-Web',
  'anthropic-ai': 'anthropic-ai',
  'perplexitybot': 'PerplexityBot',
  'perplexity': 'PerplexityBot',
  'applebot-extended': 'Applebot-Extended',
  'applebot': 'Applebot',
  'deepseekbot': 'DeepSeekBot',
  'deepseek': 'DeepSeek',
  'google-extended': 'Google-Extended',
  'gemini': 'Gemini',
  'cohere-ai': 'cohere-ai',
  'meta-externalagent': 'Meta-ExternalAgent',
  'facebookbot': 'FacebookBot',
  'bytespider': 'Bytespider',
  'diffbot': 'Diffbot',
  'ccbot': 'CCBot',
  'amazonbot': 'Amazonbot',
  'youbot': 'YouBot',
  'duckassistbot': 'DuckAssistBot',
};

/**
 * Extracts a header safely across standard Web Request and mock objects.
 */
export function getHeader(
  request: Request | { headers: Headers | Record<string, string>; url?: string },
  headerName: string
): string | null {
  if (!request || !('headers' in request) || !request.headers) {
    return null;
  }

  const target = headerName.toLowerCase();
  if (typeof (request.headers as Headers).get === 'function') {
    return (request.headers as Headers).get(target);
  }

  const record = request.headers as Record<string, string>;
  return record[target] ?? record[headerName] ?? null;
}

/**
 * Determines which crawler is making the request, returning its identifier or null.
 */
export function identifyCrawler(userAgent?: string | null, customAgents?: string[]): string | null {
  if (!userAgent) return null;
  const lower = userAgent.toLowerCase();
  const allAgents = customAgents
    ? [...customAgents.map((a) => a.toLowerCase()), ...DEFAULT_AI_CRAWLERS]
    : DEFAULT_AI_CRAWLERS;

  for (const bot of allAgents) {
    if (lower.includes(bot)) {
      return bot;
    }
  }
  return null;
}

/**
 * Returns canonical display name for a detected crawler identifier.
 */
export function getCrawlerDisplayName(bot?: string | null): string {
  if (!bot) return 'Accept-Header-Client';
  const lower = bot.toLowerCase();
  return BOT_DISPLAY_MAP[lower] || bot;
}

/**
 * Checks if the user agent belongs to a known AI crawler.
 */
export function isAiCrawler(userAgent?: string | null, options?: DetectionOptions): boolean {
  return identifyCrawler(userAgent, options?.customUserAgents) !== null;
}

/**
 * Parses Accept header and determines if client explicitly requests Markdown
 * while respecting quality values (q-values).
 */
export function wantsExplicitMarkdown(acceptHeader?: string | null): boolean {
  if (!acceptHeader || !/text\/(?:x-)?markdown/i.test(acceptHeader)) return false;
  const entries = acceptHeader.split(',').map((entry) => {
    const [type, ...params] = entry.trim().split(';');
    let q = 1.0;
    for (const param of params) {
      const match = param.trim().match(/^q=([0-9.]+)/i);
      if (match) q = parseFloat(match[1]) || 0;
    }
    return { type: type.trim().toLowerCase(), q };
  });

  const mdEntry = entries.find((e) => e.type === 'text/markdown' || e.type === 'text/x-markdown');
  if (!mdEntry || mdEntry.q <= 0) return false;
  const htmlEntry = entries.find((e) => e.type === 'text/html');
  if (htmlEntry && htmlEntry.q > mdEntry.q) return false;
  return true;
}

/**
 * Determines if the request is an AI crawler or agent-ready query/accept request.
 * Always returns 'html' for agent requests to ensure trimmed semantic HTML is served.
 * Returns null if not an AI agent request.
 */
export function getRequestedAgentFormat(
  request: Request | { headers: Headers | Record<string, string>; url: string },
  options?: DetectionOptions
): 'html' | null {
  // 1. Query parameter check
  try {
    const url = new URL(request.url, 'http://localhost');
    const paramKeys = options?.queryParamKeys ?? DEFAULT_QUERY_PARAM_KEYS;

    for (const key of paramKeys) {
      const val = url.searchParams.get(key);
      if (val !== null) {
        return 'html';
      }
    }
  } catch {
    // If URL parsing fails, continue to headers
  }

  // 2. Accept Header negotiation
  const acceptHeader = getHeader(request, 'accept');
  if (wantsExplicitMarkdown(acceptHeader)) {
    return 'html';
  }

  // 3. User-Agent detection
  if (!options?.disableUserAgentDetection) {
    const userAgent = getHeader(request, 'user-agent');
    if (isAiCrawler(userAgent, options)) {
      // AI Crawlers (ChatGPT-User, ClaudeBot, Perplexity, DeepSeek, etc.) expect semantic HTML
      return 'html';
    }
  }

  return null;
}

/**
 * Checks if current request path matches route exclusions.
 * Directly aligns with Cloudflare Worker and WordPress plugin route exclusion rules.
 */
export function isRouteExcluded(pathname: string, excludedRoutes?: string[]): boolean {
  if (!Array.isArray(excludedRoutes) || !excludedRoutes.length) return false;
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const clean = normalized.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  for (const pattern of excludedRoutes) {
    if (!pattern || typeof pattern !== 'string') continue;
    const trimmed = pattern.trim();
    if (!trimmed) continue;
    const normPattern = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const cleanPattern = normPattern.split('?')[0].split('#')[0];

    if (cleanPattern.endsWith('/*')) {
      const prefix = cleanPattern.slice(0, -2);
      if (clean === prefix || clean.startsWith(prefix + '/')) return true;
    } else if (cleanPattern.endsWith('*')) {
      const prefix = cleanPattern.slice(0, -1);
      if (clean.startsWith(prefix)) return true;
    } else {
      const target = cleanPattern.replace(/\/+$/, '') || '/';
      if (clean === target) return true;
    }
  }
  return false;
}

/**
 * Checks whether this request should be served by next-agent-ready.
 */
export function isAgentReadyRequested(
  request: Request | { headers: Headers | Record<string, string>; url: string },
  options?: DetectionOptions
): boolean {
  return getRequestedAgentFormat(request, options) !== null;
}

/**
 * Evaluates route include/exclude filter rules.
 */
export function matchesRouteFilters(
  pathname: string,
  include?: (string | RegExp)[],
  exclude?: (string | RegExp)[]
): boolean {
  // If exclude patterns exist and match, exclude
  if (exclude && exclude.length > 0) {
    for (const pattern of exclude) {
      if (typeof pattern === 'string') {
        if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1);
          if (pathname.startsWith(prefix)) return false;
        } else if (pathname === pattern) {
          return false;
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(pathname)) return false;
      }
    }
  }

  // If include patterns exist, must match at least one
  if (include && include.length > 0) {
    for (const pattern of include) {
      if (typeof pattern === 'string') {
        if (pattern === '*' || pattern === '/*') return true;
        if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1);
          if (pathname.startsWith(prefix)) return true;
        } else if (pathname === pattern) {
          return true;
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(pathname)) return true;
      }
    }
    return false;
  }

  return true;
}
