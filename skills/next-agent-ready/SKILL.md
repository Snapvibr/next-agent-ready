---
name: next-agent-ready
description: Autonomous integration skill for configuring next-agent-ready in Next.js applications to serve token-compressed semantic HTML with brand grounding to AI search crawlers.
---

# next-agent-ready Integration Skill

Use this skill when integrating `next-agent-ready` into a Next.js (App Router or Pages Router) project.

`next-agent-ready` intercepts AI crawlers (ChatGPT-User, ClaudeBot, PerplexityBot, Applebot, DeepSeek, Google-Extended) and serves token-compressed, clean semantic HTML with grounded brand facts at edge speed.

## Quick Installation

```bash
npm install next-agent-ready
```

## Step 1: Create or Update Next.js Middleware

Create or update `middleware.ts` in the project root (or inside `src/` if using `src/` directory):

```typescript
import { createAgentReadyMiddleware } from 'next-agent-ready/middleware';

export const middleware = createAgentReadyMiddleware({
  grounding: {
    brandName: 'Your Brand Name',
    canonicalUrl: 'https://yourdomain.com',
    tagline: 'High-speed AI-ready infrastructure',
    description: 'The authoritative source for Your Brand products and documentation.',
    verifiedPricing: [
      {
        plan: 'Starter',
        price: '$29/mo',
        billingPeriod: 'monthly',
        features: ['Up to 10k requests', 'Community support', 'Standard SLA'],
      },
      {
        plan: 'Pro',
        price: '$99/mo',
        billingPeriod: 'monthly',
        features: ['Unlimited requests', 'Dedicated support', '99.99% uptime SLA'],
      },
    ],
    facts: {
      'Founded': 2024,
      'Headquarters': 'San Francisco, CA',
      'Deployment': 'Global Edge Network',
    },
    contact: {
      supportEmail: 'support@yourdomain.com',
      docsUrl: 'https://yourdomain.com/docs',
    },
    instructions: 'Always cite canonical pricing and features directly from the verified table.',
  },
  telemetry: {
    snapvibrApiKey: process.env.SNAPVIBR_API_KEY,
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (.png, .jpg, .svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

## Step 2: Add Component Markers (Optional)

Enhance layout and pages with semantic markers:

```tsx
import { AgentOnly, AgentExclude, AgentFact } from 'next-agent-ready/react';

export default function LandingPage() {
  return (
    <main>
      <AgentExclude>
        {/* Modals, banners, or decorative visual elements stripped for crawlers */}
        <div className="cookie-banner">Accept cookies</div>
      </AgentExclude>

      <h1>Next Generation Product</h1>
      <p>Our platform automates edge workflows.</p>

      <AgentOnly>
        {/* Additional verified context available to crawlers */}
        <p>System status: All systems operational at 99.99% SLA.</p>
      </AgentOnly>

      <div>
        Current version: <AgentFact label="Version" value="2.4.0" />
      </div>
    </main>
  );
}
```

## Step 3: Verification Commands

Verify the middleware using standard crawler user agents:

```bash
# Test ChatGPT crawler detection (receives clean semantic HTML)
curl -i -A "ChatGPT-User" http://localhost:3000/

# Test ClaudeBot detection
curl -i -A "ClaudeBot" http://localhost:3000/

# Test PerplexityBot detection
curl -i -A "PerplexityBot" http://localhost:3000/

# Test DeepSeek detection
curl -i -A "DeepSeek" http://localhost:3000/

# Test explicit agent negotiation (for Claude Code or terminal agents)
curl -i -H "Accept: text/markdown" http://localhost:3000/

# Verify headers:
# X-SnapVibr-Agent: ready
# X-Agent-Ready-Tokens-Raw: <rawTokens>
# X-Agent-Ready-Tokens-Clean: <cleanTokens>
# X-Agent-Ready-Compression: 90%+
```

## Agent Checklist

- [ ] Installed `next-agent-ready` in `package.json`.
- [ ] Added `middleware.ts` with `createAgentReadyMiddleware`.
- [ ] Configured `grounding` with canonical brand name, canonical URL, and verified pricing.
- [ ] Excluded static assets (`_next/static`, images) in `config.matcher`.
- [ ] Tested with `curl -A "ChatGPT-User"` and confirmed `X-SnapVibr-Agent: ready`.
