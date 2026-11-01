import { describe, it, expect } from 'vitest';
import { convertSemanticHtmlToMarkdown } from '../src/core/text-serializer.js';

describe('html-to-markdown', () => {
  it('converts headings, paragraphs, and inline formatting', () => {
    const html = `
      <h1>Main Title</h1>
      <p>This is a <strong>bold</strong> statement with <em>emphasis</em> and <code>inline code</code>.</p>
      <h2>Sub Title</h2>
      <p>Second paragraph with <a href="https://example.com">external link</a>.</p>
    `;

    const md = convertSemanticHtmlToMarkdown(html);
    expect(md).toContain('# Main Title');
    expect(md).toContain('**bold**');
    expect(md).toContain('*emphasis*');
    expect(md).toContain('`inline code`');
    expect(md).toContain('## Sub Title');
    expect(md).toContain('[external link](https://example.com)');
  });

  it('converts tables to github flavored markdown tables', () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Starter</td>
            <td>$29/mo</td>
          </tr>
          <tr>
            <td>Scale</td>
            <td>$99/mo</td>
          </tr>
        </tbody>
      </table>
    `;

    const md = convertSemanticHtmlToMarkdown(html);
    expect(md).toContain('| Plan | Price |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| Starter | $29/mo |');
    expect(md).toContain('| Scale | $99/mo |');
  });

  it('converts code blocks, blockquotes, and lists', () => {
    const html = `
      <blockquote>
        <p>A wise quote here.</p>
      </blockquote>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
      <pre><code>const a = 1;
const b = 2;</code></pre>
    `;

    const md = convertSemanticHtmlToMarkdown(html);
    expect(md).toContain('> A wise quote here.');
    expect(md).toContain('- Item 1');
    expect(md).toContain('- Item 2');
    expect(md).toContain('```\nconst a = 1;\nconst b = 2;\n```');
  });
});
