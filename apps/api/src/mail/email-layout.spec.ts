import { renderEmail } from './email-layout.js';

describe('renderEmail', () => {
  it('escapes user-provided content in HTML', () => {
    const { html, text } = renderEmail({
      heading: 'Join <b>Smiths</b>',
      paragraphs: ['Alice & Bob invited you'],
      action: { label: 'Accept', url: 'http://localhost:3000/invite/abc?x="1"' },
    });
    expect(html).toContain('Join &lt;b&gt;Smiths&lt;/b&gt;');
    expect(html).toContain('Alice &amp; Bob invited you');
    expect(html).toContain('href="http://localhost:3000/invite/abc?x=&quot;1&quot;"');
    expect(text).toContain('Accept: http://localhost:3000/invite/abc?x="1"');
  });
});
