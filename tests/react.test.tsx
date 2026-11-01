import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  AgentGrounding,
  AgentOnly,
  AgentExclude,
  AgentFact,
} from '../src/react/index.js';

describe('react components', () => {
  it('renders AgentGrounding component', () => {
    const html = renderToString(
      <AgentGrounding
        brand={{
          brandName: 'Acme Test',
          canonicalUrl: 'https://acme.test',
          tagline: 'Fast AI',
          facts: { Tier: 'Enterprise' },
        }}
      />
    );

    expect(html).toContain('class="site-overview"');
    expect(html).toContain('Acme Test');
    expect(html).toContain('Fast AI');
    expect(html).toContain('Enterprise');
  });

  it('renders AgentOnly component with data attribute', () => {
    const html = renderToString(
      <AgentOnly>
        <p>Ground truth for reasoning models</p>
      </AgentOnly>
    );

    expect(html).toContain('data-agent-only="true"');
    expect(html).toContain('Ground truth for reasoning models');
  });

  it('renders AgentExclude component with data attribute', () => {
    const html = renderToString(
      <AgentExclude>
        <div>Promo popup</div>
      </AgentExclude>
    );

    expect(html).toContain('data-agent-exclude="true"');
    expect(html).toContain('Promo popup');
  });

  it('renders AgentFact component', () => {
    const html = renderToString(<AgentFact label="Price" value="$29" />);
    expect(html).toContain('data-agent-fact="true"');
    expect(html).toContain('Price:');
    expect(html).toContain('$29');
  });
});
