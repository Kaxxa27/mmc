import { certificationsUpTo, extractCertifications } from './certifications.js';

describe('certifications', () => {
  it('returns the allowed ratings up to a maximum', () => {
    expect(certificationsUpTo('US', 'PG')).toEqual(['G', 'PG']);
    expect(certificationsUpTo('us', 'PG-13')).toEqual(['G', 'PG', 'PG-13']);
    expect(certificationsUpTo('US', 'XYZ')).toBeNull();
    expect(certificationsUpTo('ZZ', 'PG')).toBeNull();
  });

  it('prefers theatrical certifications', () => {
    expect(
      extractCertifications({
        results: [
          {
            iso_3166_1: 'US',
            release_dates: [
              { certification: '', type: 1, release_date: '' },
              { certification: 'PG-13', type: 4, release_date: '' },
              { certification: 'PG', type: 3, release_date: '' },
            ],
          },
          {
            iso_3166_1: 'DE',
            release_dates: [{ certification: ' 12 ', type: 3, release_date: '' }],
          },
          { iso_3166_1: 'FR', release_dates: [{ certification: '', type: 3, release_date: '' }] },
        ],
      }),
    ).toEqual({ US: 'PG', DE: '12' });
  });
});
