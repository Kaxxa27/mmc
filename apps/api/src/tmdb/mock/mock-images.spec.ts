import { renderMockImage, wrapText } from './mock-images.js';

describe('mock images', () => {
  it('wraps long titles and truncates with an ellipsis', () => {
    expect(wrapText('The Lord of the Rings: The Fellowship of the Ring', 15, 5)).toEqual([
      'The Lord of the',
      'Rings: The',
      'Fellowship of',
      'the Ring',
    ]);
    expect(wrapText('one two three four five six', 3, 2)).toEqual(['one', 'two…']);
  });

  it('renders valid, escaped SVG for every kind', () => {
    for (const kind of ['poster', 'backdrop', 'profile', 'logo'] as const) {
      const svg = renderMockImage(kind, { label: 'Tom & "Jerry" <3', sublabel: '1995', seed: 862 });
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).not.toContain('<3');
      expect(svg).toContain('&amp;');
    }
  });
});
