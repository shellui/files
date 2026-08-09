export function isEmbeddedInShell(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
