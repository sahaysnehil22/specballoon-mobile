// DATUM STUDIO theme — mirrors the SpecBalloon web site.
// Dark graphite #0B0B0A, anodized stone #E6E5E0, Micrometer Safety Orange
// #EA580C, cobalt #0284C7, ink #09090B. No gradients, no neon, hairlines only.

export const COLORS = {
  bg: '#0B0B0A',
  ink: '#09090B',
  panel: '#141413',
  panel2: '#1A1A19',
  stone: '#E6E5E0',
  muted: '#9C9B96',
  faint: '#6B6A66',
  hairline: '#2A2A28',
  orange: '#EA580C',
  orangeSoft: '#FF5500',
  cobalt: '#0284C7',
  pass: '#22C55E',
  warn: '#F59E0B',
  fail: '#EF4444',
  review: '#F59E0B',
} as const;

export const FONT = {
  mono: 'monospace',
} as const;

/** Small caps section label, e.g. "BAY 01 // PIPELINE". */
export const LABEL = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
  color: COLORS.muted,
};

export const DESIGNATOR_COLOR: Record<string, string> = {
  Critical: COLORS.orange,
  Major: COLORS.cobalt,
  Minor: COLORS.muted,
  Standard: COLORS.muted,
};

export function designatorColor(designator: string): string {
  return DESIGNATOR_COLOR[designator] ?? COLORS.muted;
}
