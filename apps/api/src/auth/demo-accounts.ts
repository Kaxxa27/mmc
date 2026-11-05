/** Shared demo accounts (`DEMO_ACCOUNTS_ENABLED`): fixed users anyone can sign in as. */
export const DEMO_MEMBER_KEYS = ['anna', 'ben', 'chloe'] as const;
export type DemoMemberKey = (typeof DEMO_MEMBER_KEYS)[number];

export const DEMO_NAMESPACE = 'demo';

export function demoEmail(member: string, namespace = DEMO_NAMESPACE): string {
  return `${member.toLowerCase()}.${namespace}@example.com`;
}

const SHARED_DEMO_EMAILS = new Set<string>(DEMO_MEMBER_KEYS.map((key) => demoEmail(key)));

/** True for the shared demo accounts that any visitor can sign in to. */
export function isSharedDemoEmail(email: string | null | undefined): boolean {
  return !!email && SHARED_DEMO_EMAILS.has(email.trim().toLowerCase());
}
