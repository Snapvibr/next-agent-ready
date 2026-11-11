/**
 * Remote Brand Grounding fetcher for next-agent-ready.
 * Retrieves verified brand facts, pricing overrides, and route exclusions
 * directly from the SnapVibr AI Visibility Grounding API with 1-hour in-memory caching.
 */

import { MemoryCache } from '../cache/index.js';
import type {
  BrandGroundingConfig,
  CompetitorDifferentiator,
  LocationGroundingFacts,
  RouteGroundingRule,
  VerifiedPricingItem,
} from '../types/index.js';

export const DEFAULT_SNAPVIBR_GROUNDING_ENDPOINT = 'https://ingest.snapvibr.com/api/v1/ai-visibility/grounding';

/**
 * Resolves the SnapVibr grounding endpoint respecting options and environment variables.
 */
export function resolveGroundingEndpoint(customEndpoint?: string): string {
  if (customEndpoint) return customEndpoint;
  if (typeof process !== 'undefined') {
    if (process.env?.SNAPVIBR_GROUNDING_URL) return process.env.SNAPVIBR_GROUNDING_URL;
    if (process.env?.SNAPVIBR_INGEST_URL) {
      return process.env.SNAPVIBR_INGEST_URL.replace(/\/telemetry$/, '/grounding');
    }
  }
  return DEFAULT_SNAPVIBR_GROUNDING_ENDPOINT;
}

export interface RemoteGroundingPayload {
  domain: string;
  enabled: boolean;
  groundingEnabled: boolean;
  globalMinificationEnabled?: boolean;
  cacheEpoch?: number;
  planExpired?: boolean;
  brandFacts?: string;
  pricingOverride?: string;
  customGrounding?: string;
  routeGrounding?: RouteGroundingRule[];
  excludedRoutes?: string[];
  updatedAt?: number;
  locationFacts?: LocationGroundingFacts;
  businessType?: string;
  pricingModel?: string;
  hourlyRate?: {
    minRate?: string | number;
    maxRate?: string | number;
    currency?: string;
    description?: string;
  };
  consultationDetails?: {
    isFree?: boolean;
    durationMinutes?: number;
    title?: string;
    description?: string;
  };
  customQuoteDetails?: {
    startingPrice?: string | number;
    currency?: string;
    description?: string;
  };
}

// 1-hour in-memory cache for remote grounding facts (matches Cloudflare Worker edge cache)
const groundingCache = new MemoryCache<BrandGroundingConfig & { excludedRoutes?: string[] }>(100, 3600000);

/**
 * Parses SnapVibr pricing override text into structured verified pricing items.
 * Example line: "Starter: $29/mo. 10k tokens; Community support"
 */
export function parsePricingOverride(text?: string): VerifiedPricingItem[] {
  if (!text || !text.trim()) return [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: VerifiedPricingItem[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const plan = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trim();
      const dotIdx = rest.indexOf('.');
      if (dotIdx > 0) {
        const price = rest.slice(0, dotIdx).trim();
        const features = rest
          .slice(dotIdx + 1)
          .split(';')
          .map((f) => f.trim())
          .filter(Boolean);
        items.push({ plan, price, features });
      } else {
        items.push({ plan, price: rest });
      }
    } else {
      items.push({ plan: line, price: 'Contact Sales' });
    }
  }

  return items;
}

/**
 * Converts raw SnapVibr remote grounding payload into a BrandGroundingConfig object.
 */
