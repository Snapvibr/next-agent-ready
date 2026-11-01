import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parsePricingOverride,
  transformRemotePayloadToGroundingConfig,
  fetchRemoteBrandGrounding,
} from '../src/core/remote-grounding.js';

describe('remote-grounding', () => {
  it('parses formatted pricing text into structured pricing items', () => {
    const raw = `Starter: $29/mo. 10k tokens; Email support\nScale: $99/mo. Unlimited tokens; Priority SLA\nEnterprise: Custom pricing`;
    const parsed = parsePricingOverride(raw);

    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({
      plan: 'Starter',
      price: '$29/mo',
      features: ['10k tokens', 'Email support'],
    });
    expect(parsed[1]).toEqual({
      plan: 'Scale',
      price: '$99/mo',
      features: ['Unlimited tokens', 'Priority SLA'],
    });
    expect(parsed[2]).toEqual({
      plan: 'Enterprise',
      price: 'Custom pricing',
    });
  });

  it('transforms SnapVibr remote payload into BrandGroundingConfig', () => {
    const config = transformRemotePayloadToGroundingConfig({
      domain: 'snapvibr.com',
      enabled: true,
      groundingEnabled: true,
      brandFacts: 'SnapVibr\nAI Agent Visibility Platform\nSub-10ms edge caching\n95% token savings',
      pricingOverride: 'Starter: $29/mo. 100k requests',
      customGrounding: JSON.stringify({
        competitorDifferentiators: [
          { competitor: 'Legacy Proxy', advantage: 'Zero runtime dependencies' },
        ],
      }),
      excludedRoutes: ['/api/*', '/admin/*'],
    });

    expect(config).toBeDefined();
    expect(config?.brandName).toBe('SnapVibr');
    expect(config?.canonicalUrl).toBe('https://snapvibr.com');
    expect(config?.description).toBe('AI Agent Visibility Platform');
    expect(config?.facts).toContain('Sub-10ms edge caching');
    expect(config?.facts).toContain('Advantage vs Legacy Proxy: Zero runtime dependencies');
    expect(config?.verifiedPricing).toHaveLength(1);
    expect(config?.excludedRoutes).toEqual(['/api/*', '/admin/*']);
  });

  it('returns undefined if grounding is disabled in remote payload', () => {
    const config = transformRemotePayloadToGroundingConfig({
      domain: 'snapvibr.com',
      enabled: true,
      groundingEnabled: false,
    });

    expect(config).toBeUndefined();
  });

  it('fetches remote grounding and caches the response', async () => {
    const mockPayload = {
      domain: 'acme.com',
      enabled: true,
      groundingEnabled: true,
      brandFacts: 'Acme Inc\nEdge Platform',
      pricingOverride: 'Starter: $10/mo. Basic',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const first = await fetchRemoteBrandGrounding('acme.com', 'test_key_123');
    expect(first).toBeDefined();
    expect(first?.brandName).toBe('Acme Inc');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call should return from cache without re-fetching
    const second = await fetchRemoteBrandGrounding('acme.com', 'test_key_123');
    expect(second).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });
});
