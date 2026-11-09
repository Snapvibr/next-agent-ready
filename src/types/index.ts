/**
 * Core type definitions for next-agent-ready.
 */

export interface DetectionOptions {
  /**
   * Additional AI user agent strings to detect.
   */
  customUserAgents?: string[];

  /**
   * Disables detection via user-agent strings.
   * @default false
   */
  disableUserAgentDetection?: boolean;

  /**
   * Query parameter keys that trigger agent-ready mode.
   * Defaults to ['agent', 'agent-ready', 'format'].
   */
  queryParamKeys?: string[];

  /**
   * Whether to support Accept: text/markdown if explicitly requested by an agent.
   * @default true
   */
  allowMarkdownAccept?: boolean;
}

export interface StripperOptions {
  /**
   * Whether to strip navigation elements (<nav>).
   * @default true
   */
  stripNav?: boolean;

  /**
   * Whether to strip layout headers (<header>).
   * @default true
   */
  stripHeader?: boolean;

  /**
   * Whether to strip layout footers (<footer>).
   * @default true
   */
  stripFooter?: boolean;

  /**
   * Whether to strip aside elements (<aside>).
   * @default true
   */
  stripAside?: boolean;

  /**
   * Whether to strip modals, dialogs, cookie banners, and popups.
   * @default true
   */
  stripModalsAndBanners?: boolean;

  /**
   * Whether to strip SVGs (<svg>...</svg>).
   * @default true
   */
  stripSvg?: boolean;

  /**
   * Whether to strip styles (<style>, <link rel="stylesheet">).
   * @default true
   */
  stripStyles?: boolean;

  /**
   * Whether to strip scripts (<script>) while preserving application/ld+json.
   * @default true
   */
  stripScripts?: boolean;

  /**
   * Whether to preserve Schema.org JSON-LD scripts (<script type="application/ld+json">).
   * @default true
   */
  preserveJsonLd?: boolean;

  /**
   * Additional tag names to remove completely (tag and contents).
   */
  customRemoveTags?: string[];
}

export interface CleanerOptions {
  /**
   * Base URL of the site to resolve relative anchor URLs into clean absolute URLs.
   */
  baseUrl?: string;

  /**
   * Whether to strip marketing tracking parameters (utm_*, fbclid, gclid, etc.) from links.
   * @default true
   */
  stripTrackingParams?: boolean;

  /**
   * Whether to preserve semantic images with alt text.
   * If true, <img> tags with non-empty alt text are preserved cleanly.
   * @default true
   */
  preserveImages?: boolean;

  /**
   * Maximum characters allowed for text content in single blocks (prevents runaway buffers).
   */
  maxContentLength?: number;
}

export interface VerifiedPricingItem {
  plan: string;
  price: string;
  billingPeriod?: string;
  features?: string[];
}

export interface RouteGroundingPricingFact {
  plan: string;
  price: string;
  currency?: string;
  billingPeriod?: string;
  features?: string;
  description?: string;
}

export interface RouteGroundingRule {
  route: string;
  claim?: string;
  keyFacts?: string[];
  pricingFacts?: RouteGroundingPricingFact[];
  actionCenterFindings?: string[];
  liveAtEdge?: boolean;
  minification?: 'enable' | 'disable' | 'inherit';
}

export interface CompetitorDifferentiator {
  competitor: string;
  advantage: string;
}

export interface BrandGroundingConfig {
  /**
   * Official canonical brand or company name.
   */
  brandName?: string;

  /**
   * Canonical URL of the website.
   */
  canonicalUrl?: string;

  /**
   * Short tagline summarizing the product.
   */
  tagline?: string;

  /**
   * Official brand description and summary.
   */
  description?: string;

  /**
   * Verified pricing tiers or price specifications.
   */
  verifiedPricing?: VerifiedPricingItem[] | Record<string, string | number>;

  /**
   * Canonical factual statements (key-value or list of facts).
   */
  facts?: Record<string, string | number | boolean> | string[];

  /**
   * Per-route grounding rules (claim, keyFacts, pricing, actionCenterFindings, liveAtEdge, minification).
   */
  routeGrounding?: RouteGroundingRule[];

  /**
   * Global minification setting from SnapVibr remote config.
   */
  globalMinificationEnabled?: boolean;

  /**
   * Remote cache epoch for cache-busting.
   */
  cacheEpoch?: number;

  /**
   * Competitor differentiators for grounding context.
   */
  competitorDifferentiators?: CompetitorDifferentiator[];

