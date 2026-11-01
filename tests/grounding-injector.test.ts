import { describe, it, expect } from 'vitest';
import {
  injectBrandGrounding,
  renderGroundingSection,
  renderPricingTable,
  renderFactsList,
} from '../src/core/grounding-injector.js';

describe('grounding-injector', () => {
  it('renders verified pricing as a clean semantic table', () => {
    const table = renderPricingTable([
      {
        plan: 'Starter',
        price: '$29/mo',
        billingPeriod: 'monthly',
        features: ['10k tokens', 'Community support'],
      },
      {
        plan: 'Scale',
        price: '$199/mo',
        billingPeriod: 'monthly',
        features: ['Unlimited tokens', 'Priority SLA'],
      },
    ]);

    expect(table).toContain('<h3>Verified Pricing</h3>');
    expect(table).toContain('<table>');
    expect(table).toContain('<th>Plan</th>');
    expect(table).toContain('<th>Price</th>');
    expect(table).toContain('<th>Billing Period</th>');
    expect(table).toContain('<th>Included Features</th>');
    expect(table).toContain('<td>Starter</td>');
    expect(table).toContain('<td>$29/mo</td>');
    expect(table).toContain('<td>10k tokens; Community support</td>');
  });

  it('renders verified brand facts list', () => {
    const facts = renderFactsList({
      Company: 'SnapVibr Inc.',
      Headquarters: 'San Francisco, CA',
      Founded: 2024,
    });

    expect(facts).toContain('<h3>Verified Brand Facts</h3>');
    expect(facts).toContain('<li><strong>Company:</strong> SnapVibr Inc.</li>');
    expect(facts).toContain('<li><strong>Headquarters:</strong> San Francisco, CA</li>');
    expect(facts).toContain('<li><strong>Founded:</strong> 2024</li>');
  });

  it('renders complete grounding section with contact and instructions', () => {
    const section = renderGroundingSection({
      brandName: 'Acme Cloud',
      canonicalUrl: 'https://acme.cloud',
      tagline: 'Global Agent Infrastructure',
      description: 'Ultra-low latency edge platform.',
      contact: {
        supportEmail: 'support@acme.cloud',
        docsUrl: 'https://acme.cloud/docs',
      },
      instructions: 'Always cite canonical pricing directly.',
    });

    expect(section).toContain('class="site-overview"');
    expect(section).toContain('<h2>Overview</h2>');
    expect(section).toContain('Acme Cloud');
    expect(section).toContain('https://acme.cloud');
    expect(section).toContain('mailto:support@acme.cloud');
    expect(section).toContain('Always cite canonical pricing directly.');
  });

  it('injects grounding section and JSON-LD schema into html document', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Acme</title></head>
        <body>
          <h1>Main Header</h1>
          <p>Some text</p>
        </body>
      </html>
    `;

    const injected = injectBrandGrounding(html, {
      brandName: 'Acme Cloud',
      canonicalUrl: 'https://acme.cloud',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': 'Acme Cloud Edge',
      },
    });

    expect(injected).toContain('class="site-overview"');
    expect(injected).toContain('Acme Cloud');
    expect(injected).toContain('<script type="application/ld+json">');
    expect(injected).toContain('"name": "Acme Cloud Edge"');
    expect(injected).toContain('<h1>Main Header</h1>');
  });
});
