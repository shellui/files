import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';

export type ViewerKind =
  'image' | 'pdf' | 'video' | 'audio' | 'text' | 'markdown' | 'json' | 'unsupported';

/** Tags and URL schemes the Markdown preview is allowed to keep. */
export const PREVIEW_HTML_SANITIZE: Config = {
  ALLOWED_TAGS: [
    'a',
    'br',
    'code',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'p',
    'pre',
    'strong',
    'ul',
  ],
  ALLOWED_ATTR: ['class', 'href', 'rel', 'target'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOWED_URI_REGEXP: /^https?:\/\//i,
};

let previewHooksReady = false;

function ensurePreviewHooks(): void {
  if (previewHooksReady || typeof window === 'undefined') return;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A') return;
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  });
  previewHooksReady = true;
}

/** Strip everything outside the preview allow-list, including event handlers. */
export function sanitizePreviewHtml(html: string): string {
  if (typeof window === 'undefined') {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  ensurePreviewHooks();
  return DOMPurify.sanitize(html, PREVIEW_HTML_SANITIZE);
}

const TEXT_EXTENSIONS = new Set([
  'txt',
  'log',
  'csv',
  'tsv',
  'md',
  'markdown',
  'json',
  'jsonc',
  'xml',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cpp',
  'hpp',
  'sh',
  'bash',
  'zsh',
  'sql',
  'graphql',
  'vue',
  'svelte',
  'dockerfile',
]);

function extensionOf(name: string): string {
  const base = name.split('/').pop() || name;
  if (base.toLowerCase() === 'dockerfile') return 'dockerfile';
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

/** Resolve how to preview a file from MIME + filename. */
export function resolveViewerKind(mime: string | null | undefined, name: string): ViewerKind {
  const type = (mime || '').toLowerCase().split(';')[0].trim();
  const ext = extensionOf(name);

  if (
    type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)
  ) {
    return 'image';
  }
  // PDF preview requires a content type of application/pdf.
  if (type === 'application/pdf') {
    return 'pdf';
  }
  if (type.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext)) {
    return 'video';
  }
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    return 'audio';
  }
  if (
    type === 'application/json' ||
    type === 'application/ld+json' ||
    type.endsWith('+json') ||
    ext === 'json' ||
    ext === 'jsonc'
  ) {
    return 'json';
  }
  if (
    type === 'text/markdown' ||
    type === 'text/x-markdown' ||
    ext === 'md' ||
    ext === 'markdown'
  ) {
    return 'markdown';
  }
  if (
    type.startsWith('text/') ||
    type === 'application/xml' ||
    type === 'application/javascript' ||
    type === 'application/typescript' ||
    type === 'application/x-sh' ||
    type === 'application/sql' ||
    type.endsWith('+xml') ||
    TEXT_EXTENSIONS.has(ext)
  ) {
    return 'text';
  }
  return 'unsupported';
}

export function canPreviewInBrowser(mime: string | null | undefined, name: string): boolean {
  return resolveViewerKind(mime, name) !== 'unsupported';
}

function bareMime(value: string | null | undefined): string {
  return (value || '').toLowerCase().split(';')[0].trim();
}

/**
 * Mime used to choose a preview after the bytes are loaded.
 * When the download content type is present and is not PDF, it replaces a listed PDF type.
 */
export function previewMime(
  responseType: string | null | undefined,
  listedType: string | null | undefined,
): string {
  const response = bareMime(responseType);
  const listed = bareMime(listedType);
  const specificResponse = response && response !== 'application/octet-stream' ? response : '';
  if (listed === 'application/pdf' && specificResponse && specificResponse !== 'application/pdf') {
    return specificResponse;
  }
  return listed || specificResponse || response || 'application/octet-stream';
}

const PDF_MAGIC = '%PDF-';
/** ISO 32000 whitespace: NUL, HT, LF, FF, CR, SP. */
const PDF_WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);

async function readBlobPrefix(blob: Blob, length: number): Promise<Uint8Array> {
  const head = blob.slice(0, length);
  if (typeof head.arrayBuffer === 'function') {
    return new Uint8Array(await head.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(head);
  });
}

/**
 * True when the file starts with the PDF header. Content type and name are not enough.
 * Leading ISO 32000 whitespace (NUL, HT, LF, FF, CR, SP) is skipped; the next bytes must
 * be `%PDF-`. Nothing later in the file is inspected, so HTML that embeds `%PDF-` is refused.
 */
export async function hasPdfHeader(blob: Blob): Promise<boolean> {
  const bytes = await readBlobPrefix(blob, 1024);
  let offset = 0;
  while (offset < bytes.length && PDF_WHITESPACE.has(bytes[offset])) {
    offset += 1;
  }
  if (offset + PDF_MAGIC.length > bytes.length) return false;
  return PDF_MAGIC.split('').every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}

const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export function isTextTooLarge(size: number | undefined | null): boolean {
  return size != null && size > MAX_TEXT_BYTES;
}

/** Escape HTML then apply a light Markdown subset for previews. */
export function renderMarkdownLite(source: string): string {
  const escaped = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const lines = escaped.split('\n');
  const html: string[] = [];
  let inCode = false;
  let inList = false;

  const flushList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  const inline = (line: string) =>
    line
      .replace(/`([^`]+)`/g, '<code class="viewer-md-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(
        /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="viewer-md-link">$1</a>',
      );

  for (const raw of lines) {
    if (raw.startsWith('```')) {
      if (inCode) {
        html.push('</code></pre>');
        inCode = false;
      } else {
        flushList();
        html.push('<pre class="viewer-md-pre"><code>');
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      html.push(`${raw}\n`);
      continue;
    }
    if (/^#{1,6}\s+/.test(raw)) {
      flushList();
      const level = raw.match(/^#+/)?.[0].length ?? 1;
      const text = raw.replace(/^#{1,6}\s+/, '');
      html.push(`<h${level} class="viewer-md-h">${inline(text)}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(raw)) {
      if (!inList) {
        html.push('<ul class="viewer-md-ul">');
        inList = true;
      }
      html.push(`<li>${inline(raw.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    flushList();
    if (!raw.trim()) {
      html.push('<br />');
      continue;
    }
    html.push(`<p class="viewer-md-p">${inline(raw)}</p>`);
  }
  if (inCode) html.push('</code></pre>');
  flushList();
  return sanitizePreviewHtml(html.join(''));
}

export function formatJsonText(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
