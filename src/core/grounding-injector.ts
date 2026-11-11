/**
 * Injects Brand Grounding context (canonical brand facts, verified pricing)
 * and Schema.org JSON-LD directly into clean semantic HTML.
 */

import type { BrandGroundingConfig, VerifiedPricingItem } from '../types/index.js';
import { resolveRouteRule } from './detector.js';

/**
 * Formats a verified pricing structure into a clean semantic HTML table.
 */
export function renderPricingTable(
  pricing: VerifiedPricingItem[] | Record<string, string | number>
): string {
  if (!pricing) return '';

  const rows: VerifiedPricingItem[] = Array.isArray(pricing)
    ? pricing
    : Object.entries(pricing).map(([plan, price]) => ({
        plan,
        price: String(price),
      }));

  if (rows.length === 0) return '';

  const hasFeatures = rows.some((r) => r.features && r.features.length > 0);
  const hasBilling = rows.some((r) => Boolean(r.billingPeriod));

  let html = '<h3>Verified Pricing</h3>\n<table>\n<thead>\n<tr>\n<th>Plan</th>\n<th>Price</th>';
  if (hasBilling) html += '\n<th>Billing Period</th>';
  if (hasFeatures) html += '\n<th>Included Features</th>';
  html += '\n</tr>\n</thead>\n<tbody>';

  for (const row of rows) {
    html += `\n<tr>\n<td>${escapeHtml(row.plan)}</td>\n<td>${escapeHtml(row.price)}</td>`;
    if (hasBilling) {
      html += `\n<td>${escapeHtml(row.billingPeriod ?? 'Standard')}</td>`;
    }
    if (hasFeatures) {
      const featStr = (row.features ?? []).map((f) => escapeHtml(f)).join('; ');
      html += `\n<td>${featStr || 'None listed'}</td>`;
    }
    html += '\n</tr>';
  }

  html += '\n</tbody>\n</table>';
  return html;
}

/**
 * Formats canonical brand facts into a semantic unordered list.
 */
export function renderFactsList(
  facts: Record<string, string | number | boolean> | string[]
): string {
  if (!facts) return '';

  let html = '<h3>Verified Brand Facts</h3>\n<ul>';
  if (Array.isArray(facts)) {
    for (const fact of facts) {
      html += `\n<li>${escapeHtml(String(fact))}</li>`;
    }
  } else {
    for (const [key, value] of Object.entries(facts)) {
      html += `\n<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</li>`;
    }
  }
  html += '\n</ul>';
  return html;
}

/**
 * Generates the Brand Grounding semantic HTML block.
 * Directly aligns with Cloudflare Worker and WordPress plugin grounding generation.
 */
