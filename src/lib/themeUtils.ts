export function applyVariablesToRoot(root: HTMLElement, variables: Record<string, string>) {
  for (const [key, value] of Object.entries(variables)) {
    if (value != null && key.startsWith('--')) {
      root.style.setProperty(key, value);
    }
  }
}

const TYPOGRAPHY_VARS = [
  '--font-family',
  '--font-body',
  '--font-heading',
  '--line-height',
  '--letter-spacing',
] as const;

export function applyTypographyFromAppearance(
  root: HTMLElement,
  appearance: import('@shellui/sdk').Appearance | null,
) {
  if (!appearance) {
    TYPOGRAPHY_VARS.forEach((name) => root.style.removeProperty(name));
    if (document.body) document.body.style.removeProperty('font-family');
    return;
  }

  const bodyFont = appearance.bodyFontFamily ?? appearance.fontFamily;
  const headingFont = appearance.headingFontFamily ?? appearance.fontFamily;
  const genericFont = appearance.fontFamily ?? bodyFont;

  if (genericFont != null) root.style.setProperty('--font-family', genericFont);
  else root.style.removeProperty('--font-family');

  if (bodyFont != null) {
    root.style.setProperty('--font-body', bodyFont);
    if (document.body) document.body.style.setProperty('font-family', bodyFont);
  } else {
    root.style.removeProperty('--font-body');
    if (document.body) document.body.style.removeProperty('font-family');
  }

  if (headingFont != null) root.style.setProperty('--font-heading', headingFont);
  else root.style.removeProperty('--font-heading');

  if (appearance.lineHeight != null) root.style.setProperty('--line-height', appearance.lineHeight);
  else root.style.removeProperty('--line-height');

  if (appearance.letterSpacing != null) {
    root.style.setProperty('--letter-spacing', appearance.letterSpacing);
  } else {
    root.style.removeProperty('--letter-spacing');
  }
}

const FONT_LINK_ID = 'shellui-theme-fonts';

export function applyFontFiles(urls: string[] | undefined) {
  const existing = document.getElementById(FONT_LINK_ID);
  if (existing) existing.remove();
  if (!urls?.length) return;
  for (let i = 0; i < urls.length; i++) {
    const link = document.createElement('link');
    if (i === 0) link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    const u = urls[i] as string | { href?: string; url?: string };
    link.href = typeof u === 'string' ? u : u.href || u.url || '';
    document.head?.appendChild(link);
  }
}

export const KEY_TO_CSS_VAR: Record<string, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  radius: '--radius',
};
