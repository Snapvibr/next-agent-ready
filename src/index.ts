/**
 * next-agent-ready
 * High-performance, zero-dependency Next.js edge and node middleware that intercepts
 * AI crawlers and serves token-compressed, clean semantic HTML with grounded brand facts at edge speed.
 */

// Core bloat stripping and semantic cleaning
export {
  stripHtmlBloat,
  createHtmlBloatStripperStream,
} from './core/html-stripper.js';

export {
  cleanSemanticHtml,
  cleanUrl,
} from './core/semantic-cleaner.js';

// Brand Grounding and Schema.org JSON-LD injection
export {
  injectBrandGrounding,
  renderGroundingSection,
  renderPricingTable,
  renderFactsList,
  renderJsonLdScripts,
} from './core/grounding-injector.js';

export {
  fetchRemoteBrandGrounding,
  transformRemotePayloadToGroundingConfig,
  resolveGroundingEndpoint,
  DEFAULT_SNAPVIBR_GROUNDING_ENDPOINT,
} from './core/remote-grounding.js';
export type { RemoteGroundingPayload } from './core/remote-grounding.js';

// AI Crawler detection and content negotiation
export {
  DEFAULT_AI_CRAWLERS,
  DEFAULT_QUERY_PARAM_KEYS,
  getHeader,
  identifyCrawler,
  getCrawlerDisplayName,
  isAiCrawler,
  wantsExplicitMarkdown,
  getRequestedAgentFormat,
  isAgentReadyRequested,
  isRouteExcluded,
  matchesRouteFilters,
} from './core/detector.js';

// Token counter and compression calculation
export {
  estimateTokens,
  calculateTokenCompression,
} from './core/token-counter.js';

// Text serializer for Accept: text/markdown
export {
  convertSemanticHtmlToMarkdown,
} from './core/text-serializer.js';

// Middleware and standalone transform
export {
  createAgentReadyMiddleware,
  transformToAgentReady,
} from './middleware/index.js';
export type { AgentReadyTransformResult } from './middleware/index.js';

// Telemetry
export {
  dispatchTelemetry,
  resolveTelemetryEndpoint,
  SNAPVIBR_DEFAULT_ENDPOINT as SNAPVIBR_TELEMETRY_ENDPOINT,
} from './telemetry/index.js';

// In-memory LRU cache
export {
  MemoryCache,
} from './cache/index.js';
export type { CacheEntry } from './cache/index.js';

// Types
export type * from './types/index.js';
