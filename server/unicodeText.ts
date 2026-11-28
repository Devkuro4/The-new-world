const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

export function graphemes(value: string): string[] {
  return segmenter
    ? [...segmenter.segment(value)].map(part => part.segment)
    : Array.from(value);
}

export function graphemeLength(value: string): number {
  return graphemes(value).length;
}

export function truncateGraphemes(value: string, maximum: number): string {
  return graphemes(value).slice(0, maximum).join('');
}

export function normalizeDisplayName(value: string, maximum = 24): string {
  // NFC keeps decorative mathematical alphabets intact while composing normal
  // accents consistently. Symbols, emoji and non-Latin scripts are allowed.
  const cleaned = value
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cs}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  return truncateGraphemes(cleaned, maximum);
}
