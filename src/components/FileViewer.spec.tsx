import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { FileViewer, type ViewerTarget } from '@/components/FileViewer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { download } = vi.hoisted(() => ({
  download: vi.fn(),
}));

vi.mock('@shellui/sdk', () => ({
  shellui: {
    storage: {
      from: () => ({
        download,
      }),
    },
  },
}));

function target(name: string, mimetype?: string): ViewerTarget {
  return {
    path: name,
    item: {
      id: 'obj-1',
      name,
      metadata: {
        size: 32,
        ...(mimetype ? { mimetype } : {}),
      },
    },
  };
}

function blobResponse(body: string, type: string) {
  const data = new Blob([body], { type });
  if (typeof data.text !== 'function') {
    Object.defineProperty(data, 'text', { value: async () => body });
  }
  return { data, error: null };
}

async function renderViewer(next: ViewerTarget) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <FileViewer
        bucket="company"
        target={next}
        siblings={[next]}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
  });
  await act(async () => {
    await vi.waitFor(() => {
      expect(container.querySelector('.animate-spin')).toBeNull();
    });
  });
  return { container, root };
}

describe('FileViewer preview', () => {
  let root: Root | null = null;

  beforeAll(async () => {
    if (!i18n.isInitialized) {
      await new Promise((resolve) => {
        i18n.on('initialized', () => resolve(null));
      });
    }
  });

  beforeEach(() => {
    download.mockReset();
    if (typeof URL.createObjectURL !== 'function') {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: () => 'blob:preview',
      });
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: () => undefined,
      });
    }
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = '';
  });

  it('sandboxes a PDF preview frame', async () => {
    download.mockResolvedValue(blobResponse('%PDF-1.4', 'application/pdf'));
    const rendered = await renderViewer(target('report.pdf', 'application/pdf'));
    root = rendered.root;
    const frame = rendered.container.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('sandbox')).toBe('');
    const tokens = (frame?.getAttribute('sandbox') ?? '').split(/\s+/).filter(Boolean);
    expect(tokens).not.toContain('allow-same-origin');
    expect(tokens).not.toContain('allow-scripts');
  });

  it('does not frame a .pdf name whose content type is HTML', async () => {
    download.mockResolvedValue(blobResponse('<script>alert(1)</script>', 'text/html'));
    const rendered = await renderViewer(target('report.pdf', 'text/html'));
    root = rendered.root;
    expect(rendered.container.querySelector('iframe')).toBeNull();
    expect(rendered.container.querySelector('pre')?.textContent).toContain(
      '<script>alert(1)</script>',
    );
    expect(rendered.container.querySelector('script')).toBeNull();
    expect(rendered.container.querySelector('script')).toBeNull();
  });

  it('follows a non-PDF response when the listing says PDF', async () => {
    download.mockResolvedValue(blobResponse('<p>hello</p>', 'text/html'));
    const rendered = await renderViewer(target('report.pdf', 'application/pdf'));
    root = rendered.root;
    expect(rendered.container.querySelector('iframe')).toBeNull();
    expect(rendered.container.querySelector('pre')?.textContent).toContain('<p>hello</p>');
  });

  it('does not frame a .pdf name with no content type', async () => {
    const rendered = await renderViewer(target('report.pdf'));
    root = rendered.root;
    expect(download).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('iframe')).toBeNull();
  });

  it('renders sanitized markdown', async () => {
    const source = [
      '# Title',
      '',
      '<script>alert(1)</script>',
      '',
      '[y](https://evil.test/"onmouseover="alert(1))',
      '',
      '[docs](https://shellui.com/docs)',
    ].join('\n');
    download.mockResolvedValue(blobResponse(source, 'text/plain'));
    const rendered = await renderViewer(target('notes.md', 'text/markdown'));
    root = rendered.root;
    const article = rendered.container.querySelector('article');
    expect(article).not.toBeNull();
    expect(article?.querySelector('script')).toBeNull();
    expect(article?.querySelector('h1')?.textContent).toContain('Title');
    expect(article?.querySelector('a[href="https://shellui.com/docs"]')).not.toBeNull();
    const handlers = [...(article?.querySelectorAll('*') ?? [])].flatMap((el) =>
      [...el.attributes]
        .filter((attr) => attr.name.toLowerCase().startsWith('on'))
        .map((a) => a.name),
    );
    expect(handlers).toEqual([]);
    expect(article?.querySelector('script')).toBeNull();
    expect(article?.innerHTML.toLowerCase()).not.toContain('<script');
  });
});
