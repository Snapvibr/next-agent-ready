/**
 * Semantic HTML normalizer for next-agent-ready.
 * Normalizes HTML to semantic tags (h1-h6, p, tables, lists, links, code)
 * and strips utility classes, inline styles, IDs, and framework hydration attributes.
 */

import type { CleanerOptions } from '../types/index.js';

const TRACKING_PARAM_REGEX = /([?&])(?:utm_[a-z]+|fbclid|gclid|msclkid|mc_cid|mc_eid|ref|source)=[^&#]*/gi;

/**
 * Strips tracking parameters from a URL and optionally resolves relative URLs against a baseUrl.
 */
export function cleanUrl(urlStr: string, baseUrl?: string): string {
  if (!urlStr) return '';
  const trimmed = urlStr.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return trimmed;
  }

  try {
    const base = baseUrl ? new URL(baseUrl) : undefined;
    const url = new URL(trimmed, base);

    // Remove tracking search params
    const cleanParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      const lower = key.toLowerCase();
      if (
        !lower.startsWith('utm_') &&
        lower !== 'fbclid' &&
        lower !== 'gclid' &&
        lower !== 'msclkid' &&
        lower !== 'mc_cid' &&
        lower !== 'mc_eid'
      ) {
        cleanParams.append(key, value);
      }
    }

    url.search = cleanParams.toString();
    return url.toString();
  } catch {
    // If not a valid URL or relative URL without baseUrl, strip tracking query params via regex
    let cleaned = trimmed.replace(TRACKING_PARAM_REGEX, '$1');
    cleaned = cleaned.replace(/\?&/, '?').replace(/[?&]$/, '');
    return cleaned;
  }
}

/**
 * Strips utility classes, inline styles, IDs, and hydration attributes from an HTML tag string.
 */
