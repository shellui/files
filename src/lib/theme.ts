import type { Appearance, Settings } from '@shellui/sdk';
import {
  KEY_TO_CSS_VAR,
  applyVariablesToRoot,
  applyTypographyFromAppearance,
  applyFontFiles,
} from './themeUtils';

export function getAppearanceFromSettings(settings: Settings | null | undefined) {
  return settings?.appearance ?? null;
}

export function getAppearanceFromPayload(
  payload: { settings?: Settings } | Settings | null | undefined,
): Appearance | null {
  if (!payload || typeof payload !== 'object') return null;
  if ('settings' in payload) return payload.settings?.appearance ?? null;
  return (payload as Settings).appearance ?? null;
}

export function applyThemeToDocument(appearance: Appearance | null) {
  const root = document.documentElement;
  if (!appearance) {
    root.classList.remove('dark');
    return;
  }

  if (appearance.mode === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');

  const colorsForMode = appearance.colors?.[appearance.mode];
  if (colorsForMode && typeof colorsForMode === 'object') {
    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(colorsForMode)) {
      const cssVar = KEY_TO_CSS_VAR[key];
      if (cssVar && value != null) variables[cssVar] = String(value);
    }
    applyVariablesToRoot(root, variables);
  }

  applyTypographyFromAppearance(root, appearance);
  applyFontFiles(appearance.fontFiles as string[] | undefined);
}
