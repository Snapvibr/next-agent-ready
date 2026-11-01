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
 * Checks if the user agent belongs to a known AI crawler.
 */
export function isAiCrawler(userAgent?: string | null, options?: DetectionOptions): boolean {
  return identifyCrawler(userAgent, options?.customUserAgents) !== null;
}

/**
 * Parses the preferred format from the request.
 * Returns 'markdown' if Accept explicitly favors text/markdown or query specifies markdown.
 * Returns 'html' if AI crawler requests page or query specifies html.
 * Returns null if not an AI agent request.
 */
export function getRequestedAgentFormat(
  request: Request | { headers: Headers | Record<string, string>; url: string },
  options?: DetectionOptions
): 'html' | 'markdown' | null {
  // 1. Query parameter check
  try {
    const url = new URL(request.url, 'http://localhost');
    const paramKeys = options?.queryParamKeys ?? DEFAULT_QUERY_PARAM_KEYS;

    for (const key of paramKeys) {
      const val = url.searchParams.get(key);
      if (val !== null) {
        const lowerVal = val.toLowerCase();
        if (lowerVal === 'markdown' || lowerVal === 'md') {
          return 'markdown';
        }
        if (
          lowerVal === 'html' ||
          lowerVal === 'ready' ||
          lowerVal === 'true' ||
          lowerVal === '1'
        ) {
          return 'html';
        }
      }
    }
  } catch {
    // If URL parsing fails, continue to headers
  }

  // 2. Accept Header negotiation
  const acceptHeader = getHeader(request, 'accept');
  const allowMarkdown = options?.allowMarkdownAccept !== false;

  if (acceptHeader && allowMarkdown) {
    const lowerAccept = acceptHeader.toLowerCase();
    // Check if client explicitly prioritizes markdown
    if (
      lowerAccept.includes('text/markdown') ||
      lowerAccept.includes('text/x-markdown')
    ) {
      // If client requests text/markdown before or without text/html
      const mdIndex = lowerAccept.indexOf('text/markdown');
      const htmlIndex = lowerAccept.indexOf('text/html');
      if (htmlIndex === -1 || mdIndex < htmlIndex) {
        return 'markdown';
      }
    }
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
