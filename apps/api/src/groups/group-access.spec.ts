import { hasRole } from './group-access.service.js';

describe('hasRole', () => {
  it('orders owner > admin > member', () => {
    expect(hasRole('owner', 'admin')).toBe(true);
    expect(hasRole('admin', 'admin')).toBe(true);
    expect(hasRole('member', 'admin')).toBe(false);
    expect(hasRole('admin', 'owner')).toBe(false);
    expect(hasRole('member', 'member')).toBe(true);
  });
});
