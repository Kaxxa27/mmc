import { extractMentions } from './comments.service.js';

describe('extractMentions', () => {
  it('finds @usernames once, case-insensitively', () => {
    expect(extractMentions('@Anna and @bob_99, what about this? cc @anna')).toEqual([
      'anna',
      'bob_99',
    ]);
  });

  it('ignores emails and too-short names', () => {
    expect(extractMentions('write to me@example.com or @ab')).toEqual([]);
  });

  it('accepts mentions at the start and after punctuation', () => {
    expect(extractMentions('(@carol) @dave!')).toEqual(['carol', 'dave']);
  });
});