  /**
   * Excluded route patterns.
   */
  excludedRoutes?: string[];

  /**
   * Verified contact channels.
   */
  contact?: {
    supportEmail?: string;
    salesEmail?: string;
    docsUrl?: string;
  };

  /**
   * Explicit crawler guidance or system instructions for indexing agents.
   */
  instructions?: string;

  /**
   * Additional Schema.org JSON-LD structured data to inject.
   */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface TokenCounterResult {
  rawTokens: number;
  cleanTokens: number;
  savedTokens: number;
  reductionPercentage: number;
}

export interface AgentTelemetryEvent {
  domain: string;
  siteId: string;
  path: string;
  bot: string;
  userAgent: string;
  status: number;
  cached: boolean;
  sample: boolean;
  durationMs: number;
  format: 'html' | 'markdown' | 'clean-html';
  rawBytes: number;
  cleanBytes: number;
  htmlBytes: number;
  markdownBytes: number;
  rawTokens: number;
  cleanTokens: number;
  savedTokens: number;
  reductionPercentage: number;
  timestamp?: number;

  /**
   * Compatibility alias for bot.
   */
  crawler?: string;

  /**
   * Compatibility alias for status.
   */
  statusCode?: number;

  /**
   * Compatibility alias for cached.
   */
  cacheHit?: boolean;
}

export interface TelemetryConfig {
  /**
   * Whether telemetry is enabled.
   * Defaults to true if snapvibrApiKey or axiomToken is provided.
   */
  enabled?: boolean;

  /**
   * SnapVibr API key for crawler analytics.
   */
  snapvibrApiKey?: string;

  /**
   * Axiom API token.
   */
  axiomToken?: string;

  /**
   * Axiom dataset name.
   */
  axiomDataset?: string;

  /**
   * Custom telemetry endpoint URL.
   */
  endpoint?: string;

  /**
   * Callback invoked asynchronously when a crawler hit occurs.
   */
  onCrawlerHit?: (event: AgentTelemetryEvent) => void | Promise<void>;
}

export interface CacheConfig {
  /**
   * Whether to cache transformed semantic HTML in memory.
   * @default true
   */
  enabled?: boolean;

  /**
   * Cache TTL in milliseconds.
   * @default 300000 (5 minutes)
   */
  ttlMs?: number;

  /**
   * Maximum number of items to keep in cache.
   * @default 500
   */
  maxEntries?: number;
}

export interface AgentReadyOptions {
  /**
   * Detection options for recognizing AI crawlers and query parameters.
   */
  detection?: DetectionOptions;

  /**
   * Options for stripping scripts, styles, layout chrome, and bloat.
   */
  stripper?: StripperOptions;

  /**
   * Options for normalizing semantic HTML tags, tables, and links.
   */
  cleaner?: CleanerOptions;

  /**
   * Optional SnapVibr API key (or specify in telemetry.snapvibrApiKey).
   * Automatically fetches verified Brand Grounding facts from the SnapVibr API.
   */
  snapvibrApiKey?: string;

  /**
   * SnapVibr site ID.
   */
  siteId?: string;

  /**
   * Custom SnapVibr Grounding endpoint URL.
   * Defaults to 'https://ingest.snapvibr.com/api/v1/ai-visibility/grounding'.
   */
  groundingEndpoint?: string;

  /**
   * Whether to automatically fetch remote grounding facts from SnapVibr when an API key is provided.
   * @default true
   */
  autoFetchRemoteGrounding?: boolean;

  /**
   * Brand grounding facts and JSON-LD schema to inject.
   * Can be an object or a function that receives the request.
   */
  grounding?: BrandGroundingConfig | ((request: Request) => Promise<BrandGroundingConfig> | BrandGroundingConfig);

  /**
   * Telemetry configuration for logging crawler requests and token savings.
   */
  telemetry?: TelemetryConfig;

  /**
   * In-memory cache configuration.
   */
  cache?: CacheConfig;

  /**
   * Route patterns to include. Supports wildcards ('/docs/*').
   */
  include?: (string | RegExp)[];

  /**
   * Route patterns to exclude. Supports wildcards ('/api/*').
   */
  exclude?: (string | RegExp)[];

  /**
   * Custom hook to post-process clean HTML before returning.
   */
  transformHtml?: (html: string, context: { url: string; userAgent: string; format: 'html' | 'markdown' }) => string | Promise<string>;
}