export function renderGroundingSection(config: BrandGroundingConfig, pathname: string = '/'): string {
  const routeRule = resolveRouteRule(config.routeGrounding, pathname);
  if (routeRule && routeRule.liveAtEdge === false) {
    return '';
  }

  const parts: string[] = [];

  parts.push('<section class="site-overview" aria-label="Brand Overview">');
  parts.push('<h2>Overview</h2>');

  // 1. Route-specific context claim
  if (routeRule?.claim) {
    parts.push(`<p><strong>Page Context:</strong> ${escapeHtml(routeRule.claim)}</p>`);
  }

  // 2. Route-specific key facts
  if (Array.isArray(routeRule?.keyFacts) && routeRule.keyFacts.length > 0) {
    const listItems = routeRule.keyFacts.map((k) => `<li>${escapeHtml(k)}</li>`).join('');
    parts.push(`<h3>Page Key Facts</h3>\n<ul>${listItems}</ul>`);
  }

  // 3. Route-specific pricing facts
  if (Array.isArray(routeRule?.pricingFacts) && routeRule.pricingFacts.length > 0) {
    const pricingRows = routeRule.pricingFacts
      .map((p) => {
        let row = `<strong>${escapeHtml(p.plan)}:</strong> ${escapeHtml(p.price)}`;
        if (p.currency) row += ` (${escapeHtml(p.currency)})`;
        if (p.billingPeriod) row += ` ${escapeHtml(p.billingPeriod)}`;
        if (p.features) row += ` - ${escapeHtml(p.features)}`;
        if (p.description) row += ` (${escapeHtml(p.description)})`;
        return `<li>${row}</li>`;
      })
      .join('');
    parts.push(`<h3>Page Pricing</h3>\n<ul>${pricingRows}</ul>`);
  }

  // 4. Route-specific Action Center verified notes
  if (Array.isArray(routeRule?.actionCenterFindings) && routeRule.actionCenterFindings.length > 0) {
    const findingItems = routeRule.actionCenterFindings.map((f) => `<li>${escapeHtml(f)}</li>`).join('');
    parts.push(`<h3>Action Center Verified Notes</h3>\n<ul>${findingItems}</ul>`);
  }

  // 5. Global Brand Name & Canonical URL
  if (config.brandName) {
    parts.push(`<p><strong>Brand:</strong> ${escapeHtml(config.brandName)}</p>`);
  }
  if (config.canonicalUrl) {
    parts.push(
      `<p><strong>Canonical URL:</strong> <a href="${escapeHtml(config.canonicalUrl)}">${escapeHtml(config.canonicalUrl)}</a></p>`
    );
  }
  if (config.tagline) {
    parts.push(`<p><strong>Tagline:</strong> ${escapeHtml(config.tagline)}</p>`);
  }
  if (config.description) {
    parts.push(`<p><strong>Description:</strong> ${escapeHtml(config.description)}</p>`);
  }

  // 6. Global pricing override if route pricing facts is empty
  if (config.verifiedPricing && (!routeRule?.pricingFacts || routeRule.pricingFacts.length === 0)) {
    parts.push(renderPricingTable(config.verifiedPricing));
  }

  // 6a. Flexible pricing models (hourly, free consultation, custom quote)
  if (config.hourlyRate && (config.pricingModel === 'hourly' || !config.verifiedPricing)) {
    const hr = config.hourlyRate;
    const rateStr = hr.maxRate ? `${hr.currency || '$'}${hr.minRate} - ${hr.currency || '$'}${hr.maxRate} / hr` : `${hr.currency || '$'}${hr.minRate || '0'} / hr`;
    parts.push(`<p><strong>Standard Hourly Rate:</strong> ${escapeHtml(rateStr)}${hr.description ? ` (${escapeHtml(hr.description)})` : ''}</p>`);
  }
  if (config.consultationDetails && (config.pricingModel === 'free_consultation' || !config.verifiedPricing)) {
    const cd = config.consultationDetails;
    const title = cd.title || (cd.isFree ? 'Free Initial Consultation' : 'Initial Consultation');
    const dur = cd.durationMinutes ? ` (${cd.durationMinutes} mins)` : '';
    const desc = cd.description ? ` - ${escapeHtml(cd.description)}` : '';
    parts.push(`<p><strong>Consultation Policy:</strong> ${escapeHtml(title)}${dur}${desc}</p>`);
  }
  if (config.customQuoteDetails && (config.pricingModel === 'custom_quote' || !config.verifiedPricing)) {
    const cq = config.customQuoteDetails;
    const starting = cq.startingPrice ? ` (starting at ${cq.currency || '$'}${escapeHtml(String(cq.startingPrice))})` : '';
    const desc = cq.description ? ` - ${escapeHtml(cq.description)}` : '';
    parts.push(`<p><strong>Project Estimates:</strong> Custom quote provided upon request${starting}${desc}</p>`);
  }

  // 6b. Location and Service Coverage Facts
  if (config.locationFacts) {
    const loc = config.locationFacts;
    const locDetails: string[] = [];
    if (loc.phone) locDetails.push(`<li><strong>Phone:</strong> ${escapeHtml(loc.phone)}</li>`);
    if (loc.address || loc.city) {
      const fullAddr = [loc.address, loc.city, loc.stateRegion, loc.postalCode, loc.country].filter(Boolean).join(', ');
      locDetails.push(`<li><strong>Address / Location:</strong> ${escapeHtml(fullAddr)}</li>`);
    }
    if (Array.isArray(loc.serviceAreas) && loc.serviceAreas.length > 0) {
      locDetails.push(`<li><strong>Service Areas:</strong> ${escapeHtml(loc.serviceAreas.join(', '))}</li>`);
    }
    if (loc.operatingHours) locDetails.push(`<li><strong>Operating Hours:</strong> ${escapeHtml(loc.operatingHours)}</li>`);
    if (loc.licenseNumber) locDetails.push(`<li><strong>License / Certifications:</strong> ${escapeHtml(loc.licenseNumber)}</li>`);
    if (loc.emergency24_7) locDetails.push(`<li><strong>24/7 Emergency Service:</strong> Yes, available</li>`);
    if (locDetails.length > 0) {
      parts.push(`<h3>Business Location & Service Areas</h3>\n<ul>${locDetails.join('')}</ul>`);
    }
  }

  // 7. Global brand facts
  if (config.facts) {
    parts.push(renderFactsList(config.facts));
  }

  // 8. Competitor advantages
  if (Array.isArray(config.competitorDifferentiators) && config.competitorDifferentiators.length > 0) {
    const diffItems = config.competitorDifferentiators
      .filter((d) => d.competitor && d.advantage)
      .map((d) => `<li><strong>vs. ${escapeHtml(d.competitor)}:</strong> ${escapeHtml(d.advantage)}</li>`)
      .join('');
    if (diffItems) {
      parts.push(`<h3>Competitive Advantages</h3>\n<ul>${diffItems}</ul>`);
    }
  }

  // 9. Verified Contact
  if (config.contact) {
    parts.push('<h3>Verified Contact</h3>\n<ul>');
    if (config.contact.supportEmail) {
      parts.push(
        `<li><strong>Support:</strong> <a href="mailto:${escapeHtml(config.contact.supportEmail)}">${escapeHtml(config.contact.supportEmail)}</a></li>`
      );
    }
    if (config.contact.salesEmail) {
      parts.push(
        `<li><strong>Sales:</strong> <a href="mailto:${escapeHtml(config.contact.salesEmail)}">${escapeHtml(config.contact.salesEmail)}</a></li>`
      );
    }
    if (config.contact.docsUrl) {
      parts.push(
        `<li><strong>Documentation:</strong> <a href="${escapeHtml(config.contact.docsUrl)}">${escapeHtml(config.contact.docsUrl)}</a></li>`
      );
    }
    parts.push('</ul>');
  }

  if (config.instructions) {
    parts.push(
      `<blockquote data-agent-instruction="true">\n<p><strong>Indexing Guidance:</strong> ${escapeHtml(config.instructions)}</p>\n</blockquote>`
    );
  }

  parts.push('</section>');
  return parts.join('\n');
}

