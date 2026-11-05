export const MOCK_IMAGE_KINDS = ['poster', 'backdrop', 'profile', 'logo'] as const;
export type MockImageKind = (typeof MOCK_IMAGE_KINDS)[number];

export interface MockImageLabel {
  label: string;
  sublabel: string | null;
  seed: number;
}

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

/** Splits text into at most `maxLines` lines of roughly `width` characters. */
export function wrapText(text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= width) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/[.,;:!?]?$/, '')}…`;
  return kept;
}

const initials = (text: string): string =>
  text
    .split(/[\s-]+/)
    .filter((part) => /\p{L}|\p{N}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

const FONT = 'font-family="\'Helvetica Neue\', Helvetica, Arial, sans-serif"';

/** A deterministic, readable SVG placeholder for mock posters, backdrops, profiles and logos. */
export function renderMockImage(
  kind: MockImageKind,
  { label, sublabel, seed }: MockImageLabel,
): string {
  const hue = (seed * 47) % 360;
  const from = `hsl(${hue}, 62%, 42%)`;
  const to = `hsl(${(hue + 48) % 360}, 68%, 14%)`;
  const gradient = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>`;
  const tspans = (lines: string[], x: number, lineHeight: number) =>
    lines
      .map(
        (line, index) =>
          `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
      )
      .join('');

  switch (kind) {
    case 'poster': {
      const lines = wrapText(label, 15, 5);
      const startY = 330 - ((lines.length - 1) * 56) / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750" role="img" aria-label="${escapeXml(label)}">${gradient}<rect width="500" height="750" fill="url(#g)"/><circle cx="430" cy="110" r="170" fill="#fff" fill-opacity="0.07"/><circle cx="50" cy="660" r="230" fill="#000" fill-opacity="0.15"/><text x="250" y="${startY}" ${FONT} font-size="46" font-weight="700" fill="#fff" text-anchor="middle">${tspans(lines, 250, 56)}</text>${sublabel ? `<text x="250" y="${startY + lines.length * 56 + 40}" ${FONT} font-size="30" fill="#fff" fill-opacity="0.8" text-anchor="middle">${escapeXml(sublabel)}</text>` : ''}<text x="250" y="712" ${FONT} font-size="18" letter-spacing="5" fill="#fff" fill-opacity="0.55" text-anchor="middle">MOCK POSTER</text></svg>`;
    }
    case 'backdrop': {
      const lines = wrapText(label, 26, 2);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(label)}">${gradient}<rect width="1280" height="720" fill="url(#g)"/><circle cx="1100" cy="160" r="320" fill="#fff" fill-opacity="0.06"/><rect y="430" width="1280" height="290" fill="#000" fill-opacity="0.25"/><text x="80" y="${lines.length > 1 ? 540 : 590}" ${FONT} font-size="72" font-weight="700" fill="#fff">${tspans(lines, 80, 82)}</text>${sublabel ? `<text x="80" y="670" ${FONT} font-size="32" fill="#fff" fill-opacity="0.75">${escapeXml(sublabel)}</text>` : ''}<text x="1200" y="680" ${FONT} font-size="20" letter-spacing="5" fill="#fff" fill-opacity="0.5" text-anchor="end">MOCK BACKDROP</text></svg>`;
    }
    case 'profile': {
      const lines = wrapText(label, 14, 2);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450" role="img" aria-label="${escapeXml(label)}">${gradient}<rect width="300" height="450" fill="url(#g)"/><circle cx="150" cy="170" r="95" fill="#fff" fill-opacity="0.16"/><text x="150" y="196" ${FONT} font-size="72" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(initials(label))}</text><text x="150" y="330" ${FONT} font-size="30" font-weight="600" fill="#fff" text-anchor="middle">${tspans(lines, 150, 36)}</text></svg>`;
    }
    case 'logo':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="${escapeXml(label)}"><rect width="120" height="120" rx="26" fill="${from}"/><text x="60" y="75" ${FONT} font-size="44" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(initials(label))}</text></svg>`;
  }
}
