import { describe, expect, it } from 'vitest';
import {
  PREVIEW_IFRAME_SANDBOX,
  previewMime,
  renderMarkdownLite,
  resolveViewerKind,
} from '@/lib/viewer';

function activeMarkup(html: string): { tags: string[]; handlers: string[]; hrefs: string[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tags: string[] = [];
  const handlers: string[] = [];
  const hrefs: string[] = [];
  for (const el of doc.body.querySelectorAll('*')) {
    tags.push(el.tagName.toLowerCase());
    for (const attr of el.attributes) {
      if (attr.name.toLowerCase().startsWith('on')) handlers.push(attr.name);
      if (attr.name === 'href') hrefs.push(attr.value);
    }
  }
  return { tags, handlers, hrefs };
}

describe('resolveViewerKind', () => {
  it('treats application/pdf as a PDF preview', () => {
    expect(resolveViewerKind('application/pdf', 'notes.bin')).toBe('pdf');
    expect(resolveViewerKind('application/pdf; charset=binary', 'notes.html')).toBe('pdf');
  });

  it('keeps a .pdf name on the content type', () => {
    expect(resolveViewerKind('text/html', 'report.pdf')).toBe('text');
    expect(resolveViewerKind('text/plain', 'report.pdf')).toBe('text');
    expect(resolveViewerKind('application/octet-stream', 'report.pdf')).toBe('unsupported');
    expect(resolveViewerKind('', 'report.pdf')).toBe('unsupported');
    expect(resolveViewerKind(null, 'report.pdf')).toBe('unsupported');
  });
});

describe('previewMime', () => {
  it('keeps a listed PDF when the response is PDF or generic', () => {
    expect(previewMime('application/pdf', 'application/pdf')).toBe('application/pdf');
    expect(previewMime('', 'application/pdf')).toBe('application/pdf');
    expect(previewMime('application/octet-stream', 'application/pdf')).toBe('application/pdf');
  });

  it('uses a non-PDF response type when the listing says PDF', () => {
    expect(previewMime('text/html', 'application/pdf')).toBe('text/html');
    expect(previewMime('text/plain; charset=utf-8', 'application/pdf')).toBe('text/plain');
  });

  it('keeps listed markdown and json when the response is text/plain', () => {
    expect(previewMime('text/plain', 'text/markdown')).toBe('text/markdown');
    expect(previewMime('text/plain; charset=utf-8', 'application/json')).toBe('application/json');
  });
});

describe('PREVIEW_IFRAME_SANDBOX', () => {
  it('grants no same-origin access and no scripts', () => {
    const tokens = PREVIEW_IFRAME_SANDBOX.split(/\s+/).filter(Boolean);
    expect(tokens).not.toContain('allow-same-origin');
    expect(tokens).not.toContain('allow-scripts');
    expect(tokens).not.toContain('allow-top-navigation');
  });
});

describe('renderMarkdownLite', () => {
  it('renders the safe subset', () => {
    const html = renderMarkdownLite('# Title\n\n**bold** and [docs](https://shellui.com/docs)');
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://shellui.com/docs"');
    const parsed = activeMarkup(html);
    expect(parsed.handlers).toEqual([]);
    expect(parsed.hrefs).toEqual(['https://shellui.com/docs']);
  });

  it('drops raw HTML and broken link handlers', () => {
    const html = renderMarkdownLite(
      [
        'Hello <script>alert(1)</script>',
        '<img src=x onerror="alert(1)">',
        '<svg onload="alert(1)"></svg>',
        '[x](javascript:alert(1))',
        '[y](https://evil.test/"onmouseover="alert(1))',
        '[z](https://shellui.com/ok)',
      ].join('\n\n'),
    );
    const parsed = activeMarkup(html);
    expect(parsed.tags).not.toContain('script');
    expect(parsed.tags).not.toContain('img');
    expect(parsed.tags).not.toContain('svg');
    expect(parsed.tags).not.toContain('iframe');
    expect(parsed.handlers).toEqual([]);
    expect(parsed.hrefs.some((href) => /^\s*javascript:/i.test(href))).toBe(false);
    expect(parsed.hrefs).toContain('https://shellui.com/ok');
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html.toLowerCase()).not.toMatch(/<\s*img\b/);
  });
});
