import { timestamp } from 'drizzle-orm/pg-core';

/** `timestamptz` column returned as a JS `Date`. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const createdAt = () => timestamptz('created_at').notNull().defaultNow();

/** Kept current by the `private.set_updated_at` trigger (see the custom migration). */
export const updatedAt = () => timestamptz('updated_at').notNull().defaultNow();
