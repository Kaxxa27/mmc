import { effectiveStatus, maskEmail } from './invitations.service.js';

const base = {
  id: 'i',
  groupId: 'g',
  kind: 'link' as const,
  email: null,
  tokenHash: 'h',
  role: 'member' as const,
  status: 'pending' as const,
  maxUses: null,
  useCount: 0,
  invitedBy: null,
  acceptedBy: null,
  acceptedAt: null,
  expiresAt: new Date('2030-01-01T00:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('invitation status', () => {
  const now = new Date('2026-11-04T12:00:00Z');

  it('is pending until it expires or runs out of uses', () => {
    expect(effectiveStatus(base, now)).toBe('pending');
    expect(effectiveStatus({ ...base, expiresAt: new Date('2026-11-01T00:00:00Z') }, now)).toBe(
      'expired',
    );
    expect(effectiveStatus({ ...base, maxUses: 2, useCount: 2 }, now)).toBe('exhausted');
    expect(effectiveStatus({ ...base, status: 'revoked' }, now)).toBe('revoked');
  });

  it('masks invited addresses', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com');
  });
});
