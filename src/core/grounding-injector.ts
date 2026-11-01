/**
 * Injects Brand Grounding context (canonical brand facts, verified pricing)
 * and Schema.org JSON-LD directly into clean semantic HTML.
 */

import type { BrandGroundingConfig, VerifiedPricingItem } from '../types/index.js';

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
 */
export function renderGroundingSection(config: BrandGroundingConfig): string {
  const parts: string[] = [];

  parts.push('<section class="snapvibr-grounding" data-snapvibr-grounding="true" aria-label="Brand Grounding">');
  parts.push('<h2>Site-owner supplied context</h2>');
  parts.push('<p>These statements are supplied by the site owner, not independently verified.</p>');

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

  if (config.verifiedPricing) {
    parts.push(renderPricingTable(config.verifiedPricing));
  }

  if (config.facts) {
    parts.push(renderFactsList(config.facts));
  }

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
  config?: BrandGroundingConfig
): string {
  if (!config) return html;

  const groundingSection = renderGroundingSection(config);
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

  // Insert Grounding section into <body> if present, or prepend
  if (result.includes('<body') && result.includes('>')) {
    result = result.replace(/(<body[^>]*>)/i, `$1\n${groundingSection}\n`);
  } else if (result.includes('<main>')) {
    result = result.replace('<main>', `<main>\n${groundingSection}\n`);
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