function cleanTagAttributes(
  tag: string,
  tagName: string,
  options?: CleanerOptions
): string {
  const lowerTag = tagName.toLowerCase();

  // If this is a closing tag, return as is
  if (tag.startsWith('</')) {
    return `</${lowerTag}>`;
  }

  // Preserve JSON-LD script tags untouched
  if (lowerTag === 'script') {
    return tag;
  }

  const isSelfClosing = tag.endsWith('/>');

  // Specific semantic handling for anchor tags: <a>
  if (lowerTag === 'a') {
    const hrefMatch = tag.match(/\bhref=["']([^"']*)["']/i);
    const titleMatch = tag.match(/\btitle=["']([^"']*)["']/i);

    let cleanHref = '';
    if (hrefMatch && hrefMatch[1]) {
      cleanHref = options?.stripTrackingParams !== false
        ? cleanUrl(hrefMatch[1], options?.baseUrl)
        : hrefMatch[1];
    }

    let result = `<a href="${cleanHref}"`;
    if (titleMatch && titleMatch[1]) {
      result += ` title="${titleMatch[1].replace(/"/g, '&quot;')}"`;
    }
    result += isSelfClosing ? ' />' : '>';
    return result;
  }

  // Specific semantic handling for images: <img>
  if (lowerTag === 'img') {
    if (options?.preserveImages === false) {
      return '';
    }
    const srcMatch = tag.match(/\bsrc=["']([^"']*)["']/i);
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const titleMatch = tag.match(/\btitle=["']([^"']*)["']/i);

    const src = srcMatch ? cleanUrl(srcMatch[1], options?.baseUrl) : '';
    const alt = altMatch ? altMatch[1] : '';

    let result = `<img src="${src}" alt="${alt.replace(/"/g, '&quot;')}"`;
    if (titleMatch && titleMatch[1]) {
      result += ` title="${titleMatch[1].replace(/"/g, '&quot;')}"`;
    }
    result += ' />';
    return result;
  }

  // Specific handling for table cells: th, td (preserve colspan, rowspan, scope)
  if (lowerTag === 'th' || lowerTag === 'td') {
    const colspanMatch = tag.match(/\bcolspan=["']?(\d+)["']?/i);
    const rowspanMatch = tag.match(/\browspan=["']?(\d+)["']?/i);
    const scopeMatch = tag.match(/\bscope=["']([a-z]+)["']/i);

    let attrs = '';
    if (colspanMatch && colspanMatch[1] !== '1') {
      attrs += ` colspan="${colspanMatch[1]}"`;
    }
    if (rowspanMatch && rowspanMatch[1] !== '1') {
      attrs += ` rowspan="${rowspanMatch[1]}"`;
    }
    if (scopeMatch) {
      attrs += ` scope="${scopeMatch[1]}"`;
    }

    return `<${lowerTag}${attrs}>`;
  }

  // Specific handling for <time datetime="...">
  if (lowerTag === 'time') {
    const datetimeMatch = tag.match(/\bdatetime=["']([^"']*)["']/i);
    const dt = datetimeMatch ? ` datetime="${datetimeMatch[1]}"` : '';
    return `<time${dt}>`;
  }

  // Specific handling for meta tags: <meta name="..." content="..." />
  if (lowerTag === 'meta') {
    const nameMatch = tag.match(/\b(?:name|property)=["']([^"']*)["']/i);
    const contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);
    const charsetMatch = tag.match(/\bcharset=["']([^"']*)["']/i);

    if (charsetMatch) {
      return `<meta charset="${charsetMatch[1]}" />`;
    }
    if (nameMatch && contentMatch) {
      return `<meta name="${nameMatch[1]}" content="${contentMatch[1].replace(/"/g, '&quot;')}" />`;
    }
    return '';
  }

  // Preserve agent data attributes if present
  let agentAttrs = '';
  const agentOnly = /\bdata-agent-only=["']?(?:true|1)?["']?/i.test(tag);
  const agentGrounding = /\bdata-snapvibr-grounding=["']?(?:true|1)?["']?/i.test(tag) || /\bsnapvibr-grounding\b/i.test(tag);

  if (lowerTag === 'section' && agentGrounding) {
    return `<section class="snapvibr-grounding" data-snapvibr-grounding="true" aria-label="Brand Grounding"${isSelfClosing ? ' />' : '>'}`;
  }

  if (agentOnly) agentAttrs += ' data-agent-only="true"';
  if (agentGrounding) agentAttrs += ' class="snapvibr-grounding" data-snapvibr-grounding="true" aria-label="Brand Grounding"';

  // For all standard semantic elements: h1-h6, p, table, thead, tbody, tr, ul, ol, li,
  // blockquote, pre, code, strong, em, b, i, main, article, section
  return `<${lowerTag}${agentAttrs}${isSelfClosing ? ' />' : '>'}`;
}

/**
 * Normalizes HTML content into clean, semantic tags without hydration or styling overhead.
 */
export function cleanSemanticHtml(html: string, options?: CleanerOptions): string {
  if (!html || typeof html !== 'string') return '';

  let cleaned = html;

  // 1. Temporarily isolate Schema.org JSON-LD scripts to preserve them verbatim
  const jsonLdHolders: string[] = [];
  cleaned = cleaned.replace(
    /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    (match) => {
      const placeholder = `<!--JSON_LD_PLACEHOLDER_${jsonLdHolders.length}-->`;
      jsonLdHolders.push(match);
      return placeholder;
    }
  );

  // 2. Temporarily isolate <pre><code> blocks to preserve whitespace inside them
  const codeHolders: string[] = [];
  cleaned = cleaned.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (match) => {
    const placeholder = `<!--CODE_PLACEHOLDER_${codeHolders.length}-->`;
    codeHolders.push(match);
    return placeholder;
  });

  // 3. Clean attributes from all tags
  cleaned = cleaned.replace(/<\/?([a-zA-Z0-9-]+)(?:\s+[^>]*?)?\/?>/gi, (match, tagName) => {
    return cleanTagAttributes(match, tagName, options);
  });

  // 4. Convert non-semantic layout tags with textual content to semantic equivalents
  // Replace <b> with <strong>, <i> with <em>
  cleaned = cleaned.replace(/<b\b[^>]*>/gi, '<strong>').replace(/<\/b>/gi, '</strong>');
  cleaned = cleaned.replace(/<i\b[^>]*>/gi, '<em>').replace(/<\/i>/gi, '</em>');

  // 5. Unwrap redundant non-semantic wrappers (div, span) where possible
  // Repeatedly peel empty or simple wrapper tags
  let prev = '';
  let iterations = 0;
  while (prev !== cleaned && iterations < 5) {
    prev = cleaned;
    iterations++;

    // Remove empty tags (except self-closing img, meta, br, hr)
    cleaned = cleaned.replace(
      /<(p|span|div|section|article|li|ul|ol|strong|em|h[1-6])>\s*<\/\1>/gi,
      ''
    );

    // Unwrap <span>content</span> -> content
    cleaned = cleaned.replace(/<span>([\s\S]*?)<\/span>/gi, '$1');

    // Convert <div>text</div> (no child block tags) into <p>text</p>
    cleaned = cleaned.replace(
      /<div>([^<]+)<\/div>/gi,
      '<p>$1</p>'
    );
  }

  // 6. Restore code blocks (cleaning attributes from <pre> and <code>)
  cleaned = cleaned.replace(/<!--CODE_PLACEHOLDER_(\d+)-->/g, (_, idx) => {
    const original = codeHolders[Number(idx)];
    return original.replace(/<pre[^>]*>/i, '<pre>').replace(/<code[^>]*>/i, '<code>');
  });

  // 7. Restore JSON-LD placeholders
  cleaned = cleaned.replace(/<!--JSON_LD_PLACEHOLDER_(\d+)-->/g, (_, idx) => {
    return jsonLdHolders[Number(idx)];
  });

  // 8. Normalize spacing and blank lines
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  return cleaned;
}