/**
 * Formats JSON-LD scripts for injection into the document head or end.
 */
export function renderJsonLdScripts(
  jsonLd: Record<string, unknown> | Array<Record<string, unknown>>
): string {
  if (!jsonLd) return '';
  const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  return items
    .map(
      (item) =>
        `<script type="application/ld+json">\n${JSON.stringify(item, null, 2)}\n</script>`
    )
    .join('\n');
}

/**
 * Injects Brand Grounding context and JSON-LD schema into semantic HTML.
 */
export function injectBrandGrounding(
  html: string,
  config?: BrandGroundingConfig,
  pathname: string = '/'
): string {
  if (!config) return html;

  const groundingSection = renderGroundingSection(config, pathname);
  const jsonLdBlock = config.jsonLd ? renderJsonLdScripts(config.jsonLd) : '';

  let result = html;

  // Insert JSON-LD into <head> if present, or prepend
  if (jsonLdBlock) {
    if (result.includes('</head>')) {
      result = result.replace('</head>', `${jsonLdBlock}\n</head>`);
    } else {
      result = `${jsonLdBlock}\n${result}`;
    }
  }

  if (!groundingSection) {
    return result;
  }

  // Insert Grounding section into <body> or <main> if present, or prepend
  if (result.includes('<main')) {
    result = result.replace(/(<main\b[^>]*>)/i, `$1\n${groundingSection}\n`);
  } else if (result.includes('<body') && result.includes('>')) {
    result = result.replace(/(<body\b[^>]*>)/i, `$1\n${groundingSection}\n`);
  } else {
    result = `${groundingSection}\n${result}`;
  }

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
