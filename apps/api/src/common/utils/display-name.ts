export interface NamedPerson {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email?: string | null;
}

/** Best human-readable name for a user without exposing their email to others. */
export function displayName(person: NamedPerson): string {
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (person.username) return person.username;
  if (person.email) return person.email.split('@')[0] ?? 'Movie fan';
  return 'Movie fan';
}