export function transformRemotePayloadToGroundingConfig(
  payload: RemoteGroundingPayload
): (BrandGroundingConfig & { excludedRoutes?: string[] }) | undefined {
  if (!payload || payload.enabled === false || payload.groundingEnabled === false) {
    return undefined;
  }

  const factsList: string[] = [];
  if (payload.brandFacts && payload.brandFacts.trim()) {
    const lines = payload.brandFacts.split('\n').map((l) => l.trim()).filter(Boolean);
    factsList.push(...lines);
  }

  // Parse custom grounding JSON if present
  let customJson: Record<string, unknown> | null = null;
  if (payload.customGrounding && payload.customGrounding.trim().startsWith('{')) {
    try {
      customJson = JSON.parse(payload.customGrounding);
    } catch {
      // Ignore JSON parse errors
    }
  }

  const competitorDifferentiators: CompetitorDifferentiator[] = [];
  if (customJson && Array.isArray(customJson.competitorDifferentiators)) {
    for (const diff of customJson.competitorDifferentiators) {
      if (diff && typeof diff === 'object' && diff.competitor && diff.advantage) {
        competitorDifferentiators.push({ competitor: String(diff.competitor), advantage: String(diff.advantage) });
        factsList.push(`Advantage vs ${diff.competitor}: ${diff.advantage}`);
      }
    }
  }

  const verifiedPricing = parsePricingOverride(payload.pricingOverride);
  const brandName = factsList[0] || payload.domain;

  let businessType = 'Organization';
  const loc = payload.locationFacts;
  if (loc?.businessType) {
    businessType = loc.businessType;
  } else if (payload.businessType) {
    const bt = String(payload.businessType).toLowerCase();
    if (bt.includes('law') || bt.includes('legal')) businessType = 'LegalService';
    else if (bt.includes('medic') || bt.includes('health') || bt.includes('dental')) businessType = 'MedicalBusiness';
    else if (bt.includes('trade') || bt.includes('plumb') || bt.includes('hvac') || bt.includes('roof') || bt.includes('contractor')) businessType = 'HomeAndConstructionBusiness';
    else if (bt.includes('local')) businessType = 'LocalBusiness';
  }

  const publisherObj: Record<string, unknown> = {
    '@type': businessType,
    name: brandName,
    url: `https://${payload.domain}`,
  };

  if (loc) {
    if (loc.phone) publisherObj.telephone = loc.phone;
    if (loc.address || loc.city) {
      publisherObj.address = {
        '@type': 'PostalAddress',
        ...(loc.address ? { streetAddress: loc.address } : {}),
        ...(loc.city ? { addressLocality: loc.city } : {}),
        ...(loc.stateRegion ? { addressRegion: loc.stateRegion } : {}),
        ...(loc.postalCode ? { postalCode: loc.postalCode } : {}),
        ...(loc.country ? { addressCountry: loc.country } : {}),
      };
    }
    if (Array.isArray(loc.serviceAreas) && loc.serviceAreas.length > 0) {
      publisherObj.areaServed = loc.serviceAreas;
    }
    if (loc.operatingHours) {
      publisherObj.openingHours = loc.operatingHours;
    }
  }

  const defaultJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: brandName,
    url: `https://${payload.domain}`,
    publisher: publisherObj,
  };

  return {
    brandName,
    canonicalUrl: `https://${payload.domain}`,
    description: factsList[1] || undefined,
    facts: factsList.length > 2 ? factsList.slice(2) : factsList,
    locationFacts: payload.locationFacts,
    businessType: payload.businessType,
    pricingModel: payload.pricingModel,
    hourlyRate: payload.hourlyRate,
    consultationDetails: payload.consultationDetails,
    customQuoteDetails: payload.customQuoteDetails,
    verifiedPricing: verifiedPricing.length > 0 ? verifiedPricing : undefined,
    routeGrounding: Array.isArray(payload.routeGrounding) ? payload.routeGrounding : undefined,
    globalMinificationEnabled: payload.globalMinificationEnabled,
    cacheEpoch: payload.cacheEpoch || payload.updatedAt,
    competitorDifferentiators: competitorDifferentiators.length > 0 ? competitorDifferentiators : undefined,
    excludedRoutes: Array.isArray(payload.excludedRoutes) ? payload.excludedRoutes : undefined,
    jsonLd: defaultJsonLd,
  };
}

/**
 * Fetches verified Brand Grounding facts from the SnapVibr Grounding API.
 * Uses 1-hour in-memory caching to avoid impacting origin latency.
 */
export async function fetchRemoteBrandGrounding(
  domain: string,
  apiKey: string,
  endpoint?: string
): Promise<(BrandGroundingConfig & { excludedRoutes?: string[] }) | undefined> {
  if (!domain || !apiKey) return undefined;

  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const targetEndpoint = resolveGroundingEndpoint(endpoint);
  const cacheKey = `${cleanDomain}:${apiKey.slice(0, 8)}`;

  const cached = groundingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = new URL(targetEndpoint);
    url.searchParams.set('domain', cleanDomain);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-SnapVibr-Key': apiKey,
        'X-SnapVibr-Client': 'next-agent-ready/1.0.0',
      },
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      return undefined;
    }

    const payload = (await res.json()) as RemoteGroundingPayload;
    const config = transformRemotePayloadToGroundingConfig(payload);

    if (config) {
      groundingCache.set(cacheKey, config);
    }

    return config;
  } catch {
    // Return undefined on network timeout or error without breaking edge pipeline
    return undefined;
  }
}
