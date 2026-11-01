/**
 * React helper components for next-agent-ready.
 */

import React from 'react';
import type { BrandGroundingConfig } from '../types/index.js';

export interface AgentGroundingProps {
  brand: BrandGroundingConfig;
}

/**
 * Declares brand grounding facts and Schema.org JSON-LD in the component tree.
 */
export function AgentGrounding({ brand }: AgentGroundingProps): React.JSX.Element {
  return (
    <section className="site-overview" style={{ display: 'none' }} aria-hidden="false">
      {brand.brandName && <h2>{brand.brandName}</h2>}
      {brand.tagline && <p><strong>Tagline:</strong> {brand.tagline}</p>}
      {brand.description && <p><strong>Description:</strong> {brand.description}</p>}
      {brand.canonicalUrl && (
        <p>
          <strong>Canonical:</strong>{' '}
          <a href={brand.canonicalUrl}>{brand.canonicalUrl}</a>
        </p>
      )}
      {brand.facts && (
        <ul>
          {Array.isArray(brand.facts)
            ? brand.facts.map((fact, idx) => <li key={idx}>{fact}</li>)
            : Object.entries(brand.facts).map(([k, v]) => (
                <li key={k}>
                  <strong>{k}:</strong> {String(v)}
                </li>
              ))}
        </ul>
      )}
      {brand.jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(brand.jsonLd) }}
        />
      )}
    </section>
  );
}

export interface AgentOnlyProps {
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
}

/**
 * Marks content exclusively for AI agents.
 * Remains visible to crawlers during semantic processing while hidden visually in browsers.
 */
export function AgentOnly({
  children,
  as: Component = 'div',
  className,
}: AgentOnlyProps): React.JSX.Element {
  const Comp = Component as any;
  return (
    <Comp data-agent-only="true" className={className} style={{ display: 'none' }}>
      {children}
    </Comp>
  );
}

export interface AgentExcludeProps {
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
}

/**
 * Marks layout chrome, banners, or decorative elements to be completely stripped
 * when served to AI agents.
 */
export function AgentExclude({
  children,
  as: Component = 'div',
  className,
}: AgentExcludeProps): React.JSX.Element {
  const Comp = Component as any;
  return (
    <Comp data-agent-exclude="true" className={className}>
      {children}
    </Comp>
  );
}

export interface AgentFactProps {
  label: string;
  value: string | number;
}

/**
 * Semantically tags a single authoritative brand or product fact.
 */
export function AgentFact({ label, value }: AgentFactProps): React.JSX.Element {
  return (
    <span data-agent-fact="true">
      <strong>{`${label}: `}</strong>
      {value}
    </span>
  );
}
