export type ViewerKind =
  'image' | 'pdf' | 'video' | 'audio' | 'text' | 'markdown' | 'json' | 'unsupported';

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
  if (type === 'application/pdf' || ext === 'pdf') {
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

const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export function isTextTooLarge(size: number | undefined | null): boolean {
  return size != null && size > MAX_TEXT_BYTES;
}

/** Escape HTML then apply a light Markdown subset for previews. */
export function renderMarkdownLite(source: string): string {
  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
  return html.join('');
}

export function formatJsonText(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
