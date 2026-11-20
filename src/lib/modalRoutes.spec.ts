import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeAppDrawer, closeAppModal, sendSelectResult } from '@/lib/modalRoutes';

const PARENT_ORIGIN = 'https://admin.example';

function stubEmbedded(parentOrigin: string | null) {
  const parentPostMessage = vi.fn();
  const selfPostMessage = vi.fn();
  vi.stubGlobal('window', {
    parent: { postMessage: parentPostMessage },
    location: { origin: 'http://localhost:5175', hash: '#/share?bucket=company&path=a' },
    postMessage: selfPostMessage,
  });
  vi.stubGlobal('document', {
    referrer: parentOrigin ? `${parentOrigin}/admin` : '',
    location: parentOrigin ? { ancestorOrigins: [parentOrigin] } : {},
  });
  return { parentPostMessage, selfPostMessage };
}

describe('shell message targets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  it('posts picker results to this origin when the window is top-level', () => {
    const spy = vi.spyOn(window, 'postMessage');
    sendSelectResult({ id: 'req-1', cancelled: true });
    expect(spy).toHaveBeenCalledWith(
      {
        type: 'SHELLUI_SELECT_STORAGE_RESULT',
        payload: { id: 'req-1', cancelled: true },
      },
      window.location.origin,
    );
    expect(spy.mock.calls.map((call) => String(call[1]))).not.toContain('*');
  });

  it('posts picker results to the parent origin', () => {
    const { parentPostMessage, selfPostMessage } = stubEmbedded(PARENT_ORIGIN);
    sendSelectResult({
      id: 'req-2',
      items: [{ id: '1', bucket: 'company', path: 'a.pdf', name: 'a.pdf', type: 'file' }],
    });
    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    expect(parentPostMessage.mock.calls[0]?.[1]).toBe(PARENT_ORIGIN);
    expect(parentPostMessage.mock.calls[0]?.[0]).toMatchObject({
      type: 'SHELLUI_SELECT_STORAGE_RESULT',
    });
    expect(selfPostMessage).not.toHaveBeenCalled();
    expect(parentPostMessage.mock.calls.some((call) => call[1] === '*')).toBe(false);
  });

  it('posts modal and drawer close to the parent origin', () => {
    const modal = stubEmbedded(PARENT_ORIGIN);
    closeAppModal();
    expect(modal.parentPostMessage).toHaveBeenCalledWith(
      { type: 'SHELLUI_CLOSE_MODAL', payload: {} },
      PARENT_ORIGIN,
    );

    vi.unstubAllGlobals();
    const drawer = stubEmbedded(PARENT_ORIGIN);
    closeAppDrawer();
    expect(drawer.parentPostMessage).toHaveBeenCalledWith(
      { type: 'SHELLUI_CLOSE_DRAWER', payload: {} },
      PARENT_ORIGIN,
    );
    expect(drawer.parentPostMessage.mock.calls.some((call) => call[1] === '*')).toBe(false);
  });

  it('does not post when the parent origin is unknown', () => {
    const { parentPostMessage, selfPostMessage } = stubEmbedded(null);
    sendSelectResult({ id: 'req-3', cancelled: true });
    closeAppModal();
    closeAppDrawer();
    expect(parentPostMessage).not.toHaveBeenCalled();
    expect(selfPostMessage).not.toHaveBeenCalled();
  });

  it('clears the hash instead of posting when the modal is standalone', () => {
    window.location.hash = '#/share?bucket=company&path=notes.txt';
    const spy = vi.spyOn(window, 'postMessage');
    closeAppModal();
    closeAppDrawer();
    expect(window.location.hash).toBe('');
    expect(spy).not.toHaveBeenCalled();
  });
});
