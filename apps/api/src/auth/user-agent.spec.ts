import { describeUserAgent } from './user-agent.js';

describe('describeUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Chrome on macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari on iOS',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
      'Firefox on Windows',
    ],
    ['curl/8.7.1', 'curl/8.7.1'],
    [null, 'an unknown device'],
  ])('%s -> %s', (userAgent, expected) => {
    expect(describeUserAgent(userAgent)).toBe(expected);
  });
});
